// app/api/news/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import slugify from 'slugify';

interface NewsArticle {
  title: string;
  content: string;
  author: string;
  source: string;
  thumbnailUrl?: string;
  publishedAt: string; // ISO string
  slug: string;
}

interface NewArticlePayload {
  title: string;
  content: string;
  author: string;
  source: string;
  thumbnailUrl?: string;
}

export async function GET(req: Request) {
  try {
    const articlesCol = collection(db, 'articles');
    // sort by publishedAt descending
    const q = query(articlesCol, orderBy('publishedAt', 'desc'));
    const snapshot = await getDocs(q);

    const articles: NewsArticle[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as any;
      articles.push({
        title: data.title || 'Untitled',
        content: data.content || '',
        author: data.author || 'Unknown',
        source: data.source || 'Unknown',
        thumbnailUrl: data.thumbnailUrl || '',
        publishedAt: data.publishedAt?.toDate
          ? data.publishedAt.toDate().toISOString()
          : new Date().toISOString(),
        slug: data.slug || doc.id,
      });
    });

    return NextResponse.json(articles);
  } catch (err) {
    console.error('GET /api/news error:', err);
    return NextResponse.json(
      { error: 'Error fetching articles' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body: NewArticlePayload = await req.json();
    const { title, content, author, source, thumbnailUrl } = body;

    if (!title || !content || !author || !source) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1) generate base slug
    let baseSlug = slugify(title, { lower: true, strict: true });
    let slug = baseSlug;
    let suffix = 1;
    let slugExists = true;

    // 2) ensure uniqueness
    while (slugExists) {
      const slugQuery = query(
        collection(db, 'articles'),
        orderBy('publishedAt', 'desc') // orderBy doesn't matter here, but Firestore requires at least one index field
      );
      // We’ll do a simple “where slug == slug” via getDocs for uniqueness:
      const all = await getDocs(collection(db, 'articles'));
      slugExists = all.docs.some((d) => (d.data() as any).slug === slug);
      if (slugExists) {
        slug = `${baseSlug}-${suffix}`;
        suffix++;
      }
    }

    // 3) add to 'articles'
    const docRef = await addDoc(collection(db, 'articles'), {
      title,
      content,
      author,
      source,
      thumbnailUrl: thumbnailUrl || '',
      publishedAt: serverTimestamp(),
      slug,
    });

    // 4) ALSO add a “notification” for the terminal feed
    await addDoc(collection(db, 'notifications'), {
      type: 'new_article',
      slug,
      title,
      timestamp: serverTimestamp(),
    });

    console.log(`Created article (ID=${docRef.id}, slug=${slug})`);
    return NextResponse.json({ id: docRef.id, slug });
  } catch (err) {
    console.error('POST /api/news error:', err);
    return NextResponse.json(
      { error: 'Error creating article' },
      { status: 500 }
    );
  }
}

