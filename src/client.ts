import {
  ShadowWireClientConfig,
  PoolBalance,
  DepositRequest,
  DepositResponse,
  WithdrawRequest,
  WithdrawResponse,
  UploadProofRequest,
  UploadProofResponse,
  ExternalTransferRequest,
  InternalTransferRequest,
  ZKTransferResponse,
  TransferRequest,
  TransferResponse,
  TransferWithClientProofsRequest,
  TokenSymbol,
  ZKProofData,
  WalletAdapter,
} from './types';
import { DEFAULT_API_BASE_URL, DEFAULT_NETWORK, TOKEN_FEES, TOKEN_MINIMUMS } from './constants';
import { TokenUtils } from './tokens';
import { validateSolanaAddress, generateNonce, makeHttpRequest } from './utils';
import { InvalidAmountError, RecipientNotFoundError, TransferError } from './errors';
import { generateRangeProof, isWASMSupported, initWASM } from './zkProofs';
import { generateTransferSignature, determineSignatureTransferType } from './auth';

export class ShadowWireClient {
  private apiKey?: string;
  private apiBaseUrl: string;
  private network: string;
  private debug: boolean;

  constructor(config: ShadowWireClientConfig = {}) {
    this.apiKey = config.apiKey;
    this.apiBaseUrl = config.apiBaseUrl || DEFAULT_API_BASE_URL;
    this.network = config.network || DEFAULT_NETWORK;
    this.debug = config.debug || false;
  }

  async getBalance(wallet: string, token?: TokenSymbol): Promise<PoolBalance> {
    validateSolanaAddress(wallet);
    
    let url = `${this.apiBaseUrl}/pool/balance/${wallet}`;
    
    if (token) {
      const tokenMint = TokenUtils.getTokenMint(token);
      if (tokenMint !== 'Native') {
        url += `?token_mint=${tokenMint}`;
      }
    }
    
    return makeHttpRequest<PoolBalance>(url, 'GET', this.apiKey, undefined, this.debug);
  }

  async deposit(request: DepositRequest): Promise<DepositResponse> {
    validateSolanaAddress(request.wallet);
    
    if (request.amount <= 0) {
      throw new InvalidAmountError('Deposit amount must be greater than zero');
    }
    
    return makeHttpRequest<DepositResponse>(
      `${this.apiBaseUrl}/pool/deposit`,
      'POST',
      this.apiKey,
      request,
      this.debug
    );
  }

  async withdraw(request: WithdrawRequest): Promise<WithdrawResponse> {
    validateSolanaAddress(request.wallet);
    
    if (request.amount <= 0) {
      throw new InvalidAmountError('Withdrawal amount must be greater than zero');
    }
    
    return makeHttpRequest<WithdrawResponse>(
      `${this.apiBaseUrl}/pool/withdraw`,
      'POST',
      this.apiKey,
      request,
      this.debug
    );
  }

  async uploadProof(request: UploadProofRequest): Promise<UploadProofResponse> {
    validateSolanaAddress(request.sender_wallet);
    
    if (request.amount <= 0) {
      throw new InvalidAmountError('Amount must be greater than zero');
    }
    
    return makeHttpRequest<UploadProofResponse>(
      `${this.apiBaseUrl}/zk/upload-proof`,
      'POST',
      this.apiKey,
      request,
      this.debug
    );
  }

  async externalTransfer(request: ExternalTransferRequest, wallet?: WalletAdapter): Promise<ZKTransferResponse> {
    validateSolanaAddress(request.sender_wallet);
    validateSolanaAddress(request.recipient_wallet);
    
    if (request.sender_wallet === request.recipient_wallet) {
      throw new TransferError('Cannot transfer to yourself');
    }

    let requestData: any = {
      sender_wallet: request.sender_wallet,
      recipient_wallet: request.recipient_wallet,
      token: request.token,
      nonce: request.nonce,
      amount: request.amount,
      proof_bytes: request.proof_bytes,
      commitment: request.commitment,
    };

    if (wallet?.signMessage) {
      const sigAuth = await generateTransferSignature(wallet, 'external_transfer');
      requestData.sender_signature = sigAuth.sender_signature;
    } else if (request.sender_signature) {
      requestData.sender_signature = request.sender_signature;
    }
    
    return makeHttpRequest<ZKTransferResponse>(
      `${this.apiBaseUrl}/zk/external-transfer`,
      'POST',
      this.apiKey,
      requestData,
      this.debug
    );
  }

  async internalTransfer(request: InternalTransferRequest, wallet?: WalletAdapter): Promise<ZKTransferResponse> {
    validateSolanaAddress(request.sender_wallet);
    validateSolanaAddress(request.recipient_wallet);
    
    if (request.sender_wallet === request.recipient_wallet) {
      throw new TransferError('Cannot transfer to yourself');
    }

    let requestData: any = {
      sender_wallet: request.sender_wallet,
      recipient_wallet: request.recipient_wallet,
      token: request.token,
      nonce: request.nonce,
      amount: request.amount,
      proof_bytes: request.proof_bytes,
      commitment: request.commitment,
    };

    if (wallet?.signMessage) {
      const sigAuth = await generateTransferSignature(wallet, 'internal_transfer');
      requestData.sender_signature = sigAuth.sender_signature;
    } else if (request.sender_signature) {
      requestData.sender_signature = request.sender_signature;
    }
    
    try {
      return await makeHttpRequest<ZKTransferResponse>(
        `${this.apiBaseUrl}/zk/internal-transfer`,
        'POST',
        this.apiKey,
        requestData,
        this.debug
      );
    } catch (error: any) {
      if (error.message?.includes('not found') || error.message?.includes('Recipient')) {
        throw new RecipientNotFoundError(request.recipient_wallet);
      }
      throw error;
    }
  }

  async transfer(request: TransferRequest): Promise<TransferResponse> {
    validateSolanaAddress(request.sender);
    validateSolanaAddress(request.recipient);
    
    if (request.sender === request.recipient) {
      throw new TransferError('Cannot transfer to yourself');
    }
    
    if (request.amount <= 0) {
      throw new InvalidAmountError('Transfer amount must be greater than zero');
    }
    
    const amountSmallestUnit = TokenUtils.toSmallestUnit(request.amount, request.token);
    const nonce = generateNonce();
    const tokenMint = TokenUtils.getTokenMint(request.token);
    const token = tokenMint === 'Native' ? 'SOL' : tokenMint;
    
    await initWASM();
    const proof = await generateRangeProof(amountSmallestUnit, 64);
    
    if (request.type === 'internal') {
      const result = await this.internalTransfer({
        sender_wallet: request.sender,
        recipient_wallet: request.recipient,
        token: token,
        nonce: nonce,
        amount: amountSmallestUnit,
        proof_bytes: proof.proofBytes,
        commitment: proof.commitmentBytes,
      }, request.wallet);
      
      return {
        success: result.success,
        tx_signature: result.tx_signature || '',
        amount_sent: result.amount_sent || null,
        amount_hidden: result.amount_hidden,
      };
    } else {
      const result = await this.externalTransfer({
        sender_wallet: request.sender,
        recipient_wallet: request.recipient,
        token: token,
        nonce: nonce,
        amount: amountSmallestUnit,
        proof_bytes: proof.proofBytes,
        commitment: proof.commitmentBytes,
      }, request.wallet);
      
      return {
        success: result.success,
        tx_signature: result.tx_signature || '',
        amount_sent: result.amount_sent || null,
        amount_hidden: result.amount_hidden,
      };
    }
  }

  async transferWithClientProofs(request: TransferWithClientProofsRequest): Promise<TransferResponse> {
    validateSolanaAddress(request.sender);
    validateSolanaAddress(request.recipient);
    
    if (request.sender === request.recipient) {
      throw new TransferError('Cannot transfer to yourself');
    }
    
    if (request.amount <= 0) {
      throw new InvalidAmountError('Transfer amount must be greater than zero');
    }
    
    if (!isWASMSupported()) {
      throw new TransferError('WebAssembly not supported.');
    }
    
    const amountSmallestUnit = TokenUtils.toSmallestUnit(request.amount, request.token);
    
    let proof: ZKProofData;
    if (request.customProof) {
      proof = request.customProof;
    } else {
      await initWASM();
      proof = await generateRangeProof(amountSmallestUnit, 64);
    }
    
    const nonce = generateNonce();
    const tokenMint = TokenUtils.getTokenMint(request.token);
    const token = tokenMint === 'Native' ? 'SOL' : tokenMint;
    
    if (request.type === 'internal') {
      const result = await this.internalTransfer({
        sender_wallet: request.sender,
        recipient_wallet: request.recipient,
        token: token,
        nonce: nonce,
        amount: amountSmallestUnit,
        proof_bytes: proof.proofBytes,
        commitment: proof.commitmentBytes,
      }, request.wallet);
      
      return {
        success: result.success,
        tx_signature: result.tx_signature || '',
        amount_sent: result.amount_sent || null,
        amount_hidden: result.amount_hidden,
      };
    } else {
      const result = await this.externalTransfer({
        sender_wallet: request.sender,
        recipient_wallet: request.recipient,
        token: token,
        nonce: nonce,
        amount: amountSmallestUnit,
        proof_bytes: proof.proofBytes,
        commitment: proof.commitmentBytes,
      }, request.wallet);
      
      return {
        success: result.success,
        tx_signature: result.tx_signature || '',
        amount_sent: result.amount_sent || null,
        amount_hidden: result.amount_hidden,
      };
    }
  }

  async generateProofLocally(amount: number, token: TokenSymbol): Promise<ZKProofData> {
    const amountSmallestUnit = TokenUtils.toSmallestUnit(amount, token);
    
    await initWASM();
    return generateRangeProof(amountSmallestUnit, 64);
  }

  getFeePercentage(token: TokenSymbol): number {
    return TOKEN_FEES[token] || TOKEN_FEES.DEFAULT;
  }

  getMinimumAmount(token: TokenSymbol): number {
    const minSmallest = TOKEN_MINIMUMS[token] || TOKEN_MINIMUMS.DEFAULT;
    return TokenUtils.fromSmallestUnit(minSmallest, token);
  }

  calculateFee(amount: number, token: TokenSymbol): { fee: number; feePercentage: number; netAmount: number } {
    const feePercentage = this.getFeePercentage(token);
    const fee = amount * feePercentage;
    return {
      fee,
      feePercentage,
      netAmount: amount - fee,
    };
  }

}

