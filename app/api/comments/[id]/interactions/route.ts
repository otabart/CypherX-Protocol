import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Daily earning caps for different user types
const DAILY_CAPS = {
  author: 1000,        // Authors can earn up to 1000 points per day
  pinned_commenter: 500, // Pinned commenters can earn up to 500 points per day
  commenter: 200,      // Regular commenters can earn up to 200 points per day
  liker: 50           // Users who like comments can earn up to 50 points per day
};

// Reward amounts (micro-transactions)
const REWARDS = {
  like_given: 1,      // 1 point for giving a like (micro-participation)
  like_received: 2,   // 2 points for receiving a like (small reward)
  pin_received: 25,   // 25 points for being pinned (significant reward)
  comment_engagement: 5 // 5 points for comment engagement (moderate reward)
};

// Check if user has reached daily cap
async function checkDailyCap(db: any, userId: string, userType: keyof typeof DAILY_CAPS): Promise<boolean> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activitiesQuery = db.collection('user_activities')
      .where('userId', '==', userId)
      .where('createdAt', '>=', today);
    
    const snapshot = await activitiesQuery.get();
    const totalEarned = snapshot.docs.reduce((sum: number, doc: any) => {
      const data = doc.data();
      return sum + (data.points > 0 ? data.points : 0);
    }, 0);
    
    return totalEarned >= DAILY_CAPS[userType];
  } catch (error) {
    console.warn('Error checking daily cap:', error);
    return false; // Allow if we can't check
  }
}

// Award points with daily cap check
async function awardPoints(db: any, userId: string, points: number, action: string, metadata: any = {}) {
  try {
    // Determine user type for cap checking
    let userType: keyof typeof DAILY_CAPS = 'liker';
    if (action.includes('pin')) userType = 'pinned_commenter';
    else if (action.includes('comment')) userType = 'commenter';
    else if (action.includes('author')) userType = 'author';
    
    // Check daily cap
    const atCap = await checkDailyCap(db, userId, userType);
    if (atCap) {
      console.log(`User ${userId} has reached daily cap for ${userType}`);
      return false; // Don't award points
    }
    
    // Award points
    const userQuery = db.collection('users').where('uid', '==', userId);
    const userSnapshot = await userQuery.get();
    
    if (!userSnapshot.empty) {
      await db.collection('users').doc(userSnapshot.docs[0].id).update({
        points: FieldValue.increment(points),
        lastActivity: FieldValue.serverTimestamp(),
      });
      
      // Update leaderboard
      const leaderboardQuery = db.collection('leaderboard').where('userId', '==', userId);
      const leaderboardSnapshot = await leaderboardQuery.get();
      
      if (!leaderboardSnapshot.empty) {
        await db.collection('leaderboard').doc(leaderboardSnapshot.docs[0].id).update({
          points: FieldValue.increment(points),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }
      
      // Record activity
      await db.collection('user_activities').add({
        userId,
        action,
        points,
        ...metadata,
        createdAt: FieldValue.serverTimestamp(),
      });
      
      return true;
    }
  } catch (error) {
    console.warn('Error awarding points:', error);
  }
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;
    const { userId, action, articleAuthorId } = await request.json();

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const commentRef = db.collection('comments').doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const commentData = commentDoc.data();
    if (!commentData) {
      return NextResponse.json({ error: 'Comment data not found' }, { status: 404 });
    }

    let updateData: any = {};

    switch (action) {
      case 'like':
        const currentLikes = commentData.likes || [];
        const userLiked = currentLikes.includes(userId);
        
        if (userLiked) {
          // Unlike
          updateData.likes = currentLikes.filter((id: string) => id !== userId);
        } else {
          // Like
          updateData.likes = [...currentLikes, userId];
          // Remove from dislikes if user had disliked
          const currentDislikes = commentData.dislikes || [];
          updateData.dislikes = currentDislikes.filter((id: string) => id !== userId);
          
          // PYRAMID REWARDS:
          // 1. Reward the person giving the like (micro-participation)
          if (commentData.userId !== userId) {
            await awardPoints(db, userId, REWARDS.like_given, 'like_given', {
              commentId,
              articleSlug: commentData.articleSlug,
              targetUserId: commentData.userId
            });
          }
          
          // 2. Reward the comment author for receiving a like (small reward)
          if (commentData.userId && commentData.userId !== userId) {
            await awardPoints(db, commentData.userId, REWARDS.like_received, 'like_received', {
              commentId,
              articleSlug: commentData.articleSlug,
              likedBy: userId
            });
          }
        }
        break;

      case 'dislike':
        const currentDislikes = commentData.dislikes || [];
        const userDisliked = currentDislikes.includes(userId);
        
        if (userDisliked) {
          // Remove dislike
          updateData.dislikes = currentDislikes.filter((id: string) => id !== userId);
        } else {
          // Add dislike
          updateData.dislikes = [...currentDislikes, userId];
          // Remove from likes if user had liked
          const currentLikes = commentData.likes || [];
          updateData.likes = currentLikes.filter((id: string) => id !== userId);
        }
        break;

      case 'pin':
        // Only article author can pin comments
        if (commentData.articleAuthorId !== articleAuthorId) {
          return NextResponse.json({ error: 'Only article author can pin comments' }, { status: 403 });
        }
        
        const wasPinned = commentData.isPinned;
        // Unpin if already pinned, otherwise pin
        updateData.isPinned = !wasPinned;
        
        // PYRAMID REWARDS:
        // 1. Reward the comment author for being pinned (significant reward)
        if (!wasPinned && commentData.userId && commentData.userId !== articleAuthorId) {
          await awardPoints(db, commentData.userId, REWARDS.pin_received, 'pin_received', {
            commentId,
            articleSlug: commentData.articleSlug,
            pinnedBy: articleAuthorId
          });
        }
        
        // 2. Reward the article author for engaging with community (moderate reward)
        if (!wasPinned && articleAuthorId !== commentData.userId) {
          await awardPoints(db, articleAuthorId, REWARDS.comment_engagement, 'author_engagement', {
            commentId,
            articleSlug: commentData.articleSlug,
            engagedWith: commentData.userId
          });
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Add lastUpdated timestamp
    updateData.lastUpdated = new Date();

    await commentRef.update(updateData);

    // Get updated comment data
    const updatedDoc = await commentRef.get();
    const updatedData = updatedDoc.data();

    return NextResponse.json({
      success: true,
      comment: {
        id: commentId,
        ...updatedData,
        createdAt: updatedData?.createdAt?.toDate?.()?.toISOString() || updatedData?.createdAt,
        lastUpdated: updatedData?.lastUpdated?.toDate?.()?.toISOString() || updatedData?.lastUpdated,
      }
    });

  } catch (error) {
    console.error('Error handling comment interaction:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: 'An error occurred while processing the interaction'
    }, { status: 500 });
  }
} 