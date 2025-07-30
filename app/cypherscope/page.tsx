"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import Header from "../components/Header";

// Icons

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg className="w-4 h-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);



const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Tag logic functions
function getTokenTags(token: {
  marketCap?: string;
  volume24h?: string;
  uniqueHolders?: string;
  liquidity?: { usd?: string };
}) {
  const tags: string[] = [];
  
  const marketCap = parseFloat(token.marketCap || "0");
  const volume = parseFloat(token.volume24h || "0");
  const holders = parseInt(token.uniqueHolders || "0");
  const liquidity = parseFloat(token.liquidity?.usd || "0");
  
  // DEXPAID tag - if market cap > $100K (simulating paid promotion)
  if (marketCap > 100000) {
    tags.push("DEXPAID");
  }
  
  // RUNNER tag - if volume > $50K in 24h
  if (volume > 50000) {
    tags.push("RUNNER");
  }
  
  // HIGH_CAP tag - if market cap > $1M
  if (marketCap > 1000000) {
    tags.push("HIGH_CAP");
  }
  
  // TRENDING tag - if holders > 1000
  if (holders > 1000) {
    tags.push("TRENDING");
  }
  
  // LIQUIDITY tag - if liquidity > $100K
  if (liquidity > 100000) {
    tags.push("LIQUIDITY");
  }
  
  // MOONSHOT tag - if market cap < $100K but volume > $10K
  if (marketCap < 100000 && volume > 10000) {
    tags.push("MOONSHOT");
  }
  
  // ESTABLISHED tag - if market cap > $10M
  if (marketCap > 10000000) {
    tags.push("ESTABLISHED");
  }
  
  // VOLUME_SPIKE tag - if volume > $100K
  if (volume > 100000) {
    tags.push("VOLUME_SPIKE");
  }
  
  return tags;
}

function formatNumber(num: string | number | undefined) {
  if (!num) return "-";
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n)) return "-";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function getValueColor(value: string | number | undefined, type: 'marketCap' | 'volume' = 'marketCap') {
  if (!value) return "text-gray-400";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "text-gray-400";
  
  if (type === 'marketCap') {
    if (n >= 1000000) return "text-green-400"; // High cap = green
    if (n >= 100000) return "text-green-300";  // Medium cap = green
    return "text-red-400"; // Low cap = red
  } else {
    if (n >= 100000) return "text-green-400"; // High volume = green
    if (n >= 50000) return "text-green-300";  // Medium volume = green
    return "text-red-400"; // Low volume = red
  }
}



function getAgeFromTimestamp(timestamp: string) {
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return "Just now";
}

const TagBadge = ({ tag }: { tag: string }) => {
  const tagColors: { [key: string]: string } = {
    DEXPAID: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    RUNNER: "bg-green-500/20 text-green-300 border-green-500/30",
    HIGH_CAP: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    TRENDING: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    LIQUIDITY: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    MOONSHOT: "bg-red-500/20 text-red-300 border-red-500/30",
    ESTABLISHED: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    VOLUME_SPIKE: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  };
  
  return (
    <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full border min-w-[80px] text-center ${tagColors[tag] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}>
      {tag}
    </span>
  );
};

export default function CypherscopePage() {
  const [tokens, setTokens] = useState<Array<{
    id: string;
    name: string;
    symbol: string;
    address: string;
    marketCap?: string;
    volume24h?: string;
    uniqueHolders?: string;
    liquidity?: { usd?: string };
    createdAt?: string;
    tags: string[];
    mediaContent?: { previewImage?: string };
    [key: string]: unknown;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState("");
  const [selectedDex, setSelectedDex] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [minMarketCap, setMinMarketCap] = useState("");
  const [maxMarketCap, setMaxMarketCap] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [maxVolume, setMaxVolume] = useState("");

  const [minHolders, setMinHolders] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  
  // Sorting
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  // UI State
  const [selectedToken, setSelectedToken] = useState<{
    id: string;
    name: string;
    symbol: string;
    address: string;
    marketCap?: string;
    volume24h?: string;
    uniqueHolders?: string;
    liquidity?: { usd?: string };
    createdAt?: string;
    tags: string[];
    mediaContent?: { previewImage?: string };
    [key: string]: unknown;
  } | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  
  // Load watchlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("cypherscope-watchlist");
    if (saved) {
      setWatchlist(JSON.parse(saved));
    }
  }, []);
  
  // Save watchlist to localStorage
  const toggleWatchlist = (address: string) => {
    const newWatchlist = watchlist.includes(address)
      ? watchlist.filter(addr => addr !== address)
      : [...watchlist, address];
    setWatchlist(newWatchlist);
    localStorage.setItem("cypherscope-watchlist", JSON.stringify(newWatchlist));
  };

  useEffect(() => {
    async function fetchTokens() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/cypherscope-tokens");
        const data = await res.json();
        // Add tags to each token
        const tokensWithTags = (data.tokens || []).map((token: unknown) => {
          const typedToken = token as { 
            id: string; 
            name: string; 
            symbol: string; 
            address: string; 
            marketCap?: string; 
            volume24h?: string; 
            uniqueHolders?: string; 
            liquidity?: { usd?: string }; 
            createdAt?: string; 
            mediaContent?: { previewImage?: string };
          };
          return {
            ...typedToken,
            tags: getTokenTags(typedToken)
          };
        }) as Array<{
          id: string;
          name: string;
          symbol: string;
          address: string;
          marketCap?: string;
          volume24h?: string;
          uniqueHolders?: string;
          liquidity?: { usd?: string };
          createdAt?: string;
          tags: string[];
          mediaContent?: { previewImage?: string };
          [key: string]: unknown;
        }>;
        setTokens(tokensWithTags);
      } catch {
        setError("Failed to fetch tokens.");
      } finally {
        setLoading(false);
      }
    }
    fetchTokens();
  }, []);

  // Filtering and sorting
  const filteredAndSortedTokens = tokens
    .filter((token) => {
      const matchesSearch =
        token.name?.toLowerCase().includes(search.toLowerCase()) ||
        token.symbol?.toLowerCase().includes(search.toLowerCase()) ||
        token.address?.toLowerCase().includes(search.toLowerCase());
      
      const marketCap = parseFloat(token.marketCap || "0");
      const volume = parseFloat(token.volume24h || "0");
      const holders = parseInt(token.uniqueHolders || "0");
      
      const minCap = parseFloat(minMarketCap || "0");
      const maxCap = parseFloat(maxMarketCap || "999999999999");
      const minVol = parseFloat(minVolume || "0");
      const maxVol = parseFloat(maxVolume || "999999999999");
      const minHold = parseInt(minHolders || "0");
      
      // Age filter
      let matchesAge = true;
      if (ageFilter && token.createdAt) {
        const created = new Date(token.createdAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
        
        switch (ageFilter) {
          case "1h": matchesAge = hoursDiff <= 1; break;
          case "6h": matchesAge = hoursDiff <= 6; break;
          case "24h": matchesAge = hoursDiff <= 24; break;
          case "3d": matchesAge = hoursDiff <= 72; break;
        }
      }
      
      // Tag filter
      let matchesTag = true;
      if (selectedTag && token.tags) {
        matchesTag = token.tags.includes(selectedTag);
      }
      
      // DEX filter
      let matchesDex = true;
      if (selectedDex) {
        // For now, we'll assume all tokens are from the same DEX since we don't have DEX info
        // This can be enhanced later when we have actual DEX data
        matchesDex = true; // Placeholder - will be implemented when we have DEX data
      }
      
      const result = (
        matchesSearch &&
        matchesAge &&
        matchesTag &&
        matchesDex &&
        marketCap >= minCap && marketCap <= maxCap &&
        volume >= minVol && volume <= maxVol &&

        holders >= minHold
      );
      
      // Debug logging to see which tokens are being filtered out
      if (!result) {
        console.log(`Token ${token.name || token.symbol || token.address} filtered out:`, {
          matchesSearch,
          matchesAge,
          matchesTag,
          matchesDex,
          marketCap,
          minCap,
          maxCap,
          volume,
          minVol,
          maxVol,

          holders,
          minHold
        });
      }
      
      return result;
    })
    .sort((a, b) => {
      let aVal: number | Date, bVal: number | Date;
      
      switch (sortBy) {
        case "createdAt":
          aVal = new Date(a.createdAt || 0);
          bVal = new Date(b.createdAt || 0);
          break;
        case "marketCap":
          aVal = parseFloat(a.marketCap || "0");
          bVal = parseFloat(b.marketCap || "0");
          break;
        case "volume24h":
          aVal = parseFloat(a.volume24h || "0");
          bVal = parseFloat(b.volume24h || "0");
          break;
        case "uniqueHolders":
          aVal = parseInt(a.uniqueHolders || "0");
          bVal = parseInt(b.uniqueHolders || "0");
          break;
        default:
          aVal = parseFloat(String(a[sortBy] || "0"));
          bVal = parseFloat(String(b[sortBy] || "0"));
      }
      
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });



  const TokenModal = ({ token, onClose }: { 
    token: {
      id: string;
      name: string;
      symbol: string;
      address: string;
      marketCap?: string;
      volume24h?: string;
      uniqueHolders?: string;
      liquidity?: { usd?: string };
      createdAt?: string;
      tags: string[];
      mediaContent?: { previewImage?: string };
      [key: string]: unknown;
    }; 
    onClose: () => void 
  }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <Image
                src={token.mediaContent?.previewImage?.small || "https://i.imgur.com/mlPQazY.png"}
                alt={token.symbol || "Token"}
                width={64}
                height={64}
                className="rounded-full bg-blue-900"
              />
              <div>
                <h2 className="text-2xl font-bold text-blue-200">{token.name}</h2>
                <p className="text-gray-400">{token.symbol}</p>
                <p className="text-xs text-gray-500">{token.address}</p>
                {token.tags && token.tags.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {token.tags.map((tag: string) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <CloseIcon />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-400">Market Cap</div>
              <div className="text-lg font-bold text-blue-300">{formatNumber(token.marketCap)}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-400">24h Volume</div>
              <div className="text-lg font-bold text-blue-300">{formatNumber(token.volume24h)}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-400">Holders</div>
              <div className="text-lg font-bold text-blue-300">{token.uniqueHolders?.toLocaleString() || "-"}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-400">Created</div>
              <div className="text-lg font-bold text-blue-300">{token.createdAt ? getAgeFromTimestamp(token.createdAt) : "Unknown"}</div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <a
              href={`https://dexscreener.com/base/${token.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-center transition"
            >
              View on DexScreener
            </a>
            <a
              href={`https://baseswap.fi/swap?inputCurrency=0x4200000000000000000000000000000000000006&outputCurrency=${token.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-center transition"
            >
              Buy on BaseSwap
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-gray-900/90 border border-blue-500/10 rounded-2xl p-5 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-2/3"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );

  // Helper function to get tokens by tag
  const getTokensByTag = (tag: string) => {
    return filteredAndSortedTokens.filter(token => token.tags?.includes(tag)).slice(0, 6);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-gray-950 to-blue-900 text-gray-200 font-sans">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Enhanced Filters */}
        <div className="mb-8 bg-gradient-to-r from-gray-900/90 to-gray-800/90 rounded-2xl p-6 border border-blue-500/10 shadow-xl">
          {/* Main Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Search Tokens</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, symbol, or address..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-800/50 border border-blue-500/20 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* DEX Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">DEX</label>
              <select
                value={selectedDex}
                onChange={(e) => setSelectedDex(e.target.value)}
                className="w-full bg-gray-800/50 border border-blue-500/20 rounded-xl px-4 py-3 text-gray-200 focus:border-blue-400 focus:outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All DEXes</option>
                <option value="Aerodrome">Aerodrome</option>
                <option value="BaseSwap">BaseSwap</option>
                <option value="UniswapV2">Uniswap V2</option>
              </select>
            </div>
            
            {/* Tag Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Tag</label>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full bg-gray-800/50 border border-blue-500/20 rounded-xl px-4 py-3 text-gray-200 focus:border-blue-400 focus:outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Tags</option>
                <option value="DEXPAID">DEX Paid</option>
                <option value="RUNNER">Runner</option>
                <option value="HIGH_CAP">High Cap</option>
                <option value="TRENDING">Trending</option>
                <option value="LIQUIDITY">Liquidity</option>
                <option value="MOONSHOT">Moonshot</option>
                <option value="ESTABLISHED">Established</option>
                <option value="VOLUME_SPIKE">Volume Spike</option>
              </select>
            </div>
          </div>
          
          {/* Secondary Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* Age Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Age</label>
              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                className="w-full bg-gray-800/50 border border-blue-500/20 rounded-xl px-4 py-3 text-gray-200 focus:border-blue-400 focus:outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Any time</option>
                <option value="1h">Last hour</option>
                <option value="6h">Last 6 hours</option>
                <option value="24h">Last 24 hours</option>
                <option value="3d">Last 3 days</option>
              </select>
            </div>
            
            {/* Market Cap Range */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Market Cap ($)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minMarketCap}
                  onChange={(e) => setMinMarketCap(e.target.value)}
                  className="flex-1 bg-gray-800/50 border border-blue-500/20 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-400 focus:outline-none transition-all duration-200"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxMarketCap}
                  onChange={(e) => setMaxMarketCap(e.target.value)}
                  className="flex-1 bg-gray-800/50 border border-blue-500/20 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-400 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>
            
            {/* Volume Range */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Volume ($)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minVolume}
                  onChange={(e) => setMinVolume(e.target.value)}
                  className="flex-1 bg-gray-800/50 border border-blue-500/20 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-400 focus:outline-none transition-all duration-200"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxVolume}
                  onChange={(e) => setMaxVolume(e.target.value)}
                  className="flex-1 bg-gray-800/50 border border-blue-500/20 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-400 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>
            
            {/* Min Holders */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Min Holders</label>
              <input
                type="number"
                placeholder="Min holders"
                value={minHolders}
                onChange={(e) => setMinHolders(e.target.value)}
                className="w-full bg-gray-800/50 border border-blue-500/20 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-500 focus:border-blue-400 focus:outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            
            {/* Sort By */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-gray-800/50 border border-blue-500/20 rounded-xl px-4 py-3 text-gray-200 focus:border-blue-400 focus:outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="createdAt">Age</option>
                <option value="marketCap">Market Cap</option>
                <option value="volume24h">Volume</option>
                <option value="uniqueHolders">Holders</option>
              </select>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t border-gray-700/50">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedDex("");
                  setAgeFilter("");
                  setSelectedTag("");
                  setMinMarketCap("");
                  setMaxMarketCap("");
                  setMinVolume("");
                  setMaxVolume("");

                  setMinHolders("");
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/30 hover:border-gray-500/50 rounded-xl text-sm font-semibold transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Clear Filters
              </button>
              
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-400">
                  {filteredAndSortedTokens.length} of {tokens.length} tokens
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Sort Order:</span>
              <button
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  sortOrder === "desc" 
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/30" 
                    : "bg-gray-700/50 text-gray-300 border border-gray-600/30 hover:bg-gray-600/50"
                }`}
              >
                {sortOrder === "desc" ? "↓ Descending" : "↑ Ascending"}
              </button>
            </div>
          </div>
        </div>

        {/* Results with Sections */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-400 text-lg mb-2">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-8">
                        {/* DEX Paid Section */}
            {getTokensByTag("DEXPAID").length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-yellow-400 rounded-full"></div>
                  <h2 className="text-2xl font-bold text-yellow-200">DEX Paid</h2>
                  <div className="flex-1 h-px bg-gray-700"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getTokensByTag("DEXPAID").map((token) => (
                    <div
                      key={token.address}
                      className="bg-gray-900/90 border border-yellow-500/10 rounded-2xl shadow-lg p-5 hover:border-yellow-400 transition group cursor-pointer flex flex-col h-full"
                      onClick={() => setSelectedToken(token)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Image
                            src={token.mediaContent?.previewImage?.small || "https://i.imgur.com/mlPQazY.png"}
                            alt={token.symbol || "Token"}
                            width={48}
                            height={48}
                            className="rounded-full bg-yellow-900"
                          />
                          <div>
                            <div className="font-bold text-yellow-200 group-hover:text-yellow-100 transition">
                              {token.name || "Unknown"}
                            </div>
                            <div className="text-sm text-gray-400">{token.symbol}</div>
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(token.address);
                          }}
                          className={`p-2 rounded-lg transition ${
                            watchlist.includes(token.address)
                              ? "text-yellow-400 hover:text-yellow-300"
                              : "text-gray-400 hover:text-yellow-400"
                          }`}
                        >
                          <StarIcon filled={watchlist.includes(token.address)} />
                        </button>
                      </div>
                      
                      <div className="text-xs text-gray-500 mb-3 font-mono">
                        {token.address?.slice(0, 6)}...{token.address?.slice(-4)}
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Market Cap</span>
                          <span className={`font-semibold ${getValueColor(token.marketCap, 'marketCap')}`}>{formatNumber(token.marketCap)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">24h Volume</span>
                          <span className={`font-semibold ${getValueColor(token.volume24h, 'volume')}`}>{formatNumber(token.volume24h)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Holders</span>
                          <span className="text-yellow-300 font-semibold">{token.uniqueHolders?.toLocaleString() || "-"}</span>
                        </div>
                        {token.createdAt && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Age</span>
                            <span className="text-yellow-300 font-semibold">{getAgeFromTimestamp(token.createdAt)}</span>
                          </div>
                        )}
                      </div>
                      
                      {token.tags && token.tags.length > 0 && (
                        <div className="flex gap-1 mb-3 flex-wrap">
                          {token.tags.map((tag: string) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-auto">
                        <a
                          href={`https://dexscreener.com/base/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold text-center transition-all duration-200"
                        >
                          Chart
                        </a>
                        <a
                          href={`https://baseswap.fi/swap?inputCurrency=0x4200000000000000000000000000000000000006&outputCurrency=${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold text-center transition-all duration-200"
                        >
                          Quick Buy
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

                        {/* Runners Section */}
            {getTokensByTag("RUNNER").length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-green-400 rounded-full"></div>
                  <h2 className="text-2xl font-bold text-green-200">Runners</h2>
                  <div className="flex-1 h-px bg-gray-700"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getTokensByTag("RUNNER").map((token) => (
                    <div
                      key={token.address}
                      className="bg-gray-900/90 border border-green-500/10 rounded-2xl shadow-lg p-5 hover:border-green-400 transition group cursor-pointer flex flex-col h-full"
                      onClick={() => setSelectedToken(token)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Image
                            src={token.mediaContent?.previewImage?.small || "https://i.imgur.com/mlPQazY.png"}
                            alt={token.symbol || "Token"}
                            width={48}
                            height={48}
                            className="rounded-full bg-green-900"
                          />
                          <div>
                            <div className="font-bold text-green-200 group-hover:text-green-100 transition">
                              {token.name || "Unknown"}
                            </div>
                            <div className="text-sm text-gray-400">{token.symbol}</div>
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(token.address);
                          }}
                          className={`p-2 rounded-lg transition ${
                            watchlist.includes(token.address)
                              ? "text-yellow-400 hover:text-yellow-300"
                              : "text-gray-400 hover:text-yellow-400"
                          }`}
                        >
                          <StarIcon filled={watchlist.includes(token.address)} />
                        </button>
                      </div>
                      
                      <div className="text-xs text-gray-500 mb-3 font-mono">
                        {token.address?.slice(0, 6)}...{token.address?.slice(-4)}
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Market Cap</span>
                          <span className={`font-semibold ${getValueColor(token.marketCap, 'marketCap')}`}>{formatNumber(token.marketCap)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">24h Volume</span>
                          <span className={`font-semibold ${getValueColor(token.volume24h, 'volume')}`}>{formatNumber(token.volume24h)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Holders</span>
                          <span className="text-green-300 font-semibold">{token.uniqueHolders?.toLocaleString() || "-"}</span>
                        </div>
                        {token.createdAt && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Age</span>
                            <span className="text-green-300 font-semibold">{getAgeFromTimestamp(token.createdAt)}</span>
                          </div>
                        )}
                      </div>
                      
                      {token.tags && token.tags.length > 0 && (
                        <div className="flex gap-1 mb-3 flex-wrap">
                          {token.tags.map((tag: string) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-auto">
                        <a
                          href={`https://dexscreener.com/base/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold text-center transition-all duration-200"
                        >
                          Chart
                        </a>
                        <a
                          href={`https://baseswap.fi/swap?inputCurrency=0x4200000000000000000000000000000000000006&outputCurrency=${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold text-center transition-all duration-200"
                        >
                          Quick Buy
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

                        {/* Moonshots Section */}
            {getTokensByTag("MOONSHOT").length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-red-400 rounded-full"></div>
                  <h2 className="text-2xl font-bold text-red-200">Moonshots</h2>
                  <div className="flex-1 h-px bg-gray-700"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getTokensByTag("MOONSHOT").map((token) => (
                    <div
                      key={token.address}
                      className="bg-gray-900/90 border border-red-500/10 rounded-2xl shadow-lg p-5 hover:border-red-400 transition group cursor-pointer flex flex-col h-full"
                      onClick={() => setSelectedToken(token)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Image
                            src={token.mediaContent?.previewImage?.small || "https://i.imgur.com/mlPQazY.png"}
                            alt={token.symbol || "Token"}
                            width={48}
                            height={48}
                            className="rounded-full bg-red-900"
                          />
                          <div>
                            <div className="font-bold text-red-200 group-hover:text-red-100 transition">
                              {token.name || "Unknown"}
                            </div>
                            <div className="text-sm text-gray-400">{token.symbol}</div>
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(token.address);
                          }}
                          className={`p-2 rounded-lg transition ${
                            watchlist.includes(token.address)
                              ? "text-yellow-400 hover:text-yellow-300"
                              : "text-gray-400 hover:text-yellow-400"
                          }`}
                        >
                          <StarIcon filled={watchlist.includes(token.address)} />
                        </button>
                      </div>
                      
                      <div className="text-xs text-gray-500 mb-3 font-mono">
                        {token.address?.slice(0, 6)}...{token.address?.slice(-4)}
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Market Cap</span>
                          <span className={`font-semibold ${getValueColor(token.marketCap, 'marketCap')}`}>{formatNumber(token.marketCap)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">24h Volume</span>
                          <span className={`font-semibold ${getValueColor(token.volume24h, 'volume')}`}>{formatNumber(token.volume24h)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Holders</span>
                          <span className="text-red-300 font-semibold">{token.uniqueHolders?.toLocaleString() || "-"}</span>
                        </div>
                        {token.createdAt && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Age</span>
                            <span className="text-red-300 font-semibold">{getAgeFromTimestamp(token.createdAt)}</span>
                          </div>
                        )}
                      </div>
                      
                      {token.tags && token.tags.length > 0 && (
                        <div className="flex gap-1 mb-3 flex-wrap">
                          {token.tags.map((tag: string) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-auto">
                        <a
                          href={`https://dexscreener.com/base/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold text-center transition-all duration-200"
                        >
                          Chart
                        </a>
                        <a
                          href={`https://baseswap.fi/swap?inputCurrency=0x4200000000000000000000000000000000000006&outputCurrency=${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold text-center transition-all duration-200"
                        >
                          Quick Buy
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {filteredAndSortedTokens.length === 0 && !loading && !error && (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg mb-2">No tokens found</div>
                <div className="text-gray-400 text-sm">Try adjusting your filters</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Token Modal */}
      {selectedToken && (
        <TokenModal
          token={selectedToken}
          onClose={() => setSelectedToken(null)}
        />
      )}
    </div>
  );
} 