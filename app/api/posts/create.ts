// pages/api/posts/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDB } from '../../../lib/db/connect';
import Post from '../../../lib/db/models/Post';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectToDB();
    // In a real app, you'd extract user ID from auth token/session
    const { authorId, content, image } = req.body;

    const post = await Post.create({ author: authorId, content, image });
    return res.status(201).json({ success: true, post });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
