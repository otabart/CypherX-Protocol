// app/api/users/register/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import User from '../../../../lib/db/models/User';
import { connectToDB } from '../../../../lib/db/connect';

export async function POST(req: Request) {
  try {
    await connectToDB();
    const { username, email, password } = await req.json();

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return NextResponse.json({ error: 'Username or Email already in use' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, email, passwordHash });

    return NextResponse.json({ success: true, userId: newUser._id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
