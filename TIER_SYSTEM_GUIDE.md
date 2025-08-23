# Tier System Guide

## Overview
The CypherX application features a comprehensive tier system that rewards user engagement and activity. Users progress through different tiers by earning points through various activities, unlocking new features and benefits as they advance.

## Tier Structure

### Tier Levels
1. **Normie** - Entry level tier (0-1,999 points)
2. **Degen** - Intermediate tier (2,000-7,999 points)
3. **Alpha** - Advanced tier (8,000-19,999 points)
4. **Mogul** - Premium tier (20,000-49,999 points)
5. **Titan** - Elite tier (50,000+ points)

### Tier Requirements
Each tier has specific point requirements and unlocks different features:
- **Normie**: 0-1,999 points
- **Degen**: 2,000-7,999 points
- **Alpha**: 8,000-19,999 points
- **Mogul**: 20,000-49,999 points
- **Titan**: 50,000+ points

## Points System

### Earning Points
Users can earn points through various activities:

#### Daily Activities
- **Daily Login**: 10 points per day
- **Daily Trading**: 25 points per trade
- **Daily Engagement**: 15 points for interactions

#### Trading Activities
- **Successful Trades**: 50 points per trade
- **Large Volume Trades**: Bonus points for high-value trades
- **New Token Discovery**: 100 points for trading new tokens

#### Community Activities
- **Article Comments**: 5 points per comment
- **Voting on Indexes**: 10 points per vote
- **Sharing Content**: 15 points per share
- **Referrals**: 500 points per successful referral

#### Special Events
- **Participation in Events**: 200 points
- **Winning Competitions**: 1000 points
- **Early Adopter Bonus**: 500 points

### Point Calculation
```typescript
interface PointCalculation {
  basePoints: number;
  multiplier: number;
  bonusPoints: number;
  totalPoints: number;
}
```

## API Endpoints

### `/api/points/engagement`
Handles engagement-based point calculations:
- **Article Interactions**: Reading, commenting, sharing
- **Social Features**: Following, liking, sharing
- **Community Participation**: Voting, discussions

### `/api/points/swap`
Handles trading-based point calculations:
- **Trade Volume**: Points based on trade size
- **Trade Frequency**: Daily trading bonuses
- **New Token Trading**: Discovery bonuses

### `/api/points/calendar`
Handles calendar-based point calculations:
- **Daily Streaks**: Consecutive day bonuses
- **Weekly Goals**: Weekly achievement bonuses
- **Monthly Milestones**: Monthly progress rewards

### `/api/points/news`
Handles news-based point calculations:
- **Article Reading**: Points for reading news
- **Comment Engagement**: Points for commenting
- **Sharing News**: Points for sharing articles

### `/api/points/indexes`
Handles index-based point calculations:
- **Voting Participation**: Points for voting on indexes
- **Index Creation**: Points for creating new indexes
- **Index Management**: Points for managing indexes

## User Progression

### Tier Advancement
Users automatically advance to higher tiers when they reach the required point thresholds:

```typescript
interface TierProgression {
  currentTier: string;
  currentPoints: number;
  nextTier: string;
  pointsToNextTier: number;
  progressPercentage: number;
}
```

### Tier Benefits
Each tier unlocks specific features and benefits:

#### Normie Tier
- **Basic Features**: Access to core trading features
- **Standard Support**: Basic customer support
- **Community Access**: Basic community features
- **Basic Trading Tools**: Standard trading functionality
- **Profile Customization**: Basic profile features
- **Basic Notifications**: Standard notification system
- **Discord Role**: Normie role in Discord

#### Degen Tier
- **All Normie Benefits**: Plus enhanced features
- **Priority Support**: Faster customer support
- **Early Access**: Access to new features
- **Custom Profile Badge**: Enhanced profile customization
- **Reduced Swap Fees**: 0.05% swap fees (vs 0.06%)
- **Airdrop Eligibility**: 1x allocation for airdrops
- **Exclusive Discord Channels**: Access to Degen channels
- **Advanced Trading Tools**: Enhanced trading features
- **Discord Role**: Degen role in Discord

#### Alpha Tier
- **All Degen Benefits**: Plus premium features
- **Exclusive Content Access**: Premium content and insights
- **VIP Community Access**: Enhanced community features
- **Governance Voting Rights**: Platform governance participation
- **Whitelist Priority**: Priority access to whitelists
- **Premium Swap Fees**: 0.04% swap fees
- **Airdrop Eligibility**: 2x allocation for airdrops
- **Premium Trading Features**: Advanced trading tools
- **Custom NFT Rewards**: Exclusive NFT rewards
- **Direct Team Access**: Direct communication with team
- **Revenue Sharing Opportunities**: Platform revenue sharing
- **Discord Role**: Alpha role + Alpha chat access

#### Mogul Tier
- **All Alpha Benefits**: Plus elite features
- **Exclusive Events Access**: VIP event access
- **Custom NFT Rewards**: Enhanced NFT rewards
- **Direct Team Access**: Direct team communication
- **Elite Swap Fees**: 0.03% swap fees
- **Airdrop Eligibility**: 3x allocation for airdrops
- **Early Access to New Tools**: Priority access to new features
- **Revenue Sharing Opportunities**: Enhanced revenue sharing
- **Platform Partnership Opportunities**: Partnership access
- **VIP Customer Service**: Premium customer support
- **Custom Platform Features**: Exclusive platform features
- **Immortal Status**: Permanent community recognition
- **Discord Role**: Mogul role + exclusive channels

#### Titan Tier
- **ALL PREVIOUS BENEFITS**: Complete access to all features
- **Legendary Status**: Highest tier recognition
- **Legendary Swap Fees**: 0.02% swap fees
- **Airdrop Eligibility**: 5x allocation for airdrops
- **Platform Partnership Opportunities**: Highest tier partnerships
- **Immortal Status**: Permanent legendary status
- **Custom Platform Features**: Exclusive Titan features
- **Exclusive Titan-only Events**: Titan-specific events
- **Direct CEO Access**: Direct CEO communication
- **Revenue Sharing at Highest Tier**: Maximum revenue sharing
- **Platform Governance Rights**: Full governance participation
- **Custom Integrations**: Exclusive integrations
- **Priority Tool Access**: First access to all tools
- **Discord Role**: Titan role + all channels

## UI Components

### TierDisplay.tsx
Main tier display component showing:
- **Current Tier**: Visual tier representation
- **Progress Bar**: Progress to next tier
- **Points Display**: Current point total
- **Benefits List**: Available tier benefits

### TierProgressionModal.tsx
Modal for tier progression showing:
- **Tier Comparison**: Current vs next tier benefits
- **Progress Details**: Detailed progress information
- **Achievement Celebration**: Tier advancement celebration
- **Next Steps**: Guidance for reaching next tier

### Key Features:
- **Visual Progress**: Clear progress indicators
- **Benefit Preview**: Preview of next tier benefits
- **Motivation System**: Encourages continued engagement
- **Achievement Tracking**: Tracks user achievements

## Points Tracking

### Real-time Updates
Points are updated in real-time as users perform activities:
- **Immediate Updates**: Points added immediately
- **Progress Tracking**: Real-time progress updates
- **Achievement Notifications**: Instant achievement notifications

### Historical Data
Complete history of point earnings and tier progression:
- **Point History**: Detailed point earning history
- **Tier History**: Complete tier progression history
- **Activity Log**: All user activities and points earned

## Integration Points

### Global State Management
- **Points Context**: Global points state management
- **Tier Context**: Global tier state management
- **Progress Updates**: Real-time progress synchronization

### External Services
- **Firebase**: User data and points storage
- **Analytics**: User behavior tracking
- **Notifications**: Achievement notifications

## Performance Optimizations

### Data Fetching
- **Caching**: Points data cached locally
- **Incremental Updates**: Only fetch new data
- **Background Sync**: Background data synchronization

### UI Performance
- **Optimized Rendering**: Efficient component updates
- **Lazy Loading**: Load tier data on demand
- **Memory Management**: Proper cleanup of listeners

## Development Notes

### Key Dependencies
- `firebase`: User data and points storage
- `react-hot-toast`: Achievement notifications
- `framer-motion`: Progress animations
- `lucide-react`: Tier icons

### File Structure
```
app/components/
├── TierDisplay.tsx           # Tier display component
├── TierProgressionModal.tsx  # Tier progression modal
└── UserProfileDashboard.tsx  # User profile with tier info

app/api/points/
├── engagement/               # Engagement points
├── swap/                    # Trading points
├── calendar/                # Calendar points
├── news/                    # News points
└── indexes/                 # Index points
```

### Database Schema
```typescript
interface UserPoints {
  userId: string;
  totalPoints: number;
  currentTier: string;
  pointsHistory: PointEntry[];
  tierHistory: TierEntry[];
  lastUpdated: Date;
}

interface PointEntry {
  id: string;
  points: number;
  activity: string;
  timestamp: Date;
  metadata?: any;
}

interface TierEntry {
  tier: string;
  achievedAt: Date;
  pointsAtAchievement: number;
}
```

## Testing Considerations

### Point Calculation Testing
- **Accuracy**: Verify point calculations are correct
- **Edge Cases**: Test boundary conditions
- **Performance**: Test with large point volumes
- **Concurrency**: Test simultaneous point updates

### Tier Progression Testing
- **Automatic Advancement**: Test tier advancement logic
- **Benefit Unlocking**: Test feature unlocking
- **Rollback Scenarios**: Test point deduction scenarios
- **Data Integrity**: Test data consistency

## Future Enhancements

### Planned Features
- **Seasonal Events**: Special point events
- **Team Challenges**: Collaborative point earning
- **Leaderboards**: Competitive point rankings
- **Point Marketplace**: Exchange points for rewards

### Performance Improvements
- **WebSocket Updates**: Real-time point updates
- **Offline Support**: Offline point tracking
- **Advanced Analytics**: Detailed point analytics
- **Predictive Modeling**: Predict user progression

## Troubleshooting

### Common Issues
1. **Points Not Updating**: Check API connectivity and user authentication
2. **Tier Not Advancing**: Verify point calculation logic
3. **Benefits Not Unlocking**: Check tier benefit configuration
4. **Progress Not Showing**: Verify UI component rendering

### Debug Information
- **Point Logs**: Detailed point calculation logs
- **Tier Logs**: Tier progression logs
- **User Activity**: Complete user activity tracking
- **Performance Metrics**: Point system performance data

## Security Considerations

### Point Integrity
- **Server-side Validation**: All point calculations validated server-side
- **Anti-cheat Measures**: Detection of suspicious point earning patterns
- **Audit Trail**: Complete audit trail of all point changes
- **Rate Limiting**: Prevent excessive point earning

### Data Protection
- **User Privacy**: Protect user point and activity data
- **Secure Storage**: Encrypt sensitive point data
- **Access Control**: Restrict access to point data
- **Compliance**: Ensure compliance with data protection regulations

## Best Practices

### For Users
- **Regular Activity**: Maintain regular engagement for consistent point earning
- **Goal Setting**: Set realistic tier advancement goals
- **Community Participation**: Engage with community features
- **Referral Program**: Utilize referral program for bonus points

### For Developers
- **Point Balance**: Ensure point system is balanced and fair
- **User Experience**: Make tier progression engaging and rewarding
- **Performance**: Optimize point calculations for performance
- **Scalability**: Design system to handle growing user base
