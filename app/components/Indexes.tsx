"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tooltip } from "react-tooltip";
import toast from "react-hot-toast";
import { useWalletSystem } from "@/app/providers";
import IndexVotingModal from "./IndexVotingModal";

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
  onVoteClick,
}: {
  name: string;
  tokens: (BaseAiToken & { data?: TokenData })[];
  stats: IndexStats;
  isMobile: boolean;
  onVoteClick: (indexName: string) => void;
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
            <button
              onClick={() => onVoteClick(name)}
              className={`px-3 py-1 ${bg} text-gray-400 rounded-md cursor-pointer hover:bg-blue-500/40 transition-all duration-200 hover:text-blue-300`}
            >
              Vote
            </button>
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
  const { selfCustodialWallet, walletLoading } = useWalletSystem();
  const walletAddress = selfCustodialWallet?.address;
  
  // Debug logging
  console.log('🔍 Indexes component - Wallet state:', {
    selfCustodialWallet,
    walletAddress,
    isConnected: selfCustodialWallet?.isConnected,
    walletLoading
  });
  
  const [indexesData, setIndexesData] = useState<
    { name: string; tokens: (BaseAiToken & { data?: TokenData })[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const indexRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0); // For mobile carousel
  
  // Voting state
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [selectedIndexForVoting, setSelectedIndexForVoting] = useState<string>('');
  
  // View state
  const [viewMode, setViewMode] = useState<'overview' | 'voting' | 'analytics'>('overview');
  
  // Points tracking
  const [userPoints, setUserPoints] = useState<number>(0);

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

  // Points system integration
  const awardPoints = useCallback(async (action: string, indexName: string, tokenAddress?: string, comment?: string) => {
    if (!walletAddress) return;
    
    try {
      const response = await fetch('/api/points/indexes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId: walletAddress, // Using wallet address as user ID
          walletAddress,
          indexName,
          tokenAddress,
          comment
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setUserPoints(result.totalPoints);
        toast.success(`+${result.pointsEarned} points earned!`);
      } else if (result.limitReached) {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error awarding points:', error);
    }
  }, [walletAddress]);

  const fetchUserPoints = useCallback(async () => {
    if (!walletAddress) return;
    
    try {
      const response = await fetch(`/api/points/indexes?walletAddress=${walletAddress}`);
      const result = await response.json();
      if (result.user) {
        setUserPoints(result.totalPoints);
      }
    } catch (error) {
      console.error('Error fetching user points:', error);
    }
  }, [walletAddress]);

  // Fetch user points when wallet connects
  useEffect(() => {
    if (walletAddress) {
      fetchUserPoints();
    }
  }, [walletAddress, fetchUserPoints]);

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
    // Award points for refreshing
    if (walletAddress) {
      awardPoints('refresh_index', 'CDEX'); // Using CDEX as default for refresh
    }
  }, 1000);



  const handlePrevIndex = () => {
    setCurrentIndex((prev) => (prev === 0 ? indexesData.length - 1 : prev - 1));
  };

  const handleNextIndex = () => {
    setCurrentIndex((prev) => (prev === indexesData.length - 1 ? 0 : prev + 1));
  };

  // Voting handlers
  const handleVoteClick = (indexName: string) => {
    if (walletLoading) {
      toast.error('Please wait while your wallet is loading...');
      return;
    }
    
    if (!walletAddress) {
      toast.error('Please create or connect your XWallet to vote');
      return;
    }
    setSelectedIndexForVoting(indexName);
    setShowVotingModal(true);
    // Award points for viewing voting interface
    awardPoints('view_index', indexName);
  };

  const handleCloseVotingModal = () => {
    setShowVotingModal(false);
    setSelectedIndexForVoting('');
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
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500/30 to-blue-600/30 rounded-xl flex items-center justify-center border border-blue-500/30">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-200">Indexes</h2>
              <p className="text-xs sm:text-sm text-gray-400">AI-powered token indices</p>
              {walletLoading && (
                <div className="flex items-center space-x-1 mt-1">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-400">Loading wallet...</span>
                </div>
              )}
              {walletAddress && userPoints > 0 && (
                <div className="flex items-center space-x-1 mt-1">
                  <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-xs text-yellow-400 font-medium">{userPoints} points</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Desktop Controls */}
          <div className="hidden sm:flex items-center space-x-2">
            {/* View Toggle */}
            <div className="flex bg-gray-800 rounded-lg p-1 border border-blue-500/30">
              {[
                { 
                  value: 'overview', 
                  label: 'Overview', 
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  )
                },
                { 
                  value: 'voting', 
                  label: 'Voting', 
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )
                },
                { 
                  value: 'analytics', 
                  label: 'Analytics', 
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  )
                }
              ].map((view) => (
                <button
                  key={view.value}
                  onClick={() => setViewMode(view.value as 'overview' | 'voting' | 'analytics')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                    viewMode === view.value
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  {view.icon}
                  <span>{view.label}</span>
                </button>
              ))}
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
            
            <motion.button
              onClick={() => {
                if (walletLoading) {
                  toast.error('Please wait while your wallet is loading...');
                  return;
                }
                
                if (walletAddress) {
                  awardPoints('share_index', 'CDEX');
                  // Copy current URL to clipboard
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Indexes link copied to clipboard!');
                } else {
                  toast.error('Please connect your wallet to share');
                }
              }}
              className="p-2 rounded-full bg-gray-800 border border-blue-500/30 hover:bg-blue-500/40 transition-all duration-200"
              title="Share Indexes"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Share Indexes"
            >
              <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
            </motion.button>
          </div>
          
          {/* Mobile Controls - Simplified */}
          <div className="sm:hidden flex items-center space-x-2">
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
        </div>
        
        {/* Mobile View Toggle - Moved below header */}
        {isMobile && (
          <div className="mb-4">
            <div className="flex bg-gray-800 rounded-lg p-1 border border-blue-500/30 w-full">
              {[
                { 
                  value: 'overview', 
                  label: 'Overview', 
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  )
                },
                { 
                  value: 'voting', 
                  label: 'Voting', 
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )
                },
                { 
                  value: 'analytics', 
                  label: 'Analytics', 
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  )
                }
              ].map((view) => (
                <button
                  key={view.value}
                  onClick={() => setViewMode(view.value as 'overview' | 'voting' | 'analytics')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                    viewMode === view.value
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  {view.icon}
                  <span>{view.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {viewMode === 'overview' && (
          <>
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
                      onVoteClick={handleVoteClick}
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
                            onVoteClick={handleVoteClick}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        
        {/* Voting View */}
        {viewMode === 'voting' && (
          <div className="py-2 sm:py-4">
            {/* Header Section */}
            <div className="text-center mb-3 sm:mb-4">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full mb-2 sm:mb-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-100 mb-1 sm:mb-2">Index Governance</h3>
              <p className="text-xs sm:text-sm text-gray-400 max-w-2xl mx-auto px-4">
                Participate in community governance to shape the future of our indexes. Your vote matters in determining which tokens are included and their weights.
              </p>
            </div>

            {/* Voting Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-xl border border-blue-500/20 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-blue-400">2</span>
                </div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-1">Voting Periods</h4>
                <p className="text-xs sm:text-sm text-gray-400">1st-15th & 16th-end of month</p>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-xl border border-green-500/20 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-green-400">25</span>
                </div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-1">Points Earned</h4>
                <p className="text-xs sm:text-sm text-gray-400">For participating in voting</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-xl border border-purple-500/20 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-purple-400">1</span>
                </div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-1">Vote Per Wallet</h4>
                <p className="text-xs sm:text-sm text-gray-400">One vote per period</p>
              </div>
            </div>

            {/* Index Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {indexesData.map((index) => {
                const totalWeight = index.tokens.reduce((sum, token) => sum + token.weight, 0);
                const avgPriceChange = index.tokens.reduce((sum, token) => {
                  const priceChange = token.data?.priceChange?.h24 || 0;
                  return sum + priceChange;
                }, 0) / index.tokens.length;

                return (
                  <div key={index.name} className="group relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700/50 p-4 sm:p-6 hover:border-blue-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="relative z-10">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <h4 className="text-lg sm:text-xl font-bold text-gray-100">{index.name}</h4>
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs sm:text-sm">Tokens</span>
                          <span className="text-gray-200 font-semibold text-sm sm:text-base">{index.tokens.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs sm:text-sm">Total Weight</span>
                          <span className="text-gray-200 font-semibold text-sm sm:text-base">{totalWeight.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs sm:text-sm">24h Change</span>
                          <span className={`font-semibold text-sm sm:text-base ${avgPriceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {avgPriceChange.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => handleVoteClick(index.name)}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2 text-sm sm:text-base"
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Vote for {index.name}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info Section */}
            <div className="mt-6 sm:mt-8 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700/50 p-4 sm:p-6">
              <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4 flex items-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How Voting Works
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400">
                <div className="space-y-2">
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>
                    Voting periods: 1st-15th and 16th-end of month
                  </p>
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-3"></span>
                    Earn 25 points for participating in voting
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-purple-400 rounded-full mr-3"></span>
                    One vote per wallet per period
                  </p>
                  <p className="flex items-center">
                    <span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span>
                    Can change vote once per period
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Analytics View */}
        {viewMode === 'analytics' && (
          <div className="py-2 sm:py-4">
            {/* Header Section */}
            <div className="text-center mb-3 sm:mb-4">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500/20 to-teal-500/20 rounded-full mb-2 sm:mb-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-100 mb-1 sm:mb-2">Index Analytics</h3>
              <p className="text-xs sm:text-sm text-gray-400 max-w-2xl mx-auto px-4">
                Comprehensive performance metrics and insights for each index. Track performance, volatility, and market dynamics.
              </p>
            </div>

            {/* Overall Performance Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-xl border border-blue-500/20 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-blue-400">
                    {aggStatsByIndex.reduce((sum, stats) => sum + stats.overallPriceChange, 0).toFixed(2)}%
                  </span>
                </div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-1">Avg Performance</h4>
                <p className="text-xs sm:text-sm text-gray-400">24h change across all indexes</p>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-xl border border-green-500/20 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-green-400">
                    ${(aggStatsByIndex.reduce((sum, stats) => sum + stats.totalVolume, 0) / 1000000).toFixed(1)}M
                  </span>
                </div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-1">Total Volume</h4>
                <p className="text-xs sm:text-sm text-gray-400">Combined 24h volume</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-xl border border-purple-500/20 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-purple-400">
                    {aggStatsByIndex.reduce((sum, stats) => sum + stats.totalMarketCap, 0) / 1000000 > 1000 
                      ? `${((aggStatsByIndex.reduce((sum, stats) => sum + stats.totalMarketCap, 0) / 1000000) / 1000).toFixed(1)}B`
                      : `${(aggStatsByIndex.reduce((sum, stats) => sum + stats.totalMarketCap, 0) / 1000000).toFixed(1)}M`
                    }
                  </span>
                </div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-1">Market Cap</h4>
                <p className="text-xs sm:text-sm text-gray-400">Combined market cap</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 rounded-xl border border-orange-500/20 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <span className="text-xl sm:text-2xl font-bold text-orange-400">
                    {aggStatsByIndex.reduce((sum, stats) => sum + stats.totalPairs, 0)}
                  </span>
                </div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-1">Total Tokens</h4>
                <p className="text-xs sm:text-sm text-gray-400">Across all indexes</p>
              </div>
            </div>

            {/* Detailed Index Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              {aggStatsByIndex.map((stats) => {
                const volatility = Math.abs(stats.overallPriceChange) > 10 ? 'High' : 
                                 Math.abs(stats.overallPriceChange) > 5 ? 'Medium' : 'Low';
                const volatilityColor = volatility === 'High' ? 'text-red-400' : 
                                      volatility === 'Medium' ? 'text-yellow-400' : 'text-green-400';
                const volumePerToken = stats.totalVolume / stats.totalPairs;
                const marketCapPerToken = stats.totalMarketCap / stats.totalPairs;

                return (
                  <div key={stats.name} className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700/50 p-4 sm:p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <div>
                        <h4 className="text-lg sm:text-xl font-bold text-gray-100">{stats.name} Index</h4>
                        <p className="text-xs sm:text-sm text-gray-400">Performance Analytics</p>
                      </div>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500/20 to-teal-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-400 text-sm">24h Change</span>
                          <span className={`font-semibold ${stats.overallPriceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {stats.overallPriceChange.toFixed(2)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${stats.overallPriceChange >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(Math.abs(stats.overallPriceChange) * 2, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-400 text-sm">Volatility</span>
                          <span className={`font-semibold ${volatilityColor}`}>{volatility}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${volatilityColor.replace('text-', 'bg-')}`}
                            style={{ width: `${volatility === 'High' ? 100 : volatility === 'Medium' ? 60 : 30}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Detailed Stats */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-400 text-sm">Volume (24h)</p>
                          <p className="text-gray-200 font-semibold">${(stats.totalVolume / 1000000).toFixed(1)}M</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Market Cap</p>
                          <p className="text-gray-200 font-semibold">${(stats.totalMarketCap / 1000000).toFixed(1)}M</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-400 text-sm">Tokens</p>
                          <p className="text-gray-200 font-semibold">{stats.totalPairs}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Avg Volume/Token</p>
                          <p className="text-gray-200 font-semibold">${(volumePerToken / 1000).toFixed(1)}K</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-400 text-sm">Avg Market Cap/Token</p>
                          <p className="text-gray-200 font-semibold">${(marketCapPerToken / 1000000).toFixed(1)}M</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Liquidity</p>
                          <p className="text-gray-200 font-semibold">${(stats.totalLiquidity / 1000000).toFixed(1)}M</p>
                        </div>
                      </div>
                    </div>

                    {/* Performance Indicator */}
                    <div className="mt-6 pt-4 border-t border-gray-700/50">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Performance Rating</span>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg 
                              key={star}
                              className={`w-4 h-4 ${star <= (stats.overallPriceChange > 0 ? Math.min(Math.floor(stats.overallPriceChange / 2) + 3, 5) : Math.max(5 - Math.floor(Math.abs(stats.overallPriceChange) / 2), 1)) ? 'text-yellow-400' : 'text-gray-600'}`}
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Market Insights */}
            <div className="mt-8 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-xl border border-gray-700/50 p-6">
              <h4 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
                <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Market Insights
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <p className="text-gray-300 font-medium">Best Performer</p>
                  <p className="text-gray-400">
                    {aggStatsByIndex.reduce((best, current) => 
                      current.overallPriceChange > best.overallPriceChange ? current : best
                    ).name} (+{aggStatsByIndex.reduce((best, current) => 
                      current.overallPriceChange > best.overallPriceChange ? current : best
                    ).overallPriceChange.toFixed(2)}%)
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-300 font-medium">Highest Volume</p>
                  <p className="text-gray-400">
                    {aggStatsByIndex.reduce((best, current) => 
                      current.totalVolume > best.totalVolume ? current : best
                    ).name} (${(aggStatsByIndex.reduce((best, current) => 
                      current.totalVolume > best.totalVolume ? current : best
                    ).totalVolume / 1000000).toFixed(1)}M)
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-300 font-medium">Most Stable</p>
                  <p className="text-gray-400">
                    {aggStatsByIndex.reduce((best, current) => 
                      Math.abs(current.overallPriceChange) < Math.abs(best.overallPriceChange) ? current : best
                    ).name} ({aggStatsByIndex.reduce((best, current) => 
                      Math.abs(current.overallPriceChange) < Math.abs(best.overallPriceChange) ? current : best
                    ).overallPriceChange.toFixed(2)}%)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
      
      {/* Voting Modal */}
      {showVotingModal && selectedIndexForVoting && (
        <IndexVotingModal
          isOpen={showVotingModal}
          onClose={handleCloseVotingModal}
          indexName={selectedIndexForVoting}
          currentTokens={indexesData.find(index => index.name === selectedIndexForVoting)?.tokens || []}
        />
      )}
    </motion.div>
  );
}