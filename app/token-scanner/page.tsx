"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaTrophy, FaBolt, FaStar, FaSearch, FaBell, FaClipboard, FaShieldAlt, FaPlusCircle, FaLock } from "react-icons/fa";
import { tokenMapping } from "../tokenMapping.js";
import debounce from "lodash/debounce";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase.ts";
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, getDocs, setDoc } from "firebase/firestore";
import { Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend } from "chart.js";
import { Line } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend);

// ====== TYPES ======
export type TokenData = {
  pairAddress: string;
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
  priceUsd: string;
  priceChange?: {
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h1: number;
    h24: number;
  };
  marketCap?: number;
  liquidity: {
    usd: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
  };
};

export type BaseAiToken = {
  symbol: string;
  address: string;
  weight: string;
};

// ====== STATIC BASE AI TOKENS LIST ======
const baseAiTokens: BaseAiToken[] = [
  { symbol: "GAME", address: "0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3", weight: "4.86%" },
  { symbol: "BANKR", address: "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b", weight: "5.24%" },
  { symbol: "FAI", address: "0xb33Ff54b9F7242EF1593d2C9Bcd8f9df46c77935", weight: "12.57%" },
  { symbol: "VIRTUAL", address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", weight: "26.8%" },
  { symbol: "CLANKER", address: "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb", weight: "15.89%" },
  { symbol: "KAITO", address: "0x98d0baa52b2D063E780DE12F615f963Fe8537553", weight: "16.22%" },
  { symbol: "COOKIE", address: "0xC0041EF357B183448B235a8Ea73Ce4E4eC8c265F", weight: "5.12%" },
  { symbol: "VVV", address: "0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf", weight: "5.08%" },
  { symbol: "DRB", address: "0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2", weight: "3.8%" },
  { symbol: "AIXBT", address: "0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825", weight: "10.5%" },
];

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
const COOLDOWN_PERIOD = 300_000; // 5 minutes
const LONG_COOLDOWN_PERIOD = 1_800_000; // 30 minutes
const PRICE_CHECK_INTERVAL = 300_000; // 5 minutes (adjusted for ~2–3 alerts)
const TOP_MOVERS_LOSERS_INTERVAL = 3_600_000; // 1 hour
const NOTIFICATION_EXPIRY = 3 * 60 * 60 * 1000; // 3 hours
const MAX_NOTIFICATIONS_PER_HOUR = 18; // Allows ~3 alerts/5 min
const NO_LIQUIDITY_WARNING_TOKENS = ["bork", "fabiene", "munchi", "kevin", "paradox"];
const BASE_AI_TOKEN_SYMBOLS = baseAiTokens.map((token) => token.symbol.toUpperCase());

function computeTrending(token: DexToken, boostValue: number): number {
  const txns = getTxns24h(token);
  let txnScore = Math.log10(txns + 1) * 1.5;

  if (txns < 10) txnScore *= 0.3;
  else if (txns < 50) txnScore *= 0.7;

  const volumeScore = Math.log10((token.volume?.h24 || 0) + 1) * 0.5;
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
interface DexToken extends TokenData {
  txns: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  trendingScore?: number;
  boosted?: boolean;
  boostValue?: number;
  weight?: number; // Added for Base AI Index
}

interface Alert {
  type: "volume_spike" | "price_spike" | "price_spike_long" | "mover" | "loser" | "boost";
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
  const [viewMode, setViewMode] = useState<"all" | "favorites" | "baseAI" | "new">("all");
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
  const [lastAlertTimes, setLastAlertTimes] = useState<{
    [symbol: string]: { volume: number; price: number; priceLong: number; boost: number };
  }>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlerts, setSelectedAlerts] = useState<Alert[] | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [hourStart, setHourStart] = useState(Date.now());
  const [indexHistory, setIndexHistory] = useState<{ timestamp: Date; value: number }[]>([]);

  // Submission State
  const [showModal, setShowModal] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenLogo, setTokenLogo] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);

  // Check Authentication and Fetch Favorites
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const favoritesQuery = query(collection(db, `users/${currentUser.uid}/favorites`));
        onSnapshot(favoritesQuery, (snapshot) => {
          const favoriteList = snapshot.docs.map((doc) => doc.data().pairAddress as string);
          setFavorites(favoriteList);
        }, (err) => {
          console.error("Error fetching favorites:", err);
          setToast("Failed to load favorites");
          setTimeout(() => setToast(""), 2000);
        });
      } else {
        setUser(null);
        setFavorites([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Alerts from Firestore and Clean Up
  useEffect(() => {
    const alertsQuery = query(collection(db, "notifications"));
    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      const now = Date.now();
      const newAlerts: Alert[] = [];
      let count = 0;

      if (now - hourStart >= 60 * 60 * 1000) {
        setNotificationCount(0);
        setHourStart(now);
      }

      snapshot.forEach((doc) => {
        const alert = doc.data() as Alert;
        const alertTime = new Date(alert.timestamp).getTime();

        if (now - alertTime <= NOTIFICATION_EXPIRY) {
          if (count < MAX_NOTIFICATIONS_PER_HOUR) {
            newAlerts.push(alert);
            count++;
          }
        } else {
          deleteDoc(doc.ref).catch((err) => console.error(`Failed to delete alert: ${err}`));
        }
      });

      setAlerts(newAlerts);
      setNotificationCount(count);
    }, (err) => {
      console.error("Error fetching alerts:", err);
      setToast("Failed to load alerts");
      setTimeout(() => setToast(""), 2000);
    });
    return () => unsubscribe();
  }, [hourStart]);

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

  // Fetch Tokens
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
            const aiToken = baseAiTokens.find(
              (t) => t.symbol.toUpperCase() === tk.baseToken.symbol.toUpperCase()
            );
            const weight = aiToken ? parseFloat(aiToken.weight) / 100 : 0;
            return {
              ...tk,
              liquidity: { usd: tk.liquidity?.usd || 0 },
              volume: { h24: tk.volume?.h24 || 0, h1: tk.volume?.h1 || 0 },
              pairCreatedAt: tk.pairCreatedAt || 0,
              boosted: !!boostMap[lowerPairAddress],
              boostValue: boostMap[lowerPairAddress] || 0,
              trendingScore: computeTrending(tk, boostMap[lowerPairAddress] || 0),
              weight,
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
    const interval = setInterval(fetchTokens, 120_000);
    return () => clearInterval(interval);
  }, []);

  // Price Spike and Volume Spike Alerts
  useEffect(() => {
    async function checkPriceAndVolume() {
      const now = Date.now();
      const newPrices: { [symbol: string]: number } = {};
      const newAlerts: Alert[] = [];

      if (notificationCount >= MAX_NOTIFICATIONS_PER_HOUR) return;

      tokens.forEach((token) => {
        const symbol = token.baseToken.symbol;
        const pairAddress = token.pairAddress;
        const marketCap = token.marketCap || 0;
        const liquidity = token.liquidity.usd;
        const volumeH1 = token.volume?.h1 || 0;
        const currentPrice = parseFloat(token.priceUsd || "0");
        const previousPrice = previousPrices[symbol] || currentPrice;
        const priceChange6h = token.priceChange?.h6 ?? 0;

        newPrices[symbol] = currentPrice;

        const lastTimes = lastAlertTimes[symbol] || { volume: 0, price: 0, priceLong: 0, boost: 0 };

        const volumeSpikeThresholdMarketCap = marketCap * 0.1;
        const volumeSpikeThresholdLiquidity = liquidity * 0.5;
        if (
          (volumeH1 > volumeSpikeThresholdMarketCap || volumeH1 > volumeSpikeThresholdLiquidity) &&
          now - lastTimes.volume >= COOLDOWN_PERIOD &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR
        ) {
          const alert = {
            type: "volume_spike" as const,
            message: `${symbol} volume spike: $${volumeH1.toLocaleString()} in the last hour.`,
            timestamp: new Date().toISOString(),
            pairAddress,
          };
          console.log("Volume alert triggered:", alert);
          newAlerts.push(alert);
          addDoc(collection(db, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save volume alert for ${symbol}:`, err));
          setLastAlertTimes((prev) => ({
            ...prev,
            [symbol]: { ...prev[symbol], volume: now, price: prev[symbol]?.price || 0, priceLong: prev[symbol]?.priceLong || 0, boost: prev[symbol]?.boost || 0 },
          }));
          setNotificationCount((prev) => prev + 1);
        }

        const priceChangePercent =
          previousPrice !== 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
        if (
          liquidity >= 50000 &&
          Math.abs(priceChangePercent) >= 3 &&
          now - lastTimes.price >= COOLDOWN_PERIOD &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR
        ) {
          const alert = {
            type: "price_spike" as const,
            message: `${symbol} price ${priceChangePercent > 0 ? "up" : "down"} ${Math.abs(priceChangePercent).toFixed(2)}% in the last 5 minutes.`,
            timestamp: new Date().toISOString(),
            priceChangePercent,
            pairAddress,
          };
          console.log("Price alert triggered:", alert);
          newAlerts.push(alert);
          addDoc(collection(db, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save price alert for ${symbol}:`, err));
          setLastAlertTimes((prev) => ({
            ...prev,
            [symbol]: { ...prev[symbol], price: now, volume: prev[symbol]?.volume || 0, priceLong: prev[symbol]?.priceLong || 0, boost: prev[symbol]?.boost || 0 },
          }));
          setNotificationCount((prev) => prev + 1);
        }

        if (
          liquidity >= 50000 &&
          Math.abs(priceChange6h) >= 10 &&
          now - lastTimes.priceLong >= LONG_COOLDOWN_PERIOD &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR
        ) {
          const alert = {
            type: "price_spike_long" as const,
            message: `${symbol} price ${priceChange6h > 0 ? "up" : "down"} ${Math.abs(priceChange6h).toFixed(2)}% in the last 6 hours.`,
            timestamp: new Date().toISOString(),
            priceChangePercent: priceChange6h,
            pairAddress,
          };
          console.log("Long-term price alert triggered:", alert);
          newAlerts.push(alert);
          addDoc(collection(db, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save long-term price alert for ${symbol}:`, err));
          setLastAlertTimes((prev) => ({
            ...prev,
            [symbol]: { ...prev[symbol], priceLong: now, volume: prev[symbol]?.volume || 0, price: prev[symbol]?.price || 0, boost: prev[symbol]?.boost || 0 },
          }));
          setNotificationCount((prev) => prev + 1);
        }
      });

      setPreviousPrices(newPrices);
      setAlerts((prev) => [...prev, ...newAlerts]);
    }

    checkPriceAndVolume();
    const interval = setInterval(checkPriceAndVolume, PRICE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [tokens, previousPrices, lastAlertTimes, notificationCount]);

  // Boost Alerts
  useEffect(() => {
    async function checkBoostAlerts() {
      const now = Date.now();
      if (notificationCount >= MAX_NOTIFICATIONS_PER_HOUR) return;

      try {
        const boostedTokens = await getDocs(collection(db, "boosts"));
        const boostMap: { [pairAddress: string]: number } = {};
        boostedTokens.forEach((doc) => {
          const data = doc.data();
          boostMap[data.pairAddress.toLowerCase()] = data.boostValue;
        });

        const boostAlerts = tokens
          .filter((token) => boostMap[token.pairAddress.toLowerCase()] > 0 && !token.boosted)
          .map((token) => ({
            type: "boost" as const,
            message: `${token.baseToken.symbol} received a boost of ${boostMap[token.pairAddress.toLowerCase()]}`,
            timestamp: new Date().toISOString(),
            pairAddress: token.pairAddress,
          }))
          .slice(0, 1); // Limit to 1 boost alert per cycle

        if (boostAlerts.length > 0) {
          console.log("Boost alerts triggered:", boostAlerts);
          setAlerts((prev) => [...prev, ...boostAlerts]);
          for (const alert of boostAlerts) {
            await addDoc(collection(db, "notifications"), {
              ...alert,
              createdAt: serverTimestamp(),
            }).catch((err) => console.error("Failed to save boost alert:", err));
          }
          setLastAlertTimes((prev) => ({
            ...prev,
            [boostAlerts[0].pairAddress || "unknown"]: {
              ...prev[boostAlerts[0].pairAddress || "unknown"],
              boost: now,
            },
          }));
          setNotificationCount((prev) => prev + boostAlerts.length);

          setTokens((prev) =>
            prev.map((token) => ({
              ...token,
              boosted: !!boostMap[token.pairAddress.toLowerCase()],
              boostValue: boostMap[token.pairAddress.toLowerCase()] || 0,
            }))
          );
        }
      } catch (err: any) {
        console.error("Error checking boost alerts:", err);
      }
    }

    checkBoostAlerts();
    const interval = setInterval(checkBoostAlerts, COOLDOWN_PERIOD);
    return () => clearInterval(interval);
  }, [tokens, notificationCount]);

  // Top Movers and Losers Alerts
  useEffect(() => {
    async function checkTopMoversAndLosers() {
      const sortedBy1h = [...tokens].sort((a, b) => (b.priceChange?.h1 ?? 0) - (a.priceChange?.h1 ?? 0));
      const topMovers = sortedBy1h.slice(0, 5);
      const topLosers = sortedBy1h.slice(-5).reverse();

      const newAlerts: Alert[] = [];

      if (notificationCount >= MAX_NOTIFICATIONS_PER_HOUR) return;

      topMovers.forEach((token) => {
        const priceChange = token.priceChange?.h1 ?? 0;
        if (priceChange > 0 && notificationCount < MAX_NOTIFICATIONS_PER_HOUR) {
          const alert = {
            type: "mover" as const,
            message: `${token.baseToken.symbol} is a top gainer: +${priceChange.toFixed(2)}% this hour.`,
            timestamp: new Date().toISOString(),
            pairAddress: token.pairAddress,
          };
          console.log("Mover alert triggered:", alert);
          newAlerts.push(alert);
          addDoc(collection(db, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save mover alert for ${token.baseToken.symbol}:`, err));
          setNotificationCount((prev) => prev + 1);
        }
      });

      topLosers.forEach((token) => {
        const priceChange = token.priceChange?.h1 ?? 0;
        if (priceChange < 0 && notificationCount < MAX_NOTIFICATIONS_PER_HOUR) {
          const alert = {
            type: "loser" as const,
            message: `${token.baseToken.symbol} is a top loser: ${priceChange.toFixed(2)}% this hour.`,
            timestamp: new Date().toISOString(),
            pairAddress: token.pairAddress,
          };
          console.log("Loser alert triggered:", alert);
          newAlerts.push(alert);
          addDoc(collection(db, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save loser alert for ${token.baseToken.symbol}:`, err));
          setNotificationCount((prev) => prev + 1);
        }
      });

      setAlerts((prev) => [...prev, ...newAlerts]);
    }

    const currentTime = new Date();
    if (currentTime.getMinutes() % 5 === 0) {
      checkTopMoversAndLosers();
    }

    const interval = setInterval(() => {
      const currentTime = new Date();
      if (currentTime.getMinutes() % 5 === 0) {
        checkTopMoversAndLosers();
      }
    }, 300_000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [tokens, notificationCount]);

  // Update Base AI Index History
  useEffect(() => {
    const updateIndexHistory = () => {
      const indexValue = tokens.reduce((sum, token) => {
        return sum + (parseFloat(token.priceUsd || "0") * (token.weight || 0));
      }, 0);
      setIndexHistory((prev) => [
        ...prev.slice(-59), // Keep last 60 points (5 min intervals for 5 hours)
        { timestamp: new Date(), value: indexValue },
      ]);
    };
    updateIndexHistory();
    const interval = setInterval(updateIndexHistory, 300_000); // 5 minutes
    return () => clearInterval(interval);
  }, [tokens]);

  // Sorting & Filtering
  const filteredTokens = useMemo(() => {
    let tokenList = tokens;
    if (viewMode === "favorites") {
      tokenList = tokens.filter((token) => favorites.includes(token.pairAddress));
    } else if (viewMode === "baseAI") {
      tokenList = tokens.filter((token) => BASE_AI_TOKEN_SYMBOLS.includes(token.baseToken.symbol.toUpperCase()));
    } else if (viewMode === "new") {
      tokenList = [];
    }
    return tokenList.filter((token) => {
      const ageDays = token.pairCreatedAt
        ? (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60 * 24)
        : 0;
      return (
        token.liquidity.usd >= filters.minLiquidity &&
        (token.volume?.h24 || 0) >= filters.minVolume &&
        ageDays >= filters.minAge &&
        (filters.maxAge === Infinity || ageDays <= filters.maxAge)
      );
    });
  }, [tokens, filters, viewMode, favorites]);

  const sortedTokens = useMemo(() => {
    const copy = [...filteredTokens];
    if (viewMode === "baseAI") {
      copy.sort((a, b) => (b.weight || 0) - (a.weight || 0)); // Sort by weight for Base AI
      return copy.slice(0, 10); // Limit to top 10 tokens
    } else if (sortFilter === "trending") {
      return sortDirection === "asc" ? copy.reverse() : copy;
    } else if (sortFilter === "volume") {
      copy.sort((a, b) =>
        sortDirection === "desc"
          ? (b.volume?.h24 || 0) - (a.volume?.h24 || 0)
          : (a.volume?.h24 || 0) - (b.volume?.h24 || 0)
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
  }, [filteredTokens, sortFilter, sortDirection, viewMode]);

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

  // Base AI Index Metrics
  const indexMetrics = useMemo(() => {
    const baseAiTokensList = tokens.filter((token) =>
      BASE_AI_TOKEN_SYMBOLS.includes(token.baseToken.symbol.toUpperCase())
    );
    const totalVolume = baseAiTokensList.reduce((sum, token) => sum + (token.volume?.h24 || 0), 0);
    const avgPriceChange =
      baseAiTokensList.reduce((sum, token) => sum + (token.priceChange?.h24 || 0), 0) /
      (baseAiTokensList.length || 1);
    const totalMarketCap = baseAiTokensList.reduce((sum, token) => sum + (token.marketCap || 0), 0);
    const tokenCount = baseAiTokensList.length;
    return { totalVolume, avgPriceChange, totalMarketCap, tokenCount };
  }, [tokens]);

  // Chart Data for Base AI Index
  const chartData = {
    datasets: [
      {
        label: "Base AI Index Value",
        data: indexHistory.map((point) => ({ x: point.timestamp.getTime(), y: point.value })),
        borderColor: "rgba(59, 130, 246, 1)",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        fill: true,
      },
    ],
  };

  const chartOptions = {
    scales: {
      x: {
        type: "time" as const,
        time: {
          unit: "minute" as const,
          displayFormats: { minute: "HH:mm" },
        },
        title: { display: true, text: "Time" },
      },
      y: {
        title: { display: true, text: "Index Value (USD)" },
      },
    },
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label: (context: any) => `Value: $${context.parsed.y.toFixed(2)}`,
        },
      },
    },
  };

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
          setFavorites((prev) => prev.filter((fav) => fav !== pairAddress));
          await deleteDoc(favoriteDocRef);
        } else {
          setFavorites((prev) => [...prev, pairAddress]);
          await setDoc(favoriteDocRef, {
            pairAddress,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error("Error toggling favorite:", err);
        setFavorites((prev) => isFavorited ? [...prev, pairAddress] : prev.filter((fav) => fav !== pairAddress));
        setToast("Error updating favorites");
        setTimeout(() => setToast(""), 2000);
      }
    },
    [user, favorites, router]
  );

  const handleScan = useCallback((address: string) => {
    router.push(`/terminal?command=/scan ${address}`);
  }, [router]);

  const handleReturn = useCallback(() => {
    router.back();
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

  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => setSearchQuery(value), 300),
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

  const getAlertButtonColor = (tokenAlerts: Alert[]): string => {
    const hasPriceSpike = tokenAlerts.some((alert) => alert.type === "price_spike" || alert.type === "price_spike_long");
    if (hasPriceSpike) {
      const priceSpike = tokenAlerts.find((alert) => alert.type === "price_spike" || alert.type === "price_spike_long");
      return priceSpike && priceSpike.priceChangePercent && priceSpike.priceChangePercent >= 0
        ? "bg-green-800"
        : "bg-red-800";
    }
    return "bg-blue-800";
  };

  // Boost Info Card Data
  const boostInfo = [
    { boost: 10, cost: 10, duration: "12HR" },
    { boost: 20, cost: 15, duration: "12HR" },
    { boost: 30, cost: 20, duration: "12HR" },
    { boost: 40, cost: 25, duration: "12HR" },
    { boost: 50, cost: 35, duration: "24HR" },
    { boost: 100, cost: 50, duration: "24HR" },
    { boost: 150, cost: 75, duration: "36HR" },
    { boost: 200, cost: 90, duration: "36HR" },
    { boost: 250, cost: 100, duration: "36HR" },
    { boost: 500, cost: 175, duration: "48HR" },
    { boost: 1000, cost: 300, duration: "48HR" },
  ];
  const adInfo = { cost: 50, type: "Banner Ad" };

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

      {showBoostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-gray-900 text-white p-6 rounded shadow-lg w-80">
            <button
              onClick={() => setShowBoostModal(false)}
              className="absolute top-2 right-2 text-xl font-bold"
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4">Boost Info</h2>
            <p className="text-sm mb-4">
              Purchase a boost with USDC on our website to increase your token's visibility. Boosts add a score to your token's trending rank:
            </p>
            <ul className="text-sm mb-4 list-disc list-inside">
              {boostInfo.map((info) => (
                <li key={info.boost}>
                  Boost ({info.boost}) - {info.cost} USDC ({info.duration})
                </li>
              ))}
              <li>Ad ({adInfo.type}) - {adInfo.cost} USDC</li>
            </ul>
            <p className="text-sm mb-4">
              Once the transaction is confirmed, your token will appear boosted in the screener!
            </p>
            <div className="flex flex-col space-y-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.open("https://yourwebsite.com/boost", "_blank")}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 px-4 rounded w-full"
              >
                Boost Now
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.open("https://yourwebsite.com/boost-info", "_blank")}
                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded w-full"
              >
                Learn More
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowBoostModal(false)}
                className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded w-full"
              >
                Close
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {selectedAlerts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-white p-6 rounded shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Alerts</h2>
            <ul className="space-y-2">
              {selectedAlerts.map((alert, idx) => {
                const isPriceSpike = alert.type === "price_spike" || alert.type === "price_spike_long";
                const isVolumeSpike = alert.type === "volume_spike";
                const percentageMatch = isPriceSpike ? alert.message.match(/(\d+\.\d{2})%/) : null;
                const percentage = percentageMatch ? percentageMatch[1] : null;
                return (
                  <li key={idx} className="text-sm">
                    <span className="font-bold">{alert.type.replace("_", " ").toUpperCase()}:</span>{" "}
                    {isPriceSpike && percentage && alert.priceChangePercent !== undefined ? (
                      <>
                        {alert.message.replace(percentage + "%", "")}
                        <span className={alert.priceChangePercent >= 0 ? "text-green-500" : "text-red-500"}>
                          {percentage}%
                        </span>
                      </>
                    ) : isVolumeSpike ? (
                      <span className="text-blue-400">{alert.message}</span>
                    ) : (
                      alert.message
                    )}
                    <br />
                    <span className="text-xs text-gray-400">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
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
                onClick={() => setShowBoostModal(true)}
                className="flex items-center space-x-1 bg-gray-800 border border-gray-600 text-white text-xs sm:text-base font-mono whitespace-nowrap px-3 py-1 rounded hover:bg-gray-700 transition-colors"
              >
                <FaBolt className="text-blue-400" />
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
                onClick={handleReturn}
                className="flex items-center space-x-1 bg-gray-800 border border-gray-600 text-white text-xs sm:text-base font-mono whitespace-nowrap px-3 py-1 rounded hover:bg-gray-700 transition-colors"
              >
                <span>[Return]</span>
              </motion.button>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 p-2 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex flex-col sm:flex-row gap-2 w-full items-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode("all")}
              className={`p-2 text-white rounded text-xs sm:text-sm w-full sm:w-auto ${
                viewMode === "all" ? "bg-blue-500" : "bg-gray-600"
              }`}
            >
              All Tokens
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode("favorites")}
              className={`p-2 text-white rounded text-xs sm:text-sm w-full sm:w-auto ${
                viewMode === "favorites" ? "bg-blue-500" : "bg-gray-600"
              }`}
            >
              Favorites
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode("baseAI")}
              className={`p-2 text-white rounded text-xs sm:text-sm w-full sm:w-auto ${
                viewMode === "baseAI" ? "bg-blue-500" : "bg-gray-600"
              }`}
            >
              Base AI Index
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode("new")}
              className="p-2 bg-blue-600 bg-opacity-75 text-white rounded text-xs sm:text-sm w-full sm:w-auto flex items-center justify-center gap-1 animate-gradient-x disabled:opacity-75 cursor-not-allowed"
              disabled
              title="Coming in v2"
            >
              <FaLock size={12} />
              New Pairs (v2)
            </motion.button>
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
        </div>

        <div className="flex-1 flex flex-col overflow-x-auto overflow-y-auto">
          {viewMode === "new" ? (
            <div className="p-4 text-center text-gray-400">
              New Pairs coming soon in v2! Stay tuned for real-time token discovery.
            </div>
          ) : viewMode === "baseAI" ? (
            <>
              <div className="p-4">
                <h2 className="text-xl font-bold mb-4">Base AI Index</h2>
                <div className="mb-4 bg-gray-800 p-4 rounded">
                  <h3 className="text-lg font-semibold mb-2">Index Stats</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <p>Total Volume (24h): ${indexMetrics.totalVolume.toLocaleString()}</p>
                    <p>Avg Price Change (24h): {indexMetrics.avgPriceChange.toFixed(2)}%</p>
                    <p>Total Market Cap: ${indexMetrics.totalMarketCap.toLocaleString()}</p>
                    <p>Tokens in Index: {indexMetrics.tokenCount}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Index Growth</h3>
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
              {filteredTokens.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  No tokens in the Base AI Index match your filters.
                </div>
              ) : (
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
                        <th className="p-2 text-right" title="Weight in Base AI Index">
                          WEIGHT
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
                        <th className="p-2 text-center align-middle" title="Alerts">
                          ALERTS
                        </th>
                        <th className="p-2 text-right" title="Actions">
                          ACTIONS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 10 }).map((_, idx) => (
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
                            No tokens match your filters.
                          </td>
                        </tr>
                      ) : (
                        currentTokens.map((token, index) => {
                          const rank = index + 1 + (currentPage - 1) * pageSize;
                          const isTop3 = rank <= 3;
                          const trophyIcon = isTop3 && sortFilter === "trending" ? getTrophy(rank) : null;
                          const isBoosted = !!token.boosted;
                          const boostValue = token.boostValue || 0;
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
                              <td className="p-2 text-right">${(token.volume?.h24 || 0).toLocaleString()}</td>
                              <td className="p-2 text-right">
                                {token.weight ? `${(token.weight * 100).toFixed(2)}%` : "N/A"}
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
                                      )}
                                      {filteredTokens.length > 0 && (
                                        <div className="block md:hidden p-2">
                                          {currentTokens.map((token, index) => {
                                            const rank = index + 1 + (currentPage - 1) * pageSize;
                                            const isTop3 = rank <= 3;
                                            const trophyIcon = isTop3 && sortFilter === "trending" ? getTrophy(rank) : null;
                                            const isBoosted = !!token.boosted;
                                            const boostValue = token.boostValue || 0;
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
                                                  <div className="flex items-center gap-2">
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
                                                <Link href={`/token-scanner/${token.pairAddress}/chart`}>
                                                  <div className="flex items-center space-x-2 mb-2 cursor-pointer">
                                                    <img
                                                      src={token.info?.imageUrl || "/fallback.png"}
                                                      alt={token.baseToken.symbol}
                                                      className="w-6 h-6 rounded-full"
                                                    />
                                                    <div>
                                                      <span className="font-semibold text-sm">
                                                        {token.baseToken.name} / {token.quoteToken.symbol}
                                                      </span>
                                                      <div className="text-xs text-gray-400">{token.baseToken.symbol}</div>
                                                    </div>
                                                  </div>
                                                </Link>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                  <div>
                                                    <span className="text-gray-400">Price:</span>{" "}
                                                    ${Number(token.priceUsd).toFixed(5)}
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Age:</span> {getAge(token.pairCreatedAt)}
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">TXN (24h):</span> {getTxns24h(token)}
                                                  </div>
                                                  <div className={`text-${getColorClass(token.priceChange?.h1 ?? 0)}`}>
                                                    <span className="text-gray-400">1h:</span>{" "}
                                                    {token.priceChange?.h1 !== undefined
                                                      ? token.priceChange.h1.toFixed(2)
                                                      : "N/A"}
                                                    %
                                                  </div>
                                                  <div className={`text-${getColorClass(token.priceChange?.h6 ?? 0)}`}>
                                                    <span className="text-gray-400">6h:</span>{" "}
                                                    {token.priceChange?.h6 !== undefined
                                                      ? token.priceChange.h6.toFixed(2)
                                                      : "N/A"}
                                                    %
                                                  </div>
                                                  <div className={`text-${getColorClass(token.priceChange?.h24 ?? 0)}`}>
                                                    <span className="text-gray-400">24h:</span>{" "}
                                                    {token.priceChange?.h24 !== undefined
                                                      ? token.priceChange.h24.toFixed(2)
                                                      : "N/A"}
                                                    %
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Volume (24h):</span>{" "}
                                                    ${(token.volume?.h24 || 0).toLocaleString()}
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Weight:</span>{" "}
                                                    {token.weight ? `${(token.weight * 100).toFixed(2)}%` : "N/A"}
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Market Cap:</span>{" "}
                                                    {token.marketCap ? `$${token.marketCap.toLocaleString()}` : "N/A"}
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">FDV:</span>{" "}
                                                    {token.fdv ? `$${token.fdv.toLocaleString()}` : "N/A"}
                                                  </div>
                                                  <div className="col-span-2">
                                                    <span className="text-gray-400">Alerts:</span>{" "}
                                                    {tokenAlerts.length > 0 ? (
                                                      <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => setSelectedAlerts(tokenAlerts)}
                                                        className={`text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 ${getAlertButtonColor(
                                                          tokenAlerts
                                                        )}`}
                                                      >
                                                        <FaBell className="w-3 h-3 animate-pulse" />
                                                        {tokenAlerts.length} Alert{tokenAlerts.length > 1 ? "s" : ""}
                                                      </motion.button>
                                                    ) : (
                                                      <span className="text-gray-400">None</span>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {filteredTokens.length === 0 ? (
                                        <div className="p-4 text-center text-gray-400">
                                          No tokens match your filters.
                                        </div>
                                      ) : (
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
                                                <th className="p-2 text-center align-middle" title="Alerts">
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
                                                    No tokens match your filters.
                                                  </td>
                                                </tr>
                                              ) : (
                                                currentTokens.map((token, index) => {
                                                  const rank = index + 1 + (currentPage - 1) * pageSize;
                                                  const isTop3 = rank <= 3;
                                                  const trophyIcon = isTop3 && sortFilter === "trending" ? getTrophy(rank) : null;
                                                  const isBoosted = !!token.boosted;
                                                  const boostValue = token.boostValue || 0;
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
                                                      <td className="p-2 text-right">${(token.volume?.h24 || 0).toLocaleString()}</td>
                                                      <td className="p-2 text-right">${token.liquidity.usd.toLocaleString()}</td>
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
                                      )}
                                      {filteredTokens.length > 0 && (
                                        <div className="block md:hidden p-2">
                                          {currentTokens.map((token, index) => {
                                            const rank = index + 1 + (currentPage - 1) * pageSize;
                                            const isTop3 = rank <= 3;
                                            const trophyIcon = isTop3 && sortFilter === "trending" ? getTrophy(rank) : null;
                                            const isBoosted = !!token.boosted;
                                            const boostValue = token.boostValue || 0;
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
                                                  <div className="flex items-center gap-2">
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
                                                <Link href={`/token-scanner/${token.pairAddress}/chart`}>
                                                  <div className="flex items-center space-x-2 mb-2 cursor-pointer">
                                                    <img
                                                      src={token.info?.imageUrl || "/fallback.png"}
                                                      alt={token.baseToken.symbol}
                                                      className="w-6 h-6 rounded-full"
                                                    />
                                                    <div>
                                                      <span className="font-semibold text-sm">
                                                        {token.baseToken.name} / {token.quoteToken.symbol}
                                                      </span>
                                                      <div className="text-xs text-gray-400">{token.baseToken.symbol}</div>
                                                    </div>
                                                  </div>
                                                </Link>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                  <div>
                                                    <span className="text-gray-400">Price:</span>{" "}
                                                    ${Number(token.priceUsd).toFixed(5)}
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Age:</span> {getAge(token.pairCreatedAt)}
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">TXN (24h):</span> {getTxns24h(token)}
                                                  </div>
                                                  <div className={`text-${getColorClass(token.priceChange?.h1 ?? 0)}`}>
                                                    <span className="text-gray-400">1h:</span>{" "}
                                                    {token.priceChange?.h1 !== undefined
                                                      ? token.priceChange.h1.toFixed(2)
                                                      : "N/A"}
                                                    %
                                                  </div>
                                                  <div className={`text-${getColorClass(token.priceChange?.h6 ?? 0)}`}>
                                                    <span className="text-gray-400">6h:</span>{" "}
                                                    {token.priceChange?.h6 !== undefined
                                                      ? token.priceChange.h6.toFixed(2)
                                                      : "N/A"}
                                                    %
                                                  </div>
                                                  <div className={`text-${getColorClass(token.priceChange?.h24 ?? 0)}`}>
                                                    <span className="text-gray-400">24h:</span>{" "}
                                                    {token.priceChange?.h24 !== undefined
                                                      ? token.priceChange.h24.toFixed(2)
                                                      : "N/A"}
                                                    %
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Volume (24h):</span>{" "}
                                                    ${(token.volume?.h24 || 0).toLocaleString()}
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Liquidity:</span>{" "}
                                                    ${token.liquidity.usd.toLocaleString()}
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Market Cap:</span>{" "}
                                                    {token.marketCap ? `$${token.marketCap.toLocaleString()}` : "N/A"}
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">FDV:</span>{" "}
                                                    {token.fdv ? `$${token.fdv.toLocaleString()}` : "N/A"}
                                                  </div>
                                                  <div className="col-span-2">
                                                    <span className="text-gray-400">Alerts:</span>{" "}
                                                    {tokenAlerts.length > 0 ? (
                                                      <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => setSelectedAlerts(tokenAlerts)}
                                                        className={`text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 ${getAlertButtonColor(
                                                          tokenAlerts
                                                        )}`}
                                                      >
                                                        <FaBell className="w-3 h-3 animate-pulse" />
                                                        {tokenAlerts.length} Alert{tokenAlerts.length > 1 ? "s" : ""}
                                                      </motion.button>
                                                    ) : (
                                                      <span className="text-gray-400">None</span>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                          
                                {filteredTokens.length > 0 && (
                                  <div className="p-4 flex justify-between items-center bg-gray-900">
                                    <div>
                                      Showing {indexOfFirstToken + 1} to{" "}
                                      {Math.min(indexOfLastToken, filteredTokens.length)} of {filteredTokens.length}{" "}
                                      tokens
                                    </div>
                                    <div className="flex space-x-2">
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="bg-gray-800 text-white px-3 py-1 rounded disabled:opacity-50"
                                      >
                                        Previous
                                      </motion.button>
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="bg-gray-800 text-white px-3 py-1 rounded disabled:opacity-50"
                                      >
                                        Next
                                      </motion.button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );