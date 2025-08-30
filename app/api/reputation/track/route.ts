import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, action, points, description, metadata } = body;

    if (!userId || !action || !points || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Create reputation action record
    const reputationAction = {
      id: `${userId}_${Date.now()}`,
      userId,
      action,
      points,
      description,
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    };

    // Add to reputation actions collection
    await db.collection('reputationActions').doc(reputationAction.id).set(reputationAction);

    // Update user's reputation score
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const currentScore = userData?.reputation?.totalScore || 0;
    const newScore = currentScore + points;
    const newTier = calculateReputationTier(newScore);

    // Update user reputation
    await userRef.update({
      'reputation.totalScore': newScore,
      'reputation.tier': newTier,
      'reputation.updatedAt': FieldValue.serverTimestamp()
    });

    // Check for new badges
    const newBadges = await checkAndAwardBadges(userId, db);

    return NextResponse.json({
      success: true,
      newScore,
      newTier,
      pointsEarned: points,
      newBadges
    });

  } catch (error) {
    console.error('Error tracking reputation:', error);
    return NextResponse.json({ 
      error: 'Failed to track reputation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function calculateReputationTier(score: number): 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' {
  if (score >= 10000) return 'diamond';
  if (score >= 2000) return 'platinum';
  if (score >= 500) return 'gold';
  if (score >= 100) return 'silver';
  return 'bronze';
}

async function checkAndAwardBadges(userId: string, db: any) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  const newBadges: Array<{ id: string; name: string; description: string; category: string }> = [];
  const existingBadges = userData?.reputation?.badges?.map((b: any) => b.id) || [];

  // Check for first event badge
  if (!existingBadges.includes('first-event') && userData?.attendedEvents?.length > 0) {
    newBadges.push({
      id: 'first-event',
      name: 'Event Pioneer',
      description: 'Attended your first event',
      category: 'participation'
    });
  }

  // Check for event host badge
  if (!existingBadges.includes('event-host') && userData?.reputation?.interests?.some((i: any) => i.eventsHosted > 0)) {
    newBadges.push({
      id: 'event-host',
      name: 'Community Organizer',
      description: 'Hosted your first event',
      category: 'leadership'
    });
  }

  // Check for streak master badge
  if (!existingBadges.includes('streak-master') && userData?.projectEngagement) {
    const hasStreak = Object.values(userData.projectEngagement).some((engagement: any) => engagement.engagementStreak >= 5);
    if (hasStreak) {
      newBadges.push({
        id: 'streak-master',
        name: 'Consistency King',
        description: 'Attended 5 events in a row',
        category: 'dedication'
      });
    }
  }

  // Check for influencer badge
  if (!existingBadges.includes('influencer') && userData?.reputation?.influencerStatus?.followers >= 100) {
    newBadges.push({
      id: 'influencer',
      name: 'Community Leader',
      description: 'Reached 100 followers',
      category: 'influence'
    });
  }

  // Check for expert badge
  if (!existingBadges.includes('expert') && userData?.reputation?.interests?.some((i: any) => i.level === 'expert')) {
    newBadges.push({
      id: 'expert',
      name: 'Domain Expert',
      description: 'Achieved expert level in any interest',
      category: 'expertise'
    });
  }

  // Award new badges
  if (newBadges.length > 0) {
    const badgeUpdates = newBadges.map(badge => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      earnedAt: new Date().toISOString()
    }));

    await userRef.update({
      'reputation.badges': FieldValue.arrayUnion(...badgeUpdates)
    });
  }

  return newBadges;
}
