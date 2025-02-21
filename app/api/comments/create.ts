// pages/api/comments/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDB } from '../../../lib/db/connect';
import Comment from '../../../lib/db/models/Comment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectToDB();
    // userId from auth
    const { authorId, postId, parentCommentId, content } = req.body;

    const newComment = await Comment.create({
      author: authorId,
      postId,
      parentCommentId: parentCommentId || null,
      content,
    });
    return res.status(201).json({ success: true, comment: newComment });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
