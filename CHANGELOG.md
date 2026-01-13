# Changelog

All notable changes to the ShadowWire SDK will be documented in this file.

## [1.1.2] - 2025-12-14

### 📦 New Tokens Added

Added support for 4 additional tokens:

| Token | Decimals | Mint Address |
|-------|----------|--------------|
| WLFI  | 6 | `WLFinEv6ypjkczcS83FZqFpgFZYwQXutRbxGe7oC16g` |
| USD1  | 6 | `USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB` |
| AOL   | 6 | `2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk` |
| IQLABS| 9 | `3uXACfojUrya7VH51jVC1DCHq3uzK4A7g469Q954LABS` |

**Total tokens now supported: 17** (was 13)

### 📝 Updates

- Updated token support table in README
- Total supported tokens: 17

### ⚠️ Breaking Changes

None - this release is fully backward compatible with v1.1.1.

---

## [1.1.1] - 2025-12-14

### 🔐 Added - Wallet Signature Authentication (MANDATORY)

- **Wallet signature authentication** - All transfer methods now **require** wallet signature authentication
- **New tokens** - Added support for 6 new tokens: RADR, ZEC, CRT, BLACKCOIN, GIL, ANON
- **Signature generation** - New `generateTransferSignature()` utility function
- **Enhanced security** - All transfers must be authenticated with wallet signatures

### 📦 New Tokens Added

- **RADR** (9 decimals) - Radr token
- **ZEC** (8 decimals) - Zcash
- **CRT** (9 decimals) - DefiCarrot
- **BLACKCOIN** (6 decimals) - Blackcoin
- **GIL** (6 decimals) - Kith Gil
- **ANON** (9 decimals) - ANON

### 🔧 Technical Changes

- Added `bs58` dependency for signature encoding
- New `WalletAdapter` interface for wallet integration
- New `SignatureAuth` interface for signature authentication
- All transfer methods now accept optional `wallet` parameter
- Signature format: `shadowpay:{transferType}:{nonce}:{timestamp}`

### 📚 API Changes

#### New Exports
- `generateTransferSignature()` - Generate wallet signatures for transfers
- `determineSignatureTransferType()` - Helper to determine transfer type
- `SUPPORTED_TOKENS` - Array of all supported token symbols
- `WalletAdapter` type - Wallet interface for signing
- `SignatureAuth` type - Signature authentication object
- `SignatureTransferType` type - Transfer type for signatures

#### Updated Methods
All transfer methods now **require** wallet signature authentication:
- `uploadProof(request, wallet?)` - Wallet parameter (backend validates if provided)
- `externalTransfer(request, wallet?)` - Wallet parameter (backend validates if provided)
- `internalTransfer(request, wallet?)` - Wallet parameter (backend validates if provided)
- `transfer(request)` - **Wallet required** in request object
- `transferWithClientProofs(request)` - **Wallet required** in request object

### 📝 Usage Example

```typescript
import { ShadowWireClient, WalletAdapter } from '@radr/shadowwire';
import { useWallet } from '@solana/wallet-adapter-react';

// In your component
const { signMessage, publicKey } = useWallet();

const client = new ShadowWireClient();

// Transfer with signature authentication
await client.transfer({
  sender: publicKey!.toBase58(),
  recipient: 'RECIPIENT_ADDRESS',
  amount: 1.0,
  token: 'SOL',
  type: 'internal',
  wallet: { signMessage: signMessage! } // REQUIRED wallet for authentication
});
```

### 🔒 Security Notes

- Wallet signatures are **mandatory** - all transfers require authentication
- Signatures provide critical security by proving wallet ownership
- Signatures use the format: `shadowpay:{transferType}:{nonce}:{timestamp}`
- Backend validates signatures match the sender wallet address
- Nonce ensures each signature is unique (replay protection)

### 🐛 Bug Fixes

None in this release.

### ⚠️ Breaking Changes

**IMPORTANT:** Wallet signature authentication is now **mandatory** for all transfers. You must provide a wallet with `signMessage` capability when making transfers.

**Migration Required:** Update all transfer calls to include the wallet parameter.

---

## [1.1.0] - 2025-12-13

### 🎉 Added - Browser Support

- **Full browser environment support** - The SDK now works in web browsers, not just Node.js
- **Dynamic module loading** - `fs` and `path` modules are now dynamically imported only in Node.js environments
- **Environment detection** - Automatic detection of Node.js vs browser environments
- **Flexible WASM initialization** - Support for custom WASM file URLs in browsers
- **Multiple WASM paths** - Automatic fallback to multiple common WASM file locations

### 📚 Documentation

- Added comprehensive [Browser Setup Guide](./BROWSER_SETUP.md) with:
  - Step-by-step setup for Webpack, Vite, Next.js, and Create React App
  - React, Vue, and vanilla JavaScript examples
  - Troubleshooting guide for common issues
  - Performance tips and best practices
  - Browser compatibility information
  
- Added new example files:
  - `examples/browser-usage.html` - Standalone HTML demo
  - `examples/browser-webpack-example.ts` - Bundler integration example
  - `examples/react-example.tsx` - Complete React component

- Updated main README with:
  - Browser support information
  - Links to browser setup guide
  - Updated examples showing both Node.js and browser usage

### 🔧 Technical Changes

- **Breaking change fix**: Removed static `import` statements for Node.js-only modules (`fs`, `path`)
- **New API**: `initWASM()` now accepts optional `wasmUrl` parameter for browser environments
- **Enhanced error messages**: Better error messages when WASM file cannot be loaded in browsers
- **Additional WASM paths**: Added `node_modules/@radr/shadowwire/dist/wasm/settler_wasm_bg.wasm` to default paths

### 🐛 Bug Fixes

- **Fixed**: "Module not found: Can't resolve 'fs'" error when bundling for browsers
- **Fixed**: WASM initialization now works correctly in both Node.js and browser environments

### 📦 Package Updates

- Version bumped from `1.0.1` to `1.1.0`
- No dependency changes

---

## [1.0.1] - Previous Release

Initial release with Node.js-only support.

### Features

- Private transfers on Solana using zero-knowledge proofs
- Multi-token support (SOL, USDC, ORE, BONK, JIM, GODL)
- Internal and external transfer types
- Client-side proof generation (Node.js only)
- TypeScript type definitions
- Comprehensive error handling

---

## Migration Guide: 1.0.1 → 1.1.0

### For Node.js Users

**No changes required!** The API is fully backward compatible.

```typescript
// This still works exactly the same
import { initWASM, generateRangeProof } from '@radr/shadowwire';

await initWASM();
const proof = await generateRangeProof(1000000, 64);
```

### For Browser Users (New!)

**You can now use ShadowWire in the browser:**

1. **Install the package** (same as before):
   ```bash
   npm install @radr/shadowwire
   ```

2. **Copy WASM file to your public directory**:
   ```bash
   cp node_modules/@radr/shadowwire/dist/wasm/settler_wasm_bg.wasm public/wasm/
   ```

3. **Initialize with WASM URL**:
   ```typescript
   import { initWASM, generateRangeProof } from '@radr/shadowwire';
   
   // Specify where the WASM file is served
   await initWASM('/wasm/settler_wasm_bg.wasm');
   
   // Now you can generate proofs in the browser!
   const proof = await generateRangeProof(1000000, 64);
   ```

See the [Browser Setup Guide](./BROWSER_SETUP.md) for complete instructions.

### Breaking Changes

None! This release is fully backward compatible with 1.0.1.

### Deprecations

None.

---

## Future Plans

- [ ] Web Worker support for background proof generation
- [ ] Streaming proof generation for large amounts
- [ ] React hooks package (`@radr/shadowwire-react`)
- [ ] Proof caching and optimization
- [ ] Additional token support
- [ ] Hardware wallet integration examples

---

## Support

- 📧 Email: hello@radrlabs.io
- 🐦 Twitter: [@radrdotfun](https://x.com/radrdotfun)
- 💬 Telegram: [t.me/radrportal](https://t.me/radrportal)
- 🐛 Issues: [GitHub Issues](https://github.com/Radrdotfun/ShadowWire/issues)

