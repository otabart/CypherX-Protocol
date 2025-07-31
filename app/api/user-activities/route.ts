import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface UserActivity {
  userId: string;
  walletAddress: string;
  action: 'read_article' | 'share_x' | 'share_telegram' | 'like_article' | 'comment_article' | 'dislike_article' | 'referral' | 'nft_minted';
  points: number;
  articleSlug?: string;
  articleId?: string;
  metadata?: Record<string, any>;
  createdAt: any;
}

// GET - Fetch user activities
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const limit = parseInt(searchParams.get('limit') || '10');
    const action = searchParams.get('action');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    let q = db.collection('user_activities')
      .where('walletAddress', '==', walletAddress)
      .orderBy('createdAt', 'desc');

    if (action) {
      q = q.where('action', '==', action);
    }

    const querySnapshot = await q.get();
    const activities = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }));

    return NextResponse.json({ activities: activities.slice(0, limit) });
  } catch (error) {
    console.error('Error fetching user activities:', error);
    return NextResponse.json({ error: 'Error fetching user activities' }, { status: 500 });
  }
}

// POST - Create new user activity
export async function POST(request: Request) {
  try {
    const body = await request.json() as UserActivity;
    const { userId, walletAddress, action, points, articleSlug, articleId, metadata } = body;

    if (!userId || !walletAddress || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create the activity
    const activityData = {
      userId,
      walletAddress,
      action,
      points: points || 0,
      articleSlug,
      articleId,
      metadata,
      createdAt: FieldValue.serverTimestamp(),
    };

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const docRef = await db.collection('user_activities').add(activityData);

    // Update user points in users collection
    if (points && points > 0) {
      try {
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
            createdAt: FieldValue.serverTimestamp(),
            lastActivity: FieldValue.serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('Error updating user points:', error);
      }
    }

    // Update leaderboard
    if (points && points > 0) {
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
            points,
            createdAt: FieldValue.serverTimestamp(),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        }
      } catch (error) {
        console.error('Error updating leaderboard:', error);
      }
    }

    return NextResponse.json({ 
      id: docRef.id, 
      success: true,
      pointsEarned: points 
    });
  } catch (error) {
    console.error('Error creating user activity:', error);
    return NextResponse.json({ error: 'Error creating user activity' }, { status: 500 });
  }
} 