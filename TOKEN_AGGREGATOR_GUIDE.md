# Token Aggregator System Guide

## Overview

The Token Aggregator is a comprehensive system that automatically discovers, monitors, and scores tokens from multiple sources to keep your memescope updated with the best performing tokens in real-time.

## Features

### 🔍 **Real-Time Token Discovery**
- Monitors multiple DEX factories (Aerodrome, BaseSwap, UniswapV3, PancakeSwap)
- Automatically detects new token pairs as they're created
- Captures token addresses and basic metadata instantly

### 📊 **Multi-Source Data Aggregation**
- **DexScreener**: Real-time price, volume, and market data
- **Zora**: Token metadata and social information
- **Clanker**: Additional market insights (when API key provided)
- **Factory Monitoring**: Direct blockchain event monitoring

### 🎯 **Intelligent Token Scoring**
- Volume-based scoring (24h volume, volume/market cap ratio)
- Price movement analysis (1h, 6h, 24h changes)
- Liquidity assessment
- Holder count analysis
- Age-based scoring (newer tokens get bonus points)
- Buy/sell ratio analysis

### 🏷️ **Dynamic Tagging System**
- **NEW**: Tokens created in the last 24 hours
- **SURGING**: High volume + positive price movement
- **VOLUME**: Tokens with >$50K 24h volume
- **RUNNER**: Low market cap + high volume
- **TRENDING**: Tokens with >500 holders
- **LIQUIDITY**: Tokens with >$50K liquidity
- **MOONSHOT**: Micro cap tokens with activity
- **ESTABLISHED**: Tokens with >$5M market cap
- **GAINER**: Tokens with >20% price increase

## Installation & Setup

### 1. Environment Variables

Create a `.env` file in your project root:

```bash
# Required
ZORA_API_KEY=your_zora_api_key_here

# Optional
CLANKER_API_KEY=your_clanker_api_key_here
BASE_RPC_URL=https://base.llamarpc.com
LOG_LEVEL=info
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Aggregator

#### Development Mode
```bash
npm run aggregator:dev
```

#### Production Mode
```bash
npm run aggregator:start
```

#### Manual Start
```bash
node runAggregator.cjs
```

## Configuration

The aggregator can be configured by modifying `aggregator.config.ts`:

### DEX Factories
Add or remove DEX factories to monitor:

```typescript
FACTORIES: [
  {
    name: "Aerodrome",
    address: "0x420dd381b31aef6683fa7e9d3c33269d4e2b66bf",
    type: "aerodrome",
    enabled: true
  }
  // Add more factories here
]
```

### Scoring Weights
Adjust how tokens are scored:

```typescript
SCORING_WEIGHTS: {
  volume24h: 0.25,        // 25% weight for 24h volume
  priceChange24h: 0.20,   // 20% weight for price change
  volumeToMarketCapRatio: 0.15, // 15% weight for volume/market cap ratio
  liquidity: 0.15,        // 15% weight for liquidity
  holders: 0.10,          // 10% weight for holder count
  age: 0.10,              // 10% weight for token age
  buyPercentage: 0.05     // 5% weight for buy/sell ratio
}
```

### Update Intervals
Configure how often different operations run:

```typescript
INTERVALS: {
  FACTORY_POLL: 30000,        // 30 seconds
  MARKET_DATA_UPDATE: 60000,  // 1 minute
  SCORING_UPDATE: 300000,     // 5 minutes
  CLEANUP_OLD_TOKENS: 3600000 // 1 hour
}
```

## How It Works

### 1. Factory Monitoring
The aggregator continuously monitors DEX factory contracts for new pair creation events. When a new pair is created, it:
- Extracts the token addresses
- Determines which token is the actual token (not WETH/USDC)
- Adds the token to the database with basic metadata

### 2. Market Data Updates
Every minute, the aggregator:
- Fetches the latest market data from DexScreener
- Updates token metadata from Zora
- Integrates additional data from Clanker (if available)
- Updates all tokens in the database

### 3. Token Scoring
Every 5 minutes, the aggregator:
- Calculates scores for all tokens based on multiple metrics
- Generates appropriate tags based on performance
- Updates the database with new scores and tags

### 4. Memescope Integration
The memescope API endpoint now:
- Prioritizes tokens with high scores
- Orders tokens by score first, then by recency
- Returns the best performing tokens for display

## API Endpoints

### Get Top Tokens
```bash
GET /api/cypherscope-tokens
```

Query Parameters:
- `search`: Search by token name, symbol, or address
- `sortBy`: Sort field (score, createdAt, marketCap, volume24h)
- `sortOrder`: Sort order (asc, desc)

Response:
```json
{
  "tokens": [
    {
      "address": "0x...",
      "name": "Token Name",
      "symbol": "TKN",
      "score": 85,
      "tags": ["NEW", "SURGING", "VOLUME"],
      "priceUsd": "0.001234",
      "priceChange": { "h24": 25.5 },
      "volume24h": 150000,
      "marketCap": 500000,
      "liquidity": { "usd": 25000 },
      "uniqueHolders": 150,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 100,
  "sources": ["cypherscope", "screener", "zora-local", "sample"]
}
```

## Monitoring & Logs

### Log Files
Logs are automatically saved to the `logs/` directory with timestamps:
```
logs/aggregator-20240115-143022.log
```

### Log Levels
- `info`: General information about operations
- `warn`: Non-critical issues
- `error`: Critical errors that need attention
- `debug`: Detailed debugging information

### Health Checks
The aggregator provides real-time status information:
- Factory monitoring status
- Market data update frequency
- Token scoring progress
- Error rates and retry attempts

## Troubleshooting

### Common Issues

#### 1. RPC Connection Errors
```
❌ Error monitoring Aerodrome: RPC connection failed
```
**Solution**: Check your RPC URL and network connectivity

#### 2. API Rate Limits
```
❌ DexScreener API error: Rate limit exceeded
```
**Solution**: Increase delays between requests in config

#### 3. Firebase Connection Issues
```
❌ Firebase admin not initialized
```
**Solution**: Ensure Firebase credentials are properly configured

#### 4. Memory Issues
```
❌ Out of memory error
```
**Solution**: Reduce batch sizes or increase Node.js memory limit

### Performance Optimization

#### For High-Volume Environments
1. Increase batch sizes in configuration
2. Reduce update intervals
3. Use multiple RPC endpoints
4. Implement caching for frequently accessed data

#### For Low-Resource Environments
1. Increase delays between API calls
2. Reduce the number of tokens processed
3. Disable non-essential features
4. Use lighter logging levels

## Integration with Existing Systems

### Memescope Widget
The memescope widget automatically benefits from the aggregator:
- Shows the highest-scoring tokens
- Updates in real-time as scores change
- Displays relevant tags for each token

### Token Scanner
The token scanner can now access enriched data:
- Real-time market data
- Performance scores
- Trend analysis

### Whale Watcher
Enhanced whale tracking with:
- Better token identification
- Improved market context
- More accurate alerts

## Future Enhancements

### Planned Features
1. **Machine Learning Scoring**: AI-powered token analysis
2. **Social Sentiment**: Twitter/Telegram sentiment analysis
3. **Whale Tracking**: Large holder movement monitoring
4. **Alert System**: Custom alerts for specific conditions
5. **Portfolio Tracking**: User portfolio integration

### API Integrations
1. **CoinGecko**: Additional market data
2. **DexTools**: Enhanced DEX analytics
3. **Chainlink**: Price feed integration
4. **Custom APIs**: User-defined data sources

## Support

For issues or questions:
1. Check the logs in `logs/` directory
2. Review the configuration in `aggregator.config.ts`
3. Ensure all environment variables are set
4. Verify Firebase credentials are correct

## License

This aggregator system is part of the CypherX platform and follows the same licensing terms.
