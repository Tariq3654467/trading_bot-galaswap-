# How to Check Executed Trades

## 1. **Check Logs for Transaction IDs**

The bot now logs all executed swaps with transaction IDs. Look for these log messages:

### Direct Swap Executions:
- `✅ GALA ↔ GWETH swap executed via SDK routing`
- `✅ Direct swap executed: GALA -> GWETH`
- `✅ Direct swap executed via SDK (no quote needed)`

### Summary Logs:
- `📊 EXECUTED SWAPS SUMMARY` - Shows all swaps executed in the current cycle
- `Arbitrage: Check cycle complete` - Includes `executedSwapsCount` and `recentSwaps` fields

### Example Log Entry:
```json
{
  "level": 30,
  "transactionId": "bca6f077-d200-4005-89b9-022b7e6f6e72",
  "tokenIn": "GALA",
  "tokenOut": "GWETH",
  "amountIn": 10,
  "msg": "✅ GALA ↔ GWETH swap executed via SDK routing"
}
```

## 2. **Check Your Wallet Balances**

Monitor your GALA and GWETH balances:
- **Before**: GALA: 29,745.70, GWETH: 0.05
- **After**: GALA: 29,735.70, GWETH: 0.05 + (received amount)

The bot logs balance changes:
```json
{
  "galaBalance": 29742.70718446,
  "gwethBalance": 0.05,
  "msg": "Direct swap mode: Checking GALA ↔ GWETH swap opportunities"
}
```

## 3. **Check MongoDB Database**

If you're using MongoDB, executed swaps are stored in the `createdSwaps` collection:

```javascript
// Connect to MongoDB
use galaswap-bot

// Find recent swaps
db.createdSwaps.find().sort({ created: -1 }).limit(10)

// Find swaps by transaction ID
db.createdSwaps.find({ swapRequestId: "bca6f077-d200-4005-89b9-022b7e6f6e72" })
```

## 4. **Check GalaChain Explorer**

1. Copy the transaction ID from logs
2. Visit GalaChain explorer (if available)
3. Search for the transaction ID to see on-chain confirmation

## 5. **Filter Logs for Executed Swaps**

### Using grep/jq:
```bash
# Find all executed swaps
docker logs <container-name> | grep "✅.*swap executed"

# Find transaction IDs
docker logs <container-name> | grep "transactionId" | jq '.transactionId'

# Find swap summary
docker logs <container-name> | grep "EXECUTED SWAPS SUMMARY"
```

### Using Docker logs:
```bash
# Follow logs in real-time
docker logs -f <container-name>

# Show last 100 lines
docker logs --tail 100 <container-name>

# Show logs with timestamps
docker logs -t <container-name>
```

## 6. **Check Status Reporter Alerts**

If you have alerts configured (email, Discord, etc.), you'll receive notifications like:
```
✅ GALA ↔ GWETH swap executed via SDK automatic routing: 10 GALA -> GWETH (TX: bca6f077-d200-4005-89b9-022b7e6f6e72)
```

## 7. **What to Look For**

### Successful Swap Indicators:
- ✅ Log messages with "swap executed"
- Transaction ID present in logs
- Balance changes in subsequent logs
- No error messages after the swap

### Failed Swap Indicators:
- ❌ "Not enough liquidity" errors
- ❌ "CONFLICT" errors (409)
- No transaction ID
- Balance unchanged

## 8. **Debugging: Why No Swaps?**

If you see no executed swaps, check:

1. **Direct Swap Mode Running?**
   - Look for: `🚀 EXECUTING DIRECT SWAP MODE: GALA ↔ GWETH on GalaSwap`
   - If missing, direct swap mode may not be running

2. **Liquidity Issues?**
   - Look for: `"Not enough liquidity available in pool"`
   - This means the pool doesn't have enough liquidity for the trade size

3. **All Amounts Failed?**
   - Look for: `"Dynamic sizing: All direct swap attempts without quote failed"`
   - The bot tried multiple sizes but all failed

4. **Check Balances:**
   - Ensure you have sufficient GALA or GWETH
   - Minimum: 0.01 GALA or 0.0001 GWETH

## 9. **Recent Changes**

The bot now:
- ✅ Tracks all executed swaps in memory
- ✅ Logs a summary at the end of each cycle
- ✅ Shows transaction IDs for all swaps
- ✅ Tries multiple amounts (10, 20, 50, 100, 200, 500 GALA)
- ✅ Uses SDK automatic routing (no quote needed)

## 10. **Example: Complete Trade Flow**

```
1. Bot starts: "🚀 EXECUTING DIRECT SWAP MODE"
2. Checks balance: GALA: 29,745.70
3. Tries 10 GALA -> GWETH
4. Swap executes: TX bca6f077-d200-4005-89b9-022b7e6f6e72
5. Logs: "✅ GALA ↔ GWETH swap executed"
6. Summary: "📊 EXECUTED SWAPS SUMMARY" with transaction details
7. Next cycle: Balance updated, ready for next swap
```

---

**Note**: If you're not seeing swaps execute, check the logs for the "🚀 EXECUTING DIRECT SWAP MODE" message. If it's missing, the direct swap mode may not be running properly.

