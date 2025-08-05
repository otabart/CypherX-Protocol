import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface CalendarPointsRequest {
  walletAddress: string;
  userId: string;
  eventId: string;
  action: 'rsvp' | 'unrsvp' | 'like' | 'dislike' | 'comment' | 'share' | 'attend' | 'attend_late' | 'create_event';
  eventTitle?: string;
  comment?: string;
  platform?: 'x' | 'telegram' | 'discord';
  eventTime?: string; // Event start time
  attendanceTime?: string; // When user clicked the link
}

export async function POST(request: Request) {
  try {
    const body: CalendarPointsRequest = await request.json();
    const { 
      walletAddress, 
      userId, 
      eventId, 
      action, 
      eventTitle,
      comment,
      platform,
      eventTime,
      attendanceTime
    } = body;

    if (!walletAddress || !userId || !eventId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Calculate points based on action
    let points = 0;
    let activityAction = '';

    switch (action) {
      case 'rsvp':
        points = 15;
        activityAction = 'rsvp_event';
        break;
      
      case 'like':
        points = 5;
        activityAction = 'like_event';
        break;
      
      case 'dislike':
        points = 5; // Same as like
        activityAction = 'dislike_event';
        break;
      
      case 'comment':
        if (!comment?.trim()) {
          return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
        }
        points = 20;
        activityAction = 'comment_event';
        break;
      
      case 'share':
        if (!platform) {
          return NextResponse.json({ error: 'Platform is required for sharing' }, { status: 400 });
        }
        points = 25;
        activityAction = `share_event_${platform}`;
        break;
      
      case 'attend':
        points = 30;
        activityAction = 'attend_event';
        break;
      
      case 'attend_late':
        points = 20; // Deduct points for late attendance
        activityAction = 'attend_late_event';
        break;
      
      case 'create_event':
        points = 75;
        activityAction = 'create_event';
        break;
      
      case 'unrsvp':
        points = -15; // Deduct points for un-RSVP
        activityAction = 'unrsvp_event';
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Check for daily limits to prevent farming
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
    const userSnapshot = await userQuery.get();
    
    // Daily limits to prevent farming
    const dailyLimits = {
      rsvp: 15,
      unrsvp: 15,
      like: 25,
      dislike: 15,
      comment: 20,
      share: 8,
      attend: 8,
      attend_late: 8,
      create_event: 5
    };
    
    if (!userSnapshot.empty) {
      try {
        const userData = userSnapshot.docs[0].data();
        const todayActivities = userData.dailyActivities?.[today.toISOString().split('T')[0]] || {};
        const actionCount = todayActivities[action] || 0;
        
        // Check for duplicate actions on the same event
        const eventActions = userData.eventActions?.[eventId] || {};
        const hasAlreadyPerformedAction = eventActions[action] === true;
        
        // For like/dislike, check if user has already performed the opposite action
        const hasOppositeAction = action === 'like' ? eventActions.dislike : 
                                 action === 'dislike' ? eventActions.like : false;
        
        // For RSVP/unRSVP, check if user has already performed the opposite action
        const hasOppositeRSVP = action === 'rsvp' ? eventActions.unrsvp : 
                                action === 'unrsvp' ? eventActions.rsvp : false;
        
        if (hasAlreadyPerformedAction) {
          return NextResponse.json({ 
            error: `You have already ${action}ed this event`,
            alreadyPerformed: true
          }, { status: 400 });
        }
        
        if (actionCount >= dailyLimits[action]) {
          return NextResponse.json({ 
            error: `Daily limit reached for ${action}`,
            limit: dailyLimits[action]
          }, { status: 429 });
        }
        
        // Update daily activity count and track event actions
        const dailyKey = today.toISOString().split('T')[0];
        const updateData: any = {
          [`dailyActivities.${dailyKey}.${action}`]: FieldValue.increment(1),
          points: FieldValue.increment(points),
          lastActivity: FieldValue.serverTimestamp(),
          [`eventActions.${eventId}.${action}`]: true
        };
        
        // If this is a like/dislike action, remove the opposite action
        if (action === 'like' && hasOppositeAction) {
          updateData[`eventActions.${eventId}.dislike`] = FieldValue.delete();
        } else if (action === 'dislike' && hasOppositeAction) {
          updateData[`eventActions.${eventId}.like`] = FieldValue.delete();
        }
        
        // If this is an RSVP/unRSVP action, remove the opposite action
        if (action === 'rsvp' && hasOppositeRSVP) {
          updateData[`eventActions.${eventId}.unrsvp`] = FieldValue.delete();
        } else if (action === 'unrsvp' && hasOppositeRSVP) {
          updateData[`eventActions.${eventId}.rsvp`] = FieldValue.delete();
        }
        
        await db.collection('users').doc(userSnapshot.docs[0].id).update(updateData);
      } catch (error) {
        console.error('Error updating user data:', error);
        return NextResponse.json({ error: 'Failed to update user data' }, { status: 500 });
      }
    } else {
      // Create new user
      try {
        const dailyKey = today.toISOString().split('T')[0];
        await db.collection('users').add({
          walletAddress,
          points,
          dailyActivities: {
            [dailyKey]: {
              [action]: 1
            }
          },
          eventActions: {
            [eventId]: {
              [action]: true
            }
          },
          createdAt: FieldValue.serverTimestamp(),
          lastActivity: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.error('Error creating new user:', error);
        return NextResponse.json({ error: 'Failed to create new user' }, { status: 500 });
      }
    }

    // Record the activity
    const metadata: any = {
      eventTitle,
    };
    
    if (action === 'comment' && comment) {
      metadata.comment = comment;
    }
    
    if (action === 'share' && platform) {
      metadata.platform = platform;
    }

    if (action === 'attend' && eventTime && attendanceTime) {
      const eventDateTime = new Date(eventTime);
      const attendanceDateTime = new Date(attendanceTime);
      const timeDifference = attendanceDateTime.getTime() - eventDateTime.getTime();
      const minutesLate = timeDifference / (1000 * 60);

      if (minutesLate > 0) {
        metadata.minutesLate = minutesLate;
      }
    }
    
    const activityData = {
      userId,
      walletAddress,
      action: activityAction,
      points,
      eventId,
      metadata,
      createdAt: FieldValue.serverTimestamp(),
    };

    try {
      await db.collection('user_activities').add(activityData);
    } catch (error) {
      console.error('Error recording user activity:', error);
      // Don't fail the entire request if activity recording fails
    }

    // Update leaderboard
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

    return NextResponse.json({
      success: true,
      pointsEarned: points,
      action,
      dailyLimit: dailyLimits[action] || 0,
    });

  } catch (error) {
    console.error('Error processing calendar points:', error);
    return NextResponse.json({ error: 'Failed to process calendar points' }, { status: 500 });
  }
} 