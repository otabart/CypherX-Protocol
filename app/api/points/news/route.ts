import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Firestore } from 'firebase-admin/firestore';

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
  UNLIKE_ARTICLE: 0, // No points for unlike - allow unlimited actions
  DISLIKE_ARTICLE: 0, // No points for dislikes
  SHARE_ARTICLE: 10,
  COMMENT_ARTICLE: 15,
} as const;

// POST - Handle news points and user engagement
export async function POST(request: Request) {
  try {
    // Validate request body
    let body: NewsPointsRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        details: 'Please check your request format'
      }, { status: 400 });
    }

    const { action, userId, walletAddress, articleSlug, platform, comment } = body;

    // Enhanced validation
    if (!userId?.trim() || !walletAddress?.trim() || !action || !articleSlug?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'userId, walletAddress, action, and articleSlug are required'
      }, { status: 400 });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ 
        error: 'Invalid wallet address format',
        details: 'Wallet address must be a valid Ethereum address'
      }, { status: 400 });
    }

    // Validate action-specific requirements
    if (action === 'comment_article' && (!comment?.trim() || comment.trim().length < 1)) {
      return NextResponse.json({ 
        error: 'Comment is required',
        details: 'Please provide a meaningful comment'
      }, { status: 400 });
    }

    if (action === 'share_article' && !platform) {
      return NextResponse.json({ 
        error: 'Platform is required for sharing',
        details: 'Please specify the platform (x, telegram, discord)'
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

    // Use batch write for better consistency
    const batch = db.batch();
    
    try {
      // Check if user exists
      const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
      const userSnapshot = await userQuery.get();
      
      let userDocId: string;
      let userData: { likedArticles?: string[]; dislikedArticles?: string[] } = {};
      
      if (userSnapshot.empty) {
        // Create new user
        const newUserRef = db.collection('users').doc();
        batch.set(newUserRef, {
          walletAddress,
          points: 0,
          likedArticles: [],
          dislikedArticles: [],
          createdAt: FieldValue.serverTimestamp(),
          lastActivity: FieldValue.serverTimestamp(),
        });
        userDocId = newUserRef.id;
        console.log('Created new user:', userDocId);
      } else {
        userDocId = userSnapshot.docs[0].id;
        userData = userSnapshot.docs[0].data();
        console.log('Found existing user:', userDocId);
      }

      // Check if action was already performed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let activitySnapshot: any = null;
      
      try {
        // Use a simpler query that works with the existing index
        const activityQuery = db.collection('user_activities')
          .where('walletAddress', '==', walletAddress)
          .where('action', '==', action)
          .where('articleSlug', '==', articleSlug);
        
        activitySnapshot = await activityQuery.get();
        
        // Only block if trying to earn points for an action already performed today
        // Don't block the action itself
      } catch (error) {
        console.error('Error checking daily activity:', error);
        // Continue with action even if daily check fails
      }

      let points = 0;
      let errorData: { error: string; alreadyLiked: boolean; message: string } | null = null;

      // Handle different actions
      switch (action) {
        case 'read_article':
          points = POINTS_SYSTEM.READ_ARTICLE;
          break;

        case 'like_article':
          // Check current state
          const likedArticles = userData.likedArticles || [];
          const dislikedArticles = userData.dislikedArticles || [];
          
          if (likedArticles.includes(articleSlug)) {
            // Already liked - this is an unlike action
            points = 0;
            // Remove from liked articles
            batch.update(db.collection('users').doc(userDocId), {
              likedArticles: FieldValue.arrayRemove(articleSlug)
            });
          } else {
            // Not currently liked - this is a like action
            // Remove dislike first if exists
            if (dislikedArticles.includes(articleSlug)) {
              batch.update(db.collection('users').doc(userDocId), {
                dislikedArticles: FieldValue.arrayRemove(articleSlug)
              });
            }
            
            // Check if they've already earned points for liking this article today
            const todayLikeActivities = activitySnapshot?.docs?.filter((doc: any) => {
              const data = doc.data();
              const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
              return data.action === 'like_article' && 
                     data.articleSlug === articleSlug && 
                     createdAt >= today;
            }) || [];
            
            if (todayLikeActivities.length > 0) {
              // Already earned points today for liking - allow action but no points
              points = 0;
            } else {
              // First time liking today - give points
              points = POINTS_SYSTEM.LIKE_ARTICLE;
            }
            
            // Add to liked articles
            batch.update(db.collection('users').doc(userDocId), {
              likedArticles: FieldValue.arrayUnion(articleSlug)
            });
          }
          break;

        case 'unlike_article':
          // Unlike always removes from liked articles, no points
          points = 0;
          batch.update(db.collection('users').doc(userDocId), {
            likedArticles: FieldValue.arrayRemove(articleSlug)
          });
          break;

        case 'dislike_article':
          // Check current state
          const currentLikedArticles = userData.likedArticles || [];
          const currentDislikedArticles = userData.dislikedArticles || [];
          
          if (currentDislikedArticles.includes(articleSlug)) {
            // Already disliked - this is an undislike action
            points = 0;
            // Remove from disliked articles
            batch.update(db.collection('users').doc(userDocId), {
              dislikedArticles: FieldValue.arrayRemove(articleSlug)
            });
          } else {
            // Not currently disliked - this is a dislike action
            // Remove like first if exists
            if (currentLikedArticles.includes(articleSlug)) {
              batch.update(db.collection('users').doc(userDocId), {
                likedArticles: FieldValue.arrayRemove(articleSlug)
              });
            }
            
            // Check if they've already earned points for disliking this article today
            const todayDislikeActivities = activitySnapshot?.docs?.filter((doc: any) => {
              const data = doc.data();
              const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
              return data.action === 'dislike_article' && 
                     data.articleSlug === articleSlug && 
                     createdAt >= today;
            }) || [];
            
            if (todayDislikeActivities.length > 0) {
              // Already earned points today for disliking - allow action but no points
              points = 0;
            } else {
              // First time disliking today - give points (0 for dislikes)
              points = POINTS_SYSTEM.DISLIKE_ARTICLE;
            }
            
            // Add to disliked articles
            batch.update(db.collection('users').doc(userDocId), {
              dislikedArticles: FieldValue.arrayUnion(articleSlug)
            });
          }
          break;

        case 'share_article':
          points = POINTS_SYSTEM.SHARE_ARTICLE;
          break;

        case 'comment_article':
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
      const activityRef = db.collection('user_activities').doc();
      batch.set(activityRef, {
        userId,
        walletAddress,
        action,
        points,
        articleSlug,
        metadata: {
          platform: platform || 'web',
          comment: action === 'comment_article' ? comment : undefined,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      // Update user points
      batch.update(db.collection('users').doc(userDocId), {
        points: FieldValue.increment(points),
        lastActivity: FieldValue.serverTimestamp(),
      });

      // Update article vote counts in database
      try {
        const articleQuery = db.collection('articles').where('slug', '==', articleSlug);
        const articleSnapshot = await articleQuery.get();
        
        if (!articleSnapshot.empty) {
          const articleDoc = articleSnapshot.docs[0];
          const articleRef = db.collection('articles').doc(articleDoc.id);
          
          // Update vote counts based on action
          if (action === 'like_article') {
            // Check if user was previously disliked
            const dislikedArticles = userData.dislikedArticles || [];
            if (dislikedArticles.includes(articleSlug)) {
              batch.update(articleRef, { downvotes: FieldValue.increment(-1) });
            }
            batch.update(articleRef, { upvotes: FieldValue.increment(1) });
          } else if (action === 'unlike_article') {
            batch.update(articleRef, { upvotes: FieldValue.increment(-1) });
          } else if (action === 'dislike_article') {
            // Check if user was previously liked
            const likedArticles = userData.likedArticles || [];
            if (likedArticles.includes(articleSlug)) {
              batch.update(articleRef, { upvotes: FieldValue.increment(-1) });
            }
            batch.update(articleRef, { downvotes: FieldValue.increment(1) });
          }
        }
      } catch (error) {
        console.error('Error updating article vote counts:', error);
        // Don't fail the entire request if article update fails
      }

      // Update leaderboard
      const leaderboardQuery = db.collection('leaderboard').where('walletAddress', '==', walletAddress);
      const leaderboardSnapshot = await leaderboardQuery.get();
      
      if (!leaderboardSnapshot.empty) {
        const leaderboardDoc = leaderboardSnapshot.docs[0];
        batch.update(leaderboardDoc.ref, {
          points: FieldValue.increment(points),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      } else {
        // Create new leaderboard entry
        const leaderboardRef = db.collection('leaderboard').doc();
        batch.set(leaderboardRef, {
          walletAddress,
          points: points,
          createdAt: FieldValue.serverTimestamp(),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }

      // Commit all changes atomically
      await batch.commit();

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

    } catch (batchError) {
      console.error('Error in batch operation:', batchError);
      return NextResponse.json({ 
        error: 'Failed to process request',
        details: 'Database operation failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error handling news points:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json({ 
          error: 'Permission denied',
          details: 'You do not have permission to perform this action'
        }, { status: 403 });
      }
      if (error.message.includes('unavailable')) {
        return NextResponse.json({ 
          error: 'Service temporarily unavailable',
          details: 'Please try again in a few moments'
        }, { status: 503 });
      }
    }
    
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

    if (!walletAddress?.trim()) {
      return NextResponse.json({ 
        error: 'Wallet address is required',
        details: 'Please provide a valid wallet address'
      }, { status: 400 });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ 
        error: 'Invalid wallet address format',
        details: 'Wallet address must be a valid Ethereum address'
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
      } as { id: string; action?: string; points?: number; createdAt: string };
    });

    // Calculate news-specific stats
    const newsStats = activities.reduce((acc, activity) => {
      if (activity.action) {
        acc[activity.action] = (acc[activity.action] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const totalNewsPoints = activities.reduce((sum, activity) => sum + (activity.points || 0), 0);

    return NextResponse.json({
      user: userData,
      activities,
      newsStats,
      totalNewsPoints,
      pointsSystem: POINTS_SYSTEM
    });

  } catch (error) {
    console.error('Error fetching news points:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json({ 
          error: 'Permission denied',
          details: 'You do not have permission to access this data'
        }, { status: 403 });
      }
      if (error.message.includes('unavailable')) {
        return NextResponse.json({ 
          error: 'Service temporarily unavailable',
          details: 'Please try again in a few moments'
        }, { status: 503 });
      }
    }
    
    return NextResponse.json({ 
      error: 'Error fetching news points',
      details: 'An unexpected error occurred while fetching your data'
    }, { status: 500 });
  }
}