import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get current month for monthly stats
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch author's articles
    const articlesQuery = db.collection('articles')
      .where('authorWalletAddress', '==', walletAddress)
      .orderBy('publishedAt', 'desc');

    const articlesSnapshot = await articlesQuery.get();
    const articles = articlesSnapshot.docs.map(doc => doc.data());

    // Calculate stats
    let totalPosts = articles.length;
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalEarnings = 0;
    let monthlyViews = 0;
    let monthlyLikes = 0;
    let monthlyComments = 0;
    let monthlyEarnings = 0;

    articles.forEach(article => {
      const views = article.views || 0;
      const likes = article.upvotes || 0;
      const comments = article.comments?.length || 0;
      const earnings = article.authorEarnings || 0;

      totalViews += views;
      totalLikes += likes;
      totalComments += comments;
      totalEarnings += earnings;

      // Check if article was published this month
      const publishedAt = article.publishedAt?.toDate?.() || new Date(article.publishedAt);
      if (publishedAt >= currentMonth) {
        monthlyViews += views;
        monthlyLikes += likes;
        monthlyComments += comments;
        monthlyEarnings += earnings;
      }
    });

    return NextResponse.json({
      totalPosts,
      totalViews,
      totalLikes,
      totalComments,
      totalEarnings,
      monthlyViews,
      monthlyLikes,
      monthlyComments,
      monthlyEarnings
    });

  } catch (error) {
    console.error('Error fetching author stats:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: 'An error occurred while fetching author stats'
    }, { status: 500 });
  }
}
