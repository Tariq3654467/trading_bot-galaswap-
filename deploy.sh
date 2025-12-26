#!/bin/bash

# GalaSwap Bot Deployment Script
# This script helps deploy the trading bot

set -e

echo "🚀 GalaSwap Bot Deployment Script"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with required environment variables."
    echo "See DEPLOYMENT_GUIDE.md for details."
    exit 1
fi

echo "✅ .env file found"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Build and start services
echo "📦 Building and starting services..."
docker compose up --build -d

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 To view logs, run:"
echo "   docker logs -f galaswap-bot-bot-1"
echo ""
echo "🛑 To stop the bot, run:"
echo "   docker compose down"
echo ""
echo "🔄 To restart the bot, run:"
echo "   docker compose restart bot"
echo ""

