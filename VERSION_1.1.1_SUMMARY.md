# ShadowWire v1.1.1 - Release Summary

## 🎯 Version Update

**Previous Version**: 1.1.0  
**New Version**: 1.1.1  
**Release Date**: December 14, 2025

---

## ✨ What's New

### 1. 🔐 Wallet Signature Authentication

Added **optional wallet signature authentication** to all transfer methods for enhanced security.

**How it works:**
- Generates a signature message: `shadowpay:{transferType}:{nonce}:{timestamp}`
- Signs with wallet's `signMessage` function
- Includes signature with transfer request
- Backend validates signature matches sender wallet

**Usage:**
```typescript
import { ShadowWireClient } from '@radr/shadowwire';
import { useWallet } from '@solana/wallet-adapter-react';

const { signMessage, publicKey } = useWallet();
const client = new ShadowWireClient();

// Transfer with signature authentication
await client.transfer({
  sender: publicKey!.toBase58(),
  recipient: 'RECIPIENT_ADDRESS',
  amount: 1.0,
  token: 'SOL',
  type: 'internal',
  wallet: { signMessage: signMessage! } // Optional authentication
});
```

### 2. 📦 New Tokens Added

Added support for 6 additional tokens:

| Token | Decimals | Mint Address |
|-------|----------|--------------|
| RADR  | 9 | `CzFvsLdUazabdiu9TYXujj4EY495fG7VgJJ3vQs6bonk` |
| ZEC   | 8 | `A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS` |
| CRT   | 9 | `CRTx1JouZhzSU6XytsE42UQraoGqiHgxabocVfARTy2s` |
| BLACKCOIN | 6 | `J3rYdme789g1zAysfbH9oP4zjagvfVM2PX7KJgFDpump` |
| GIL   | 6 | `CyUgNnKPQLqFcheyGV8wmypnJqojA7NzsdJjTS4nUT2j` |
| ANON  | 9 | `D25bi7oHQjqkVrzbfuM6k2gzVNHTSpBLhtakDCzCCDUB` |

**Total tokens now supported: 13**

---

## 🔧 Technical Changes

### New Files Created

- **`src/auth.ts`** - Signature authentication utilities
  - `generateTransferSignature()` - Generate wallet signatures
  - `determineSignatureTransferType()` - Helper function
  - `isValidSignatureAuth()` - Validation function

### Updated Files

1. **`package.json`**
   - Version: 1.1.0 → 1.1.1
   - Added dependency: `bs58@^5.0.0`
   - Added devDependency: `@types/bs58@^4.0.1`

2. **`src/constants.ts`**
   - Added 6 new token mint addresses
   - Added 6 new token decimals

3. **`src/types.ts`**
   - New `SUPPORTED_TOKENS` constant array
   - New `SignatureTransferType` type
   - New `WalletAdapter` interface
   - New `SignatureAuth` interface
   - Added optional signature fields to all transfer request interfaces
   - Added optional `wallet` parameter to transfer requests

4. **`src/client.ts`**
   - Updated all transfer methods to accept optional `wallet` parameter
   - Methods now generate signatures when wallet is provided:
     - `uploadProof(request, wallet?)`
     - `externalTransfer(request, wallet?)`
     - `internalTransfer(request, wallet?)`
     - `transfer(request)` - wallet in request object
     - `transferWithClientProofs(request)` - wallet in request object

5. **`src/index.ts`**
   - Exported `generateTransferSignature()`
   - Exported `determineSignatureTransferType()`
   - Exported `SUPPORTED_TOKENS`
   - Exported new types: `WalletAdapter`, `SignatureAuth`, `SignatureTransferType`

6. **`README.md`**
   - Updated token support table (7 → 13 tokens)
   - Added "Wallet Signature Authentication" section
   - Updated features list

7. **`CHANGELOG.md`**
   - Added v1.1.1 release notes
   - Documented all changes

---

## 📦 Package Details

**Package Name**: `@radr/shadowwire`  
**Version**: 1.1.1  
**Size**: 173.9 KB (compressed)  
**Unpacked Size**: 491.6 KB  
**Total Files**: 46  

### New Files in Package
- `dist/auth.js` - Signature authentication utilities
- `dist/auth.d.ts` - TypeScript definitions
- Updated all existing files

---

## 🔒 Security Features

### Signature Authentication Benefits

1. **Additional Security Layer** - Beyond ZK proofs
2. **Prevents Unauthorized Transfers** - Requires wallet ownership
3. **Replay Protection** - Unique nonce for each signature
4. **Timestamp Validation** - Prevents old signatures from being reused
5. **Optional** - Works with or without signatures

### Signature Format

```
shadowpay:{transferType}:{nonce}:{timestamp}
```

**Example:**
```
shadowpay:internal_transfer:550e8400-e29b-41d4-a716-446655440000:1702587600
```

**Fields:**
- `transferType`: `zk_transfer`, `external_transfer`, or `internal_transfer`
- `nonce`: UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- `timestamp`: Unix timestamp in seconds (e.g., `1702587600`)

---

## 🚀 API Changes

### New Exports

```typescript
// Functions
export { generateTransferSignature } from '@radr/shadowwire';
export { determineSignatureTransferType } from '@radr/shadowwire';

// Constants
export { SUPPORTED_TOKENS } from '@radr/shadowwire';

// Types
export type { WalletAdapter } from '@radr/shadowwire';
export type { SignatureAuth } from '@radr/shadowwire';
export type { SignatureTransferType } from '@radr/shadowwire';
```

### Updated Method Signatures

```typescript
// Before (v1.1.0)
async uploadProof(request: UploadProofRequest): Promise<UploadProofResponse>
async externalTransfer(request: ExternalTransferRequest): Promise<ExternalTransferResponse>
async internalTransfer(request: InternalTransferRequest): Promise<InternalTransferResponse>

// After (v1.1.1)
async uploadProof(request: UploadProofRequest, wallet?: WalletAdapter): Promise<UploadProofResponse>
async externalTransfer(request: ExternalTransferRequest, wallet?: WalletAdapter): Promise<ExternalTransferResponse>
async internalTransfer(request: InternalTransferRequest, wallet?: WalletAdapter): Promise<InternalTransferResponse>

// Transfer methods accept wallet in request object
interface TransferRequest {
  sender: string;
  recipient: string;
  amount: number;
  token: TokenSymbol;
  type: TransferType;
  wallet?: WalletAdapter; // NEW
}
```

---

## ✅ Testing Checklist

- [x] TypeScript compiles without errors
- [x] Package builds successfully
- [x] All dependencies installed
- [x] Package size verified (173.9 KB)
- [x] 46 files included in package
- [x] New auth.js file present
- [x] All types exported correctly
- [x] Documentation updated

---

## 📝 Migration Guide

### From v1.1.0 to v1.1.1

**No breaking changes!** This release is 100% backward compatible.

#### If you want to use the new features:

1. **Add wallet signature authentication:**
```typescript
// Before (still works)
await client.transfer({
  sender: 'SENDER',
  recipient: 'RECIPIENT',
  amount: 1.0,
  token: 'SOL',
  type: 'internal',
});

// After (with authentication)
await client.transfer({
  sender: 'SENDER',
  recipient: 'RECIPIENT',
  amount: 1.0,
  token: 'SOL',
  type: 'internal',
  wallet: { signMessage: wallet.signMessage! }, // Optional
});
```

2. **Use new tokens:**
```typescript
await client.transfer({
  sender: 'SENDER',
  recipient: 'RECIPIENT',
  amount: 100,
  token: 'RADR', // New token!
  type: 'internal',
});
```

---

## 🎊 Ready to Publish

The package is ready to publish to npm:

```bash
npm publish --access public
```

### Post-Publish Steps

1. **Git commit and tag:**
```bash
git add .
git commit -m "Release v1.1.1 - Add wallet signature authentication and new tokens"
git tag v1.1.1
git push origin main
git push origin v1.1.1
```

2. **Verify on npm:**
```bash
npm view @radr/shadowwire version
# Should show: 1.1.1
```

3. **Test installation:**
```bash
npm install @radr/shadowwire
```

---

## 📞 Support

- Email: hello@radrlabs.io
- Twitter: @radrdotfun
- Telegram: t.me/radrportal
- GitHub: github.com/Radrdotfun/ShadowWire

---

**All changes implemented and tested successfully!** ✅

