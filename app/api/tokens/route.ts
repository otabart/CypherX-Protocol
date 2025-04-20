import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get("chainId") || "base";
  const tokenAddresses = searchParams.get("tokenAddresses")?.split(",");
  const poolAddress = searchParams.get("poolAddress");
  const fetchChartData = searchParams.get("fetchChartData") === "true";
  const timeframe = searchParams.get("timeframe") || "hour"; // Default to hour

  // Validate parameters
  if (!chainId || (!tokenAddresses && !poolAddress && !fetchChartData)) {
    console.error("Missing required parameters: chainId, tokenAddresses, or poolAddress");
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    // Handle tokenAddresses with DexScreener
    if (tokenAddresses) {
      const baseURL = process.env.NEXT_PUBLIC_DEXSCREENER_API_URL;
      if (!baseURL) {
        console.error("NEXT_PUBLIC_DEXSCREENER_API_URL is not set in environment variables");
        return NextResponse.json(
          { error: "Server misconfiguration: DexScreener API URL not set" },
          { status: 500 }
        );
      }

      // Validate token addresses
      if (!tokenAddresses.every((addr) => /^0x[a-fA-F0-9]{40}$/.test(addr))) {
        console.error("Invalid token addresses provided:", tokenAddresses);
        return NextResponse.json(
          { error: "Invalid token addresses format" },
          { status: 400 }
        );
      }

      const endpoint = `${baseURL}/tokens/v1/${chainId}/${tokenAddresses.join(",")}`;
      console.log("Fetching DexScreener tokens endpoint:", endpoint);

      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) {
        const errorText = await res.text();
        console.error("DexScreener API error:", res.status, errorText);
        return NextResponse.json(
          { error: `DexScreener API error: ${errorText}` },
          { status: res.status }
        );
      }
      const data = await res.json();
      console.log("Raw DexScreener token data:", JSON.stringify(data, null, 2));

      // Validate response structure
      if (!Array.isArray(data)) {
        console.error("Unexpected DexScreener response format:", data);
        return NextResponse.json(
          { error: "Invalid DexScreener response format" },
          { status: 500 }
        );
      }

      return NextResponse.json(data, {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    // Handle poolAddress with GeckoTerminal (for metadata)
    if (poolAddress && !fetchChartData) {
      // Validate pool address
      if (!/^0x[a-fA-F0-9]{40}$/.test(poolAddress)) {
        console.error("Invalid pool address:", poolAddress);
        return NextResponse.json(
          { error: "Invalid pool address format" },
          { status: 400 }
        );
      }

      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/${chainId}/pools/${poolAddress}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const errorText = await res.text();
        console.error("GeckoTerminal API error for pool:", res.status, errorText);
        return NextResponse.json(
          { error: `GeckoTerminal API error: ${errorText}` },
          { status: res.status }
        );
      }
      const poolData = await res.json();
      console.log("Raw GeckoTerminal pool data:", JSON.stringify(poolData, null, 2));

      if (!poolData.data) {
        console.error("No pool data returned for poolAddress:", poolAddress);
        return NextResponse.json(
          { error: "No pool data found for the given address" },
          { status: 404 }
        );
      }

      const pool = poolData.data;
      const tokenData = [
        {
          pairAddress: pool.attributes.address,
          baseToken: {
            name: pool.attributes.base_token_name || "Unknown",
            symbol: pool.attributes.base_token_symbol || "UNK",
          },
          quoteToken: {
            name: pool.attributes.quote_token_name || "WETH",
            symbol: pool.attributes.quote_token_symbol || "WETH",
          },
          priceUsd: pool.attributes.price_usd || "0",
          txns: pool.attributes.transactions || { h1: { buys: 0, sells: 0 }, h6: { buys: 0, sells: 0 }, h24: { buys: 0, sells: 0 } },
          priceChange: pool.attributes.price_change || { h1: 0, h6: 0, h24: 0 },
          volume: pool.attributes.volume || { h24: 0 },
          liquidity: pool.attributes.liquidity || { usd: 0 },
          marketCap: pool.attributes.market_cap || 0,
          fdv: pool.attributes.fdv || 0,
          pairCreatedAt: pool.attributes.created_at || Date.now(),
        },
      ];

      return NextResponse.json(tokenData, {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    // Handle chart data fetching with GeckoTerminal
    if (poolAddress && fetchChartData) {
      // Validate pool address
      if (!/^0x[a-fA-F0-9]{40}$/.test(poolAddress)) {
        console.error("Invalid pool address:", poolAddress);
        return NextResponse.json(
          { error: "Invalid pool address format" },
          { status: 400 }
        );
      }

      const timeframeParam = timeframe === "minute" ? "minute" : timeframe === "day" ? "day" : "hour";
      const aggregate = timeframe === "minute" ? "5" : "1"; // 5-minute candles for minute timeframe, 1-hour/day for others
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/${chainId}/pools/${poolAddress}/ohlcv/${timeframeParam}?aggregate=${aggregate}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const errorText = await res.text();
        console.error("GeckoTerminal API error for chart data:", res.status, errorText);
        return NextResponse.json(
          { error: `GeckoTerminal API error: ${errorText}` },
          { status: res.status }
        );
      }
      const data = await res.json();
      console.log("GeckoTerminal chart data:", JSON.stringify(data, null, 2));

      if (!data.data || !data.data.attributes || !data.data.attributes.ohlcv_list) {
        console.error("No chart data returned for poolAddress:", poolAddress);
        return NextResponse.json(
          { error: "No chart data found for the given address" },
          { status: 404 }
        );
      }

      return NextResponse.json(data, {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    console.error("No valid parameters provided for tokens API");
    return NextResponse.json({ error: "No valid parameters provided" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in tokens API route:", error.message, error.stack);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}