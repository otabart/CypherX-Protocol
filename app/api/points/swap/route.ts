import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface SwapPointsRequest {
  walletAddress: string;
  userId: string;
  tokenAddress: string;
  action: 'swap' | 'liquidity_add' | 'liquidity_remove' | 'stake' | 'unstake';
  tokenSymbol?: string;
  amount?: number;
  value?: number;
}

export async function POST(request: Request) {
  try {
    const body: SwapPointsRequest = await request.json();
    const { 
      walletAddress, 
      userId, 
      tokenAddress, 
      action, 
      tokenSymbol,
      amount,
      value 
    } = body;

    if (!walletAddress || !userId || !tokenAddress || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Calculate points based on action and value
    let points = 0;
    let activityAction = '';

    switch (action) {
      case 'swap':
        points = 20; // Base points for swap
        if (value && value > 100) {
          points += Math.floor(value / 100) * 5; // Bonus points for high-value swaps
        }
        activityAction = 'swap_token';
        break;
      
      case 'liquidity_add':
        points = 30; // Base points for adding liquidity
        if (value && value > 500) {
          points += Math.floor(value / 500) * 10; // Bonus for high-value liquidity
        }
        activityAction = 'add_liquidity';
        break;
      
      case 'liquidity_remove':
        points = 15; // Base points for removing liquidity
        activityAction = 'remove_liquidity';
        break;
      
      case 'stake':
        points = 25; // Base points for staking
        if (amount && amount > 1000) {
          points += Math.floor(amount / 1000) * 5; // Bonus for high amounts
        }
        activityAction = 'stake_token';
        break;
      
      case 'unstake':
        points = 10; // Base points for unstaking
        activityAction = 'unstake_token';
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Check for daily limits to prevent farming
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
    const userSnapshot = await userQuery.get();
    
    if (!userSnapshot.empty) {
      const userData = userSnapshot.docs[0].data();
      const todayActivities = userData.dailyActivities?.[today.toISOString().split('T')[0]] || {};
      const actionCount = todayActivities[action] || 0;
      
      // Daily limits to prevent farming
      const dailyLimits = {
        swap: 20,
        liquidity_add: 5,
        liquidity_remove: 5,
        stake: 10,
        unstake: 10
      };
      
      if (actionCount >= dailyLimits[action]) {
        return NextResponse.json({ 
          error: `Daily limit reached for ${action}`,
          limit: dailyLimits[action]
        }, { status: 429 });
      }
      
      // Update daily activity count
      const dailyKey = today.toISOString().split('T')[0];
      await db.collection('users').doc(userSnapshot.docs[0].id).update({
        [`dailyActivities.${dailyKey}.${action}`]: FieldValue.increment(1),
        points: FieldValue.increment(points),
        lastActivity: FieldValue.serverTimestamp(),
      });
    } else {
      // Create new user
      const dailyKey = today.toISOString().split('T')[0];
      await db.collection('users').add({
        walletAddress,
        points,
        dailyActivities: {
          [dailyKey]: {
            [action]: 1
          }
        },
        createdAt: FieldValue.serverTimestamp(),
        lastActivity: FieldValue.serverTimestamp(),
      });
    }

    // Record the activity
    const activityData = {
      userId,
      walletAddress,
      action: activityAction,
      points,
      tokenAddress,
      metadata: {
        tokenSymbol,
        amount,
        value,
      },
      createdAt: FieldValue.serverTimestamp(),
    };

    await db.collection('user_activities').add(activityData);

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
      await db.collection('leaderboard').add({
        walletAddress,
        points,
        createdAt: FieldValue.serverTimestamp(),
        lastUpdated: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      pointsEarned: points,
      action,
    });

  } catch (error) {
    console.error('Error processing swap points:', error);
    return NextResponse.json({ error: 'Failed to process swap points' }, { status: 500 });
  }
} 