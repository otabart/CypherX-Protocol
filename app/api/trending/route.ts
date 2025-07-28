
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get('chainId') ?? 'base';
  const pairId = searchParams.get('pairId');

  if (!pairId) {
    return NextResponse.json(
      { error: 'Missing pairId' },
      { status: 400 }
    );
  }

  const baseURL = process.env.NEXT_PUBLIC_DEXSCREENER_API_URL;
  if (typeof baseURL !== 'string' || !baseURL) {
    console.error('Environment variable NEXT_PUBLIC_DEXSCREENER_API_URL is not set.');
    return NextResponse.json(
      { error: 'Server misconfiguration: Dexscreener API URL not set' },
      { status: 500 }
    );
  }

  const endpoint = `${baseURL}/pairs/${chainId}/${pairId}`;
  console.log('Fetching DexScreener pair endpoint:', endpoint);

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Dexscreener API error:', errorText);
      return NextResponse.json(
        { error: `Dexscreener API error: ${errorText}` },
        { status: response.status }
      );
    }

    const data: unknown = await response.json();
    console.log('Raw DexScreener pair data:', data);

    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error in DexScreener pair API route:', message);
    return NextResponse.json(
      { error: 'Server error', details: message },
      { status: 500 }
    );
  }
}








