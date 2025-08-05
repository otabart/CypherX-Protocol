"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tooltip } from "react-tooltip";
import toast from "react-hot-toast";

// Custom debounce function to replace lodash
const debounce = <T extends (...args: unknown[]) => unknown>(func: T, wait: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>): void => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// ====== TYPES ======
interface TokenData {
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
}

interface BaseAiToken {
  id: string;
  symbol: string;
  address: string;
  weight: number;
}

// DEX Screener API pair response type (based on docs: /tokens/v1/{chainId}/{addresses})
interface DexScreenerPair {
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd?: string;
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
  // Other fields exist (e.g., chainId, liquidity) but omitted as unused
}

// ====== HELPER FUNCTION ======
const abbreviateNumber = (number: number | undefined) => {
  if (number === undefined || isNaN(number) || number === 0) return "$0";
  const absNumber = Math.abs(number);
  if (absNumber >= 1e12) return `${Number((absNumber / 1e12).toFixed(2))}T`;
  if (absNumber >= 1e9) return `${Number((absNumber / 1e9).toFixed(2))}B`;
  if (absNumber >= 1e6) return `${Number((absNumber / 1e6).toFixed(2))}M`;
  if (absNumber >= 1e3) return `${Number((absNumber / 1e3).toFixed(2))}K`;
  return `${number.toFixed(2)}`; // No extra $ here, added in JSX
};

// ====== ANIMATION VARIANTS ======
const containerVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

const imageVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
};

const cardVariants = {
  hover: { scale: 1.02, transition: { duration: 0.2 } },
  tap: { scale: 0.98 },
};

// ====== ICONS ======
function RefreshIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-teal-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8 8 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8 8 0 01-15.356-2m15.356 2H15"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-white"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-white"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
    </svg>
  );
}

// ====== MOBILE HOOK ======
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

type IndexStats = {
  name: string;
  overallPriceChange: number;
  totalVolume: number;
  totalMarketCap: number;
  totalPairs: number;
  totalLiquidity: number;
};

const MemoIndexSection = React.memo(function IndexSection({
  name,
  tokens,
  stats,
  isMobile,
}: {
  name: string;
  tokens: (BaseAiToken & { data?: TokenData })[];
  stats: IndexStats;
  isMobile: boolean;
}) {
  const getIndexDescription = (name: string) => {
    switch (name) {
      case "CDEX":
        return "Clanker Index (CDEX)";
      case "BDEX":
        return "BID Index (BDEX)";
      case "VDEX":
        return "Virtual Index (VDEX)";
      case "AIDEX":
        return "AI Index (AIDEX)";
      default:
        return name;
    }
  };

  const getColorScheme = (name: string) => {
    switch (name) {
      case "CDEX":
        return { text: "text-blue-300", bg: "bg-blue-500/20" };
      case "BDEX":
        return { text: "text-purple-300", bg: "bg-purple-500/20" };
      case "VDEX":
        return { text: "text-teal-300", bg: "bg-teal-500/20" };
      case "AIDEX":
        return { text: "text-orange-300", bg: "bg-orange-500/20" };
      default:
        return { text: "text-gray-300", bg: "bg-gray-500/20" };
    }
  };

  const { text, bg } = getColorScheme(name);

  return (
    <td
      className={`p-2 ${isMobile ? "w-full" : "w-[25%]"} ${!isMobile && "border-r border-blue-500/30"} last:border-r-0`}
      style={{ boxSizing: "border-box" }}
    >
      <div className="flex flex-col h-full space-y-4">
        <div className="text-center pt-1">
          <h3 className={`font-bold ${text} ${isMobile ? "text-base" : "text-lg"} gradient-text mb-2 font-sans`}>
            {getIndexDescription(name)}
          </h3>
          <p className="text-xs text-gray-400">Re-weighted bi-weekly via community voting</p>
          <div className="flex justify-center space-x-2 mt-2">
            <span
              data-tooltip-id={`tooltip-${name}-invest`}
              className={`px-3 py-1 ${bg} text-gray-400 rounded-md cursor-pointer hover:bg-blue-500/40`}
            >
              Invest
            </span>
            <Tooltip
              id={`tooltip-${name}-invest`}
              place="top"
              content="Available in v2: By holding this index, you can receive airdrops from coins in this index and earn monthly dividends. Stakers get high % allocation of airdrops."
              className="bg-gray-800 text-white p-2 rounded max-w-xs"
              delayShow={300}
            />
            <span
              data-tooltip-id={`tooltip-${name}-vote`}
              className={`px-3 py-1 ${bg} text-gray-400 rounded-md cursor-pointer hover:bg-blue-500/40`}
            >
              Vote
            </span>
            <Tooltip
              id={`tooltip-${name}-vote`}
              place="top"
              content="Available in v2: Vote bi-weekly to influence index re-weighting."
              className="bg-gray-800 text-white p-2 rounded max-w-xs"
              delayShow={300}
            />
          </div>
        </div>
        <motion.div
          className="p-3 shadow-md border border-blue-500/20 bg-gradient-to-br from-gray-800 to-gray-700 mt-0 rounded-md"
          variants={cardVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className={text}>
              24h Change:{" "}
              <span className={stats.overallPriceChange >= 0 ? "text-green-400" : "text-red-400"}>
                {stats.overallPriceChange.toFixed(2)}%
              </span>
            </span>
            <span className={text}>Vol: ${abbreviateNumber(stats.totalVolume)}</span>
            <span className={text}>Mkt Cap: ${abbreviateNumber(stats.totalMarketCap)}</span>
            <span className={text}>Pairs: {stats.totalPairs}</span>
          </div>
        </motion.div>
        <table className="w-full text-left text-sm mt-4">
          <tbody>
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={isMobile ? 4 : 5} className="p-2 text-center text-yellow-400">
                  No tokens
                </td>
              </tr>
            ) : (
              tokens.map((token, idx) => (
                <motion.tr
                  key={`${name}-${token.id}`}
                  className="border-t border-blue-500/30 hover:bg-gray-800"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  role="row"
                >
                  <td className="py-2 px-1 flex items-center space-x-2">
                    {token.data?.info?.imageUrl ? (
                      <motion.div variants={imageVariants} initial="hidden" whileInView="visible">
                        <Image
                          src={token.data.info.imageUrl || "/fallback.png"}
                          alt={`${token.symbol} logo`}
                          width={isMobile ? 20 : 24}
                          height={isMobile ? 20 : 24}
                          className="rounded-full border border-blue-500/30"
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) =>
                            (e.currentTarget.src = "/fallback.png")
                          }
                          placeholder="empty" // Changed to "empty" to avoid potential parsing issues with base64
                        />
                      </motion.div>
                    ) : (
                      <div className={`rounded-full bg-gray-800 ${isMobile ? "w-5 h-5" : "w-6 h-6"}`} />
                    )}
                    <div
                      data-tooltip-id={`tooltip-${name}-${token.id}`}
                      className="text-gray-200 font-medium hover:text-blue-400 truncate max-w-[100px] md:max-w-[150px]"
                    >
                      <a
                        href={`/explorer/address/${token.address}`}
                        title={token.symbol}
                        aria-label={`View ${token.symbol} on our explorer`}
                      >
                        {token.symbol}
                      </a>
                    </div>
                    <Tooltip
                      id={`tooltip-${name}-${token.id}`}
                      place="top"
                      content={`Address: ${token.address}`}
                      className="bg-gray-800 text-white p-2 rounded"
                      delayShow={300}
                    />
                  </td>
                  <td className="py-2 px-1 text-gray-400">{token.weight.toFixed(2)}%</td>
                  <td className="py-2 px-1 text-gray-400">
                    {token.data?.priceUsd ? `$${Number(token.data.priceUsd).toFixed(4)}` : "N/A"}
                  </td>
                  <td className="py-2 px-1">
                    {token.data?.priceChange?.h24 !== undefined ? (
                      <span className={token.data.priceChange.h24 >= 0 ? "text-green-400" : "text-red-400"}>
                        {token.data.priceChange.h24.toFixed(2)}%
                      </span>
                    ) : (
                      "N/A"
                    )}
                  </td>
                  {!isMobile && (
                    <td className="py-2 px-1 text-gray-400">
                      ${abbreviateNumber(token.data?.marketCap ?? 0)}
                    </td>
                  )}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </td>
  );
});

export default function BaseAiIndex() {
  const isMobile = useIsMobile();
  const [indexesData, setIndexesData] = useState<
    { name: string; tokens: (BaseAiToken & { data?: TokenData })[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const indexRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0); // For mobile carousel

  const fetchData = useCallback(async () => {
    const indexNames = ["CDEX", "BDEX", "VDEX", "AIDEX"];
    setLoading(true);
    setError(null);

    const logDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });

    try {
      const allIndexesData = await Promise.all(
        indexNames.map(async (index) => {
          const indexRef = collection(db, index);
          const querySnapshot = await getDocs(indexRef);
          console.log(`[${logDate}] Fetched`, querySnapshot.size, "documents from", index, "collection");

          if (querySnapshot.empty) {
            console.warn(`[${logDate}]`, index, "collection is empty or does not exist.");
            return { name: index, tokens: [] };
          }

          const tokens: BaseAiToken[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            // Enhanced symbol fallback
            const symbol =
              data.symbol ||
              data.baseToken?.symbol ||
              data.name ||
              data.baseToken?.name ||
              `Token-${id.slice(0, 4)}`;
            const address = data.address || "";
            const weight = parseFloat(data.weight) || 0;

            console.log(`[${logDate}] Document`, index, "/", id, ":", {
              symbol,
              address,
              weight,
              rawData: data,
            });

            if (address) {
              tokens.push({ id, symbol, address, weight });
            } else {
              console.warn(`[${logDate}] Invalid or missing address for`, index, "/", id);
            }
          });

          const sortedTokens = tokens.sort((a, b) => b.weight - a.weight).slice(0, 10);
          console.log(`[${logDate}] Valid tokens for`, index, ":", sortedTokens);

          if (!sortedTokens.length) {
            return { name: index, tokens: [] };
          }

          const tokenChunks: string[][] = [];
          for (let i = 0; i < sortedTokens.length; i += 10) {
            tokenChunks.push(sortedTokens.slice(i, i + 10).map((t) => t.address));
          }

          const allResults: TokenData[] = [];
          for (const chunk of tokenChunks) {
            const joinedChunk = encodeURIComponent(chunk.join(","));
            console.log(`[${logDate}] Fetching DEX data for chunk:`, joinedChunk);

            const res = await fetch(`https://api.dexscreener.com/tokens/v1/base/${joinedChunk}`, {
              headers: { Accept: "application/json" },
            });

            if (!res.ok) {
              console.error(`[${logDate}] DEX Screener API failed:`, res.status, res.statusText);
              continue;
            }

            const data: DexScreenerPair[] = await res.json();
            console.log(`[${logDate}] DEX Screener response for`, index, ":", data);

            allResults.push(
              ...data.map((pair) => ({
                pairAddress: pair.pairAddress || "",
                baseToken: {
                  address: pair.baseToken?.address || "",
                  name: pair.baseToken?.name || "Unknown",
                  symbol: pair.baseToken?.symbol || "UNK",
                },
                priceUsd: pair.priceUsd || "0",
                priceChange: pair.priceChange || { h24: 0 },
                volume: pair.volume || { h24: 0 },
                marketCap: pair.marketCap || 0,
                info: pair.info ? { imageUrl: pair.info.imageUrl } : undefined,
              }))
            );
          }

          const tokensWithData = sortedTokens.map((token) => {
            const fetched = allResults.find((d) => d.baseToken.address.toLowerCase() === token.address.toLowerCase());
            if (!fetched) {
              console.warn(`[${logDate}] No DEX data for`, token.address, "(ID:", token.id, ")");
            }
            return {
              ...token,
              data: fetched || {
                pairAddress: "",
                baseToken: { address: "", name: token.symbol || "Unknown", symbol: token.symbol || "UNK" },
                priceUsd: "0",
                priceChange: { h24: 0 },
                volume: { h24: 0 },
                marketCap: 0,
                info: undefined,
              },
            };
          });

          return { name: index, tokens: tokensWithData };
        })
      );

      setIndexesData(allIndexesData);
    } catch (err) {
      console.error(`[${logDate}] Fetch data error:`, err);
      const errMsg = `[${logDate}] Failed to load token data: ` + (err instanceof Error ? err.message : String(err));
      setError(errMsg);
      toast.error(errMsg); // Added toast for user-friendly error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const aggStatsByIndex = useMemo(() => {
    return indexesData.map((index) => {
      let weightedPriceChangeSum = 0;
      let totalWeight = 0;
      let totalVolume = 0;
      let totalMarketCap = 0;
      const totalPairs = index.tokens.length;
      const totalLiquidity = totalMarketCap * 0.1;

      index.tokens.forEach((token) => {
        if (token.data) {
          if (token.data.priceChange?.h24 !== undefined) {
            weightedPriceChangeSum += token.weight * (token.data.priceChange.h24 ?? 0);
            totalWeight += token.weight;
          }
          if (token.data.volume?.h24) {
            totalVolume += token.data.volume.h24;
          }
          if (token.data.marketCap) {
            totalMarketCap += token.data.marketCap;
          }
        }
      });

      const overallPriceChange = totalWeight > 0 ? weightedPriceChangeSum / totalWeight : 0;
      return {
        name: index.name,
        overallPriceChange,
        totalVolume: totalVolume || 0,
        totalMarketCap: totalMarketCap || 0,
        totalPairs,
        totalLiquidity,
      };
    });
  }, [indexesData]);

  const debouncedRefresh = debounce(() => {
    toast.loading("Refreshing data...", { duration: 2000 });
    fetchData();
  }, 1000);

  const handlePrevIndex = () => {
    setCurrentIndex((prev) => (prev === 0 ? indexesData.length - 1 : prev - 1));
  };

  const handleNextIndex = () => {
    setCurrentIndex((prev) => (prev === indexesData.length - 1 ? 0 : prev + 1));
  };

  if (loading) {
    return (
      <div className="w-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-blue-500/30 p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500/30 to-blue-600/30 rounded-xl flex items-center justify-center border border-blue-500/30">
              <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-200">Indexes</h2>
              <p className="text-sm text-gray-400">AI-powered token indices</p>
            </div>
          </div>
          <div className="h-8 w-8 bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {Array(4).fill(null).map((_, idx) => (
            <div key={idx} className="h-64 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-blue-500/30 p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500/30 to-blue-600/30 rounded-xl flex items-center justify-center border border-blue-500/30">
              <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-200">Indexes</h2>
              <p className="text-sm text-gray-400">AI-powered token indices</p>
            </div>
          </div>
        </div>
        <div className="text-center text-red-400">
          {error}
          <button
            onClick={debouncedRefresh}
            className="ml-2 px-3 py-1 bg-teal-500/20 text-teal-400 rounded-md hover:bg-teal-500/40 transition-all duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="w-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-blue-500/30 p-4 sm:p-6"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      <motion.div ref={indexRef} className="w-full">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500/30 to-blue-600/30 rounded-xl flex items-center justify-center border border-blue-500/30">
              <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-200">Indexes</h2>
              <p className="text-sm text-gray-400">AI-powered token indices</p>
            </div>
          </div>
          <motion.button
            onClick={debouncedRefresh}
            className="p-2 rounded-full bg-gray-800 border border-teal-500/30 hover:bg-teal-500/40 transition-all duration-200"
            title="Refresh Data"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Refresh Data"
          >
            <RefreshIcon />
          </motion.button>
        </div>
        {isMobile ? (
                      <div className="relative">
              <style>
                {`
                  .carousel-container {
                    position: relative;
                    width: 100%;
                    overflow: hidden;
                  }
                  .carousel-slide {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                    transition: transform 0.5s ease;
                  }
                  .carousel-button {
                    position: absolute;
                    top: 5px;
                    padding: 6px;
                    cursor: pointer;
                    background: rgba(31, 41, 55, 0.8);
                    border-radius: 50%;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    transition: all 0.2s ease;
                  }
                  .carousel-button.left {
                    left: 10px;
                  }
                  .carousel-button.right {
                    right: 10px;
                  }
                  .carousel-button:hover {
                    background: rgba(31, 41, 55, 1);
                    transform: scale(1.1);
                  }
                `}
              </style>
              <div className="carousel-container">
                <div className="carousel-slide">
                  <MemoIndexSection
                    name={indexesData[currentIndex].name}
                    tokens={indexesData[currentIndex].tokens}
                    stats={
                      aggStatsByIndex[currentIndex] || {
                        name: indexesData[currentIndex].name,
                        overallPriceChange: 0,
                        totalVolume: 0,
                        totalMarketCap: 0,
                        totalPairs: 0,
                        totalLiquidity: 0,
                      }
                    }
                    isMobile={isMobile}
                  />
                </div>
                <button className="carousel-button left" onClick={handlePrevIndex} aria-label="Previous Index">
                  <ArrowLeftIcon />
                </button>
                <button className="carousel-button right" onClick={handleNextIndex} aria-label="Next Index">
                  <ArrowRightIcon />
                </button>
              </div>
              <div className="flex justify-center mt-4 space-x-2">
                {indexesData.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-3 h-3 rounded-full transition-all duration-200 ${idx === currentIndex ? 'bg-teal-400' : 'bg-gray-600'}`}
                  />
                ))}
              </div>
            </div>
        ) : (
          <div className="w-full" style={{ maxWidth: "100%" }}>
            <table className="w-full text-left">
              <tbody>
                <tr>
                  {indexesData.map((index, idx) => (
                    <td
                      key={index.name}
                      className={`p-2 w-[25%] ${idx < indexesData.length - 1 ? "border-r border-blue-500/30" : ""}`}
                      style={{ boxSizing: "border-box" }}
                    >
                      <MemoIndexSection
                        name={index.name}
                        tokens={index.tokens}
                        stats={
                          aggStatsByIndex[idx] || {
                            name: index.name,
                            overallPriceChange: 0,
                            totalVolume: 0,
                            totalMarketCap: 0,
                            totalPairs: 0,
                            totalLiquidity: 0,
                          }
                        }
                        isMobile={isMobile}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}