import { NextApiRequest, NextApiResponse } from "next";
import fetch from "node-fetch";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    if (!alchemyApiKey) {
      console.error("Alchemy API key is missing");
      return res.status(500).json({ error: "Alchemy API key not configured" });
    }

    // Fetch ETH price and gas price from Alchemy or another provider
    const baseUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
    const gasPriceResponse = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 1,
      }),
    });

    if (!gasPriceResponse.ok) {
      console.error("Alchemy gas price fetch failed:", gasPriceResponse.statusText);
      return res.status(500).json({ error: "Failed to fetch gas price" });
    }

    const gasPriceData = await gasPriceResponse.json();
    const gasPrice = parseInt(gasPriceData.result, 16) / 1e9; // Convert from wei to Gwei

    // For ETH price, use a price feed API (e.g., CoinGecko or Alchemy's enhanced APIs)
    const priceResponse = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true"
    );
    if (!priceResponse.ok) {
      console.error("ETH price fetch failed:", priceResponse.statusText);
      return res.status(500).json({ error: "Failed to fetch ETH price" });
    }

    const priceData = await priceResponse.json();
    const ethPrice = priceData.ethereum.usd;
    const priceChange24h = priceData.ethereum.usd_24h_change;

    return res.status(200).json({
      price: ethPrice,
      priceChange24h,
      gasPrice,
    });
  } catch (error) {
    console.error("Error fetching ETH stats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}