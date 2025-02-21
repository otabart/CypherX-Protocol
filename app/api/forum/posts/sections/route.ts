import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Section from '@/lib/db/models/Section';

export async function GET() {
  await connectToDatabase();
  const sections = await Section.find({});
  return NextResponse.json(sections);
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'Missing section name' }, { status: 400 });

  await connectToDatabase();
  const newSection = await Section.create({ name });

  return NextResponse.json(newSection, { status: 201 });
}
