/**
 * Example: Using ShadowWire in a browser with Webpack/Vite
 * 
 * This demonstrates how to properly use the ShadowWire SDK in a browser
 * environment with a modern bundler.
 */

import { initWASM, generateRangeProof, verifyRangeProof, isWASMSupported } from '@radr/shadowwire';

// Check if WebAssembly is supported
if (!isWASMSupported()) {
  console.error('WebAssembly is not supported in this browser');
  alert('Your browser does not support WebAssembly. Please use a modern browser.');
  throw new Error('WebAssembly not supported');
}

// Initialize the WASM module when the page loads
async function initialize() {
  try {
    // Option 1: Use default WASM path (will try /wasm/settler_wasm_bg.wasm)
    await initWASM();
    
    // Option 2: Specify custom WASM URL
    // await initWASM('/public/wasm/settler_wasm_bg.wasm');
    
    console.log('✅ ShadowWire initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize ShadowWire:', error);
    return false;
  }
}

// Example: Generate a range proof for a transaction amount
async function createPrivateTransaction(amount: number) {
  try {
    console.log(`Generating proof for amount: ${amount}`);
    
    // Generate a zero-knowledge range proof
    const proof = await generateRangeProof(amount, 64);
    
    console.log('✅ Proof generated:', {
      proofLength: proof.proofBytes.length,
      commitmentLength: proof.commitmentBytes.length,
    });
    
    return proof;
  } catch (error) {
    console.error('❌ Failed to generate proof:', error);
    throw error;
  }
}

// Example: Verify a range proof
async function verifyPrivateTransaction(
  proofBytes: string,
  commitmentBytes: string,
  bitLength: number = 64
) {
  try {
    console.log('Verifying proof...');
    
    const isValid = await verifyRangeProof(proofBytes, commitmentBytes, bitLength);
    
    if (isValid) {
      console.log('✅ Proof is valid! Amount is within range.');
    } else {
      console.log('❌ Proof is invalid!');
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ Failed to verify proof:', error);
    throw error;
  }
}

// Example usage in a UI
export async function setupBrowserExample() {
  // Initialize WASM first
  const initialized = await initialize();
  
  if (!initialized) {
    return;
  }
  
  // Example: User wants to send 1000 tokens privately
  const amount = 1000;
  
  // Generate proof (this happens on the client side)
  const proof = await createPrivateTransaction(amount);
  
  // Verify the proof (can be done by anyone without knowing the amount)
  const isValid = await verifyPrivateTransaction(
    proof.proofBytes,
    proof.commitmentBytes
  );
  
  if (isValid) {
    console.log('✅ Transaction is valid and can be submitted to the blockchain');
    
    // Now you can submit this proof to your Solana program
    // The proof demonstrates the amount is valid without revealing it
    return {
      success: true,
      proof,
    };
  } else {
    console.log('❌ Transaction is invalid');
    return {
      success: false,
    };
  }
}

// For frameworks like React, Vue, Angular:
export const ShadowWireService = {
  initialized: false,
  
  async init(wasmUrl?: string): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    await initWASM(wasmUrl);
    this.initialized = true;
  },
  
  async generateProof(amount: number, bitLength: number = 64) {
    if (!this.initialized) {
      throw new Error('ShadowWire not initialized. Call init() first.');
    }
    
    return await generateRangeProof(amount, bitLength);
  },
  
  async verifyProof(proofBytes: string, commitmentBytes: string, bitLength: number = 64) {
    if (!this.initialized) {
      throw new Error('ShadowWire not initialized. Call init() first.');
    }
    
    return await verifyRangeProof(proofBytes, commitmentBytes, bitLength);
  },
};

