import { ShadowWireClient } from './client';
import { TokenSymbol, WalletAdapter, TransferResponse, PoolBalance } from './types';
import { NetworkError, X402InvalidSchemeError, X402HeaderTooLargeError, X402FacilitatorError } from './errors';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_PAYMENT_HEADER_BYTES = 16_384;
const PAYMENT_HEADER_NAME = 'X-Payment';
const DEFAULT_FACILITATOR_URL = 'https://x402.kamiyo.ai';

/** Describes a single payment option a server will accept for a 402-protected resource. */
export interface X402PaymentRequirement {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  resource: string;
  description?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

export interface X402Response {
  x402Version: number;
  accepts: X402PaymentRequirement[];
  error?: string;
  facilitator?: string;
  resource?: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  [key: string]: unknown;
}

export interface X402PaymentResult {
  success: boolean;
  transfer?: TransferResponse;
  paymentHeader?: string;
  error?: string;
}

export interface X402RequestResult<T = unknown> {
  success: boolean;
  data?: T;
  payment?: {
    transfer: TransferResponse;
    requirement: X402PaymentRequirement;
  };
  error?: string;
  statusCode: number;
}

/** Configuration for creating an X402Client instance. */
export interface X402ClientConfig {
  client: ShadowWireClient;
  wallet: WalletAdapter;
  senderWallet: string;
  defaultToken?: TokenSymbol;
  defaultTransferType?: 'internal' | 'external';
  maxRetries?: number;
  headers?: Record<string, string>;
  requestTimeoutMs?: number;
}

export interface X402VerifyResult {
  valid: boolean;
  payer?: string;
  amount?: string;
  resource?: string;
  balance?: number;
  sufficient?: boolean;
  error?: string;
}

/** Configuration for the Express x402Paywall middleware. */
export interface X402MiddlewareConfig {
  payTo: string;
  amount: number;
  asset?: TokenSymbol;
  description?: string;
  maxTimeoutSeconds?: number;
  facilitatorUrl?: string;
  apiKey: string;
  additionalSchemes?: X402PaymentRequirement[];
  onPayment?: (info: { payer: string; amount: number; signature: string; resource: string }) => void;
}

export interface X402PaymentProof {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    amountHidden: boolean;
    resource: string;
    payTo: string;
    sender?: string;
  };
}

function toBase64(input: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(input, 'utf-8').toString('base64');
  const bytes = new TextEncoder().encode(input);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromBase64(encoded: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(encoded, 'base64').toString('utf-8');
  const bin = atob(encoded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function byteLength(str: string): number {
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(str, 'utf-8');
  return new TextEncoder().encode(str).length;
}

function isShadowwire(scheme: string): boolean {
  return scheme === 'shadowwire' || scheme === 'shadow';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** HTTP client that automatically handles x402 payment flows via ShadowWire transfers. */
export class X402Client {
  private client: ShadowWireClient;
  private wallet: WalletAdapter;
  private senderWallet: string;
  private defaultToken: TokenSymbol;
  private defaultTransferType: 'internal' | 'external';
  private maxRetries: number;
  private headers: Record<string, string>;
  private timeoutMs: number;

  /** Creates a new X402 client bound to a ShadowWire instance and wallet. */
  constructor(config: X402ClientConfig) {
    this.client = config.client;
    this.wallet = config.wallet;
    this.senderWallet = config.senderWallet;
    this.defaultToken = config.defaultToken || 'USDC';
    this.defaultTransferType = config.defaultTransferType || 'external';
    this.maxRetries = config.maxRetries ?? 1;
    this.headers = config.headers || {};
    this.timeoutMs = config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Fetches a URL, automatically paying the 402 requirement if one is returned. */
  async request<T = unknown>(url: string, options?: RequestInit): Promise<X402RequestResult<T>> {
    const mergedHeaders: Record<string, string> = {
      ...this.headers,
      ...((options?.headers as Record<string, string>) || {}),
    };

    const initial = await this.doFetch(url, { ...options, headers: mergedHeaders });

    if (initial.status !== 402) {
      if (!initial.ok) {
        return { success: false, error: `HTTP ${initial.status}: ${initial.statusText}`, statusCode: initial.status };
      }
      const parsed = await safeParseBody<T>(initial);
      return { success: true, data: parsed, statusCode: initial.status };
    }

    const x402Body = await safeParseBody<X402Response>(initial);
    if (!x402Body?.accepts?.length) {
      return { success: false, error: 'No accepted payment methods in 402 response', statusCode: 402 };
    }

    const requirement = this.findCompatibleRequirement(x402Body.accepts);
    if (!requirement) {
      return { success: false, error: 'No compatible payment option (need ShadowWire)', statusCode: 402 };
    }

    const payResult = await this.pay(requirement);
    if (!payResult.success || !payResult.transfer || !payResult.paymentHeader) {
      return { success: false, error: payResult.error || 'Payment failed', statusCode: 402 };
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const res = await this.doFetch(url, {
        ...options,
        headers: { ...mergedHeaders, [PAYMENT_HEADER_NAME]: payResult.paymentHeader },
      });

      if (res.ok) {
        const parsed = await safeParseBody<T>(res);
        return { success: true, data: parsed, payment: { transfer: payResult.transfer, requirement }, statusCode: res.status };
      }

      if (res.status === 402) {
        return { success: false, error: 'Payment not accepted by server', statusCode: 402 };
      }

      if (attempt < this.maxRetries && res.status >= 500) {
        await sleep(Math.min(250 * 2 ** attempt, 1000));
        continue;
      }

      return { success: false, error: `HTTP ${res.status} after payment`, statusCode: res.status };
    }

    return { success: false, error: 'Unexpected error', statusCode: 500 };
  }

  /** Executes a ShadowWire transfer to fulfil a single payment requirement. */
  async pay(requirement: X402PaymentRequirement): Promise<X402PaymentResult> {
    if (!isShadowwire(requirement.scheme)) return { success: false, error: new X402InvalidSchemeError(requirement.scheme).message };

    const amount = this.parseAmount(requirement.amount, requirement.asset);
    if (amount <= 0) return { success: false, error: 'Invalid payment amount' };

    try {
      const transfer = await this.client.transfer({
        sender: this.senderWallet,
        recipient: requirement.payTo,
        amount,
        token: this.resolveToken(requirement.asset),
        type: this.defaultTransferType,
        wallet: this.wallet,
      });

      if (!transfer.success) return { success: false, error: 'ShadowWire transfer failed' };

      const paymentHeader = X402Client.encodePaymentHeader({
        x402Version: 2,
        scheme: 'shadowwire',
        network: 'solana:mainnet',
        payload: {
          signature: transfer.tx_signature,
          amountHidden: transfer.amount_hidden,
          resource: requirement.resource,
          payTo: requirement.payTo,
          sender: this.senderWallet,
        },
      });

      return { success: true, transfer, paymentHeader };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async getBalance(token?: TokenSymbol): Promise<PoolBalance> {
    return this.client.getBalance(this.senderWallet, token || this.defaultToken);
  }

  estimateFee(amount: number, token?: TokenSymbol): { fee: number; feePercentage: number; netAmount: number } {
    return this.client.calculateFee(amount, token || this.defaultToken);
  }

  /** Parses a 402 response body into structured payment requirements, or null if invalid. */
  static parseRequirements(body: unknown): X402Response | null {
    if (!body || typeof body !== 'object') return null;
    const obj = body as Record<string, unknown>;
    if (!Array.isArray(obj.accepts)) return null;
    return obj as unknown as X402Response;
  }

  /** Returns true if the status is 402 and the body contains valid payment requirements. */
  static is402(status: number, body: unknown): boolean {
    return status === 402 && X402Client.parseRequirements(body) !== null;
  }

  /** Encodes a payment proof into a base64 string suitable for the X-Payment header. */
  static encodePaymentHeader(proof: X402PaymentProof): string {
    return toBase64(JSON.stringify(proof));
  }

  /** Decodes a base64 X-Payment header into a payment proof, or null if malformed. */
  static decodePaymentHeader(header: string): X402PaymentProof | null {
    try {
      if (byteLength(header) > MAX_PAYMENT_HEADER_BYTES) return null;
      const decoded = JSON.parse(fromBase64(header));
      if (decoded.x402Version !== 2) return null;
      if (!decoded.scheme || !decoded.payload?.signature) return null;
      return decoded as X402PaymentProof;
    } catch {
      return null;
    }
  }

  private findCompatibleRequirement(accepts: X402PaymentRequirement[]): X402PaymentRequirement | null {
    return accepts.find((r) => isShadowwire(r.scheme)) || null;
  }

  private parseAmount(amountStr: string, asset: string): number {
    const raw = parseInt(amountStr, 10);
    if (isNaN(raw) || raw <= 0) return 0;
    const token = this.resolveToken(asset);
    try {
      const { TokenUtils } = require('./tokens');
      return TokenUtils.fromSmallestUnit(raw, token);
    } catch {
      return raw / 1_000_000;
    }
  }

  private resolveToken(asset: string): TokenSymbol {
    const upper = asset?.toUpperCase?.() || '';
    try {
      const { TokenUtils } = require('./tokens');
      if (upper && TokenUtils.isValidToken(upper)) return upper as TokenSymbol;
    } catch {}
    return this.defaultToken;
  }

  private async doFetch(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await (globalThis as any).fetch(url, { ...options, signal: controller.signal });
    } catch (err: any) {
      if (err && (err.name === 'AbortError')) {
        throw new NetworkError(`x402 request timed out after ${this.timeoutMs}ms`);
      }
      throw new NetworkError(err instanceof Error ? `x402 request failed: ${err.message}` : 'x402 request failed');
    } finally {
      clearTimeout(timer);
    }
  }
}

async function safeParseBody<T>(response: Response): Promise<T | undefined> {
  try {
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

async function timedFetch(url: string, init: RequestInit, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await (globalThis as any).fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Builds a 402 response body for the given resource and middleware config. */
export function createPaymentRequired(resource: string, config: X402MiddlewareConfig): X402Response {
  const amount = Math.floor(config.amount * 1_000_000).toString();

  const accepts: X402PaymentRequirement[] = [
    {
      scheme: 'shadowwire',
      network: 'solana:mainnet',
      amount,
      asset: config.asset || 'USDC',
      payTo: config.payTo,
      resource,
      description: config.description,
      maxTimeoutSeconds: config.maxTimeoutSeconds || 60,
      extra: { transferTypes: ['internal', 'external'], amountHidden: true },
    },
  ];

  if (config.additionalSchemes) accepts.push(...config.additionalSchemes);

  return {
    x402Version: 2,
    accepts,
    error: 'Payment Required',
    facilitator: config.facilitatorUrl || DEFAULT_FACILITATOR_URL,
    resource: { url: resource, description: config.description, mimeType: 'application/json' },
  };
}

/** Sends a payment proof to the facilitator for verification. */
export async function verifyPayment(
  paymentHeader: string,
  requirement: X402PaymentRequirement,
  facilitatorUrl: string,
  apiKey?: string
): Promise<X402VerifyResult> {
  if (byteLength(paymentHeader) > MAX_PAYMENT_HEADER_BYTES) return { valid: false, error: new X402HeaderTooLargeError(byteLength(paymentHeader)).message };

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const verifyUrl = new URL('/verify', facilitatorUrl).toString();
    const res = await timedFetch(verifyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        paymentHeader,
        resource: requirement.resource,
        maxAmount: requirement.amount ? parseInt(requirement.amount, 10) / 1_000_000 : undefined,
      }),
    });

    if (!res.ok) {
      const errBody = await safeParseBody<{ error?: string }>(res);
      return { valid: false, error: new X402FacilitatorError(errBody?.error || `Facilitator returned ${res.status}`).message };
    }

    const data = (await safeParseBody<any>(res)) || {};
    return {
      valid: !!data.valid,
      payer: data.payer,
      amount: data.amount,
      resource: data.resource,
      balance: typeof data.balance === 'number' ? data.balance : undefined,
      sufficient: typeof data.sufficient === 'boolean' ? data.sufficient : undefined,
      error: data.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, error: new X402FacilitatorError(message).message };
  }
}

/** Settles a verified payment via the facilitator, finalising the transfer. */
export async function settlePayment(
  paymentHeader: string,
  requirement: X402PaymentRequirement,
  facilitatorUrl: string,
  apiKey?: string
): Promise<{ success: boolean; txHash?: string; amount?: number; fee?: number; net?: number; network?: string; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const amount = parseInt(requirement.amount, 10) / 1_000_000;

    const settleUrl = new URL('/settle', facilitatorUrl).toString();
    const res = await timedFetch(settleUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ paymentHeader, merchantWallet: requirement.payTo, amount, asset: requirement.asset || 'USDC' }),
    });

    if (!res.ok) {
      const errBody = await safeParseBody<{ error?: string }>(res);
      return { success: false, error: new X402FacilitatorError(errBody?.error || `Settlement returned ${res.status}`).message };
    }

    const data = (await safeParseBody<any>(res)) || {};
    return {
      success: !!data.success,
      txHash: data.txHash,
      amount: data.amount,
      fee: data.fee,
      net: data.net,
      network: data.network,
      error: data.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: new X402FacilitatorError(message).message };
  }
}

/** Express middleware that gates a route behind an x402 payment wall. */
export function x402Paywall(config: X402MiddlewareConfig) {
  return async (req: any, res: any, next: any) => {
    const resource = req.path || req.url || '/';
    const paymentHeader = (req.headers && (req.headers['x-payment'] || req.headers['X-Payment'])) as string | undefined;

    if (!paymentHeader) {
      const body = createPaymentRequired(resource, config);
      res.setHeader?.('WWW-Authenticate', 'X402');
      res.setHeader?.('X-Payment-Schemes', 'shadowwire');
      res.setHeader?.('Vary', PAYMENT_HEADER_NAME);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(402).json(body);
    }

    if (byteLength(paymentHeader) > MAX_PAYMENT_HEADER_BYTES) {
      return res.status(400).json({ error: new X402HeaderTooLargeError(byteLength(paymentHeader)).message });
    }

    const proof = X402Client.decodePaymentHeader(paymentHeader);
    if (!proof || !isShadowwire(proof.scheme)) {
      const body = createPaymentRequired(resource, config);
      (body as any).verifyError = 'Invalid or unsupported payment proof';
      res.setHeader?.('WWW-Authenticate', 'X402');
      res.setHeader?.('Vary', PAYMENT_HEADER_NAME);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(402).json(body);
    }

    const amount = Math.floor(config.amount * 1_000_000).toString();
    const requirement: X402PaymentRequirement = {
      scheme: 'shadowwire',
      network: 'solana:mainnet',
      amount,
      asset: config.asset || 'USDC',
      payTo: config.payTo,
      resource,
      description: config.description,
      maxTimeoutSeconds: config.maxTimeoutSeconds || 60,
    };

    if (proof.payload?.resource && proof.payload.resource !== resource) {
      const body = createPaymentRequired(resource, config);
      (body as any).verifyError = 'Payment proof resource mismatch';
      res.setHeader?.('WWW-Authenticate', 'X402');
      res.setHeader?.('Vary', PAYMENT_HEADER_NAME);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(402).json(body);
    }

    const facilitator = config.facilitatorUrl || DEFAULT_FACILITATOR_URL;

    const verifyResult = await verifyPayment(paymentHeader, requirement, facilitator, config.apiKey);

    if (!verifyResult.valid) {
      const body = createPaymentRequired(resource, config);
      (body as any).verifyError = verifyResult.error;
      res.setHeader?.('WWW-Authenticate', 'X402');
      res.setHeader?.('Vary', PAYMENT_HEADER_NAME);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(402).json(body);
    }

    const settleResult = await settlePayment(paymentHeader, requirement, facilitator, config.apiKey);
    if (!settleResult.success) {
      const body = createPaymentRequired(resource, config);
      (body as any).settleError = settleResult.error;
      res.setHeader?.('WWW-Authenticate', 'X402');
      res.setHeader?.('Vary', PAYMENT_HEADER_NAME);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(402).json(body);
    }

    req.x402 = {
      payer: verifyResult.payer,
      txHash: settleResult.txHash,
      amount: settleResult.amount,
      fee: settleResult.fee,
      net: settleResult.net,
      network: settleResult.network,
      scheme: 'shadowwire',
    };

    if (config.onPayment && verifyResult.payer && settleResult.txHash) {
      try {
        config.onPayment({ payer: verifyResult.payer, amount: config.amount, signature: settleResult.txHash, resource });
      } catch {
        // Don't block the request — callback errors are non-fatal
      }
    }

    next();
  };
}

export interface X402DiscoveryResource {
  path: string;
  method: string;
  price: number;
  asset?: string;
  description?: string;
}

/** Generates a `.well-known/x402` discovery document listing payable resources. */
export function createDiscoveryDocument(
  name: string,
  payTo: string,
  resources: X402DiscoveryResource[],
  options?: { description?: string; facilitatorUrl?: string }
): Record<string, unknown> {
  return {
    version: '2.0',
    name,
    description: options?.description,
    payTo,
    schemes: ['shadowwire'],
    networks: ['solana:mainnet'],
    facilitator: options?.facilitatorUrl || DEFAULT_FACILITATOR_URL,
    resources: resources.map((r) => ({
      path: r.path,
      method: r.method,
      price: r.price,
      asset: r.asset || 'USDC',
      description: r.description,
      schemes: ['shadowwire'],
    })),
    capabilities: {
      privatePayments: true,
      amountHiding: true,
      bulletproofs: true,
    },
  };
}
