# Self-Custodial Wallet Implementation Guide

## Overview

This guide outlines the implementation of a self-custodial wallet system for CypherX, similar to Axiom's approach. This system provides better UX, accurate PnL tracking, and reduced friction compared to external wallet connections.

## Why Self-Custodial Wallets?

### Advantages
1. **Better UX** - No external wallet connection required
2. **Accurate PnL Tracking** - All trades tracked in-app
3. **Reduced Friction** - No wallet connection issues
4. **Better Analytics** - Complete trading history
5. **Gas Optimization** - Batch transactions possible
6. **MEV Protection** - Better execution strategies
7. **Points Integration** - Seamless rewards system

### Disadvantages
1. **Security Responsibility** - Users must secure their private keys
2. **Initial Setup** - Users need to deposit funds
3. **Regulatory Considerations** - May require additional compliance

## Implementation Architecture

### 1. Wallet Creation & Management
```typescript
// app/components/SelfCustodialWallet.tsx
- Wallet creation using ethers.Wallet.createRandom()
- Private key storage in localStorage (encrypted)
- Backup/restore functionality
- Address display and QR code generation
```

### 2. Quote Aggregation System
```typescript
// app/api/swap/quote/route.ts
- Multiple DEX aggregation (Uniswap V3, BaseSwap, etc.)
- Fee tier optimization (0.05%, 0.3%, 1%)
- Price impact calculation
- Gas estimation
- Route optimization
```

### 3. Swap Execution
```typescript
// app/api/swap/execute/route.ts
- Private key signing
- Balance validation
- Token approval handling
- Gas optimization
- Transaction recording
```

### 4. PnL Tracking
```typescript
// app/components/PnLTracker.tsx
- Real-time PnL calculation
- Historical performance charts
- Trade history analysis
- Export functionality
```

## Security Considerations

### 1. Private Key Management
- **Client-side generation** - Keys never leave user's device
- **Encrypted storage** - Use browser's crypto API
- **Backup prompts** - Force users to backup keys
- **Recovery options** - Seed phrase generation

### 2. Transaction Security
- **Balance validation** - Check before execution
- **Slippage protection** - Configurable limits
- **Gas estimation** - Buffer for network congestion
- **Deadline enforcement** - Prevent stale transactions

### 3. Data Privacy
- **Local storage** - Sensitive data stays local
- **Encrypted backups** - User-controlled exports
- **No server storage** - Private keys never sent to server

## User Flow

### 1. Initial Setup
```
1. User visits app
2. Auto-generate wallet (or restore from backup)
3. Display wallet address and backup options
4. Prompt for initial deposit
5. Show wallet interface
```

### 2. Trading Flow
```
1. User selects tokens to swap
2. System fetches quotes from multiple DEXs
3. User reviews quote and slippage
4. System validates balance and approvals
5. Execute swap with user's private key
6. Record transaction and update PnL
7. Award points for trading activity
```

### 3. Portfolio Management
```
1. Real-time balance tracking
2. Token price updates
3. PnL calculation and charts
4. Trade history and analytics
5. Export functionality
```

## API Endpoints

### 1. Quote Endpoint
```typescript
POST /api/swap/quote
{
  inputToken: "ETH",
  outputToken: "USDC", 
  inputAmount: "1.0",
  walletAddress: "0x..."
}

Response:
{
  inputAmount: "1.0",
  outputAmount: "1850.50",
  priceImpact: 0.15,
  gasEstimate: "0.002",
  route: ["Uniswap V3"],
  fees: 5.55,
  executionPrice: 1850.50,
  minimumReceived: "1841.75",
  priceImpactLevel: "low"
}
```

### 2. Execute Endpoint
```typescript
POST /api/swap/execute
{
  inputToken: "ETH",
  outputToken: "USDC",
  inputAmount: "1.0", 
  outputAmount: "1850.50",
  slippage: 0.5,
  walletAddress: "0x...",
  privateKey: "0x..." // Encrypted
}

Response:
{
  success: true,
  transactionHash: "0x...",
  amountOut: "1850.50",
  gasUsed: "150000",
  gasPrice: "2000000000"
}
```

### 3. PnL Endpoint
```typescript
GET /api/wallet/pnl?address=0x...&timeframe=7D

Response:
{
  pnlData: [...],
  trades: [...],
  totalPnL: 125.50,
  totalPnLPercentage: 8.5,
  totalVolume: 1500.00,
  totalTrades: 12
}
```

## Database Schema

### Wallet Transactions
```typescript
{
  walletAddress: string,
  type: "swap" | "deposit" | "withdrawal",
  inputToken: string,
  outputToken: string,
  inputAmount: string,
  outputAmount: string,
  inputValue: number,
  outputValue: number,
  transactionHash: string,
  gasUsed: string,
  gasPrice: string,
  gasCostUsd: number,
  timestamp: Timestamp,
  status: "pending" | "confirmed" | "failed"
}
```

### User Points
```typescript
{
  walletAddress: string,
  points: number,
  dailyActivities: {
    [date]: {
      swap: number,
      deposit: number,
      withdrawal: number
    }
  },
  createdAt: Timestamp,
  lastActivity: Timestamp
}
```

## Integration with Existing System

### 1. Points System
- **Swap rewards** - 10 points per $100 traded
- **Volume bonuses** - Additional points for high-volume traders
- **Daily limits** - Prevent farming
- **Leaderboard integration** - Competitive element

### 2. Analytics
- **Trading patterns** - Identify successful strategies
- **Token preferences** - Popular trading pairs
- **Gas optimization** - Best execution times
- **Risk metrics** - Portfolio diversification

### 3. Social Features
- **Trade sharing** - Social media integration
- **Portfolio comparison** - Anonymous leaderboards
- **Achievement system** - Trading milestones
- **Community features** - Trading groups

## Migration Strategy

### Phase 1: Parallel Implementation
1. Keep existing wallet connection
2. Add self-custodial option
3. A/B test user preferences
4. Collect feedback and metrics

### Phase 2: Feature Parity
1. Implement all existing features
2. Add PnL tracking
3. Improve quote aggregation
4. Optimize gas usage

### Phase 3: Enhanced Features
1. Advanced analytics
2. Social features
3. Mobile optimization
4. Regulatory compliance

## Technical Requirements

### Environment Variables
```bash
NEXT_PUBLIC_RPC_URL=https://base-mainnet.g.alchemy.com/v2/your_key
NEXT_PUBLIC_UNISWAP_V3_ROUTER=0x2626664c2603336E57B271c5C0b26F421741e481
NEXT_PUBLIC_QUOTER_ADDRESS=0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a
```

### Dependencies
```json
{
  "ethers": "^6.0.0",
  "recharts": "^2.0.0",
  "framer-motion": "^10.0.0",
  "react-hot-toast": "^2.0.0"
}
```

## Testing Strategy

### 1. Unit Tests
- Wallet creation and management
- Quote calculation accuracy
- PnL calculation logic
- Transaction validation

### 2. Integration Tests
- End-to-end swap flow
- Database operations
- API endpoint responses
- Error handling

### 3. Security Tests
- Private key handling
- Transaction signing
- Balance validation
- Slippage protection

## Performance Optimization

### 1. Quote Caching
- Cache quotes for 30 seconds
- Implement rate limiting
- Use CDN for price data
- Optimize API calls

### 2. Database Optimization
- Index wallet addresses
- Partition by date
- Cache frequent queries
- Optimize aggregations

### 3. Frontend Optimization
- Lazy load components
- Memoize calculations
- Debounce user inputs
- Optimize re-renders

## Monitoring & Analytics

### 1. Key Metrics
- Daily active wallets
- Trading volume
- Quote success rate
- Gas usage optimization
- User retention

### 2. Error Tracking
- Failed transactions
- Quote failures
- Balance errors
- Network issues

### 3. User Analytics
- Trading patterns
- Feature usage
- Conversion rates
- User feedback

## Future Enhancements

### 1. Advanced Features
- **Limit orders** - Time-based execution
- **Stop losses** - Risk management
- **Portfolio rebalancing** - Automated trading
- **Yield farming** - DeFi integration

### 2. Mobile App
- **Native wallet** - Better security
- **Push notifications** - Price alerts
- **Offline support** - Basic functionality
- **Biometric auth** - Enhanced security

### 3. Institutional Features
- **Multi-sig wallets** - Corporate accounts
- **Compliance reporting** - Tax integration
- **API access** - Trading bots
- **White-label solutions** - B2B offerings

## Conclusion

The self-custodial wallet approach provides significant advantages over traditional wallet connections, especially for trading applications. The key is implementing it securely while maintaining excellent UX.

The system should be built incrementally, starting with core functionality and expanding based on user feedback and business requirements.
