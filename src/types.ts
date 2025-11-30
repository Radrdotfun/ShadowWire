export type TokenSymbol = 'SOL' | 'USDC' | 'ORE' | 'BONK' | 'JIM' | 'GODL' | 'HUSTLE';

export type SolanaNetwork = 'mainnet-beta';

export type TransferType = 'internal' | 'external';

export interface ShadowWireClientConfig {
  apiKey?: string;
  apiBaseUrl?: string;
  network?: SolanaNetwork;
  debug?: boolean;
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

