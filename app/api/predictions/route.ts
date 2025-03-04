import Prediction from "../../../app/analysts/models/Prediction";
import Analyst from "../../../app/analysts/models/Analyst";
import { fetchCoinData } from "../../../lib/coingecko";

export async function GET() {
  try {
    const predictions = await Prediction.find().populate("analyst");

    // Fetch live prices for each prediction
    const updatedPredictions = await Promise.all(
      predictions.map(async (p: any) => {
        const priceData = await fetchCoinData(p.coinAddress);
        return {
          ...p._doc,
          price: priceData?.[p.coin]?.usd || "N/A",
          priceChange: priceData?.[p.coin]?.usd_24h_change || 0,
        };
      })
    );

    return Response.json(updatedPredictions);
  } catch (error) {
    console.error("Error fetching predictions:", error);
    return Response.json({ error: "Failed to fetch predictions" }, { status: 500 });
  }
}


