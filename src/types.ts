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
}

export interface WithdrawResponse {
  success: boolean;
  unsigned_tx_base64: string;
  amount_withdrawn: number;
  fee: number;
}

export interface UploadProofRequest {
  sender_wallet: string;
  token: string;
  amount: number;
  nonce: number;
  sender_signature?: string;
  signature_message?: string;
}

export interface UploadProofResponse {
  success: boolean;
  proof_pda: string;
  nonce: number;
}

export interface ExternalTransferRequest {
  sender_wallet: string;
  recipient_wallet: string;
  token: string;
  nonce: number;
  relayer_fee: number;
  sender_signature?: string;
  signature_message?: string;
}

export interface ExternalTransferResponse {
  success: boolean;
  tx_signature: string;
  amount_sent: number;
  proof_pda: string;
}

export interface InternalTransferRequest {
  sender_wallet: string;
  recipient_wallet: string;
  token: string;
  nonce: number;
  relayer_fee: number;
  sender_signature?: string;
  signature_message?: string;
}

export interface InternalTransferResponse {
  success: boolean;
  tx_signature: string;
  proof_pda: string;
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
  proof_pda: string;
}

export interface ZKProofData {
  proofBytes: string;
  commitmentBytes: string;
  blindingFactorBytes: string;
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

export interface AuthorizeSpendingRequest {
  wallet: string;
  spender: string;
  amount: number;
  token_mint?: string;
}

export interface AuthorizeSpendingResponse {
  success: boolean;
  authorization_id: string;
}

export interface RevokeAuthorizationRequest {
  wallet: string;
  authorization_id: string;
}

export interface RevokeAuthorizationResponse {
  success: boolean;
}

export interface Authorization {
  id: string;
  wallet: string;
  spender: string;
  amount: number;
  token_mint: string;
  created_at: string;
}

