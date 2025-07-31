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

  // Build a plain JS object to pass down to the client component
  const articleData = {
    id: docSnap.id,
    title: data.title as string,
    content: data.content as string,
    author: data.author as string,
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







