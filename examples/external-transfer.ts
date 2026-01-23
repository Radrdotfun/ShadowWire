import { ShadowWireClient } from '@radr/shadowwire';

async function externalTransferSOL() {
  const client = new ShadowWireClient();

  const result = await client.transfer({
    sender: 'YOUR_WALLET_ADDRESS',
    recipient: 'RECIPIENT_WALLET_ADDRESS',
    amount: 0.1,
    token: 'SOL',
    type: 'external',
  });

  console.log('Transaction:', result.tx_signature);
  console.log('Amount:', result.amount_sent);
  console.log('Hidden:', result.amount_hidden);
}

async function externalTransferUSDC() {
  const client = new ShadowWireClient();

  const result = await client.transfer({
    sender: 'YOUR_WALLET_ADDRESS',
    recipient: 'RECIPIENT_WALLET_ADDRESS',
    amount: 100,
    token: 'USDC',
    type: 'external',
  });

  console.log('Transaction:', result.tx_signature);
  console.log('Amount:', result.amount_sent);
}

async function externalTransferBONK() {
  const client = new ShadowWireClient();

  const result = await client.transfer({
    sender: 'YOUR_WALLET_ADDRESS',
    recipient: 'RECIPIENT_WALLET_ADDRESS',
    amount: 1000,
    token: 'BONK',
    type: 'external',
  });

  console.log('Transaction:', result.tx_signature);
}

async function transferToAnyWallet() {
  const client = new ShadowWireClient();
  const recipient = 'ANY_SOLANA_WALLET_ADDRESS';

  const result = await client.transfer({
    sender: 'YOUR_WALLET_ADDRESS',
    recipient: recipient,
    amount: 0.5,
    token: 'SOL',
    type: 'external',
  });

  console.log('Sent to', recipient);
  console.log('Transaction:', result.tx_signature);
}

externalTransferSOL().catch(console.error);
