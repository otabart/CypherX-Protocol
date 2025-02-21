// app/api/analyst/calls/route.ts
import { NextResponse } from 'next/server';

// In-memory storage for demonstration (use a real database in production)
let calls: any[] = [];

export async function GET() {
  // Return the list of calls
  return NextResponse.json({ calls });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // For simplicity, push the new call into the array
    calls.push(data);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
