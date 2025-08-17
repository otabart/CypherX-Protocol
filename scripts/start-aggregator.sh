#!/bin/bash

# Token Aggregator Startup Script
echo "🚀 Starting Token Aggregator..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if required environment variables are set
if [ -z "$ZORA_API_KEY" ]; then
    echo "⚠️  ZORA_API_KEY not set. Using default key."
fi

if [ -z "$CLANKER_API_KEY" ]; then
    echo "⚠️  CLANKER_API_KEY not set. Clanker integration will be disabled."
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the aggregator with logging
echo "📊 Starting aggregator with logging..."
node runAggregator.cjs 2>&1 | tee logs/aggregator-$(date +%Y%m%d-%H%M%S).log
