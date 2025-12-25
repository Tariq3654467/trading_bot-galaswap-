# Migration to Official Gala On-Chain Swaps

## ✅ What Changed

The bot now uses **official Gala on-chain swaps via RPC** instead of the DEX API (which is not officially supported by Gala).

### Before (DEX API - Not Supported)
```typescript
// ❌ Old way: DEX API (not officially supported)
const swap = await galaDeFiApi.executeSwap({...});
```

### After (On-Chain Router - Official)
```typescript
// ✅ New way: Direct on-chain swaps via smart contracts
const swap = await onChainRouter.swapExactTokensForTokens(
  'GALA', 
  'GUSDC', 
  amountIn, 
  amountOutMin
);
```

## How It Works

### 1. On-Chain Router (Primary Method)
- **Uses**: Blockchain RPC provider (`https://rpc.gala.com`)
- **Method**: Direct smart contract calls
- **Functions**: `router.getAmountsOut()`, `router.swapExactTokensForTokens()`
- **Status**: ✅ **Official Gala swap method**

### 2. Order Book API (Fallback)
- **Uses**: GalaSwap REST API (`https://api-galaswap.gala.com`)
- **Method**: `createSwap()`, `acceptSwap()`
- **Status**: ⚠️ Legacy method (still works but not preferred)

### 3. DEX API (Disabled by Default)
- **Uses**: `dex-backend-prod1.defi.gala.com`
- **Status**: ❌ **Not officially supported by Gala** - Disabled by default

## Configuration

### Required for On-Chain Swaps

Add these to your `.env` file:

```bash
# Blockchain RPC Provider (MANDATORY)
GALA_RPC_URL=https://rpc.gala.com

# Contract Addresses (REQUIRED)
GALASWAP_ROUTER_ADDRESS=0x...
GALA_TOKEN_ADDRESS=0x...
GUSDC_TOKEN_ADDRESS=0x...
GUSDT_TOKEN_ADDRESS=0x...
```

### Disable DEX API

```bash
# DEX API is NOT officially supported - keep disabled
GALADEFI_ENABLED=false
```

## Execution Flow

### When On-Chain Router is Available:
1. ✅ Bot uses `onChainRouter.swapExactTokensForTokens()` for direct swaps
2. ✅ Transactions go directly on-chain via smart contracts
3. ✅ Uses official Gala swap method

### When On-Chain Router is NOT Available:
1. ⚠️ Bot falls back to order book API (`galaSwapApi.createSwap()` / `acceptSwap()`)
2. ⚠️ Warning logged: "On-chain router not available, using order book API (legacy)"

### DEX API:
1. ❌ Disabled by default (`GALADEFI_ENABLED=false`)
2. ❌ Not officially supported by Gala

## Benefits of On-Chain Swaps

1. **✅ Official Method**: Supported by Gala
2. **✅ Direct Execution**: No REST API middleman
3. **✅ Real-Time**: Direct from on-chain liquidity pools
4. **✅ Transparent**: All transactions on-chain, verifiable
5. **✅ Faster**: No API latency

## Code Changes

### Updated Files:
- `src/tick_loop.ts` - Uses on-chain router for swap execution
- `src/utils/execute_onchain_swap.ts` - New utility for on-chain swaps
- `src/utils/token_class_to_symbol.ts` - Token conversion helper
- `src/bot_main.ts` - Initializes on-chain router
- `docker-compose.yml` - Disables DEX API by default

### Key Functions:
- `executeOnChainSwap()` - Executes direct on-chain swap
- `getOnChainQuote()` - Gets price quote from router contract
- `tokenClassToSymbol()` - Converts token class to symbol

## Troubleshooting

### "On-chain router not available"
**Solution**: Add RPC URL and contract addresses to `.env` file

### "Unsupported tokens for on-chain swap"
**Solution**: Only GALA, GUSDC, and GUSDT are supported. Other tokens will use order book API.

### "Failed to execute on-chain swap"
**Solution**: Bot will automatically fall back to order book API. Check:
- RPC endpoint is accessible
- Contract addresses are correct
- Wallet has sufficient balance
- Gas price is reasonable

## Next Steps

1. **Get Contract Addresses** from GalaChain documentation
2. **Add to `.env`** file
3. **Restart bot** - it will automatically use on-chain swaps
4. **Monitor logs** - look for "On-chain swap executed successfully"

## References

- [RPC Configuration Guide](./RPC_CONFIGURATION.md)
- [On-Chain Trading Guide](./ON_CHAIN_TRADING_GUIDE.md)
- [Router Contract Implementation](./src/dependencies/onchain/router_contract.ts)

