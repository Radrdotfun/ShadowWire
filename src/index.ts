export { ShadowWireClient } from './client';

export { TokenUtils } from './tokens';

export {
  initWASM,
  generateRangeProof,
  verifyRangeProof,
  isWASMSupported,
  BULLETPROOF_INFO,
} from './zkProofs';

export {
  generateTransferSignature,
  determineSignatureTransferType,
} from './auth';

export {
  ShadowWireError,
  InsufficientBalanceError,
  InvalidAddressError,
  InvalidAmountError,
  RecipientNotFoundError,
  ProofUploadError,
  TransferError,
  NetworkError,
  WASMNotSupportedError,
  ProofGenerationError,
} from './errors';

export {
  SUPPORTED_TOKENS,
} from './types';

export type {
  TokenSymbol,
  SolanaNetwork,
  TransferType,
  SignatureTransferType,
  ShadowWireClientConfig,
  WalletAdapter,
  SignatureAuth,
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
  ZKProofData,
  TransferWithClientProofsRequest,
  BulletproofVerificationData,
  VerificationUploadResponse,
  VerifiedTransferResponse,
  VerificationStatus,
} from './types';

export { TOKEN_FEES, TOKEN_MINIMUMS, TOKEN_MINTS, TOKEN_DECIMALS } from './constants';

export {
  X402Client,
  x402Paywall,
  createPaymentRequired,
  verifyPayment,
  settlePayment,
  createDiscoveryDocument,
} from './x402';
export type {
  X402PaymentRequirement,
  X402Response,
  X402PaymentResult,
  X402RequestResult,
  X402ClientConfig,
  X402VerifyResult,
  X402MiddlewareConfig,
  X402PaymentProof,
  X402DiscoveryResource,
} from './x402';
