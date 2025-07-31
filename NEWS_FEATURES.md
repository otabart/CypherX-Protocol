# News Features Documentation

## Overview
The news system has been enhanced with a comprehensive points system, user interactions, and leaderboard functionality. Users can now earn points for various activities and compete on a leaderboard.

## Features

### Points System
Users earn points for the following activities:
- **Reading Articles**: 10 points per article view
- **Liking Articles**: 5 points per like
- **Sharing Articles**: 10 points per share (X/Twitter or Telegram)
- **Commenting**: 15 points per comment
- **Disliking**: 0 points (no reward for dislikes)

### User Interactions

#### Article Interactions
- **Like/Unlike**: Users can like articles to earn points
- **Dislike**: Users can dislike articles (no points earned)
- **Share**: Share articles on X/Twitter or Telegram
- **Comment**: Add comments to articles
- **View Tracking**: Automatic tracking when users read articles

#### Real-time Updates
- Article stats (views, likes, dislikes) update in real-time
- User points update immediately after actions
- Leaderboard updates automatically

### Leaderboard System
- **Global Leaderboard**: Shows top users by points
- **User Ranking**: Individual user rankings
- **Real-time Updates**: Leaderboard updates as users earn points

### User Stats
- **Points Total**: Total points earned
- **Activity History**: Recent user activities
- **Liked Articles**: Articles the user has liked
- **Rank**: User's current leaderboard rank

## API Endpoints

### User Activities
- `GET /api/user-activities` - Fetch user activities
- `POST /api/user-activities` - Create new user activity

### Leaderboard
- `GET /api/leaderboard` - Fetch leaderboard data
- `GET /api/leaderboard?walletAddress=...` - Get specific user rank

### User Stats
- `GET /api/user/stats` - Fetch user statistics

### Article Interactions
- `POST /api/articles/[slug]/interactions` - Handle article interactions

## Database Collections

### users
Stores user data including:
- `walletAddress`: User's wallet address
- `points`: Total points earned
- `likedArticles`: Array of liked article slugs
- `dislikedArticles`: Array of disliked article slugs
- `createdAt`: Account creation timestamp
- `lastActivity`: Last activity timestamp

### user_activities
Tracks all user activities:
- `userId`: User ID
- `walletAddress`: User's wallet address
- `action`: Activity type (read_article, like_article, etc.)
- `points`: Points earned for this activity
- `articleSlug`: Related article slug (if applicable)
- `articleId`: Related article ID (if applicable)
- `metadata`: Additional activity data
- `createdAt`: Activity timestamp

### leaderboard
Global leaderboard data:
- `walletAddress`: User's wallet address
- `points`: Total points
- `createdAt`: Entry creation timestamp
- `lastUpdated`: Last update timestamp

### articles
Enhanced article data:
- `views`: View count
- `upvotes`: Like count
- `downvotes`: Dislike count
- `comments`: Array of comments
- `category`: Article category
- `excerpt`: Article excerpt

## Usage Examples

### Fetching User Stats
```javascript
import { fetchUserStats } from '@/lib/news-api';

const stats = await fetchUserStats(walletAddress);
console.log(`User has ${stats.stats.points} points`);
console.log(`User rank: #${stats.stats.rank}`);
```

### Interacting with Articles
```javascript
import { interactWithArticle } from '@/lib/news-api';

// Like an article
const result = await interactWithArticle(
  'article-slug',
  'like',
  userId,
  walletAddress
);

// Share an article
const result = await interactWithArticle(
  'article-slug',
  'share',
  userId,
  walletAddress,
  'x' // platform
);

// Comment on an article
const result = await interactWithArticle(
  'article-slug',
  'comment',
  userId,
  walletAddress,
  undefined,
  'Great article!'
);
```

### Fetching Leaderboard
```javascript
import { fetchLeaderboard } from '@/lib/news-api';

const leaderboard = await fetchLeaderboard(10); // Top 10 users
console.log('Top user:', leaderboard.leaderboard[0]);
```

## Setup Instructions

1. **Environment Variables**: Ensure Firebase configuration is set up
2. **Database Rules**: Configure Firestore security rules for the new collections
3. **Sample Data**: Run the sample articles script to populate test data

### Running Sample Data Script
```bash
node scripts/add-sample-articles.js
```

## Security Considerations

- All API endpoints validate user authentication
- Points are only awarded for legitimate actions
- Rate limiting should be implemented for production
- User data is protected by wallet address verification

## Future Enhancements

- **Achievement System**: Badges for milestones
- **Referral System**: Points for referring new users
- **Content Creation**: Points for creating articles
- **Moderation**: Community moderation with points
- **Rewards**: Token rewards for high-performing users 