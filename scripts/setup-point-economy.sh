#!/bin/bash

echo "🚀 Starting Point Economy Setup..."
echo

# Change to project root directory
cd "$(dirname "$0")/.."

echo "📦 Installing dependencies if needed..."
npm install firebase-admin

echo
echo "🔧 Running Point Economy Setup Script..."
node scripts/setup-point-economy.js

echo
echo "✅ Setup complete! Check the output above for any issues."
