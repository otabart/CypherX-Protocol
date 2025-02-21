import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenAddress = searchParams.get("address");
  if (!tokenAddress) {
    return NextResponse.json({ error: "Missing token address" }, { status: 400 });
  }

  try {
    // Use the public variable as defined in .env.local
    const HONEYPOT_API_URL = process.env.NEXT_PUBLIC_HONEYPOT_API_URL;
    if (!HONEYPOT_API_URL) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Construct the external API URL using the token address
    const apiUrl = `${HONEYPOT_API_URL}?token=${tokenAddress}`;
    console.log("Calling Honeypot API:", apiUrl);

    // Call the external Honeypot API (no API key needed)
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ error: `Honeypot API error: ${errorData}` }, { status: response.status });
    }

    const data = await response.json();

    // Normalize the API response if needed.
    const result = {
      simulationSuccess: true,
      token: tokenAddress,
      honeypotResult: {
        isHoneypot: data.isHoneypot,
        buyTax: data.buyTax || 0,
        sellTax: data.sellTax || 0,
        liquidity: data.liquidity || "Unknown",
        isBlacklisted: data.isBlacklisted || false,
      }
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Error calling Honeypot API:", error);
    return NextResponse.json({ error: "Server error", details: error.message }, { status: 500 });
  }
}







