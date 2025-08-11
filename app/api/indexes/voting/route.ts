import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

interface VoteRequest {
  walletAddress: string;
  indexName: string;
  tokenAddress: string;
  action: 'add' | 'remove' | 'weight_change';
  weight?: number;
}

interface VotePeriod {
  startDate: Date;
  endDate: Date;
  periodId: string;
}

// Get current voting period (1st and 16th of each month)
function getCurrentVotingPeriod(): VotePeriod {
  const now = new Date();
  const currentDay = now.getDate();
  
  let startDate: Date;
  let endDate: Date;
  let periodId: string;
  
  if (currentDay >= 1 && currentDay < 16) {
    // First period: 1st to 15th
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59);
    periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  } else {
    // Second period: 16th to end of month
    startDate = new Date(now.getFullYear(), now.getMonth(), 16);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-16`;
  }
  
  return { startDate, endDate, periodId };
}

// Check if voting is currently active
function isVotingActive(): boolean {
  const { startDate, endDate } = getCurrentVotingPeriod();
  const now = new Date();
  return now >= startDate && now <= endDate;
}

// POST - Submit a vote
export async function POST(request: Request) {
  try {
    const body: VoteRequest = await request.json();
    const { walletAddress, indexName, tokenAddress, action, weight } = body;

    if (!walletAddress || !indexName || !tokenAddress || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'walletAddress, indexName, tokenAddress, and action are required'
      }, { status: 400 });
    }

    // Validate index name
    const validIndexes = ['CDEX', 'BDEX', 'VDEX', 'AIDEX'];
    if (!validIndexes.includes(indexName)) {
      return NextResponse.json({ 
        error: 'Invalid index name',
        details: 'Must be one of: CDEX, BDEX, VDEX, AIDEX'
      }, { status: 400 });
    }

    // Check if voting is currently active
    if (!isVotingActive()) {
      const { startDate, endDate } = getCurrentVotingPeriod();
      return NextResponse.json({ 
        error: 'Voting is not currently active',
        details: `Voting period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        nextVotingPeriod: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { periodId } = getCurrentVotingPeriod();
    const voteId = `${walletAddress}-${indexName}-${periodId}`;

    // Check if user has already voted in this period
    const existingVote = await db.collection('index_votes').doc(voteId).get();
    if (existingVote.exists) {
      const voteData = existingVote.data();
      if (voteData?.changeCount >= 1) {
        return NextResponse.json({ 
          error: 'Vote limit reached',
          details: 'You can only change your vote once per voting period'
        }, { status: 400 });
      }
    }

    // Create or update vote
    const voteData = {
      walletAddress,
      indexName,
      tokenAddress,
      action,
      weight: weight || 0,
      periodId,
      timestamp: new Date(),
      changeCount: existingVote.exists ? (existingVote.data()?.changeCount || 0) + 1 : 0
    };

    await db.collection('index_votes').doc(voteId).set(voteData);

    // Award points for voting (only on first vote, not changes)
    if (!existingVote.exists) {
      const pointsEarned = 25; // Base points for voting
      
      // Record points transaction
      await db.collection('user_activities').add({
        userId: walletAddress, // Using wallet address as user ID
        walletAddress,
        action: 'index_vote',
        points: pointsEarned,
        indexName,
        tokenAddress,
        periodId,
        timestamp: new Date()
      });

      return NextResponse.json({ 
        success: true,
        message: 'Vote submitted successfully',
        pointsEarned,
        voteId,
        periodId
      });
    } else {
      return NextResponse.json({ 
        success: true,
        message: 'Vote updated successfully',
        voteId,
        periodId
      });
    }

  } catch (error) {
    console.error('Error submitting vote:', error);
    return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
  }
}

// GET - Get voting status and current votes
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const indexName = searchParams.get('indexName');

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { periodId, startDate, endDate } = getCurrentVotingPeriod();
    const isActive = isVotingActive();

    // Get voting statistics
    const votesSnapshot = await db.collection('index_votes')
      .where('periodId', '==', periodId)
      .get();

    const votes = votesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<{ id: string; indexName: string; tokenAddress: string; action: string; weight: number }>;

    // Get user's current vote if wallet address provided
    let userVote = null;
    if (walletAddress) {
      const voteId = `${walletAddress}-${indexName || 'all'}-${periodId}`;
      const userVoteDoc = await db.collection('index_votes').doc(voteId).get();
      if (userVoteDoc.exists) {
        userVote = {
          id: userVoteDoc.id,
          ...userVoteDoc.data()
        };
      }
    }

    // Aggregate votes by index and token
    const voteStats = votes.reduce((acc: Record<string, { indexName: string; tokenAddress: string; action: string; weight: number; voteCount: number }>, vote: { id: string; indexName: string; tokenAddress: string; action: string; weight: number }) => {
      const key = `${vote.indexName}-${vote.tokenAddress}`;
      if (!acc[key]) {
        acc[key] = {
          indexName: vote.indexName,
          tokenAddress: vote.tokenAddress,
          action: vote.action,
          weight: vote.weight,
          voteCount: 0
        };
      }
      acc[key].voteCount++;
      return acc;
    }, {});

    return NextResponse.json({
      isActive,
      periodId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalVotes: votes.length,
      userVote,
      voteStats: Object.values(voteStats),
      nextPeriod: {
        startDate: endDate.toISOString(),
        endDate: new Date(endDate.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching voting data:', error);
    return NextResponse.json({ error: 'Failed to fetch voting data' }, { status: 500 });
  }
} 