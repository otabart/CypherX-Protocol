import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'totalViews';
    const timeframe = searchParams.get('timeframe') || 'all';

    const db = adminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get current month for monthly stats
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all approved authors
    const usersQuery = db.collection('users').where('isAuthor', '==', true);
    const usersSnapshot = await usersQuery.get();
    
    const authors = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const walletAddress = userData.walletAddress;

      // Fetch author's articles
      const articlesQuery = db.collection('articles')
        .where('authorWalletAddress', '==', walletAddress);
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

      // Calculate engagement rate (likes + comments / views * 100)
      const engagementRate = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

      authors.push({
        id: userDoc.id,
        walletAddress,
        twitterHandle: userData.twitterHandle,
        alias: userData.alias,
        bio: userData.bio,
        totalPosts,
        totalViews,
        totalLikes,
        totalComments,
        totalEarnings,
        monthlyViews,
        monthlyLikes,
        monthlyComments,
        monthlyEarnings,
        engagementRate: Math.round(engagementRate * 100) / 100 // Round to 2 decimal places
      });
    }

    // Sort authors based on criteria
    const sortedAuthors = authors.sort((a, b) => {
      let aValue, bValue;

      if (timeframe === 'monthly') {
        switch (sortBy) {
          case 'totalViews':
            aValue = a.monthlyViews;
            bValue = b.monthlyViews;
            break;
          case 'totalEarnings':
            aValue = a.monthlyEarnings;
            bValue = b.monthlyEarnings;
            break;
          case 'totalPosts':
            aValue = a.totalPosts;
            bValue = b.totalPosts;
            break;
          case 'engagementRate':
            aValue = a.engagementRate;
            bValue = b.engagementRate;
            break;
          default:
            aValue = a.monthlyViews;
            bValue = b.monthlyViews;
        }
      } else {
        switch (sortBy) {
          case 'totalViews':
            aValue = a.totalViews;
            bValue = b.totalViews;
            break;
          case 'totalEarnings':
            aValue = a.totalEarnings;
            bValue = b.totalEarnings;
            break;
          case 'totalPosts':
            aValue = a.totalPosts;
            bValue = b.totalPosts;
            break;
          case 'engagementRate':
            aValue = a.engagementRate;
            bValue = b.engagementRate;
            break;
          default:
            aValue = a.totalViews;
            bValue = b.totalViews;
        }
      }

      return bValue - aValue;
    });

    return NextResponse.json({
      authors: sortedAuthors,
      totalAuthors: sortedAuthors.length
    });

  } catch (error) {
    console.error('Error fetching author leaderboard:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: 'An error occurred while fetching the leaderboard'
    }, { status: 500 });
  }
}
