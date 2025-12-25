# RPC Provider Configuration Guide

## ✅ On-Chain Trading Setup

The bot now supports **direct on-chain trading** using blockchain RPC providers instead of REST APIs.

## Required Configuration

### 1. Add to `.env` File

```bash
# Blockchain RPC Provider (MANDATORY for on-chain trading)
# Primary endpoint
GALA_RPC_URL=https://rpc.gala.com

# Alternative endpoints (if primary fails):
# GALA_RPC_URL=https://rpc.gala.io
# GALA_RPC_URL=https://gala.blockpi.network/v1/rpc/public

# GalaSwap Router Contract Address (REQUIRED)
# Get from GalaChain documentation
GALASWAP_ROUTER_ADDRESS=0x...

# Token Contract Addresses (REQUIRED)
# Get from GalaChain documentation
GALA_TOKEN_ADDRESS=0x...
GUSDC_TOKEN_ADDRESS=0x...
GUSDT_TOKEN_ADDRESS=0x...
```

### 2. RPC Endpoints Available

| Endpoint | Provider | Status |
|----------|----------|--------|
| `https://rpc.gala.com` | GalaChain Official | ✅ Primary |
| `https://rpc.gala.io` | GalaChain Official | ✅ Alternative |
| `https://gala.blockpi.network/v1/rpc/public` | BlockPI | ✅ Alternative |

### 3. What You Need to Get

#### Router Contract Address
- **Purpose**: Smart contract that handles swaps
- **Functions**: `getAmountsOut()`, `swapExactTokensForTokens()`
- **Where to find**: GalaChain documentation or explorer

#### Token Contract Addresses
- **GALA Token**: ERC-20 contract address for GALA
- **GUSDC Token**: ERC-20 contract address for GUSDC  
- **GUSDT Token**: ERC-20 contract address for GUSDT
- **Where to find**: GalaChain token registry or explorer

## How It Works

### Before (REST API)
```typescript
// ❌ Old way: REST API calls
const quote = await galaDeFiApi.getQuote({...});
const swap = await galaDeFiApi.executeSwap({...});
```

### After (On-Chain)
```typescript
// ✅ New way: Direct smart contract calls via RPC
const quote = await onChainRouter.getQuote('GALA', 'GUSDC', amountIn);
const swap = await onChainRouter.swapExactTokensForTokens(
  'GALA', 
  'GUSDC', 
  amountIn, 
  amountOutMin
);
```

## Features

### ✅ On-Chain Price Quotes
- Uses `router.getAmountsOut()` for real-time on-chain prices
- No REST API dependency
- Direct from liquidity pools

### ✅ On-Chain Swaps
- Uses `router.swapExactTokensForTokens()` for direct swaps
- Transactions sent directly to blockchain
- Automatic token approvals

### ✅ Balance Checks
- Uses `token.balanceOf()` for on-chain balances
- Real-time, no API delays

### ✅ Automatic Approvals
- Checks allowance before swaps
- Approves router automatically if needed
- Uses `MaxUint256` for efficiency

## Implementation Details

### Router Contract Functions

| Function | Purpose | Parameters |
|----------|---------|------------|
| `getAmountsOut` | Get price quote | `(amountIn, path[])` |
| `swapExactTokensForTokens` | Execute swap | `(amountIn, amountOutMin, path[], to, deadline)` |

### ERC-20 Token Functions

| Function | Purpose |
|----------|---------|
| `balanceOf` | Check balance |
| `approve` | Allow router to spend |
| `allowance` | Check current allowance |
| `decimals` | Token precision |

## Example Usage

```typescript
// Initialize router
const router = new OnChainRouter(
  'https://rpc.gala.com',
  privateKey,
  routerAddress,
  {
    gala: galaAddress,
    gusdc: gusdcAddress,
    gusdt: gusdtAddress,
  },
  logger
);

// Get quote
const quote = await router.getQuote('GALA', 'GUSDC', ethers.parseUnits('100', 18));
console.log('Amount out:', quote.amountOut.toString());

// Execute swap
const swap = await router.swapExactTokensForTokens(
  'GALA',
  'GUSDC',
  ethers.parseUnits('100', 18),
  quote.amountOut * 99n / 100n, // 1% slippage
);
console.log('Transaction:', swap.transactionHash);
```

## Benefits

1. **Direct Blockchain Access**: No REST API middleman
2. **Real-Time Prices**: Direct from on-chain liquidity pools
3. **Faster Execution**: No API latency
4. **More Reliable**: No API downtime issues
5. **Transparent**: All transactions on-chain, verifiable

## Troubleshooting

### Missing Contract Addresses
```
On-chain router not initialized - missing required contract addresses
```
**Solution**: Add all contract addresses to `.env` file

### RPC Connection Failed
```
Failed to connect to RPC endpoint
```
**Solution**: 
- Check RPC URL is correct
- Try alternative RPC endpoint
- Check network connectivity

### Insufficient Allowance
```
Insufficient allowance, approving token
```
**Solution**: This is automatic - the bot will approve tokens before swapping

## Next Steps

1. **Get Contract Addresses** from GalaChain documentation
2. **Add to `.env`** file
3. **Restart bot** to initialize on-chain router
4. **Monitor logs** for on-chain trading activity

## References

- [On-Chain Trading Guide](./ON_CHAIN_TRADING_GUIDE.md)
- [Router Contract Implementation](./src/dependencies/onchain/router_contract.ts)

