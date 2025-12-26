# Production Deployment Configuration Guide

## ✅ Current Status

### Fixed Issues
- ✅ **CONFLICT Error Prevention**: Strict validation for minimum swap amounts
- ✅ **Binance Quantity Precision**: Fixed precision formatting for Binance trades
- ✅ **Reverse Mirroring**: Implemented (sell on GalaSwap → buy on Binance)
- ✅ **Rebalancing**: Implemented and configured
- ✅ **Price Aggregation**: Binance prices integrated

### Configuration Status

## 📋 Pre-Deployment Checklist

### 1. Profitability Settings ⚠️ **REQUIRES REVIEW**

**Current Settings** (in `config/basic_swap_creator.json`):
```json
"targetProfitability": 0.95,  // Allows 5% loss
"minProfitability": 0.90,    // Allows 10% loss
"maxProfitability": 1.50      // Caps at 50% profit
```

**⚠️ WARNING**: Current settings allow losses! For production, you should use:

**Recommended Production Settings**:
```json
"targetProfitability": 1.02,  // Target 2% profit
"minProfitability": 1.01,    // Minimum 1% profit (reject losses)
"maxProfitability": 1.20      // Cap at 20% profit
```

**Conservative Settings** (safer):
```json
"targetProfitability": 1.05,  // Target 5% profit
"minProfitability": 1.02,      // Minimum 2% profit
"maxProfitability": 1.15       // Cap at 15% profit
```

**Action**: Update `config/basic_swap_creator.json` for each trading pair.

---

### 2. Binance API Configuration ⚠️ **REQUIRES FIX**

**Status**: Currently getting 401 errors

**Required Actions**:
1. ✅ Verify API keys in `.env`:
   ```bash
   BINANCE_ENABLED=true
   BINANCE_API_KEY=your_api_key_here
   BINANCE_API_SECRET=your_secret_key_here
   ```

2. ✅ Check Binance API Key Permissions:
   - ✅ Enable Reading
   - ✅ Enable Spot & Margin Trading
   - ❌ Enable Withdrawals (NOT recommended)

3. ✅ Whitelist Server IP:
   - Get your server's public IP
   - Add to Binance API key IP whitelist
   - Or remove IP restrictions (less secure)

4. ✅ Test API Key:
   - Use Binance API documentation to test manually
   - Verify it works before deploying

**Impact**: Binance trading won't work until fixed. GalaSwap trading works independently.

---

### 3. Environment Variables

**Required** (in `.env` file):
```bash
# GalaChain
GALA_WALLET_ADDRESS=your_wallet_address
GALA_PRIVATE_KEY=your_private_key
GALA_RPC_URL=https://rpc.gala.com
GALASWAP_CONTRACT_NAME=galachain-gala-swap

# MongoDB
MONGO_PASSWORD=your_secure_password

# Bot Settings
LOOP_WAIT_MS=60000              # 1 minute between ticks
EXECUTION_DELAY_MS=1000         # 1 second delay between actions

# Binance (if enabled)
BINANCE_ENABLED=true
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_secret

# Notifications (optional but recommended)
DISCORD_WEBHOOK_URI=your_webhook_url
DISCORD_ALERT_WEBHOOK_URI=your_alert_webhook_url
# OR
SLACK_WEBHOOK_URI=your_webhook_url
SLACK_ALERT_WEBHOOK_URI=your_alert_webhook_url
```

---

### 4. Trading Configuration

**Current Settings** (in `config/basic_swap_creator.json`):
- ✅ Multiple trading pairs configured
- ✅ Price movement limits set (1% max movement)
- ✅ Target giving sizes configured

**Review**:
- `targetGivingSize`: Current values (25, 9000, 0.03) - adjust based on your capital
- `maxPriceMovementPercent`: 1.0% - good for stability
- `maxPriceMovementWindowMs`: 30 minutes - reasonable

---

### 5. Binance Trading Configuration

**Current Settings** (in `config/token_config.json`):
```json
{
  "binance": {
    "enabled": true,
    "trading": {
      "enabled": true,
      "mirrorGalaSwapTrades": true,  // ✅ Reverse mirroring enabled
      "rebalancing": {
        "enabled": true,
        "rebalanceThreshold": 0.1,   // 10% threshold
        "targetRatios": {
          "GALA": 0.5,                // 50% GALA
          "USDT": 0.3                 // 30% USDT
        }
      },
      "tradingPairs": [...]           // Multiple pairs configured
    }
  }
}
```

**Status**: ✅ Configured correctly

---

## 🚀 Deployment Steps

### Step 1: Update Profitability Settings

Edit `config/basic_swap_creator.json` and update profitability for each pair:

```json
{
  "targetProfitability": 1.02,  // Change from 0.95
  "minProfitability": 1.01,     // Change from 0.90
  "maxProfitability": 1.20       // Keep or adjust
}
```

### Step 2: Verify Environment Variables

```bash
# Check .env file exists and has all required variables
cat .env

# Verify sensitive values are correct
# Never commit .env to git!
```

### Step 3: Fix Binance API (if using)

1. Get server IP:
   ```bash
   curl ifconfig.me
   ```

2. Add IP to Binance API key whitelist

3. Test API key manually

### Step 4: Build and Deploy

```bash
# Build the Docker image
docker compose build

# Start services
docker compose up -d

# Monitor logs
docker logs -f galaswap-bot-bot-1
```

### Step 5: Monitor First 24 Hours

Watch for:
- ✅ Swaps being created successfully
- ✅ No CONFLICT errors
- ✅ Profitability calculations
- ⚠️ Binance API errors (if using)
- ⚠️ Any unexpected behavior

---

## 📊 Configuration Summary

| Setting | Current Value | Production Recommended | Status |
|---------|--------------|------------------------|--------|
| **Profitability** | 0.95 (allows loss) | 1.02+ (profit only) | ⚠️ **UPDATE** |
| **Binance API** | 401 errors | Fixed auth | ❌ **FIX** |
| **Swap Validation** | Strict | Strict | ✅ **READY** |
| **Mirroring** | Enabled | Enabled | ✅ **READY** |
| **Rebalancing** | Enabled | Enabled | ✅ **READY** |
| **Price Aggregation** | Binance + GalaSwap | Same | ✅ **READY** |

---

## ⚠️ Important Notes

### For Production Use:

1. **Profitability**: Update to > 1.0 to ensure profitable trades only
2. **Start Small**: Begin with small `targetGivingSize` values
3. **Monitor Closely**: Watch first 24-48 hours
4. **Binance**: Fix API auth before enabling Binance trading
5. **Backup**: Keep wallet private key in secure location

### Current Configuration Allows:

- ✅ GalaSwap trading (works independently)
- ✅ Multi-pair trading
- ✅ Price aggregation from Binance
- ⚠️ Losses (profitability < 1.0)
- ❌ Binance trading (API auth issue)

---

## 🎯 Recommendation

**For GalaSwap-Only Trading**: 
- ✅ **READY** - Just update profitability settings
- Start with small amounts and monitor

**For Full Production (GalaSwap + Binance)**:
- ⚠️ **NOT READY** - Fix Binance API authentication first
- Update profitability settings
- Test thoroughly before scaling

---

## 📝 Quick Start Commands

```bash
# 1. Update profitability in config/basic_swap_creator.json
# 2. Verify .env file
# 3. Deploy
docker compose up --build -d

# 4. Monitor
docker logs -f galaswap-bot-bot-1

# 5. Check status
docker ps
```

---

**Last Updated**: After CONFLICT error fixes and reverse mirroring implementation

