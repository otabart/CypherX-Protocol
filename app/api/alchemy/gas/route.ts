import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(process.env.NEXT_PUBLIC_ALCHEMY_API_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }),
  });
  const data = await res.json();
  return NextResponse.json(data);
}