// app/api/articles/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/firebase';                  // adjust to your import path
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import slugify from 'slugify';

interface ArticleData {
  title: string;
  content: string;
  author: string;
  source: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ArticleData;
    const { title, content, author, source } = body;

    if (!title || !content || !author || !source) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let baseSlug = slugify(title, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug in "articles" collection
    while (true) {
      const q = query(
        collection(db, 'articles'),
        where('slug', '==', slug)
      );
      const qsnap = await getDocs(q);
      if (qsnap.empty) break;
      slug = `${baseSlug}-${counter++}`;
    }

    const docRef = await addDoc(collection(db, 'articles'), {
      title,
      content,
      author,
      source,
      publishedAt: serverTimestamp(),
      slug,
    });

    return NextResponse.json({ id: docRef.id, slug });
  } catch (error) {
    console.error('Error saving article:', error);
    return NextResponse.json({ error: 'Error saving article' }, { status: 500 });
  }
}
