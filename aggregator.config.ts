// Token Aggregator Configuration
export const AGGREGATOR_CONFIG = {
  // RPC Configuration
  RPC: {
    BASE_URL: process.env.BASE_RPC_URL || "https://base.llamarpc.com",
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3
  },

  // DEX Factories to Monitor
  FACTORIES: [
    {
      name: "Aerodrome",
      address: "0x420dd381b31aef6683fa7e9d3c33269d4e2b66bf",
      type: "aerodrome",
      enabled: true
    },
    {
      name: "BaseSwap",
      address: "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86", 
      type: "baseswap",
      enabled: true
    },
    {
      name: "UniswapV3",
      address: "0x33128a8fc17869897dce68ed026d694621f6fdfd",
      type: "uniswap_v3",
      enabled: true
    },
    {
      name: "PancakeSwap",
      address: "0x02a84c1b3bbd7401a5f7fa98a384ebc70bb5749e",
      type: "pancakeswap",
      enabled: true
    }
  ],

  // API Keys
  API_KEYS: {
    ZORA: process.env.ZORA_API_KEY || "zora_api_a9628962c935e17de3c0c5176553e1c643c89b51b23ead436684f45e4e8c45ed",
    CLANKER: process.env.CLANKER_API_KEY || "",
    DEXSCREENER: process.env.DEXSCREENER_API_KEY || "" // Optional
  },

  // Update Intervals (in milliseconds)
  INTERVALS: {
    FACTORY_POLL: 30000, // 30 seconds
    MARKET_DATA_UPDATE: 60000, // 1 minute
    SCORING_UPDATE: 300000, // 5 minutes
    CLEANUP_OLD_TOKENS: 3600000 // 1 hour
  },

  // API Rate Limits
  RATE_LIMITS: {
    DEXSCREENER_BATCH_SIZE: 10,
    DEXSCREENER_DELAY: 1000, // ms between requests
    ZORA_DELAY: 500,
    CLANKER_DELAY: 500
  },

  // Token Scoring Weights (0-1, total should equal 1)
  SCORING_WEIGHTS: {
    volume24h: 0.25,
    priceChange24h: 0.20,
    volumeToMarketCapRatio: 0.15,
    liquidity: 0.15,
    holders: 0.10,
    age: 0.10,
    buyPercentage: 0.05
  },

  // Token Filtering Criteria
  FILTERS: {
    MIN_VOLUME_24H: 1000, // $1K minimum volume
    MIN_LIQUIDITY: 1000, // $1K minimum liquidity
    MAX_AGE_DAYS: 30, // Don't include tokens older than 30 days
    MIN_HOLDERS: 10, // Minimum unique holders
    EXCLUDED_ADDRESSES: [
      // Add addresses to exclude (e.g., known scam tokens)
    ]
  },

  // Database Configuration
  DATABASE: {
    COLLECTION_NAME: "Cypherscope",
    BATCH_SIZE: 500,
    MAX_TOKENS_TO_PROCESS: 1000
  },

  // Logging Configuration
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || "info",
    ENABLE_FILE_LOGGING: true,
    LOG_DIR: "logs",
    MAX_LOG_FILES: 10
  },

  // Feature Flags
  FEATURES: {
    ENABLE_FACTORY_MONITORING: true,
    ENABLE_MARKET_DATA_UPDATES: true,
    ENABLE_SCORING: true,
    ENABLE_CLANKER_INTEGRATION: !!process.env.CLANKER_API_KEY,
    ENABLE_ZORA_INTEGRATION: true,
    ENABLE_DEXSCREENER_INTEGRATION: true
  }
};

// Validation function to ensure config is valid
export function validateConfig() {
  const weights = AGGREGATOR_CONFIG.SCORING_WEIGHTS;
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  
  if (Math.abs(totalWeight - 1) > 0.01) {
    throw new Error(`Scoring weights must sum to 1.0, got ${totalWeight}`);
  }

  if (AGGREGATOR_CONFIG.INTERVALS.FACTORY_POLL < 10000) {
    throw new Error("Factory poll interval must be at least 10 seconds");
  }

  if (AGGREGATOR_CONFIG.INTERVALS.MARKET_DATA_UPDATE < 30000) {
    throw new Error("Market data update interval must be at least 30 seconds");
  }

  console.log("✅ Configuration validation passed");
}
