import { ShadowWireClient } from '@radr/shadowwire';

async function withdrawSOL() {
  const client = new ShadowWireClient();

  const balance = await client.getBalance('YOUR_WALLET_ADDRESS', 'SOL');
  console.log('Balance:', balance.available / 1e9, 'SOL');

  const response = await client.withdraw({
    wallet: 'YOUR_WALLET_ADDRESS',
    amount: 50000000,
  });

  console.log('Amount:', response.amount_withdrawn / 1e9, 'SOL');
  console.log('Fee:', response.fee / 1e9, 'SOL');
  console.log('Transaction:', response.unsigned_tx_base64);
}

async function withdrawUSDC() {
  const client = new ShadowWireClient();

  const response = await client.withdraw({
    wallet: 'YOUR_WALLET_ADDRESS',
    amount: 50000000,
    token_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  });

  console.log('Amount:', response.amount_withdrawn / 1e6, 'USDC');
  console.log('Transaction:', response.unsigned_tx_base64);
}

async function withdrawAll() {
  const client = new ShadowWireClient();

  const balance = await client.getBalance('YOUR_WALLET_ADDRESS', 'SOL');
  
  if (balance.available === 0) {
    console.log('No funds available');
    return;
  }

  const response = await client.withdraw({
    wallet: 'YOUR_WALLET_ADDRESS',
    amount: balance.available,
  });

  console.log('Amount:', response.amount_withdrawn / 1e9, 'SOL');
  console.log('Transaction:', response.unsigned_tx_base64);
}

withdrawSOL().catch(console.error);
