import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

interface BatchVoteRequest {
  walletAddress: string;
  indexName: string;
  votes: Array<{
    tokenAddress: string;
    action: 'add' | 'remove' | 'weight_change';
    weight?: number;
    dexScreenerData?: any;
    replacingToken?: string;
  }>;
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

// POST - Submit batch votes
export async function POST(request: Request) {
  try {
    const body: BatchVoteRequest = await request.json();
    const { walletAddress, indexName, votes } = body;

    if (!walletAddress || !indexName || !votes || votes.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'walletAddress, indexName, and votes array are required'
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
    const batchVoteId = `${walletAddress}-${indexName}-${periodId}`;

    // Check if user has already submitted a complete batch vote in this period
    const existingBatchVote = await db.collection('index_batch_votes').doc(batchVoteId).get();
    if (existingBatchVote.exists) {
      const batchData = existingBatchVote.data();
      if (batchData?.changeCount >= 1) {
        return NextResponse.json({ 
          error: 'Vote limit reached',
          details: 'You can only change your complete vote once per voting period'
        }, { status: 400 });
      }
    }

    // Submit all votes
    const votePromises = votes.map(vote => {
      const voteId = `${walletAddress}-${indexName}-${vote.tokenAddress}-${periodId}`;
      const voteData = {
        walletAddress,
        indexName,
        tokenAddress: vote.tokenAddress,
        action: vote.action,
        weight: vote.weight || 0,
        periodId,
        timestamp: new Date(),
        batchVoteId,
        dexScreenerData: vote.dexScreenerData || null,
        replacingToken: vote.replacingToken || null
      };
      
      return db.collection('index_votes').doc(voteId).set(voteData);
    });

    await Promise.all(votePromises);

    // Record batch vote
    const batchVoteData = {
      walletAddress,
      indexName,
      periodId,
      voteCount: votes.length,
      timestamp: new Date(),
      changeCount: existingBatchVote.exists ? (existingBatchVote.data()?.changeCount || 0) + 1 : 0
    };

    await db.collection('index_batch_votes').doc(batchVoteId).set(batchVoteData);

    // Award points only on first complete batch vote (not changes)
    let pointsEarned = 0;
    if (!existingBatchVote.exists) {
      pointsEarned = 50; // Points for completing the full voting process
      
      // Record points transaction
      await db.collection('user_activities').add({
        userId: walletAddress,
        walletAddress,
        action: 'index_batch_vote',
        points: pointsEarned,
        indexName,
        periodId,
        voteCount: votes.length,
        timestamp: new Date()
      });
    }

    return NextResponse.json({ 
      success: true,
      message: 'All votes submitted successfully',
      pointsEarned,
      batchVoteId,
      periodId,
      voteCount: votes.length
    });

  } catch (error) {
    console.error('Error submitting batch votes:', error);
    return NextResponse.json({ error: 'Failed to submit votes' }, { status: 500 });
  }
}
