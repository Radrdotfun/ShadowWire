/* tslint:disable */
/* eslint-disable */
export function generate_range_proof(amount: bigint, bit_length: number): ZKProofResult;
export function init(): void;
export function verify_range_proof(proof_bytes: Uint8Array, commitment_bytes: Uint8Array, bit_length: number): boolean;

export class ZKProofResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  readonly proof_bytes: Uint8Array;
  readonly commitment_bytes: Uint8Array;
  readonly blinding_factor_bytes: Uint8Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_zkproofresult_free: (a: number, b: number) => void;
  readonly generate_range_proof: (a: bigint, b: number) => [number, number, number];
  readonly init: () => void;
  readonly verify_range_proof: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly zkproofresult_blinding_factor_bytes: (a: number) => [number, number];
  readonly zkproofresult_commitment_bytes: (a: number) => [number, number];
  readonly zkproofresult_proof_bytes: (a: number) => [number, number];
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
