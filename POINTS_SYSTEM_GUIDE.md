# Points & Tier System Implementation Guide

## Overview

This comprehensive points and tier system is designed to reward user engagement across your Web3 DApp while preventing farming and ensuring fair distribution. The system includes multiple engagement channels, anti-farming measures, and a tier-based reward structure.

## System Architecture

### Core Components

1. **Points APIs** - Handle different engagement types
2. **Tier System** - Bronze → Silver → Gold → Platinum → Diamond
3. **Badge System** - Achievement-based rewards
4. **Engagement Tracking** - Time-based and activity-based points
5. **Anti-Farming Measures** - Daily limits and session tracking

### Database Collections

- `users` - User profiles, points, tiers, badges
- `user_activities` - All user activities and points earned
- `leaderboard` - Global leaderboard rankings
- `daily_activities` - Daily engagement tracking (embedded in users)

## Points Distribution

### 1. Trading/Swap Points (`/api/points/swap`)

**Volume-based rewards:**
- $100-999: 5 points per $100
- $1,000-4,999: 15 points per $250
- $5,000-9,999: 25 points per $500
- $10,000+: 50 points per $1,000

**Bonuses:**
- First-time swap on new token: +25 points
- High-volume trader bonuses
- Gas efficiency rewards

**Anti-farming:**
- Minimum swap amount: $10
- Maximum daily volume: $100,000
- Cooldown periods for rapid swaps

### 2. Calendar Engagement (`/api/points/calendar`)

**Event interactions:**
- RSVP: 10 points
- Like: 5 points
- Dislike: 2 points (feedback)
- Comment: 15 points
- Share: 20 points
- Attend: 25 points
- Create event: 50 points

**Daily limits:**
- RSVP: 10/day
- Like: 20/day
- Comment: 15/day
- Share: 5/day
- Create event: 3/day

### 3. News/Content Engagement (`/api/points/news`)

**Article interactions:**
- Read: 10 points
- Like: 5 points (author gets 2 points)
- Comment: 15 points (author gets 5 points)
- Quality comment: 20-25 points (author gets 8-10 points)
- Share: 20 points (author gets 10 points)
- Publish article: 100 points

**Author rewards:**
- Points for engagement on their content
- Quality content bonuses
- Viral content multipliers

### 4. Engagement Time (`/api/points/engagement`)

**Session-based rewards:**
- 30 minutes - 2 hours: 20 points per hour
- Maximum 40 points per session
- Heartbeat rewards: 1 point every 5 minutes
- Page views: 2 points each
- Interactions: 1-3 points based on type

**Anti-farming:**
- Maximum 8 hours per day
- Maximum 10 sessions per day
- Session cooldown periods

## Tier System

### Bronze (0 points)
- Basic access to all features
- Standard support

### Silver (500 points)
- Priority support
- Early access to new features
- Custom profile badge

### Gold (2,000 points)
- Exclusive content access
- Higher airdrop multipliers
- VIP community access

### Platinum (5,000 points)
- Whitelist priority
- Governance voting rights
- Exclusive events access

### Diamond (10,000 points)
- All benefits
- Custom NFT rewards
- Direct team access
- Revenue sharing

## Badge System

### Trading Badges
- **First Swap**: 25 points
- **Volume Trader**: 100 points ($10k+ volume)
- **Whale Trader**: 500 points ($100k+ volume)

### Engagement Badges
- **Daily User**: 50 points (7 consecutive days)
- **Weekly User**: 200 points (30 consecutive days)
- **Power User**: 500 points (100 consecutive days)

### Content Badges
- **Content Creator**: 100 points (first article)
- **Popular Author**: 200 points (100+ likes)
- **Viral Author**: 500 points (1000+ views)

### Community Badges
- **Event Organizer**: 150 points (5+ events)
- **Community Leader**: 200 points (50+ comment likes)
- **Influencer**: 300 points (100+ shares)

## Implementation Steps

### 1. Frontend Integration

```typescript
// Example: Swap points integration
const handleSwap = async (swapData) => {
  try {
    const response = await fetch('/api/points/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        userId: user.uid,
        tokenAddress: swapData.tokenAddress,
        tokenSymbol: swapData.symbol,
        volumeUSD: swapData.volumeUSD,
        transactionHash: swapData.txHash,
        swapType: swapData.type,
        gasUsed: swapData.gasUsed,
        gasPrice: swapData.gasPrice
      })
    });
    
    const result = await response.json();
    if (result.success) {
      toast.success(`Swap completed! +${result.pointsEarned} points`);
      updateUserPoints(result.totalPoints);
    }
  } catch (error) {
    console.error('Error processing swap points:', error);
  }
};
```

### 2. Engagement Tracking

```typescript
// Example: Session tracking
useEffect(() => {
  const sessionId = generateSessionId();
  const startTime = Date.now();
  
  // Start session
  fetch('/api/points/engagement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress,
      userId: user.uid,
      sessionId,
      action: 'start_session'
    })
  });
  
  // Heartbeat every 5 minutes
  const heartbeat = setInterval(() => {
    fetch('/api/points/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        userId: user.uid,
        sessionId,
        action: 'heartbeat'
      })
    });
  }, 5 * 60 * 1000);
  
  // End session on unmount
  return () => {
    clearInterval(heartbeat);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    
    fetch('/api/points/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        userId: user.uid,
        sessionId,
        action: 'end_session',
        timeSpent
      })
    });
  };
}, []);
```

### 3. User Profile Integration

```typescript
// Add to your user profile page
import UserProfileDashboard from '@/components/UserProfileDashboard';

export default function ProfilePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">My Profile</h1>
      <UserProfileDashboard />
    </div>
  );
}
```

## Anti-Farming Measures

### 1. Daily Limits
- All activities have daily limits
- Limits reset at midnight UTC
- Progressive limits based on user tier

### 2. Session Tracking
- Maximum session length: 2 hours
- Cooldown between sessions: 30 minutes
- Heartbeat verification every 5 minutes

### 3. Volume Verification
- Minimum swap amounts
- Gas cost verification
- Transaction hash validation

### 4. Quality Checks
- Comment length requirements
- Engagement time verification
- Duplicate activity detection

## Monitoring & Analytics

### Key Metrics to Track
- Points distribution by activity type
- User engagement patterns
- Tier progression rates
- Badge completion rates
- Anti-farming detection

### Dashboard Queries
```sql
-- Daily points distribution
SELECT DATE(createdAt), action, SUM(points) 
FROM user_activities 
GROUP BY DATE(createdAt), action;

-- Tier distribution
SELECT tier, COUNT(*) 
FROM users 
GROUP BY tier;

-- Top earners
SELECT walletAddress, points 
FROM leaderboard 
ORDER BY points DESC 
LIMIT 100;
```

## Future Enhancements

### 1. Token Integration
- Points → Token conversion rates
- Airdrop multipliers based on tier
- Staking rewards for high-tier users

### 2. Governance
- Voting power based on tier
- Proposal creation rights
- Community moderation privileges

### 3. Exclusive Features
- Early access to new features
- Beta testing opportunities
- Custom NFT rewards

### 4. Partnerships
- Cross-platform point sharing
- Partner project integrations
- Referral reward systems

## Security Considerations

### 1. Rate Limiting
- API rate limits per wallet
- IP-based restrictions
- Suspicious activity detection

### 2. Data Validation
- Input sanitization
- Transaction verification
- Duplicate prevention

### 3. Access Control
- Admin-only badge awarding
- Tier modification controls
- Points adjustment logging

## Testing Strategy

### 1. Unit Tests
- Points calculation accuracy
- Tier progression logic
- Badge awarding conditions

### 2. Integration Tests
- API endpoint functionality
- Database consistency
- Anti-farming effectiveness

### 3. Load Testing
- High-volume user simulation
- Concurrent activity handling
- Performance under load

## Deployment Checklist

- [ ] Deploy all API endpoints
- [ ] Set up database indexes
- [ ] Configure rate limiting
- [ ] Set up monitoring
- [ ] Test anti-farming measures
- [ ] Deploy frontend components
- [ ] Configure admin controls
- [ ] Set up analytics tracking

## Support & Maintenance

### Regular Tasks
- Monitor daily limits effectiveness
- Adjust point values based on usage
- Review and update badge criteria
- Analyze user engagement patterns

### Emergency Procedures
- Suspend suspicious accounts
- Adjust anti-farming parameters
- Emergency points freeze
- Rollback procedures

This system provides a comprehensive foundation for user engagement while maintaining fairness and preventing abuse. The modular design allows for easy expansion and modification as your platform grows. 