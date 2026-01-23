export const SUPPORTED_TOKENS = [
  'SOL',
  'RADR',
  'USDC',
  'ORE',
  'BONK',
  'JIM',
  'GODL',
  'HUSTLE',
  'ZEC',
  'CRT',
  'BLACKCOIN',
  'GIL',
  'ANON',
  'WLFI',
  'USD1',
  'AOL',
  'IQLABS',
  'SANA',
  'POKI',
  'RAIN',
  'HOSICO',
  'SKR',
] as const;

export type TokenSymbol = typeof SUPPORTED_TOKENS[number];

export type SolanaNetwork = 'mainnet-beta';

export type TransferType = 'internal' | 'external';

export type SignatureTransferType = 'zk_transfer' | 'external_transfer' | 'internal_transfer';

export interface ShadowWireClientConfig {
  apiKey?: string;
  apiBaseUrl?: string;
  network?: SolanaNetwork;
  debug?: boolean;
}

export interface WalletAdapter {
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export interface SignatureAuth {
  sender_signature: string;
  signature_message: string;
}

export interface PoolBalance {
  wallet: string;
  available: number;
  deposited: number;
  withdrawn_to_escrow: number;
  migrated: boolean;
  pool_address: string;
}

export interface DepositRequest {
  wallet: string;
  amount: number;
  token_mint?: string;
}

export interface DepositResponse {
  success: boolean;
  unsigned_tx_base64: string;
  pool_address: string;
  user_balance_pda: string;
  amount: number;
}

export interface WithdrawRequest {
  wallet: string;
  amount: number;
  token_mint?: string;
  signed_tx?: string;
}

export interface WithdrawResponse {
  success: boolean;
  amount_withdrawn: number;
  fee: number;
  tx_signature?: string;
  error?: string;
  unsigned_tx_base64?: string;
}

export interface UploadProofRequest {
  sender_wallet: string;
  token?: string;
  amount: number;
  nonce: number;
}

export interface UploadProofResponse {
  success: boolean;
  tx_signature?: string;
  proof_pda: string;
  nonce: number;
  error?: string;
}

export interface ExternalTransferRequest {
  sender_wallet: string;
  recipient_wallet: string;
  token?: string;
  nonce: number;
  amount: number;
  proof_bytes: string;
  commitment: string;
  sender_signature?: string;
}

export interface InternalTransferRequest {
  sender_wallet: string;
  recipient_wallet: string;
  token?: string;
  nonce: number;
  amount: number;
  proof_bytes: string;
  commitment: string;
  sender_signature?: string;
}

export interface ZKTransferResponse {
  success: boolean;
  tx_signature?: string;
  transfer_id: string;
  amount_hidden: boolean;
  amount_sent?: number;
  recipient: string;
  timestamp: number;
  error?: string;
}

export interface TransferRequest {
  sender: string;
  recipient: string;
  amount: number;
  token: TokenSymbol;
  type: TransferType;
  wallet?: WalletAdapter;
}

export interface TransferResponse {
  success: boolean;
  tx_signature: string;
  amount_sent: number | null;
  amount_hidden: boolean;
}

export interface ZKProofData {
  proofBytes: string;
  commitmentBytes: string;
  blindingFactorBytes: string;
}

export interface BulletproofVerificationData {
  proof: string;
  commitment: string;
  amount: number;
  nonce: number;
  sender: string;
  recipient: string;
}

export interface VerificationUploadResponse {
  success: boolean;
  verified_proof_pda: string;
  tx1_signature: string;
  verification_stage: number;
}

export interface VerifiedTransferResponse {
  success: boolean;
  tx2_signature: string;
  amount_transferred: number;
  relayer_fee: number;
}

export interface VerificationStatus {
  proof_pda: string;
  stage: number;
  is_valid: boolean;
}

export interface TransferWithClientProofsRequest {
  sender: string;
  recipient: string;
  amount: number;
  token: TokenSymbol;
  type: TransferType;
  customProof?: ZKProofData;
  wallet?: WalletAdapter;
}


