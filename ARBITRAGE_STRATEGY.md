# Spatial Arbitrage Strategy

## Overview

The bot now includes a **Spatial Arbitrage Strategy** that finds and executes profitable arbitrage opportunities between GalaSwap and Binance.

## How It Works

### Goal
Net a profit of 10-30 GALA by exploiting price differences between exchanges.

### Strategy Flow

1. **Price Discovery**
   - Get GALA/ETH price on GalaSwap (via gSwap SDK)
   - Get GALA/USDT and ETH/USDT prices on Binance

2. **Calculate Spread**
   - Sell 8,000 GALA on GalaSwap → Receive GWETH
   - Convert GWETH value to ETH value (1:1 ratio)
   - Calculate how much GALA can be bought on Binance with that ETH value

3. **Profit Check**
   - Calculate: `(GALA received on Binance) - (GALA sold on GalaSwap) - (All Fees)`
   - Fees include:
     - GalaSwap fee: 0.3% of GALA amount
     - Binance trading fee: 0.1% of trade value
     - Gas fee: ~5 GALA (estimated)

4. **Execution**
   - If profit >= 20 GALA: Execute both trades simultaneously
   - Step 1: Sell GALA for GWETH on GalaSwap
   - Step 2: Buy GALA with ETH on Binance (using GALAETH pair)

## Configuration

### Current Settings

```typescript
GALA_AMOUNT = 8000;           // Amount of GALA to trade
MIN_PROFIT_GALA = 20;         // Minimum profit in GALA to execute
MAX_PROFIT_GALA = 30;         // Maximum expected profit
BINANCE_FEE_RATE = 0.001;     // 0.1% trading fee
GALA_SWAP_FEE_RATE = 0.003;   // 0.3% swap fee
GAS_FEE_GALA = 5;             // Estimated gas fee
```

### Check Interval

The arbitrage strategy checks for opportunities every **60 seconds** to avoid excessive API calls.

## Requirements

### Dependencies
- ✅ `binanceApi`: For getting Binance prices and executing trades
- ✅ `binanceTrading`: For executing Binance trades
- ✅ `galaChainRouter`: For getting GalaSwap quotes and executing swaps

### Balance Requirements
- Must have at least **8,000 GALA** in GalaSwap wallet
- Must have sufficient ETH balance on Binance (if using GALAETH pair)

## Example Calculation

```
1. Sell 8,000 GALA on GalaSwap → Receive 0.016 GWETH
2. Convert: 0.016 GWETH = 0.016 ETH
3. ETH price: $2,974.59
4. USDT value: 0.016 * $2,974.59 = $47.59
5. GALA price: $0.00615
6. GALA buyable: $47.59 / $0.00615 = 7,738 GALA
7. Fees:
   - GalaSwap: 8,000 * 0.003 = 24 GALA
   - Binance: 7,738 * 0.001 = 7.7 GALA
   - Gas: 5 GALA
   - Total fees: 36.7 GALA
8. Net profit: 7,738 - 8,000 - 36.7 = -298.7 GALA ❌ (Not profitable)
```

For this to be profitable, the price difference needs to be larger, or the GALA amount needs to be adjusted.

## Integration

The arbitrage strategy is automatically included in the bot's strategy list:

```typescript
const strategiesToUse = [
  ...(binanceTradingStrategy ? [binanceTradingStrategy] : []),
  new ArbitrageStrategy(), // ← Spatial arbitrage
  new BasicSwapAccepterStrategy(),
  new BasicSwapCreatorStrategy(),
];
```

## Logging

The strategy logs:
- ✅ Arbitrage opportunities found (with profit calculations)
- ✅ Trades executed (GalaSwap and Binance)
- ⚠️ Opportunities that don't meet minimum profit threshold
- ❌ Errors during execution

## Future Enhancements

1. **Dynamic GALA Amount**: Adjust trade size based on available balance and market conditions
2. **Alternative Trading Pairs**: Fallback to GALAUSDT if GALAETH pair unavailable
3. **Slippage Protection**: Add slippage tolerance checks
4. **Multi-Pair Arbitrage**: Check other token pairs (GUSDC, GUSDT, etc.)
5. **Real-time Price Monitoring**: More frequent checks during high volatility

## Notes

- The strategy runs independently of other strategies
- It doesn't create or accept swaps - it executes direct trades
- Trades are executed simultaneously to minimize price movement risk
- The strategy is rate-limited to avoid excessive API calls

