import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Firestore } from 'firebase-admin/firestore';

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
    // Validate request body
    let body: CalendarPointsRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

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

    // Enhanced validation
    if (!walletAddress?.trim() || !userId?.trim() || !eventId?.trim() || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'walletAddress, userId, eventId, and action are required'
      }, { status: 400 });
    }

    // Validate wallet address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ 
        error: 'Invalid wallet address format',
        details: 'Wallet address must be a valid Ethereum address'
      }, { status: 400 });
    }

    // Validate action-specific requirements
    if (action === 'comment' && (!comment?.trim() || comment.trim().length < 1)) {
      return NextResponse.json({ 
        error: 'Comment is required and cannot be empty',
        details: 'Please provide a meaningful comment'
      }, { status: 400 });
    }
    
    if (action === 'share' && !platform) {
      return NextResponse.json({ 
        error: 'Platform is required for sharing',
        details: 'Please specify the platform (x, telegram, discord)'
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
        points = 20;
        activityAction = 'comment_event';
        break;
      
      case 'share':
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
        return NextResponse.json({ 
          error: 'Invalid action',
          details: `Action '${action}' is not supported`
        }, { status: 400 });
    }

    // Check for daily limits to prevent farming
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
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

    // Use a batch write for better consistency
    const batch = db.batch();
    
    try {
      const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
      const userSnapshot = await userQuery.get();
      
      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();
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
            alreadyPerformed: true,
            details: 'This action has already been performed on this event'
          }, { status: 400 });
        }
        
        if (actionCount >= dailyLimits[action]) {
          return NextResponse.json({ 
            error: `Daily limit reached for ${action}`,
            limit: dailyLimits[action],
            details: `You can only perform this action ${dailyLimits[action]} times per day`
          }, { status: 429 });
        }
        
        // Update daily activity count and track event actions
        const dailyKey = today.toISOString().split('T')[0];
        const updateData: Record<string, any> = {
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
        
        batch.update(userDoc.ref, updateData);
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
          eventActions: {
            [eventId]: {
              [action]: true
            }
          },
          createdAt: FieldValue.serverTimestamp(),
          lastActivity: FieldValue.serverTimestamp(),
        });
      }

      // Record the activity
      const metadata: Record<string, unknown> = {
        eventTitle,
      };
      
      if (action === 'comment' && comment) {
        metadata.comment = comment;
      }
      
      if (action === 'share' && platform) {
        metadata.platform = platform;
      }

      if (action === 'attend' && eventTime && attendanceTime) {
        try {
          const eventDateTime = new Date(eventTime);
          const attendanceDateTime = new Date(attendanceTime);
          
          if (!isNaN(eventDateTime.getTime()) && !isNaN(attendanceDateTime.getTime())) {
            const timeDifference = attendanceDateTime.getTime() - eventDateTime.getTime();
            const minutesLate = timeDifference / (1000 * 60);

            if (minutesLate > 0) {
              metadata.minutesLate = minutesLate;
            }
          }
        } catch (dateError) {
          console.warn('Failed to parse date for attendance:', dateError);
          // Continue without date metadata
        }
      }
      
      const activityRef = db.collection('user_activities').doc();
      const activityData = {
        userId,
        walletAddress,
        action: activityAction,
        points,
        eventId,
        metadata,
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
        dailyLimit: dailyLimits[action] || 0,
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
    console.error('Error processing calendar points:', error);
    
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