// app/api/marketcap/route.ts
import { NextResponse } from 'next/server';

// This dummy endpoint returns static market cap data.
// In a real application, you would integrate with a market data API.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tokenAddress = searchParams.get('address');

  // For demonstration, if tokenAddress is provided, return dummy data:
  if (tokenAddress) {
    return NextResponse.json({
      marketCap: 123456789, // Replace with real logic/fetch from an external API
    });
  }

  return NextResponse.json({ error: 'Token address missing' }, { status: 400 });
}
