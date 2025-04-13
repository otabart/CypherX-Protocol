"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaTrophy, FaBolt, FaStar, FaSearch, FaBell, FaClipboard, FaShieldAlt, FaInfoCircle, FaPlusCircle, FaLock } from "react-icons/fa";
import { tokenMapping } from "../tokenMapping.js";
import debounce from "lodash/debounce";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, getDocs, setDoc } from "firebase/firestore";

// Utility Functions
function getColorClass(value: number): string {
  return value >= 0 ? "text-green-500" : "text-red-500";
}

function getAge(createdAt?: number): string {
  if (!createdAt) return "N/A";
  const diffMs = Date.now() - createdAt;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  return `${days}d`;
}

function getTxns24h(token: DexToken): number {
  if (!token.txns || !token.txns.h24) return 0;
  const { buys, sells } = token.txns.h24;
  return buys + sells;
}

const MIN_LIQUIDITY = 20000;
const DECAY_CONSTANT = 7;
const COOLDOWN_PERIOD = 300_000; // 5 minutes in milliseconds
const PRICE_CHECK_INTERVAL = 60_000; // 1 minute for price checks
const ETH_STATS_INTERVAL = 900_000; // 15 minutes for ETH stats
const TOP_MOVERS_LOSERS_INTERVAL = 3_600_000; // 1 hour for top movers/losers

const NO_LIQUIDITY_WARNING_TOKENS = ["bork", "fabiene", "munchi", "kevin", "paradox"];

function computeTrending(token: DexToken, boostValue: number): number {
  const txns = getTxns24h(token);
  let txnScore = Math.log10(txns + 1) * 1.5;

  if (txns < 10) txnScore *= 0.3;
  else if (txns < 50) txnScore *= 0.7;

  const volumeScore = Math.log10(token.volume.h24 + 1) * 0.5;
  const liquidityScore = Math.log10(token.liquidity.usd + 1) * 0.3;

  const priceChange1h = token.priceChange?.h1 ?? 0;
  const priceChange6h = token.priceChange?.h6 ?? 0;
  const priceChange24h = token.priceChange?.h24 ?? 0;

  const priceMovementScore =
    (priceChange1h > 0 ? Math.log10(Math.abs(priceChange1h) + 1) * 2 : 0) +
    (priceChange6h > 0 ? Math.log10(Math.abs(priceChange6h) + 1) * 2 : 0) +
    (priceChange24h > 0 ? Math.log10(Math.abs(priceChange24h) + 1) * 2 : 0);

  const consistencyBonus =
    priceChange1h > 0 && priceChange6h > 0 && priceChange24h > 0 ? 10 : 0;

  const boostScore = boostValue || 0;

  const pairAgeDays = token.pairCreatedAt
    ? (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60 * 24)
    : 0;
  const ageDecay = Math.max(0.3, Math.exp(-pairAgeDays / DECAY_CONSTANT));

  return (txnScore + volumeScore + liquidityScore + priceMovementScore + consistencyBonus + boostScore) * ageDecay;
}

// Types
interface DexToken {
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
  volume: { h24: number; h1: number };
  liquidity: { usd: number };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
  trendingScore?: number;
  info?: { imageUrl?: string };
  boosted?: boolean;
  boostValue?: number;
}

interface Alert {
  type: "volume_spike" | "price_spike" | "mover" | "loser" | "eth_stats";
  message: string;
  timestamp: string;
  priceChangePercent?: number;
  pairAddress?: string;
}

// Trophy & Marketing Icons
function getTrophy(rank: number): JSX.Element | null {
  if (rank === 1)
    return <FaTrophy size={16} className="text-[#FFD700]" title="Gold Trophy (Rank 1)" />;
  if (rank === 2)
    return <FaTrophy size={16} className="text-[#C0C0C0]" title="Silver Trophy (Rank 2)" />;
  if (rank === 3)
    return <FaTrophy size={16} className="text-[#CD7F32]" title="Bronze Trophy (Rank 3)" />;
  return null;
}

function MarketingIcon(): JSX.Element {
  return (
    <span className="cursor-help" title="Boosted Token">
      <FaBolt className="text-blue-400 w-4 h-4 md:w-5 md:h-5" />
    </span>
  );
}

export default function TokenScanner() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<DexToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"all" | "favorites" | "new">("all");
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
  const [previousPrices, setPreviousPrices] = useState<{ [symbol: string]: number }>({});
  const [lastAlertTimes, setLastAlertTimes] = useState<{ [symbol: string]: { volume: number; price: number; ethStats: number } }>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlerts, setSelectedAlerts] = useState<Alert[] | null>(null);

  // Submission State
  const [showModal, setShowModal] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenLogo, setTokenLogo] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Check Authentication and Fetch Favorites
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const favoritesQuery = query(collection(db, `users/${currentUser.uid}/favorites`));
        onSnapshot(favoritesQuery, (snapshot) => {
          const favoriteList = snapshot.docs.map((doc) => doc.data().pairAddress as string);
          setFavorites(favoriteList);
        });
      } else {
        setUser(null);
        setFavorites([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Alerts from Firestore
  useEffect(() => {
    const alertsQuery = query(collection(db, "notifications"));
    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      const newAlerts: Alert[] = [];
      snapshot.forEach((doc) => {
        const alert = doc.data() as Alert;
        newAlerts.push(alert);
      });
      setAlerts(newAlerts);
    });
    return () => unsubscribe();
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

  // Fetch Tokens and Compute Alerts
  useEffect(() => {
    async function fetchTokens() {
      setLoading(true);
      try {
        const tokenList = Object.values(tokenMapping) as string[];
        if (tokenList.length === 0) {
          setError("Token mapping is empty");
          setLoading(false);
          return;
        }

        const tokenChunks: string[][] = [];
        for (let i = 0; i < tokenList.length; i += 30) {
          tokenChunks.push(tokenList.slice(i, i + 30));
        }

        let allResults: DexToken[] = [];
        let hasAtLeastOneSuccess = false;
        let errorMessages: string[] = [];

        const fetchPromises = tokenChunks.map(async (chunk, chunkIndex) => {
          const joinedChunk = chunk.join(",");
          try {
            const res = await fetch(`/api/tokens?chainId=base&tokenAddresses=${joinedChunk}`);
            if (!res.ok) {
              const errorText = await res.text();
              errorMessages.push(
                `Chunk ${chunkIndex} (${joinedChunk}) failed with status ${res.status}: ${errorText}`
              );
              return [];
            }
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              hasAtLeastOneSuccess = true;
              return data as DexToken[];
            }
            return [];
          } catch (err) {
            errorMessages.push(`Chunk ${chunkIndex} (${joinedChunk}) threw an error: ${err}`);
            return [];
          }
        });

        const chunkResults = await Promise.all(fetchPromises);
        allResults = chunkResults.flat();

        if (allResults.length > 0) {
          const boostedTokens = await getDocs(collection(db, "boosts"));
          const boostMap: { [pairAddress: string]: number } = {};
          boostedTokens.forEach((doc) => {
            const data = doc.data();
            boostMap[data.pairAddress.toLowerCase()] = data.boostValue;
          });

          let tokensWithScores = allResults.map((tk) => {
            const lowerPairAddress = tk.pairAddress.toLowerCase();
            return {
              ...tk,
              liquidity: { usd: tk.liquidity?.usd || 0 },
              volume: { h24: tk.volume?.h24 || 0, h1: tk.volume?.h1 || 0 },
              pairCreatedAt: tk.pairCreatedAt || 0,
              boosted: !!boostMap[lowerPairAddress],
              boostValue: boostMap[lowerPairAddress] || 0,
              trendingScore: computeTrending(tk, boostMap[lowerPairAddress] || 0),
            };
          });

          tokensWithScores.sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0));
          setTokens(tokensWithScores);
          setError("");
        } else {
          if (!hasAtLeastOneSuccess) {
            setError("Error fetching token data: All chunks failed");
          } else {
            setError("Some token data could not be fetched");
          }
        }
      } catch (err) {
        setError("Error fetching token data");
      } finally {
        setLoading(false);
      }
    }

    fetchTokens();
    const interval = setInterval(fetchTokens, 120_000); // Fetch tokens every 2 minutes
    return () => clearInterval(interval);
  }, []);

  // Price Spike and Volume Spike Alerts
  useEffect(() => {
    async function checkPriceAndVolume() {
      const now = Date.now();
      const newPrices: { [symbol: string]: number } = {};
      const newAlerts: Alert[] = [];

      tokens.forEach((token) => {
        const symbol = token.baseToken.symbol;
        const pairAddress = token.pairAddress;
        const marketCap = token.marketCap || 0;
        const liquidity = token.liquidity.usd;
        const volumeH1 = token.volume.h1;
        const currentPrice = parseFloat(token.priceUsd || "0");
        const previousPrice = previousPrices[symbol] || currentPrice;

        newPrices[symbol] = currentPrice;

        const lastTimes = lastAlertTimes[symbol] || { volume: 0, price: 0, ethStats: 0 };

        // Volume Spike Check
        const volumeSpikeThresholdMarketCap = marketCap * 0.1;
        const volumeSpikeThresholdLiquidity = liquidity * 0.5;
        if (
          (volumeH1 > volumeSpikeThresholdMarketCap || volumeH1 > volumeSpikeThresholdLiquidity) &&
          now - lastTimes.volume >= COOLDOWN_PERIOD
        ) {
          const alert = {
            type: "volume_spike" as const,
            message: `${symbol} volume spike: $${volumeH1.toLocaleString()} in the last hour.`,
            timestamp: new Date().toISOString(),
            pairAddress,
          };
          newAlerts.push(alert);
          addDoc(collection(db, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save volume alert for ${symbol}:`, err));
          setLastAlertTimes((prev) => ({
            ...prev,
            [symbol]: { ...prev[symbol], volume: now, price: prev[symbol]?.price || 0, ethStats: prev[symbol]?.ethStats || 0 },
          }));
        }

        // Price Spike Check
        const priceChangePercent =
          previousPrice !== 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
        if (
          liquidity >= 50000 &&
          Math.abs(priceChangePercent) >= 3 &&
          now - lastTimes.price >= COOLDOWN_PERIOD
        ) {
          const alert = {
            type: "price_spike" as const,
            message: `${symbol} price ${priceChangePercent > 0 ? "up" : "down"} ${Math.abs(priceChangePercent).toFixed(2)}% in the last minute.`,
            timestamp: new Date().toISOString(),
            priceChangePercent,
            pairAddress,
          };
          newAlerts.push(alert);
          addDoc(collection(db, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save price alert for ${symbol}:`, err));
          setLastAlertTimes((prev) => ({
            ...prev,
            [symbol]: { ...prev[symbol], price: now, volume: prev[symbol]?.volume || 0, ethStats: prev[symbol]?.ethStats || 0 },
          }));
        }
      });

      setPreviousPrices(newPrices);
      setAlerts((prev) => [...prev, ...newAlerts]);
    }

    checkPriceAndVolume();
    const interval = setInterval(checkPriceAndVolume, PRICE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [tokens, previousPrices, lastAlertTimes]);

  // Top Movers and Losers Alerts
  useEffect(() => {
    async function checkTopMoversAndLosers() {
      const now = Date.now();
      const sortedBy24h = [...tokens].sort((a, b) => (b.priceChange?.h24 ?? 0) - (a.priceChange?.h24 ?? 0));
      const topMovers = sortedBy24h.slice(0, 3); // Top 3 gainers
      const topLosers = sortedBy24h.slice(-3).reverse(); // Top 3 losers

      const newAlerts: Alert[] = [];

      topMovers.forEach((token) => {
        const priceChange = token.priceChange?.h24 ?? 0;
        if (priceChange > 0) {
          const alert = {
            type: "mover" as const,
            message: `${token.baseToken.symbol} is a top mover: +${priceChange.toFixed(2)}% in the last 24 hours.`,
            timestamp: new Date().toISOString(),
            pairAddress: token.pairAddress,
          };
          newAlerts.push(alert);
          addDoc(collection(db, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save mover alert for ${token.baseToken.symbol}:`, err));
        }
      });

      topLosers.forEach((token) => {
        const priceChange = token.priceChange?.h24 ?? 0;
        if (priceChange < 0) {
          const alert = {
            type: "loser" as const,
            message: `${token.baseToken.symbol} is a top loser: ${priceChange.toFixed(2)}% in the last 24 hours.`,
            timestamp: new Date().toISOString(),
            pairAddress: token.pairAddress,
          };
          newAlerts.push(alert);
          addDoc(collection(db, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save loser alert for ${token.baseToken.symbol}:`, err));
        }
      });

      setAlerts((prev) => [...prev, ...newAlerts]);
    }

    // Check if it's the top of the hour
    const now = new Date();
    if (now.getMinutes() === 0) {
      checkTopMoversAndLosers();
    }

    const interval = setInterval(() => {
      const currentTime = new Date();
      if (currentTime.getMinutes() === 0) {
        checkTopMoversAndLosers();
      }
    }, TOP_MOVERS_LOSERS_INTERVAL);
    return () => clearInterval(interval);
  }, [tokens]);

  // ETH Stats Alerts
  useEffect(() => {
    async function fetchEthStats() {
      const now = Date.now();
      try {
        const res = await fetch("/api/eth-stats");
        if (!res.ok) {
          console.error("Failed to fetch ETH stats:", res.statusText);
          return;
        }
        const data = await res.json();
        const alert = {
          type: "eth_stats" as const,
          message: `ETH Stats: Price $${data.price.toFixed(2)}, 24h Change ${data.priceChange24h.toFixed(2)}%, Gas ${data.gasPrice} Gwei`,
          timestamp: new Date().toISOString(),
        };
        setAlerts((prev) => [...prev, alert]);
        addDoc(collection(db, "notifications"), {
          ...alert,
          createdAt: serverTimestamp(),
        }).catch((err) => console.error("Failed to save ETH stats alert:", err));
        setLastAlertTimes((prev) => ({
          ...prev,
          eth: { ...prev.eth, ethStats: now, volume: prev.eth?.volume || 0, price: prev.eth?.price || 0 },
        }));
      } catch (err) {
        console.error("Error fetching ETH stats:", err);
      }
    }

    fetchEthStats();
    const interval = setInterval(fetchEthStats, ETH_STATS_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Sorting & Filtering
  const filteredTokens = useMemo(() => {
    let tokenList = tokens;
    if (viewMode === "favorites") {
      tokenList = tokens.filter((token) => favorites.includes(token.pairAddress));
    } else if (viewMode === "new") {
      tokenList = [];
    }
    return tokenList.filter((token) => {
      const ageDays = token.pairCreatedAt
        ? (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60 * 24)
        : 0;
      return (
        token.liquidity.usd >= filters.minLiquidity &&
        token.volume.h24 >= filters.minVolume &&
        ageDays >= filters.minAge &&
        (filters.maxAge === Infinity || ageDays <= filters.maxAge)
      );
    });
  }, [tokens, filters, viewMode, favorites]);

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
        sortDirection === "desc" ? b.liquidity.usd - a.liquidity.usd : a.liquidity.usd - b.liquidity.usd
      );
    } else if (sortFilter === "marketCap") {
      copy.sort((a, b) =>
        sortDirection === "desc" ? (b.marketCap ?? 0) - (a.marketCap ?? 0) : (a.marketCap ?? 0) - (b.marketCap ?? 0)
      );
    } else if (sortFilter === "age") {
      copy.sort((a, b) =>
        sortDirection === "desc" ? (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0) : (a.pairCreatedAt ?? 0) - (b.pairCreatedAt ?? 0)
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

  const toggleFavorite = useCallback(
    async (pairAddress: string) => {
      if (!user) {
        setToast("Please sign in to manage favorites");
        setTimeout(() => setToast(""), 2000);
        router.push("/account");
        return;
      }
      const isFavorited = favorites.includes(pairAddress);
      try {
        const favoriteDocRef = doc(db, `users/${user.uid}/favorites`, pairAddress);
        if (isFavorited) {
          await deleteDoc(favoriteDocRef);
          setFavorites((prev) => prev.filter((fav) => fav !== pairAddress));
        } else {
          await setDoc(favoriteDocRef, {
            pairAddress,
            createdAt: serverTimestamp(),
          });
          setFavorites((prev) => [...prev, pairAddress]);
        }
      } catch (err) {
        console.error("Error toggling favorite:", err);
        setToast("Error updating favorites");
        setTimeout(() => setToast(""), 2000);
      }
    },
    [user, favorites, router]
  );

  const handleScan = useCallback((address: string) => {
    router.push(`/terminal?command=/scan ${address}`);
  }, [router]);

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
      "Boost Info:\n\nPurchase a boost with USDC on our website to increase your token's visibility. Boosts add a score to your token's trending rank:\n- Premium Boost: +175\n- Standard Boost: +20\n- Basic Boost: +10\nOnce the transaction is confirmed, your token will appear boosted in the screener!"
    );
  }

  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => setSearchQuery(value), 300),
    []
  );

  const indexOfLastToken = currentPage * pageSize;
  const indexOfFirstToken = indexOfLastToken - pageSize;
  const currentTokens = sortedTokens.slice(indexOfFirstToken, indexOfLastToken);
  const totalPages = Math.ceil(sortedTokens.length / pageSize);

  function handleFilterChange(filter: string) {
    if (sortFilter === "filter") {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortFilter(filter);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  }

  const getAlertButtonColor = (tokenAlerts: Alert[]): string => {
    const hasPriceSpike = tokenAlerts.some((alert) => alert.type === "price_spike");
    if (hasPriceSpike) {
      const priceSpike = tokenAlerts.find((alert) => alert.type === "price_spike");
      return priceSpike && priceSpike.priceChangePercent && priceSpike.priceChangePercent >= 0
        ? "bg-green-800"
        : "bg-red-800";
    }
    return "bg-blue-800";
  };

  return (
    <div className="w-screen h-screen bg-black text-white font-mono m-0 p-0 overflow-hidden">
      {toast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded shadow">
          {toast}
        </div>
      )}

      {error && (
        <div
          className="fixed top-16 bg-red-800 text-white py-2 px-4 rounded shadow animate-fade-out"
          style={{
            left: "calc(100% - 15%)",
            transform: "translateX(-50%)",
            width: "fit-content",
          }}
        >
          {error}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-white text-black p-6 rounded shadow-lg w-80">
            <button onClick={closeModal} className="absolute top-2 right-2 text-xl font-bold">
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
                <p className="mb-4 text-sm">
                  Your token has been submitted for review. We’ll notify you once it’s listed!
                </p>
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

      {selectedAlerts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-white p-6 rounded shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Alerts</h2>
            <ul className="space-y-2">
              {selectedAlerts.map((alert, idx) => (
                <li key={idx} className="text-sm">
                  <span className="font-bold">{alert.type.replace("_", " ").toUpperCase()}:</span>{" "}
                  {alert.message}
                  <br />
                  <span className="text-xs text-gray-400">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setSelectedAlerts(null)}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
              >
                Close
              </motion.button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col w-full h-full">
        <div className="sticky top-0 z-50 bg-[#0060FF] shadow-md w-full">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between px-2 py-2 space-y-1 sm:space-y-0">
            <div className="flex flex-row items-center space-x-2">
              <motion.div
                className="flex items-center space-x-2 bg-gray-800 border border-gray-600 rounded px-3 py-1"
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
              >
                <motion.span className="text-green-400 animate-pulse" title="Live Pulse">
                  ●
                </motion.span>
                <div className="text-xs sm:text-base text-white font-mono">
                  Live{" "}
                  <motion.span
                    className="text-blue-400"
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {viewerCount}
                  </motion.span>{" "}
                  Traders Screening...
                </div>
              </motion.div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="relative w-full sm:w-80">
                <div className="flex items-center bg-gray-800 rounded px-2 py-1 w-full h-8">
                  <FaSearch className="text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search tokens..."
                    onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                    onFocus={() => setShowSearchDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                    className="bg-transparent text-white focus:outline-none text-sm w-full p-1 touch-friendly h-6"
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
                          <span className="text-sm truncate">
                            {token.baseToken.name} / {token.quoteToken.symbol} ({token.baseToken.symbol})
                          </span>
                          <span className="text-sm text-gray-400 ml-auto">
                            ${Number(token.priceUsd).toFixed(5)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBoostInfo}
                className="flex items-center space-x-1 bg-gray-800 border border-gray-600 text-white text-xs sm:text-base font-mono whitespace-nowrap px-3 py-1 rounded hover:bg-gray-700 transition-colors"
              >
                <FaInfoCircle className="text-blue-400" />
                <span>[Boost Info]</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowModal(true)}
                className="flex items-center space-x-1 bg-gray-800 border border-gray-600 text-white text-xs sm:text-base font-mono whitespace-nowrap px-3 py-1 rounded hover:bg-gray-700 transition-colors"
              >
                <FaPlusCircle className="text-green-400" />
                <span>[Submit Listing]</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.back()}
                className="flex items-center space-x-1 bg-gray-800 border border-gray-600 text-white text-xs sm:text-base font-mono whitespace-nowrap px-3 py-1 rounded hover:bg-gray-700 transition-colors"
              >
                <span>[Return]</span>
              </motion.button>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 p-2 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex flex-col sm:flex-row gap-2 w-full items-center">
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
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode(viewMode === "all" ? "favorites" : "all")}
              className="p-2 bg-[#0052FF] hover:bg-[#0042CC] text-white rounded text-xs sm:text-sm w-full sm:w-auto"
            >
              {viewMode === "all" ? "Show Favorites" : "Show All Tokens"}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode("new")}
              className="p-2 bg-gradient-to-r from-[#0052FF] to-[#003ECC] text-white rounded text-xs sm:text-sm w-full sm:w-auto flex items-center justify-center gap-1 animate-gradient-x disabled:opacity-75"
              disabled
              title="Coming in v2"
            >
              <FaLock size={12} />
              New Pairs (v2)
            </motion.button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-x-auto overflow-y-auto">
          {viewMode === "new" ? (
            <div className="p-4 text-center text-gray-400">
              New Pairs coming soon in v2! Stay tuned for real-time token discovery.
            </div>
          ) : (
            <>
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
                      <th className="p-2 text-right" title="Alerts">
                        ALERTS
                      </th>
                      <th className="p-2 text-right" title="Actions">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: pageSize }).map((_, idx) => (
                        <tr key={idx} className="border-b border-gray-700">
                          <td colSpan={14} className="p-2">
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
                    ) : currentTokens.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-4 text-center text-gray-400">
                          {viewMode === "favorites"
                            ? "No favorite tokens yet. Star some tokens to add them here!"
                            : "No tokens match your filters."}
                        </td>
                      </tr>
                    ) : (
                      currentTokens.map((token, index) => {
                        const rank = index + 1 + (currentPage - 1) * pageSize;
                        const isTop3 = rank <= 3;
                        const trophyIcon = isTop3 && sortFilter === "trending" ? getTrophy(rank) : null;
                        const isBoosted = !!token.boosted;
                        const boostValue = token.boostValue || 0;
                        const lowLiquidity = token.liquidity.usd < MIN_LIQUIDITY;
                        const excludeLiquidityWarning = NO_LIQUIDITY_WARNING_TOKENS.includes(
                          token.baseToken.name.toLowerCase()
                        );
                        const tokenAlerts = alerts.filter((alert) => alert.pairAddress === token.pairAddress);

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
                                    <span className="text-blue-400 font-bold text-sm">+{boostValue}</span>
                                    <MarketingIcon />
                                  </div>
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
                                    <span className="text-xs text-gray-400">{token.baseToken.symbol}</span>
                                  </div>
                                </div>
                              </Link>
                            </td>
                            <td className="p-2 text-right">${Number(token.priceUsd).toFixed(5)}</td>
                            <td className="p-2 text-right">{getAge(token.pairCreatedAt)}</td>
                            <td className="p-2 text-right">{getTxns24h(token)}</td>
                            <td className={`p-2 text-right ${getColorClass(token.priceChange?.h1 ?? 0)}`}>
                              {token.priceChange?.h1 !== undefined
                                ? token.priceChange.h1.toFixed(2)
                                : "N/A"}
                              %
                            </td>
                            <td className={`p-2 text-right ${getColorClass(token.priceChange?.h6 ?? 0)}`}>
                              {token.priceChange?.h6 !== undefined
                                ? token.priceChange.h6.toFixed(2)
                                : "N/A"}
                              %
                            </td>
                            <td className={`p-2 text-right ${getColorClass(token.priceChange?.h24 ?? 0)}`}>
                              {token.priceChange?.h24 !== undefined
                                ? token.priceChange.h24.toFixed(2)
                                : "N/A"}
                              %
                            </td>
                            <td className="p-2 text-right">${token.volume.h24.toLocaleString()}</td>
                            <td className={`p-2 text-right ${lowLiquidity ? "text-red-500" : ""}`}>
                              ${token.liquidity.usd.toLocaleString()}
                              {lowLiquidity && !excludeLiquidityWarning && (
                                <span className="ml-1 text-red-500" title="Low liquidity warning">
                                  ⚠️
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-right">
                              {token.marketCap ? `$${token.marketCap.toLocaleString()}` : "N/A"}
                            </td>
                            <td className="p-2 text-right">
                              {token.fdv ? `$${token.fdv.toLocaleString()}` : "N/A"}
                            </td>
                            <td className="p-2 text-center align-middle">
                              {tokenAlerts.length > 0 ? (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setSelectedAlerts(tokenAlerts)}
                                  className={`text-white px-3 py-1 rounded-full text-xs flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 transition-colors ${getAlertButtonColor(
                                    tokenAlerts
                                  )}`}
                                  title="View Alerts"
                                >
                                  <FaBell className="w-4 h-4 animate-pulse" />
                                  <span>
                                    {tokenAlerts.length} Alert{tokenAlerts.length > 1 ? "s" : ""}
                                  </span>
                                </motion.button>
                              ) : (
                                <span className="text-gray-400">None</span>
                              )}
                            </td>
                            <td className="p-2 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => toggleFavorite(token.pairAddress)}
                                  className={
                                    favorites.includes(token.pairAddress)
                                      ? "text-yellow-400 hover:text-yellow-500"
                                      : "text-gray-400 hover:text-gray-300"
                                  }
                                  title={
                                    favorites.includes(token.pairAddress)
                                      ? "Remove from Favorites"
                                      : "Add to Favorites"
                                  }
                                >
                                  <FaStar
                                    size={16}
                                    className={
                                      favorites.includes(token.pairAddress)
                                        ? "fill-current stroke-white stroke-2"
                                        : "fill-none stroke-white stroke-2"
                                    }
                                  />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(token.baseToken.address);
                                  }}
                                  className="text-gray-400 hover:text-gray-300"
                                  title="Copy Address"
                                >
                                  <FaClipboard size={16} />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleScan(token.baseToken.address)}
                                  className="text-gray-400 hover:text-gray-300"
                                  title="Scan Contract in Terminal"
                                >
                                  <FaShieldAlt size={16} />
                                </motion.button>
                              </div>
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
                    <div key={idx} className="animate-pulse bg-gray-900 p-3 rounded-lg mb-2">
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
                ) : currentTokens.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    {viewMode === "favorites"
                      ? "No favorite tokens yet. Star some tokens to add them here!"
                      : "No tokens match your filters."}
                  </div>
                ) : (
                  currentTokens.map((token, index) => {
                    const rank = index + 1 + (currentPage - 1) * pageSize;
                    const isTop3 = rank <= 3;
                    const trophyIcon = isTop3 && sortFilter === "trending" ? getTrophy(rank) : null;
                    const isBoosted = !!token.boosted;
                    const boostValue = token.boostValue || 0;
                    const lowLiquidity = token.liquidity.usd < MIN_LIQUIDITY;
                    const excludeLiquidityWarning = NO_LIQUIDITY_WARNING_TOKENS.includes(
                      token.baseToken.name.toLowerCase()
                    );
                    const tokenAlerts = alerts.filter((alert) => alert.pairAddress === token.pairAddress);

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
                              <span className="text-blue-400 font-bold text-xs">+{boostValue}</span>
                              <MarketingIcon />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {tokenAlerts.length > 0 && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setSelectedAlerts(tokenAlerts)}
                              className={`text-white px-3 py-1 rounded-full text-xs flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 transition-colors ${getAlertButtonColor(
                                tokenAlerts
                              )}`}
                              title="View Alerts"
                            >
                              <FaBell className="w-4 h-4 animate-pulse" />
                              <span>
                                {tokenAlerts.length} Alert{tokenAlerts.length > 1 ? "s" : ""}
                              </span>
                            </motion.button>
                          )}
                          <div className="flex items-center gap-3">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => toggleFavorite(token.pairAddress)}
                              className={
                                favorites.includes(token.pairAddress)
                                  ? "text-yellow-400 hover:text-yellow-500"
                                  : "text-gray-400 hover:text-gray-300"
                              }
                              title={
                                favorites.includes(token.pairAddress)
                                  ? "Remove from Favorites"
                                  : "Add to Favorites"
                              }
                            >
                              <FaStar
                                size={14}
                                className={
                                  favorites.includes(token.pairAddress)
                                    ? "fill-current"
                                    : "fill-none stroke-current stroke-2"
                                }
                              />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(token.baseToken.address);
                              }}
                              className="text-gray-400 hover:text-gray-300"
                              title="Copy Address"
                            >
                              <FaClipboard size={14} />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleScan(token.baseToken.address)}
                              className="text-gray-400 hover:text-gray-300"
                              title="Scan Contract in Terminal"
                            >
                              <FaShieldAlt size={14} />
                            </motion.button>
                          </div>
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
                            <span className="text-xs text-gray-400">{token.baseToken.symbol}</span>
                          </div>
                        </div>
                      </Link>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400">Price:</span> ${Number(token.priceUsd).toFixed(5)}
                        </div>
                        <div>
                          <span className="text-gray-400">Age:</span> {getAge(token.pairCreatedAt)}
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
                          <span className="text-gray-400">Volume:</span> ${token.volume.h24.toLocaleString()}
                        </div>
                        <div>
                          <span className="text-gray-400">Liquidity:</span>{" "}
                          <span className={lowLiquidity ? "text-red-500" : ""}>
                            ${token.liquidity.usd.toLocaleString()}
                            {lowLiquidity && !excludeLiquidityWarning && (
                              <span className="ml-1 text-red-500" title="Low liquidity warning">
                                ⚠️
                              </span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">MCap:</span>{" "}
                          {token.marketCap ? `$${token.marketCap.toLocaleString()}` : "N/A"}
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
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-gray-900 p-4 flex justify-between items-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded disabled:opacity-50"
          >
            Previous
          </motion.button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded disabled:opacity-50"
          >
            Next
          </motion.button>
        </div>
      )}
    </div>
  </div>
);
}