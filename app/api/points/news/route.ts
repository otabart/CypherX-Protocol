import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface NewsPointsRequest {
  action: 'read_article' | 'like_article' | 'unlike_article' | 'dislike_article' | 'share_article' | 'comment_article';
  userId: string;
  walletAddress: string;
  articleSlug: string;
  platform?: 'x' | 'telegram' | 'discord';
  comment?: string;
}

// Points system for news interactions
const POINTS_SYSTEM = {
  READ_ARTICLE: 10,
  LIKE_ARTICLE: 5,
  UNLIKE_ARTICLE: -5, // Remove points when unliking
  DISLIKE_ARTICLE: 0, // No points for dislikes
  SHARE_ARTICLE: 10,
  COMMENT_ARTICLE: 15,
} as const;

// POST - Handle news points and user engagement
export async function POST(request: Request) {
  try {
    const body = await request.json() as NewsPointsRequest;
    const { action, userId, walletAddress, articleSlug, platform, comment } = body;

    if (!userId || !walletAddress || !action || !articleSlug) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'userId, walletAddress, action, and articleSlug are required'
      }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      console.error('Database connection failed');
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Check if user exists
    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
    const userSnapshot = await userQuery.get();
    
    let userDocId: string;
    let userData: any = {};
    
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

    // Check if action was already performed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      const activityQuery = db.collection('user_activities')
        .where('walletAddress', '==', walletAddress)
        .where('action', '==', action)
        .where('articleSlug', '==', articleSlug)
        .where('createdAt', '>=', today);
      
      const activitySnapshot = await activityQuery.get();
      
      if (!activitySnapshot.empty) {
        return NextResponse.json({ 
          error: 'Action already performed today',
          alreadyPerformed: true,
          message: 'You have already performed this action today'
        }, { status: 400 });
      }
    } catch (error) {
      console.error('Error checking daily activity:', error);
      // Continue with action even if daily check fails
    }

    let points = 0;
    let errorData: any = null;

    // Handle different actions
    switch (action) {
      case 'read_article':
        points = POINTS_SYSTEM.READ_ARTICLE;
        break;

      case 'like_article':
        // Check if already liked
        const likedArticles = userData.likedArticles || [];
        if (likedArticles.includes(articleSlug)) {
          errorData = {
            error: 'Article already liked',
            alreadyLiked: true,
            message: 'You have already liked this article'
          };
        } else {
          points = POINTS_SYSTEM.LIKE_ARTICLE;
          // Add to liked articles
          try {
            await db.collection('users').doc(userDocId).update({
              likedArticles: FieldValue.arrayUnion(articleSlug)
            });
          } catch (error) {
            console.error('Error updating liked articles:', error);
            return NextResponse.json({ error: 'Failed to update liked articles' }, { status: 500 });
          }
        }
        break;

      case 'unlike_article':
        points = POINTS_SYSTEM.UNLIKE_ARTICLE;
        // Remove from liked articles
        try {
          await db.collection('users').doc(userDocId).update({
            likedArticles: FieldValue.arrayRemove(articleSlug)
          });
        } catch (error) {
          console.error('Error updating liked articles:', error);
          return NextResponse.json({ error: 'Failed to update liked articles' }, { status: 500 });
        }
        break;

      case 'dislike_article':
        points = POINTS_SYSTEM.DISLIKE_ARTICLE;
        // Add to disliked articles
        try {
          await db.collection('users').doc(userDocId).update({
            dislikedArticles: FieldValue.arrayUnion(articleSlug)
          });
        } catch (error) {
          console.error('Error updating disliked articles:', error);
          return NextResponse.json({ error: 'Failed to update disliked articles' }, { status: 500 });
        }
        break;

      case 'share_article':
        if (!platform) {
          return NextResponse.json({ 
            error: 'Platform is required for sharing',
            details: 'Please specify the platform (x, telegram, discord)'
          }, { status: 400 });
        }
        points = POINTS_SYSTEM.SHARE_ARTICLE;
        break;

      case 'comment_article':
        if (!comment?.trim()) {
          return NextResponse.json({ 
            error: 'Comment is required',
            details: 'Please provide a comment'
          }, { status: 400 });
        }
        points = POINTS_SYSTEM.COMMENT_ARTICLE;
        break;

      default:
        return NextResponse.json({ 
          error: 'Invalid action',
          details: 'Action must be one of: read_article, like_article, unlike_article, dislike_article, share_article, comment_article'
        }, { status: 400 });
    }

    // If there was an error, return it
    if (errorData) {
      return NextResponse.json(errorData, { status: 400 });
    }

    // Record the activity
    try {
      await db.collection('user_activities').add({
        userId,
        walletAddress,
        action,
        points,
        articleSlug,
        metadata: {
          platform,
          comment: action === 'comment_article' ? comment : undefined,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error recording user activity:', error);
      return NextResponse.json({ error: 'Failed to record activity' }, { status: 500 });
    }

    // Update user points
    try {
      await db.collection('users').doc(userDocId).update({
        points: FieldValue.increment(points),
        lastActivity: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating user points:', error);
      return NextResponse.json({ error: 'Failed to update user points' }, { status: 500 });
    }

    // Update leaderboard
    try {
      const leaderboardQuery = db.collection('leaderboard').where('walletAddress', '==', walletAddress);
      const leaderboardSnapshot = await leaderboardQuery.get();
      
      if (!leaderboardSnapshot.empty) {
        const leaderboardDoc = leaderboardSnapshot.docs[0];
        await db.collection('leaderboard').doc(leaderboardDoc.id).update({
          points: FieldValue.increment(points),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      } else {
        // Create new leaderboard entry
        await db.collection('leaderboard').add({
          walletAddress,
          points: points,
          createdAt: FieldValue.serverTimestamp(),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating leaderboard:', error);
      // Don't fail the entire request if leaderboard update fails
    }

    // Get updated user data
    try {
      const updatedUserSnapshot = await db.collection('users').doc(userDocId).get();
      const updatedUserData = updatedUserSnapshot.data();

      return NextResponse.json({
        success: true,
        pointsEarned: points,
        totalPoints: updatedUserData?.points || 0,
        action,
        message: points > 0 ? `+${points} points earned!` : 'Action completed successfully'
      });
    } catch (error) {
      console.error('Error getting updated user data:', error);
      return NextResponse.json({
        success: true,
        pointsEarned: points,
        action,
        message: points > 0 ? `+${points} points earned!` : 'Action completed successfully'
      });
    }

  } catch (error) {
    console.error('Error handling news points:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: 'An error occurred while processing your request'
    }, { status: 500 });
  }
}

// GET - Fetch user's news points and activities
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
    
    let userData = null;
    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      userData = {
        id: userDoc.id,
        ...userDoc.data(),
        lastActivity: userDoc.data().lastActivity?.toDate?.()?.toISOString() || userDoc.data().lastActivity,
        createdAt: userDoc.data().createdAt?.toDate?.()?.toISOString() || userDoc.data().createdAt,
      };
    }

    // Get user's news activities
    const activitiesQuery = db.collection('user_activities')
      .where('walletAddress', '==', walletAddress)
      .where('action', 'in', ['read_article', 'like_article', 'unlike_article', 'dislike_article', 'share_article', 'comment_article'])
      .orderBy('createdAt', 'desc')
      .limit(20);
    
    const activitiesSnapshot = await activitiesQuery.get();
    const activities = activitiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      };
    });

    // Calculate news-specific stats
    const newsStats = activities.reduce((acc, activity: any) => {
      if (activity.action) {
        acc[activity.action] = (acc[activity.action] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const totalNewsPoints = activities.reduce((sum, activity: any) => sum + (activity.points || 0), 0);

    return NextResponse.json({
      user: userData,
      activities,
      newsStats,
      totalNewsPoints,
      pointsSystem: POINTS_SYSTEM
    });

  } catch (error) {
    console.error('Error fetching news points:', error);
    return NextResponse.json({ error: 'Error fetching news points' }, { status: 500 });
  }
} 