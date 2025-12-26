@echo off
REM Get the public IP address that Binance will see

echo Getting your server's public IP address...
echo.

REM Get IP using ipify
for /f "tokens=*" %%i in ('curl -s https://api.ipify.org') do set PUBLIC_IP=%%i

echo Your server's public IP address: %PUBLIC_IP%
echo.

echo Add this IP to your Binance API whitelist:
echo 1. Go to: https://www.binance.com/en/my/settings/api-management
echo 2. Click on your API key
echo 3. Add IP: %PUBLIC_IP%
echo 4. Wait 5-10 minutes for changes to propagate
echo 5. Restart bot: docker compose restart bot
echo.

pause

