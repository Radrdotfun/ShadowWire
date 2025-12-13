# Browser Setup Guide

This guide explains how to use the ShadowWire SDK in browser environments (React, Vue, Angular, vanilla JS, etc.).

## Prerequisites

- Modern browser with WebAssembly support
- Module bundler (Webpack, Vite, Rollup, etc.)
- The WASM file must be served by your web server

## Setup Steps

### 1. Install the Package

```bash
npm install @radr/shadowwire
```

### 2. Copy WASM Files to Your Public Directory

The WASM file needs to be accessible via HTTP. Copy it to your public/static directory:

#### For Vite:
```bash
# Copy to public directory
cp node_modules/@radr/shadowwire/dist/wasm/settler_wasm_bg.wasm public/wasm/
```

#### For Create React App:
```bash
# Copy to public directory
cp node_modules/@radr/shadowwire/dist/wasm/settler_wasm_bg.wasm public/wasm/
```

#### For Next.js:
```bash
# Copy to public directory
cp node_modules/@radr/shadowwire/dist/wasm/settler_wasm_bg.wasm public/wasm/
```

### 3. Configure Your Bundler

#### Vite Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  // Ensure WASM files are served correctly
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['@radr/shadowwire']
  }
});
```

#### Webpack Configuration

```javascript
// webpack.config.js
module.exports = {
  // ...
  experiments: {
    asyncWebAssembly: true,
  },
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: 'asset/resource',
      },
    ],
  },
};
```

#### Next.js Configuration

```javascript
// next.config.js
module.exports = {
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    
    return config;
  },
};
```

## Usage Examples

### React Example

```typescript
import { useEffect, useState } from 'react';
import { initWASM, generateRangeProof, verifyRangeProof, isWASMSupported } from '@radr/shadowwire';

function App() {
  const [initialized, setInitialized] = useState(false);
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      if (!isWASMSupported()) {
        setError('WebAssembly is not supported in your browser');
        return;
      }

      try {
        // Initialize with the path to your WASM file
        await initWASM('/wasm/settler_wasm_bg.wasm');
        setInitialized(true);
      } catch (err) {
        setError(`Failed to initialize: ${err.message}`);
      }
    }

    init();
  }, []);

  const handleGenerateProof = async () => {
    if (!initialized) return;

    setLoading(true);
    setError(null);

    try {
      const amount = 1000; // Amount to prove
      const proofData = await generateRangeProof(amount, 64);
      setProof(proofData);

      // Verify the proof
      const isValid = await verifyRangeProof(
        proofData.proofBytes,
        proofData.commitmentBytes,
        64
      );

      console.log('Proof valid:', isValid);
    } catch (err) {
      setError(`Failed to generate proof: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!initialized && !error) {
    return <div>Initializing ShadowWire...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>ShadowWire Private Transactions</h1>
      <button onClick={handleGenerateProof} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Proof'}
      </button>
      
      {proof && (
        <div>
          <h2>Proof Generated!</h2>
          <p>Proof: {proof.proofBytes.substring(0, 20)}...</p>
          <p>Commitment: {proof.commitmentBytes.substring(0, 20)}...</p>
        </div>
      )}
    </div>
  );
}

export default App;
```

### Vue Example

```vue
<template>
  <div>
    <h1>ShadowWire Private Transactions</h1>
    
    <div v-if="!initialized && !error">
      Initializing ShadowWire...
    </div>
    
    <div v-else-if="error">
      Error: {{ error }}
    </div>
    
    <div v-else>
      <button @click="generateProof" :disabled="loading">
        {{ loading ? 'Generating...' : 'Generate Proof' }}
      </button>
      
      <div v-if="proof">
        <h2>Proof Generated!</h2>
        <p>Proof: {{ proof.proofBytes.substring(0, 20) }}...</p>
        <p>Commitment: {{ proof.commitmentBytes.substring(0, 20) }}...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { initWASM, generateRangeProof, verifyRangeProof, isWASMSupported } from '@radr/shadowwire';

const initialized = ref(false);
const proof = ref(null);
const loading = ref(false);
const error = ref(null);

onMounted(async () => {
  if (!isWASMSupported()) {
    error.value = 'WebAssembly is not supported in your browser';
    return;
  }

  try {
    await initWASM('/wasm/settler_wasm_bg.wasm');
    initialized.value = true;
  } catch (err) {
    error.value = `Failed to initialize: ${err.message}`;
  }
});

async function generateProof() {
  if (!initialized.value) return;

  loading.value = true;
  error.value = null;

  try {
    const amount = 1000;
    const proofData = await generateRangeProof(amount, 64);
    proof.value = proofData;

    const isValid = await verifyRangeProof(
      proofData.proofBytes,
      proofData.commitmentBytes,
      64
    );

    console.log('Proof valid:', isValid);
  } catch (err) {
    error.value = `Failed to generate proof: ${err.message}`;
  } finally {
    loading.value = false;
  }
}
</script>
```

### Vanilla JavaScript Example

```javascript
import { initWASM, generateRangeProof, verifyRangeProof, isWASMSupported } from '@radr/shadowwire';

async function main() {
  // Check browser support
  if (!isWASMSupported()) {
    alert('Your browser does not support WebAssembly');
    return;
  }

  try {
    // Initialize WASM
    await initWASM('/wasm/settler_wasm_bg.wasm');
    console.log('✅ ShadowWire initialized');

    // Generate a proof
    const amount = 1000;
    const proof = await generateRangeProof(amount, 64);
    console.log('✅ Proof generated:', proof);

    // Verify the proof
    const isValid = await verifyRangeProof(
      proof.proofBytes,
      proof.commitmentBytes,
      64
    );
    console.log('✅ Proof valid:', isValid);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
```

## Common Issues and Solutions

### Issue: "Failed to fetch WASM"

**Solution:** Ensure the WASM file is copied to your public directory and the path in `initWASM()` matches where it's served.

```typescript
// Try different paths based on your setup
await initWASM('/wasm/settler_wasm_bg.wasm');
// or
await initWASM('./wasm/settler_wasm_bg.wasm');
// or
await initWASM('../wasm/settler_wasm_bg.wasm');
```

### Issue: "Module not found: fs"

**Solution:** This error occurs when the library is not properly bundled. Ensure you're using the refactored version (1.0.2+) which supports browsers.

### Issue: WASM file is too large

**Solution:** The WASM file will be around 2-3MB. Use gzip compression on your web server:

```nginx
# nginx configuration
gzip on;
gzip_types application/wasm;
```

### Issue: CORS errors when loading WASM

**Solution:** Ensure your web server serves WASM files with correct CORS headers:

```javascript
// Express.js example
app.use((req, res, next) => {
  if (req.url.endsWith('.wasm')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/wasm');
  }
  next();
});
```

## Performance Tips

1. **Initialize once**: Call `initWASM()` once when your app loads, not before every operation.

2. **Lazy load**: For better initial page load, initialize WASM only when needed:

```typescript
let shadowWireReady = null;

async function ensureShadowWire() {
  if (!shadowWireReady) {
    shadowWireReady = initWASM('/wasm/settler_wasm_bg.wasm');
  }
  return shadowWireReady;
}

// Use it
await ensureShadowWire();
const proof = await generateRangeProof(1000);
```

3. **Cache proofs**: If generating the same proof multiple times, cache the results.

4. **Web Workers**: For better UI performance, consider running proof generation in a Web Worker.

## Testing in Development

### Using a Local Server

Make sure your development server serves WASM files correctly:

```bash
# Vite (automatic)
npm run dev

# Python
python -m http.server 8000

# Node.js with http-server
npx http-server -p 8000
```

Then test in your browser at `http://localhost:8000`.

## Deployment Checklist

- [ ] WASM file is copied to public directory
- [ ] WASM file is included in build output
- [ ] Web server serves WASM with correct MIME type (`application/wasm`)
- [ ] CORS headers are configured if loading from different origin
- [ ] Gzip compression is enabled for WASM files
- [ ] Browser compatibility warning for old browsers

## Browser Support

- ✅ Chrome 57+
- ✅ Firefox 52+
- ✅ Safari 11+
- ✅ Edge 16+
- ❌ Internet Explorer (not supported)

## Need Help?

If you encounter issues with browser integration:

1. Check the browser console for error messages
2. Verify the WASM file is accessible (check Network tab)
3. Ensure you're using a modern browser with WebAssembly support
4. See the examples in the `examples/` directory
5. Open an issue on GitHub with your bundler configuration

## Example Projects

- `/examples/browser-usage.html` - Vanilla HTML/JS example
- `/examples/browser-webpack-example.ts` - Webpack/bundler example
- See our [GitHub repository](https://github.com/Radrdotfun/ShadowWire) for full React/Vue examples

