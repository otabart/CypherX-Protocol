import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    console.log('User Stats API: Received request for walletAddress:', walletAddress);

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const db = adminDb();
    const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
    const userSnapshot = await userQuery.get();
    
    console.log('User Stats API: User document exists:', !userSnapshot.empty);

    if (userSnapshot.empty) {
      return NextResponse.json({ 
        points: 0, 
        rank: 0, 
        contributions: 0,
        articles: 0,
        followers: 0,
        createdAt: new Date().toISOString()
      });
    }

    const userData = userSnapshot.docs[0].data();
    
    return NextResponse.json({
      points: userData?.points || 0,
      rank: userData?.rank || 0,
      contributions: userData?.contributions || 0,
      articles: userData?.articles || 0,
      followers: userData?.followers || 0,
      createdAt: userData?.createdAt || new Date().toISOString(),
      lastUpdated: userData?.lastUpdated || new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 });
  }
} 