import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface EngagementPointsRequest {
  walletAddress: string;
  userId: string;
  timeSpent: number;
  platform: 'calendar' | 'news' | 'trading' | 'general';
}

export async function POST(request: Request) {
  try {
    const body: EngagementPointsRequest = await request.json();
    const { walletAddress, userId, timeSpent, platform } = body;

    if (!walletAddress || !userId || !timeSpent || !platform) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (timeSpent <= 0) {
      return NextResponse.json({ error: 'Time spent must be positive' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
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
    
    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
    const userSnapshot = await userQuery.get();
    
    if (!userSnapshot.empty) {
      const userData = userSnapshot.docs[0].data();
      const todayActivities = userData.dailyActivities?.[todayKey] || {};
      const currentEngagementTime = todayActivities.engagementTime || 0;
      
      // Daily limit: 60 minutes of engagement time (60 points max per day)
      const maxDailyEngagementTime = 60 * 60; // 60 minutes in seconds
      
      if (currentEngagementTime >= maxDailyEngagementTime) {
        return NextResponse.json({ 
          error: 'Daily engagement time limit reached',
          limit: maxDailyEngagementTime / 60
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
      const updateData: any = {
        points: FieldValue.increment(actualPoints),
        lastActivity: FieldValue.serverTimestamp(),
      };
      
      // Update daily engagement time
      updateData[`dailyActivities.${todayKey}.engagementTime`] = FieldValue.increment(actualTimeSpent);
      
      await db.collection('users').doc(userSnapshot.docs[0].id).update(updateData);
      
      // Record the activity
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

      await db.collection('user_activities').add(activityData);

      // Update leaderboard
      const leaderboardQuery = db.collection('leaderboard').where('walletAddress', '==', walletAddress);
      const leaderboardSnapshot = await leaderboardQuery.get();
      
      if (!leaderboardSnapshot.empty) {
        const leaderboardDoc = leaderboardSnapshot.docs[0];
        await db.collection('leaderboard').doc(leaderboardDoc.id).update({
          points: FieldValue.increment(actualPoints),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      } else {
        await db.collection('leaderboard').add({
          walletAddress,
          points: actualPoints,
          createdAt: FieldValue.serverTimestamp(),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }

      return NextResponse.json({
        success: true,
        pointsEarned: actualPoints,
        timeSpent: actualTimeSpent,
        dailyLimit: maxDailyEngagementTime / 60,
      });

    } else {
      // Create new user
      const actualPoints = Math.min(Math.floor(timeSpent / 60), 10);
      
      await db.collection('users').add({
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

      await db.collection('user_activities').add(activityData);

      // Create leaderboard entry
      await db.collection('leaderboard').add({
        walletAddress,
        points: actualPoints,
        createdAt: FieldValue.serverTimestamp(),
        lastUpdated: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        pointsEarned: actualPoints,
        timeSpent,
        dailyLimit: 60,
      });
    }

  } catch (error) {
    console.error('Error processing engagement points:', error);
    return NextResponse.json({ error: 'Failed to process engagement points' }, { status: 500 });
  }
} 