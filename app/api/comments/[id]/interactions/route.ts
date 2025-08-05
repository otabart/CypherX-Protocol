import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface CommentInteractionRequest {
  action: 'like' | 'dislike' | 'reply';
  userId: string;
  walletAddress: string;
  content?: string; // For replies
}

// POST - Handle comment interactions
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;
    const body = await request.json() as CommentInteractionRequest;
    const { action, userId, walletAddress, content } = body;

    if (!userId || !walletAddress || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'userId, walletAddress, and action are required'
      }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      console.error('Database connection failed');
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get the comment
    let commentRef;
    let commentData;
    try {
      commentRef = db.collection('comments').doc(commentId);
      const commentDoc = await commentRef.get();
      
      if (!commentDoc.exists) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
      }

      commentData = commentDoc.data();
      if (!commentData) {
        return NextResponse.json({ error: 'Comment data not found' }, { status: 404 });
      }
    } catch (error) {
      console.error('Error fetching comment:', error);
      return NextResponse.json({ error: 'Failed to fetch comment' }, { status: 500 });
    }
    
    let points = 0;
    let activityAction = '';

    switch (action) {
      case 'like':
        // Check if user already liked
        try {
          const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
          const userSnapshot = await userQuery.get();
          
          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            const likedComments = userData.likedComments || [];
            
            if (likedComments.includes(commentId)) {
              // Unlike
              await commentRef.update({ 
                likes: FieldValue.arrayRemove(walletAddress) 
              });
              await db.collection('users').doc(userSnapshot.docs[0].id).update({
                likedComments: FieldValue.arrayRemove(commentId)
              });
              points = 0;
              activityAction = 'unlike_comment';
            } else {
              // Like
              await commentRef.update({ 
                likes: FieldValue.arrayUnion(walletAddress) 
              });
              await db.collection('users').doc(userSnapshot.docs[0].id).update({
                likedComments: FieldValue.arrayUnion(commentId)
              });
              points = 3;
              activityAction = 'like_comment';
            }
          }
        } catch (error) {
          console.error('Error handling like action:', error);
          return NextResponse.json({ error: 'Failed to process like action' }, { status: 500 });
        }
        break;

      case 'dislike':
        // Check if user already disliked
        try {
          const userQuery2 = db.collection('users').where('walletAddress', '==', walletAddress);
          const userSnapshot2 = await userQuery2.get();
          
          if (!userSnapshot2.empty) {
            const userData = userSnapshot2.docs[0].data();
            const dislikedComments = userData.dislikedComments || [];
            
            if (dislikedComments.includes(commentId)) {
              // Remove dislike
              await commentRef.update({ 
                dislikes: FieldValue.arrayRemove(walletAddress) 
              });
              await db.collection('users').doc(userSnapshot2.docs[0].id).update({
                dislikedComments: FieldValue.arrayRemove(commentId)
              });
              points = 0;
              activityAction = 'remove_dislike_comment';
            } else {
              // Dislike
              await commentRef.update({ 
                dislikes: FieldValue.arrayUnion(walletAddress) 
              });
              await db.collection('users').doc(userSnapshot2.docs[0].id).update({
                dislikedComments: FieldValue.arrayUnion(commentId)
              });
              points = 0; // No points for dislikes
              activityAction = 'dislike_comment';
            }
          }
        } catch (error) {
          console.error('Error handling dislike action:', error);
          return NextResponse.json({ error: 'Failed to process dislike action' }, { status: 500 });
        }
        break;

      case 'reply':
        if (!content?.trim()) {
          return NextResponse.json({ 
            error: 'Content is required for replies',
            details: 'Please provide reply content'
          }, { status: 400 });
        }
        
        try {
          // Create reply comment
          const replyData = {
            articleSlug: commentData.articleSlug || '',
            userId,
            walletAddress,
            content: content.trim(),
            parentCommentId: commentId,
            likes: [],
            dislikes: [],
            replies: [],
            createdAt: FieldValue.serverTimestamp(),
            points: 20, // Bonus points for replies
          };

          const replyRef = await db.collection('comments').add(replyData);
          
          // Update parent comment replies
          await commentRef.update({
            replies: FieldValue.arrayUnion(replyRef.id)
          });

          points = 20;
          activityAction = 'reply_to_comment';
        } catch (error) {
          console.error('Error creating reply:', error);
          return NextResponse.json({ error: 'Failed to create reply' }, { status: 500 });
        }
        break;

      default:
        return NextResponse.json({ 
          error: 'Invalid action',
          details: 'Action must be one of: like, dislike, reply'
        }, { status: 400 });
    }

    // Record user activity if points are earned
    if (points > 0) {
      try {
        await db.collection('user_activities').add({
          userId,
          walletAddress,
          action: activityAction,
          points,
          commentId,
          articleSlug: commentData.articleSlug || '',
          metadata: {
            parentCommentId: action === 'reply' ? commentId : undefined,
          },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.error('Error recording user activity:', error);
        // Don't fail the entire request if activity recording fails
      }

      // Update user points
      try {
        const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
        const userSnapshot = await userQuery.get();
        
        if (!userSnapshot.empty) {
          await db.collection('users').doc(userSnapshot.docs[0].id).update({
            points: FieldValue.increment(points),
            lastActivity: FieldValue.serverTimestamp(),
          });
        } else {
          // Create new user
          await db.collection('users').add({
            walletAddress,
            points,
            createdAt: FieldValue.serverTimestamp(),
            lastActivity: FieldValue.serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('Error updating user points:', error);
        // Don't fail the entire request if user update fails
      }

      // Update leaderboard
      try {
        const leaderboardQuery = db.collection('leaderboard').where('walletAddress', '==', walletAddress);
        const leaderboardSnapshot = await leaderboardQuery.get();
        
        if (!leaderboardSnapshot.empty) {
          await db.collection('leaderboard').doc(leaderboardSnapshot.docs[0].id).update({
            points: FieldValue.increment(points),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        } else {
          await db.collection('leaderboard').add({
            walletAddress,
            points,
            createdAt: FieldValue.serverTimestamp(),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('Error updating leaderboard:', error);
        // Don't fail the entire request if leaderboard update fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      pointsEarned: points,
      action: activityAction,
      message: points > 0 ? `+${points} points earned!` : 'Action completed successfully'
    });

  } catch (error) {
    console.error('Error handling comment interaction:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: 'An error occurred while processing the interaction'
    }, { status: 500 });
  }
} 