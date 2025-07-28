// app/api/comments/route.ts

import { NextResponse } from 'next/server';
import type { DocumentData } from 'firebase/firestore';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CommentPayload {
  articleSlug: string;
  userId: string;
  content: string;
  parentId?: string | null;
}

interface CommentResponse {
  id: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  likes: string[];
  dislikes: string[];
  replies: CommentResponse[];
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

    const out: CommentResponse[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as DocumentData;
      const commentId = docSnap.id;

      // Fetch replies
      const repliesQ = query(
        commentsCol,
        where('parentId', '==', commentId),
        orderBy('createdAt', 'asc')
      );
      const repliesSnap = await getDocs(repliesQ);

      const replies: CommentResponse[] = repliesSnap.docs.map((r) => {
        const rd = r.data() as DocumentData;
        return {
          id: r.id,
          userId: String(rd.userId),
          username: (rd.username as string) || 'Anonymous',
          content: String(rd.content),
          createdAt:
            typeof rd.createdAt?.toDate === 'function'
              ? rd.createdAt.toDate().toLocaleString()
              : new Date().toLocaleString(),
          likes: Array.isArray(rd.likes) ? (rd.likes as string[]) : [],
          dislikes: Array.isArray(rd.dislikes) ? (rd.dislikes as string[]) : [],
          replies: [],
        };
      });

      out.push({
        id: commentId,
        userId: String(data.userId),
        username: (data.username as string) || 'Anonymous',
        content: String(data.content),
        createdAt:
          typeof data.createdAt?.toDate === 'function'
            ? data.createdAt.toDate().toLocaleString()
            : new Date().toLocaleString(),
        likes: Array.isArray(data.likes) ? (data.likes as string[]) : [],
        dislikes: Array.isArray(data.dislikes) ? (data.dislikes as string[]) : [],
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

