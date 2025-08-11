import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Firestore } from 'firebase-admin/firestore';

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
    // Validate request body
    let body: SwapPointsRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        details: 'Please check your request format'
      }, { status: 400 });
    }

    const { 
      walletAddress, 
      userId, 
      tokenAddress, 
      action, 
      tokenSymbol,
      amount,
      value 
    } = body;

    if (!walletAddress?.trim() || !userId?.trim() || !tokenAddress?.trim() || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'walletAddress, userId, tokenAddress, and action are required'
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
    
    // Use a batch write for better consistency
    const batch = db.batch();
    
    try {
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
            limit: dailyLimits[action],
            details: `You can only perform this action ${dailyLimits[action]} times per day`
          }, { status: 429 });
        }
        
        // Update daily activity count
        const dailyKey = today.toISOString().split('T')[0];
        batch.update(userSnapshot.docs[0].ref, {
          [`dailyActivities.${dailyKey}.${action}`]: FieldValue.increment(1),
          points: FieldValue.increment(points),
          lastActivity: FieldValue.serverTimestamp(),
        });
      } else {
        // Create new user
        const dailyKey = today.toISOString().split('T')[0];
        const newUserRef = db.collection('users').doc();
        batch.set(newUserRef, {
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
      const activityRef = db.collection('user_activities').doc();
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
      
      batch.set(activityRef, activityData);

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
        const leaderboardRef = db.collection('leaderboard').doc();
        batch.set(leaderboardRef, {
          walletAddress,
          points,
          createdAt: FieldValue.serverTimestamp(),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }

            // Commit all changes atomically
      await batch.commit();

      return NextResponse.json({
        success: true,
        pointsEarned: points,
        action,
        message: points > 0 ? `+${points} points earned!` : 'Action completed successfully'
      });

    } catch (batchError) {
      console.error('Error in batch operation:', batchError);
      return NextResponse.json({ 
        error: 'Failed to process request',
        details: 'Database operation failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error processing swap points:', error);
    
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
      details: 'An unexpected error occurred while processing your request'
    }, { status: 500 });
  }
} 