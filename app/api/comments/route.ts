// app/api/comments/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

interface CommentPayload {
  articleSlug: string;
  userId: string;
  content: string;
  parentId: string | null;
}

interface ReactionPayload {
  userId: string;
  walletAddress: string;
  action: 'like' | 'dislike';
  articleSlug: string;
  commentId: string;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const articleSlug = url.searchParams.get('articleSlug');
    if (!articleSlug) {
      return NextResponse.json({ error: 'Missing articleSlug' }, { status: 400 });
    }
    const commentsCol = collection(db, 'comments');
    const q = query(
      commentsCol,
      where('articleSlug', '==', articleSlug),
      where('parentId', '==', null),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    const out: any[] = [];
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as any;
      const commentId = docSnap.id;
      // fetch replies
      const repliesQ = query(
        commentsCol,
        where('parentId', '==', commentId),
        orderBy('createdAt', 'asc')
      );
      const repliesSnap = await getDocs(repliesQ);
      const replies: any[] = repliesSnap.docs.map((r) => {
        const rd = r.data() as any;
        return {
          id: r.id,
          userId: rd.userId,
          username: rd.username || 'Anonymous',
          content: rd.content,
          createdAt: rd.createdAt?.toDate().toLocaleString() || new Date().toLocaleString(),
          likes: rd.likes || [],
          dislikes: rd.dislikes || [],
          replies: [],
        };
      });

      out.push({
        id: commentId,
        userId: data.userId,
        username: data.username || 'Anonymous',
        content: data.content,
        createdAt: data.createdAt?.toDate().toLocaleString() || new Date().toLocaleString(),
        likes: data.likes || [],
        dislikes: data.dislikes || [],
        replies,
      });
    }

    return NextResponse.json(out);
  } catch (err) {
    console.error('GET /api/comments error:', err);
    return NextResponse.json({ error: 'Error fetching comments' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: CommentPayload = await req.json();
    const { articleSlug, userId, content, parentId } = body;
    if (!articleSlug || !userId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create username stub (you can look up real username from “users” collection if you want)
    const username = `User ${userId.substring(0, 6)}`;

    const docRef = await addDoc(collection(db, 'comments'), {
      articleSlug,
      userId,
      username,
      content,
      createdAt: serverTimestamp(),
      likes: [],
      dislikes: [],
      parentId: parentId || null,
    });

    console.log(`Created comment ${docRef.id} for article ${articleSlug}`);
    return NextResponse.json({ id: docRef.id });
  } catch (err) {
    console.error('POST /api/comments error:', err);
    return NextResponse.json({ error: 'Error posting comment' }, { status: 500 });
  }
}
