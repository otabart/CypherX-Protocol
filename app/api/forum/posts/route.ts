import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Post from '@/lib/db/models/Post';

// ✅ Fetch all posts
export async function GET() {
  await connectToDatabase();
  const posts = await Post.find({}).sort({ createdAt: -1 });
  return NextResponse.json(posts);
}

// ✅ Create a new post
export async function POST(req: Request) {
  const { title, content, author, category } = await req.json();
  if (!title || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  await connectToDatabase();
  const newPost = await Post.create({ title, content, author, category });

  return NextResponse.json(newPost, { status: 201 });
}
