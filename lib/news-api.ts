// Utility functions for news API calls

export interface UserActivity {
  userId: string;
  walletAddress: string;
  action: string;
  points: number;
  articleSlug?: string;
  articleId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface LeaderboardEntry {
  walletAddress: string;
  points: number;
  rank?: number;
  lastUpdated?: string;
  createdAt?: string;
}

export interface UserStats {
  user: {
    likedArticles?: string[];
    dislikedArticles?: string[];
    [key: string]: unknown;
  } | null;
  rank: number | null;
  activities: UserActivity[];
  activitySummary: Record<string, number>;
  totalPoints: number;
  stats: {
    totalActivities: number;
    likedArticles: number;
    points: number;
    rank: number | null;
  };
}

// User Activities API
export async function fetchUserActivities(walletAddress: string, limit: number = 10, action?: string) {
  const params = new URLSearchParams({
    walletAddress,
    limit: limit.toString(),
  });
  
  if (action) {
    params.append('action', action);
  }

  const response = await fetch(`/api/user-activities?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user activities');
  }
  
  return response.json();
}

export async function createUserActivity(activity: Omit<UserActivity, 'createdAt'>) {
  const response = await fetch('/api/user-activities', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(activity),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create user activity');
  }
  
  return response.json();
}

// Leaderboard API
export async function fetchLeaderboard(top: number = 10) {
  const params = new URLSearchParams({
    top: top.toString(),
  });

  const response = await fetch(`/api/leaderboard?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
  }
  
  return response.json();
}

export async function fetchUserRank(walletAddress: string) {
  const params = new URLSearchParams({
    walletAddress,
  });

  const response = await fetch(`/api/leaderboard?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user rank');
  }
  
  return response.json();
}

// User Stats API
export async function fetchUserStats(walletAddress: string): Promise<UserStats> {
  const params = new URLSearchParams({
    walletAddress,
  });

  const response = await fetch(`/api/user/stats?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user stats');
  }
  
  return response.json();
}

// Article Interactions API
export async function interactWithArticle(
  slug: string,
  action: 'like' | 'dislike' | 'share' | 'comment' | 'view',
  userId: string,
  walletAddress: string,
  platform?: 'x' | 'telegram' | 'discord',
  comment?: string
) {
  const response = await fetch(`/api/articles/${slug}/interactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      userId,
      walletAddress,
      platform,
      comment,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to interact with article');
  }
  
  return response.json();
}

// Points system constants
export const POINTS_SYSTEM = {
  READ_ARTICLE: 10,
  LIKE_ARTICLE: 5,
  SHARE_ARTICLE: 10,
  COMMENT_ARTICLE: 15,
  DISLIKE_ARTICLE: 0, // No points for dislikes
} as const; 