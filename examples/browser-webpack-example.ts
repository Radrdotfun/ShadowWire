import { initWASM, generateRangeProof, verifyRangeProof, isWASMSupported } from '@radr/shadowwire';

if (!isWASMSupported()) {
  throw new Error('WebAssembly not supported');
}

async function initialize() {
  try {
    await initWASM();
    return true;
  } catch (error) {
    console.error('Failed to initialize:', error);
    return false;
  }
}

async function createPrivateTransaction(amount: number) {
  const proof = await generateRangeProof(amount, 64);
  return proof;
}

async function verifyPrivateTransaction(
  proofBytes: string,
  commitmentBytes: string,
  bitLength: number = 64
) {
  return await verifyRangeProof(proofBytes, commitmentBytes, bitLength);
}

export async function setupBrowserExample() {
  const initialized = await initialize();
  
  if (!initialized) {
    return;
  }
  
  const amount = 1000;
  const proof = await createPrivateTransaction(amount);
  const isValid = await verifyPrivateTransaction(proof.proofBytes, proof.commitmentBytes);
  
  if (isValid) {
    return { success: true, proof };
  }
  
  return { success: false };
}

export const ShadowWireService = {
  initialized: false,
  
  async init(wasmUrl?: string): Promise<void> {
    if (this.initialized) return;
    await initWASM(wasmUrl);
    this.initialized = true;
  },
  
  async generateProof(amount: number, bitLength: number = 64) {
    if (!this.initialized) {
      throw new Error('Not initialized');
    }
    return await generateRangeProof(amount, bitLength);
  },
  
  async verifyProof(proofBytes: string, commitmentBytes: string, bitLength: number = 64) {
    if (!this.initialized) {
      throw new Error('Not initialized');
    }
    return await verifyRangeProof(proofBytes, commitmentBytes, bitLength);
  },
};
