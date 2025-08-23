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

    // Fetch author's articles
    const articlesQuery = db.collection('articles')
      .where('authorWalletAddress', '==', walletAddress)
      .orderBy('publishedAt', 'desc');

    const articlesSnapshot = await articlesQuery.get();
    
    const posts = articlesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        slug: data.slug,
        status: data.status || 'published',
        views: data.views || 0,
        likes: data.upvotes || 0,
        comments: data.comments?.length || 0,
        earnings: data.authorEarnings || 0,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || data.publishedAt
      };
    });

    return NextResponse.json({
      posts,
      totalPosts: posts.length
    });

  } catch (error) {
    console.error('Error fetching author posts:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: 'An error occurred while fetching author posts'
    }, { status: 500 });
  }
}
