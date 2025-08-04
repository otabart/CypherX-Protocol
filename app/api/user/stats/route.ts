import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

interface UserData {
  id: string;
  walletAddress?: string;
  points?: number;
  lastActivity?: string;
  createdAt?: string;
  likedArticles?: string[];
  [key: string]: unknown;
}

interface UserActivity {
  id: string;
  action?: string;
  points?: number;
  createdAt?: string;
  [key: string]: unknown;
}

interface FirestoreTimestamp {
  toDate: () => Date;
}

// GET - Fetch user stats
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get user data
    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
    const userSnapshot = await userQuery.get();
    
    let userData: UserData | null = null;
    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const docData = userDoc.data();
      userData = {
        id: userDoc.id,
        ...docData,
        lastActivity: typeof docData.lastActivity === 'object' && docData.lastActivity !== null && 'toDate' in docData.lastActivity 
          ? (docData.lastActivity as FirestoreTimestamp).toDate().toISOString() 
          : docData.lastActivity,
        createdAt: typeof docData.createdAt === 'object' && docData.createdAt !== null && 'toDate' in docData.createdAt 
          ? (docData.createdAt as FirestoreTimestamp).toDate().toISOString() 
          : docData.createdAt,
      };
    }

    // Get user's leaderboard rank
    let rank = null;
    if (userData) {
      const rankQuery = db.collection('leaderboard')
        .where('points', '>', userData.points || 0)
        .orderBy('points', 'desc');
      const rankSnapshot = await rankQuery.get();
      rank = rankSnapshot.size + 1;
    }

    // Get recent activities
    const activitiesQuery = db.collection('user_activities')
      .where('walletAddress', '==', walletAddress)
      .orderBy('createdAt', 'desc')
      .limit(10);
    const activitiesSnapshot = await activitiesQuery.get();
    
    const activities: UserActivity[] = activitiesSnapshot.docs.map(doc => {
      const docData = doc.data();
      return {
        id: doc.id,
        ...docData,
        createdAt: typeof docData.createdAt === 'object' && docData.createdAt !== null && 'toDate' in docData.createdAt 
          ? (docData.createdAt as FirestoreTimestamp).toDate().toISOString() 
          : docData.createdAt,
      };
    });

    // Get activity summary
    const activitySummary = activities.reduce((acc, activity) => {
      if (activity.action) {
        acc[activity.action] = (acc[activity.action] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Get total points earned
    const totalPoints = activities.reduce((sum, activity) => sum + (activity.points || 0), 0);

    return NextResponse.json({
      user: userData,
      rank,
      activities,
      activitySummary,
      totalPoints,
      stats: {
        totalActivities: activities.length,
        likedArticles: userData?.likedArticles?.length || 0,
        points: userData?.points || 0,
        rank,
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json({ error: 'Error fetching user stats' }, { status: 500 });
  }
} 