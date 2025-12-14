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
  ExternalTransferResponse,
  InternalTransferRequest,
  InternalTransferResponse,
  TransferRequest,
  TransferResponse,
  TransferWithClientProofsRequest,
  TokenSymbol,
  ZKProofData,
  AuthorizeSpendingRequest,
  AuthorizeSpendingResponse,
  RevokeAuthorizationRequest,
  RevokeAuthorizationResponse,
  Authorization,
  WalletAdapter,
} from './types';
import { DEFAULT_API_BASE_URL, DEFAULT_NETWORK } from './constants';
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

  async uploadProof(request: UploadProofRequest, wallet?: WalletAdapter): Promise<UploadProofResponse> {
    validateSolanaAddress(request.sender_wallet);
    
    if (request.amount <= 0) {
      throw new InvalidAmountError('Amount must be greater than zero');
    }

    let requestData = { ...request };

    // Generate signature if wallet provided
    if (wallet?.signMessage) {
      const sigAuth = await generateTransferSignature(wallet, 'zk_transfer');
      requestData = {
        ...requestData,
        ...sigAuth,
      };
    }
    
    return makeHttpRequest<UploadProofResponse>(
      `${this.apiBaseUrl}/zk/upload-proof`,
      'POST',
      this.apiKey,
      requestData,
      this.debug
    );
  }

  async externalTransfer(request: ExternalTransferRequest, wallet?: WalletAdapter): Promise<ExternalTransferResponse> {
    validateSolanaAddress(request.sender_wallet);
    validateSolanaAddress(request.recipient_wallet);
    
    if (request.sender_wallet === request.recipient_wallet) {
      throw new TransferError('Cannot transfer to yourself');
    }

    let requestData = { ...request };

    // Generate signature if wallet provided
    if (wallet?.signMessage) {
      const sigAuth = await generateTransferSignature(wallet, 'external_transfer');
      requestData = {
        ...requestData,
        ...sigAuth,
      };
    }
    
    return makeHttpRequest<ExternalTransferResponse>(
      `${this.apiBaseUrl}/zk/external-transfer`,
      'POST',
      this.apiKey,
      requestData,
      this.debug
    );
  }

  async internalTransfer(request: InternalTransferRequest, wallet?: WalletAdapter): Promise<InternalTransferResponse> {
    validateSolanaAddress(request.sender_wallet);
    validateSolanaAddress(request.recipient_wallet);
    
    if (request.sender_wallet === request.recipient_wallet) {
      throw new TransferError('Cannot transfer to yourself');
    }

    let requestData = { ...request };

    // Generate signature if wallet provided
    if (wallet?.signMessage) {
      const sigAuth = await generateTransferSignature(wallet, 'internal_transfer');
      requestData = {
        ...requestData,
        ...sigAuth,
      };
    }
    
    try {
      return await makeHttpRequest<InternalTransferResponse>(
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
    
    const proofResult = await this.uploadProof({
      sender_wallet: request.sender,
      token: token,
      amount: amountSmallestUnit,
      nonce: nonce,
    });
    
    const relayerFee = Math.floor(amountSmallestUnit * 0.01);
    
    if (request.type === 'internal') {
      const internalResult = await this.internalTransfer({
        sender_wallet: request.sender,
        recipient_wallet: request.recipient,
        token: token,
        nonce: proofResult.nonce,
        relayer_fee: relayerFee,
      });
      
      return {
        success: internalResult.success,
        tx_signature: internalResult.tx_signature,
        amount_sent: null,
        amount_hidden: true,
        proof_pda: internalResult.proof_pda,
      };
    } else {
      const externalResult = await this.externalTransfer({
        sender_wallet: request.sender,
        recipient_wallet: request.recipient,
        token: token,
        nonce: proofResult.nonce,
        relayer_fee: relayerFee,
      });
      
      return {
        success: externalResult.success,
        tx_signature: externalResult.tx_signature,
        amount_sent: externalResult.amount_sent,
        amount_hidden: false,
        proof_pda: externalResult.proof_pda,
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
      throw new TransferError('WebAssembly not supported. Use transfer() method for backend proof generation.');
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
    
    const proofResult = await this.uploadProof({
      sender_wallet: request.sender,
      token: token,
      amount: amountSmallestUnit,
      nonce: nonce,
    }, request.wallet);
    
    const relayerFee = Math.floor(amountSmallestUnit * 0.01);
    
    if (request.type === 'internal') {
      const internalResult = await this.internalTransfer({
        sender_wallet: request.sender,
        recipient_wallet: request.recipient,
        token: token,
        nonce: proofResult.nonce,
        relayer_fee: relayerFee,
      }, request.wallet);
      
      return {
        success: internalResult.success,
        tx_signature: internalResult.tx_signature,
        amount_sent: null,
        amount_hidden: true,
        proof_pda: internalResult.proof_pda,
      };
    } else {
      const externalResult = await this.externalTransfer({
        sender_wallet: request.sender,
        recipient_wallet: request.recipient,
        token: token,
        nonce: proofResult.nonce,
        relayer_fee: relayerFee,
      }, request.wallet);
      
      return {
        success: externalResult.success,
        tx_signature: externalResult.tx_signature,
        amount_sent: externalResult.amount_sent,
        amount_hidden: false,
        proof_pda: externalResult.proof_pda,
      };
    }
  }

  async generateProofLocally(amount: number, token: TokenSymbol): Promise<ZKProofData> {
    const amountSmallestUnit = TokenUtils.toSmallestUnit(amount, token);
    
    await initWASM();
    return generateRangeProof(amountSmallestUnit, 64);
  }

  async authorizeSpending(request: AuthorizeSpendingRequest): Promise<AuthorizeSpendingResponse> {
    validateSolanaAddress(request.wallet);
    validateSolanaAddress(request.spender);
    
    if (request.amount <= 0) {
      throw new InvalidAmountError('Authorization amount must be greater than zero');
    }
    
    return makeHttpRequest<AuthorizeSpendingResponse>(
      `${this.apiBaseUrl}/authorize-spending`,
      'POST',
      this.apiKey,
      request,
      this.debug
    );
  }

  async revokeAuthorization(request: RevokeAuthorizationRequest): Promise<RevokeAuthorizationResponse> {
    validateSolanaAddress(request.wallet);
    
    return makeHttpRequest<RevokeAuthorizationResponse>(
      `${this.apiBaseUrl}/revoke-authorization`,
      'POST',
      this.apiKey,
      request,
      this.debug
    );
  }

  async getMyAuthorizations(wallet: string): Promise<Authorization[]> {
    validateSolanaAddress(wallet);
    
    return makeHttpRequest<Authorization[]>(
      `${this.apiBaseUrl}/my-authorizations/${wallet}`,
      'GET',
      this.apiKey,
      undefined,
      this.debug
    );
  }
}

