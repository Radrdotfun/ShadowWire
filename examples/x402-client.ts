/**
 * x402 Client Example
 *
 * Demonstrates both the automatic request() flow and a manual
 * step-by-step payment flow against an x402-protected server.
 *
 * Environment variables:
 *   WALLET_ADDRESS – Sender's Solana wallet address
 *   SERVER_URL     – Base URL of the x402 server (default: http://localhost:3000)
 */
import { ShadowWireClient, X402Client } from '@radr/shadowwire';

const WALLET_ADDRESS = process.env.WALLET_ADDRESS || 'YOUR_WALLET_ADDRESS';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

const wallet = {
  signMessage: async (_message: Uint8Array) => {
    // Replace with real wallet adapter (e.g. Phantom, Solflare)
    throw new Error('Implement wallet signing');
  },
};

const client = new ShadowWireClient();
const x402 = new X402Client({
  client,
  wallet,
  senderWallet: WALLET_ADDRESS,
  defaultToken: 'USDC',
  defaultTransferType: 'external',
  requestTimeoutMs: 20_000,
});

/**
 * Automatic flow — X402Client detects 402, pays, and retries in one call.
 */
async function payForData() {
  const result = await x402.request(`${SERVER_URL}/api/data`);

  if (result.success) {
    console.log('Data:', result.data);
    if (result.payment) {
      console.log('Paid via:', result.payment.transfer.tx_signature);
      console.log('Amount hidden:', result.payment.transfer.amount_hidden);
    }
  } else {
    console.error('Request failed:', result.error);
  }
}

/**
 * Manual flow — probe, parse requirements, pay, then retry with the header.
 */
async function manualPayFlow() {
  // 1. Probe the endpoint
  const probe = await fetch(`${SERVER_URL}/api/data`);

  if (probe.status !== 402) {
    console.log('No payment required, status:', probe.status);
    return;
  }

  // 2. Parse payment requirements
  const body = await probe.json();
  const requirements = X402Client.parseRequirements(body);

  if (!requirements) {
    console.error('Could not parse 402 response');
    return;
  }

  console.log('Payment options:', requirements.accepts.length);
  const requirement = requirements.accepts[0];
  console.log(`Scheme: ${requirement.scheme}, Amount: ${requirement.amount}, Asset: ${requirement.asset}`);

  // 3. Execute payment
  const payment = await x402.pay(requirement);
  if (!payment.success || !payment.paymentHeader) {
    console.error('Payment failed:', payment.error);
    return;
  }

  console.log('Payment tx:', payment.transfer?.tx_signature);

  // 4. Retry with X-Payment header
  const response = await fetch(`${SERVER_URL}/api/data`, {
    headers: { 'X-Payment': payment.paymentHeader },
  });

  if (response.ok) {
    console.log('Unlocked:', await response.json());
  } else {
    console.error('Retry failed:', response.status);
  }
}

payForData().catch(console.error);
// manualPayFlow().catch(console.error);
