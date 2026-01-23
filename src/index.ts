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
