import { ShadowWireClient, RecipientNotFoundError } from '@radr/shadowwire';

async function internalTransferSOL() {
  const client = new ShadowWireClient();

  try {
    const result = await client.transfer({
      sender: 'YOUR_WALLET_ADDRESS',
      recipient: 'RECIPIENT_WALLET_ADDRESS',
      amount: 0.5,
      token: 'SOL',
      type: 'internal',
    });

    console.log('Transaction:', result.tx_signature);
    console.log('Hidden:', result.amount_hidden);
  } catch (error) {
    if (error instanceof RecipientNotFoundError) {
      console.log('Recipient not found. Use external transfer.');
    } else {
      throw error;
    }
  }
}

async function internalTransferORE() {
  const client = new ShadowWireClient();

  const result = await client.transfer({
    sender: 'YOUR_WALLET_ADDRESS',
    recipient: 'RECIPIENT_WALLET_ADDRESS',
    amount: 1000,
    token: 'ORE',
    type: 'internal',
  });

  console.log('Transaction:', result.tx_signature);
}

async function internalTransferUSDC() {
  const client = new ShadowWireClient();

  const result = await client.transfer({
    sender: 'YOUR_WALLET_ADDRESS',
    recipient: 'RECIPIENT_WALLET_ADDRESS',
    amount: 5000,
    token: 'USDC',
    type: 'internal',
  });

  console.log('Transaction:', result.tx_signature);
}

async function internalTransferWithFallback() {
  const client = new ShadowWireClient();

  const recipient = 'RECIPIENT_WALLET_ADDRESS';
  const amount = 0.25;
  const token = 'SOL';

  try {
    const result = await client.transfer({
      sender: 'YOUR_WALLET_ADDRESS',
      recipient: recipient,
      amount: amount,
      token: token,
      type: 'internal',
    });

    console.log('Internal transfer:', result.tx_signature);
  } catch (error) {
    if (error instanceof RecipientNotFoundError) {
      const result = await client.transfer({
        sender: 'YOUR_WALLET_ADDRESS',
        recipient: recipient,
        amount: amount,
        token: token,
        type: 'external',
      });

      console.log('External transfer:', result.tx_signature);
    } else {
      throw error;
    }
  }
}

internalTransferSOL().catch(console.error);
