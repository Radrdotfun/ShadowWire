import init, { generate_range_proof, verify_range_proof, ZKProofResult } from '../wasm/settler_wasm';
import { ZKProofData } from './types';
import { ProofGenerationError, WASMNotSupportedError } from './errors';

let wasmInitialized = false;

/**
 * Detects if running in Node.js environment (not bundled for browser)
 */
function isNode(): boolean {
  return typeof process !== 'undefined' && 
         process.versions != null && 
         process.versions.node != null &&
         typeof window === 'undefined';
}

/**
 * Initializes WASM module for Node.js environment
 * Uses dynamic require hidden from bundlers
 */
async function initWASMNode(): Promise<void> {
  // Use Function constructor to hide require from bundlers
  // This prevents webpack/rspack from trying to resolve these modules
  const dynamicRequire = new Function('moduleName', 'return require(moduleName)');
  
  try {
    const path = dynamicRequire('path');
    const fs = dynamicRequire('fs');
    
    const wasmPaths = [
      path.join(__dirname, '../wasm/settler_wasm_bg.wasm'),
      path.join(process.cwd(), 'wasm/settler_wasm_bg.wasm'),
      path.join(process.cwd(), 'dist/wasm/settler_wasm_bg.wasm'),
      path.join(process.cwd(), 'node_modules/@radr/shadowwire/dist/wasm/settler_wasm_bg.wasm'),
    ];
    
    let wasmPath: string | undefined;
    for (const p of wasmPaths) {
      if (fs.existsSync(p)) {
        wasmPath = p;
        break;
      }
    }
    
    if (!wasmPath) {
      throw new Error('WASM file not found in any expected location');
    }
    
    const wasmBuffer = fs.readFileSync(wasmPath);
    await init(wasmBuffer);
  } catch (error: any) {
    throw new Error(`Node.js WASM initialization failed: ${error.message}`);
  }
}

/**
 * Initializes WASM module for browser environment
 */
async function initWASMBrowser(wasmUrl?: string): Promise<void> {
  // Default WASM URLs to try in browser
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
        throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
      }
      
      const wasmBuffer = await response.arrayBuffer();
      await init(wasmBuffer);
      return; // Success!
    } catch (error: any) {
      lastError = error;
      // Continue to next URL
    }
  }
  
  throw new Error(
    `Could not load WASM from any location. Last error: ${lastError?.message}. ` +
    `In browser environments, ensure the WASM file is served at one of: ${urlsToTry.join(', ')}`
  );
}

/**
 * Initializes the WASM module. Must be called before using proof functions.
 * 
 * @param wasmUrl - (Browser only) Optional custom URL to the WASM file.
 *                  If not provided, will try default paths: /wasm/settler_wasm_bg.wasm, 
 *                  ./wasm/settler_wasm_bg.wasm, ../wasm/settler_wasm_bg.wasm
 * 
 * @example
 * // Node.js
 * await initWASM();
 * 
 * @example
 * // Browser with default path
 * await initWASM();
 * 
 * @example
 * // Browser with custom path
 * await initWASM('/public/wasm/settler_wasm_bg.wasm');
 */
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
    throw new ProofGenerationError(`Could not load cryptography module: ${error.message}`);
  }
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

