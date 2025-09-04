# CypherX - Advanced DeFi Analytics Platform

CypherX is a comprehensive decentralized finance (DeFi) analytics and trading platform built on the Base network. The platform provides real-time market data, advanced trading tools, wallet analytics, and a sophisticated multi-DEX swap system.

## 🚀 Features

### Trading & Swapping
- **Multi-DEX Aggregation**: Advanced quote aggregation across multiple DEXes and aggregators
- **Safety-First Design**: Comprehensive safety measures to protect user investments
- **Real-Time Quotes**: Live price feeds and quote comparison
- **Professional UI**: Clean, modern interface optimized for trading

### Analytics & Insights
- **Wallet Explorer**: Comprehensive wallet analysis and transaction history
- **Block Explorer**: Real-time blockchain data and block analysis
- **Token Analytics**: Detailed token information and market data
- **Portfolio Tracking**: Advanced P&L tracking and performance metrics

### Social Features
- **Mindshare Leaderboard**: Community-driven token discovery
- **User Profiles**: Comprehensive user analytics and achievements
- **Referral System**: Built-in referral and rewards program
- **Points System**: Gamified user engagement and rewards

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Firebase Admin SDK
- **Blockchain**: Base Network, Ethers.js, Alchemy API
- **Data Sources**: DexScreener, CoinGecko, 0x Protocol, 1inch
- **Authentication**: Firebase Authentication
- **Database**: Firestore
- **Deployment**: Vercel

## 🏗️ Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── alchemy/       # Blockchain data APIs
│   │   ├── swap/          # Multi-DEX swap system
│   │   └── ...            # Other API endpoints
│   ├── components/        # React components
│   ├── explorer/          # Block and wallet explorer
│   ├── trade/             # Trading interface
│   └── ...                # Other pages
├── lib/                   # Utility libraries
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
└── public/                # Static assets
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project setup
- Alchemy API key
- Base network RPC URL

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cypherx
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file with the following variables:
   ```bash
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # Blockchain Configuration
   NEXT_PUBLIC_ALCHEMY_API_URL=https://base-mainnet.g.alchemy.com/v2/your_key
   NEXT_PUBLIC_RPC_URL=https://base-mainnet.g.alchemy.com/v2/your_key

   # API Keys
   ZEROX_API_KEY=your_0x_api_key
   INCH_API_KEY=your_1inch_api_key

   # Firebase Admin (Server-side)
   FIREBASE_ADMIN_PRIVATE_KEY=your_private_key
   FIREBASE_ADMIN_CLIENT_EMAIL=your_client_email
   FIREBASE_ADMIN_PROJECT_ID=your_project_id
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Documentation

### Swap System
For detailed information about the multi-DEX swap system, safety measures, and API documentation, see:
- [SWAP_SYSTEM_DOCUMENTATION.md](./SWAP_SYSTEM_DOCUMENTATION.md)

### API Endpoints
- `/api/swap/quote` - Get quotes from multiple DEXes
- `/api/swap/prepare` - Prepare swap transactions
- `/api/alchemy/wallet` - Wallet data and analytics
- `/api/alchemy/transaction` - Transaction details

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Tailwind CSS for styling
- Component-based architecture

## 🛡️ Safety & Security

The platform implements comprehensive safety measures:
- Multi-layer price validation
- Slippage protection
- Quote expiration handling
- Price impact limits
- Liquidity requirements
- MEV protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, questions, or feature requests:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🎯 Roadmap

- [ ] Multi-chain support (Ethereum, Polygon, Arbitrum)
- [ ] Advanced MEV protection
- [ ] Mobile application
- [ ] Institutional features
- [ ] API for third-party integrations

---

**Built with ❤️ for the DeFi community**