// app/api/honeypot/scan/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Missing token address" }, { status: 400 });
    }

    // Call Honeypot.is without an API key, since the docs say it's not needed
    const honeypotResponse = await fetch(
      `https://api.honeypot.is/v2/IsHoneypot?address=${address}`,
      { method: "GET" }
    );

    if (!honeypotResponse.ok) {
      const errorData = await honeypotResponse.json();
      return NextResponse.json(
        { error: errorData || "Failed to scan contract with Honeypot.is" },
        { status: honeypotResponse.status }
      );
    }

    const data = await honeypotResponse.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error scanning honeypot:", err);
    return NextResponse.json({ error: "Server error scanning token." }, { status: 500 });
  }
}


