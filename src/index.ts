export { ShadowWireClient } from './client';

export { TokenUtils } from './tokens';

export {
  initWASM,
  generateRangeProof,
  verifyRangeProof,
  isWASMSupported,
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
  ExternalTransferResponse,
  InternalTransferRequest,
  InternalTransferResponse,
  TransferRequest,
  TransferResponse,
  ZKProofData,
  TransferWithClientProofsRequest,
  AuthorizeSpendingRequest,
  AuthorizeSpendingResponse,
  RevokeAuthorizationRequest,
  RevokeAuthorizationResponse,
  Authorization,
} from './types';

