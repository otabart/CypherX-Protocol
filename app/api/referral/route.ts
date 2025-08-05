import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface ReferralRequest {
  walletAddress: string;
  userId: string;
  referralCode: string;
  action: 'create_referral' | 'use_referral' | 'earn_referral_bonus';
  referredWallet?: string;
  referredUserId?: string;
  swapVolumeUSD?: number;
}

export async function POST(request: Request) {
  try {
    const body: ReferralRequest = await request.json();
    const { 
      walletAddress, 
      userId, 
      referralCode, 
      action,
      referredWallet,
      referredUserId,
      swapVolumeUSD
    } = body;

    if (!walletAddress || !userId || !referralCode || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    switch (action) {
      case 'create_referral':
        // Generate unique referral code for user
        const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
        const userSnapshot = await userQuery.get();
        
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const referralCode = `REF_${walletAddress.slice(2, 8).toUpperCase()}_${Date.now().toString(36)}`;
          
          await db.collection('users').doc(userDoc.id).update({
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
        if (!referredWallet || !referredUserId) {
          return NextResponse.json({ error: 'Referred wallet and user ID required' }, { status: 400 });
        }

        // Find referrer by referral code
        const referrerQuery = db.collection('users').where('referralCode', '==', referralCode);
        const referrerSnapshot = await referrerQuery.get();
        
        if (referrerSnapshot.empty) {
          return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
        }

        const referrerDoc = referrerSnapshot.docs[0];
        const referrerData = referrerDoc.data();
        
        // Check if user has already been referred
        const referredUserQuery = db.collection('users').where('walletAddress', '==', referredWallet);
        const referredUserSnapshot = await referredUserQuery.get();
        
        if (!referredUserSnapshot.empty) {
          const referredUserData = referredUserSnapshot.docs[0].data();
          if (referredUserData.referredBy) {
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
        if (!referredUserSnapshot.empty) {
          await db.collection('users').doc(referredUserSnapshot.docs[0].id).update({
            referredBy: referrerDoc.id,
            referredByWallet: referrerData.walletAddress,
            points: FieldValue.increment(referredPoints),
            lastActivity: FieldValue.serverTimestamp(),
          });
        } else {
          // Create new referred user
          await db.collection('users').add({
            walletAddress: referredWallet,
            points: referredPoints,
            referredBy: referrerDoc.id,
            referredByWallet: referrerData.walletAddress,
            createdAt: FieldValue.serverTimestamp(),
            lastActivity: FieldValue.serverTimestamp(),
          });
        }

        // Record activities
        await db.collection('user_activities').add({
          userId: referrerDoc.id,
          walletAddress: referrerData.walletAddress,
          action: 'referral_bonus',
          points: referrerPoints,
          metadata: {
            referredWallet,
            referralCode,
          },
          createdAt: FieldValue.serverTimestamp(),
        });

        await db.collection('user_activities').add({
          userId: referredUserId,
          walletAddress: referredWallet,
          action: 'referred_user_bonus',
          points: referredPoints,
          metadata: {
            referrerWallet: referrerData.walletAddress,
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

        const userQuery2 = db.collection('users').where('walletAddress', '==', walletAddress);
        const userSnapshot2 = await userQuery2.get();
        
        if (!userSnapshot2.empty) {
          await db.collection('users').doc(userSnapshot2.docs[0].id).update({
            points: FieldValue.increment(bonusPoints),
            referralEarnings: FieldValue.increment(bonusPoints),
            lastActivity: FieldValue.serverTimestamp(),
          });

          await db.collection('user_activities').add({
            userId,
            walletAddress,
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
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
    const userSnapshot = await userQuery.get();
    
    if (userSnapshot.empty) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userSnapshot.docs[0].data();
    
    return NextResponse.json({
      success: true,
      referralCode: userData.referralCode || null,
      referralCount: userData.referralCount || 0,
      referralEarnings: userData.referralEarnings || 0,
      referredBy: userData.referredBy || null,
      referredByWallet: userData.referredByWallet || null,
    });

  } catch (error) {
    console.error('Error fetching referral data:', error);
    return NextResponse.json({ error: 'Failed to fetch referral data' }, { status: 500 });
  }
} 