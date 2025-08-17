import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint parameter" }, { status: 400 });
    }

    // Validate endpoint to prevent abuse
    if (!endpoint.startsWith('simple/price') && !endpoint.startsWith('coins/')) {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }

    const url = `https://api.coingecko.com/api/v3/${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CypherX/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('CoinGecko proxy error:', error);
    return NextResponse.json(
      { error: "Failed to fetch data from CoinGecko" },
      { status: 500 }
    );
  }
}
