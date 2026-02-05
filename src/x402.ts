// x402 (HTTP 402) payment protocol for ShadowWire.
// Spec: https://github.com/coinbase/x402

import { ShadowWireClient } from './client';
import { TokenSymbol, WalletAdapter, TransferResponse, PoolBalance } from './types';
import { NetworkError } from './errors';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_PAYMENT_HEADER_BYTES = 16_384;

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

export interface X402MiddlewareConfig {
  payTo: string;
  amount: number;
  asset?: TokenSymbol;
  description?: string;
  maxTimeoutSeconds?: number;
  facilitatorUrl: string;
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
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf-8').toString('base64');
  }
  return btoa(input);
}

function fromBase64(encoded: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  }
  return atob(encoded);
}

function byteLength(str: string): number {
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(str, 'utf-8');
  }
  return new TextEncoder().encode(str).length;
}

function isShadowwire(scheme: string): boolean {
  return scheme === 'shadowwire' || scheme === 'shadow';
}

export class X402Client {
  private client: ShadowWireClient;
  private wallet: WalletAdapter;
  private senderWallet: string;
  private defaultToken: TokenSymbol;
  private defaultTransferType: 'internal' | 'external';
  private maxRetries: number;
  private headers: Record<string, string>;
  private timeoutMs: number;

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

  async request<T = unknown>(url: string, options?: RequestInit): Promise<X402RequestResult<T>> {
    const mergedHeaders: Record<string, string> = {
      ...this.headers,
      ...(options?.headers as Record<string, string> || {}),
    };

    const response = await this.doFetch(url, { ...options, headers: mergedHeaders });

    if (response.status !== 402) {
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }
      const data = await safeParseBody<T>(response);
      return { success: true, data, statusCode: response.status };
    }

    const x402Body = await safeParseBody<X402Response>(response);
    if (!x402Body?.accepts || x402Body.accepts.length === 0) {
      return { success: false, error: 'No accepted payment methods in 402 response', statusCode: 402 };
    }

    const requirement = this.findCompatibleRequirement(x402Body.accepts);
    if (!requirement) {
      return { success: false, error: 'No compatible payment option (need Solana or ShadowWire)', statusCode: 402 };
    }

    const payResult = await this.pay(requirement);
    if (!payResult.success || !payResult.transfer || !payResult.paymentHeader) {
      return { success: false, error: payResult.error || 'Payment failed', statusCode: 402 };
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const retryResponse = await this.doFetch(url, {
        ...options,
        headers: { ...mergedHeaders, 'X-Payment': payResult.paymentHeader },
      });

      if (retryResponse.ok) {
        const data = await safeParseBody<T>(retryResponse);
        return {
          success: true,
          data,
          payment: { transfer: payResult.transfer, requirement },
          statusCode: retryResponse.status,
        };
      }

      if (retryResponse.status === 402) {
        return { success: false, error: 'Payment not accepted by server', statusCode: 402 };
      }

      if (attempt === this.maxRetries) {
        return {
          success: false,
          error: `HTTP ${retryResponse.status} after payment`,
          statusCode: retryResponse.status,
        };
      }
    }

    return { success: false, error: 'Unexpected error', statusCode: 500 };
  }

  async pay(requirement: X402PaymentRequirement): Promise<X402PaymentResult> {
    if (!isShadowwire(requirement.scheme)) {
      return { success: false, error: `Unsupported scheme: ${requirement.scheme}` };
    }

    const amount = this.parseAmount(requirement.amount, requirement.asset);
    if (amount <= 0) {
      return { success: false, error: 'Invalid payment amount' };
    }

    try {
      const transfer = await this.client.transfer({
        sender: this.senderWallet,
        recipient: requirement.payTo,
        amount,
        token: this.resolveToken(requirement.asset),
        type: this.defaultTransferType,
        wallet: this.wallet,
      });

      if (!transfer.success) {
        return { success: false, error: 'ShadowWire transfer failed' };
      }

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

  static parseRequirements(body: unknown): X402Response | null {
    if (!body || typeof body !== 'object') return null;
    const obj = body as Record<string, unknown>;
    if (!Array.isArray(obj.accepts)) return null;
    return obj as unknown as X402Response;
  }

  static is402(status: number, body: unknown): boolean {
    return status === 402 && X402Client.parseRequirements(body) !== null;
  }

  static encodePaymentHeader(proof: X402PaymentProof): string {
    return toBase64(JSON.stringify(proof));
  }

  static decodePaymentHeader(header: string): X402PaymentProof | null {
    try {
      if (byteLength(header) > MAX_PAYMENT_HEADER_BYTES) return null;
      const decoded = JSON.parse(fromBase64(header));
      if (!decoded.scheme || !decoded.payload?.signature) return null;
      return decoded as X402PaymentProof;
    } catch {
      return null;
    }
  }

  private findCompatibleRequirement(accepts: X402PaymentRequirement[]): X402PaymentRequirement | null {
    const shadowReq = accepts.find((r) => isShadowwire(r.scheme));
    if (shadowReq) return shadowReq;

    return accepts.find((r) => r.network?.includes('solana')) || null;
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
    const upper = asset.toUpperCase();
    try {
      const { TokenUtils } = require('./tokens');
      if (TokenUtils.isValidToken(upper)) return upper as TokenSymbol;
    } catch {}
    return this.defaultToken;
  }

  private async doFetch(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await (globalThis as any).fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new NetworkError(`x402 request timed out after ${this.timeoutMs}ms`);
      }
      throw new NetworkError(
        err instanceof Error ? `x402 request failed: ${err.message}` : 'x402 request failed'
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

async function safeParseBody<T>(response: Response): Promise<T | undefined> {
  const ct = response.headers?.get?.('content-type') || '';
  if (!ct.includes('application/json') && !ct.includes('text/json')) {
    try {
      return await response.json() as T;
    } catch {
      return undefined;
    }
  }
  return response.json() as Promise<T>;
}

async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await (globalThis as any).fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function createPaymentRequired(
  resource: string,
  config: X402MiddlewareConfig
): X402Response {
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
      extra: {
        transferTypes: ['internal', 'external'],
        amountHidden: true,
      },
    },
  ];

  if (config.additionalSchemes) {
    accepts.push(...config.additionalSchemes);
  }

  return {
    x402Version: 2,
    accepts,
    error: 'Payment Required',
    facilitator: config.facilitatorUrl,
    resource: {
      url: resource,
      description: config.description,
      mimeType: 'application/json',
    },
  };
}

export async function verifyPayment(
  paymentHeader: string,
  requirement: X402PaymentRequirement,
  facilitatorUrl: string,
  apiKey?: string
): Promise<X402VerifyResult> {
  if (byteLength(paymentHeader) > MAX_PAYMENT_HEADER_BYTES) {
    return { valid: false, error: 'Payment header exceeds size limit' };
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const response = await timedFetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        paymentHeader,
        resource: requirement.resource,
        maxAmount: requirement.amount ? parseInt(requirement.amount, 10) / 1_000_000 : undefined,
      }),
    });

    if (!response.ok) {
      const errBody = await safeParseBody<{ error?: string }>(response);
      return { valid: false, error: errBody?.error || `Facilitator returned ${response.status}` };
    }

    const data = await response.json() as {
      valid?: boolean;
      payer?: string;
      amount?: string;
      resource?: string;
      balance?: number;
      sufficient?: boolean;
      error?: string;
    };

    return {
      valid: !!data.valid,
      payer: data.payer,
      error: data.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, error: `Facilitator error: ${message}` };
  }
}

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

    const response = await timedFetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        paymentHeader,
        merchantWallet: requirement.payTo,
        amount,
        asset: requirement.asset || 'USDC',
      }),
    });

    if (!response.ok) {
      const errBody = await safeParseBody<{ error?: string }>(response);
      return { success: false, error: errBody?.error || `Settlement returned ${response.status}` };
    }

    const data = await response.json() as {
      success?: boolean;
      txHash?: string;
      amount?: number;
      fee?: number;
      net?: number;
      network?: string;
      error?: string;
    };

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
    return { success: false, error: `Settlement error: ${message}` };
  }
}

export function x402Paywall(config: X402MiddlewareConfig) {
  return async (req: any, res: any, next: any) => {
    const resource = req.path || req.url || '/';
    const paymentHeader = req.headers?.['x-payment'] as string | undefined;

    if (!paymentHeader) {
      const body = createPaymentRequired(resource, config);
      res.setHeader?.('WWW-Authenticate', 'X402');
      res.setHeader?.('X-Payment-Schemes', 'shadowwire');
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(402).json(body);
    }

    if (byteLength(paymentHeader) > MAX_PAYMENT_HEADER_BYTES) {
      return res.status(400).json({ error: 'Payment header too large' });
    }

    const proof = X402Client.decodePaymentHeader(paymentHeader);
    if (!proof || !isShadowwire(proof.scheme)) {
      const body = createPaymentRequired(resource, config);
      (body as any).verifyError = 'Invalid or unsupported payment proof';
      res.setHeader?.('WWW-Authenticate', 'X402');
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

    const verifyResult = await verifyPayment(paymentHeader, requirement, config.facilitatorUrl, config.apiKey);

    if (!verifyResult.valid) {
      const body = createPaymentRequired(resource, config);
      (body as any).verifyError = verifyResult.error;
      res.setHeader?.('WWW-Authenticate', 'X402');
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(402).json(body);
    }

    const settleResult = await settlePayment(paymentHeader, requirement, config.facilitatorUrl, config.apiKey);
    if (!settleResult.success) {
      const body = createPaymentRequired(resource, config);
      (body as any).settleError = settleResult.error;
      res.setHeader?.('WWW-Authenticate', 'X402');
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
      config.onPayment({
        payer: verifyResult.payer,
        amount: config.amount,
        signature: settleResult.txHash,
        resource,
      });
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

export function createDiscoveryDocument(
  name: string,
  payTo: string,
  resources: X402DiscoveryResource[],
  options?: {
    description?: string;
    facilitatorUrl?: string;
  }
): Record<string, unknown> {
  return {
    version: '2.0',
    name,
    description: options?.description,
    payTo,
    schemes: ['shadowwire', 'exact'],
    networks: ['solana:mainnet'],
    facilitator: options?.facilitatorUrl,
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
