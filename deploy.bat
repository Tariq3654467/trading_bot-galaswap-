@echo off
REM GalaSwap Bot Deployment Script for Windows
REM This script helps deploy the trading bot

echo.
echo 🚀 GalaSwap Bot Deployment Script
echo ==================================
echo.

REM Check if .env file exists
if not exist .env (
    echo ❌ Error: .env file not found!
    echo Please create a .env file with required environment variables.
    echo See DEPLOYMENT_GUIDE.md for details.
    exit /b 1
)

echo ✅ .env file found
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Docker is not running!
    echo Please start Docker and try again.
    exit /b 1
)

echo ✅ Docker is running
echo.

REM Build and start services
echo 📦 Building and starting services...
docker compose up --build -d

echo.
echo ✅ Deployment complete!
echo.
echo 📊 To view logs, run:
echo    docker logs -f galaswap-bot-bot-1
echo.
echo 🛑 To stop the bot, run:
echo    docker compose down
echo.
echo 🔄 To restart the bot, run:
echo    docker compose restart bot
echo.

pause

