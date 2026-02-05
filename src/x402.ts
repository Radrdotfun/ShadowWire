/**
 * x402 Payment Protocol integration for ShadowWire.
 *
 * Implements the x402 (HTTP 402 Payment Required) spec with ShadowWire
 * private transfers. Includes both client-side (paying for APIs) and
 * server-side (protecting endpoints with paywalls) components.
 *
 * Payment flow:
 *   1. Client requests paid endpoint
 *   2. Server returns 402 with payment requirements (including shadowwire scheme)
 *   3. Client pays via ShadowWire (amount hidden via Bulletproofs)
 *   4. Client retries request with X-Payment header containing transfer proof
 *   5. Server verifies the ShadowWire transfer via facilitator and serves the resource
 *
 * Spec: https://github.com/coinbase/x402
 */

import { ShadowWireClient } from './client';
import { TokenSymbol, WalletAdapter, TransferResponse, PoolBalance } from './types';
import { NetworkError } from './errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
}

export interface X402VerifyResult {
  valid: boolean;
  payer?: string;
  signature?: string;
  amountHidden?: boolean;
  error?: string;
}

export interface X402MiddlewareConfig {
  payTo: string;
  amount: number;
  asset?: TokenSymbol;
  description?: string;
  maxTimeoutSeconds?: number;
  /** x402 facilitator URL for payment verification and settlement */
  facilitatorUrl: string;
  /** Additional accepted payment schemes alongside shadowwire */
  additionalSchemes?: X402PaymentRequirement[];
  /** Called after successful payment verification */
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

// ---------------------------------------------------------------------------
// Client (payer side)
// ---------------------------------------------------------------------------

export class X402Client {
  private client: ShadowWireClient;
  private wallet: WalletAdapter;
  private senderWallet: string;
  private defaultToken: TokenSymbol;
  private defaultTransferType: 'internal' | 'external';
  private maxRetries: number;
  private headers: Record<string, string>;

  constructor(config: X402ClientConfig) {
    this.client = config.client;
    this.wallet = config.wallet;
    this.senderWallet = config.senderWallet;
    this.defaultToken = config.defaultToken || 'USDC';
    this.defaultTransferType = config.defaultTransferType || 'external';
    this.maxRetries = config.maxRetries ?? 1;
    this.headers = config.headers || {};
  }

  /**
   * Make a request to a URL that may require x402 payment.
   * Handles the full flow: request -> 402 -> pay -> retry.
   */
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
      const data = await response.json() as T;
      return { success: true, data, statusCode: response.status };
    }

    const x402Body = await response.json() as X402Response;
    if (!x402Body.accepts || x402Body.accepts.length === 0) {
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
        const data = await retryResponse.json() as T;
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

  /**
   * Pay a specific x402 requirement via ShadowWire.
   */
  async pay(requirement: X402PaymentRequirement): Promise<X402PaymentResult> {
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

  /**
   * Check sender's shielded balance for a given token.
   */
  async getBalance(token?: TokenSymbol): Promise<PoolBalance> {
    return this.client.getBalance(this.senderWallet, token || this.defaultToken);
  }

  /**
   * Estimate the fee for a payment amount.
   */
  estimateFee(amount: number, token?: TokenSymbol): { fee: number; feePercentage: number; netAmount: number } {
    return this.client.calculateFee(amount, token || this.defaultToken);
  }

  // --- Static helpers ---

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
    return Buffer.from(JSON.stringify(proof)).toString('base64');
  }

  static decodePaymentHeader(header: string): X402PaymentProof | null {
    try {
      const decoded = JSON.parse(Buffer.from(header, 'base64').toString());
      if (!decoded.scheme || !decoded.payload?.signature) return null;
      return decoded as X402PaymentProof;
    } catch {
      return null;
    }
  }

  // --- Private ---

  private findCompatibleRequirement(accepts: X402PaymentRequirement[]): X402PaymentRequirement | null {
    const shadowReq = accepts.find((r) =>
      r.scheme === 'shadowwire' || r.scheme === 'shadow'
    );
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
    try {
      return await (globalThis as any).fetch(url, options);
    } catch (err) {
      throw new NetworkError(
        err instanceof Error ? `x402 request failed: ${err.message}` : 'x402 request failed'
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Server middleware (payee side)
// ---------------------------------------------------------------------------

/**
 * Create a 402 payment requirement response body.
 */
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

/**
 * Verify a payment via the configured x402 facilitator.
 * The facilitator handles ShadowWire transfer verification,
 * settlement, escrow, and dispute resolution.
 */
export async function verifyPayment(
  paymentHeader: string,
  requirement: X402PaymentRequirement,
  facilitatorUrl: string
): Promise<X402VerifyResult> {
  try {
    const response = await (globalThis as any).fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentHeader,
        paymentRequirements: requirement,
      }),
    });

    if (!response.ok) {
      return { valid: false, error: `Facilitator returned ${response.status}` };
    }

    const data = await response.json() as {
      isValid?: boolean;
      payer?: string;
      signature?: string;
      amountHidden?: boolean;
      invalidReason?: string;
    };

    return {
      valid: !!data.isValid,
      payer: data.payer,
      signature: data.signature,
      amountHidden: data.amountHidden,
      error: data.invalidReason,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, error: `Facilitator error: ${message}` };
  }
}

/**
 * Settle a verified payment via the facilitator.
 */
export async function settlePayment(
  paymentHeader: string,
  requirement: X402PaymentRequirement,
  facilitatorUrl: string
): Promise<{ success: boolean; tx?: string; error?: string }> {
  try {
    const response = await (globalThis as any).fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentHeader,
        paymentRequirements: requirement,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Settlement returned ${response.status}` };
    }

    const data = await response.json() as {
      success?: boolean;
      transaction?: string;
      error?: string;
    };

    return {
      success: !!data.success,
      tx: data.transaction,
      error: data.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Settlement error: ${message}` };
  }
}

/**
 * Express-compatible middleware factory.
 *
 * Protects routes with x402 payment requirements. Verification and
 * settlement are delegated to the configured facilitator.
 *
 * Usage:
 *   app.get('/api/data', x402Paywall({
 *     payTo: 'WALLET',
 *     amount: 0.01,
 *     facilitatorUrl: 'https://x402.kamiyo.ai',
 *   }), handler);
 */
export function x402Paywall(config: X402MiddlewareConfig) {
  return async (req: any, res: any, next: any) => {
    const resource = req.path || req.url || '/';
    const paymentHeader = req.headers?.['x-payment'] as string | undefined;

    if (!paymentHeader) {
      const body = createPaymentRequired(resource, config);
      res.setHeader?.('WWW-Authenticate', 'X402');
      res.setHeader?.('X-Payment-Schemes', 'shadowwire');
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

    const verifyResult = await verifyPayment(paymentHeader, requirement, config.facilitatorUrl);

    if (!verifyResult.valid) {
      const body = createPaymentRequired(resource, config);
      (body as any).verifyError = verifyResult.error;
      res.setHeader?.('WWW-Authenticate', 'X402');
      return res.status(402).json(body);
    }

    const settleResult = await settlePayment(paymentHeader, requirement, config.facilitatorUrl);
    if (!settleResult.success) {
      const body = createPaymentRequired(resource, config);
      (body as any).settleError = settleResult.error;
      res.setHeader?.('WWW-Authenticate', 'X402');
      return res.status(402).json(body);
    }

    req.x402 = {
      payer: verifyResult.payer,
      signature: verifyResult.signature,
      amountHidden: verifyResult.amountHidden,
      tx: settleResult.tx,
      scheme: 'shadowwire',
    };

    if (config.onPayment && verifyResult.payer && verifyResult.signature) {
      config.onPayment({
        payer: verifyResult.payer,
        amount: config.amount,
        signature: verifyResult.signature,
        resource,
      });
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Discovery document helper
// ---------------------------------------------------------------------------

export interface X402DiscoveryResource {
  path: string;
  method: string;
  price: number;
  asset?: string;
  description?: string;
}

/**
 * Generate a .well-known/x402 discovery document.
 */
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
