# Changelog

All notable changes to the ShadowWire SDK will be documented in this file.

## [1.1.14] - 2026-01-24

### New Tokens

Added support for 5 additional tokens:

| Token | Decimals | Mint Address |
|-------|----------|--------------|
| SANA | 6 | `5dpN5wMH8j8au29Rp91qn4WfNq6t6xJfcjQNcFeDJ8Ct` |
| POKI | 9 | `6vK6cL9C66Bsqw7SC2hcCdkgm1UKBDUE6DCYJ4kubonk` |
| RAIN | 6 | `3iC63FgnB7EhcPaiSaC51UkVweeBDkqu17SaRyy2pump` |
| HOSICO | 9 | `Dx2bQe2UPv4k3BmcW8G2KhaL5oKsxduM5XxLSV3Sbonk` |
| SKR | 6 | `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3` |

**Total tokens now supported: 22**

### New Features

- Added `TOKEN_FEES` constant with per-token fee percentages
- Added `TOKEN_MINIMUMS` constant with minimum transaction amounts
- Added `getFeePercentage()` method to client
- Added `getMinimumAmount()` method to client
- Added `calculateFee()` method for fee breakdown

### Fee Structure

| Token | Fee |
|-------|-----|
| SOL | 0.5% |
| RADR | 0.3% |
| HUSTLE | 0.3% |
| ORE | 0.3% |
| IQLABS | 0.5% |
| SKR | 0.5% |
| RAIN | 2% |
| Default | 1% |

### Technical Changes

- Refactored `zkProofs.ts` and `auth.ts` for dual-environment support (browser + Node.js)
- Uses bundler-safe dynamic `require` pattern for Node.js modules
- Browser: uses `fetch()` for WASM loading
- Node.js: uses `fs` and `path` via dynamic require
- Updated transfer response types to match backend

### Breaking Changes

**Response type changes:**
- `InternalTransferResponse` renamed to `ZKTransferResponse`
- `ExternalTransferResponse` renamed to `ZKTransferResponse`
- Response now includes: `tx_signature`, `amount_sent`, `amount_hidden`, `transfer_id`, `recipient`, `timestamp`, `error`

**Transfer request changes:**
- `InternalTransferRequest` and `ExternalTransferRequest` now expect `amount`, `proof_bytes`, `commitment` fields
- Removed `relayer_fee`, `signature_message` fields

### Migration Guide

If upgrading from v1.1.3 or earlier:

```typescript
const result = await client.internalTransfer(request);
console.log(result.tx1_signature);
console.log(result.tx2_signature);
  
const result = await client.transfer({ ...params, type: 'internal' });
console.log(result.tx_signature);
console.log(result.amount_sent);
```

## [1.1.3] - 2025-01-22

### Bug Fixes

**Fixed bundler compatibility issues (rspack, webpack, vite, etc.)**

- Fixed `Module not found: Can't resolve 'crypto'` error in auth.js
- Fixed `Module not found: Can't resolve 'fs'` error in zkProofs.js
- Fixed `Module not found: Can't resolve 'path'` error in zkProofs.js
- Fixed `__dirname` warning in zkProofs.js

### Technical Changes

- Removed Node.js `require('crypto')` from auth.ts - now uses browser-native `crypto.randomUUID()` and `crypto.getRandomValues()`
- Used `new Function()` pattern to hide Node.js requires from bundlers in zkProofs.ts
- Added `typeof window === 'undefined'` check to improve Node.js detection
- Better fallback for UUID generation using Web Crypto API

### Notes

This fix ensures the SDK works properly with all major bundlers:
- rspack
- webpack
- vite
- rollup
- esbuild

No API changes - this is a pure bug fix release.

---

## [1.1.2] - 2025-12-14

### New Tokens

Added support for 4 additional tokens:

| Token | Decimals | Mint Address |
|-------|----------|--------------|
| WLFI | 6 | `WLFinEv6ypjkczcS83FZqFpgFZYwQXutRbxGe7oC16g` |
| USD1 | 6 | `USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB` |
| AOL | 6 | `2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk` |
| IQLABS | 9 | `3uXACfojUrya7VH51jVC1DCHq3uzK4A7g469Q954LABS` |

**Total tokens now supported: 17** (was 13)

### Updates

- Updated token support table in README
- Total supported tokens: 17

### Breaking Changes

None - this release is fully backward compatible with v1.1.1.

---

## [1.1.1] - 2025-12-14

### Added - Wallet Signature Authentication (Mandatory)

- **Wallet signature authentication** - All transfer methods now require wallet signature authentication
- **New tokens** - Added support for 6 new tokens: RADR, ZEC, CRT, BLACKCOIN, GIL, ANON
- **Signature generation** - New `generateTransferSignature()` utility function
- **Enhanced security** - All transfers must be authenticated with wallet signatures

### New Tokens

- **RADR** (9 decimals) - Radr token
- **ZEC** (8 decimals) - Zcash
- **CRT** (9 decimals) - DefiCarrot
- **BLACKCOIN** (6 decimals) - Blackcoin
- **GIL** (6 decimals) - Kith Gil
- **ANON** (9 decimals) - ANON

### Technical Changes

- Added `bs58` dependency for signature encoding
- New `WalletAdapter` interface for wallet integration
- New `SignatureAuth` interface for signature authentication
- All transfer methods now accept optional `wallet` parameter
- Signature format: `shadowpay:{transferType}:{nonce}:{timestamp}`

### API Changes

#### New Exports
- `generateTransferSignature()` - Generate wallet signatures for transfers
- `determineSignatureTransferType()` - Helper to determine transfer type
- `SUPPORTED_TOKENS` - Array of all supported token symbols
- `WalletAdapter` type - Wallet interface for signing
- `SignatureAuth` type - Signature authentication object
- `SignatureTransferType` type - Transfer type for signatures

#### Updated Methods
All transfer methods now require wallet signature authentication:
- `uploadProof(request, wallet?)` - Wallet parameter (backend validates if provided)
- `externalTransfer(request, wallet?)` - Wallet parameter (backend validates if provided)
- `internalTransfer(request, wallet?)` - Wallet parameter (backend validates if provided)
- `transfer(request)` - Wallet required in request object
- `transferWithClientProofs(request)` - Wallet required in request object

### Usage Example

```typescript
import { ShadowWireClient, WalletAdapter } from '@radr/shadowwire';
import { useWallet } from '@solana/wallet-adapter-react';

const { signMessage, publicKey } = useWallet();

const client = new ShadowWireClient();

await client.transfer({
  sender: publicKey!.toBase58(),
  recipient: 'RECIPIENT_ADDRESS',
  amount: 1.0,
  token: 'SOL',
  type: 'internal',
  wallet: { signMessage: signMessage! }
});
```

### Security Notes

- Wallet signatures are mandatory - all transfers require authentication
- Signatures provide critical security by proving wallet ownership
- Signatures use the format: `shadowpay:{transferType}:{nonce}:{timestamp}`
- Backend validates signatures match the sender wallet address
- Nonce ensures each signature is unique (replay protection)

### Bug Fixes

None in this release.

### Breaking Changes

Wallet signature authentication is now mandatory for all transfers. You must provide a wallet with `signMessage` capability when making transfers.

**Migration Required:** Update all transfer calls to include the wallet parameter.

---

## [1.1.0] - 2025-12-13

### Added - Browser Support

- **Full browser environment support** - The SDK now works in web browsers, not just Node.js
- **Dynamic module loading** - `fs` and `path` modules are now dynamically imported only in Node.js environments
- **Environment detection** - Automatic detection of Node.js vs browser environments
- **Flexible WASM initialization** - Support for custom WASM file URLs in browsers
- **Multiple WASM paths** - Automatic fallback to multiple common WASM file locations

### Documentation

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

### Technical Changes

- **Breaking change fix**: Removed static `import` statements for Node.js-only modules (`fs`, `path`)
- **New API**: `initWASM()` now accepts optional `wasmUrl` parameter for browser environments
- **Enhanced error messages**: Better error messages when WASM file cannot be loaded in browsers
- **Additional WASM paths**: Added `node_modules/@radr/shadowwire/dist/wasm/settler_wasm_bg.wasm` to default paths

### Bug Fixes

- **Fixed**: "Module not found: Can't resolve 'fs'" error when bundling for browsers
- **Fixed**: WASM initialization now works correctly in both Node.js and browser environments

### Package Updates

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

## Migration Guide: 1.0.1 to 1.1.0

### For Node.js Users

No changes required. The API is fully backward compatible.

```typescript
import { initWASM, generateRangeProof } from '@radr/shadowwire';

await initWASM();
const proof = await generateRangeProof(1000000, 64);
```

### For Browser Users

You can now use ShadowWire in the browser:

1. **Install the package**:
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
   
   await initWASM('/wasm/settler_wasm_bg.wasm');
   
   const proof = await generateRangeProof(1000000, 64);
   ```

See the [Browser Setup Guide](./BROWSER_SETUP.md) for complete instructions.

### Breaking Changes

None. This release is fully backward compatible with 1.0.1.

### Deprecations

None.

---

## Future Plans

- Web Worker support for background proof generation
- Streaming proof generation for large amounts
- React hooks package (`@radr/shadowwire-react`)
- Proof caching and optimization
- Additional token support
- Hardware wallet integration examples

---

## Support

- Email: hello@radrlabs.io
- Twitter: https://x.com/radrdotfun
- Telegram: https://t.me/radrportal
- Issues: https://github.com/Radrdotfun/ShadowWire/issues