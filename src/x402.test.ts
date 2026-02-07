import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  X402Client,
  x402Paywall,
  createPaymentRequired,
  verifyPayment,
  settlePayment,
  createDiscoveryDocument,
  X402PaymentProof,
  X402PaymentRequirement,
  X402MiddlewareConfig,
} from './x402';

function mockResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    ok: ok ?? (status >= 200 && status < 300),
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Response;
}

function validProof(): X402PaymentProof {
  return {
    x402Version: 2,
    scheme: 'shadowwire',
    network: 'solana:mainnet',
    payload: {
      signature: 'abc123sig',
      amountHidden: true,
      resource: '/api/data',
      payTo: 'merchant_wallet',
      sender: 'sender_wallet',
    },
  };
}

function baseRequirement(overrides?: Partial<X402PaymentRequirement>): X402PaymentRequirement {
  return {
    scheme: 'shadowwire',
    network: 'solana:mainnet',
    amount: '10000',
    asset: 'USDC',
    payTo: 'merchant_wallet',
    resource: '/api/data',
    ...overrides,
  };
}

function middlewareConfig(overrides?: Partial<X402MiddlewareConfig>): X402MiddlewareConfig {
  return {
    payTo: 'merchant_wallet',
    amount: 0.01,
    asset: 'USDC',
    description: 'Test endpoint',
    facilitatorUrl: 'https://facilitator.test',
    apiKey: 'test-key',
    ...overrides,
  };
}

function mockReq(headers: Record<string, string> = {}, path = '/api/data') {
  return { headers, path, url: path };
}

function mockRes() {
  const res: any = {
    _status: 0,
    _body: null,
    _headers: {} as Record<string, string>,
    status(code: number) { res._status = code; return res; },
    json(body: unknown) { res._body = body; return res; },
    setHeader(k: string, v: string) { res._headers[k] = v; },
  };
  return res;
}

describe('encodePaymentHeader / decodePaymentHeader', () => {
  it('round-trips a valid proof', () => {
    const proof = validProof();
    const encoded = X402Client.encodePaymentHeader(proof);
    const decoded = X402Client.decodePaymentHeader(encoded);
    expect(decoded).toEqual(proof);
  });

  it('returns null for malformed base64', () => {
    expect(X402Client.decodePaymentHeader('not!valid!base64!!!')).toBeNull();
  });

  it('returns null for valid base64 but invalid JSON', () => {
    const encoded = Buffer.from('not json', 'utf-8').toString('base64');
    expect(X402Client.decodePaymentHeader(encoded)).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    const partial = { x402Version: 2, network: 'solana:mainnet' };
    const encoded = Buffer.from(JSON.stringify(partial), 'utf-8').toString('base64');
    expect(X402Client.decodePaymentHeader(encoded)).toBeNull();
  });

  it('returns null for wrong x402Version', () => {
    const wrongVersion = { ...validProof(), x402Version: 1 };
    const encoded = Buffer.from(JSON.stringify(wrongVersion), 'utf-8').toString('base64');
    expect(X402Client.decodePaymentHeader(encoded)).toBeNull();
  });

  it('returns null for oversized header', () => {
    const huge = Buffer.from('x'.repeat(20_000), 'utf-8').toString('base64');
    expect(X402Client.decodePaymentHeader(huge)).toBeNull();
  });
});

describe('X402Client.request()', () => {
  let client: X402Client;
  let mockTransfer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTransfer = vi.fn();
    const shadowClient = { transfer: mockTransfer, getBalance: vi.fn(), calculateFee: vi.fn() } as any;
    client = new X402Client({
      client: shadowClient,
      wallet: { signMessage: vi.fn() } as any,
      senderWallet: 'sender_wallet',
    });
  });

  it('passes through non-402 successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { ok: true })));
    const result = await client.request('https://api.test/data');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
    expect(result.statusCode).toBe(200);
    vi.unstubAllGlobals();
  });

  it('returns error for non-402, non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(500, null, false)));
    const result = await client.request('https://api.test/data');
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    vi.unstubAllGlobals();
  });

  it('handles 402 → pay → retry flow', async () => {
    const x402Body = {
      x402Version: 2,
      accepts: [baseRequirement()],
    };

    mockTransfer.mockResolvedValue({
      success: true,
      tx_signature: 'sig123',
      amount_hidden: true,
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse(402, x402Body, false))
      .mockResolvedValueOnce(mockResponse(200, { premium: true }));

    vi.stubGlobal('fetch', fetchMock);
    const result = await client.request('https://api.test/data');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ premium: true });
    expect(result.payment?.transfer.tx_signature).toBe('sig123');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('returns error when no compatible scheme is found', async () => {
    const x402Body = {
      x402Version: 2,
      accepts: [baseRequirement({ scheme: 'stripe' })],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(402, x402Body, false)));
    const result = await client.request('https://api.test/data');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No compatible');
    vi.unstubAllGlobals();
  });

  it('returns error when transfer fails', async () => {
    const x402Body = {
      x402Version: 2,
      accepts: [baseRequirement()],
    };

    mockTransfer.mockResolvedValue({ success: false });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(402, x402Body, false)));
    const result = await client.request('https://api.test/data');
    expect(result.success).toBe(false);
    expect(result.error).toContain('transfer failed');
    vi.unstubAllGlobals();
  });

  it('returns error for 402 with empty accepts array', async () => {
    const x402Body = { x402Version: 2, accepts: [] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(402, x402Body, false)));
    const result = await client.request('https://api.test/data');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No accepted payment');
    vi.unstubAllGlobals();
  });
});

describe('X402Client.pay()', () => {
  let client: X402Client;
  let mockTransfer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTransfer = vi.fn();
    const shadowClient = { transfer: mockTransfer, getBalance: vi.fn(), calculateFee: vi.fn() } as any;
    client = new X402Client({
      client: shadowClient,
      wallet: { signMessage: vi.fn() } as any,
      senderWallet: 'sender_wallet',
    });
  });

  it('rejects unsupported payment schemes', async () => {
    const result = await client.pay(baseRequirement({ scheme: 'stripe' }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported x402 payment scheme');
    expect(mockTransfer).not.toHaveBeenCalled();
  });

  it('rejects invalid amount', async () => {
    const result = await client.pay(baseRequirement({ amount: '0' }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid payment amount');
    expect(mockTransfer).not.toHaveBeenCalled();
  });

  it('catches transfer exceptions', async () => {
    mockTransfer.mockRejectedValue(new Error('rpc down'));
    const result = await client.pay(baseRequirement({ amount: '1000000' }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('rpc down');
  });
});

describe('X402Client static helpers', () => {
  it('parseRequirements returns null for non-objects', () => {
    expect(X402Client.parseRequirements(null)).toBeNull();
    expect(X402Client.parseRequirements('string')).toBeNull();
    expect(X402Client.parseRequirements(42)).toBeNull();
  });

  it('parseRequirements returns null when accepts is not an array', () => {
    expect(X402Client.parseRequirements({ accepts: 'not-array' })).toBeNull();
    expect(X402Client.parseRequirements({ x402Version: 2 })).toBeNull();
  });

  it('is402 returns true only for 402 with valid body', () => {
    const validBody = { x402Version: 2, accepts: [baseRequirement()] };
    expect(X402Client.is402(402, validBody)).toBe(true);
    expect(X402Client.is402(200, validBody)).toBe(false);
    expect(X402Client.is402(402, {})).toBe(false);
  });
});

describe('x402Paywall middleware', () => {
  it('returns 402 when no payment header is present', async () => {
    const mw = x402Paywall(middlewareConfig());
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(res._status).toBe(402);
    expect(res._body.accepts).toBeDefined();
    expect(res._body.accepts[0].scheme).toBe('shadowwire');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 for oversized payment header', async () => {
    const mw = x402Paywall(middlewareConfig());
    const hugeHeader = 'x'.repeat(20_000);
    const req = mockReq({ 'x-payment': hugeHeader });
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(res._status).toBe(400);
    expect(res._body.error).toContain('exceeds size limit');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 402 for resource mismatch in proof', async () => {
    const mismatchProof = validProof();
    mismatchProof.payload.resource = '/api/other';
    const header = X402Client.encodePaymentHeader(mismatchProof);
    const mw = x402Paywall(middlewareConfig());
    const req = mockReq({ 'x-payment': header }, '/api/data');
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(res._status).toBe(402);
    expect(res._body.verifyError).toContain('resource mismatch');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 402 for invalid/unsupported scheme in proof', async () => {
    const badProof = { ...validProof(), scheme: 'stripe' };
    const header = X402Client.encodePaymentHeader(badProof as X402PaymentProof);
    const mw = x402Paywall(middlewareConfig());
    const req = mockReq({ 'x-payment': header });
    const res = mockRes();
    const next = vi.fn();

    await mw(req, res, next);
    expect(res._status).toBe(402);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() on valid payment verification and settlement', async () => {
    const header = X402Client.encodePaymentHeader(validProof());
    const mw = x402Paywall(middlewareConfig());
    const req = mockReq({ 'x-payment': header });
    const res = mockRes();
    const next = vi.fn();

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockResponse(200, { valid: true, payer: 'sender_wallet', amount: '10000', resource: '/api/data' }))
      .mockResolvedValueOnce(mockResponse(200, { success: true, txHash: 'tx123', amount: 0.01, fee: 0.001, net: 0.009, network: 'solana:mainnet' })));

    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.x402).toBeDefined();
    expect(req.x402.txHash).toBe('tx123');
    vi.unstubAllGlobals();
  });

  it('calls next() even if onPayment callback throws', async () => {
    const header = X402Client.encodePaymentHeader(validProof());
    const mw = x402Paywall(middlewareConfig({
      onPayment: () => { throw new Error('callback boom'); },
    }));
    const req = mockReq({ 'x-payment': header });
    const res = mockRes();
    const next = vi.fn();

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockResponse(200, { valid: true, payer: 'sender_wallet', amount: '10000', resource: '/api/data' }))
      .mockResolvedValueOnce(mockResponse(200, { success: true, txHash: 'tx123', amount: 0.01, fee: 0.001, net: 0.009, network: 'solana:mainnet' })));

    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('createPaymentRequired', () => {
  it('returns correct shape with default values', () => {
    const body = createPaymentRequired('/api/data', middlewareConfig());
    expect(body.x402Version).toBe(2);
    expect(body.accepts).toHaveLength(1);
    expect(body.accepts[0].scheme).toBe('shadowwire');
    expect(body.accepts[0].asset).toBe('USDC');
    expect(body.accepts[0].payTo).toBe('merchant_wallet');
    expect(body.facilitator).toBe('https://facilitator.test');
  });

  it('includes additional schemes when provided', () => {
    const extra: X402PaymentRequirement = baseRequirement({ scheme: 'lightning', network: 'bitcoin' });
    const body = createPaymentRequired('/api/data', middlewareConfig({ additionalSchemes: [extra] }));
    expect(body.accepts).toHaveLength(2);
    expect(body.accepts[1].scheme).toBe('lightning');
  });
});

describe('verifyPayment', () => {
  it('returns valid result on facilitator success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, { valid: true, payer: 'sender', amount: '10000', resource: '/api/data' })
    ));

    const result = await verifyPayment('header', baseRequirement(), 'https://facilitator.test', 'key');
    expect(result.valid).toBe(true);
    expect(result.payer).toBe('sender');
    vi.unstubAllGlobals();
  });

  it('returns invalid on facilitator rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(403, { error: 'Invalid signature' }, false)
    ));

    const result = await verifyPayment('header', baseRequirement(), 'https://facilitator.test');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid signature');
    vi.unstubAllGlobals();
  });

  it('returns invalid on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await verifyPayment('header', baseRequirement(), 'https://facilitator.test');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
    vi.unstubAllGlobals();
  });

  it('short-circuits on oversized header', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifyPayment('x'.repeat(20_000), baseRequirement(), 'https://facilitator.test');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds size limit');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('settlePayment', () => {
  it('returns success on facilitator settlement', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, { success: true, txHash: 'tx456', amount: 0.01, fee: 0.001, net: 0.009, network: 'solana:mainnet' })
    ));

    const result = await settlePayment('header', baseRequirement(), 'https://facilitator.test', 'key');
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('tx456');
    vi.unstubAllGlobals();
  });

  it('returns failure on facilitator rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(400, { error: 'Already settled' }, false)
    ));

    const result = await settlePayment('header', baseRequirement(), 'https://facilitator.test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already settled');
    vi.unstubAllGlobals();
  });

  it('returns failure on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

    const result = await settlePayment('header', baseRequirement(), 'https://facilitator.test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
    vi.unstubAllGlobals();
  });
});

describe('createDiscoveryDocument', () => {
  it('returns correct shape with defaults', () => {
    const doc = createDiscoveryDocument('My API', 'merchant_wallet', [
      { path: '/api/data', method: 'GET', price: 0.01, description: 'Premium data' },
    ]);

    expect(doc.version).toBe('2.0');
    expect(doc.name).toBe('My API');
    expect(doc.payTo).toBe('merchant_wallet');
    expect(doc.schemes).toEqual(['shadowwire']);
    expect(doc.networks).toEqual(['solana:mainnet']);
    expect((doc.resources as any[])).toHaveLength(1);
    expect((doc.resources as any[])[0].asset).toBe('USDC');
    expect((doc.capabilities as any).privatePayments).toBe(true);
  });

  it('includes facilitatorUrl from options', () => {
    const doc = createDiscoveryDocument('API', 'wallet', [], {
      facilitatorUrl: 'https://facilitator.test',
      description: 'Test API',
    });

    expect(doc.facilitator).toBe('https://facilitator.test');
    expect(doc.description).toBe('Test API');
  });
});
