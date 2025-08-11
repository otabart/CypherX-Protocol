import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface CommentRequest {
  userId: string;
  walletAddress: string;
  content: string;
  sectionId?: string; // For section-specific comments
  parentCommentId?: string; // For threaded replies
  annotation?: {
    startOffset: number;
    endOffset: number;
    selectedText: string;
  };
}



// POST - Create a new comment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json() as CommentRequest;
    const { userId, walletAddress, content, sectionId, parentCommentId, annotation } = body;

    if (!userId || !walletAddress || !content?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'userId, walletAddress, and content are required'
      }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      console.error('Database connection failed');
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Calculate points based on comment type
    let points = 15; // Base points for commenting
    if (annotation) {
      points += 10; // Bonus points for section annotations
    }
    if (parentCommentId) {
      points += 5; // Bonus points for replies
    }

    // Create comment data
    const commentData = {
      articleSlug: slug,
      userId,
      walletAddress,
      content: content.trim(),
      sectionId,
      parentCommentId,
      annotation,
      likes: [],
      dislikes: [],
      replies: [],
      createdAt: FieldValue.serverTimestamp(),
      points,
    };

    // Add comment to database
    let commentRef;
    try {
      commentRef = await db.collection('comments').add(commentData);
      console.log('Comment created:', commentRef.id);
    } catch (error) {
      console.error('Error creating comment:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    // Update parent comment if this is a reply
    if (parentCommentId) {
      try {
        await db.collection('comments').doc(parentCommentId).update({
          replies: FieldValue.arrayUnion(commentRef.id)
        });
      } catch (error) {
        console.error('Error updating parent comment:', error);
        // Don't fail the entire request if parent update fails
      }
    }

    // Record user activity
    try {
      await db.collection('user_activities').add({
        userId,
        walletAddress,
        action: 'comment_article',
        points,
        articleSlug: slug,
        metadata: {
          commentId: commentRef.id,
          hasAnnotation: !!annotation,
          isReply: !!parentCommentId,
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

    // Get the created comment with ID
    const createdComment = {
      id: commentRef.id,
      ...commentData,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      comment: createdComment,
      pointsEarned: points,
      message: `Comment posted! +${points} points earned!`
    });

  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: 'An error occurred while creating the comment'
    }, { status: 500 });
  }
}

// GET - Fetch comments for an article
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get('sectionId');
    const parentCommentId = searchParams.get('parentCommentId');

    const db = adminDb();
    if (!db) {
      console.error('Database connection failed');
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    try {
      let query = db.collection('comments').where('articleSlug', '==', slug);

      if (sectionId) {
        query = query.where('sectionId', '==', sectionId);
      }

      if (parentCommentId) {
        query = query.where('parentCommentId', '==', parentCommentId);
      } else {
        // Only get top-level comments if no parentCommentId specified
        query = query.where('parentCommentId', '==', null);
      }

      query = query.orderBy('createdAt', 'desc');

      const snapshot = await query.get();
      const comments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        };
      });

      return NextResponse.json({
        comments,
        total: comments.length
      });
    } catch (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json({ error: 'Error fetching comments' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in comments GET endpoint:', error);
    return NextResponse.json({ error: 'Error fetching comments' }, { status: 500 });
  }
} 