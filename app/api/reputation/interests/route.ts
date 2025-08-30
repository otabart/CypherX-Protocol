import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, interests } = body;

    if (!userId || !interests || !Array.isArray(interests)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Initialize user interests
    const interestUpdates = interests.map((interest: string) => ({
      category: interest,
      level: 'beginner',
      score: 0,
      eventsAttended: 0,
      eventsHosted: 0
    }));

    // Update user interests
    await userRef.update({
      'reputation.interests': interestUpdates,
      'reputation.updatedAt': FieldValue.serverTimestamp()
    });

    // Award points for setting up interests
    await trackReputationAction(userId, 'setup-interests', 25, 'Set up your interest profile', { interests }, db);

    return NextResponse.json({
      success: true,
      interests: interestUpdates
    });

  } catch (error) {
    console.error('Error updating interests:', error);
    return NextResponse.json({ 
      error: 'Failed to update interests',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, category, action, points } = body;

    if (!userId || !category || !action || !points) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const currentInterests = userData?.reputation?.interests || [];
    const interestIndex = currentInterests.findIndex((i: any) => i.category === category);

    if (interestIndex === -1) {
      return NextResponse.json({ error: 'Interest category not found' }, { status: 404 });
    }

    // Update interest score and level
    const updatedInterests = [...currentInterests];
    const currentInterest = updatedInterests[interestIndex];
    
    currentInterest.score += points;
    currentInterest.level = calculateInterestLevel(currentInterest.score);

    // Update specific metrics based on action
    if (action === 'attend-event') {
      currentInterest.eventsAttended += 1;
    } else if (action === 'host-event') {
      currentInterest.eventsHosted += 1;
    }

    updatedInterests[interestIndex] = currentInterest;

    // Update user interests
    await userRef.update({
      'reputation.interests': updatedInterests,
      'reputation.updatedAt': FieldValue.serverTimestamp()
    });

    // Track reputation action
    await trackReputationAction(userId, action, points, `${action} in ${category}`, { category }, db);

    return NextResponse.json({
      success: true,
      updatedInterest: currentInterest
    });

  } catch (error) {
    console.error('Error updating interest:', error);
    return NextResponse.json({ 
      error: 'Failed to update interest',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function calculateInterestLevel(score: number): 'beginner' | 'intermediate' | 'expert' {
  if (score >= 1000) return 'expert';
  if (score >= 250) return 'intermediate';
  return 'beginner';
}

async function trackReputationAction(userId: string, action: string, points: number, description: string, metadata: any, db: any) {
  const reputationAction = {
    id: `${userId}_${Date.now()}`,
    userId,
    action,
    points,
    description,
    timestamp: new Date().toISOString(),
    metadata
  };

  await db.collection('reputationActions').doc(reputationAction.id).set(reputationAction);

  // Update user's total reputation score
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  const userData = userDoc.data();
  
  const currentScore = userData?.reputation?.totalScore || 0;
  const newScore = currentScore + points;
  const newTier = calculateReputationTier(newScore);

  await userRef.update({
    'reputation.totalScore': newScore,
    'reputation.tier': newTier,
    'reputation.updatedAt': FieldValue.serverTimestamp()
  });
}

function calculateReputationTier(score: number): 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' {
  if (score >= 10000) return 'diamond';
  if (score >= 2000) return 'platinum';
  if (score >= 500) return 'gold';
  if (score >= 100) return 'silver';
  return 'bronze';
}
