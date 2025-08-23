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
          const dislikedArticles = userData.dislikedArticles || [];
          
          if (likedArticles.includes(slug)) {
            // Unlike - remove from liked articles
            await articleRef.update({ upvotes: FieldValue.increment(-1) });
            await db.collection('users').doc(userSnapshot.docs[0].id).update({
              likedArticles: FieldValue.arrayRemove(slug)
            });
            points = 0;
            activityAction = 'unlike_article';
          } else {
            // Like - remove dislike first if exists, then add like
            if (dislikedArticles.includes(slug)) {
              await articleRef.update({ downvotes: FieldValue.increment(-1) });
              await db.collection('users').doc(userSnapshot.docs[0].id).update({
                dislikedArticles: FieldValue.arrayRemove(slug)
              });
            }
            
            await articleRef.update({ upvotes: FieldValue.increment(1) });
            await db.collection('users').doc(userSnapshot.docs[0].id).update({
              likedArticles: FieldValue.arrayUnion(slug)
            });
            
            // PYRAMID REWARDS:
            // 1. Reward the person giving the like (micro-participation)
            activityAction = 'like_article';
            
            // Use the earn points API to handle daily limits and clever messages
            try {
              const earnResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/points/earn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId,
                  walletAddress,
                  action: 'like_article',
                  metadata: { articleSlug: slug }
                })
              });
              
              const earnData = await earnResponse.json();
              points = earnData.pointsEarned || 0;
              
              // Return the clever message if limit reached
              if (earnData.limitReached) {
                return NextResponse.json({
                  success: true,
                  message: earnData.message,
                  limitReached: true,
                  points: 0
                });
              }
            } catch (error) {
              console.error('Error earning points for like:', error);
              points = 0;
            }
            
            // 2. Reward the article author for receiving engagement (significant reward)
            const articleData = articleDoc.data();
            if (articleData?.author && articleData.author !== userId) {
              try {
                const authorQuery = db.collection('users').where('uid', '==', articleData.author);
                const authorSnapshot = await authorQuery.get();
                
                if (!authorSnapshot.empty) {
                  const authorWalletAddress = authorSnapshot.docs[0].data().walletAddress;
                  
                  // Use earn points API for author reward
                  const authorEarnResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/points/earn`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId: articleData.author,
                      walletAddress: authorWalletAddress,
                      action: 'receive_like',
                      metadata: { 
                        articleSlug: slug,
                        likedBy: userId 
                      }
                    })
                  });
                  
                  const authorEarnData = await authorEarnResponse.json();
                  const authorPoints = authorEarnData.pointsEarned || 0;
                  
                  // Update author's leaderboard if points were earned
                  if (authorPoints > 0) {
                    const authorLeaderboardQuery = db.collection('leaderboard').where('userId', '==', articleData.author);
                    const authorLeaderboardSnapshot = await authorLeaderboardQuery.get();
                    
                    if (!authorLeaderboardSnapshot.empty) {
                      await db.collection('leaderboard').doc(authorLeaderboardSnapshot.docs[0].id).update({
                        points: FieldValue.increment(authorPoints),
                        lastUpdated: FieldValue.serverTimestamp(),
                      });
                    }
                  }
                }
              } catch (error) {
                console.warn('Error rewarding article author for like:', error);
              }
            }
          }
        }
        break;

      case 'dislike':
        // Check if user already disliked
        const userQuery2 = db.collection('users').where('walletAddress', '==', walletAddress);
        const userSnapshot2 = await userQuery2.get();
        
        if (!userSnapshot2.empty) {
          const userData = userSnapshot2.docs[0].data();
          const likedArticles = userData.likedArticles || [];
          const dislikedArticles = userData.dislikedArticles || [];
          
          if (dislikedArticles.includes(slug)) {
            // Undislike - remove from disliked articles
            await articleRef.update({ downvotes: FieldValue.increment(-1) });
            await db.collection('users').doc(userSnapshot2.docs[0].id).update({
              dislikedArticles: FieldValue.arrayRemove(slug)
            });
            points = 0;
            activityAction = 'undislike_article';
          } else {
            // Dislike - remove like first if exists, then add dislike
            if (likedArticles.includes(slug)) {
              await articleRef.update({ upvotes: FieldValue.increment(-1) });
              await db.collection('users').doc(userSnapshot2.docs[0].id).update({
                likedArticles: FieldValue.arrayRemove(slug)
              });
            }
            
            await articleRef.update({ downvotes: FieldValue.increment(1) });
            await db.collection('users').doc(userSnapshot2.docs[0].id).update({
              dislikedArticles: FieldValue.arrayUnion(slug)
            });
            points = 0; // No points for dislikes
            activityAction = 'dislike_article';
          }
        }
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