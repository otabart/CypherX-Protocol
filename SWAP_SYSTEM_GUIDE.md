# Swap System Guide

## Overview
The CypherX application features a sophisticated swap system that supports multiple DEXs (Decentralized Exchanges) and provides users with the best possible trading routes. The system automatically routes trades through the most efficient DEX based on liquidity and pricing.

## Supported DEXs

### Primary DEXs
1. **Uniswap V2** - Traditional AMM with simple token pairs
2. **Uniswap V3** - Advanced AMM with concentrated liquidity
3. **Aerodrome** - V3-style DEX with enhanced features
4. **Baseswap** - V3-style DEX optimized for Base network

### DEX Configuration
```typescript
const DEX_FACTORIES = {
  'uniswap_v2': {
    factory: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
    router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    version: 'v2',
    feeTier: 0.003
  },
  'uniswap_v3': {
    factory: '0x33128a8fc17869897dce68ed026d694621f6fdfd',
    router: '0x2626664c2603336E57B271c5C0b26F421741e481',
    version: 'v3',
    feeTiers: [0.0001, 0.0005, 0.003, 0.01]
  },
  'aerodrome': {
    factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
    router: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
    version: 'v3_style',
    feeTier: 0.003
  }
};
```

## Swap Process

### 1. Quote Fetching
The system fetches quotes from multiple DEXs to find the best price:

```typescript
// Fetch quote from DexScreener
const quoteResponse = await fetch('/api/swap/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tokenIn: '0x4200000000000000000000000000000000000006', // WETH
    tokenOut: tokenAddress,
    amountIn: amount,
    chainId: 8453 // Base
  })
});
```

### 2. Route Validation
Each route is validated to ensure liquidity exists:

```typescript
// Validate route on specific DEX
const validationResult = await validateDexScreenerRoute(quote);
if (validationResult.isValid) {
  // Route is valid, proceed with swap
  const routerConfig = getRouterConfig(validationResult.dexId);
  // Use routerConfig for transaction preparation
}
```

### 3. Transaction Preparation
Prepare transaction data for the selected route:

```typescript
// Prepare transaction
const prepareResponse = await fetch('/api/swap/prepare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tokenIn: '0x4200000000000000000000000000000000000006',
    tokenOut: tokenAddress,
    amountIn: amount,
    route: quote.route,
    userAddress: walletAddress
  })
});
```

### 4. Transaction Execution
Execute the prepared transaction:

```typescript
// Execute swap
const submitResponse = await fetch('/api/swap/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    signedTransaction: signedTx,
    userAddress: walletAddress
  })
});
```

## API Endpoints

### `/api/swap/quote`
Fetches the best quote for a token swap:
- **Input**: Token addresses, amount, chain ID
- **Output**: Best route with price and liquidity information
- **Features**: Multi-DEX routing, price comparison

### `/api/swap/prepare`
Prepares transaction data for execution:
- **Input**: Quote data, user address
- **Output**: Transaction data ready for signing
- **Features**: Gas estimation, slippage protection

### `/api/swap/submit`
Submits signed transaction to blockchain:
- **Input**: Signed transaction data
- **Output**: Transaction hash and status
- **Features**: Transaction monitoring, error handling

### `/api/swap/execute`
Direct swap execution (alternative to prepare/submit):
- **Input**: Swap parameters, user wallet
- **Output**: Transaction result
- **Features**: One-step execution, automatic signing

## Routing Logic

### Multi-DEX Routing
The system automatically finds the best route across multiple DEXs:

1. **Fetch Quotes**: Get quotes from all supported DEXs
2. **Validate Routes**: Check liquidity and pool existence
3. **Compare Prices**: Find the best price and lowest slippage
4. **Select Route**: Choose optimal route for execution

### Route Validation
Each route is validated before execution:

```typescript
async function validateDexScreenerRoute(quote: any) {
  const dexId = quote.route[0];
  const factory = DEX_FACTORIES[dexId];
  
  // Check if pool exists
  const poolExists = await validateSpecificPool(
    factory.factory,
    quote.tokenIn,
    quote.tokenOut,
    factory.version
  );
  
  return {
    isValid: poolExists,
    dexId: dexId,
    routerAddress: factory.router,
    method: getRouterMethod(factory.version),
    params: buildRouterParams(quote, factory.version)
  };
}
```

### Router Configuration
Different DEXs use different router methods:

#### Uniswap V2
```typescript
// swapExactETHForTokens for ETH -> Token
const params = [
  amountOutMin,
  [WETH_ADDRESS, tokenOut],
  userAddress,
  deadline
];

// swapExactTokensForTokens for Token -> Token
const params = [
  amountIn,
  amountOutMin,
  [tokenIn, tokenOut],
  userAddress,
  deadline
];
```

#### Uniswap V3
```typescript
// exactInputSingle for single hop
const params = [{
  tokenIn: tokenIn,
  tokenOut: tokenOut,
  fee: feeTier,
  recipient: userAddress,
  deadline: deadline,
  amountIn: amountIn,
  amountOutMinimum: amountOutMin,
  sqrtPriceLimitX96: 0
}];
```

#### V3-Style DEXs (Aerodrome, Baseswap)
```typescript
// Generic swap method
const params = [
  tokenIn,
  tokenOut,
  amountIn,
  amountOutMin,
  userAddress,
  deadline
];
```

## Transaction Types

### ETH to Token Swaps
When swapping native ETH to tokens:
- **Method**: `swapExactETHForTokens` (V2) or `exactInputSingle` (V3)
- **Value**: Set to `amountIn` for ETH amount
- **TokenIn**: WETH address
- **Special Handling**: Automatic ETH wrapping

### Token to ETH Swaps
When swapping tokens to native ETH:
- **Method**: `swapExactTokensForETH` (V2) or `exactOutputSingle` (V3)
- **Value**: 0 (no ETH sent)
- **TokenOut**: WETH address
- **Special Handling**: Automatic ETH unwrapping

### Token to Token Swaps
When swapping between tokens:
- **Method**: `swapExactTokensForTokens` (V2) or `exactInputSingle` (V3)
- **Value**: 0 (no ETH sent)
- **Standard**: Normal token swap process

## Error Handling

### Common Errors
1. **Insufficient Liquidity**: Pool doesn't have enough tokens
2. **Slippage Exceeded**: Price moved too much during transaction
3. **Insufficient Balance**: User doesn't have enough tokens
4. **Gas Estimation Failed**: Unable to estimate gas cost
5. **Transaction Reverted**: Transaction failed on blockchain

### Error Recovery
- **Automatic Retry**: Retry failed transactions with adjusted parameters
- **Fallback Routes**: Try alternative routes if primary route fails
- **User Feedback**: Clear error messages with suggested actions
- **Transaction Monitoring**: Track transaction status and provide updates

## Gas Optimization

### Gas Estimation
```typescript
// Estimate gas for transaction
const gasEstimate = await provider.estimateGas({
  from: userAddress,
  to: routerAddress,
  data: transactionData,
  value: value
});

// Add buffer for gas estimation
const gasLimit = gasEstimate.mul(120).div(100); // 20% buffer
```

### Gas Price Optimization
- **Dynamic Gas**: Adjust gas price based on network conditions
- **Priority Fees**: Include priority fees for faster execution
- **Gas Tracking**: Monitor gas costs across different DEXs

## Security Features

### Slippage Protection
- **Default Slippage**: 0.5% default slippage tolerance
- **User Configurable**: Users can adjust slippage settings
- **Slippage Validation**: Validate slippage before execution
- **Price Impact Warning**: Warn users about high price impact

### Transaction Validation
- **Input Validation**: Validate all input parameters
- **Balance Checks**: Verify user has sufficient balance
- **Allowance Checks**: Verify token allowances for DEXs
- **Deadline Protection**: Include transaction deadlines

### Front-running Protection
- **Private Transactions**: Use private mempool when available
- **MEV Protection**: Implement MEV protection measures
- **Transaction Ordering**: Optimize transaction ordering

## Performance Optimizations

### Caching
- **Quote Caching**: Cache quotes for short periods
- **Pool Data Caching**: Cache pool information
- **Gas Price Caching**: Cache gas price estimates
- **Route Caching**: Cache optimal routes

### Batch Operations
- **Batch Quotes**: Fetch multiple quotes simultaneously
- **Batch Validation**: Validate multiple routes in parallel
- **Batch Transactions**: Execute multiple transactions efficiently

### UI Optimizations
- **Debounced Input**: Debounce user input to reduce API calls
- **Loading States**: Show loading states during operations
- **Progress Indicators**: Display progress for long operations
- **Error Boundaries**: Handle errors gracefully

## Development Notes

### Key Dependencies
- `ethers.js`: Blockchain interaction and transaction handling
- `@uniswap/sdk`: Uniswap-specific functionality
- `axios`: HTTP requests for API calls
- `react-hot-toast`: User notifications

### File Structure
```
app/api/swap/
├── quote/                    # Quote fetching
├── prepare/                  # Transaction preparation
├── submit/                   # Transaction submission
└── execute/                  # Direct execution

app/utils/
├── poolValidation.ts         # Pool validation logic
├── swapHelpers.ts           # Swap utility functions
└── gasEstimation.ts         # Gas estimation logic

app/trade/[poolAddress]/chart/
├── swap.tsx                 # Main swap interface
└── page.tsx                 # Trading page
```

### Testing Considerations
- **Network Testing**: Test on Base testnet first
- **Error Scenarios**: Test all error conditions
- **Gas Estimation**: Test gas estimation accuracy
- **Slippage Testing**: Test slippage protection
- **Multi-DEX Testing**: Test all supported DEXs

## Future Enhancements

### Planned Features
- **Cross-chain Swaps**: Support for cross-chain transactions
- **Limit Orders**: Support for limit order trading
- **Advanced Routing**: More sophisticated routing algorithms
- **MEV Protection**: Enhanced MEV protection

### Performance Improvements
- **WebSocket Updates**: Real-time price updates
- **Advanced Caching**: More sophisticated caching strategies
- **Parallel Processing**: Parallel quote fetching and validation
- **Optimistic Updates**: Optimistic UI updates

## Troubleshooting

### Common Issues
1. **Quote Failures**: Check token addresses and liquidity
2. **Transaction Failures**: Verify gas settings and user balance
3. **Routing Issues**: Check DEX availability and pool status
4. **Price Impact**: Monitor price impact for large trades

### Debug Information
- **Transaction Logs**: Detailed transaction logs
- **Gas Tracking**: Gas usage tracking
- **Route Analysis**: Route selection analysis
- **Performance Metrics**: Swap performance data

## Best Practices

### For Users
- **Check Liquidity**: Verify sufficient liquidity before trading
- **Monitor Slippage**: Pay attention to slippage settings
- **Gas Optimization**: Use appropriate gas settings
- **Transaction Monitoring**: Monitor transaction status

### For Developers
- **Error Handling**: Implement comprehensive error handling
- **User Feedback**: Provide clear user feedback
- **Performance**: Optimize for performance and user experience
- **Security**: Implement robust security measures
