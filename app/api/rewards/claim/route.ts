import { NextResponse } from 'next/server';
import { adminDb, auth } from '@/lib/firebase-admin';

// Claim ETH rewards
export async function POST(request: any) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token
    let userId: string;
    try {
      const decodedToken = await auth().verifyIdToken(token);
      userId = decodedToken.uid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = adminDb();

    // Get or create user's rewards data
    const rewardsRef = db.collection('rewards').doc(userId);
    const rewardsDoc = await rewardsRef.get();

    if (!rewardsDoc.exists) {
      // Create empty rewards document for user
      await rewardsRef.set({
        ethRewards: 0,
        referralCode: generateReferralCode(),
        referrals: 0,
        referralRate: 30,
        volumeTraded: 0,
        transactions: 0,
        lastUpdated: new Date().toISOString()
      });
      
      return NextResponse.json({ error: 'No rewards to claim' }, { status: 400 });
    }

    const rewardsData: any = rewardsDoc.data();
    const claimableAmount = rewardsData?.ethRewards || 0;

    if (claimableAmount <= 0) {
      return NextResponse.json({ error: 'No rewards to claim' }, { status: 400 });
    }

    // Check if user has a wallet address
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData: any = userDoc.data();
    const walletAddress = userData?.walletAddress;

    if (!walletAddress) {
      return NextResponse.json({ error: 'No wallet address found. Please connect your wallet first.' }, { status: 400 });
    }

    // Create claim transaction record
    const claimRef = await db.collection('claimTransactions').add({
      userId,
      walletAddress,
      amount: claimableAmount,
      status: 'pending',
      timestamp: new Date().toISOString(),
      transactionHash: null
    });

    // Reset user's ETH rewards to 0
    await rewardsRef.update({
      ethRewards: 0,
      lastClaimed: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });

    // Add claim to user's history
    await db.collection('users').doc(userId).collection('claimHistory').add({
      claimId: claimRef.id,
      amount: claimableAmount,
      timestamp: new Date().toISOString(),
      status: 'pending'
    });

    // TODO: In a real implementation, this would trigger a smart contract call
    // to transfer ETH to the user's wallet on Base chain
    // For now, we'll simulate the transaction

    // Simulate blockchain transaction
    const simulatedTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    
    // Update claim transaction status
    await claimRef.update({
      status: 'completed',
      transactionHash: simulatedTxHash,
      completedAt: new Date().toISOString()
    });

    // Update user's claim history
    await db.collection('users').doc(userId).collection('claimHistory')
      .where('claimId', '==', claimRef.id)
      .get()
      .then((snapshot: any) => {
        if (!snapshot.empty) {
          snapshot.docs[0].ref.update({
            status: 'completed',
            transactionHash: simulatedTxHash
          });
        }
      });

    return NextResponse.json({
      success: true,
      claimId: claimRef.id,
      amount: claimableAmount,
      transactionHash: simulatedTxHash,
      message: 'Rewards claimed successfully! ETH will be sent to your wallet shortly.'
    });
  } catch (error) {
    console.error('Error claiming rewards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to generate referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'CYPHERX';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get claim history
export async function GET(request: any) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token
    let userId: string;
    try {
      const decodedToken = await auth().verifyIdToken(token);
      userId = decodedToken.uid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = adminDb();

    // Get user's claim history
    const claimHistorySnapshot = await db.collection('users')
      .doc(userId)
      .collection('claimHistory')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const claimHistory = claimHistorySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get pending claims
    const pendingClaimsSnapshot = await db.collection('claimTransactions')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    const pendingClaims = pendingClaimsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      claimHistory,
      pendingClaims,
      totalClaims: claimHistory.length
    });
  } catch (error) {
    console.error('Error fetching claim history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
