# GalaDeFi DEX Trading Integration

This bot now supports the new Gala DeFi DEX API endpoints for high-frequency trading (HFT) and direct liquidity pool swaps.

## Overview

The GalaDeFi API provides:
- **Direct swaps** against DEX liquidity pools (faster than order book)
- **Real-time price quotes** for trading pairs
- **Liquidity management** (add/remove liquidity)
- **Market data** from oracle/pool prices

## Setup

### 1. Enable GalaDeFi API

Add these to your `.env` file:

```bash
# Enable GalaDeFi DEX API
GALADEFI_ENABLED=true

# Optional: Custom API base URL (default: https://dex-backend-prod1.defi.gala.com)
# GALADEFI_API_BASE_URI=https://dex-backend-prod1.defi.gala.com
```

### 2. Use Same Wallet Credentials

The GalaDeFi API uses the same wallet credentials as GalaSwap:
- `GALA_WALLET_ADDRESS`
- `GALA_PRIVATE_KEY`

## API Endpoints

### Trading Endpoints

#### Get Trading Pairs
```typescript
const pairs = await galaDeFiApi.getTradingPairs();
// Returns: Array of trading pairs with liquidity info
```

#### Get Price Quote
```typescript
const quote = await galaDeFiApi.getQuote({
  tokenIn: {
    collection: "GALA",
    category: "Unit",
    type: "none",
    additionalKey: "none"
  },
  tokenOut: {
    collection: "GUSDC",
    category: "Unit",
    type: "none",
    additionalKey: "none"
  },
  amountIn: "1000",
  slippageTolerance: 0.01 // Optional: 1% slippage
});
// Returns: Quote with amountOut, priceImpact, route, etc.
```

#### Execute Swap
```typescript
const swap = await galaDeFiApi.executeSwap({
  tokenIn: {
    collection: "GALA",
    category: "Unit",
    type: "none",
    additionalKey: "none"
  },
  tokenOut: {
    collection: "GUSDC",
    category: "Unit",
    type: "none",
    additionalKey: "none"
  },
  amountIn: "1000",
  amountOutMin: "950", // Optional: Minimum output (slippage protection)
  slippageTolerance: 0.01, // Optional: 1% slippage
  recipient: "0x...", // Optional: Defaults to your wallet
  deadline: Math.floor(Date.now() / 1000) + 3600 // Optional: Defaults to 1 hour
});
// Returns: Swap transaction with hash and status
```

### Market Data

#### Get Market Prices
```typescript
const prices = await galaDeFiApi.getMarketPrices();
// Returns: Array of token prices with 24h change and volume
```

### Liquidity Management

#### Add Liquidity
```typescript
const result = await galaDeFiApi.addLiquidity({
  tokenA: {
    collection: "GALA",
    category: "Unit",
    type: "none",
    additionalKey: "none"
  },
  tokenB: {
    collection: "GUSDC",
    category: "Unit",
    type: "none",
    additionalKey: "none"
  },
  amountA: "1000",
  amountB: "50",
  amountAMin: "950", // Optional: Slippage protection
  amountBMin: "47.5", // Optional: Slippage protection
  deadline: Math.floor(Date.now() / 1000) + 3600 // Optional
});
```

#### Remove Liquidity
```typescript
const result = await galaDeFiApi.removeLiquidity({
  tokenA: {
    collection: "GALA",
    category: "Unit",
    type: "none",
    additionalKey: "none"
  },
  tokenB: {
    collection: "GUSDC",
    category: "Unit",
    type: "none",
    additionalKey: "none"
  },
  liquidity: "100",
  amountAMin: "950", // Optional: Minimum output
  amountBMin: "47.5", // Optional: Minimum output
  deadline: Math.floor(Date.now() / 1000) + 3600 // Optional
});
```

### Balance Check

#### Get Balances
```typescript
const balances = await galaDeFiApi.getBalances();
// Returns: Array of token balances (available, locked)
```

## Usage in Strategies

The `galaDeFiApi` is available in the tick loop options:

```typescript
// In your strategy's doTick method
if (options.galaDeFiApi) {
  try {
    // Get a quote first
    const quote = await options.galaDeFiApi.getQuote({
      tokenIn: givingTokenClass,
      tokenOut: receivingTokenClass,
      amountIn: "1000",
      slippageTolerance: 0.01
    });

    // Check if the quote is favorable
    if (quote.amountOut > minExpectedAmount) {
      // Execute the swap
      const swap = await options.galaDeFiApi.executeSwap({
        tokenIn: givingTokenClass,
        tokenOut: receivingTokenClass,
        amountIn: "1000",
        amountOutMin: quote.amountOut * 0.99, // 1% slippage protection
        slippageTolerance: 0.01
      });

      logger.info(`GalaDeFi swap executed: ${swap.transactionHash}`);
    }
  } catch (err) {
    logger.error({ message: 'GalaDeFi swap failed', err });
  }
}
```

## Token Class Format

All endpoints require token class objects. Common tokens:

```typescript
// GALA
{
  collection: "GALA",
  category: "Unit",
  type: "none",
  additionalKey: "none"
}

// GUSDC
{
  collection: "GUSDC",
  category: "Unit",
  type: "none",
  additionalKey: "none"
}

// GUSDT
{
  collection: "GUSDT",
  category: "Unit",
  type: "none",
  additionalKey: "none"
}
```

## Advantages of GalaDeFi DEX

1. **Faster Execution**: Direct swaps against liquidity pools (no order matching)
2. **Better Liquidity**: Access to pooled liquidity
3. **Price Quotes**: Real-time quotes with price impact analysis
4. **Slippage Protection**: Built-in slippage tolerance
5. **Route Optimization**: Automatic route finding for best prices

## Comparison: GalaSwap vs GalaDeFi

| Feature | GalaSwap (v1) | GalaDeFi (DEX) |
|---------|---------------|----------------|
| **Type** | Order Book | Liquidity Pools |
| **Speed** | Slower (order matching) | Faster (direct swap) |
| **Liquidity** | User orders | Pooled liquidity |
| **Price Discovery** | Manual orders | Automated quotes |
| **Use Case** | P2P trading | HFT, arbitrage |

## Best Practices

1. **Always get a quote first** before executing a swap
2. **Set slippage tolerance** to protect against price movements
3. **Use amountOutMin** for additional protection
4. **Check price impact** - high impact may indicate low liquidity
5. **Monitor transaction status** after execution

## Error Handling

The API includes comprehensive error handling:
- Automatic retries for transient errors
- Rate limit handling
- Error code parsing
- Detailed error messages

## Example: Complete Trading Flow

```typescript
async function executeGalaDeFiTrade(
  galaDeFiApi: IGalaDeFiApi,
  tokenIn: ITokenClassKey,
  tokenOut: ITokenClassKey,
  amountIn: string
) {
  try {
    // 1. Get quote
    const quote = await galaDeFiApi.getQuote({
      tokenIn,
      tokenOut,
      amountIn,
      slippageTolerance: 0.01
    });

    console.log(`Quote: ${amountIn} ${tokenIn.collection} -> ${quote.amountOut} ${tokenOut.collection}`);
    console.log(`Price Impact: ${quote.priceImpact}%`);

    // 2. Check if quote is acceptable
    if (parseFloat(quote.priceImpact || "0") > 5) {
      throw new Error("Price impact too high (>5%)");
    }

    // 3. Execute swap with slippage protection
    const swap = await galaDeFiApi.executeSwap({
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMin: (parseFloat(quote.amountOut) * 0.99).toString(), // 1% slippage
      slippageTolerance: 0.01
    });

    console.log(`Swap executed: ${swap.transactionHash}`);
    console.log(`Status: ${swap.status}`);

    return swap;
  } catch (err) {
    console.error("GalaDeFi trade failed:", err);
    throw err;
  }
}
```

## Integration with Existing Systems

The GalaDeFi API works alongside:
- **GalaSwap API** (order book trading)
- **Binance API** (external exchange)
- **Price aggregator** (combines all price sources)

You can use all three simultaneously for maximum trading opportunities!

