/**
 * React Example: Using ShadowWire SDK in a React Application
 * 
 * This demonstrates a complete React component that uses ShadowWire
 * for private transactions.
 * 
 * Setup:
 * 1. Copy WASM file: cp node_modules/@radr/shadowwire/dist/wasm/settler_wasm_bg.wasm public/wasm/
 * 2. Import and use this component
 */

import { useState, useEffect } from 'react';
import {
  ShadowWireClient,
  initWASM,
  generateRangeProof,
  isWASMSupported,
  InsufficientBalanceError,
  RecipientNotFoundError,
} from '@radr/shadowwire';

interface PrivateTransferProps {
  userWallet: string;
}

export function PrivateTransfer({ userWallet }: PrivateTransferProps) {
  const [client] = useState(() => new ShadowWireClient({ debug: true }));
  const [wasmInitialized, setWasmInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [transferType, setTransferType] = useState<'internal' | 'external'>('internal');
  const [balance, setBalance] = useState<number | null>(null);

  // Initialize WASM on component mount
  useEffect(() => {
    async function init() {
      if (!isWASMSupported()) {
        setError('WebAssembly is not supported in your browser. Please use a modern browser.');
        return;
      }

      try {
        // Initialize WASM with path to the WASM file in your public folder
        await initWASM('/wasm/settler_wasm_bg.wasm');
        setWasmInitialized(true);
        console.log('✅ ShadowWire WASM initialized');
        
        // Load balance
        await loadBalance();
      } catch (err: any) {
        setError(`Failed to initialize ShadowWire: ${err.message}`);
        console.error('Initialization error:', err);
      }
    }

    init();
  }, []);

  const loadBalance = async () => {
    try {
      const balanceData = await client.getBalance(userWallet, 'SOL');
      setBalance(balanceData.available / 1e9); // Convert lamports to SOL
    } catch (err: any) {
      console.error('Failed to load balance:', err);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wasmInitialized) {
      setError('WASM not initialized. Please wait...');
      return;
    }

    if (!recipient || !amount) {
      setError('Please fill in all fields');
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

      // Option 1: Simple transfer (backend generates proofs)
      // This is the easiest way - backend handles proof generation
      const result = await client.transfer({
        sender: userWallet,
        recipient: recipient,
        amount: amountNum,
        token: 'SOL',
        type: transferType,
      });

      // Option 2: Client-side proofs (maximum privacy)
      // Uncomment this if you want to generate proofs client-side
      /*
      const amountLamports = Math.floor(amountNum * 1e9);
      const proof = await generateRangeProof(amountLamports, 64);
      
      const result = await client.transferWithClientProofs({
        sender: userWallet,
        recipient: recipient,
        amount: amountNum,
        token: 'SOL',
        type: transferType,
        customProof: proof,
      });
      */

      setSuccess(
        `✅ Transfer successful! ${
          result.amount_hidden ? 'Amount is private' : 'Amount is visible'
        }. Tx: ${result.tx_signature?.substring(0, 8)}...`
      );
      
      // Reload balance
      await loadBalance();
      
      // Clear form
      setRecipient('');
      setAmount('');
      
    } catch (err: any) {
      if (err instanceof RecipientNotFoundError) {
        setError(
          'Recipient has not used ShadowWire yet. Try an external transfer instead, or ask them to deposit first.'
        );
      } else if (err instanceof InsufficientBalanceError) {
        setError('Insufficient balance. Please deposit more SOL first.');
      } else {
        setError(`Transfer failed: ${err.message}`);
      }
      console.error('Transfer error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!wasmInitialized && !error) {
    return (
      <div className="shadowwire-loading">
        <div className="spinner"></div>
        <p>Initializing ShadowWire...</p>
      </div>
    );
  }

  return (
    <div className="shadowwire-transfer">
      <h2>🔒 Private Transfer</h2>
      
      {balance !== null && (
        <div className="balance-display">
          <p>Available Balance: <strong>{balance.toFixed(4)} SOL</strong></p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          ❌ {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <form onSubmit={handleTransfer}>
        <div className="form-group">
          <label htmlFor="recipient">Recipient Wallet</label>
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Recipient's Solana address"
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
          <label>Transfer Type</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="internal"
                checked={transferType === 'internal'}
                onChange={(e) => setTransferType(e.target.value as 'internal')}
                disabled={loading}
              />
              <span>Internal (Private amount)</span>
            </label>
            <label>
              <input
                type="radio"
                value="external"
                checked={transferType === 'external'}
                onChange={(e) => setTransferType(e.target.value as 'external')}
                disabled={loading}
              />
              <span>External (Visible amount)</span>
            </label>
          </div>
          <small>
            {transferType === 'internal'
              ? 'Amount will be hidden. Both users must have ShadowWire accounts.'
              : 'Amount will be visible. Works with any Solana wallet.'}
          </small>
        </div>

        <button type="submit" disabled={loading || !wasmInitialized}>
          {loading ? (
            <>
              <span className="spinner-small"></span>
              {transferType === 'internal' ? 'Generating proof...' : 'Sending...'}
            </>
          ) : (
            'Send Transfer'
          )}
        </button>
      </form>

      <style jsx>{`
        .shadowwire-transfer {
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .shadowwire-loading {
          text-align: center;
          padding: 40px;
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
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        button:hover:not(:disabled) {
          background: #45a049;
        }
        
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        .spinner,
        .spinner-small {
          border: 2px solid #f3f3f3;
          border-top: 2px solid #555;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          margin: 0 auto 20px;
        }
        
        .spinner-small {
          width: 16px;
          height: 16px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default PrivateTransfer;

