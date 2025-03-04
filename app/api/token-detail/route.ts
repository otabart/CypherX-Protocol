// app/api/token-detail/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenId = searchParams.get("tokenId");

  if (!tokenId) {
    return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_COINGECKO_API_URL;
  const endpoint = `${apiUrl}/coins/${tokenId}/ohlc?vs_currency=usd&days=1`;

  const res = await fetch(endpoint);
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch from CoinGecko" }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
