// pages/api/news/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/firebase';  // adjust if your lib path is different
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import slugify from 'slugify';

interface NewsArticle {
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;   // returned as ISO string
  slug: string;
  thumbnailUrl?: string;
}

interface ArticleData {
  title: string;
  content: string;
  author: string;
  source: string;
  thumbnailUrl?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // ‣ POST /api/news  → create new article
  if (req.method === 'POST') {
    const { title, content, author, source, thumbnailUrl }: ArticleData = req.body;
    if (!title || !content || !author || !source) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      // 1) generate a base slug
      let baseSlug = slugify(title, { lower: true, strict: true });
      let slug = baseSlug;
      let slugExists = true;
      let counter = 1;

      // 2) loop until we find a slug that doesn’t exist
      while (slugExists) {
        const slugQuery = query(
          collection(db, 'articles'),
          where('slug', '==', slug)
        );
        const snapshot = await getDocs(slugQuery);
        if (snapshot.empty) {
          slugExists = false;
        } else {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      }

      // 3) now actually write the document
      const docRef = await addDoc(collection(db, 'articles'), {
        title,
        content,
        author,
        source,
        thumbnailUrl: thumbnailUrl || null,
        publishedAt: serverTimestamp(),
        slug,
      });

      console.log('Saved article with slug:', slug);
      return res.status(200).json({ id: docRef.id, slug });
    } catch (error) {
      console.error('Error saving article:', error);
      return res.status(500).json({ error: 'Error saving article' });
    }
  }

  // ‣ GET /api/news  → return all articles in descending order
  else if (req.method === 'GET') {
    try {
      const articlesCol = collection(db, 'articles');
      // orderBy publishedAt (most recent first)
      const q = query(articlesCol, orderBy('publishedAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const articles: NewsArticle[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        articles.push({
          title: data.title || 'Untitled',
          content: data.content || '',
          author: data.author || 'Unknown',
          source: data.source || 'Unknown',
          publishedAt: data.publishedAt?.toDate
            ? data.publishedAt.toDate().toISOString()
            : new Date().toISOString(),
          slug: data.slug || doc.id,
          thumbnailUrl: data.thumbnailUrl || undefined,
        });
      });

      console.log('Returning', articles.length, 'articles');
      return res.status(200).json(articles);
    } catch (error) {
      console.error('Error fetching articles:', error);
      return res.status(500).json({ error: 'Error fetching articles' });
    }
  }

  // anything else: 405
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
