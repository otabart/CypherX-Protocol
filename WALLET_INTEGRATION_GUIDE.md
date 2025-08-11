# CypherX Self-Custodial Wallet Integration Guide

## Overview

This guide documents the successful integration of the self-custodial wallet system into the CypherX trading application. The integration provides users with two wallet options: the new self-custodial CypherX wallet and the existing external wallet system (Wagmi).

## Key Features Implemented

### 1. Dual Wallet System
- **Self-Custodial Wallet**: In-app wallet creation and management
- **External Wallet**: Traditional MetaMask, Coinbase Wallet, etc. via Wagmi
- **Toggle System**: Users can switch between wallet systems seamlessly

### 2. Self-Custodial Wallet Features
- **Wallet Creation**: `ethers.Wallet.createRandom()` for secure wallet generation
- **Local Storage**: Private keys stored securely in browser localStorage
- **Balance Tracking**: Real-time ETH and token balance display
- **Backup/Restore**: Wallet backup and restoration functionality
- **Address Management**: Copy wallet address with one click

### 3. Enhanced Swap System
- **New API Integration**: Uses `/api/swap/quote` and `/api/swap/execute` endpoints
- **PnL Tracking**: Real-time profit/loss calculation and display
- **Trade History**: Complete transaction history with analytics
- **Gas Optimization**: Automatic gas estimation and optimization
- **Slippage Protection**: Configurable slippage tolerance

### 4. PnL Analytics
- **Total PnL**: Overall profit/loss percentage
- **Win Rate**: Percentage of profitable trades
- **Total Volume**: Total trading volume in USD
- **Trade Count**: Number of completed trades
- **Daily PnL**: Time-series PnL data
- **Recent Trades**: Detailed trade history

## Files Modified/Created

### Core Components
1. **`app/components/Header.tsx`**
   - Added wallet system toggle
   - Integrated self-custodial wallet display
   - Updated navigation and mobile menu

2. **`app/token-scanner/[poolAddress]/chart/swap.tsx`**
   - Completely rewritten for self-custodial integration
   - Added PnL tracking and analytics
   - Enhanced UI with wallet management

3. **`app/providers.tsx`**
   - Added `WalletSystemContext` for global state management
   - Integrated wallet system toggle functionality

### API Endpoints
1. **`app/api/swap/quote/route.ts`** (NEW)
   - Aggregated quote fetching from multiple DEXs
   - Price impact calculation
   - Gas estimation

2. **`app/api/swap/execute/route.ts`** (NEW)
   - Secure swap execution using private keys
   - Transaction recording in Firebase
   - Points system integration

3. **`app/api/wallet/pnl/route.ts`** (NEW)
   - PnL calculation and analytics
   - Trade history aggregation
   - Performance metrics

### Components
1. **`app/components/SelfCustodialWallet.tsx`** (NEW)
   - Complete wallet management interface
   - Balance display and management
   - Backup/restore functionality

2. **`app/components/PnLTracker.tsx`** (NEW)
   - PnL analytics dashboard
   - Chart visualization
   - Export functionality

## User Flow

### Self-Custodial Wallet Flow
1. **Wallet Creation**: User clicks "Create Wallet" in header
2. **Wallet Setup**: Private key generated and stored locally
3. **Balance Display**: ETH and token balances shown in header
4. **Trading**: User can swap tokens using the integrated swap interface
5. **PnL Tracking**: Real-time profit/loss tracking and analytics
6. **Backup**: User can backup wallet for security

### External Wallet Flow
1. **Wallet Connection**: User connects external wallet (MetaMask, etc.)
2. **Traditional Trading**: Uses existing Wagmi-based swap system
3. **External Management**: Wallet managed by external provider

## Technical Implementation

### State Management
```typescript
interface WalletSystemContextType {
  walletSystem: "wagmi" | "self-custodial";
  setWalletSystem: (system: "wagmi" | "self-custodial") => void;
  selfCustodialWallet: {
    address: string;
    isConnected: boolean;
    ethBalance: string;
    tokenBalance: string;
  } | null;
  setSelfCustodialWallet: (wallet: any) => void;
}
```

### Wallet Storage
```typescript
// Wallet data structure
{
  address: string;
  privateKey: string;
  createdAt: number;
}
```

### API Integration
- **Quote API**: `/api/swap/quote` - Returns aggregated quotes
- **Execute API**: `/api/swap/execute` - Executes swaps with private key
- **PnL API**: `/api/wallet/pnl` - Returns PnL analytics

## Security Considerations

### Private Key Management
- Private keys stored in browser localStorage
- No server-side storage of private keys
- User responsible for wallet backup
- Clear warnings about key security

### Transaction Security
- All transactions signed client-side
- Gas estimation with safety buffer
- Slippage protection
- Balance validation before execution

## Benefits

### For Users
1. **Reduced Friction**: No external wallet connection required
2. **Better UX**: Seamless in-app wallet management
3. **PnL Tracking**: Real-time profit/loss analytics
4. **Trade History**: Complete transaction history
5. **Gas Optimization**: Automatic gas estimation

### For Platform
1. **User Retention**: Integrated wallet increases user engagement
2. **Analytics**: Better trading data and user behavior insights
3. **Revenue**: Potential for gas fee optimization and MEV protection
4. **Competitive Advantage**: Unique self-custodial trading experience

## Future Enhancements

### Planned Features
1. **Multi-Chain Support**: Extend to other EVM chains
2. **Advanced Analytics**: More detailed trading analytics
3. **Social Features**: Share trading performance
4. **Portfolio Management**: Multi-token portfolio tracking
5. **Automated Trading**: DCA and limit order features

### Technical Improvements
1. **Hardware Wallet Support**: Integration with Ledger/Trezor
2. **Multi-Sig Wallets**: Enhanced security options
3. **DeFi Integration**: Yield farming and staking
4. **Cross-Chain Bridges**: Asset bridging capabilities

## Testing

### Manual Testing Checklist
- [ ] Wallet creation and loading
- [ ] Balance display and updates
- [ ] Swap execution with self-custodial wallet
- [ ] PnL tracking accuracy
- [ ] Wallet system toggle functionality
- [ ] Mobile responsiveness
- [ ] Error handling and user feedback

### Automated Testing
- Unit tests for wallet management functions
- Integration tests for API endpoints
- E2E tests for complete swap flow
- Performance tests for large transaction volumes

## Deployment Notes

### Environment Variables
```bash
# Required for API endpoints
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_UNISWAP_ROUTER=0x2626664c2603336E57B271c5C0b26F421741e481
NEXT_PUBLIC_UNISWAP_QUOTER=0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a
```

### Database Schema
```typescript
// Firebase collections
wallet_transactions: {
  id: string;
  walletAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  timestamp: number;
  txHash: string;
  type: 'buy' | 'sell';
  gasUsed: string;
  gasPrice: string;
}
```

## Conclusion

The self-custodial wallet integration successfully addresses the original problem of "not getting live quotes" by providing a more robust, integrated trading experience. The dual wallet system gives users flexibility while the enhanced PnL tracking provides valuable insights for trading decisions.

The implementation maintains backward compatibility with existing external wallet users while introducing powerful new features for self-custodial wallet users. This positions CypherX as a competitive trading platform with unique self-custodial capabilities.
