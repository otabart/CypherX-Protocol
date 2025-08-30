import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface ReferralRequest {
  userId: string;
  referralCode: string;
  action: 'create_referral' | 'use_referral' | 'earn_referral_bonus';
  referredUserId?: string;
  swapVolumeUSD?: number;
}

export async function POST(request: Request) {
  try {
    const body: ReferralRequest = await request.json();
    const { 
      userId, 
      referralCode, 
      action,
      referredUserId,
      swapVolumeUSD
    } = body;

    if (!userId || !referralCode || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    switch (action) {
      case 'create_referral':
        // Generate unique referral code for user
        const userDocRef = db.collection('users').doc(userId);
        const userDoc = await userDocRef.get();
        
        if (userDoc.exists) {
          const referralCode = `REF_${userId.slice(0, 8).toUpperCase()}_${Date.now().toString(36)}`;
          
          await userDocRef.update({
            referralCode,
            referralCount: FieldValue.increment(0),
            referralEarnings: FieldValue.increment(0),
            lastActivity: FieldValue.serverTimestamp(),
          });

          return NextResponse.json({
            success: true,
            referralCode,
            message: 'Referral code created successfully'
          });
        } else {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        break;

      case 'use_referral':
        if (!referredUserId) {
          return NextResponse.json({ error: 'Referred user ID required' }, { status: 400 });
        }

        // Find referrer by referral code
        const referrerQuery = db.collection('users').where('referralCode', '==', referralCode);
        const referrerSnapshot = await referrerQuery.get();
        
        if (referrerSnapshot.empty) {
          return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
        }

        const referrerDoc = referrerSnapshot.docs[0];
        
        // Check if user has already been referred
        const referredUserDocRef = db.collection('users').doc(referredUserId);
        const referredUserDoc = await referredUserDocRef.get();
        
        if (referredUserDoc.exists) {
          const referredUserData = referredUserDoc.data();
          if (referredUserData && referredUserData.referredBy) {
            return NextResponse.json({ error: 'User has already been referred' }, { status: 400 });
          }
        }

        // Award points to both users
        const referrerPoints = 100; // Referrer gets 100 points
        const referredPoints = 50; // Referred user gets 50 points

        // Update referrer
        await db.collection('users').doc(referrerDoc.id).update({
          referralCount: FieldValue.increment(1),
          referralEarnings: FieldValue.increment(referrerPoints),
          points: FieldValue.increment(referrerPoints),
          lastActivity: FieldValue.serverTimestamp(),
        });

        // Update referred user
        if (referredUserDoc.exists) {
          await referredUserDocRef.update({
            referredBy: referralCode,
            points: FieldValue.increment(referredPoints),
            lastActivity: FieldValue.serverTimestamp(),
          });
        } else {
          // Create new referred user
          await referredUserDocRef.set({
            points: referredPoints,
            referredBy: referralCode,
            createdAt: FieldValue.serverTimestamp(),
            lastActivity: FieldValue.serverTimestamp(),
          });
        }

        // Record activities
        await db.collection('user_activities').add({
          userId: referrerDoc.id,
          action: 'referral_bonus',
          points: referrerPoints,
          metadata: {
            referredUserId,
            referralCode,
          },
          createdAt: FieldValue.serverTimestamp(),
        });

        await db.collection('user_activities').add({
          userId: referredUserId,
          action: 'referred_user_bonus',
          points: referredPoints,
          metadata: {
            referrerUserId: referrerDoc.id,
            referralCode,
          },
          createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({
          success: true,
          referrerPoints,
          referredPoints,
          message: 'Referral bonus awarded successfully'
        });
        break;

      case 'earn_referral_bonus':
        // Award bonus points for high-value swaps
        if (!swapVolumeUSD || swapVolumeUSD < 1000) {
          return NextResponse.json({ error: 'Minimum swap volume required for referral bonus' }, { status: 400 });
        }

        const bonusPoints = Math.floor(swapVolumeUSD / 1000) * 25; // 25 points per $1000

        const userDocRef2 = db.collection('users').doc(userId);
        const userDoc2 = await userDocRef2.get();
        
        if (userDoc2.exists) {
          await userDocRef2.update({
            points: FieldValue.increment(bonusPoints),
            referralEarnings: FieldValue.increment(bonusPoints),
            lastActivity: FieldValue.serverTimestamp(),
          });

          await db.collection('user_activities').add({
            userId,
            action: 'referral_swap_bonus',
            points: bonusPoints,
            metadata: {
              swapVolumeUSD,
              referralCode,
            },
            createdAt: FieldValue.serverTimestamp(),
          });

          return NextResponse.json({
            success: true,
            bonusPoints,
            message: 'Referral swap bonus awarded'
          });
        } else {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error processing referral:', error);
    return NextResponse.json({ error: 'Failed to process referral' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    
    if (!userData) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      referralCode: userData.referralCode || null,
      referralCount: userData.referralCount || 0,
      referralEarnings: userData.referralEarnings || 0,
      referredBy: userData.referredBy || null,
    });

  } catch (error) {
    console.error('Error fetching referral data:', error);
    return NextResponse.json({ error: 'Failed to fetch referral data' }, { status: 500 });
  }
} 