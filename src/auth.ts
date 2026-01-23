import bs58 from 'bs58';
import { SignatureAuth, SignatureTransferType, WalletAdapter } from './types';

export async function generateTransferSignature(
  wallet: WalletAdapter,
  transferType: SignatureTransferType = 'zk_transfer'
): Promise<SignatureAuth> {
  if (!wallet?.signMessage) {
    throw new Error('Wallet does not support message signing');
  }

  const nonce = generateRandomNonce();
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `shadowpay:${transferType}:${nonce}:${timestamp}`;

  const encodedMessage = new TextEncoder().encode(message);
  const signatureBytes = await wallet.signMessage(encodedMessage);
  const signature = bs58.encode(signatureBytes);

  return {
    sender_signature: signature,
    signature_message: message,
  };
}

function generateRandomNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const randomPart = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    : Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  
  return `${randomPart.slice(0, 8)}-${randomPart.slice(8, 12)}-${randomPart.slice(12, 16)}-${randomPart.slice(16, 20)}-${randomPart.slice(20, 32)}`;
}

export function determineSignatureTransferType(isInternal: boolean): SignatureTransferType {
  return isInternal ? 'internal_transfer' : 'external_transfer';
}

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

