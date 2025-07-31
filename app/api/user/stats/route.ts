import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

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
    
    let userData: any = null;
    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      userData = {
        id: userDoc.id,
        ...userDoc.data(),
        lastActivity: userDoc.data().lastActivity?.toDate?.()?.toISOString() || userDoc.data().lastActivity,
        createdAt: userDoc.data().createdAt?.toDate?.()?.toISOString() || userDoc.data().createdAt,
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
    
    const activities = activitiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
    })) as any[];

    // Get activity summary
    const activitySummary = activities.reduce((acc, activity) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
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