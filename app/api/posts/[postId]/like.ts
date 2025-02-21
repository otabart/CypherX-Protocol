// pages/api/posts/[postId]/like.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDB } from '../../../../lib/db/connect';
import Post from '../../../../lib/db/models/Post';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { postId } = req.query;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectToDB();
    // userId would come from auth in a real app
    const { userId } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Toggle like
    const alreadyLiked = post.likes.includes(userId);
    if (alreadyLiked) {
      post.likes = post.likes.filter((id: any) => id.toString() !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();
    return res.status(200).json({ success: true, likes: post.likes.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
