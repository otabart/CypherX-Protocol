import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

interface LeaderboardEntry {
  walletAddress: string;
  points: number;
  rank?: number;
  lastUpdated?: Date | string;
  createdAt?: Date | string;
}

interface FirestoreTimestamp {
  toDate: () => Date;
}

// GET - Fetch leaderboard
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const top = parseInt(searchParams.get('top') || '10');
    const walletAddress = searchParams.get('walletAddress');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    if (walletAddress) {
      // Get specific user's rank and stats
      const userQuery = db.collection('leaderboard')
        .where('walletAddress', '==', walletAddress);
      const userSnapshot = await userQuery.get();
      
      if (userSnapshot.empty) {
        return NextResponse.json({ 
          user: null, 
          message: 'User not found in leaderboard' 
        });
      }

      const userData = userSnapshot.docs[0].data() as LeaderboardEntry;
      
      // Get user's rank by counting users with higher points
      const rankQuery = db.collection('leaderboard')
        .where('points', '>', userData.points)
        .orderBy('points', 'desc');
      const rankSnapshot = await rankQuery.get();
      const userRank = rankSnapshot.size + 1;

      return NextResponse.json({
        user: {
          ...userData,
          rank: userRank,
          lastUpdated: typeof userData.lastUpdated === 'object' && userData.lastUpdated !== null && 'toDate' in userData.lastUpdated 
            ? (userData.lastUpdated as FirestoreTimestamp).toDate().toISOString() 
            : userData.lastUpdated,
          createdAt: typeof userData.createdAt === 'object' && userData.createdAt !== null && 'toDate' in userData.createdAt 
            ? (userData.createdAt as FirestoreTimestamp).toDate().toISOString() 
            : userData.createdAt,
        }
      });
    }

    // Get top users
    const leaderboardQuery = db.collection('leaderboard')
      .orderBy('points', 'desc')
      .limit(top);
    
    const querySnapshot = await leaderboardQuery.get();
    const leaderboard: LeaderboardEntry[] = [];
    
    querySnapshot.docs.forEach((doc, index: number) => {
      const data = doc.data() as LeaderboardEntry;
      leaderboard.push({
        ...data,
        rank: index + 1,
        lastUpdated: typeof data.lastUpdated === 'object' && data.lastUpdated !== null && 'toDate' in data.lastUpdated 
          ? (data.lastUpdated as FirestoreTimestamp).toDate().toISOString() 
          : data.lastUpdated,
        createdAt: typeof data.createdAt === 'object' && data.createdAt !== null && 'toDate' in data.createdAt 
          ? (data.createdAt as FirestoreTimestamp).toDate().toISOString() 
          : data.createdAt,
      });
    });

    return NextResponse.json({ 
      leaderboard,
      total: leaderboard.length,
      page,
      pageSize
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Error fetching leaderboard' }, { status: 500 });
  }
} 