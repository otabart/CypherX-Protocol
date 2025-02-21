"use client";

import { useState, useEffect } from "react";

type TokenData = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels: string[];
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info: {
    imageUrl: string;
    header: string;
    openGraph: string;
    websites: { label: string; url: string }[];
    socials: { type: string; url: string }[];
  };
};

export default function DexTokensPage() {
  const [tokensData, setTokensData] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTokens() {
      setLoading(true);
      try {
        // Replace with your desired token addresses as comma-separated string
        const tokenAddresses = "0x532f27101965dd16442e59d40670faf5ebb142e4";
        const res = await fetch(
          `/api/tokens?chainId=base&tokenAddresses=${tokenAddresses}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to fetch token data");
          setLoading(false);
          return;
        }
        setTokensData(data);
      } catch (err) {
        console.error(err);
        setError("Error fetching token data");
      } finally {
        setLoading(false);
      }
    }
    fetchTokens();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <header className="flex items-center justify-between bg-[#0060FF] py-4 px-6 mb-6">
        <h1 className="text-3xl font-bold">Base Chain Token Screener</h1>
        {/* Optionally add filter buttons, search box, etc. */}
      </header>

      {/* Main Content */}
      <main>
        {loading && (
          <p className="text-center text-lg text-gray-300">Loading token data...</p>
        )}
        {error && (
          <p className="text-center text-red-500 text-lg">{error}</p>
        )}
        {!loading && !error && tokensData.length === 0 && (
          <p className="text-center text-lg text-gray-300">
            No token data available.
          </p>
        )}
        {!loading && !error && tokensData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-[#0060FF]">
                <tr>
                  <th className="p-4 text-left">Token</th>
                  <th className="p-4 text-right">Price (USD)</th>
                  <th className="p-4 text-right">24h Volume</th>
                  <th className="p-4 text-right">Liquidity (USD)</th>
                  <th className="p-4 text-right">24h Change (%)</th>
                  <th className="p-4 text-right">Pair Address</th>
                </tr>
              </thead>
              <tbody>
                {tokensData.map((token) => (
                  <tr key={token.pairAddress} className="border-b border-gray-700 hover:bg-gray-800 transition-colors">
                    <td className="p-4 flex items-center space-x-3">
                      <img
                        src={token.info.imageUrl}
                        alt={token.baseToken.symbol}
                        className="w-8 h-8 rounded-full"
                      />
                      <div>
                        <div className="font-bold">{token.baseToken.name}</div>
                        <div className="text-sm text-gray-400">
                          {token.baseToken.symbol}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">${Number(token.priceUsd).toFixed(4)}</td>
                    <td className="p-4 text-right">${Number(token.volume.h24).toLocaleString()}</td>
                    <td className="p-4 text-right">${Number(token.liquidity.usd).toLocaleString()}</td>
                    <td className={`p-4 text-right ${Number(token.priceChange.h24) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {Number(token.priceChange.h24).toFixed(2)}%
                    </td>
                    <td className="p-4 text-right text-xs break-all">
                      {token.pairAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
