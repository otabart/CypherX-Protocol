@echo off
echo 🚀 Starting Point Economy Setup...
echo.

cd /d "%~dp0.."

echo 📦 Installing dependencies if needed...
npm install firebase-admin

echo.
echo 🔧 Running Point Economy Setup Script...
node scripts/setup-point-economy.js

echo.
echo ✅ Setup complete! Check the output above for any issues.
pause
