// app/api/pairs/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Parse query parameters: chainId (optional) and pairId (required)
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get("chainId") || "base";
  const pairId = searchParams.get("pairId");
  
  if (!pairId) {
    return NextResponse.json({ error: "Missing pairId" }, { status: 400 });
  }
  
  // Read the base DexScreener API URL from environment variables.
  const baseURL = process.env.NEXT_PUBLIC_DEXSCREENER_API_URL;
  if (!baseURL) {
    console.error("Environment variable NEXT_PUBLIC_DEXSCREENER_API_URL is not set.");
    return NextResponse.json(
      { error: "Server misconfiguration: Dexscreener API URL not set" },
      { status: 500 }
    );
  }
  
  // Construct the endpoint URL for the specific pair.
  const endpoint = `${baseURL}/pairs/${chainId}/${pairId}`;
  console.log("Fetching DexScreener pair endpoint:", endpoint);
  
  try {
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
    console.log("Raw DexScreener pair data:", data);
    
    // Optionally, normalize or transform the data here if needed.
    return NextResponse.json(data, { status: 200 });
    
  } catch (error: any) {
    console.error("Error in Dexscreener pair API route:", error.message);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}







