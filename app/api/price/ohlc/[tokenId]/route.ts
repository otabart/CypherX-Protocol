import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { tokenId: string } }
) {
  try {
    const { tokenId } = params;
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '1';
    const vsCurrency = searchParams.get('vs_currency') || 'usd';

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${tokenId}/ohlc?vs_currency=${vsCurrency}&days=${days}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CypherX/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    if (response.status === 429) {
      // Rate limited - return empty data
      console.log('CoinGecko rate limited for OHLC, returning empty data');
      return NextResponse.json([]);
    }

    if (!response.ok) {
      throw new Error(`CoinGecko API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching OHLC data:', error);
    
    // Return empty data instead of error
    return NextResponse.json([]);
  }
}
