import {
  ShadowWireClient,
  X402Client,
  x402Paywall,
  createDiscoveryDocument,
} from '@radr/shadowwire';

async function clientExample() {
  const client = new ShadowWireClient();

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
    defaultTransferType: 'external',
    requestTimeoutMs: 20_000,
  });

  const result = await x402.request('https://api.example.com/data');

  if (result.success) {
    console.log('Data:', result.data);
    if (result.payment) {
      console.log('Paid:', result.payment.transfer.tx_signature);
      console.log('Amount hidden:', result.payment.transfer.amount_hidden);
    }
  }

  const response = await fetch('https://api.example.com/premium');
  if (response.status === 402) {
    const body = await response.json();
    const requirements = X402Client.parseRequirements(body);
    if (requirements) {
      const req = requirements.accepts[0];
      const payment = await x402.pay(req);
      if (payment.success) {
        await fetch('https://api.example.com/premium', {
          headers: { 'X-Payment': payment.paymentHeader! },
        });
      }
    }
  }
}

async function serverExample() {
  const express = require('express');
  const app = express();

  app.get(
    '/api/data',
    x402Paywall({
      payTo: 'YOUR_MERCHANT_WALLET',
      amount: 0.01,
      asset: 'USDC',
      description: 'Premium data endpoint',
      facilitatorUrl: 'https://facilitator.payai.network',
      onPayment: (info) => {
        console.log(`Payment from ${info.payer}: ${info.signature}`);
      },
    }),
    (req: any, res: any) => {
      res.json({ data: 'premium content', payment: req.x402 });
    }
  );

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
