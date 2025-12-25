# On-Chain Trading Implementation Guide

## ⚠️ Current Issue

The bot currently uses **REST API endpoints** (`/v1/trade/quote`, `/v1/trade/swap`), but **trades must go on-chain through smart contracts**.

## ✅ Correct Architecture

### 1. Blockchain RPC Endpoint (MANDATORY)

**Purpose**: Connect to GalaChain blockchain
- Read prices
- Send trades
- Check balances
- Get gas price
- Monitor transactions

**Examples**:
- `https://rpc.gala.com`
- `https://rpc.ankr.com/gala`
- `https://gala.blockpi.network/v1/rpc/public`

**Usage**:
```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://rpc.gala.com');
```

### 2. GalaSwap Router Contract (CRITICAL)

**Instead of REST endpoints, call smart contract functions directly.**

#### Key Router Functions (Uniswap-style)

| Function | Purpose | Parameters |
|----------|---------|------------|
| `getAmountsOut` | Get price quote | `(uint amountIn, address[] path)` |
| `swapExactTokensForTokens` | Execute trade | `(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)` |
| `swapExactETHForTokens` | Buy with native token | `(uint amountOutMin, address[] path, address to, uint deadline)` |
| `swapExactTokensForETH` | Sell to native token | `(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)` |

**Example**:
```typescript
const routerContract = new ethers.Contract(
  ROUTER_ADDRESS,
  ROUTER_ABI,
  signer
);

// Get price quote
const amounts = await routerContract.getAmountsOut(
  ethers.parseUnits("100", 18), // amountIn
  [tokenInAddress, tokenOutAddress] // path
);
```

### 3. ERC-20 Token Contracts (REQUIRED)

**Must call token contracts for**:
- `balanceOf(address)` - Check balance
- `approve(address spender, uint amount)` - Allow router to spend tokens
- `decimals()` - Token precision
- `symbol()` - Token symbol

**Example**:
```typescript
const tokenContract = new ethers.Contract(
  TOKEN_ADDRESS,
  ERC20_ABI,
  signer
);

// Check balance
const balance = await tokenContract.balanceOf(walletAddress);

// Approve router to spend tokens (REQUIRED before swap)
const approveTx = await tokenContract.approve(
  ROUTER_ADDRESS,
  ethers.MaxUint256 // Approve max amount
);
await approveTx.wait();
```

### 4. Required Contract Addresses

You need to configure:

```typescript
// Router contract address (GalaSwap router)
const ROUTER_ADDRESS = "0x..."; // TODO: Get from GalaChain docs

// Token contract addresses
const GALA_TOKEN_ADDRESS = "0x..."; // GALA token
const GUSDC_TOKEN_ADDRESS = "0x..."; // GUSDC token
const GUSDT_TOKEN_ADDRESS = "0x..."; // GUSDT token
```

## 🔥 Implementation Flow

### Step 1: Connect to RPC
```typescript
const provider = new ethers.JsonRpcProvider(process.env.GALA_RPC_URL);
const wallet = new ethers.Wallet(process.env.GALA_PRIVATE_KEY, provider);
```

### Step 2: Get Price Quote
```typescript
const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
const amounts = await router.getAmountsOut(
  ethers.parseUnits("100", 18), // 100 tokens
  [GALA_ADDRESS, GUSDC_ADDRESS] // path
);
const amountOut = amounts[1]; // Output amount
```

### Step 3: Check Profit / Signal
```typescript
// Your trading logic here
if (isProfitable(amountOut, expectedAmount)) {
  // Proceed with swap
}
```

### Step 4: Approve Token (if needed)
```typescript
const token = new ethers.Contract(GALA_ADDRESS, ERC20_ABI, wallet);
const allowance = await token.allowance(wallet.address, ROUTER_ADDRESS);

if (allowance < amountIn) {
  const approveTx = await token.approve(ROUTER_ADDRESS, ethers.MaxUint256);
  await approveTx.wait(); // Wait for confirmation
}
```

### Step 5: Execute Swap
```typescript
const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

const swapTx = await router.swapExactTokensForTokens(
  amountIn,                    // amountIn
  amountOutMin,                // amountOutMinimum (with slippage)
  [GALA_ADDRESS, GUSDC_ADDRESS], // path
  wallet.address,              // to
  deadline                      // deadline
);

const receipt = await swapTx.wait(); // Wait for confirmation
```

### Step 6: Monitor Transaction
```typescript
// Transaction is confirmed
console.log('Swap successful:', receipt.transactionHash);
```

## 📋 Required Configuration

### Environment Variables

```bash
# RPC Endpoint (MANDATORY)
GALA_RPC_URL=https://rpc.gala.com

# Contract Addresses (REQUIRED)
GALASWAP_ROUTER_ADDRESS=0x...
GALA_TOKEN_ADDRESS=0x...
GUSDC_TOKEN_ADDRESS=0x...
GUSDT_TOKEN_ADDRESS=0x...

# Wallet (already configured)
GALA_WALLET_ADDRESS=client|...
GALA_PRIVATE_KEY=...
```

## ⚠️ Common Mistakes to Avoid

1. ❌ **Looking for REST trading API** - Use smart contracts instead
2. ❌ **Forgetting token approval** - Router can't spend tokens without approval
3. ❌ **Ignoring slippage** - Use `amountOutMinimum` to protect against price changes
4. ❌ **Using wrong router address** - Must use official GalaSwap router
5. ❌ **Hardcoding gas price** - Use `provider.getFeeData()` for current gas prices

## 🔧 Migration Steps

1. **Add RPC configuration** to `.env`
2. **Get contract addresses** from GalaChain documentation
3. **Create router contract interface** with ABI
4. **Create token contract interface** with ERC20 ABI
5. **Replace REST API calls** with smart contract calls
6. **Add token approval logic** before swaps
7. **Add transaction monitoring** for confirmations
8. **Test with small amounts** first

## 📚 Resources Needed

1. **Router Contract ABI** - Uniswap V2-style router ABI
2. **ERC-20 ABI** - Standard ERC-20 interface
3. **Contract Addresses** - From GalaChain documentation
4. **Chain ID** - GalaChain network ID

## 🎯 Next Steps

1. Research GalaChain router contract address
2. Get token contract addresses for GALA, GUSDC, GUSDT
3. Implement RPC provider connection
4. Create contract interfaces
5. Replace REST API with smart contract calls
6. Add approval and transaction monitoring

