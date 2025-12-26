# Binance API 401 Error Troubleshooting Guide

## Error Message
```
401 {"code":-2015,"msg":"Invalid API-key, IP, or permissions for action."}
```

This error means Binance is rejecting your API request due to one of these issues:
1. **IP Address not whitelisted** (most common)
2. **API key permissions incorrect**
3. **API key or secret incorrect**
4. **Server IP changed** (if using dynamic IP)

## Step-by-Step Fix

### 1. Check Your Server's Public IP Address

First, find out what IP address your bot server is using:

```bash
# From inside the Docker container
docker exec -it galaswap-bot-bot-1 curl -s https://api.ipify.org

# Or from your host machine
curl https://api.ipify.org
```

**Important**: If your server uses a dynamic IP, you'll need to update the whitelist whenever it changes, or consider using a static IP/VPN.

### 2. Verify IP Whitelist in Binance

1. Log into your Binance account
2. Go to **API Management**: https://www.binance.com/en/my/settings/api-management
3. Click on your API key
4. Check **"Restrict access to trusted IPs only"** section
5. Verify your server's IP address is listed

**Common Issues:**
- IP address format: Use IPv4 format (e.g., `192.168.1.1`) or CIDR notation (e.g., `192.168.1.0/24`)
- Multiple IPs: If your server has multiple IPs, add all of them
- IPv6 vs IPv4: Make sure you're using the correct format

### 3. Check API Key Permissions

Your API key needs these permissions enabled:

**Required Permissions:**
- ✅ **Enable Reading** (to check balances)
- ✅ **Enable Spot & Margin Trading** (to place orders)

**NOT Required (and should be disabled for security):**
- ❌ **Enable Withdrawals** (never enable this for trading bots)

**To Check/Update Permissions:**
1. Go to API Management
2. Click on your API key
3. Scroll to "API restrictions"
4. Verify "Enable Reading" and "Enable Spot & Margin Trading" are checked

### 4. Verify API Key and Secret in .env File

Check your `.env` file has the correct values:

```bash
BINANCE_ENABLED=true
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
```

**Common Issues:**
- Extra spaces or quotes around the values
- Copy-paste errors (missing characters)
- Using the wrong API key

**To Test API Key Manually:**

You can test your API key using curl:

```bash
# Get your server's IP first
SERVER_IP=$(curl -s https://api.ipify.org)

# Test API key (replace with your actual key and secret)
curl -H "X-MBX-APIKEY: YOUR_API_KEY" \
  "https://api.binance.com/api/v3/account?timestamp=$(date +%s)000&signature=YOUR_SIGNATURE"
```

### 5. Check for IP Restrictions on Your Network

If you're running the bot behind a firewall, proxy, or VPN:

- **Firewall**: Make sure outbound HTTPS (port 443) is allowed
- **Proxy**: If using a proxy, the proxy IP needs to be whitelisted
- **VPN**: If using a VPN, the VPN's exit IP needs to be whitelisted
- **Load Balancer**: If behind a load balancer, the load balancer IP needs to be whitelisted

### 6. Disable IP Restrictions (Temporary Testing Only)

⚠️ **WARNING**: Only for testing! This is less secure.

If you want to test without IP restrictions:

1. Go to API Management
2. Click on your API key
3. Uncheck "Restrict access to trusted IPs only"
4. Save changes
5. Wait 5-10 minutes for changes to propagate

**After testing, re-enable IP restrictions for security!**

### 7. Verify Time Synchronization

The bot automatically syncs time with Binance servers, but you can verify:

```bash
# Check if time sync is working in logs
docker logs galaswap-bot-bot-1 | grep -i "time\|sync\|timestamp"
```

### 8. Check Binance API Status

Sometimes Binance API has issues:

- Check Binance status: https://www.binance.com/en/support/announcement
- Check API status: https://www.binance.com/en/support/announcement/c-48

## Quick Diagnostic Script

Create a test script to verify your API key:

```bash
# test_binance_api.sh
#!/bin/bash

API_KEY="your_api_key"
API_SECRET="your_api_secret"
TIMESTAMP=$(date +%s)000

# Create signature
QUERY_STRING="timestamp=${TIMESTAMP}"
SIGNATURE=$(echo -n "${QUERY_STRING}" | openssl dgst -sha256 -hmac "${API_SECRET}")

# Test API
curl -X GET "https://api.binance.com/api/v3/account?timestamp=${TIMESTAMP}&signature=${SIGNATURE}" \
  -H "X-MBX-APIKEY: ${API_KEY}"

echo ""
```

## Common Solutions

### Solution 1: Add Server IP to Whitelist
1. Get server IP: `curl https://api.ipify.org`
2. Add to Binance API whitelist
3. Wait 5-10 minutes
4. Restart bot: `docker compose restart bot`

### Solution 2: Use CIDR Notation for IP Range
If your server IP changes frequently, use CIDR notation:
- Example: `192.168.1.0/24` allows all IPs from 192.168.1.0 to 192.168.1.255

### Solution 3: Create New API Key
If the current key is corrupted:
1. Create a new API key in Binance
2. Set correct permissions
3. Add IP whitelist
4. Update `.env` file
5. Restart bot

### Solution 4: Disable Binance Trading Temporarily
If you don't need Binance trading right now:

```bash
# In .env file
BINANCE_ENABLED=false
```

Then restart: `docker compose restart bot`

## Verification Steps

After making changes:

1. **Wait 5-10 minutes** for Binance changes to propagate
2. **Restart the bot**: `docker compose restart bot`
3. **Check logs**: `docker logs -f galaswap-bot-bot-1`
4. **Look for**: No more 401 errors, successful balance checks

## Still Not Working?

If you've tried all the above:

1. **Double-check API key and secret** - Make sure there are no extra spaces
2. **Verify IP address** - Make sure it matches exactly what Binance shows
3. **Check Binance account status** - Make sure your account is in good standing
4. **Contact Binance support** - They can check if there are any account-level restrictions

## Security Best Practices

1. ✅ **Always use IP whitelisting** - Never disable IP restrictions in production
2. ✅ **Use separate API keys** - One for trading bot, different one for manual trading
3. ✅ **Never enable withdrawals** - Trading bots don't need withdrawal permissions
4. ✅ **Rotate API keys periodically** - Change them every 3-6 months
5. ✅ **Monitor API usage** - Check Binance for unusual activity

