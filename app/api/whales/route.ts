import { NextResponse } from "next/server";

const COVALENT_API_KEY = process.env.NEXT_PUBLIC_COVALENT_API_KEY || "";

// Base mainnet chain_id is 8453 for Covalent
export async function GET(req: Request) {
  try {
    if (!COVALENT_API_KEY) {
      throw new Error("Covalent API key not found. Set NEXT_PUBLIC_COVALENT_API_KEY in .env.");
    }

    // Hardcode the known busy address for bridging USDC on Base
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
    if (!json || !json.data || !Array.isArray(json.data.items)) {
      return NextResponse.json([], { status: 200 });
    }

    // We'll build a minimal array of "Transaction" objects. 
    // In Covalent's model, you typically parse "log_events" for each item 
    // to see specific transfers. For demonstration, let's just return some basics.

    let allTxs: any[] = [];
    for (const item of json.data.items) {
      allTxs.push({
        id: item.tx_hash,
        wallet: item.from_address,
        token: "USDC",
        amount: 0,           // we aren't parsing logs here for an actual amount
        value: item.value_quote || 0,
        type: "N/A",         // we aren't distinguishing buy vs sell 
        tokenSupply: "N/A",  // not fetching supply
        time: item.block_signed_at,
      });
    }

    return NextResponse.json(allTxs);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}


