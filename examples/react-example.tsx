import React, { useState, useEffect } from 'react';
import {
  ShadowWireClient,
  initWASM,
  isWASMSupported,
  InsufficientBalanceError,
  RecipientNotFoundError,
} from '@radr/shadowwire';

interface PrivateTransferProps {
  userWallet: string;
}

export function PrivateTransfer({ userWallet }: PrivateTransferProps) {
  const [client] = useState(() => new ShadowWireClient());
  const [wasmInitialized, setWasmInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [transferType, setTransferType] = useState<'internal' | 'external'>('internal');
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      if (!isWASMSupported()) {
        setError('WebAssembly not supported');
        return;
      }

      try {
        await initWASM('/wasm/settler_wasm_bg.wasm');
        setWasmInitialized(true);
        await loadBalance();
      } catch (err: any) {
        setError('Initialization failed: ' + err.message);
      }
    }

    init();
  }, []);

  const loadBalance = async () => {
    try {
      const data = await client.getBalance(userWallet, 'SOL');
      setBalance(data.available / 1e9);
    } catch (err: any) {
      console.error('Balance load failed:', err);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wasmInitialized) {
      setError('WASM not initialized');
      return;
    }

    if (!recipient || !amount) {
      setError('Fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const amountNum = parseFloat(amount);
      
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Invalid amount');
      }

      const result = await client.transfer({
        sender: userWallet,
        recipient: recipient,
        amount: amountNum,
        token: 'SOL',
        type: transferType,
      });

      setSuccess('Transfer complete. Tx: ' + result.tx_signature?.substring(0, 8) + '...');
      await loadBalance();
      setRecipient('');
      setAmount('');
      
    } catch (err: any) {
      if (err instanceof RecipientNotFoundError) {
        setError('Recipient not found. Try external transfer.');
      } else if (err instanceof InsufficientBalanceError) {
        setError('Insufficient balance');
      } else {
        setError('Transfer failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!wasmInitialized && !error) {
    return (
      <div className="shadowwire-loading">
        <p>Initializing...</p>
      </div>
    );
  }

  return (
    <div className="shadowwire-transfer">
      <h2>Private Transfer</h2>
      
      {balance !== null && (
        <div className="balance-display">
          <p>Available: <strong>{balance.toFixed(4)} SOL</strong></p>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleTransfer}>
        <div className="form-group">
          <label htmlFor="recipient">Recipient</label>
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Solana address"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount (SOL)</label>
          <input
            id="amount"
            type="number"
            step="0.001"
            min="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.1"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label>Type</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="internal"
                checked={transferType === 'internal'}
                onChange={(e) => setTransferType(e.target.value as 'internal')}
                disabled={loading}
              />
              <span>Internal (Private)</span>
            </label>
            <label>
              <input
                type="radio"
                value="external"
                checked={transferType === 'external'}
                onChange={(e) => setTransferType(e.target.value as 'external')}
                disabled={loading}
              />
              <span>External (Visible)</span>
            </label>
          </div>
          <small>
            {transferType === 'internal'
              ? 'Amount hidden. Both users need ShadowWire accounts.'
              : 'Amount visible. Works with any Solana wallet.'}
          </small>
        </div>

        <button type="submit" disabled={loading || !wasmInitialized}>
          {loading ? 'Processing...' : 'Send'}
        </button>
      </form>

      <style jsx>{`
        .shadowwire-transfer {
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
        }
        .balance-display {
          background: #f0f9ff;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .alert {
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 15px;
        }
        .alert-error {
          background: #fee;
          color: #c00;
          border: 1px solid #fcc;
        }
        .alert-success {
          background: #efe;
          color: #060;
          border: 1px solid #cfc;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
        }
        input[type="text"],
        input[type="number"] {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
        }
        .radio-group {
          display: flex;
          gap: 20px;
          margin: 10px 0;
        }
        .radio-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: normal;
        }
        small {
          color: #666;
          font-size: 12px;
        }
        button {
          width: 100%;
          padding: 12px;
          background: #333;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
        button:hover:not(:disabled) {
          background: #555;
        }
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default PrivateTransfer;
