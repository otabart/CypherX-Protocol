// File: app/api/coins/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch the top 100 coins from CoinGecko (include price change percentages)
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h,6h,24h'
    );
    const coins = await res.json();

    // Filter coins for Base chain tokens.
    // (This example assumes that coins on Base have a "platforms" object with a non-empty "base" property.)
    const baseChainCoins = coins.filter((coin: any) => {
      return coin.platform && coin.platform.base && coin.platform.base.trim() !== "";
    });

    return NextResponse.json(baseChainCoins, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching coin data:', error);
    return NextResponse.json({ error: 'Failed to fetch coin data' }, { status: 500 });
  }
}

