@echo off
REM Token Aggregator Startup Script for Windows
echo 🚀 Starting Token Aggregator...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if required environment variables are set
if "%ZORA_API_KEY%"=="" (
    echo ⚠️  ZORA_API_KEY not set. Using default key.
)

if "%CLANKER_API_KEY%"=="" (
    echo ⚠️  CLANKER_API_KEY not set. Clanker integration will be disabled.
)

REM Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

REM Start the aggregator with logging
echo 📊 Starting aggregator with logging...
node runAggregator.cjs > logs\aggregator-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log 2>&1

pause
