#!/bin/bash
# Get the public IP address that Binance will see

echo "Getting your server's public IP address..."
echo ""

# Method 1: Using ipify
PUBLIC_IP=$(curl -s https://api.ipify.org)
echo "Your server's public IP address: $PUBLIC_IP"
echo ""

# Method 2: Using ifconfig.me (backup)
PUBLIC_IP2=$(curl -s https://ifconfig.me)
echo "Alternative check (ifconfig.me): $PUBLIC_IP2"
echo ""

if [ "$PUBLIC_IP" = "$PUBLIC_IP2" ]; then
  echo "✅ Both methods agree. Use this IP: $PUBLIC_IP"
else
  echo "⚠️  IPs don't match. Try both in Binance whitelist."
fi

echo ""
echo "Add this IP to your Binance API whitelist:"
echo "1. Go to: https://www.binance.com/en/my/settings/api-management"
echo "2. Click on your API key"
echo "3. Add IP: $PUBLIC_IP"
echo "4. Wait 5-10 minutes for changes to propagate"
echo "5. Restart bot: docker compose restart bot"

