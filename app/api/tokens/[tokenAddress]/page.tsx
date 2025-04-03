"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function TokenChartPage() {
  const { tokenAddress } = useParams(); // Extracts tokenAddress from the URL
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistoricalData() {
      try {
        // Optionally, fetch additional historical data if needed:
        await fetch(`/api/historical?tokenAddress=${tokenAddress}`);
      } catch (error) {
        console.error("Error fetching historical data:", error);
      } finally {
        setLoading(false);
      }
    }
    if (tokenAddress) {
      fetchHistoricalData();
    }
  }, [tokenAddress]);

  if (loading) {
    return <div>Loading chart...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Token Chart: {tokenAddress}</h1>
      {/* Pass the token address (or transform as needed) to TradingViewWidget */}
      <TradingViewWidget symbol={`TOKEN:${tokenAddress}`} />
    </div>
  );
}



