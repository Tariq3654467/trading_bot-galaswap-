# Binance Trading Integration

This bot now supports full Binance trading alongside GalaSwap trading. You can execute trades on both platforms simultaneously.

## Setup

### 1. Get Binance API Credentials

1. Log in to your Binance account
2. Go to API Management
3. Create a new API key with **Spot Trading** permissions enabled
4. Save your API Key and Secret Key securely

### 2. Configure Environment Variables

Add these to your `.env` file:

```bash
# Enable Binance integration
BINANCE_ENABLED=true

# Binance API credentials (REQUIRED for trading)
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_secret_key_here

# Optional: Custom Binance API base URL (default: https://api.binance.com)
# BINANCE_API_BASE_URI=https://api.binance.com
```

### 3. Configure Trading Pairs

Edit `config/token_config.json`:

```json
{
  "binance": {
    "enabled": true,
    "trading": {
      "enabled": true,
      "minTradeAmount": 10,
      "maxTradeAmount": 10000,
      "defaultOrderType": "MARKET",
      "tradingPairs": [
        {
          "baseAsset": "GALA",
          "quoteAsset": "USDT",
          "symbol": "GALAUSDT",
          "minNotional": 10
        },
        {
          "baseAsset": "BTC",
          "quoteAsset": "USDT",
          "symbol": "BTCUSDT",
          "minNotional": 10
        }
      ]
    }
  }
}
```

## Usage

### Access Binance Trading in Your Strategies

The `binanceTrading` object is available in the tick loop options. You can use it in your trading strategies:

```typescript
// Example: Place a market buy order
if (options.binanceTrading) {
  const order = await options.binanceTrading.executeTrade({
    symbol: 'GALAUSDT',
    side: 'BUY',
    type: 'MARKET',
    quantity: '100', // For market buy, this is the amount in USDT
  });
}

// Example: Place a limit sell order
if (options.binanceTrading) {
  const order = await options.binanceTrading.executeTrade({
    symbol: 'GALAUSDT',
    side: 'SELL',
    type: 'LIMIT',
    quantity: '1000', // Amount in GALA
    price: '0.05', // Price in USDT
    timeInForce: 'GTC', // Good Till Canceled
  });
}

// Example: Get available balance
if (options.binanceTrading) {
  const balance = await options.binanceTrading.getAvailableBalance('USDT');
  console.log(`Available USDT: ${balance.toString()}`);
}

// Example: Cancel an order
if (options.binanceTrading) {
  await options.binanceTrading.cancelOrder('GALAUSDT', orderId);
}

// Example: Get open orders
if (options.binanceTrading) {
  const openOrders = await options.binanceTrading.getOpenOrders('GALAUSDT');
  console.log(`Open orders: ${openOrders.length}`);
}
```

## Order Types

### Market Orders

- **BUY**: Use `quantity` as amount in quote currency (e.g., USDT)
- **SELL**: Use `quantity` as amount in base currency (e.g., GALA)

### Limit Orders

- Requires `price` parameter
- `timeInForce`: 'GTC' (Good Till Canceled), 'IOC' (Immediate Or Cancel), 'FOK' (Fill Or Kill)

## Safety Features

- **Minimum/Maximum Trade Amounts**: Configured in `token_config.json`
- **Balance Checks**: Automatically checks available balance before placing orders
- **Error Handling**: Comprehensive error handling with logging
- **Order Validation**: Validates order parameters before submission

## Important Notes

1. **API Keys**: Never commit your API keys to version control. Use environment variables.

2. **Permissions**: Your Binance API key should have:
   - ✅ Enable Reading
   - ✅ Enable Spot & Margin Trading
   - ❌ Enable Withdrawals (NOT recommended for bots)

3. **Rate Limits**: Binance has rate limits. The bot includes retry logic, but be mindful of:
   - Weight limits per IP
   - Order count limits per second

4. **Test First**: Start with small amounts and test thoroughly before using larger amounts.

5. **Dual Trading**: The bot can trade on both GalaSwap and Binance simultaneously. Make sure your strategies account for this.

## Example Strategy

Here's a simple example of using Binance trading in a strategy:

```typescript
// In your strategy's doTick method
if (options.binanceTrading && shouldTradeOnBinance) {
  try {
    // Get current price from Binance
    const price = await options.binanceApi?.getPrice('GALAUSDT');
    
    if (price && shouldBuy) {
      // Place market buy order
      const order = await options.binanceTrading.executeTrade({
        symbol: 'GALAUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '50', // Buy $50 worth of GALA
      });
      
      logger.info(`Binance order placed: ${order.orderId}`);
    }
  } catch (err) {
    logger.error({ message: 'Binance trade failed', err });
  }
}
```

## Troubleshooting

### "API key and secret are required"
- Make sure `BINANCE_API_KEY` and `BINANCE_API_SECRET` are set in your environment

### "Insufficient balance"
- Check your Binance account balance
- Verify the asset symbol matches your balance (e.g., USDT not USD)

### "Trade amount is below minimum"
- Increase the trade amount or adjust `minTradeAmount` in config

### Orders not executing
- Check Binance API status
- Verify API key has trading permissions
- Check rate limits haven't been exceeded

