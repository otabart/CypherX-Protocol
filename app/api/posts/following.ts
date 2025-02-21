// pages/api/posts/following.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDB } from '../../../lib/db/connect';
import User from '../../../lib/db/models/User';
import Post from '../../../lib/db/models/Post';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectToDB();
    // get currentUserId from token/session
    const { currentUserId } = req.query;
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    // get all posts where author is in currentUser.following
    const posts = await Post.find({ author: { $in: currentUser.following } })
      .populate('author', 'username profileImage')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, posts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
