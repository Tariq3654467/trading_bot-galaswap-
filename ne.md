# Migration to Gala HFT DEX API

## Overview

The bot has been updated to use the **new Gala HFT (High-Frequency Trading) DEX API** as the default endpoint. This is the production-ready, next-generation trading interface that replaces the older order book API.

## What Changed

### Old API (Legacy)
- **URL**: `https://api-galaswap.gala.com`
- **Type**: Peer-to-peer order book
- **Latency**: Medium/High
- **Issues**: Connection timeouts, slower execution

### New HFT DEX API (Current)
- **URL**: `https://dex-backend-prod1.defi.gala.com`
- **Type**: Automated Market Maker (AMM) with liquidity pools
- **Latency**: Very Low (HFT optimized)
- **Benefits**: Faster, more reliable, production-ready

## Configuration

### Default Settings

The bot now defaults to the new HFT DEX endpoint:

```bash
# GalaSwap API (now defaults to HFT DEX)
GALASWAP_API_BASE_URI=https://dex-backend-prod1.defi.gala.com

# GalaDeFi DEX API (HFT Trading Layer - enabled by default)
GALADEFI_ENABLED=true
GALADEFI_API_BASE_URI=https://dex-backend-prod1.defi.gala.com
```

### Using Legacy API (if needed)

If you need to use the old order book API temporarily:

```bash
GALASWAP_API_BASE_URI=https://api-galaswap.gala.com
GALADEFI_ENABLED=false
```

## Key Differences

### 1. Trading Method

**Old (Order Book)**:
- Users create swap listings
- Other users accept those listings
- Peer-to-peer matching

**New (HFT DEX)**:
- Direct swaps against liquidity pools
- No order matching needed
- Instant execution

### 2. API Endpoints

| Action | Old Endpoint | New HFT Endpoint |
|--------|-------------|------------------|
| Execute Swap | `/v1/RequestTokenSwap` | `/v1/trading/swap` |
| Get Price | `/v1/FetchOpenSwaps` | `/v1/trading/quote` |
| List Pairs | N/A | `/v1/trading/pairs` |
| Get Prices | `/v1/tokens` | `/v1/market/prices` |

### 3. Performance

- **Old API**: 100-500ms latency, connection timeouts
- **New HFT API**: <50ms latency, optimized for bots

## Migration Steps

### 1. Update Environment Variables

Your `.env` file should now have:

```bash
# Use new HFT DEX endpoint (default)
GALASWAP_API_BASE_URI=https://dex-backend-prod1.defi.gala.com

# Enable HFT DEX trading (default: true)
GALADEFI_ENABLED=true
GALADEFI_API_BASE_URI=https://dex-backend-prod1.defi.gala.com
```

### 2. Restart the Bot

```bash
docker compose down
docker compose up --build -d
```

### 3. Verify Connection

Check logs to confirm successful connection:

```bash
docker logs -f galaswap-bot-bot-1
```

You should see:
- "GalaDeFi DEX API enabled and initialized"
- No connection timeout errors
- Successful price quotes and swaps

## Benefits of New HFT DEX API

1. **Faster Execution**: Direct swaps against liquidity pools
2. **Better Reliability**: No more connection timeouts
3. **Real-time Quotes**: Instant price quotes with slippage protection
4. **Higher Throughput**: Optimized for high-frequency trading
5. **Production Ready**: Stable, production-grade infrastructure

## Trading Strategy Updates

Your strategies can now use both APIs:

```typescript
// Old way (still works for compatibility)
await galaSwapApi.createSwap(...);

// New way (recommended - faster)
if (options.galaDeFiApi) {
  const quote = await options.galaDeFiApi.getQuote({
    tokenIn: { collection: "GALA", category: "Unit", type: "none", additionalKey: "none" },
    tokenOut: { collection: "GUSDC", category: "Unit", type: "no