import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface InteractionRequest {
  action: 'like' | 'dislike' | 'share' | 'comment' | 'view';
  userId: string;
  walletAddress: string;
  platform?: 'x' | 'telegram' | 'discord';
  comment?: string;
}

// POST - Handle article interactions
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json() as InteractionRequest;
    const { action, userId, walletAddress, platform, comment } = body;

    if (!userId || !walletAddress || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find the article by slug
    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    
    const articleQuery = db.collection('articles').where('slug', '==', slug);
    const articleSnapshot = await articleQuery.get();
    
    if (articleSnapshot.empty) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const articleDoc = articleSnapshot.docs[0];
    const articleRef = db.collection('articles').doc(articleDoc.id);

    let points = 0;
    let activityAction = '';

    switch (action) {
      case 'like':
        // Check if user already liked
        const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
        const userSnapshot = await userQuery.get();
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          const likedArticles = userData.likedArticles || [];
          
          if (likedArticles.includes(slug)) {
            // Unlike
            await articleRef.update({ upvotes: FieldValue.increment(-1) });
            await db.collection('users').doc(userSnapshot.docs[0].id).update({
              likedArticles: FieldValue.arrayRemove(slug)
            });
            points = 0;
            activityAction = 'unlike_article';
          } else {
            // Like
            await articleRef.update({ upvotes: FieldValue.increment(1) });
            await db.collection('users').doc(userSnapshot.docs[0].id).update({
              likedArticles: FieldValue.arrayUnion(slug)
            });
            points = 5;
            activityAction = 'like_article';
          }
        }
        break;

      case 'dislike':
        await articleRef.update({ downvotes: FieldValue.increment(1) });
        points = 0; // No points for dislikes
        activityAction = 'dislike_article';
        break;

      case 'share':
        if (!platform) {
          return NextResponse.json({ error: 'Platform is required for sharing' }, { status: 400 });
        }
        points = 10;
        activityAction = platform === 'x' ? 'share_x' : 'share_telegram';
        break;

      case 'comment':
        if (!comment?.trim()) {
          return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
        }
        await articleRef.update({ 
          comments: FieldValue.arrayUnion(comment)
        });
        points = 15;
        activityAction = 'comment_article';
        break;

      case 'view':
        await articleRef.update({ views: FieldValue.increment(1) });
        points = 10;
        activityAction = 'read_article';
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Track user activity if points are earned
    if (points > 0) {
      await db.collection('user_activities').add({
        userId,
        walletAddress,
        action: activityAction,
        points,
        articleSlug: slug,
        articleId: articleDoc.id,
        metadata: {
          platform,
          comment: action === 'comment' ? comment : undefined,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      // Update user points
      const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
      const userSnapshot = await userQuery.get();
      
      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        await db.collection('users').doc(userDoc.id).update({
          points: FieldValue.increment(points),
          lastActivity: FieldValue.serverTimestamp(),
        });
      } else {
        // Create new user if doesn't exist
        await db.collection('users').add({
          walletAddress,
          points,
          likedArticles: action === 'like' ? [slug] : [],
          createdAt: FieldValue.serverTimestamp(),
          lastActivity: FieldValue.serverTimestamp(),
        });
      }

      // Update leaderboard
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
          points,
          createdAt: FieldValue.serverTimestamp(),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      pointsEarned: points,
      action: activityAction
    });
  } catch (error) {
    console.error('Error handling article interaction:', error);
    return NextResponse.json({ error: 'Error handling article interaction' }, { status: 500 });
  }
} 