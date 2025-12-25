# GalaChain API Endpoints Guide

## Overview

The bot uses two different API endpoints for different purposes:

1. **GalaSwap API** (`GALASWAP_API_BASE_URI`) - Legacy order book API
2. **GalaDeFi API** (`GALADEFI_API_BASE_URI`) - HFT DEX API for direct swaps

## Current Configuration

### GalaSwap API (Legacy Order Book)
- **Endpoint**: `https://api-galaswap.gala.com`
- **Purpose**: Order book style trading (create/accept/terminate swaps)
- **Use Case**: Peer-to-peer order matching
- **Endpoints**: `/v1/token-contract/...`, `/v1/tokens`, etc.

### GalaDeFi API (HFT DEX) ✅ CURRENT
- **Endpoint**: `https://dex-backend-prod1.defi.gala.com`
- **Purpose**: Direct swaps against liquidity pools
- **Use Case**: High-frequency trading, instant execution
- **Endpoints**: `/v1/trade/quote`, `/v1/trade/swap`, `/v1/trade/bundle`

## Configuration Files Updated

### 1. `.env` File
```bash
# GalaSwap API (Legacy Order Book)
GALASWAP_API_BASE_URI=https://api-galaswap.gala.com

# GalaDeFi API (HFT DEX) - Updated to use HFT endpoint
GALADEFI_API_BASE_URI=https://dex-backend-prod1.defi.gala.com
GALADEFI_ENABLED=true
```

### 2. `docker-compose.yml`
```yaml
environment:
  - GALASWAP_API_BASE_URI=${GALASWAP_API_BASE_URI:-https://api-galaswap.gala.com}
  - GALADEFI_API_BASE_URI=${GALADEFI_API_BASE_URI:-https://dex-backend-prod1.defi.gala.com}
```

### 3. `src/bot_main.ts`
```typescript
// Default updated to HFT DEX endpoint
const galaDeFiApiBaseUri = await configuration.getOptionalWithDefault(
  'GALADEFI_API_BASE_URI',
  'https://dex-backend-prod1.defi.gala.com', // HFT DEX API endpoint
);
```

## API Endpoint Comparison

| Feature | GalaSwap API | GalaDeFi API (HFT DEX) |
|---------|--------------|------------------------|
| **URL** | `api-galaswap.gala.com` | `dex-backend-prod1.defi.gala.com` |
| **Type** | Order Book | Liquidity Pools |
| **Trading** | Create/Accept swaps | Direct swaps |
| **Speed** | Slower (matching) | Faster (instant) |
| **Endpoints** | `/v1/token-contract/...` | `/v1/trade/...` |
| **Use Case** | Legacy support | Modern DEX trading |

## When to Use Each API

### Use GalaSwap API (`api-galaswap.gala.com`) for:
- ✅ Legacy order book features
- ✅ Creating swap listings
- ✅ Accepting existing swaps
- ✅ Fetching token metadata
- ✅ Balance checks (legacy format)

### Use GalaDeFi API (`dex-backend-prod1.defi.gala.com`) for:
- ✅ **Direct swaps** against liquidity pools
- ✅ **Real-time quotes** with best fee tier selection
- ✅ **High-frequency trading** (HFT)
- ✅ **Instant execution** (no order matching)
- ✅ **Liquidity management** (add/remove liquidity)
- ✅ **Price oracle** data

## Testing the Configuration

After updating, restart the Docker containers:

```bash
# Stop containers
docker compose down

# Start with new configuration
docker compose up -d

# Check logs
docker logs -f galaswap-bot-bot-1
```

## Expected Behavior

With `dex-backend-prod1.defi.gala.com` configured:

1. **GalaDeFi API** will use the HFT DEX endpoint
2. **Swaps** will execute directly against liquidity pools
3. **Quotes** will use `/v1/trade/quote` endpoint
4. **Faster execution** compared to order book matching

## Troubleshooting

### If you see DNS errors:
- Check that `dex-backend-prod1.defi.gala.com` is accessible
- Verify DNS resolution: `ping dex-backend-prod1.defi.gala.com`
- Check Docker network connectivity

### If you see 404 errors:
- Verify the endpoint paths match the API version
- Check that `/v1/trade/...` endpoints are correct
- Ensure token format is `GALA|Unit|none|none` (pipe-separated)

### If you see connection timeouts:
- Increase timeout values in `.env`:
  ```bash
  GALASWAP_REQUEST_TIMEOUT_MS=60000
  GALASWAP_CONNECT_TIMEOUT_MS=30000
  ```

## References

- [gSwap SDK Documentation](https://galachain.github.io/gswap-sdk/docs/api/)
- [GalaDeFi Trading Guide](./GALADEFI_TRADING.md)
- [SDK Migration Guide](./SDK_MIGRATION_GUIDE.md)

