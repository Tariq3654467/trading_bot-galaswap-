# gSwap SDK Migration Guide

## Overview

The official [gSwap SDK](https://galachain.github.io/gswap-sdk) provides a simpler, more maintainable way to interact with GalaChain's DEX. This guide helps you decide whether to migrate from our current raw API implementation to the SDK.

## Current Status

✅ **Our Implementation**: Working raw API calls with two-step process (generate payload → sign → bundle)  
✅ **Token Format**: Fixed to match SDK (`GALA|Unit|none|none` - pipe-separated)  
✅ **API Endpoints**: Using correct 2025 endpoints (`/v1/trade/quote`, `/v1/trade/swap`, `/v1/trade/bundle`)

## SDK Benefits

### 1. Simpler API
```typescript
// SDK (Simple) - Reference: https://galachain.github.io/gswap-sdk/docs/api/
const quote = await gSwap.quoting.quoteExactInput(
  'GUSDC|Unit|none|none',
  'GALA|Unit|none|none',
  10 // Number, not string
);
// Returns: { feeTier, outTokenAmount (BigNumber), ... }

const pendingTx = await gSwap.swap(
  'GUSDC|Unit|none|none',
  'GALA|Unit|none|none',
  quote.feeTier, // Best fee tier from quote
  {
    exactIn: 10,
    amountOutMinimum: quote.outTokenAmount.multipliedBy(0.95), // 5% slippage
  },
  'eth|123...abc' // Wallet address
);

// Built-in transaction monitoring
const result = await pendingTx.wait();
```

### 2. Built-in Features
- ✅ Automatic transaction monitoring (`pendingTx.wait()`)
- ✅ Event socket connection management
- ✅ BigNumber handling for amounts
- ✅ Best fee tier selection
- ✅ Type safety with TypeScript

### 3. Official Support
- Maintained by Gala team
- Automatic updates
- Better documentation
- Community support

## Migration Steps

### Step 1: Install SDK
```bash
npm install @gala-chain/gswap-sdk
```

### Step 2: Update Imports
```typescript
// Old
import { GalaDeFiApi } from './dependencies/galadefi/galadefi_api.js';

// New
import { GSwap, PrivateKeySigner, FEE_TIER } from '@gala-chain/gswap-sdk';
```

### Step 3: Initialize SDK
```typescript
// In bot_main.ts
import { GSwap, PrivateKeySigner } from '@gala-chain/gswap-sdk';

// Connect to event socket (once globally)
await GSwap.events.connectEventSocket();

// Create SDK instance
const privateKey = process.env.GALA_PRIVATE_KEY!;
const walletAddress = process.env.GALA_WALLET_ADDRESS!;

const gSwap = new GSwap({
  signer: new PrivateKeySigner(privateKey),
});
```

### Step 4: Update Quote Logic
```typescript
// Old (Raw API)
const quote = await galaDeFiApi.getQuote({
  tokenIn: formatTokenForV3(tokenIn),
  tokenOut: formatTokenForV3(tokenOut),
  amountIn: "10",
  fee: FEE_TIER.PERCENT_01_00, // Must specify fee tier
});

// New (SDK) - Reference: https://galachain.github.io/gswap-sdk/docs/api/
const quote = await gSwap.quoting.quoteExactInput(
  'GUSDC|Unit|none|none',
  'GALA|Unit|none|none',
  10 // Number, not string - SDK finds best fee tier automatically
);
// quote.feeTier contains the best fee tier (automatically selected)
// quote.outTokenAmount is a BigNumber (use .toNumber() or .multipliedBy())
```

### Step 5: Update Swap Logic
```typescript
// Old (Raw API - Two-step: generate payload → sign → bundle)
const swap = await galaDeFiApi.executeSwap({
  tokenIn: tokenInObject,
  tokenOut: tokenOutObject,
  amountIn: "10",
  amountOut: quote.data.amountOut, // Must get from quote first
  fee: FEE_TIER.PERCENT_01_00, // Must specify
  sqrtPriceLimit: "0",
  amountInMaximum: "10",
  amountOutMinimum: "9.5",
});
// Returns: { transactionId, status: 'pending', timestamp }
// Manual transaction monitoring required

// New (SDK - One-step) - Reference: https://galachain.github.io/gswap-sdk/docs/api/
const pendingTx = await gSwap.swap(
  'GUSDC|Unit|none|none',
  'GALA|Unit|none|none',
  quote.feeTier, // Best fee tier from quote (automatically selected)
  {
    exactIn: 10, // Number, not string
    amountOutMinimum: quote.outTokenAmount.multipliedBy(0.95), // 5% slippage (BigNumber)
  },
  `eth|${walletAddress}`
);

// Built-in transaction monitoring (no manual polling needed)
const result = await pendingTx.wait();
console.log('Swap completed:', result.transactionId);
```

### Step 6: Update Strategy Code
```typescript
// In your strategy's doTick method
if (options.gSwap) { // Pass gSwap instance instead of galaDeFiApi
  try {
    // Get quote
    const quote = await options.gSwap.quoting.quoteExactInput(
      formatTokenForSDK(givingToken),
      formatTokenForSDK(receivingToken),
      parseFloat(amountToSell)
    );

    // Check if quote is favorable
    const minExpected = parseFloat(minExpectedAmount);
    if (quote.outTokenAmount.toNumber() >= minExpected) {
      // Execute swap
      const pendingTx = await options.gSwap.swap(
        formatTokenForSDK(givingToken),
        formatTokenForSDK(receivingToken),
        quote.feeTier,
        {
          exactIn: parseFloat(amountToSell),
          amountOutMinimum: quote.outTokenAmount.multipliedBy(0.95),
        },
        `eth|${ownWalletAddress}`
      );

      // Wait for completion
      const result = await pendingTx.wait();
      logger.info(`Swap completed: ${result.transactionId}`);
    }
  } catch (err) {
    logger.error({ message: 'Swap failed', err });
  }
}
```

## Helper Functions

### Token Format Conversion
```typescript
// Convert our token objects to SDK format
function formatTokenForSDK(token: ITokenClassKey): string {
  return `${token.collection}|${token.category}|${token.type}|${token.additionalKey}`;
}

// Parse SDK format back to our format
function parseTokenFromSDK(tokenString: string): ITokenClassKey {
  const [collection, category, type, additionalKey] = tokenString.split('|');
  return { collection, category, type, additionalKey };
}
```

## Considerations

### Pros of Migrating
- ✅ Simpler code
- ✅ Official support
- ✅ Automatic updates
- ✅ Built-in transaction monitoring
- ✅ Better error handling

### Cons of Migrating
- ❌ Requires refactoring existing code
- ❌ May lose some low-level control
- ❌ Need to test thoroughly
- ❌ SDK might not support all features we need

### Hybrid Approach
You could use both:
- **SDK** for new DEX trading (swaps, quotes)
- **Raw API** for legacy order book features (if still needed)

## Recommendation

**For New Features**: Use the SDK  
**For Existing Code**: Keep raw API until you have time to refactor  
**For Best of Both**: Create a wrapper that uses SDK internally but maintains our interface

## Testing After Migration

1. Test quote accuracy
2. Test swap execution
3. Test transaction monitoring
4. Test error handling
5. Test with different fee tiers
6. Test slippage protection

## References

- [gSwap SDK Documentation](https://galachain.github.io/gswap-sdk)
- [SDK Trading Guide](https://galachain.github.io/gswap-sdk/docs/tutorial-basics/trading)
- [SDK API Reference](https://galachain.github.io/gswap-sdk/docs/api-reference)

