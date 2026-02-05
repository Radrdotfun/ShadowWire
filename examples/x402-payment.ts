/**
 * x402 Payment Protocol examples.
 *
 * Shows both client-side (paying for APIs) and server-side (monetizing APIs)
 * usage with ShadowWire private transfers.
 */

import {
  ShadowWireClient,
  X402Client,
  x402Paywall,
  createDiscoveryDocument,
} from '@radr/shadowwire';

// ---------------------------------------------------------------------------
// Client: Paying for a paid API endpoint
// ---------------------------------------------------------------------------

async function clientExample() {
  const client = new ShadowWireClient();

  // Use @solana/wallet-adapter in real apps
  const wallet = {
    signMessage: async (message: Uint8Array) => {
      throw new Error('Implement wallet signing');
    },
  };

  const x402 = new X402Client({
    client,
    wallet,
    senderWallet: 'YOUR_WALLET_ADDRESS',
    defaultToken: 'USDC',
    // 'external' = sender anonymous, amount visible
    // 'internal' = both parties private, amount hidden
    defaultTransferType: 'external',
  });

  // Automatic flow: request -> detect 402 -> pay -> retry
  const result = await x402.request('https://api.example.com/data');

  if (result.success) {
    console.log('Data:', result.data);
    if (result.payment) {
      console.log('Paid:', result.payment.transfer.tx_signature);
      console.log('Amount hidden:', result.payment.transfer.amount_hidden);
    }
  }

  // Manual flow: parse 402 and pay individually
  const response = await fetch('https://api.example.com/premium');
  if (response.status === 402) {
    const body = await response.json();
    const requirements = X402Client.parseRequirements(body);
    if (requirements) {
      const req = requirements.accepts[0];
      const payment = await x402.pay(req);
      if (payment.success) {
        // Retry with payment header
        await fetch('https://api.example.com/premium', {
          headers: { 'X-Payment': payment.paymentHeader! },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Server: Monetizing API endpoints with Express
// ---------------------------------------------------------------------------

async function serverExample() {
  // Requires: npm install express
  const express = require('express');
  const app = express();

  // Protect an endpoint: requests without payment get a 402 response.
  // ShadowWire payments are verified automatically.
  app.get(
    '/api/data',
    x402Paywall({
      payTo: 'YOUR_MERCHANT_WALLET',
      amount: 0.01, // $0.01 USDC
      asset: 'USDC',
      description: 'Premium data endpoint',
      // Optional: also accept payments via PayAI facilitator
      facilitatorUrl: 'https://facilitator.payai.network',
      onPayment: (info) => {
        console.log(`Payment from ${info.payer}: ${info.signature}`);
      },
    }),
    (req: any, res: any) => {
      // req.x402 contains payment details
      res.json({
        data: 'premium content',
        payment: req.x402,
      });
    }
  );

  // Discovery document for agents to find your paid endpoints
  app.get('/.well-known/x402', (_req: any, res: any) => {
    res.json(createDiscoveryDocument(
      'My API',
      'YOUR_MERCHANT_WALLET',
      [
        { path: '/api/data', method: 'GET', price: 0.01, description: 'Premium data' },
        { path: '/api/signals', method: 'GET', price: 0.05, description: 'Trading signals' },
      ],
    ));
  });

  app.listen(3000);
}

clientExample().catch(console.error);
