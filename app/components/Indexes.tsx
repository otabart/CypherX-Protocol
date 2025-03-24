"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import domToImage from "dom-to-image";

// ====== TYPES ======
export type TokenData = {
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceChange?: {
    h24?: number;
  };
  volume?: {
    h24: number;
  };
  marketCap?: number;
  info?: {
    imageUrl?: string;
  };
};

export type BaseAiToken = {
  symbol: string;
  address: string;
  weight: string; // stored as a string with a "%" symbol
};

// ====== STATIC LIST ======
const baseAiTokens: BaseAiToken[] = [
  { symbol: "GAME", address: "0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3", weight: "4.86%" }, { symbol: "BANKR", address: "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b", weight: "5.24%" }, { symbol: "FAI", address: "0xb33Ff54b9F7242EF1593d2C9Bcd8f9df46c77935", weight: "12.57%" }, { symbol: "VIRTUAL", address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", weight: "26.8%" }, { symbol: "CLANKER", address: "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb", weight: "15.89%" }, { symbol: "KAITO", address: "0x98d0baa52b2D063E780DE12F615f963Fe8537553", weight: "16.22%" }, { symbol: "COOKIE", address: "0xC0041EF357B183448B235a8Ea73Ce4E4eC8c265F", weight: "5.12%" }, { symbol: "VVV", address: "0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf", weight: "5.08%" }, { symbol: "DRB", address: "0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2", weight: "3.8%" }, { symbol: "AIXBT", address: "0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825", weight: "10.5%" },
];

// ====== ANIMATION VARIANTS ======
const containerVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

// ====== DOWNLOAD ICON (Heroicons Style) ======
function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

// ====== CUSTOM HOOK FOR MOBILE VIEW ======
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return isMobile;
}

export default function BaseAiIndex() {
  const isMobile = useIsMobile();

  // Merge static list with fetched token data
  const [tokensData, setTokensData] = useState<
    { symbol: string; weight: string; data?: TokenData }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Aggregated index stats
  const [aggStats, setAggStats] = useState<{
    overallPriceChange?: number;
    totalVolume?: number;
    totalMarketCap?: number;
  }>({});

  // Control truncation during screenshot
  const [disableTruncation, setDisableTruncation] = useState(false);

  // Ref for unified container (blue banner + table)
  const indexRef = useRef<HTMLDivElement>(null);

  // ====== FETCH TOKEN DATA ======
  useEffect(() => {
    async function fetchTokenData() {
      try {
        const addresses = baseAiTokens.map((t) => t.address).join(",");
        const res = await fetch(`/api/tokens?chainId=base&tokenAddresses=${addresses}`);
        const data: TokenData[] = await res.json();

        const mergedData = baseAiTokens.map((token) => {
          const fetched = data.find(
            (d) =>
              d.baseToken.address.toLowerCase() === token.address.toLowerCase()
          );
          return { ...token, data: fetched };
        });
        setTokensData(mergedData);

        let weightedPriceChangeSum = 0;
        let totalWeight = 0;
        let totalVolume = 0;
        let totalMarketCap = 0;

        mergedData.forEach((token) => {
          const weightNum = parseFloat(token.weight.replace("%", ""));
          if (token.data) {
            if (token.data.priceChange?.h24 !== undefined) {
              weightedPriceChangeSum += weightNum * token.data.priceChange.h24;
              totalWeight += weightNum;
            }
            if (token.data.volume?.h24) {
              totalVolume += token.data.volume.h24;
            }
            if (token.data.marketCap) {
              totalMarketCap += token.data.marketCap;
            }
          }
        });

        const overallPriceChange =
          totalWeight > 0 ? weightedPriceChangeSum / totalWeight : undefined;
        setAggStats({
          overallPriceChange,
          totalVolume,
          totalMarketCap,
        });
      } catch (error) {
        console.error("Error fetching token data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTokenData();
  }, []);

  // ====== DOWNLOAD IMAGE FUNCTION ======
  async function handleDownloadImage() {
    try {
      setDisableTruncation(true);
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (!indexRef.current) return;
      const dataUrl = await domToImage.toPng(indexRef.current, {
        quality: 1,
        style: { backgroundColor: "#fff" },
        // Uncomment below if external images require CORS:
        // crossOrigin: "anonymous",
      });
      const link = document.createElement("a");
      link.download = "base-ai-index.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Screenshot failed:", err);
    } finally {
      setDisableTruncation(false);
    }
  }

  if (loading) {
    return <div className="p-4 text-center">Loading Base AI Index...</div>;
  }

  return (
    <motion.div
      className={isMobile ? "p-2" : "p-4"}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
      variants={containerVariants}
    >
      {/* Unified container with square edges, no extra white space */}
      <motion.div
        ref={indexRef}
        className="relative shadow-lg overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, amount: 0.5 }}
      >
        {/* Download Button (nicer circular button) */}
        <button
          onClick={handleDownloadImage}
          className={isMobile ? "absolute top-1 right-1 p-2 rounded-full bg-white shadow hover:bg-gray-100" : "absolute top-3 right-3 p-2 rounded-full bg-white shadow hover:bg-gray-100"}
          title="Download Image"
        >
          <DownloadIcon />
        </button>

        {/* Blue Stats Banner – full width, no extra border/padding */}
        <div className="bg-[#0052FF] text-white p-4 w-full">
          <h2 className="text-2xl font-bold mb-2 text-center">Base AI Index</h2>
          <div className="flex flex-col sm:flex-row justify-around text-sm">
            <div title="Weighted Average 24h Price Change">
              <span className="font-medium">24h Change: </span>
              {aggStats.overallPriceChange !== undefined
                ? `${aggStats.overallPriceChange.toFixed(2)}%`
                : "N/A"}
            </div>
            <div title="Total 24h Trading Volume">
              <span className="font-medium">24h Volume: </span>
              {aggStats.totalVolume
                ? `$${aggStats.totalVolume.toLocaleString()}`
                : "N/A"}
            </div>
            <div title="Total Market Capitalization">
              <span className="font-medium">Market Cap: </span>
              {aggStats.totalMarketCap
                ? `$${aggStats.totalMarketCap.toLocaleString()}`
                : "N/A"}
            </div>
          </div>
        </div>

        {/* White Table Section – attached directly with no gap */}
        <div className="bg-white p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2" title="Token (Symbol and Icon)">Token</th>
                  <th className="border p-2" title="Weight in the Index">Weight</th>
                  <th className="border p-2" title="Price in USD">Price (USD)</th>
                  <th className="border p-2" title="24h Price Change (%)">24h Change</th>
                  <th className="border p-2" title="24h Trading Volume">Volume (24h)</th>
                  <th className="border p-2" title="Market Capitalization">Market Cap</th>
                </tr>
              </thead>
              <tbody>
                {tokensData.map((token, idx) => {
                  const d = token.data;
                  return (
                    <motion.tr
                      key={token.address}
                      className="border-t hover:bg-blue-50 transition-colors"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.1 }}
                      viewport={{ once: true, amount: 0.5 }}
                    >
                      <td className="border p-2 flex items-center space-x-2">
                        {d?.info?.imageUrl ? (
                          <img
                            src={d.info.imageUrl}
                            alt={token.symbol}
                            className="w-6 h-6 rounded-full"
                            // Uncomment if external images require CORS: crossOrigin="anonymous"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-300" />
                        )}
                        <span
                          className={disableTruncation ? "" : "truncate max-w-[80px]"}
                          title={token.symbol}
                        >
                          {token.symbol}
                        </span>
                      </td>
                      <td className="border p-2" title="Pre-defined weight">
                        {token.weight}
                      </td>
                      <td className="border p-2">
                        {d ? `$${Number(d.priceUsd).toFixed(4)}` : "N/A"}
                      </td>
                      <td className="border p-2">
                        {d && d.priceChange?.h24 !== undefined
                          ? `${d.priceChange.h24.toFixed(2)}%`
                          : "N/A"}
                      </td>
                      <td className="border p-2">
                        {d && d.volume?.h24
                          ? `$${d.volume.h24.toLocaleString()}`
                          : "N/A"}
                      </td>
                      <td className="border p-2">
                        {d && d.marketCap
                          ? `$${d.marketCap.toLocaleString()}`
                          : "N/A"}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}



