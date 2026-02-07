/**
 * x402 Server Example
 *
 * Express server with a paywall-protected route, a free route,
 * and a .well-known/x402 discovery endpoint.
 *
 * Environment variables:
 *   MERCHANT_WALLET  – Solana wallet that receives payments
 *   FACILITATOR_URL  – x402 facilitator endpoint (default: https://x402.kamiyo.ai)
 *   API_KEY          – API key for the facilitator
 *   PORT             – Server port (default: 3000)
 */
import { x402Paywall, createDiscoveryDocument } from '@radr/shadowwire';

const express = require('express');
const app = express();

const MERCHANT_WALLET = process.env.MERCHANT_WALLET || 'YOUR_MERCHANT_WALLET';
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://x402.kamiyo.ai';
const API_KEY = process.env.API_KEY || '';
const PORT = Number(process.env.PORT) || 3000;

// Free route — no payment needed
app.get('/api/status', (_req: any, res: any) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Paywall-protected route
app.get(
  '/api/data',
  x402Paywall({
    payTo: MERCHANT_WALLET,
    amount: 0.01,
    asset: 'USDC',
    description: 'Premium data endpoint',
    facilitatorUrl: FACILITATOR_URL,
    apiKey: API_KEY,
    onPayment: (info) => {
      console.log(`Payment received from ${info.payer}: ${info.signature} (${info.amount} USDC)`);
    },
  }),
  (req: any, res: any) => {
    res.json({ data: 'premium content', payment: req.x402 });
  }
);

// Discovery endpoint
app.get('/.well-known/x402', (_req: any, res: any) => {
  res.json(
    createDiscoveryDocument('My API', MERCHANT_WALLET, [
      { path: '/api/data', method: 'GET', price: 0.01, description: 'Premium data' },
    ], { facilitatorUrl: FACILITATOR_URL })
  );
});

app.listen(PORT, () => {
  console.log(`x402 server listening on http://localhost:${PORT}`);
});
