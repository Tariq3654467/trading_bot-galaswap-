# Test Trade Configuration

## ⚠️ TEST MODE ENABLED

The bot has been configured to allow test trades even at a loss for testing purposes.

## Changes Made

### Profitability Thresholds (Lowered to Allow Losses)
- **targetProfitability**: `0.95` (was 1.05) - Accepts 5% loss
- **minProfitability**: `0.90` (was 1.01) - Minimum 10% loss allowed
- **maxProfitability**: `1.50` (was 1.15) - Maximum 50% profit allowed

### Trade Size (Reduced for Testing)
- **GUSDC/GUSDT → GALA**: `targetGivingSize: 1` (was 10) - Smaller test trades
- **GALA → GUSDC/GUSDT**: `targetGivingSize: 100` (unchanged)

### Price Movement (Relaxed)
- **maxPriceMovementPercent**: `1.0` (was 0.03) - Allows larger price movements

## What This Means

1. **The bot will create trades even if they result in a 5-10% loss**
2. **Smaller trade sizes (1 GUSDC/GUSDT) for easier testing**
3. **More lenient price movement checks**

## Important Notes

⚠️ **This is a TEST configuration - you may lose money on trades!**

- Trades will execute even at a loss
- Only use this for testing the trading functionality
- **Revert these changes after testing** to restore normal profitability requirements

## To Restore Normal Settings

After testing, change back to:
```json
"targetProfitability": 1.05,
"minProfitability": 1.01,
"maxProfitability": 1.15,
"targetGivingSize": 10,  // or your preferred size
"maxPriceMovementPercent": 0.03,
```

## Expected Behavior

With these settings, the bot should:
1. ✅ Create a swap even if it's slightly unprofitable (5% loss)
2. ✅ Use smaller trade sizes (1 GUSDC/GUSDT instead of 10)
3. ✅ Execute trades more easily (relaxed price movement checks)

## Monitoring

Watch the logs for:
- `"Creating swap"` messages
- `"Swap created and executed on-chain"` messages
- Transaction IDs from the chaincode router
- Balance changes after trade execution

