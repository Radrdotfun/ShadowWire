import bs58 from 'bs58';
import { SignatureAuth, SignatureTransferType, WalletAdapter } from './types';

/**
 * Generates a wallet signature for transfer authentication
 * 
 * @param wallet - Wallet adapter with signMessage function
 * @param transferType - Type of transfer (zk_transfer, external_transfer, internal_transfer)
 * @returns Signature authentication object with signature and message
 * @throws Error if wallet doesn't support message signing
 */
export async function generateTransferSignature(
  wallet: WalletAdapter,
  transferType: SignatureTransferType = 'zk_transfer'
): Promise<SignatureAuth> {
  if (!wallet?.signMessage) {
    throw new Error('Wallet does not support message signing');
  }

  // Generate nonce and timestamp
  const nonce = generateRandomNonce();
  const timestamp = Math.floor(Date.now() / 1000); // Unix seconds

  // Build message: shadowpay:{transferType}:{nonce}:{timestamp}
  const message = `shadowpay:${transferType}:${nonce}:${timestamp}`;

  // Sign message
  const encodedMessage = new TextEncoder().encode(message);
  const signatureBytes = await wallet.signMessage(encodedMessage);
  const signature = bs58.encode(signatureBytes);

  return {
    sender_signature: signature,
    signature_message: message,
  };
}

/**
 * Generates a random nonce for signature authentication
 * Uses crypto.randomUUID() if available, otherwise generates a random string
 */
function generateRandomNonce(): string {
  // Check if crypto.randomUUID is available (browser or Node 16+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older Node.js versions
  if (typeof require !== 'undefined') {
    try {
      const nodeCrypto = require('crypto');
      return nodeCrypto.randomUUID();
    } catch {
      // If crypto module not available, generate random string
    }
  }

  // Fallback: generate random string
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Determines the transfer type for signature authentication based on transfer parameters
 */
export function determineSignatureTransferType(isInternal: boolean): SignatureTransferType {
  return isInternal ? 'internal_transfer' : 'external_transfer';
}

/**
 * Validates that a signature auth object has the required fields
 */
export function isValidSignatureAuth(auth: any): auth is SignatureAuth {
  return (
    auth &&
    typeof auth === 'object' &&
    typeof auth.sender_signature === 'string' &&
    typeof auth.signature_message === 'string' &&
    auth.sender_signature.length > 0 &&
    auth.signature_message.length > 0
  );
}

