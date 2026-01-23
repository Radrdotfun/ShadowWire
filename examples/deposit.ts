import { ShadowWireClient } from '@radr/shadowwire';

async function depositSOL() {
  const client = new ShadowWireClient();

  const response = await client.deposit({
    wallet: 'YOUR_WALLET_ADDRESS',
    amount: 100000000,
  });
}

async function depositUSDC() {
  const client = new ShadowWireClient();

  const response = await client.deposit({
    wallet: 'YOUR_WALLET_ADDRESS',
    amount: 100000000,
    token_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  });

  console.log('Transaction:', response.unsigned_tx_base64);
}

async function checkBalance() {
  const client = new ShadowWireClient();

  const balance = await client.getBalance('YOUR_WALLET_ADDRESS', 'SOL');
  
  console.log('Available:', balance.available / 1e9, 'SOL');
  console.log('Deposited:', balance.deposited / 1e9, 'SOL');
  console.log('Pool:', balance.pool_address);
}

depositSOL().catch(console.error);
