import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Firestore } from 'firebase-admin/firestore';

interface EngagementPointsRequest {
  walletAddress: string;
  userId: string;
  timeSpent: number;
  platform: 'calendar' | 'news' | 'trading' | 'general';
}

export async function POST(request: Request) {
  try {
    // Validate request body
    let body: EngagementPointsRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        details: 'Please check your request format'
      }, { status: 400 });
    }

    const { walletAddress, userId, timeSpent, platform } = body;

    // Enhanced validation
    if (!walletAddress?.trim() || !userId?.trim() || !timeSpent || !platform) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'walletAddress, userId, timeSpent, and platform are required'
      }, { status: 400 });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ 
        error: 'Invalid wallet address format',
        details: 'Wallet address must be a valid Ethereum address'
      }, { status: 400 });
    }

    // Validate time spent
    if (typeof timeSpent !== 'number' || timeSpent <= 0) {
      return NextResponse.json({ 
        error: 'Invalid time spent',
        details: 'Time spent must be a positive number'
      }, { status: 400 });
    }

    // Validate platform
    const validPlatforms = ['calendar', 'news', 'trading', 'general'];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ 
        error: 'Invalid platform',
        details: `Platform must be one of: ${validPlatforms.join(', ')}`
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

    // Calculate points based on time spent (1 point per minute, max 10 points per session)
    const points = Math.min(Math.floor(timeSpent / 60), 10);

    if (points === 0) {
      return NextResponse.json({ 
        success: true, 
        pointsEarned: 0,
        message: 'Not enough time spent to earn points'
      });
    }

    // Check for daily limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().split('T')[0];
    
    // Use batch write for better consistency
    const batch = db.batch();
    
    try {
      const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
      const userSnapshot = await userQuery.get();
      
      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();
        const todayActivities = userData.dailyActivities?.[todayKey] || {};
        const currentEngagementTime = todayActivities.engagementTime || 0;
        
        // Daily limit: 60 minutes of engagement time (60 points max per day)
        const maxDailyEngagementTime = 60 * 60; // 60 minutes in seconds
        
        if (currentEngagementTime >= maxDailyEngagementTime) {
          return NextResponse.json({ 
            error: 'Daily engagement time limit reached',
            limit: maxDailyEngagementTime / 60,
            details: 'You have reached the maximum daily engagement time limit'
          }, { status: 429 });
        }
        
        // Calculate how much time we can actually count
        const remainingTime = maxDailyEngagementTime - currentEngagementTime;
        const actualTimeSpent = Math.min(timeSpent, remainingTime);
        const actualPoints = Math.min(Math.floor(actualTimeSpent / 60), 10);
        
        if (actualPoints === 0) {
          return NextResponse.json({ 
            success: true, 
            pointsEarned: 0,
            message: 'Daily engagement limit reached'
          });
        }
        
        // Update user data
        const updateData: Record<string, any> = {
          points: FieldValue.increment(actualPoints),
          lastActivity: FieldValue.serverTimestamp(),
        };
        
        // Update daily engagement time
        updateData[`dailyActivities.${todayKey}.engagementTime`] = FieldValue.increment(actualTimeSpent);
        
        batch.update(userDoc.ref, updateData);
        
        // Record the activity
        const activityRef = db.collection('user_activities').doc();
        const activityData = {
          userId,
          walletAddress,
          action: 'engagement_time',
          points: actualPoints,
          metadata: {
            timeSpent: actualTimeSpent,
            platform,
            originalTimeSpent: timeSpent,
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
            points: FieldValue.increment(actualPoints),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        } else {
          const leaderboardRef = db.collection('leaderboard').doc();
          batch.set(leaderboardRef, {
            walletAddress,
            points: actualPoints,
            createdAt: FieldValue.serverTimestamp(),
            lastUpdated: FieldValue.serverTimestamp(),
          });
        }

        // Commit all changes atomically
        await batch.commit();

        return NextResponse.json({
          success: true,
          pointsEarned: actualPoints,
          timeSpent: actualTimeSpent,
          dailyLimit: maxDailyEngagementTime / 60,
          message: `+${actualPoints} points earned for engagement!`
        });

      } else {
        // Create new user
        const actualPoints = Math.min(Math.floor(timeSpent / 60), 10);
        
        const newUserRef = db.collection('users').doc();
        batch.set(newUserRef, {
          walletAddress,
          points: actualPoints,
          dailyActivities: {
            [todayKey]: {
              engagementTime: timeSpent
            }
          },
          createdAt: FieldValue.serverTimestamp(),
          lastActivity: FieldValue.serverTimestamp(),
        });

        // Record the activity
        const activityRef = db.collection('user_activities').doc();
        const activityData = {
          userId,
          walletAddress,
          action: 'engagement_time',
          points: actualPoints,
          metadata: {
            timeSpent,
            platform,
          },
          createdAt: FieldValue.serverTimestamp(),
        };

        batch.set(activityRef, activityData);

        // Create leaderboard entry
        const leaderboardRef = db.collection('leaderboard').doc();
        batch.set(leaderboardRef, {
          walletAddress,
          points: actualPoints,
          createdAt: FieldValue.serverTimestamp(),
          lastUpdated: FieldValue.serverTimestamp(),
        });

        // Commit all changes atomically
        await batch.commit();

        return NextResponse.json({
          success: true,
          pointsEarned: actualPoints,
          timeSpent,
          dailyLimit: 60,
          message: `+${actualPoints} points earned for engagement!`
        });
      }

    } catch (batchError) {
      console.error('Error in batch operation:', batchError);
      return NextResponse.json({ 
        error: 'Failed to process request',
        details: 'Database operation failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error processing engagement points:', error);
    
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
      error: 'Failed to process engagement points',
      details: 'An unexpected error occurred while processing your request'
    }, { status: 500 });
  }
} 