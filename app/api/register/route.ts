import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/lib/db/models/User';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    // ✅ Ensure JSON parsing doesn't break
    let data;
    try {
      data = await req.json();
    } catch (err) {
      console.error("🚨 Invalid JSON received:", err);
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }

    const { username, email, password } = data;

    console.log("Received Data:", { username, email, password });

    if (!username || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    await connectToDatabase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, email, password: hashedPassword });

    console.log("✅ New user created:", newUser);
    return NextResponse.json({ message: 'Account created successfully' }, { status: 201 });

  } catch (error) {
    console.error("🚨 Error in register route:", error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
