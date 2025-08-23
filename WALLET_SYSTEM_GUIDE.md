# Wallet System Guide

## Overview
The CypherX application features a comprehensive self-custodial wallet system that allows users to manage their cryptocurrency assets directly in the browser. This system provides full control over private keys while maintaining a user-friendly interface.

## Core Features

### 1. Self-Custodial Wallet
- **Full Control**: Users maintain complete control over their private keys
- **Browser Storage**: Wallet data is stored locally in browser localStorage
- **No Server Access**: Private keys never leave the user's device
- **Backup/Restore**: Secure backup and restore functionality

### 2. Wallet Management
- **Create Wallet**: Generate new wallet with fresh private key
- **Import Wallet**: Restore wallet from backup file
- **Load from Browser**: Access previously created wallet
- **Export Wallet**: Download backup file for safekeeping

### 3. Transaction History
- **Real Blockchain Data**: All transactions fetched from Base blockchain via Alchemy
- **Comprehensive History**: Shows all incoming/outgoing transfers
- **Professional UI**: Clean, consolidated transaction display
- **Auto-refresh**: Automatically loads transaction history when wallet is connected

## Technical Implementation

### Wallet Creation Process
```typescript
// Generate new wallet
const wallet = ethers.Wallet.createRandom();
const walletData = {
  address: wallet.address,
  privateKey: wallet.privateKey,
  mnemonic: wallet.mnemonic?.phrase
};
```

### Wallet Storage
- **Local Storage Key**: `selfCustodialWallet`
- **Data Structure**: 
  ```typescript
  interface WalletData {
    address: string;
    privateKey: string;
    mnemonic?: string;
    createdAt: number;
  }
  ```

### Transaction Fetching
```typescript
// Fetch from Alchemy API
const alchemyResponse = await fetch('/api/alchemy/wallet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: walletData.address,
    action: 'transactions',
    page: 1,
    limit: 20,
    filter: 'all'
  })
});
```

## API Endpoints

### `/api/alchemy/wallet`
Handles wallet-related operations through Alchemy:
- **Action: `transactions`** - Fetch transaction history
- **Action: `basic`** - Get basic wallet info
- **Action: `tokens`** - Get token balances

### `/api/wallet/balance`
Fetches current ETH balance for a wallet address.

## UI Components

### WalletDropdown.tsx
Main wallet interface component with:
- **Overview Tab**: Balance display, quick actions
- **Send/Receive Tab**: ETH transfer functionality
- **Transaction History**: Professional transaction list
- **Security Features**: Private key management

### Key Features:
- **Responsive Design**: Works on mobile and desktop
- **Professional Styling**: Clean, gradient-free design
- **Real-time Updates**: Auto-refreshes balance and transactions
- **Error Handling**: Comprehensive error states and user feedback

## Security Features

### Private Key Management
- **Secure Display**: Private key shown only when explicitly requested
- **Copy Functionality**: One-click copy to clipboard
- **Backup Reminders**: Persistent reminders to create backups

### Backup System
- **JSON Export**: Complete wallet data exported as JSON file
- **Import Validation**: Secure import with validation
- **Cross-device Support**: Backup files work across devices

### Security Guidelines
1. **Download and securely store your backup file**
2. **Keep your backup file private and secure**
3. **Use "Import Wallet" when switching devices**

## Transaction Features

### Send ETH
- **Recipient Address**: Input validation for Ethereum addresses
- **Amount Input**: Precise amount entry with balance display
- **Gas Estimation**: Automatic gas estimation
- **Transaction Signing**: Secure transaction signing process

### Receive ETH
- **Address Display**: Shows wallet address with copy functionality
- **QR Code**: Visual address representation
- **Address Validation**: Ensures correct address format

### Transaction History
- **Real Data**: All transactions from Base blockchain
- **Professional Display**: Clean, consolidated layout
- **Invisible Scrollbar**: Smooth scrolling without visual clutter
- **Transaction Details**: Hash, amount, timestamp, status

## Error Handling

### Common Error Scenarios
- **Network Issues**: Graceful handling of API failures
- **Invalid Addresses**: Clear error messages for invalid inputs
- **Insufficient Balance**: User-friendly balance warnings
- **Transaction Failures**: Detailed error reporting

### User Feedback
- **Toast Notifications**: Success/error messages
- **Loading States**: Clear loading indicators
- **Retry Logic**: Automatic retry for failed operations

## Integration Points

### Global State Management
- **Wallet Context**: Global wallet state management
- **Balance Updates**: Real-time balance synchronization
- **Transaction Updates**: Automatic transaction history refresh

### External Services
- **Alchemy API**: Blockchain data provider
- **Base Network**: Target blockchain network
- **Ethers.js**: Cryptography and transaction handling

## Performance Optimizations

### Data Fetching
- **Debounced Updates**: Prevents excessive API calls
- **Caching**: Local storage for wallet data
- **Lazy Loading**: Transaction history loaded on demand

### UI Performance
- **Virtual Scrolling**: Efficient transaction list rendering
- **Optimized Re-renders**: Minimal component updates
- **Memory Management**: Proper cleanup of event listeners

## Development Notes

### Key Dependencies
- `ethers.js`: Cryptography and blockchain interaction
- `react-hot-toast`: User notifications
- `framer-motion`: UI animations
- `lucide-react`: Icon library

### File Structure
```
app/components/
├── WalletDropdown.tsx      # Main wallet interface
├── WalletDisplay.tsx       # Wallet display component
└── SelfCustodialWallet.tsx # Wallet management logic

app/api/
├── alchemy/wallet/         # Alchemy API integration
└── wallet/                 # Wallet-specific endpoints
```

### Testing Considerations
- **Private Key Security**: Never log private keys
- **Network Testing**: Test on Base testnet first
- **Error Scenarios**: Test all error conditions
- **Cross-browser**: Test across different browsers

## Future Enhancements

### Planned Features
- **Multi-chain Support**: Support for additional networks
- **Token Management**: ERC-20 token support
- **Transaction Batching**: Multiple transaction support
- **Advanced Security**: Hardware wallet integration

### Performance Improvements
- **WebSocket Updates**: Real-time transaction updates
- **Offline Support**: Basic offline functionality
- **Transaction History**: Extended history with pagination
- **Export Options**: CSV/PDF transaction reports

## Troubleshooting

### Common Issues
1. **Wallet Not Loading**: Check localStorage and browser permissions
2. **Transaction Failures**: Verify network connection and gas settings
3. **Balance Not Updating**: Check Alchemy API status
4. **Import Failures**: Validate backup file format

### Debug Information
- **Console Logs**: Detailed logging for debugging
- **Network Tab**: Monitor API requests
- **Local Storage**: Check wallet data integrity
- **Error Boundaries**: React error boundary implementation

## Security Best Practices

### For Users
- **Regular Backups**: Create backups frequently
- **Secure Storage**: Store backups in secure locations
- **Device Security**: Keep devices secure and updated
- **Phishing Awareness**: Never share private keys

### For Developers
- **Code Review**: Regular security audits
- **Dependency Updates**: Keep dependencies updated
- **Input Validation**: Validate all user inputs
- **Error Handling**: Don't expose sensitive information in errors
