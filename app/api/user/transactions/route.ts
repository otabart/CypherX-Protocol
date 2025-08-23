import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('userId'); // Keep parameter name for backward compatibility

    console.log('API: Received request for walletAddress:', walletAddress);

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get today's date for daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch user activities by wallet address
    const activitiesQuery = db.collection('user_activities')
      .where('walletAddress', '==', walletAddress)
      .orderBy('createdAt', 'desc')
      .limit(100); // Limit to last 100 transactions

    const snapshot = await activitiesQuery.get();
    console.log('API: Found', snapshot.docs.length, 'transactions for walletAddress:', walletAddress);
    
    const transactions = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        action: data.action,
        points: data.points || 0,
        articleSlug: data.articleSlug,
        commentId: data.commentId,
        metadata: data.metadata,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      };
    });

    // Calculate statistics
    let totalEarned = 0;
    let totalSpent = 0;
    let todayEarned = 0;
    let todaySpent = 0;

    transactions.forEach(transaction => {
      const transactionDate = new Date(transaction.createdAt);
      const isToday = transactionDate >= today;

      if (transaction.points > 0) {
        totalEarned += transaction.points;
        if (isToday) todayEarned += transaction.points;
      } else if (transaction.points < 0) {
        totalSpent += Math.abs(transaction.points);
        if (isToday) todaySpent += Math.abs(transaction.points);
      }
    });

    const stats = {
      totalEarned,
      totalSpent,
      netPoints: totalEarned - totalSpent,
      todayEarned,
      todaySpent
    };

    // Get user's daily limits
    let dailyLimits = {};
    try {
      const userQuery = db.collection('users').where('walletAddress', '==', walletAddress);
      const userSnapshot = await userQuery.get();
      
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        const today = new Date().toISOString().split('T')[0];
        const dailyActions = userData?.dailyActions || {};
        const todayActions = dailyActions[today] || {};
        
                 // Define daily limits for different actions (only for actions that earn points without cost)
         const actionLimits: {[key: string]: number} = {
           like_article: 20,
           alpha_boost: 5,
           submit_alpha: 20,
           report_scam: 10,
           market_analysis: 5,
           token_review: 10,
           create_watchlist: 5,
           receive_comment: 50,
           receive_like: 100,
           receive_share: 25,
           receive_bookmark: 50
         };

        dailyLimits = Object.keys(actionLimits).reduce((acc, action) => {
          acc[action] = {
            current: todayActions[action] || 0,
            limit: actionLimits[action]
          };
          return acc;
        }, {} as {[key: string]: {current: number, limit: number}});
      }
    } catch (error) {
      console.error('Error fetching daily limits:', error);
    }

    return NextResponse.json({
      success: true,
      transactions,
      stats,
      dailyLimits
    });

  } catch (error) {
    console.error('Error fetching user transactions:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: 'An error occurred while fetching transactions'
    }, { status: 500 });
  }
}
