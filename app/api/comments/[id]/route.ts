// app/api/comments/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

interface ReactionPayload {
  userId: string;
  walletAddress: string;
  action: 'like' | 'dislike';
  articleSlug: string;
  commentId: string;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const commentId = params.id;
  try {
    const body: ReactionPayload = await req.json();
    const { userId, walletAddress, action } = body;
    if (!userId || !walletAddress || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const commentRef = doc(db, 'comments', commentId);
    const commentSnap = await getDoc(commentRef);
    if (!commentSnap.exists()) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const data = commentSnap.data() as any;
    let updatedLikes: string[] = data.likes || [];
    let updatedDislikes: string[] = data.dislikes || [];

    if (action === 'like') {
      if (updatedLikes.includes(walletAddress)) {
        updatedLikes = updatedLikes.filter((addr: string) => addr !== walletAddress);
      } else {
        updatedLikes.push(walletAddress);
        updatedDislikes = updatedDislikes.filter((addr: string) => addr !== walletAddress);
      }
    } else {
      if (updatedDislikes.includes(walletAddress)) {
        updatedDislikes = updatedDislikes.filter((addr: string) => addr !== walletAddress);
      } else {
        updatedDislikes.push(walletAddress);
        updatedLikes = updatedLikes.filter((addr: string) => addr !== walletAddress);
      }
    }

    await updateDoc(commentRef, {
      likes: updatedLikes,
      dislikes: updatedDislikes,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`POST /api/comments/${commentId}/react error:`, err);
    return NextResponse.json({ error: 'Error reacting to comment' }, { status: 500 });
  }
}
