# gSwap SDK API Alignment Status

Based on the [official gSwap SDK API reference](https://galachain.github.io/gswap-sdk/docs/api/), this document tracks what we've aligned and what differs.

## ✅ What We've Aligned

### 1. Token Format
- **SDK Format**: `'GALA|Unit|none|none'` (pipe-separated)
- **Our Format**: ✅ **FIXED** - Now uses `'GALA|Unit|none|none'` (pipe-separated)
- **Status**: ✅ **COMPLETE** - `formatTokenForV3()` updated to match SDK

### 2. Fee Tiers
- **SDK**: `FEE_TIER.PERCENT_01_00` (10000 = 1%)
- **Our Constants**: ✅ **MATCHES** - Same values:
  - `PERCENT_00_05` = 500 (0.05%)
  - `PERCENT_00_30` = 3000 (0.30%)
  - `PERCENT_01_00` = 10000 (1.00%)

### 3. API Base URL
- **SDK**: Uses `https://api-galaswap.gala.com` (2025 Gateway)
- **Our Config**: ✅ **FIXED** - Updated to `https://api-galaswap.gala.com`

## 🔄 Key Differences

### 1. Quote Method

#### SDK Approach
```typescript
// SDK automatically finds best fee tier
const quote = await gSwap.quoting.quoteExactInput(
  'GUSDC|Unit|none|none',
  'GALA|Unit|none|none',
  10 // Number
);
// Returns: { feeTier, outTokenAmount (BigNumber), ... }
```

#### Our Approach
```typescript
// Must specify fee tier manually
const quote = await galaDeFiApi.getQuote({
  tokenIn: 'GUSDC|Unit|none|none',
  tokenOut: 'GALA|Unit|none|none',
  amountIn: "10", // String
  fee: FEE_TIER.PERCENT_01_00, // Required
});
// Returns: { data: { amountOut: string, fee: number, ... } }
```

**Difference**: SDK automatically selects best fee tier; we must specify it.

### 2. Swap Method

#### SDK Approach
```typescript
// One-step with built-in monitoring
const pendingTx = await gSwap.swap(
  'GUSDC|Unit|none|none',
  'GALA|Unit|none|none',
  quote.feeTier, // From quote
  {
    exactIn: 10, // Number
    amountOutMinimum: quote.outTokenAmount.multipliedBy(0.95), // BigNumber
  },
  'eth|123...abc'
);

// Built-in transaction waiting
const result = await pendingTx.wait();
```

#### Our Approach
```typescript
// Two-step: generate payload → sign → bundle
const swap = await galaDeFiApi.executeSwap({
  tokenIn: tokenInObject, // Object, not string
  tokenOut: tokenOutObject,
  amountIn: "10", // String
  amountOut: quote.data.amountOut, // Must get from quote
  fee: FEE_TIER.PERCENT_01_00,
  sqrtPriceLimit: "0",
  amountInMaximum: "10",
  amountOutMinimum: "9.5",
});
// Returns: { transactionId, status: 'pending', timestamp }
// Manual transaction monitoring required
```

**Differences**:
- SDK: One-step, built-in monitoring
- Ours: Two-step, manual monitoring
- SDK: Uses numbers/BigNumbers
- Ours: Uses strings
- SDK: Simpler API
- Ours: More control over signing process

### 3. Amount Types

#### SDK
- Uses `number` for input amounts
- Returns `BigNumber` for output amounts
- Methods like `.multipliedBy()`, `.toNumber()`

#### Our Implementation
- Uses `string` for all amounts
- No BigNumber handling
- Manual string conversion

### 4. Transaction Monitoring

#### SDK
```typescript
const pendingTx = await gSwap.swap(...);
const result = await pendingTx.wait(); // Built-in
```

#### Our Implementation
```typescript
const swap = await galaDeFiApi.executeSwap(...);
// Returns immediately with transactionId
// Must manually poll for status
```

## 📊 Feature Comparison

| Feature | SDK | Our Implementation | Status |
|---------|-----|-------------------|--------|
| Token Format | `GALA\|Unit\|none\|none` | ✅ `GALA\|Unit\|none\|none` | ✅ Aligned |
| Fee Tiers | `FEE_TIER.PERCENT_01_00` | ✅ Same constants | ✅ Aligned |
| API Base URL | `api-galaswap.gala.com` | ✅ Updated | ✅ Aligned |
| Quote Method | `quoteExactInput()` | `getQuote()` | 🔄 Different API |
| Best Fee Tier | Auto-selects | Manual selection | 🔄 Different |
| Swap Method | `swap()` one-step | `executeSwap()` two-step | 🔄 Different |
| Amount Types | Number/BigNumber | String | 🔄 Different |
| Transaction Wait | Built-in `wait()` | Manual polling | 🔄 Different |
| Type Safety | Full TypeScript | Partial | 🔄 Different |

## 🎯 Recommendations

### For Current Use
✅ **Keep our implementation** - It's working and gives us full control

### For Future Migration
Consider SDK migration when:
1. You need automatic fee tier selection
2. You want simpler transaction monitoring
3. You prefer official SDK support
4. You want BigNumber handling built-in

### Hybrid Approach
You could use both:
- **SDK** for new DEX trading features
- **Raw API** for legacy order book features

## References

- [gSwap SDK API Reference](https://galachain.github.io/gswap-sdk/docs/api/)
- [SDK Migration Guide](./SDK_MIGRATION_GUIDE.md)
- [SDK Comparison](./GSWAP_SDK_COMPARISON.md)

