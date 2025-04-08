"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaTrophy, FaBolt, FaStar, FaDownload, FaSearch } from "react-icons/fa";
import { MdCampaign } from "react-icons/md";
import { tokenMapping } from "../tokenMapping"; // Corrected import path
import debounce from "lodash/debounce"; // Add lodash for debouncing

// Utility Functions
function getColorClass(value: number) {
  return value >= 0 ? "text-green-500" : "text-red-500";
}

function getAge(createdAt?: number): string {
  if (!createdAt) return "N/A";
  const diffMs = Date.now() - createdAt;
  const days = diffMs / (1000 * 60 * 60 * 24);
  return days < 1 ? `${Math.floor(days * 24)}h` : `${Math.floor(days)}d`;
}

function getTxns24h(token: DexToken): number {
  if (!token.txns || !token.txns.h24) return 0;
  const { buys, sells } = token.txns.h24;
  return buys + sells;
}

const MIN_LIQUIDITY = 20000;
const DECAY_CONSTANT = 7;

function computeTrending(token: DexToken, boostValue: number): number {
  const { h1, h6, h24 } = token.priceChange || {};
  const avgChange =
    (0.5 * Number(h1) + 0.3 * Number(h6) + 0.2 * Number(h24)) || 0;

  let trending =
    token.marketCap && token.marketCap > 0
      ? avgChange * (token.volume.h24 / token.marketCap)
      : avgChange;

  if (avgChange > 0) trending *= 1.1;
  const txns = getTxns24h(token);
  trending += Math.log10(txns + 1) * 0.5;

  const liquidityUsd = token.liquidity.usd || 0;
  if (liquidityUsd < MIN_LIQUIDITY) {
    const liquidityFactor = liquidityUsd / MIN_LIQUIDITY;
    trending *= liquidityFactor;
  }

  const pairAgeDays = token.pairCreatedAt
    ? (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60 * 24)
    : 0;
  const ageDecay = Math.exp(-pairAgeDays / DECAY_CONSTANT);
  trending *= ageDecay;

  const boostBonus = boostValue / 100;
  trending += boostBonus;

  return trending;
}

// Types
type DexToken = {
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  txns: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  priceChange: { h1?: number; h6?: number; h24?: number };
  volume: { h24: number };
  liquidity: { usd: number };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
  trendingScore?: number;
  info?: { imageUrl?: string };
  boosted?: boolean;
  boostValue?: number;
};

// Trophy & Marketing Icons
function getTrophy(rank: number) {
  if (rank === 1)
    return <FaTrophy size={16} className="text-[#FFD700]" title="Gold Trophy (Rank 1)" />;
  if (rank === 2)
    return <FaTrophy size={16} className="text-[#C0C0C0]" title="Silver Trophy (Rank 2)" />;
  if (rank === 3)
    return <FaTrophy size={16} className="text-[#CD7F32]" title="Bronze Trophy (Rank 3)" />;
  return null;
}

function MarketingIcon() {
  return (
    <span className="cursor-help" title="Advertisement">
      <MdCampaign className="text-lime-400 w-4 h-4 md:w-5 md:h-5" />
    </span>
  );
}

const boostMap: Record<number, number> = { 2: 175, 3: 20, 12: 10, 15: 10 };
const marketingRanks = new Set([1, 2, 4, 5, 7, 8, 9, 11, 13, 14, 15, 16, 17]);

export default function TokenScanner() {
  const router = useRouter();
  const [tokens, setTokens] = useState<DexToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const pageSize = 25;
  const [toast, setToast] = useState("");
  const [sortFilter, setSortFilter] = useState("trending");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    minLiquidity: 0,
    minVolume: 0,
    minAge: 0,
    maxAge: Infinity,
  });
  const [viewerCount, setViewerCount] = useState(0);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Submission State
  const [showModal, setShowModal] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenLogo, setTokenLogo] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Load watchlist from localStorage
  useEffect(() => {
    const savedWatchlist = localStorage.getItem("watchlist");
    if (savedWatchlist) {
      setWatchlist(JSON.parse(savedWatchlist));
    }
  }, []);

  // Simulate live viewer count
  useEffect(() => {
    const currentCount = Number(localStorage.getItem("viewerCount") || 0);
    const newCount = currentCount + 1;
    localStorage.setItem("viewerCount", newCount.toString());
    setViewerCount(newCount);

    const handleUnload = () => {
      const currentCount = Number(localStorage.getItem("viewerCount") || 0);
      const newCount = Math.max(currentCount - 1, 0);
      localStorage.setItem("viewerCount", newCount.toString());
      setViewerCount(newCount);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "viewerCount") {
        setViewerCount(Number(e.newValue || 0));
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("storage", handleStorageChange);
      handleUnload();
    };
  }, []);

  // Fetch Tokens using tokenMapping
  useEffect(() => {
    async function fetchTokens() {
      setLoading(true);
      try {
        const tokenAddresses = Object.values(tokenMapping).join(",");
        const tokenList = Object.values(tokenMapping);
        const tokenChunks: string[][] = [];
        for (let i = 0; i < tokenList.length; i += 30) {
          tokenChunks.push(tokenList.slice(i, i + 30));
        }

        let allResults: DexToken[] = [];
        const fetchPromises = tokenChunks.map(async (chunk) => {
          const joinedChunk = chunk.join(",");
          try {
            const res = await fetch(
              `/api/tokens?chainId=base&tokenAddresses=${joinedChunk}`
            );
            if (!res.ok) {
              console.warn(`Failed to fetch chunk: ${joinedChunk}`);
              return [];
            }
            const data = await res.json();
            return data;
          } catch (err) {
            console.error(`Error fetching chunk: ${joinedChunk}`, err);
            return [];
          }
        });

        const chunkResults = await Promise.all(fetchPromises);
        allResults = chunkResults.flat();

        if (Array.isArray(allResults) && allResults.length > 0) {
          let tokensWithScores = allResults.map((tk) => ({ ...tk, boostValue: 0 }));
          tokensWithScores = tokensWithScores.map((tk) => ({
            ...tk,
            trendingScore: computeTrending(tk, 0),
          }));
          tokensWithScores.sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0));

          const finalTokens = tokensWithScores.map((tk, idx) => {
            const rank = idx + 1;
            const assignedBoost = boostMap[rank] || 0;
            const finalScore = computeTrending(tk, assignedBoost);
            return {
              ...tk,
              boosted: assignedBoost > 0,
              boostValue: assignedBoost,
              trendingScore: finalScore,
            };
          });
          finalTokens.sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0));
          setTokens(finalTokens);
        } else {
          setError("No tokens returned");
        }
      } catch (err) {
        console.error(err);
        setError("Error fetching token data");
      } finally {
        setLoading(false);
      }
    }

    fetchTokens();
    const interval = setInterval(fetchTokens, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sorting & Filtering
  const filteredTokens = useMemo(() => {
    return tokens.filter((token) => {
      const matchesSearch =
        token.baseToken.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.baseToken.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      const ageDays = token.pairCreatedAt
        ? (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60 * 24)
        : 0;
      return (
        matchesSearch &&
        token.liquidity.usd >= filters.minLiquidity &&
        token.volume.h24 >= filters.minVolume &&
        ageDays >= filters.minAge &&
        (filters.maxAge === Infinity || ageDays <= filters.maxAge)
      );
    });
  }, [tokens, searchQuery, filters]);

  const sortedTokens = useMemo(() => {
    const copy = [...filteredTokens];
    if (sortFilter === "trending") {
      return sortDirection === "asc" ? copy.reverse() : copy;
    }
    if (sortFilter === "volume") {
      copy.sort((a, b) =>
        sortDirection === "desc" ? b.volume.h24 - a.volume.h24 : a.volume.h24 - b.volume.h24
      );
    } else if (sortFilter === "liquidity") {
      copy.sort((a, b) =>
        sortDirection === "desc"
          ? b.liquidity.usd - a.liquidity.usd
          : a.liquidity.usd - b.liquidity.usd
      );
    } else if (sortFilter === "marketCap") {
      copy.sort((a, b) =>
        sortDirection === "desc"
          ? (b.marketCap ?? 0) - (a.marketCap ?? 0)
          : (a.marketCap ?? 0) - (b.marketCap ?? 0)
      );
    } else if (sortFilter === "age") {
      copy.sort((a, b) =>
        sortDirection === "desc"
          ? (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0)
          : (a.pairCreatedAt ?? 0) - (b.pairCreatedAt ?? 0)
      );
    } else {
      let key: "h1" | "h6" | "h24" = "h1";
      if (sortFilter === "6h") key = "h6";
      else if (sortFilter === "24h") key = "h24";
      copy.sort((a, b) => {
        const aVal = a.priceChange?.[key] ?? 0;
        const bVal = b.priceChange?.[key] ?? 0;
        return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
      });
    }
    return copy;
  }, [filteredTokens, sortFilter, sortDirection]);

  const searchSuggestions = useMemo(() => {
    if (!searchQuery) return [];
    return tokens
      .filter(
        (token) =>
          token.baseToken.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.baseToken.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 5);
  }, [tokens, searchQuery]);

  // Handlers
  const handleCopy = useCallback((address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setToast("Copied to clipboard");
      setTimeout(() => setToast(""), 2000);
    });
  }, []);

  const toggleWatchlist = useCallback((pairAddress: string) => {
    setWatchlist((prev) => {
      const newWatchlist = prev.includes(pairAddress)
        ? prev.filter((id) => id !== pairAddress)
        : [...prev, pairAddress];
      localStorage.setItem("watchlist", JSON.stringify(newWatchlist));
      return newWatchlist;
    });
  }, []);

  const exportToCSV = useCallback(() => {
    const headers = [
      "Rank",
      "Pool",
      "Price",
      "Age",
      "TXN",
      "1H",
      "6H",
      "24H",
      "Volume",
      "Liquidity",
      "Market Cap",
      "FDV",
      "Address",
    ];
    const rows = sortedTokens.map((token, index) => [
      index + 1,
      `${token.baseToken.name} / ${token.quoteToken.symbol}`,
      Number(token.priceUsd).toFixed(5),
      getAge(token.pairCreatedAt),
      getTxns24h(token),
      token.priceChange?.h1?.toFixed(2) ?? "N/A",
      token.priceChange?.h6?.toFixed(2) ?? "N/A",
      token.priceChange?.h24?.toFixed(2) ?? "N/A",
      token.volume.h24.toLocaleString(),
      token.liquidity.usd.toLocaleString(),
      token.marketCap?.toLocaleString() ?? "N/A",
      token.fdv?.toLocaleString() ?? "N/A",
      token.baseToken.address,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "token-scanner.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  }, [sortedTokens]);

  async function handleSubmitListing(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch("/api/submit-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenSymbol, tokenAddress, tokenLogo }),
      });
      if (response.ok) {
        setSubmissionSuccess(true);
      } else {
        throw new Error("Submission failed");
      }
    } catch (err) {
      console.error(err);
      setToast("Submission error. Please try again.");
      setTimeout(() => setToast(""), 2000);
    }
  }

  function closeModal() {
    setShowModal(false);
    setSubmissionSuccess(false);
    setTokenSymbol("");
    setTokenAddress("");
    setTokenLogo("");
  }

  function handleBoostInfo() {
    alert(
      "Boost Info:\n\nSome tokens pay for extra visibility. The higher the boost, the bigger the bump to the final trending score!"
    );
  }

  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => {
      setSearchQuery(value);
    }, 300),
    []
  );

  const indexOfLastToken = currentPage * pageSize;
  const indexOfFirstToken = indexOfLastToken - pageSize;
  const currentTokens = sortedTokens.slice(indexOfFirstToken, indexOfLastToken);
  const totalPages = Math.ceil(sortedTokens.length / pageSize);

  function handleFilterChange(filter: string) {
    if (sortFilter === filter) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortFilter(filter);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  }

  // Render
  return (
    <div className="w-screen h-screen bg-black text-white font-mono m-0 p-0 overflow-hidden">
      {toast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded shadow">
          {toast}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-white text-black p-6 rounded shadow-lg w-80">
            <button
              onClick={closeModal}
              className="absolute top-2 right-2 text-xl font-bold"
            >
              ×
            </button>
            {!submissionSuccess ? (
              <>
                <h2 className="text-xl font-bold mb-4">Submit Token Listing</h2>
                <form onSubmit={handleSubmitListing}>
                  <div className="mb-4">
                    <label className="block mb-1">Token Symbol</label>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      className="w-full border border-gray-300 p-2 rounded"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block mb-1">Token Address</label>
                    <input
                      type="text"
                      value={tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                      className="w-full border border-gray-300 p-2 rounded"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block mb-1">Logo URL</label>
                    <input
                      type="text"
                      value={tokenLogo}
                      onChange={(e) => setTokenLogo(e.target.value)}
                      className="w-full border border-gray-300 p-2 rounded"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="bg-gray-300 hover:bg-gray-400 text-black py-2 px-4 rounded"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      type="submit"
                      className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                    >
                      Submit
                    </motion.button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center">
                <h2 className="text-xl font-bold mb-4">Token Listing Submitted!</h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={closeModal}
                  className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded"
                >
                  Close
                </motion.button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col w-full h-full">
        <div className="sticky top-0 z-50 bg-[#0060FF] shadow-md w-full">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between px-2 py-2 space-y-1 sm:space-y-0">
            <div className="flex flex-row items-center space-x-2">
              <motion.span className="text-green-400 animate-pulse" title="Live Pulse">
                ●
              </motion.span>
              <div className="text-xs sm:text-base text-white font-mono">
                Live {viewerCount} Traders Screening...
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="relative w-full sm:w-auto">
                <div className="flex items-center bg-gray-800 rounded px-2 py-2 w-full sm:w-48">
                  <FaSearch className="text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search tokens..."
                    onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                    onFocus={() => setShowSearchDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                    className="bg-transparent text-white focus:outline-none text-sm w-full p-1 touch-friendly"
                  />
                </div>
                {showSearchDropdown && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-gray-900 rounded shadow-lg z-50 max-h-60 overflow-y-auto">
                    {searchSuggestions.map((token) => (
                      <Link
                        key={token.pairAddress}
                        href={`/token-scanner/${token.pairAddress}/chart`}
                        onClick={() => {
                          setSearchQuery("");
                          setShowSearchDropdown(false);
                        }}
                      >
                        <div className="flex items-center space-x-2 p-3 hover:bg-gray-800 cursor-pointer">
                          <img
                            src={token.info?.imageUrl || "/fallback.png"}
                            alt={token.baseToken.symbol}
                            className="w-6 h-6 rounded-full"
                          />
                          <span className="text-sm">
                            {token.baseToken.name} / {token.quoteToken.symbol} (
                            {token.baseToken.symbol})
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleBoostInfo}
                className="text-white text-xs sm:text-base font-mono whitespace-nowrap"
              >
                [Boost info]
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setShowModal(true)}
                className="text-white text-xs sm:text-base font-mono whitespace-nowrap"
              >
                [Submit Listing]
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => router.back()}
                className="text-white text-xs sm:text-base font-mono whitespace-nowrap"
              >
                [Return]
              </motion.button>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 p-2 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <input
              type="number"
              placeholder="Min Liquidity ($)"
              value={filters.minLiquidity || ""}
              onChange={(e) => setFilters({ ...filters, minLiquidity: Number(e.target.value) })}
              className="p-2 bg-gray-800 text-white border border-gray-700 rounded text-xs sm:text-sm w-full sm:w-auto"
            />
            <input
              type="number"
              placeholder="Min Volume ($)"
              value={filters.minVolume || ""}
              onChange={(e) => setFilters({ ...filters, minVolume: Number(e.target.value) })}
              className="p-2 bg-gray-800 text-white border border-gray-700 rounded text-xs sm:text-sm w-full sm:w-auto"
            />
            <input
              type="number"
              placeholder="Min Age (days)"
              value={filters.minAge || ""}
              onChange={(e) => setFilters({ ...filters, minAge: Number(e.target.value) })}
              className="p-2 bg-gray-800 text-white border border-gray-700 rounded text-xs sm:text-sm w-full sm:w-auto"
            />
            <input
              type="number"
              placeholder="Max Age (days)"
              value={filters.maxAge === Infinity ? "" : filters.maxAge}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  maxAge: e.target.value ? Number(e.target.value) : Infinity,
                })
              }
              className="p-2 bg-gray-800 text-white border border-gray-700 rounded text-xs sm:text-sm w-full sm:w-auto"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={exportToCSV}
            className="p-2 bg-[#0052FF] hover:bg-[#0042CC] text-white rounded flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto justify-center"
          >
            <FaDownload /> Export CSV
          </motion.button>
        </div>

        <div className="flex-1 flex flex-col overflow-x-auto overflow-y-auto">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <table className="table-auto w-full whitespace-nowrap text-sm">
              <thead className="bg-gray-900 text-gray-300 sticky top-0 z-10">
                <tr>
                  <th
                    className="p-2 text-left cursor-pointer w-[150px]"
                    onClick={() => handleFilterChange("trending")}
                    title="Sort by trending score"
                  >
                    #{sortFilter === "trending" && (sortDirection === "desc" ? " ↓" : " ↑")}
                  </th>
                  <th className="p-2 text-left" title="Token Pair">
                    POOL
                  </th>
                  <th className="p-2 text-right" title="Price in USD">
                    PRICE
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer"
                    onClick={() => handleFilterChange("age")}
                    title="Age of the token pair"
                  >
                    AGE{sortFilter === "age" && (sortDirection === "desc" ? " ↓" : " ↑")}
                  </th>
                  <th className="p-2 text-right" title="Total transactions in 24 hours">
                    TXN
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer"
                    onClick={() => handleFilterChange("1h")}
                    title="Price change in last 1 hour"
                  >
                    1H{sortFilter === "1h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer"
                    onClick={() => handleFilterChange("6h")}
                    title="Price change in last 6 hours"
                  >
                    6H{sortFilter === "6h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer"
                    onClick={() => handleFilterChange("24h")}
                    title="Price change in last 24 hours"
                  >
                    24H{sortFilter === "24h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer"
                    onClick={() => handleFilterChange("volume")}
                    title="Trading volume in last 24 hours"
                  >
                    VOLUME{sortFilter === "volume" && (sortDirection === "desc" ? " ↓" : " ↑")}
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer"
                    onClick={() => handleFilterChange("liquidity")}
                    title="Liquidity in USD"
                  >
                    LIQUIDITY{sortFilter === "liquidity" && (sortDirection === "desc" ? " ↓" : " ↑")}
                  </th>
                  <th
                    className="p-2 text-right cursor-pointer"
                    onClick={() => handleFilterChange("marketCap")}
                    title="Market Capitalization"
                  >
                    MCAP{sortFilter === "marketCap" && (sortDirection === "desc" ? " ↓" : " ↑")}
                  </th>
                  <th className="p-2 text-right" title="Fully Diluted Valuation">
                    FDV
                  </th>
                  <th className="p-2 text-right" title="Token Address">
                    Address
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: pageSize }).map((_, idx) => (
                    <tr key={idx} className="border-b border-gray-700">
                      <td colSpan={13} className="p-2">
                        <div className="animate-pulse flex space-x-4">
                          <div className="rounded-full bg-gray-700 h-10 w-10"></div>
                          <div className="flex-1 space-y-4 py-1">
                            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                            <div className="space-y-2">
                              <div className="h-4 bg-gray-700 rounded"></div>
                              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  currentTokens.map((token, index) => {
                    const rank = index + 1 + (currentPage - 1) * pageSize;
                    const isTop3 = rank <= 3;
                    const trophyIcon = isTop3 && sortFilter === "trending" ? getTrophy(rank) : null;
                    const showMarketing = marketingRanks.has(rank);
                    const isBoosted = !!token.boosted;
                    const boostValue = token.boostValue || 0;
                    const isNew =
                      token.pairCreatedAt &&
                      Date.now() - token.pairCreatedAt < 24 * 60 * 60 * 1000;
                    const lowLiquidity = token.liquidity.usd < MIN_LIQUIDITY;

                    return (
                      <tr
                        key={token.pairAddress}
                        className="border-b border-gray-700 hover:bg-gray-800 transition-colors bg-gray-900"
                      >
                        <td className="p-2 text-left w-[150px]">
                          <div className="flex items-center space-x-2">
                            {isTop3 ? (
                              <span className="cursor-help font-bold w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full">
                                {trophyIcon}
                              </span>
                            ) : (
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 font-bold">
                                {rank}
                              </span>
                            )}
                            {isBoosted && (
                              <div
                                className="flex items-center space-x-1 cursor-help"
                                title={`Boosted (+${boostValue})`}
                              >
                                <span className="text-blue-400 font-bold text-sm">
                                  +{boostValue}
                                </span>
                                <FaBolt size={16} className="text-blue-400" />
                              </div>
                            )}
                            {showMarketing && <MarketingIcon />}
                            {isNew && (
                              <span
                                className="text-xs bg-green-500 text-black px-1 rounded"
                                title="Less than 24 hours old"
                              >
                                New
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <Link href={`/token-scanner/${token.pairAddress}/chart`}>
                            <div className="flex items-center space-x-2 cursor-pointer">
                              <img
                                src={token.info?.imageUrl || "/fallback.png"}
                                alt={token.baseToken.symbol}
                                className="w-5 h-5 rounded-full"
                              />
                              <div className="flex flex-col">
                                <span className="font-semibold">
                                  {token.baseToken.name} / {token.quoteToken.symbol}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {token.baseToken.symbol}
                                </span>
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="p-2 text-right">${Number(token.priceUsd).toFixed(5)}</td>
                        <td className="p-2 text-right">{getAge(token.pairCreatedAt)}</td>
                        <td className="p-2 text-right">{getTxns24h(token)}</td>
                        <td
                          className={`p-2 text-right ${getColorClass(
                            token.priceChange?.h1 ?? 0
                          )}`}
                        >
                          {token.priceChange?.h1 !== undefined
                            ? token.priceChange.h1.toFixed(2)
                            : "N/A"}
                          %
                        </td>
                        <td
                          className={`p-2 text-right ${getColorClass(
                            token.priceChange?.h6 ?? 0
                          )}`}
                        >
                          {token.priceChange?.h6 !== undefined
                            ? token.priceChange.h6.toFixed(2)
                            : "N/A"}
                          %
                        </td>
                        <td
                          className={`p-2 text-right ${getColorClass(
                            token.priceChange?.h24 ?? 0
                          )}`}
                        >
                          {token.priceChange?.h24 !== undefined
                            ? token.priceChange.h24.toFixed(2)
                            : "N/A"}
                          %
                        </td>
                        <td className="p-2 text-right">
                          ${token.volume.h24.toLocaleString()}
                        </td>
                        <td className={`p-2 text-right ${lowLiquidity ? "text-red-500" : ""}`}>
                          ${token.liquidity.usd.toLocaleString()}
                          {lowLiquidity && (
                            <span
                              className="ml-1 text-red-500"
                              title="Low liquidity warning"
                            >
                              ⚠️
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {token.marketCap
                            ? `$${token.marketCap.toLocaleString()}`
                            : "N/A"}
                        </td>
                        <td className="p-2 text-right">
                          {token.fdv ? `$${token.fdv.toLocaleString()}` : "N/A"}
                        </td>
                        <td className="p-2 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleWatchlist(token.pairAddress)}
                            className="text-yellow-400 hover:text-yellow-500"
                            title={
                              watchlist.includes(token.pairAddress)
                                ? "Remove from Watchlist"
                                : "Add to Watchlist"
                            }
                          >
                            <FaStar
                              size={16}
                              className={
                                watchlist.includes(token.pairAddress) ? "fill-current" : ""
                              }
                            />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(token.baseToken.address);
                            }}
                            className="bg-gray-700 hover:bg-gray-600 text-xs sm:text-sm text-white py-1 px-2 rounded"
                            title="Copy address"
                          >
                            📋
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden p-2">
            {loading ? (
              Array.from({ length: pageSize }).map((_, idx) => (
                <div
                  key={idx}
                  className="animate-pulse bg-gray-900 p-3 rounded-lg mb-2"
                >
                  <div className="flex space-x-3">
                    <div className="rounded-full bg-gray-700 h-8 w-8"></div>
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-700 rounded"></div>
                        <div className="h-3 bg-gray-700 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              currentTokens.map((token, index) => {
                const rank = index + 1 + (currentPage - 1) * pageSize;
                const isTop3 = rank <= 3;
                const trophyIcon = isTop3 && sortFilter === "trending" ? getTrophy(rank) : null;
                const showMarketing = marketingRanks.has(rank);
                const isBoosted = !!token.boosted;
                const boostValue = token.boostValue || 0;
                const isNew =
                  token.pairCreatedAt &&
                  Date.now() - token.pairCreatedAt < 24 * 60 * 60 * 1000;
                const lowLiquidity = token.liquidity.usd < MIN_LIQUIDITY;

                return (
                  <div
                    key={token.pairAddress}
                    className="bg-gray-900 p-3 rounded-lg mb-2 border border-gray-700"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center space-x-2">
                        {isTop3 ? (
                          <span className="cursor-help font-bold w-6 h-6 flex items-center justify-center bg-gray-700 rounded-full text-xs">
                            {trophyIcon}
                          </span>
                        ) : (
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-700 font-bold text-xs">
                            {rank}
                          </span>
                        )}
                        {isBoosted && (
                          <div
                            className="flex items-center space-x-1 cursor-help"
                            title={`Boosted (+${boostValue})`}
                          >
                            <span className="text-blue-400 font-bold text-xs">
                              +{boostValue}
                            </span>
                            <FaBolt size={12} className="text-blue-400" />
                          </div>
                        )}
                        {showMarketing && <MarketingIcon />}
                        {isNew && (
                          <span
                            className="text-xs bg-green-500 text-black px-1 rounded"
                            title="Less than 24 hours old"
                          >
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleWatchlist(token.pairAddress)}
                          className="text-yellow-400 hover:text-yellow-500"
                          title={
                            watchlist.includes(token.pairAddress)
                              ? "Remove from Watchlist"
                              : "Add to Watchlist"
                          }
                        >
                          <FaStar
                            size={14}
                            className={
                              watchlist.includes(token.pairAddress) ? "fill-current" : ""
                            }
                          />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(token.baseToken.address);
                          }}
                          className="bg-gray-700 hover:bg-gray-600 text-xs text-white py-1 px-2 rounded"
                          title="Copy address"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                    <Link href={`/token-scanner/${token.pairAddress}/chart`}>
                      <div className="flex items-center space-x-2 cursor-pointer mb-2">
                        <img
                          src={token.info?.imageUrl || "/fallback.png"}
                          alt={token.baseToken.symbol}
                          className="w-5 h-5 rounded-full"
                        />
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">
                            {token.baseToken.name} / {token.quoteToken.symbol}
                          </span>
                          <span className="text-xs text-gray-400">
                            {token.baseToken.symbol}
                          </span>
                        </div>
                      </div>
                    </Link>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">Price:</span>{" "}
                        ${Number(token.priceUsd).toFixed(5)}
                      </div>
                      <div>
                        <span className="text-gray-400">Age:</span>{" "}
                        {getAge(token.pairCreatedAt)}
                      </div>
                      <div>
                        <span className="text-gray-400">TXN:</span> {getTxns24h(token)}
                      </div>
                      <div>
                        <span className="text-gray-400">1H:</span>{" "}
                        <span className={getColorClass(token.priceChange?.h1 ?? 0)}>
                          {token.priceChange?.h1?.toFixed(2) ?? "N/A"}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">6H:</span>{" "}
                        <span className={getColorClass(token.priceChange?.h6 ?? 0)}>
                          {token.priceChange?.h6?.toFixed(2) ?? "N/A"}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">24H:</span>{" "}
                        <span className={getColorClass(token.priceChange?.h24 ?? 0)}>
                          {token.priceChange?.h24?.toFixed(2) ?? "N/A"}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Volume:</span>{" "}
                        ${token.volume.h24.toLocaleString()}
                      </div>
                      <div>
                        <span className="text-gray-400">Liquidity:</span>{" "}
                        <span className={lowLiquidity ? "text-red-500" : ""}>
                          ${token.liquidity.usd.toLocaleString()}
                          {lowLiquidity && (
                            <span
                              className="ml-1 text-red-500"
                              title="Low liquidity warning"
                            >
                              ⚠️
                            </span>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Market Cap:</span>{" "}
                        {token.marketCap
                          ? `$${token.marketCap.toLocaleString()}`
                          : "N/A"}
                      </div>
                      <div>
                        <span className="text-gray-400">FDV:</span>{" "}
                        {token.fdv ? `$${token.fdv.toLocaleString()}` : "N/A"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-center py-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 sm:px-4 sm:py-2 bg-[#0052FF] hover:bg-[#0042CC] text-white rounded-md transition transform hover:scale-105 disabled:opacity-50 text-xs sm:text-sm"
            >
              ← Prev
            </button>
            <span className="mx-2 text-white text-xs sm:text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 sm:px-4 sm:py-2 bg-[#0052FF] hover:bg-[#0042CC] text-white rounded-md transition transform hover:scale-105 disabled:opacity-50 text-xs sm:text-sm"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Inline CSS for Mobile Optimization */}
      <style jsx>{`
        .touch-friendly {
          min-height: 44px; /* Minimum touch target size for mobile */
          padding: 8px;
        }
        @media (max-width: 768px) {
          .search-bar {
            width: 100%;
            margin: 10px 0;
          }
          .search-button {
            padding: 12px 20px;
            min-width: 100px;
          }
        }
      `}</style>
    </div>
  );
}