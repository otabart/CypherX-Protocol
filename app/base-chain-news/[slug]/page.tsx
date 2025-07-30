// app/base-chain-news/[slug]/page.tsx
import { notFound } from 'next/navigation';
import React from 'react';
import { db } from '../../../lib/firebase'; // adjust path as needed
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import ArticleDetail from './ArticleDetail';

interface ServerProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticleDetailPage({ params }: ServerProps) {
  const { slug } = await params;

  // ─── Fetch the single article from Firestore on the server ───
  const articlesCol = collection(db, 'articles');
  const q = query(articlesCol, where('slug', '==', slug));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    // If no matching article, render 404
    notFound();
  }

  // Take the first matching document
  const docSnap = querySnapshot.docs[0];
  const data = docSnap.data() as DocumentData;

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
  };

  // ─── Return the Client component, passing the article’s fields as props ───
  return <ArticleDetail article={articleData} />;
}







