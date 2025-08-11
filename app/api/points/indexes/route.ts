import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Firestore } from 'firebase-admin/firestore';

interface IndexesPointsRequest {
  action: 'view_index' | 'vote_index' | 'refresh_index' | 'share_index' | 'comment_index';
  userId: string;
  walletAddress: string;
  indexName: string;
  tokenAddress?: string;
  comment?: string;
  platform?: 'x' | 'telegram' | 'discord';
}

// Points system for indexes interactions
const POINTS_SYSTEM = {
  VIEW_INDEX: 5, // Points for viewing an index
  VOTE_INDEX: 25, // Points for voting on index changes
  REFRESH_INDEX: 2, // Points for refreshing index data
  SHARE_INDEX: 15, // Points for sharing index
  COMMENT_INDEX: 20, // Points for commenting on index
} as const;

// Daily limits for anti-farming
const DAILY_LIMITS = {
  VIEW_INDEX: 50, // Max 50 index views per day
  VOTE_INDEX: 10, // Max 10 votes per day
  REFRESH_INDEX: 20, // Max 20 refreshes per day
  SHARE_INDEX: 5, // Max 5 shares per day
  COMMENT_INDEX: 10, // Max 10 comments per day
} as const;

// POST - Handle indexes points and user engagement
export async function POST(request: Request) {
  try {
    // Validate request body
    let body: IndexesPointsRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        details: 'Please check your request format'
      }, { status: 400 });
    }

    const { action, userId, walletAddress, indexName, tokenAddress, comment, platform } = body;

    if (!userId || !walletAddress || !action || !indexName) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'userId, walletAddress, action, and indexName are required'
      }, { status: 400 });
    }

    // Validate index name
    const validIndexes = ['CDEX', 'BDEX', 'VDEX', 'AIDEX'];
    if (!validIndexes.includes(indexName)) {
      return NextResponse.json({ 
        error: 'Invalid index name',
        details: 'Must be one of: CDEX, BDEX, VDEX, AIDEX'
      }, { status: 400 });
    }

    // Get database connection with retry logic
    let db: Firestore | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const dbConnection = adminDb();
        if (dbConnection) {
          // Test the connection by making a simple query
          await dbConnection.collection('users').limit(1).get();
          db = dbConnection; // If we get here, connection is working
          break;
        }
      } catch (dbError) {
        console.error(`Database connection attempt ${retryCount + 1} failed:`, dbError);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    if (!db) {
      console.error('All database connection attempts failed');
      return NextResponse.json({ 
        error: 'Database connection failed',
        details: 'Unable to connect to database after multiple attempts'
      }, { status: 500 });
    }

    // Check if user exists
    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
    const userSnapshot = await userQuery.get();
    
    let userDocId: string;
    let userData: Record<string, unknown> = {};
    
    if (userSnapshot.empty) {
      // Create new user
      try {
        const newUserRef = await db.collection('users').add({
          walletAddress,
          points: 0,
          likedArticles: [],
          dislikedArticles: [],
          createdAt: FieldValue.serverTimestamp(),
          lastActivity: FieldValue.serverTimestamp(),
        });
        userDocId = newUserRef.id;
        console.log('Created new user:', userDocId);
      } catch (error) {
        console.error('Error creating new user:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }
    } else {
      userDocId = userSnapshot.docs[0].id;
      userData = userSnapshot.docs[0].data();
      console.log('Found existing user:', userDocId);
    }

    // Check daily limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      const activityQuery = db.collection('user_activities')
        .where('walletAddress', '==', walletAddress)
        .where('action', '==', action)
        .where('indexName', '==', indexName)
        .where('createdAt', '>=', today);
      
      const activitySnapshot = await activityQuery.get();
      
      const dailyLimit = DAILY_LIMITS[action as keyof typeof DAILY_LIMITS];
      if (activitySnapshot.size >= dailyLimit) {
        return NextResponse.json({ 
          error: 'Daily limit reached',
          limitReached: true,
          message: `You have reached the daily limit for ${action} (${dailyLimit} per day)`
        }, { status: 400 });
      }
    } catch (error) {
      console.error('Error checking daily activity:', error);
      // Continue with action even if daily check fails
    }

    let points = 0;

    // Calculate points based on action
    switch (action) {
      case 'view_index':
        points = POINTS_SYSTEM.VIEW_INDEX;
        break;
      case 'vote_index':
        points = POINTS_SYSTEM.VOTE_INDEX;
        break;
      case 'refresh_index':
        points = POINTS_SYSTEM.REFRESH_INDEX;
        break;
      case 'share_index':
        points = POINTS_SYSTEM.SHARE_INDEX;
        break;
      case 'comment_index':
        points = POINTS_SYSTEM.COMMENT_INDEX;
        break;
      default:
        return NextResponse.json({ 
          error: 'Invalid action',
          details: 'Action must be one of: view_index, vote_index, refresh_index, share_index, comment_index'
        }, { status: 400 });
    }

    // Update user points
    try {
      await db.collection('users').doc(userDocId).update({
        points: FieldValue.increment(points),
        lastActivity: FieldValue.serverTimestamp(),
      });

      // Record activity
      const activityData = {
        userId,
        walletAddress,
        action,
        points,
        indexName,
        tokenAddress: tokenAddress || null,
        comment: comment || null,
        platform: platform || null,
        createdAt: FieldValue.serverTimestamp(),
      };

      await db.collection('user_activities').add(activityData);

      // Update leaderboard
      const leaderboardRef = db.collection('leaderboard').doc(walletAddress);
      await leaderboardRef.set({
        walletAddress,
        points: FieldValue.increment(points),
        lastUpdated: FieldValue.serverTimestamp(),
      }, { merge: true });

      return NextResponse.json({
        success: true,
        pointsEarned: points,
        totalPoints: ((userData.points as number) || 0) + points,
        message: `Successfully earned ${points} points for ${action}`,
        dailyLimit: DAILY_LIMITS[action as keyof typeof DAILY_LIMITS],
        remainingToday: DAILY_LIMITS[action as keyof typeof DAILY_LIMITS] - 1, // Approximate
      });

    } catch (error) {
      console.error('Error updating user points:', error);
      return NextResponse.json({ error: 'Failed to update points' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in indexes points API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get user's indexes activity and points
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const indexName = searchParams.get('indexName');

    if (!walletAddress) {
      return NextResponse.json({ 
        error: 'Missing walletAddress parameter' 
      }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get user data
    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
    const userSnapshot = await userQuery.get();
    
    if (userSnapshot.empty) {
      return NextResponse.json({
        user: null,
        activities: [],
        totalPoints: 0,
        indexesActivity: {}
      });
    }

    const userData = userSnapshot.docs[0].data();

    // Get user's indexes activities
    let activitiesQuery = db.collection('user_activities')
      .where('walletAddress', '==', walletAddress)
      .where('action', 'in', ['view_index', 'vote_index', 'refresh_index', 'share_index', 'comment_index'])
      .orderBy('createdAt', 'desc')
      .limit(50);

    if (indexName) {
      activitiesQuery = activitiesQuery.where('indexName', '==', indexName);
    }

    const activitiesSnapshot = await activitiesQuery.get();
    const activities = activitiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate indexes-specific stats
    const indexesActivity = activities.reduce((acc: Record<string, { views: number; votes: number; refreshes: number; shares: number; comments: number; totalPoints: number }>, activity: any) => {
      const indexName = activity.indexName;
      if (!acc[indexName]) {
        acc[indexName] = {
          views: 0,
          votes: 0,
          refreshes: 0,
          shares: 0,
          comments: 0,
          totalPoints: 0
        };
      }
      
      const actionType = activity.action.split('_')[1];
      if (actionType) {
        const key = `${actionType}s`;
        if (key === 'views' || key === 'votes' || key === 'refreshes' || key === 'shares' || key === 'comments') {
          (acc[indexName][key] as number)++;
        }
      }
      acc[indexName].totalPoints += activity.points || 0;
      
      return acc;
    }, {} as Record<string, { views: number; votes: number; refreshes: number; shares: number; comments: number; totalPoints: number }>);

    return NextResponse.json({
      user: {
        walletAddress: userData.walletAddress,
        points: userData.points || 0,
        createdAt: userData.createdAt,
        lastActivity: userData.lastActivity
      },
      activities,
      totalPoints: userData.points || 0,
      indexesActivity
    });

  } catch (error) {
    console.error('Error fetching indexes activity:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
