// app/api/comments/[id]/route.ts

import { NextResponse } from 'next/server';
import type { DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

interface ReactionPayload {
  userId: string;
  walletAddress: string;
  action: 'like' | 'dislike';
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commentId } = await params;
  try {
    const { userId, walletAddress, action }: ReactionPayload = await _req.json();
    if (!userId || !walletAddress || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const commentRef = doc(db, 'comments', commentId);
    const commentSnap = await getDoc(commentRef);
    if (!commentSnap.exists()) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const data = commentSnap.data() as DocumentData;
    let updatedLikes: string[] = Array.isArray(data.likes) ? (data.likes as string[]) : [];
    let updatedDislikes: string[] = Array.isArray(data.dislikes) ? (data.dislikes as string[]) : [];

    if (action === 'like') {
      if (updatedLikes.includes(walletAddress)) {
        updatedLikes = updatedLikes.filter(addr => addr !== walletAddress);
      } else {
        updatedLikes.push(walletAddress);
        updatedDislikes = updatedDislikes.filter(addr => addr !== walletAddress);
      }
    } else {
      if (updatedDislikes.includes(walletAddress)) {
        updatedDislikes = updatedDislikes.filter(addr => addr !== walletAddress);
      } else {
        updatedDislikes.push(walletAddress);
        updatedLikes = updatedLikes.filter(addr => addr !== walletAddress);
      }
    }

    await updateDoc(commentRef, { likes: updatedLikes, dislikes: updatedDislikes });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`POST /api/comments/${commentId}/react error:`, err);
    return NextResponse.json({ error: 'Error reacting to comment' }, { status: 500 });
  }
}

