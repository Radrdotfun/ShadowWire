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
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Check for globalThis.crypto (works in both Node 19+ and browsers)
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  // Fallback: generate random string using available randomness
  const randomPart = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    : Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  
  // Format as UUID-like string
  return `${randomPart.slice(0, 8)}-${randomPart.slice(8, 12)}-${randomPart.slice(12, 16)}-${randomPart.slice(16, 20)}-${randomPart.slice(20, 32)}`;
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

