# ShadowWire SDK

TypeScript SDK for private payments on Solana using Bulletproof zero-knowledge proofs.

## Overview

ShadowWire enables private transfers on Solana by hiding transaction amounts using Bulletproofs while maintaining on-chain verifiability. The protocol supports 22 tokens.

## Installation

```bash
npm install @radr/shadowwire
```

## Quick Start

```typescript
import { ShadowWireClient } from '@radr/shadowwire';

const client = new ShadowWireClient();

const balance = await client.getBalance('YOUR_WALLET');

await client.transfer({
  sender: 'YOUR_WALLET',
  recipient: 'RECIPIENT_WALLET',
  amount: 0.5,
  token: 'SOL',
  type: 'internal'
});
```

## Transfer Types

**Internal Transfer**: Amount is hidden using zero-knowledge proofs.

**External Transfer**: Amount is visible but sender remains anonymous. Works with any Solana wallet.

## API Reference

### Client Configuration

```typescript
const client = new ShadowWireClient({
  apiBaseUrl: 'https://custom-api.com',
  debug: true
});
```

### Balance

```typescript
const balance = await client.getBalance('WALLET_ADDRESS', 'SOL');
```

### Deposit

```typescript
const response = await client.deposit({
  wallet: 'YOUR_WALLET',
  amount: 100000000
});
```

### Withdraw

```typescript
const response = await client.withdraw({
  wallet: 'YOUR_WALLET',
  amount: 50000000
});
```

### Transfer

```typescript
const result = await client.transfer({
  sender: 'YOUR_WALLET',
  recipient: 'RECIPIENT_WALLET',
  amount: 0.1,
  token: 'SOL',
  type: 'internal',
  wallet: { signMessage }
});
```

### Fee Calculation

```typescript
const fee = client.getFeePercentage('SOL');
const minimum = client.getMinimumAmount('SOL');
const breakdown = client.calculateFee(1.0, 'SOL');
```

## Wallet Authentication

All transfers require wallet signature authentication:

```typescript
import { useWallet } from '@solana/wallet-adapter-react';

const { signMessage, publicKey } = useWallet();

await client.transfer({
  sender: publicKey.toBase58(),
  recipient: 'RECIPIENT_ADDRESS',
  amount: 1.0,
  token: 'SOL',
  type: 'internal',
  wallet: { signMessage }
});
```

## Client-Side Proof Generation

For maximum privacy, generate proofs in the browser:

```typescript
import { initWASM, generateRangeProof, isWASMSupported } from '@radr/shadowwire';

if (isWASMSupported()) {
  await initWASM('/wasm/settler_wasm_bg.wasm');
  
  const proof = await generateRangeProof(100000000, 64);
  
  await client.transferWithClientProofs({
    sender: 'YOUR_WALLET',
    recipient: 'RECIPIENT_WALLET',
    amount: 0.1,
    token: 'SOL',
    type: 'internal',
    customProof: proof
  });
}
```

## Supported Tokens

| Token | Decimals | Fee |
|-------|----------|-----|
| SOL | 9 | 0.5% |
| RADR | 9 | 0.3% |
| USDC | 6 | 1% |
| ORE | 11 | 0.3% |
| BONK | 5 | 1% |
| JIM | 9 | 1% |
| GODL | 11 | 1% |
| HUSTLE | 9 | 0.3% |
| ZEC | 9 | 1% |
| CRT | 9 | 1% |
| BLACKCOIN | 6 | 1% |
| GIL | 6 | 1% |
| ANON | 9 | 1% |
| WLFI | 6 | 1% |
| USD1 | 6 | 1% |
| AOL | 6 | 1% |
| IQLABS | 9 | 0.5% |
| SANA | 6 | 1% |
| POKI | 9 | 1% |
| RAIN | 6 | 2% |
| HOSICO | 9 | 1% |
| SKR | 6 | 0.5% |

## Token Utilities

```typescript
import { TokenUtils } from '@radr/shadowwire';

TokenUtils.toSmallestUnit(0.1, 'SOL');
TokenUtils.fromSmallestUnit(100000000, 'SOL');
```

## Error Handling

```typescript
import { 
  RecipientNotFoundError, 
  InsufficientBalanceError,
  TransferError 
} from '@radr/shadowwire';

try {
  await client.transfer({ ... });
} catch (error) {
  if (error instanceof RecipientNotFoundError) {
  }
}
```

## Browser Compatibility

Client-side proof generation requires WebAssembly support:

- Chrome 57+
- Firefox 52+
- Safari 11+
- Edge 16+

See [Browser Setup Guide](./BROWSER_SETUP.md) for framework-specific configuration.

## Links

- Telegram: https://t.me/radrportal
- Twitter: https://x.com/radrdotfun
- Email: hello@radrlabs.io

## License

MIT
