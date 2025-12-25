# gSwap SDK vs Current Implementation Comparison

Based on the [official gSwap SDK documentation](https://galachain.github.io/gswap-sdk/docs/tutorial-basics/trading), here are the key differences:

## Token Format ✅ FIXED

### SDK Format (Official)
```typescript
const GALA_TOKEN = 'GALA|Unit|none|none';  // Pipe-separated
const USDC_TOKEN = 'GUSDC|Unit|none|none';
```

### Our Current Format (Updated)
```typescript
formatTokenForV3() returns: 'GALA|Unit|none|none'  // Pipe-separated ✅
```

**Status**: ✅ **FIXED** - We've updated `formatTokenForV3()` to use pipe separator (`|`) matching the SDK format. The function also supports parsing both formats for backward compatibility.

## Swap API Differences

### SDK Approach (Simpler)
```typescript
// Exact Input Swap
await gSwap.swaps.swap(
  GALA_TOKEN,
  USDC_TOKEN,
  FEE_TIER.PERCENT_01_00,
  {
    exactIn: '100',              // Sell exactly 100 GALA
    amountOutMinimum: '45',       // Accept minimum 45 USDC
  },
  WALLET_ADDRESS,
);

// Exact Output Swap
await gSwap.swaps.swap(
  GALA_TOKEN,
  USDC_TOKEN,
  FEE_TIER.PERCENT_01_00,
  {
    exactOut: '50',               // Buy exactly 50 USDC
    amountInMaximum: '110',       // Maximum 110 GALA to sell
  },
  WALLET_ADDRESS,
);
```

### Our Current Approach (More Complex)
```typescript
await galaDeFiApi.executeSwap({
  tokenIn: { collection: "GALA", category: "Unit", type: "none", additionalKey: "none" },
  tokenOut: { collection: "GUSDC", category: "Unit", type: "none", additionalKey: "none" },
  amountIn: "100",
  amountOut: "45",                // From quote
  fee: FEE_TIER.PERCENT_01_00,
  sqrtPriceLimit: "0",           // Complex price limit
  amountInMaximum: "110",
  amountOutMinimum: "45",
});
```

## Transaction Monitoring

### SDK Approach
```typescript
const pendingTx = await gSwap.swaps.swap(...);
const result = await pendingTx.wait();  // Built-in waiting
```

### Our Current Approach
```typescript
const swap = await galaDeFiApi.executeSwap(...);
// Returns: { transactionId, status: 'pending', timestamp }
// Manual monitoring required
```

## What Matches ✅

1. **Fee Tiers**: Our `FEE_TIER` constants match the SDK:
   - `PERCENT_00_05` = 500 basis points (0.05%)
   - `PERCENT_00_30` = 3000 basis points (0.30%)
   - `PERCENT_01_00` = 10000 basis points (1.00%)

2. **Two-Step Process**: Both use generate payload → sign → bundle

3. **Quote Endpoint**: Both use `/v1/trade/quote` for price quotes

## Recommendations

### Option 1: Use Official SDK (Recommended)
Install and use `@gala-chain/gswap-sdk`:
```bash
npm install @gala-chain/gswap-sdk
```

**Pros**:
- Official, maintained by Gala
- Simpler API
- Built-in transaction monitoring
- Automatic updates

**Cons**:
- Requires refactoring existing code
- May have different error handling

### Option 2: Fix Token Format ✅ DONE
✅ **COMPLETED** - We've already updated `formatTokenForV3()` to use pipe separator. The token format now matches the SDK.

### Option 3: Add SDK-Compatible Wrapper
Create a wrapper that provides SDK-like interface while using our raw API calls.

## Next Steps

1. **Test token format**: Verify if API accepts `|` or `$` separator
2. **Check API responses**: See if current format works or causes errors
3. **Consider SDK migration**: Evaluate if switching to official SDK is worth it

## References

- [gSwap SDK Trading Guide](https://galachain.github.io/gswap-sdk/docs/tutorial-basics/trading)
- [gSwap SDK Documentation](https://galachain.github.io/gswap-sdk/docs)

