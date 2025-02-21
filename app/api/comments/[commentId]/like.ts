// pages/api/comments/[commentId]/like.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDB } from '../../../../lib/db/connect';
import Comment from '../../../../lib/db/models/Comment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { commentId } = req.query;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectToDB();
    const { userId } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Toggle like
    const alreadyLiked = comment.likes.includes(userId);
    if (alreadyLiked) {
      comment.likes = comment.likes.filter((id: any) => id.toString() !== userId);
    } else {
      comment.likes.push(userId);
    }

    await comment.save();
    return res.status(200).json({ success: true, likes: comment.likes.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
