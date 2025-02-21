// pages/api/posts/for-you.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDB } from '../../../lib/db/connect';
import Post from '../../../lib/db/models/Post';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectToDB();
    // Very basic "For You" feed: get all posts or top by likes
    const posts = await Post.find({})
      .populate('author', 'username profileImage')
      .sort({ createdAt: -1 }); // or sort by likes, etc.

    return res.status(200).json({ success: true, posts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
