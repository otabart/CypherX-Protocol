// app/api/articles/[slug]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/firebase';                  // adjust to your import path
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params;
  try {
    console.log('API requested slug:', slug);
    const articlesCol = collection(db, 'articles');
    const q = query(articlesCol, where('slug', '==', slug));
    const snap = await getDocs(q);

    if (snap.empty) {
      console.warn('No article found for slug:', slug);
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data();

    // Convert Firestore Timestamp → ISO string if necessary
    if (data.publishedAt?.toDate) {
      data.publishedAt = data.publishedAt.toDate().toISOString();
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching article:', err);
    return NextResponse.json({ error: 'Error fetching article' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({ message: 'Not implemented' }, { status: 501 });
}
