# CypherX Point Economy System

## Overview
A comprehensive point economy where users can earn points through engagement and spend them on premium features. Points will eventually be convertible to native tokens.

## Point Costs (Spending)

### Content Creation
- **Post Article**: 50 points
- **Post Comment**: 5 points
- **Submit Token**: 25 points
- **Create Index**: 100 points
- **Submit News**: 15 points

### Premium Features
- **Alpha Boost**: 25 points (1x daily, increases trending score)
- **Featured Article**: 75 points
- **Priority Listing**: 30 points
- **Custom Badge**: 100 points
- **Profile Customization**: 50 points

### Trading Features
- **Advanced Charts**: 10 points/day
- **Real-time Alerts**: 20 points/day
- **Portfolio Analytics**: 15 points/day

## Point Earnings (Income)

### Content Engagement
- **Read Article**: +1 point (daily limit: 10)
- **Like Article**: +2 points (daily limit: 20)
- **Comment on Article**: +5 points (daily limit: 10)
- **Share Article**: +3 points (daily limit: 5)
- **Bookmark Article**: +1 point (daily limit: 10)

### Content Creation Rewards
- **Article Gets 10+ Likes**: +10 points
- **Article Gets 50+ Views**: +15 points
- **Article Gets Featured**: +50 points
- **Comment Gets 5+ Likes**: +5 points
- **Comment Gets Pinned**: +20 points

### Community Engagement
- **Daily Login**: +5 points
- **Complete Profile**: +25 points
- **Refer New User**: +50 points
- **Weekly Streak (7 days)**: +100 points
- **Monthly Streak (30 days)**: +500 points

### Alpha & Insights
- **Submit Alpha**: +10 points
- **Alpha Gets Verified**: +25 points
- **Alpha Gets 10+ Upvotes**: +15 points
- **Report Scam Token**: +5 points
- **Submit Market Analysis**: +20 points

### Trading & Analysis
- **Connect Wallet**: +25 points
- **Make First Trade**: +50 points
- **Complete Tutorial**: +30 points
- **Submit Token Review**: +15 points
- **Create Watchlist**: +10 points

## Alpha Boost System

### Daily Alpha Boost (25 points)
- **Effect**: Increases article trending score by 50%
- **Duration**: 24 hours
- **Cooldown**: 24 hours per article
- **Stacking**: Can boost multiple articles per day
- **Bonus**: Boosted articles get priority in trending algorithm

### Alpha Boost Multipliers
- **Tier 1 (Normie)**: 1.5x trending score
- **Tier 2 (Degen)**: 2.0x trending score  
- **Tier 3 (Whale)**: 2.5x trending score
- **Tier 4 (Legend)**: 3.0x trending score

## Trending Score Algorithm

### Base Score Factors
- **Views**: +1 point per view
- **Likes**: +5 points per like
- **Comments**: +3 points per comment
- **Shares**: +10 points per share
- **Bookmarks**: +2 points per bookmark
- **Time Decay**: -10% per day after 24 hours

### Alpha Boost Multiplier
- **Base Trending Score × Alpha Boost Multiplier = Final Score**

### Additional Factors
- **Author Reputation**: +20% for verified authors
- **Content Quality**: +15% for articles with high engagement
- **Freshness**: +25% for articles under 6 hours old
- **Category Bonus**: +10% for trending categories

## Tier System Integration

### Point Requirements
- **Normie**: 0-999 points
- **Degen**: 1,000-4,999 points
- **Whale**: 5,000-19,999 points
- **Legend**: 20,000+ points

### Tier Benefits
- **Higher Alpha Boost Multipliers**
- **Reduced Point Costs**
- **Exclusive Features**
- **Priority Support**
- **Custom Badges**

## Creative Integrations

### Gamification
- **Daily Challenges**: Complete 5 actions for bonus points
- **Weekly Quests**: Submit 3 articles, get 10 comments, etc.
- **Achievement System**: Unlock badges for milestones
- **Leaderboards**: Top earners, most active, best content

### Social Features
- **Point Gifting**: Send points to other users (with limits)
- **Point Pools**: Community pools for events/contests
- **Point Betting**: Bet points on market predictions
- **Point Auctions**: Bid points for exclusive features

### Content Monetization
- **Tip System**: Tip authors with points
- **Premium Content**: Pay points to access exclusive articles
- **Early Access**: Pay points to see content before others
- **Custom Requests**: Pay points for specific content

### Trading Integration
- **Portfolio Tracking**: Earn points for maintaining active portfolio
- **Trade Analysis**: Earn points for sharing trade insights
- **Market Predictions**: Earn points for accurate predictions
- **Risk Management**: Earn points for good risk practices

## Technical Implementation

### Database Schema
```typescript
interface UserPoints {
  userId: string;
  walletAddress: string;
  points: number;
  tier: string;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: Date;
  streakDays: number;
  lastLogin: Date;
}

interface PointTransaction {
  id: string;
  userId: string;
  action: string;
  points: number;
  description: string;
  timestamp: Date;
  metadata?: any;
}

interface AlphaBoost {
  id: string;
  userId: string;
  articleId: string;
  cost: number;
  multiplier: number;
  expiresAt: Date;
  createdAt: Date;
}
```

### API Endpoints
- `POST /api/points/earn` - Earn points for actions
- `POST /api/points/spend` - Spend points on features
- `GET /api/points/balance` - Get user point balance
- `POST /api/points/alpha-boost` - Apply alpha boost
- `GET /api/points/transactions` - Get transaction history
- `POST /api/points/gift` - Gift points to another user

### Real-time Updates
- WebSocket integration for live point updates
- Push notifications for point earnings
- Live leaderboard updates
- Real-time trending score calculations

## Future Token Integration

### Conversion System
- **Point to Token Ratio**: 1000 points = 1 token (adjustable)
- **Minimum Conversion**: 10,000 points
- **Conversion Fee**: 5% (reduces with tier level)
- **Lock Period**: 30 days after conversion

### Token Utility
- **Governance**: Vote on platform decisions
- **Staking**: Earn rewards by staking tokens
- **Premium Access**: Access exclusive features
- **Revenue Sharing**: Share in platform revenue

## Security & Anti-Abuse

### Rate Limiting
- **Daily Limits**: Prevent farming
- **Cooldown Periods**: Between similar actions
- **IP Tracking**: Prevent multiple accounts
- **Behavior Analysis**: Detect suspicious patterns

### Verification
- **Wallet Verification**: Require connected wallet
- **Content Moderation**: Review before rewarding
- **Community Reporting**: Report abuse
- **Automated Detection**: AI-powered abuse detection

## Analytics & Insights

### User Analytics
- **Point Flow**: Track earning vs spending
- **Engagement Metrics**: Measure user activity
- **Content Performance**: Analyze what works
- **Retention Analysis**: Track user retention

### Platform Analytics
- **Economic Health**: Monitor point inflation/deflation
- **Feature Usage**: Track feature adoption
- **Revenue Impact**: Measure monetization
- **User Satisfaction**: Track user feedback
