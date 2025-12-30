# Transaction ID vs Blockchain Hash Explanation

## The Issue

The GalaSwap SDK returns a `transactionId` in UUID format (e.g., `009cbbf8-597a-4988-ae94-e028b54dd941`), but the GalaChain explorer (galascan.gala.com) expects a blockchain transaction hash (hex format like `0x...`).

## Why Transactions Don't Show on Explorer

1. **UUID vs Hash**: The SDK's `transactionId` is an internal identifier, not the actual blockchain transaction hash
2. **Explorer Format**: The GalaChain explorer expects blockchain transaction hashes, not UUIDs
3. **Pending Status**: The transaction might be pending and not yet indexed by the explorer

## What We've Added

The bot now logs the **full transaction object** to help identify the actual blockchain hash:

```json
{
  "fullTransaction": "{...}",
  "transactionKeys": ["transactionId", "hash", "txHash", ...],
  "note": "Full transaction object logged - check for hash, txHash, or blockNumber fields"
}
```

## How to Find Your Transaction

### Method 1: Check Logs for Full Transaction Object

Look for logs with `"fullTransaction"` field. This will show all available fields from the SDK response.

### Method 2: Check by Wallet Address

Instead of searching by transaction ID, search by your wallet address on the explorer:
- Your wallet: `client|693148bb413aebe8bb87b7ad`
- Explorer URL: https://galascan.gala.com/wallet/client%7C693148bb413aebe8bb87b7ad

### Method 3: Check Balance Changes

The most reliable way to verify swaps:
- **Before**: GALA: 29,745.70, GWETH: 0.05
- **After**: GALA: 29,735.70, GWETH: 0.05 + (received amount)

If your balances changed, the swap executed successfully, even if it doesn't show on the explorer.

## Next Steps

1. **Check the next swap logs** - The full transaction object will be logged
2. **Look for hash fields** - The logs will show if there's a `hash`, `txHash`, or `blockchainHash` field
3. **Update the code** - Once we identify the correct field, we'll extract it automatically

## Expected Behavior

- ✅ Swap executes successfully (balances change)
- ✅ Transaction ID is logged (UUID format)
- ❌ Transaction may not appear on explorer (if UUID format)
- ✅ Full transaction object is logged (to find actual hash)

## If Transaction Still Doesn't Appear

1. **Check wallet address directly** on explorer
2. **Wait a few minutes** - Explorer indexing can be delayed
3. **Check balance changes** - This confirms the swap executed
4. **Review full transaction logs** - Find the actual blockchain hash

---

**Note**: The swap is executing successfully (as evidenced by balance changes). The issue is just with the transaction ID format for the explorer lookup.

