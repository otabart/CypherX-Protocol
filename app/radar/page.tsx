"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useLoading, PageLoader } from "../components/LoadingProvider";

// Icons
const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg className="w-4 h-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);



// Tag logic functions
function getTokenTags(token: {
  marketCap?: string | number;
  volume24h?: string | number;
  uniqueHolders?: string | number;
  liquidity?: { usd?: string | number };
  marketCapDelta24h?: string | number;
  createdAt?: string;
  tags?: string[];
}) {
  const tags: string[] = [];
  
  // If token already has tags from API, use them
  if (token.tags && token.tags.length > 0) {
    return token.tags;
  }
  
  const marketCap = typeof token.marketCap === 'string' ? parseFloat(token.marketCap) : (token.marketCap || 0);
  const volume = typeof token.volume24h === 'string' ? parseFloat(token.volume24h) : (token.volume24h || 0);
  const holders = typeof token.uniqueHolders === 'string' ? parseInt(token.uniqueHolders) : (token.uniqueHolders || 0);
  const liquidity = typeof token.liquidity?.usd === 'string' ? parseFloat(token.liquidity.usd) : (token.liquidity?.usd || 0);
  const marketCapDelta24h = typeof token.marketCapDelta24h === 'string' ? parseFloat(token.marketCapDelta24h) : (token.marketCapDelta24h || 0);
  
  // NEW tag - if created in last 24 hours
  if (token.createdAt) {
    const created = new Date(token.createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    if (hoursDiff <= 24) {
      tags.push("NEW");
    }
  }
  
  // SPIKE tag - if volume > $100K in 24h
  if (volume > 100000) {
    tags.push("SPIKE");
  }
  
  // VOLUME tag - if volume > $50K in 24h
  if (volume > 50000) {
    tags.push("VOLUME");
  }
  
  // RUNNER tag - if market cap < $500K and volume > $10K
  if (marketCap < 500000 && volume > 10000) {
    tags.push("RUNNER");
  }
  
  // TRENDING tag - if holders > 500
  if (holders > 500) {
    tags.push("TRENDING");
  }
  
  // LIQUIDITY tag - if liquidity > $50K
  if (liquidity > 50000) {
    tags.push("LIQUIDITY");
  }
  
  // MOONSHOT tag - if market cap < $100K but volume > $5K
  if (marketCap < 100000 && volume > 5000) {
    tags.push("MOONSHOT");
  }
  
  // ESTABLISHED tag - if market cap > $5M
  if (marketCap > 5000000) {
    tags.push("ESTABLISHED");
  }
  
  // GAINER tag - if market cap delta > 20%
  if (marketCapDelta24h > 20) {
    tags.push("GAINER");
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

function getAgeFromTimestamp(timestamp: string) {
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes > 0) return `${diffMinutes}m`;
  return "now";
}

const TagBadge = ({ tag }: { tag: string }) => {
  const tagColors: { [key: string]: string } = {
    NEW: "bg-green-500/20 text-green-300 border-green-500/30",
    SURGING: "bg-red-500/20 text-red-300 border-red-500/30",
    VOLUME: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    RUNNER: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    TRENDING: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    LIQUIDITY: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    MOONSHOT: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    ESTABLISHED: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    GAINER: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  };
  
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${tagColors[tag] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}>
      {tag}
    </span>
  );
};

// DEX Icon component
const DexIcon = ({ dexId }: { dexId?: string }) => {
  const getDexIcon = (dexId: string) => {
    switch (dexId?.toLowerCase()) {
      case 'baseswap':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">B</span>
          </div>
        );
      case 'uniswap_v3':
      case 'uniswap':
        return (
          <img
            src="https://i.imgur.com/woTkNd2.png"
            alt="Uniswap"
            className="w-4 h-4 rounded-full object-cover"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              console.log('Uniswap image failed to load, showing fallback');
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.fallback');
              if (fallback) fallback.classList.remove('hidden');
            }}
            onLoad={() => console.log('Uniswap image loaded successfully')}
          />
        );
      case 'pancakeswap_v3':
      case 'pancakeswap':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
        );
      case 'aerodrome':
        return (
          <img
            src="https://i.imgur.com/TpmRnXs.png"
            alt="Aerodrome"
            className="w-4 h-4 rounded-full object-cover"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              console.log('Aerodrome image failed to load, showing fallback');
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.fallback');
              if (fallback) fallback.classList.remove('hidden');
            }}
            onLoad={() => console.log('Aerodrome image loaded successfully')}
          />
        );
      case 'alienbase':
        return (
          <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
        );
      default:
        return (
          <div className="w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">D</span>
          </div>
        );
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        {getDexIcon(dexId || '')}
        {/* Fallback text for image loading failures */}
        <div className={`fallback absolute inset-0 w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center ${dexId?.toLowerCase() === 'uniswap' || dexId?.toLowerCase() === 'uniswap_v3' || dexId?.toLowerCase() === 'aerodrome' ? 'hidden' : ''}`}>
          <span className="text-white text-xs font-bold">
            {dexId?.toLowerCase() === 'uniswap' || dexId?.toLowerCase() === 'uniswap_v3' ? 'U' : 
             dexId?.toLowerCase() === 'aerodrome' ? 'A' : 'D'}
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-400">{dexId ? dexId.charAt(0).toUpperCase() + dexId.slice(1).toLowerCase() : 'Unknown'}</span>
    </div>
  );
};



export default function RadarPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<Array<{
    id?: string;
    name: string;
    symbol: string;
    address: string;
    pairAddress?: string;
    marketCap?: string | number;
    volume24h?: string | number;
    uniqueHolders?: string | number;
    liquidity?: { usd?: string | number };
    createdAt?: string | Date;
    tags: string[];
    mediaContent?: { previewImage?: { small?: string; medium?: string } };
    source?: string;
    dexName?: string;
    marketCapDelta24h?: string | number;
    totalVolume?: string | number;
    creatorAddress?: string;
    totalSupply?: string | number;
    description?: string;
    website?: string;
    telegram?: string;
    twitter?: string;
    tokenUri?: string;
    lastUpdated?: string | Date;
    priceChange?: {
      m5?: number;
      h1?: number;
      h6?: number;
      h24?: number;
    };
    [key: string]: unknown;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isLoading: pageLoading } = useLoading();
  
  // Compact filters
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  
  // UI State
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder] = useState<"asc" | "desc">("desc");
  
  // Load watchlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("radar-watchlist");
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
          localStorage.setItem("radar-watchlist", JSON.stringify(newWatchlist));
  };

  useEffect(() => {
    async function fetchTokens() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/cypherscope-tokens");
        const data = await res.json();
        console.log("🔍 API Response:", data);
        console.log("🔍 Tokens from API:", data.tokens?.length || 0);
        
        const tokensWithTags = (data.tokens || []).map((token: any) => {
          const tags = getTokenTags(token);
          console.log("🔍 Token:", token.name, "Tags:", tags);
          return {
            ...token,
            tags: tags
          };
        });
        
        console.log("🔍 Final tokens with tags:", tokensWithTags.length);
        setTokens(tokensWithTags);
      } catch (error) {
        console.error("❌ Fetch error:", error);
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
      if (showWatchlistOnly && !watchlist.includes(token.address)) {
        return false;
      }
      
      const matchesSearch =
        token.name?.toLowerCase().includes(search.toLowerCase()) ||
        token.symbol?.toLowerCase().includes(search.toLowerCase()) ||
        token.address?.toLowerCase().includes(search.toLowerCase());
      
      // Tag filter
      let matchesTag = true;
      if (selectedTag && token.tags) {
        matchesTag = token.tags.includes(selectedTag);
      }
      
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      let aVal: number | Date, bVal: number | Date;
      
      switch (sortBy) {
        case "createdAt":
          aVal = new Date(a.createdAt || 0);
          bVal = new Date(b.createdAt || 0);
          break;
        case "marketCap":
          aVal = typeof a.marketCap === 'string' ? parseFloat(a.marketCap) : (a.marketCap || 0);
          bVal = typeof b.marketCap === 'string' ? parseFloat(b.marketCap) : (b.marketCap || 0);
          break;
        case "volume24h":
          aVal = typeof a.volume24h === 'string' ? parseFloat(a.volume24h) : (a.volume24h || 0);
          bVal = typeof b.volume24h === 'string' ? parseFloat(b.volume24h) : (b.volume24h || 0);
          break;
        case "uniqueHolders":
          aVal = typeof a.uniqueHolders === 'string' ? parseInt(a.uniqueHolders) : (a.uniqueHolders || 0);
          bVal = typeof b.uniqueHolders === 'string' ? parseInt(b.uniqueHolders) : (b.uniqueHolders || 0);
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

  // Categorize tokens for 3-column layout - ensure each column has at least 5 tokens
  let newTokens = filteredAndSortedTokens.filter(token => 
    token.tags?.includes("NEW")
  );

  // Get surging tokens based on quick movements and relative performance
  let surgingTokens = filteredAndSortedTokens
    .filter(token => {
      // Include tokens with SURGING tag
      if (token.tags?.includes("SURGING")) return true;
      
      // Include tokens with high volume relative to market cap (indicating active trading)
      if (token.volume24h && token.marketCap) {
        const volumeToMC = parseFloat(String(token.volume24h)) / parseFloat(String(token.marketCap));
        if (volumeToMC > 0.3) return true; // Volume > 30% of market cap
      }
      
      // Include tokens with moderate but consistent gains (not extreme outliers)
      if (token.priceChange?.h24 && token.priceChange.h24 > 5 && token.priceChange.h24 < 50) return true;
      
      // Include newer tokens with high activity (age < 7 days)
      if (token.createdAt) {
        const ageInDays = (Date.now() - new Date(token.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays < 7 && token.volume24h && parseFloat(String(token.volume24h)) > 10000) return true;
      }
      
      return false;
    })
    .sort((a, b) => {
      // Primary sort: Volume to market cap ratio (activity level)
      const aVolumeMC = a.volume24h && a.marketCap ? parseFloat(String(a.volume24h)) / parseFloat(String(a.marketCap)) : 0;
      const bVolumeMC = b.volume24h && b.marketCap ? parseFloat(String(b.volume24h)) / parseFloat(String(b.marketCap)) : 0;
      
      if (Math.abs(aVolumeMC - bVolumeMC) > 0.1) {
        return bVolumeMC - aVolumeMC; // Sort by activity level first
      }
      
      // Secondary sort: Recent price momentum (but not extreme gains)
      const aChange = a.priceChange?.h24 || 0;
      const bChange = b.priceChange?.h24 || 0;
      
      // Prefer moderate gains over extreme ones for "surging"
      const aScore = aChange > 50 ? aChange * 0.5 : aChange; // Penalize extreme gains
      const bScore = bChange > 50 ? bChange * 0.5 : bChange;
      
      return bScore - aScore;
    });

  // Get top gainers based on actual 24h price changes from screener data
  let gainerTokens = filteredAndSortedTokens
    .filter(token => token.priceChange?.h24 !== undefined && token.priceChange.h24 > 0) // Only positive gains
    .sort((a, b) => {
      const aChange = a.priceChange?.h24 || 0;
      const bChange = b.priceChange?.h24 || 0;
      return bChange - aChange; // Sort by highest gains first
    });

  // Ensure each column has at least 5 tokens by filling with remaining tokens
  const tokensPerColumn = 5;
  
  // If any column has fewer than 5 tokens, fill with remaining tokens
  if (newTokens.length < tokensPerColumn) {
    const remainingTokens = filteredAndSortedTokens.filter(token => 
      !newTokens.includes(token) && !surgingTokens.includes(token) && !gainerTokens.includes(token)
    );
    const needed = tokensPerColumn - newTokens.length;
    newTokens = [...newTokens, ...remainingTokens.slice(0, needed)];
  }
  
  if (surgingTokens.length < tokensPerColumn) {
    const remainingTokens = filteredAndSortedTokens.filter(token => 
      !newTokens.includes(token) && !surgingTokens.includes(token) && !gainerTokens.includes(token)
    );
    const needed = tokensPerColumn - surgingTokens.length;
    surgingTokens = [...surgingTokens, ...remainingTokens.slice(0, needed)];
  }
  
  if (gainerTokens.length < tokensPerColumn) {
    const remainingTokens = filteredAndSortedTokens.filter(token => 
      !newTokens.includes(token) && !surgingTokens.includes(token) && !gainerTokens.includes(token)
    );
    const needed = tokensPerColumn - gainerTokens.length;
    gainerTokens = [...gainerTokens, ...remainingTokens.slice(0, needed)];
  }
  
  // Fallback: if still not enough tokens, distribute evenly
  if (newTokens.length === 0 && surgingTokens.length === 0 && gainerTokens.length === 0) {
    console.log("🔍 No tokens matched specific tags, using fallback categorization...");
    
    newTokens = filteredAndSortedTokens.slice(0, tokensPerColumn);
    surgingTokens = filteredAndSortedTokens.slice(tokensPerColumn, tokensPerColumn * 2);
    gainerTokens = filteredAndSortedTokens.slice(tokensPerColumn * 2, tokensPerColumn * 3);
  }

  // Debug categorization
  console.log("🔍 Categorization Debug:");
  console.log("🔍 Total filtered tokens:", filteredAndSortedTokens.length);
  console.log("🔍 New tokens:", newTokens.length);
  console.log("🔍 Surging tokens:", surgingTokens.length);
  console.log("🔍 Gainer tokens:", gainerTokens.length);
  
  // Show first few tokens and their tags
  filteredAndSortedTokens.slice(0, 5).forEach((token, index) => {
    console.log(`🔍 Token ${index + 1}:`, token.name, "Tags:", token.tags);
  });



  const TokenCard = ({ token }: { token: any }) => {
    // Helper function to format price change with color
    const formatPriceChange = (change: number | undefined) => {
      if (change === undefined || change === null) return { text: "-", color: "text-gray-400" };
      const isPositive = change >= 0;
      const color = isPositive ? "text-green-400" : "text-red-400";
      const sign = isPositive ? "+" : "";
      return { text: `${sign}${change.toFixed(1)}%`, color };
    };

    // Helper function to calculate buy percentage
    const getBuyPercentage = () => {
      if (!token.txns?.h24) return { text: "-", color: "text-gray-400" };
      const { buys, sells } = token.txns.h24;
      const total = buys + sells;
      if (total === 0) return { text: "-", color: "text-gray-400" };
      const buyPercentage = (buys / total) * 100;
      const color = buyPercentage > 60 ? "text-green-400" : buyPercentage < 40 ? "text-red-400" : "text-yellow-400";
      return { text: `${buyPercentage.toFixed(0)}%`, color };
    };

    const priceChange24h = formatPriceChange(token.priceChange?.h24);
    const buyPercentage = getBuyPercentage();

    // Navigate to chart page
    const handleTokenClick = () => {
      router.push(`/trade/${token.pairAddress || token.address}/chart`);
    };

    return (
      <div
        className="bg-gray-800/30 border-b border-gray-700/50 p-2.5 hover:bg-gray-700/30 transition-all duration-200 cursor-pointer group"
        style={{ minHeight: '80px' }}
        onClick={handleTokenClick}
      >
        <div className="flex items-center gap-3 mb-2">
                          <Image
            src={token.info?.imageUrl || token.mediaContent?.previewImage?.small || `https://dexscreener.com/base/${token.address}/logo.png`}
                            alt={token.symbol || "Token"}
            width={32}
            height={32}
            className="rounded-full bg-blue-900"
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.src = `https://dexscreener.com/base/${token.address}/logo.png`;
                }}
                          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-200 group-hover:text-blue-200 transition truncate text-sm">
                              {token.name || "Unknown"}
                            </div>
            <div className="text-xs text-gray-400 truncate">{token.symbol}</div>
            {/* Price and 24h change */}
            {token.priceUsd && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-300">${parseFloat(token.priceUsd).toFixed(6)}</span>
                <span className={priceChange24h.color}>{priceChange24h.text}</span>
                          </div>
            )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(token.address);
                          }}
            className={`p-1 rounded transition ${
                            watchlist.includes(token.address)
                              ? "text-yellow-400 hover:text-yellow-300"
                              : "text-gray-400 hover:text-yellow-400"
                          }`}
                        >
                          <StarIcon filled={watchlist.includes(token.address)} />
                        </button>
                      </div>
                      
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div>
            <span className="text-gray-400">MC:</span>
            <span className="text-gray-200 ml-1">{formatNumber(token.marketCap)}</span>
                        </div>
          <div>
            <span className="text-gray-400">Vol:</span>
            <span className="text-gray-200 ml-1">{formatNumber(token.volume24h)}</span>
                          </div>
          <div>
            <span className="text-gray-400">Buy:</span>
            <span className={`ml-1 ${buyPercentage.color}`}>{buyPercentage.text}</span>
                      </div>
          <div>
            <span className="text-gray-400">Age:</span>
            <span className="text-gray-200 ml-1">{token.createdAt ? getAgeFromTimestamp(token.createdAt) : "-"}</span>
                        </div>
                        </div>
        
        {/* DEX Row */}
        <div className="flex items-center justify-between text-xs mb-2">
          <DexIcon dexId={token.dexId} />
                      </div>
                      
                      {token.tags && token.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {token.tags.slice(0, 2).map((tag: string) => (
                            <TagBadge key={tag} tag={tag} />
                          ))}
                        </div>
                      )}
      </div>
    );
  };

  const ColumnHeader = ({ title, count, color }: { title: string; count: number; color: string }) => (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 border-b border-gray-700/50">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${color}`}></div>
        <h2 className="text-lg font-bold text-gray-200">{title}</h2>
                      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">{count}</span>
        {count > 5 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">(scroll for more)</span>
            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
              </div>
            )}
                </div>
                            </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-gray-950 to-blue-900 text-gray-200 font-sans flex flex-col">
      <Header />
      
      {/* Page Loader */}
      {pageLoading && <PageLoader />}
      
      {/* Compact Header */}
      <div className="bg-gray-800/50">
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                              <h1 className="text-xl font-bold font-cypherx-gradient">Radar</h1>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-400">{filteredAndSortedTokens.length} tokens</span>
                <span className="text-blue-400">•</span>
                <span className="text-gray-400">{watchlist.length} watchlisted</span>
                      </div>
                      </div>
                      
            {/* Compact Filters */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search tokens..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-400 focus:border-blue-400 focus:outline-none w-48"
              />
              
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-400 focus:outline-none"
              >
                <option value="">All Tags</option>
                <option value="NEW">New</option>
                <option value="SPIKE">Spike</option>
                <option value="VOLUME">Volume</option>
                <option value="RUNNER">Runner</option>
                <option value="GAINER">Gainer</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-blue-400 focus:outline-none"
              >
                <option value="createdAt">Age</option>
                <option value="marketCap">Market Cap</option>
                <option value="volume24h">Volume</option>
                <option value="uniqueHolders">Holders</option>
              </select>
                        
                        <button
                onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
                          className={`p-2 rounded-lg transition ${
                  showWatchlistOnly 
                    ? "bg-yellow-600/20 text-yellow-300 border border-yellow-500/30" 
                    : "bg-gray-700/50 text-gray-300 border border-gray-600/50 hover:bg-gray-600/50"
                }`}
              >
                <StarIcon filled={showWatchlistOnly} />
                        </button>
                      </div>
                        </div>
                                                  </div>
                        </div>
                       
        {/* Separator Line */}
        <div className="w-full border-b border-gray-700/50"></div>
                       
        {/* 3-Column Layout - Full Width */}
      <div className="w-full flex-1 flex items-center justify-center" style={{ height: 'calc(100vh - 155px)' }}>
        {loading ? (
          <div className="text-gray-400 text-sm">Loading tokens...</div>
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
          <div className="grid grid-cols-3 h-full w-full">
            {/* New Tokens Column */}
            <div className="flex flex-col h-full relative">
              <ColumnHeader title="New Pairs" count={newTokens.length} color="bg-green-400" />
              <div className="overflow-y-auto scrollbar-hide transition-all duration-300" style={{ height: 'calc(100vh - 215px)' }}>
                {newTokens.slice(0, 10).map((token) => (
                  <TokenCard key={token.address} token={token} />
                ))}
                {newTokens.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No new tokens found
              </div>
            )}
                </div>
              <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700/50"></div>
                        </div>
                        
            {/* Surging Tokens Column */}
            <div className="flex flex-col h-full relative">
              <ColumnHeader title="Surging" count={surgingTokens.length} color="bg-red-400" />
              <div className="overflow-y-auto scrollbar-hide transition-all duration-300" style={{ height: 'calc(100vh - 215px)' }}>
                {surgingTokens.slice(0, 10).map((token) => (
                  <TokenCard key={token.address} token={token} />
                ))}
                {surgingTokens.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No surging tokens found
                          </div>
                        )}
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700/50"></div>
                      </div>
                      
            {/* Gainer Tokens Column */}
            <div className="flex flex-col h-full">
              <ColumnHeader title="Top Gainers" count={gainerTokens.length} color="bg-blue-400" />
              <div className="overflow-y-auto scrollbar-hide transition-all duration-300" style={{ height: 'calc(100vh - 215px)' }}>
                {gainerTokens.slice(0, 10).map((token) => (
                  <TokenCard key={token.address} token={token} />
                ))}
                {gainerTokens.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No gainer tokens found
                        </div>
                      )}
                      </div>
                </div>
          </div>
        )}
      </div>

      {/* Main Footer */}
      <Footer />
    </div>
  );
} 