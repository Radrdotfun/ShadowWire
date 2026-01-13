# ShadowWire SDK

TypeScript SDK for ShadowWire - private payments on Solana with zero-knowledge proofs.

## What is ShadowWire?

ShadowWire lets you make private transfers on Solana. You can hide transaction amounts using Bulletproofs (zero-knowledge proofs) while keeping everything on-chain and verifiable. Think of it as a privacy layer for Solana transfers.

## Features

- **Private transfers** - Hide payment amounts on-chain
- **Multi-token** - Supports 17 tokens including SOL, RADR, USDC, and more
- **Wallet signature authentication** - Mandatory security layer for all transfers
- **Flexible** - Client-side or backend proof generation
- **Browser & Node.js** - Works in web apps and server-side
- **Type-safe** - Full TypeScript support

## Installation

```bash
npm install @radr/shadowwire
```

**For browser/web apps:** See the [Browser Setup Guide](./BROWSER_SETUP.md) for detailed instructions on using ShadowWire in React, Vue, Angular, or vanilla JavaScript.

## Quick Start

```typescript
import { ShadowWireClient } from '@radr/shadowwire';

const client = new ShadowWireClient();

// Check balance
const balance = await client.getBalance('YOUR_WALLET');
console.log(`Available: ${balance.available / 1e9} SOL`);

// Make a private transfer
await client.transfer({
  sender: 'YOUR_WALLET',
  recipient: 'RECIPIENT_WALLET',
  amount: 0.5,
  token: 'SOL',
  type: 'internal'  // Amount stays private
});
```

## How It Works

### Two Transfer Types

**Internal Transfers** - Amount is completely hidden using zero-knowledge proofs. Both sender and recipient must be ShadowWire users. Perfect for maximum privacy.

**External Transfers** - Amount is visible, but sender stays anonymous. Works with any Solana wallet. Good for paying people outside the system.

### Proof Generation

Proofs are generated via:

1. **Client-side** - Generate proofs in the browser using WASM. Maximum privacy since the backend never sees your amount.

## API

### Initialize Client

```typescript
const client = new ShadowWireClient({
  debug: true  // Optional: log requests
});
```

### Check Balance

```typescript
const balance = await client.getBalance('WALLET_ADDRESS', 'SOL');

console.log(balance.available);  // Available lamports
console.log(balance.pool_address); // Pool PDA
```

### Deposit

```typescript
const tx = await client.deposit({
  wallet: 'YOUR_WALLET',
  amount: 100000000  // 0.1 SOL in lamports
});

// Returns unsigned transaction - you need to sign it with your wallet
```

### Withdraw

```typescript
const tx = await client.withdraw({
  wallet: 'YOUR_WALLET',
  amount: 50000000  // 0.05 SOL
});
```

### Transfer

The main method - handles everything for you:

```typescript
const result = await client.transfer({
  sender: 'YOUR_WALLET',
  recipient: 'RECIPIENT_WALLET',
  amount: 0.1,  // In SOL, not lamports
  token: 'SOL',
  type: 'internal'  // or 'external'
});

console.log(result.tx_signature);
console.log(result.amount_hidden);  // true for internal, false for external
```

## Token Support

| Token | Decimals | Description |
|-------|----------|-------------|
| SOL   | 9        | Solana native token |
| RADR  | 9        | Radr |
| USDC  | 6        | USD Coin |
| ORE   | 11       | ORE |
| BONK  | 5        | Bonk |
| JIM   | 9        | Jim |
| GODL  | 11       | GODL |
| HUSTLE| 9        | Hustle |
| ZEC   | 8        | Zcash |
| CRT   | 9        | DefiCarrot |
| BLACKCOIN | 6    | Blackcoin |
| GIL   | 6        | Kith Gil |
| ANON  | 9        | ANON |
| WLFI  | 6        | World Liberty Financial |
| USD1  | 6        | USD1 |
| AOL   | 6        | AOL |
| IQLABS| 9        | IQ Labs |

```typescript
import { TokenUtils } from '@radr/shadowwire';

// Convert SOL to lamports
TokenUtils.toSmallestUnit(0.1, 'SOL');  // 100000000

// Convert back
TokenUtils.fromSmallestUnit(100000000, 'SOL');  // 0.1
```

## Wallet Signature Authentication (Required)

All transfers now **require** wallet signature authentication for security:

```typescript
import { ShadowWireClient } from '@radr/shadowwire';
import { useWallet } from '@solana/wallet-adapter-react';

const { signMessage, publicKey } = useWallet();
const client = new ShadowWireClient();

// Transfer with wallet signature authentication (REQUIRED)
await client.transfer({
  sender: publicKey!.toBase58(),
  recipient: 'RECIPIENT_ADDRESS',
  amount: 1.0,
  token: 'SOL',
  type: 'internal',
  wallet: { signMessage: signMessage! } // REQUIRED for authentication
});
```

**Security Benefits:**
- Additional security layer on top of ZK proofs
- Prevents unauthorized transfers
- Wallet signature proves you control the sender address
- Backend validates signature matches sender wallet

**Important:** Wallet signature authentication is **mandatory**. All transfers must include a valid wallet signature.

## Client-Side Proofs (Advanced)

If you want maximum privacy, generate proofs in the browser:

### Node.js

```typescript
import { initWASM, generateRangeProof, isWASMSupported } from '@radr/shadowwire';

// Initialize WASM (only needed once)
await initWASM();

// Generate proof locally
const amountLamports = 100000000;  // 0.1 SOL
const proof = await generateRangeProof(amountLamports, 64);

// Use it in a transfer
await client.transferWithClientProofs({
  sender: 'YOUR_WALLET',
  recipient: 'RECIPIENT_WALLET',
  amount: 0.1,
  token: 'SOL',
  type: 'internal',
  customProof: proof
});
```

### Browser

```typescript
import { initWASM, generateRangeProof, isWASMSupported } from '@radr/shadowwire';

// Check if browser supports WASM
if (!isWASMSupported()) {
  console.log('Use backend proofs instead');
  return;
}

// Initialize WASM with path to WASM file (must be served by your web server)
await initWASM('/wasm/settler_wasm_bg.wasm');

// Generate proof locally
const amountLamports = 100000000;  // 0.1 SOL
const proof = await generateRangeProof(amountLamports, 64);

// Use it in a transfer
await client.transferWithClientProofs({
  sender: 'YOUR_WALLET',
  recipient: 'RECIPIENT_WALLET',
  amount: 0.1,
  token: 'SOL',
  type: 'internal',
  customProof: proof
});
```

**Note:** Proof generation takes 2-3 seconds. Show a loading indicator.

**For browser setup:** See the [Browser Setup Guide](./BROWSER_SETUP.md) for complete instructions including bundler configuration and deployment.

## Error Handling

The SDK throws typed errors:

```typescript
import { RecipientNotFoundError, InsufficientBalanceError } from '@radr/shadowwire';

try {
  await client.transfer({
    sender: 'YOUR_WALLET',
    recipient: 'RECIPIENT',
    amount: 1.0,
    token: 'SOL',
    type: 'internal'
  });
} catch (error) {
  if (error instanceof RecipientNotFoundError) {
    // Recipient hasn't used ShadowWire before
    // Try external transfer instead
  } else if (error instanceof InsufficientBalanceError) {
    // Not enough balance
  }
}
```

## Examples

### Private Payment

```typescript
// Send 0.5 SOL privately
const result = await client.transfer({
  sender: 'YOUR_WALLET',
  recipient: 'RECIPIENT_WALLET',
  amount: 0.5,
  token: 'SOL',
  type: 'internal'
});

console.log('Done!', result.tx_signature);
// Amount is hidden on-chain
```

### Pay Anyone (Even Non-Users)

```typescript
// Send to any Solana wallet
const result = await client.transfer({
  sender: 'YOUR_WALLET',
  recipient: 'ANY_SOLANA_WALLET',
  amount: 100,  // USDC
  token: 'USDC',
  type: 'external'
});

// Amount is visible, but sender stays anonymous
```

### 2-Step Manual Transfer

For advanced users who want more control:

```typescript
// Step 1: Upload proof
const proofResult = await client.uploadProof({
  sender_wallet: 'YOUR_WALLET',
  token: 'SOL',
  amount: 100000000,
  nonce: Math.floor(Date.now() / 1000)
});

// Step 2: Execute transfer
const result = await client.internalTransfer({
  sender_wallet: 'YOUR_WALLET',
  recipient_wallet: 'RECIPIENT',
  token: 'SOL',
  nonce: proofResult.nonce,
  relayer_fee: 1000000
});
```

## Common Questions

**Do I need an API key?**  
Nope. The API is open.

**What's the fee?**  
1% relayer fee automatically applied to all transfers.

**Can I transfer to myself?**  
No, blocked for security.

**What if the recipient hasn't used ShadowWire?**  
Use an external transfer instead. The SDK will throw `RecipientNotFoundError` if you try internal transfer.

**Are my funds safe?**  
Yes. The smart contracts are audited and you always control your keys.

**Why does client-side proof generation take so long?**  
Bulletproofs are computationally heavy. 2-3 seconds is normal for proper zero-knowledge proofs.

**Should I use client-side or backend proofs?**  
Backend for almost everything. Client-side only if you really don't trust the backend to see your amounts.

## Browser Support

The SDK now supports both Node.js and browser environments!

**Client-side proofs work in:**
- ✅ Chrome/Edge 57+
- ✅ Firefox 52+  
- ✅ Safari 11+
- ✅ Node.js 10+
- ❌ Internet Explorer (not supported)

**Backend proofs work everywhere** (including all browsers).

**Using in web apps?** Check out the [Browser Setup Guide](./BROWSER_SETUP.md) for:
- React, Vue, Angular examples
- Webpack, Vite, Next.js configuration
- WASM file deployment guide
- Troubleshooting common issues

## Advanced

### Debug Mode

```typescript
const client = new ShadowWireClient({ debug: true });
// Logs all API calls to console
```

### Custom API Endpoint

```typescript
const client = new ShadowWireClient({
  apiBaseUrl: 'https://your-api.com'
});
```

## Get Help

- Telegram: https://t.me/radrportal
- Twitter: https://x.com/radrdotfun
- Email: hello@radrlabs.io

## License

MIT
