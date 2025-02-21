// app/api/tokens/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Parse query parameters for chainId and tokenAddresses.
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get("chainId") || "base";
    const tokenAddresses = searchParams.get("tokenAddresses");
    if (!tokenAddresses) {
      return NextResponse.json(
        { error: "Missing tokenAddresses parameter" },
        { status: 400 }
      );
    }

    // Use the DexScreener base URL from environment variables.
    const baseURL = process.env.NEXT_PUBLIC_DEXSCREENER_API_URL;
    if (!baseURL) {
      console.error("NEXT_PUBLIC_DEXSCREENER_API_URL is not set.");
      return NextResponse.json(
        { error: "Server misconfiguration: Dexscreener API URL not set" },
        { status: 500 }
      );
    }

    // Construct the full endpoint URL.
    const endpoint = `${baseURL}/tokens/v1/${chainId}/${tokenAddresses}`;
    console.log("Fetching DexScreener tokens endpoint:", endpoint);

    const res = await fetch(endpoint);
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Dexscreener API error:", errorText);
      return NextResponse.json(
        { error: `Dexscreener API error: ${errorText}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    console.log("Raw DexScreener token data:", data);

    // Return the raw data.
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error in Dexscreener tokens API route:", error.message);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}

