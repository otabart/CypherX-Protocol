import { NextResponse } from "next/server";

const COVALENT_API_KEY = process.env.NEXT_PUBLIC_COVALENT_API_KEY || "";

// Base mainnet chain_id is 8453 for Covalent
export async function GET() {
  try {
    if (!COVALENT_API_KEY) {
      throw new Error(
        "Covalent API key not found. Set NEXT_PUBLIC_COVALENT_API_KEY in .env."
      );
    }

    // Hardcode the known busy address for bridging USDC on Base:
    const tokenAddress = "0xd9DA887923cDc508Ea8E5B7047ec61BD1b16eF49";

    // Covalent URL for "transactions_v2" on chain 8453
    const url = `https://api.covalenthq.com/v1/8453/address/${tokenAddress}/transactions_v2/?quote-currency=USD&format=JSON&key=${COVALENT_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.warn("Covalent fetch error text:", text);
      throw new Error(`Failed to fetch from Covalent. status=${res.status}`);
    }

    const json = await res.json();
    if (!json?.data?.items) {
      // Return empty array if nothing found
      return NextResponse.json([], { status: 200 });
    }

    // Minimal array of "Transaction" objects.
    // Note: Real "Buy/Sell" or token amounts require parsing log_events.
    // For demonstration, we'll just put "N/A" in certain fields.
    const allTxs = json.data.items.map((item: any) => ({
      id: item.tx_hash,
      wallet: item.from_address,
      token: "USDC",    // Hard-coded example
      amount: 0,        // Not parsing logs
      value: item.value_quote || 0,
      type: "N/A",      // Not distinguishing buy vs sell
      tokenSupply: "N/A",
      time: item.block_signed_at,
    }));

    return NextResponse.json(allTxs, { status: 200 });
  } catch (error: any) {
    console.error("WhaleWatcher route error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
