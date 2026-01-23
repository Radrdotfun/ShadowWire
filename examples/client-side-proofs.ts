import { 
  ShadowWireClient, 
  initWASM, 
  generateRangeProof, 
  verifyRangeProof,
  isWASMSupported
} from '@radr/shadowwire';

async function clientSideProofTransfer() {
  if (!isWASMSupported()) {
    throw new Error('WebAssembly not supported');
  }

  await initWASM();

  const client = new ShadowWireClient();
  const amountSOL = 0.5;
  const amountLamports = amountSOL * 1e9;

  const startTime = Date.now();
  const proof = await generateRangeProof(amountLamports, 64);
  const duration = Date.now() - startTime;
  
  console.log('Proof generated in', duration, 'ms');

  const result = await client.transferWithClientProofs({
    sender: 'YOUR_WALLET_ADDRESS',
    recipient: 'RECIPIENT_WALLET_ADDRESS',
    amount: amountSOL,
    token: 'SOL',
    type: 'internal',
    customProof: proof,
  });

  console.log('Transaction:', result.tx_signature);
}

async function generateAndVerifyProof() {
  if (!isWASMSupported()) {
    return;
  }

  await initWASM();

  const amount = 100000000;
  const proof = await generateRangeProof(amount, 64);
  const isValid = await verifyRangeProof(proof.proofBytes, proof.commitmentBytes, 64);

  console.log('Valid:', isValid);
}

async function maximumPrivacyTransfer() {
  if (!isWASMSupported()) {
    throw new Error('WebAssembly not supported');
  }

  await initWASM();

  const client = new ShadowWireClient();
  const amountUSDC = 1000;
  const amountMicroUSDC = amountUSDC * 1e6;

  const proof = await generateRangeProof(amountMicroUSDC, 64);

  const result = await client.transferWithClientProofs({
    sender: 'YOUR_WALLET_ADDRESS',
    recipient: 'RECIPIENT_WALLET_ADDRESS',
    amount: amountUSDC,
    token: 'USDC',
    type: 'internal',
    customProof: proof,
  });

  console.log('Transaction:', result.tx_signature);
}

async function preGenerateProof() {
  await initWASM();

  const client = new ShadowWireClient();
  const amount = 0.1;
  
  const proof = await client.generateProofLocally(amount, 'SOL');

  const result = await client.transferWithClientProofs({
    sender: 'YOUR_WALLET_ADDRESS',
    recipient: 'RECIPIENT_WALLET_ADDRESS',
    amount: amount,
    token: 'SOL',
    type: 'internal',
    customProof: proof,
  });

  console.log('Transaction:', result.tx_signature);
}

clientSideProofTransfer().catch(console.error);
