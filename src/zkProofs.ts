import init, { generate_range_proof, verify_range_proof, ZKProofResult } from '../wasm/settler_wasm';
import { ZKProofData } from './types';
import { ProofGenerationError } from './errors';

let wasmInitialized = false;

function isNode(): boolean {
  return typeof process !== 'undefined' && 
         process.versions != null && 
         process.versions.node != null &&
         typeof window === 'undefined';
}

export async function initWASM(wasmUrl?: string): Promise<void> {
  if (wasmInitialized) {
    return;
  }
  
  try {
    if (isNode()) {
      await initWASMNode();
    } else {
      await initWASMBrowser(wasmUrl);
    }
    wasmInitialized = true;
  } catch (error: any) {
    throw new ProofGenerationError(`Could not load WASM: ${error.message}`);
  }
}

async function initWASMNode(): Promise<void> {
  const getRequire = new Function('return typeof require !== "undefined" ? require : null');
  const nodeRequire = getRequire();
  
  if (!nodeRequire) {
    throw new Error('Node.js require not available');
  }
  
  const path = nodeRequire('path');
  const fs = nodeRequire('fs');
  
  const wasmPaths = [
    path.join(__dirname, '../wasm/settler_wasm_bg.wasm'),
    path.join(__dirname, '../../wasm/settler_wasm_bg.wasm'),
    path.join(process.cwd(), 'wasm/settler_wasm_bg.wasm'),
    path.join(process.cwd(), 'dist/wasm/settler_wasm_bg.wasm'),
    path.join(process.cwd(), 'node_modules/@radr/shadowwire/wasm/settler_wasm_bg.wasm'),
    path.join(process.cwd(), 'node_modules/@radr/shadowwire/dist/wasm/settler_wasm_bg.wasm'),
  ];
  
  let wasmBuffer: Buffer | null = null;
  
  for (const wasmPath of wasmPaths) {
    try {
      if (fs.existsSync(wasmPath)) {
        wasmBuffer = fs.readFileSync(wasmPath);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!wasmBuffer) {
    throw new Error('WASM file not found. Searched paths: ' + wasmPaths.join(', '));
  }
  
  await init(wasmBuffer);
}

async function initWASMBrowser(wasmUrl?: string): Promise<void> {
  const defaultUrls = [
    '/wasm/settler_wasm_bg.wasm',
    './wasm/settler_wasm_bg.wasm',
    '../wasm/settler_wasm_bg.wasm',
  ];
  
  const urlsToTry = wasmUrl ? [wasmUrl, ...defaultUrls] : defaultUrls;
  
  let lastError: Error | null = null;
  
  for (const url of urlsToTry) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const wasmBuffer = await response.arrayBuffer();
      await init(wasmBuffer);
      return;
    } catch (error: any) {
      lastError = error;
    }
  }
  
  throw new Error(`Failed to load WASM: ${lastError?.message}`);
}

export async function generateRangeProof(
  amount: number,
  bitLength: number = 64
): Promise<ZKProofData> {
  if (!wasmInitialized) {
    await initWASM();
  }
  
  if (amount < 0) {
    throw new ProofGenerationError('Amount must be non-negative');
  }
  
  const maxAmount = Math.pow(2, bitLength);
  if (amount >= maxAmount) {
    throw new ProofGenerationError(`Amount exceeds ${bitLength}-bit range`);
  }
  
  if (!Number.isInteger(amount)) {
    throw new ProofGenerationError('Amount must be an integer');
  }
  
  try {
    const result: ZKProofResult = generate_range_proof(BigInt(amount), bitLength);
    
    return {
      proofBytes: uint8ArrayToHex(result.proof_bytes),
      commitmentBytes: uint8ArrayToHex(result.commitment_bytes),
      blindingFactorBytes: uint8ArrayToHex(result.blinding_factor_bytes),
    };
  } catch (error: any) {
    throw new ProofGenerationError(`Failed to generate proof: ${error.message || error}`);
  }
}

export async function verifyRangeProof(
  proofBytes: string,
  commitmentBytes: string,
  bitLength: number = 64
): Promise<boolean> {
  if (!wasmInitialized) {
    await initWASM();
  }
  
  try {
    const proofArray = hexToUint8Array(proofBytes);
    const commitmentArray = hexToUint8Array(commitmentBytes);
    
    return verify_range_proof(proofArray, commitmentArray, bitLength);
  } catch (error: any) {
    return false;
  }
}

export function isWASMSupported(): boolean {
  try {
    return typeof WebAssembly === 'object' && 
           typeof WebAssembly.instantiate === 'function';
  } catch (e) {
    return false;
  }
}

export const BULLETPROOF_INFO = {
  PROOF_SIZE: 672,
  COMMITMENT_SIZE: 32,
  DEFAULT_BIT_LENGTH: 64,
  ON_CHAIN_CU: 45000,
};

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
