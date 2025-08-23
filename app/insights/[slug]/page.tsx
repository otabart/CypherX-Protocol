// app/base-chain-news/[slug]/page.tsx
import { notFound } from 'next/navigation';
import React from 'react';
import { adminDb } from '@/lib/firebase-admin';
import ArticleDetail from './ArticleDetail';

interface ServerProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticleDetailPage({ params }: ServerProps) {
  const { slug } = await params;

  // ─── Fetch the single article from Firestore on the server ───
  const db = adminDb();
  if (!db) {
    notFound();
  }

  const articlesCol = db!.collection('articles');
  const q = articlesCol.where('slug', '==', slug);
  const querySnapshot = await q.get();

  if (querySnapshot.empty) {
    // If no matching article, render 404
    notFound();
  }

  // Take the first matching document
  const docSnap = querySnapshot.docs[0];
  const data = docSnap.data();

  // Transform Firestore timestamps into ISO strings (if needed)
  const publishedAtISO =
    data.publishedAt?.toDate?.()?.toISOString() || new Date().toISOString();

  // Fetch author information to get alias
  let authorAlias = data.author as string; // Default to author ID
  let authorData = null;
  
  if (data.author) {
    try {
      console.log('🔍 Looking up author:', data.author);
      
      // First try to find in authors collection by walletAddress
      const authorsQuery = db.collection('authors').where('walletAddress', '==', data.author);
      const authorsSnapshot = await authorsQuery.get();
      
      if (!authorsSnapshot.empty) {
        authorData = authorsSnapshot.docs[0].data();
        authorAlias = authorData.alias || authorData.twitterHandle || data.author;
        console.log('✅ Found author in authors collection:', authorAlias);
      } else {
        // If not in authors, try users collection by walletAddress
        const usersQuery = db.collection('users').where('walletAddress', '==', data.author);
        const usersSnapshot = await usersQuery.get();
        
        if (!usersSnapshot.empty) {
          authorData = usersSnapshot.docs[0].data();
          authorAlias = authorData.alias || authorData.twitterHandle || data.author;
          console.log('✅ Found author in users collection:', authorAlias);
        } else {
          // Try to find by email if author looks like an email
          if (data.author.includes('@')) {
            const emailQuery = db.collection('users').where('email', '==', data.author);
            const emailSnapshot = await emailQuery.get();
            
            if (!emailSnapshot.empty) {
              authorData = emailSnapshot.docs[0].data();
              authorAlias = authorData.alias || authorData.twitterHandle || authorData.displayName || data.author;
              console.log('✅ Found author by email:', authorAlias);
            }
          }
          
          // If still not found, try by UID
          if (authorAlias === data.author) {
            try {
              const userDoc = await db.collection('users').doc(data.author).get();
              if (userDoc.exists) {
                authorData = userDoc.data();
                authorAlias = authorData?.alias || authorData?.twitterHandle || authorData?.displayName || data.author;
                console.log('✅ Found author by UID:', authorAlias);
              }
            } catch (uidError) {
              console.log('❌ Author not found by UID:', data.author);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching author data:', error);
      // Keep default author ID if fetch fails
    }
  }

  // Build a plain JS object to pass down to the client component
  const articleData = {
    id: docSnap.id,
    title: data.title as string,
    content: data.content as string,
    author: data.author as string, // Keep original author ID for backend operations
    authorAlias: authorAlias, // Add author alias for display
    source: data.source as string,
    slug: data.slug as string,
    thumbnailUrl: (data.thumbnailUrl as string | undefined) || '',
    publishedAt: publishedAtISO,
    views: data.views || 0,
    upvotes: data.upvotes || 0,
    downvotes: data.downvotes || 0,
    comments: data.comments || [],
    category: data.category || 'General',
    excerpt: data.excerpt || '',
  };

  // ─── Return the Client component, passing the article’s fields as props ───
  return <ArticleDetail article={articleData} />;
}







