"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FaTrophy,
  FaBolt,
  FaStar,
  FaBell,
  FaClipboard,
  FaPlusCircle,
  FaUser,
  FaSearch,
} from "react-icons/fa";
import debounce from "lodash/debounce";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  setDoc,
} from "firebase/firestore";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Explicitly type auth and db
const firebaseAuth: Auth = auth;
const firestoreDb: Firestore = db;

// Register Chart.js components
ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend);

// ====== TYPES ======
export type TokenData = {
  pairAddress: string; // Maps to Firestore 'pool' field
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
    m5?: number;
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
  txns: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  trendingScore?: number;
  boosted?: boolean;
  boostValue?: number;
  weight?: number;
};

export type BaseAiToken = {
  symbol: string;
  address: string;
  weight: string;
  pairAddress?: string;
};

type Alert = {
  id?: string;
  type: "price_spike" | "price_spike_long" | "volume_spike" | "mover" | "loser" | "boost" | "new_token";
  message: string;
  timestamp: string;
  pairAddress?: string;
  priceChangePercent?: number;
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

// ====== CONSTANTS ======
const DECAY_CONSTANT = 7;
const COOLDOWN_PERIOD = 300_000; // 5 minutes
const LONG_COOLDOWN_PERIOD = 1_800_000; // 30 minutes
const PRICE_CHECK_INTERVAL = 300_000; // 5 minutes
const TOP_MOVERS_LOSERS_INTERVAL = 3_600_000; // 1 hour
const NOTIFICATION_EXPIRY = 3 * 60 * 60 * 1000; // 3 hours
const MAX_NOTIFICATIONS_PER_HOUR = 18;
const MAX_NOTIFICATIONS_PER_TOKEN = 5;
const BASE_AI_TOKEN_SYMBOLS = baseAiTokens.map((token) => token.symbol.toUpperCase());

// ====== UTILITY FUNCTIONS ======
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

function getTxns24h(token: TokenData): number {
  if (!token.txns || !token.txns.h24) return 0;
  const { buys, sells } = token.txns.h24;
  return buys + sells;
}

function formatPrice(price: string): string {
  const numPrice = Number(price);
  if (numPrice < 0.001) return `$${numPrice.toFixed(5)}`;
  if (numPrice < 1) return `$${numPrice.toFixed(4)}`;
  return `$${numPrice.toFixed(2)}`;
}

function computeTrending(token: TokenData, boostValue: number): number {
  const txns = getTxns24h(token);
  let txnScore = Math.log10(txns + 1) * 1.5;
  if (txns < 10) txnScore *= 0.3;
  else if (txns < 50) txnScore *= 0.7;
  const volumeScore = Math.log10((token.volume?.h24 || 0) + 1) * 0.5;
  const liquidityScore = Math.log10((token.liquidity?.usd || 0) + 1) * 0.3;
  const priceChange1h = token.priceChange?.h1 ?? 0;
  const priceChange6h = token.priceChange?.h6 ?? 0;
  const priceChange24h = token.priceChange?.h24 ?? 0;
  const priceMovementScore =
    (priceChange1h > 0 ? Math.log10(Math.abs(priceChange1h) + 1) * 2 : 0) +
    (priceChange6h > 0 ? Math.log10(Math.abs(priceChange6h) + 1) * 2 : 0) +
    (priceChange24h > 0 ? Math.log10(Math.abs(priceChange24h) + 1) * 2 : 0);
  const consistencyBonus = priceChange1h > 0 && priceChange6h > 0 && priceChange24h > 0 ? 10 : 0;
  const volumeToMarketCap = token.marketCap ? (token.volume?.h24 || 0) / token.marketCap : 0;
  const volumeMarketCapScore = Math.log10(volumeToMarketCap + 1) * 2;
  const boostScore = boostValue || 0;
  const ageDecay = token.pairCreatedAt
    ? Math.max(0.3, Math.exp(-(Date.now() - token.pairCreatedAt) / (1000 * 60 * 60 * 24) / DECAY_CONSTANT))
    : 0.5;
  const baseScore =
    txnScore +
    volumeScore +
    liquidityScore +
    priceMovementScore +
    consistencyBonus +
    volumeMarketCapScore +
    boostScore;
  return token.pairCreatedAt ? baseScore * ageDecay : baseScore * 0.8;
}

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

function AdIcon(): JSX.Element {
  return (
    <span className="cursor-help" title="Sponsored Token">
      <FaBolt className="text-[#FFD700] w-4 h-4 md:w-5 md:h-5" />
    </span>
  );
}

function SkeletonRow(): JSX.Element {
  return (
    <tr className="border-b border-blue-500/30">
      <td className="p-3">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-12"></div>
      </td>
      <td className="p-3">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gray-900 rounded-full animate-pulse"></div>
          <div className="h-6 bg-gray-900 rounded animate-pulse w-24"></div>
        </div>
      </td>
      <td className="p-3 text-right">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-16 ml-auto"></div>
      </td>
      <td className="p-3 text-right">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-16 ml-auto"></div>
      </td>
      <td className="p-3 text-right">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-16 ml-auto"></div>
      </td>
      <td className="p-3 text-right">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-16 ml-auto"></div>
      </td>
      <td className="p-3 text-right">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-16 ml-auto"></div>
      </td>
      <td className="p-3 text-right">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-16 ml-auto"></div>
      </td>
      <td className="p-3 text-right">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-16 ml-auto"></div>
      </td>
      <td className="p-3 text-right">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-20 ml-auto"></div>
      </td>
      <td className="p-3 text-right">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-20 ml-auto"></div>
      </td>
      <td className="p-3 text-right">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-20 ml-auto"></div>
      </td>
      <td className="p-3 text-center">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-12 mx-auto"></div>
      </td>
      <td className="p-3 text-center">
        <div className="h-6 bg-gray-900 rounded animate-pulse w-12 mx-auto"></div>
      </td>
    </tr>
  );
}

function getBellColor(alerts: Alert[]): string {
  if (alerts.length === 0) return "text-gray-400";
  const latestAlert = alerts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  switch (latestAlert.type) {
    case "price_spike":
    case "price_spike_long":
    case "mover":
      return latestAlert.priceChangePercent && latestAlert.priceChangePercent >= 0
        ? "text-green-500"
        : "text-red-500";
    case "loser":
      return "text-red-500";
    case "volume_spike":
    case "boost":
      return "text-blue-400";
    case "new_token":
      return "text-purple-500";
    default:
      return "text-gray-400";
  }
}

// ====== MAIN COMPONENT ======
export default function TokenScreener() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"all" | "favorites" | "baseAI" | "alerts" | "new">("all");
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
    [symbol: string]: { volume: number; price: number; priceLong: number; boost: number; new: number };
  }>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlerts, setSelectedAlerts] = useState<Alert[] | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenLogo, setTokenLogo] = useState("");
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showFavoritePopup, setShowFavoritePopup] = useState(false);
  const [indexHistory, setIndexHistory] = useState<{ timestamp: Date; value: number }[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [initialTokenSnapshot, setInitialTokenSnapshot] = useState<string[]>([]);
  const pageSize = 25;

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

  // Ensure component is mounted on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const favoritesQuery = query(collection(firestoreDb, `users/${currentUser.uid}/favorites`));
        onSnapshot(favoritesQuery, (snapshot) => {
          const favs = snapshot.docs.map((doc) => doc.id);
          setFavorites(favs);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Viewer Count
  useEffect(() => {
    setViewerCount(0);
  }, []);

  // Fetch Tokens from Firebase and DexScreener
  useEffect(() => {
    const tokensQuery = query(collection(firestoreDb, "tokens"));
    const unsubscribe = onSnapshot(tokensQuery, async (snapshot) => {
      try {
        setLoading(true);
        setError("");

        const tokenList = snapshot.docs.map((doc) => ({
          pool: doc.data().pool as string,
          symbol: doc.data().symbol as string,
          address: doc.data().address as string,
          name: doc.data().name as string | undefined,
          createdAt: doc.data().createdAt?.toDate().getTime() || 0,
          docId: doc.id,
        }));

        // Store initial token IDs to avoid false new token alerts
        if (initialTokenSnapshot.length === 0) {
          setInitialTokenSnapshot(tokenList.map((token) => token.docId));
        }

        const validTokens = tokenList.filter((token) => /^0x[a-fA-F0-9]{40}$/.test(token.address));
        if (validTokens.length === 0) {
          setError("No valid token addresses found in Firebase.");
          setTokens([]);
          setLoading(false);
          return;
        }

        const tokenChunks: string[][] = [];
        for (let i = 0; i < validTokens.length; i += 10) {
          tokenChunks.push(validTokens.slice(i, i + 10).map((t) => t.address));
        }

        const allResults: TokenData[] = [];
        for (const chunk of tokenChunks) {
          const joinedChunk = chunk.join(",");
          const res = await fetch(
            `https://api.dexscreener.com/tokens/v1/base/${encodeURIComponent(joinedChunk)}`,
            {
              headers: { Accept: "application/json" },
            }
          );
          if (!res.ok) {
            console.error(`API fetch failed for chunk: ${joinedChunk}, status: ${res.status}`);
            continue;
          }
          const data = await res.json();
          if (Array.isArray(data)) {
            allResults.push(
              ...data.map((pair: any) => {
                const firestoreToken = validTokens.find(
                  (t) => t.address.toLowerCase() === pair.baseToken.address.toLowerCase()
                );
                return {
                  pairAddress: firestoreToken?.pool || "",
                  baseToken: {
                    address: pair.baseToken.address || "",
                    name: firestoreToken?.name || pair.baseToken.name || "Unknown",
                    symbol: firestoreToken?.symbol || pair.baseToken.symbol || "UNK",
                  },
                  quoteToken: {
                    address: pair.quoteToken.address || "",
                    name: pair.quoteToken.name || "WETH",
                    symbol: pair.quoteToken.symbol || "WETH",
                  },
                  priceUsd: pair.priceUsd || "0",
                  txns: pair.txns || {
                    h1: { buys: 0, sells: 0 },
                    h6: { buys: 0, sells: 0 },
                    h24: { buys: 0, sells: 0 },
                  },
                  priceChange: pair.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 },
                  volume: pair.volume || { h1: 0, h24: 0 },
                  liquidity: pair.liquidity || { usd: 0 },
                  marketCap: pair.marketCap || 0,
                  fdv: pair.fdv || 0,
                  pairCreatedAt: firestoreToken?.createdAt || pair.pairCreatedAt || 0,
                  info: pair.info ? { imageUrl: pair.info.imageUrl } : undefined,
                };
              })
            );
          }
        }

        if (allResults.length === 0) {
          setTokens(
            validTokens.map((token) => ({
              pairAddress: token.pool || "",
              baseToken: {
                address: token.address,
                name: token.name || "Unknown",
                symbol: token.symbol || "UNK",
              },
              quoteToken: { address: "", name: "WETH", symbol: "WETH" },
              priceUsd: "0",
              txns: { h1: { buys: 0, sells: 0 }, h6: { buys: 0, sells: 0 }, h24: { buys: 0, sells: 0 } },
              priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 },
              volume: { h1: 0, h24: 0 },
              liquidity: { usd: 0 },
              marketCap: 0,
              fdv: 0,
              pairCreatedAt: token.createdAt || 0,
              info: { imageUrl: undefined },
            }))
          );
        } else {
          setTokens(allResults);
        }
      } catch (err) {
        setError("Failed to load tokens from DexScreener API");
        console.error(err);
        setTokens([]);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [initialTokenSnapshot]);

  // Detect New Tokens and Generate Alerts
  useEffect(() => {
    const tokensQuery = query(collection(firestoreDb, "tokens"));
    const unsubscribe = onSnapshot(tokensQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !initialTokenSnapshot.includes(change.doc.id)) {
          const token = change.doc.data();
          const now = Date.now();
          const symbol = token.symbol;
          const pairAddress = token.pool;

          if (!lastAlertTimes[symbol]?.new || now - lastAlertTimes[symbol].new >= COOLDOWN_PERIOD) {
            const alert: Alert = {
              type: "new_token",
              message: `${symbol} is a new token added to the platform!`,
              timestamp: new Date().toISOString(),
              pairAddress,
            };

            addDoc(collection(firestoreDb, "notifications"), {
              ...alert,
              createdAt: serverTimestamp(),
            }).catch((err) => console.error(`Failed to save new token alert for ${symbol}:`, err));

            setAlerts((prev) => [...prev, alert]);
            setLastAlertTimes((prev) => ({
              ...prev,
              [symbol]: {
                ...prev[symbol],
                new: now,
                volume: prev[symbol]?.volume || 0,
                price: prev[symbol]?.price || 0,
                priceLong: prev[symbol]?.priceLong || 0,
                boost: prev[symbol]?.boost || 0,
              },
            }));
            setNotificationCount((prev) => prev + 1);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [initialTokenSnapshot, lastAlertTimes]);

  // Fetch Alerts from Firestore and Clean Up
  useEffect(() => {
    const alertsQuery = query(collection(firestoreDb, "notifications"));
    const unsubscribe = onSnapshot(
      alertsQuery,
      (snapshot) => {
        const now = Date.now();
        const newAlerts: Alert[] = [];
        const alertsPerToken: { [pairAddress: string]: Alert[] } = {};

        snapshot.forEach((doc) => {
          const alert = { id: doc.id, ...doc.data() } as Alert;
          const alertTime = new Date(alert.timestamp).getTime();

          if (now - alertTime <= NOTIFICATION_EXPIRY) {
            const pairAddress = alert.pairAddress || "unknown";
            if (!alertsPerToken[pairAddress]) {
              alertsPerToken[pairAddress] = [];
            }
            alertsPerToken[pairAddress].push(alert);
          } else {
            deleteDoc(doc.ref).catch((err) => console.error(`Failed to delete alert: ${err}`));
          }
        });

        Object.keys(alertsPerToken).forEach((pairAddress) => {
          const tokenAlerts = alertsPerToken[pairAddress];
          tokenAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const limitedAlerts = tokenAlerts.slice(0, MAX_NOTIFICATIONS_PER_TOKEN);
          newAlerts.push(...limitedAlerts);
        });

        setAlerts(newAlerts);
        setNotificationCount(newAlerts.length);
      },
      (err) => {
        console.error("Error fetching alerts:", err);
        setToast("Failed to load alerts");
        setTimeout(() => setToast(""), 2000);
      }
    );
    return () => unsubscribe();
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
        const tokenAlerts = alerts.filter((a) => a.pairAddress === pairAddress).length;

        if (tokenAlerts >= MAX_NOTIFICATIONS_PER_TOKEN) return;

        newPrices[symbol] = currentPrice;

        const lastTimes = lastAlertTimes[symbol] || { volume: 0, price: 0, priceLong: 0, boost: 0, new: 0 };

        const volumeSpikeThresholdMarketCap = marketCap * 0.1;
        const volumeSpikeThresholdLiquidity = liquidity * 0.5;
        if (
          (volumeH1 > volumeSpikeThresholdMarketCap || volumeH1 > volumeSpikeThresholdLiquidity) &&
          now - lastTimes.volume >= COOLDOWN_PERIOD &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR &&
          tokenAlerts < MAX_NOTIFICATIONS_PER_TOKEN
        ) {
          const alert: Alert = {
            type: "volume_spike",
            message: `${symbol} volume spiked to $${volumeH1.toLocaleString()} in the last hour.`,
            timestamp: new Date().toISOString(),
            pairAddress,
          };
          newAlerts.push(alert);
          addDoc(collection(firestoreDb, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save volume alert for ${symbol}:`, err));
          setLastAlertTimes((prev) => ({
            ...prev,
            [symbol]: {
              ...prev[symbol],
              volume: now,
              price: prev[symbol]?.price || 0,
              priceLong: prev[symbol]?.priceLong || 0,
              boost: prev[symbol]?.boost || 0,
              new: prev[symbol]?.new || 0,
            },
          }));
          setNotificationCount((prev) => prev + 1);
        }

        const priceChangePercent =
          previousPrice !== 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
        if (
          liquidity >= 50000 &&
          Math.abs(priceChangePercent) >= 3 &&
          now - lastTimes.price >= COOLDOWN_PERIOD &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR &&
          tokenAlerts < MAX_NOTIFICATIONS_PER_TOKEN
        ) {
          const alert: Alert = {
            type: "price_spike",
            message: `${symbol} is ${priceChangePercent > 0 ? "up" : "down"} ${Math.abs(
              priceChangePercent
            ).toFixed(2)}% in the last 5 minutes.`,
            timestamp: new Date().toISOString(),
            priceChangePercent,
            pairAddress,
          };
          newAlerts.push(alert);
          addDoc(collection(firestoreDb, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save price alert for ${symbol}:`, err));
          setLastAlertTimes((prev) => ({
            ...prev,
            [symbol]: {
              ...prev[symbol],
              price: now,
              volume: prev[symbol]?.volume || 0,
              priceLong: prev[symbol]?.priceLong || 0,
              boost: prev[symbol]?.boost || 0,
              new: prev[symbol]?.new || 0,
            },
          }));
          setNotificationCount((prev) => prev + 1);
        }

        if (
          liquidity >= 50000 &&
          Math.abs(priceChange6h) >= 10 &&
          now - lastTimes.priceLong >= LONG_COOLDOWN_PERIOD &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR &&
          tokenAlerts < MAX_NOTIFICATIONS_PER_TOKEN
        ) {
          const alert: Alert = {
            type: "price_spike_long",
            message: `${symbol} is ${priceChange6h > 0 ? "up" : "down"} ${Math.abs(priceChange6h).toFixed(
              2
            )}% in the last 6 hours.`,
            timestamp: new Date().toISOString(),
            priceChangePercent: priceChange6h,
            pairAddress,
          };
          newAlerts.push(alert);
          addDoc(collection(firestoreDb, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save long-term price alert for ${symbol}:`, err));
          setLastAlertTimes((prev) => ({
            ...prev,
            [symbol]: {
              ...prev[symbol],
              priceLong: now,
              volume: prev[symbol]?.volume || 0,
              price: prev[symbol]?.price || 0,
              boost: prev[symbol]?.boost || 0,
              new: prev[symbol]?.new || 0,
            },
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
  }, [tokens, previousPrices, lastAlertTimes, notificationCount, alerts]);

  // Boost Alerts
  useEffect(() => {
    async function checkBoostAlerts() {
      const now = Date.now();
      if (notificationCount >= MAX_NOTIFICATIONS_PER_HOUR) return;

      try {
        const boostedTokens = await getDocs(collection(firestoreDb, "boosts"));
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
          .slice(0, 1);

        if (boostAlerts.length > 0) {
          setAlerts((prev) => [...prev, ...boostAlerts]);
          for (const alert of boostAlerts) {
            await addDoc(collection(firestoreDb, "notifications"), {
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
        const tokenAlerts = alerts.filter((a) => a.pairAddress === token.pairAddress).length;
        if (
          priceChange > 0 &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR &&
          tokenAlerts < MAX_NOTIFICATIONS_PER_TOKEN
        ) {
          const alert: Alert = {
            type: "mover",
            message: `${token.baseToken.symbol} is up ${priceChange.toFixed(2)}% in the last hour.`,
            timestamp: new Date().toISOString(),
            pairAddress: token.pairAddress,
            priceChangePercent: priceChange,
          };
          newAlerts.push(alert);
          addDoc(collection(firestoreDb, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save mover alert for ${token.baseToken.symbol}:`, err));
          setNotificationCount((prev) => prev + 1);
        }
      });

      topLosers.forEach((token) => {
        const priceChange = token.priceChange?.h1 ?? 0;
        const tokenAlerts = alerts.filter((a) => a.pairAddress === token.pairAddress).length;
        if (
          priceChange < 0 &&
          notificationCount < MAX_NOTIFICATIONS_PER_HOUR &&
          tokenAlerts < MAX_NOTIFICATIONS_PER_TOKEN
        ) {
          const alert: Alert = {
            type: "loser",
            message: `${token.baseToken.symbol} is down ${Math.abs(priceChange).toFixed(2)}% in the last hour.`,
            timestamp: new Date().toISOString(),
            pairAddress: token.pairAddress,
            priceChangePercent: priceChange,
          };
          newAlerts.push(alert);
          addDoc(collection(firestoreDb, "notifications"), {
            ...alert,
            createdAt: serverTimestamp(),
          }).catch((err) => console.error(`Failed to save loser alert for ${token.baseToken.symbol}:`, err));
          setNotificationCount((prev) => prev + 1);
        }
      });

      setAlerts((prev) => [...prev, ...newAlerts]);
    }

    const interval = setInterval(() => {
      const currentTime = new Date();
      if (currentTime.getMinutes() % 5 === 0) {
        checkTopMoversAndLosers();
      }
    }, TOP_MOVERS_LOSERS_INTERVAL);
    return () => clearInterval(interval);
  }, [tokens, notificationCount, alerts]);

  // Update Base AI Index History
  useEffect(() => {
    if (!isMounted) return;
    const updateIndexHistory = () => {
      const indexValue = tokens.reduce((sum, token) => {
        return sum + (parseFloat(token.priceUsd || "0") * (token.weight || 0));
      }, 0);
      setIndexHistory((prev) => [
        ...prev.slice(-59),
        { timestamp: new Date(), value: indexValue },
      ]);
    };
    updateIndexHistory();
    const interval = setInterval(updateIndexHistory, 300_000);
    return () => clearInterval(interval);
  }, [tokens, isMounted]);

  // Apply Trending Scores
  const tokensWithTrending = useMemo(() => {
    return tokens.map((token) => ({
      ...token,
      trendingScore: computeTrending(token, token.boostValue || 0),
    }));
  }, [tokens]);

  // Sorting & Filtering
  const filteredTokens = useMemo(() => {
    let tokenList = tokensWithTrending;
    if (viewMode === "favorites") {
      tokenList = tokenList.filter((token) => favorites.includes(token.pairAddress));
    } else if (viewMode === "baseAI") {
      tokenList = tokenList.filter((token) =>
        BASE_AI_TOKEN_SYMBOLS.includes(token.baseToken.symbol.toUpperCase())
      );
      tokenList = tokenList.map((token) => {
        const baseAiToken = baseAiTokens.find(
          (t) => t.symbol.toUpperCase() === token.baseToken.symbol.toUpperCase()
        );
        return {
          ...token,
          weight: baseAiToken ? parseFloat(baseAiToken.weight.replace("%", "")) : 0,
        };
      });
    } else if (viewMode === "new") {
      tokenList = tokenList.filter(
        (token) =>
          token.pairCreatedAt && Date.now() - token.pairCreatedAt <= 24 * 60 * 60 * 1000
      );
    } else if (viewMode === "alerts") {
      tokenList = tokenList.filter((token) =>
        alerts.some((alert) => alert.pairAddress === token.pairAddress)
      );
    }
    return tokenList.filter((token) => {
      const ageDays = token.pairCreatedAt
        ? (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60 * 24)
        : 0;
      return (
        (token.liquidity?.usd || 0) >= (filters.minLiquidity || 0) &&
        (token.volume?.h24 || 0) >= (filters.minVolume || 0) &&
        ageDays >= (filters.minAge || 0) &&
        (filters.maxAge === Infinity || ageDays <= filters.maxAge) &&
        (searchQuery === "" ||
          token.baseToken.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.baseToken.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });
  }, [tokensWithTrending, filters, viewMode, favorites, searchQuery, alerts]);

  const sortedTokens = useMemo(() => {
    const copy = [...filteredTokens];
    if (viewMode === "baseAI") {
      copy.sort((a, b) => (b.weight || 0) - (a.weight || 0));
      return copy.slice(0, 10);
    } else if (sortFilter === "trending") {
      copy.sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
      return sortDirection === "asc" ? copy.reverse() : copy;
    } else if (sortFilter === "volume") {
      copy.sort((a, b) =>
        sortDirection === "desc"
          ? (b.volume?.h24 || 0) - (a.volume?.h24 || 0)
          : (a.volume?.h24 || 0) - (b.volume?.h24 || 0)
      );
    } else if (sortFilter === "liquidity") {
      copy.sort((a, b) =>
        sortDirection === "desc"
          ? (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          : (a.liquidity?.usd || 0) - (b.liquidity?.usd || 0)
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
      let key: "m5" | "h1" | "h6" | "h24" = "h1";
      if (sortFilter === "5m") key = "m5";
      else if (sortFilter === "6h") key = "h6";
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
        borderColor: "rgba(59, 130, 246, 1)", // blue-400
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
        title: { display: true, text: "TIME" },
      },
      y: {
        title: { display: true, text: "INDEX VALUE (USD)" },
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
        setShowFavoritePopup(true);
        return;
      }
      const isFavorited = favorites.includes(pairAddress);
      try {
        const favoriteDocRef = doc(firestoreDb, `users/${user.uid}/favorites`, pairAddress);
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
        setFavorites((prev) => (isFavorited ? [...prev, pairAddress] : prev.filter((fav) => fav !== pairAddress)));
        setToast("Error updating favorites");
        setTimeout(() => setToast(""), 2000);
      }
    },
    [user, favorites]
  );

  const handleTokenClick = useCallback(
    (pool: string) => {
      if (!pool || !/^0x[a-fA-F0-9]{40}$/.test(pool)) {
        console.error("Invalid pool address for navigation:", pool);
        setToast("Invalid token address. Please try again.");
        setTimeout(() => setToast(""), 2000);
        return;
      }

      const targetUrl = `/token-scanner/${pool}/chart`;
      console.log("Attempting navigation to:", targetUrl);

      try {
        router.push(targetUrl);
        console.log("Navigation initiated successfully to:", targetUrl);

        setTimeout(() => {
          if (window.location.pathname !== targetUrl) {
            console.warn("Router navigation failed, falling back to window.location.href");
            window.location.href = targetUrl;
          }
        }, 1000);
      } catch (err) {
        console.error("Navigation error:", err);
        setToast("Failed to navigate to chart page. Using fallback navigation.");
        setTimeout(() => setToast(""), 2000);
        window.location.href = targetUrl;
      }
    },
    [router]
  );

  const handleBoostNow = () => {
    setShowBoostModal(false);
    router.push("/marketplace");
  };

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

  const handleFilterChange = useCallback(
    (filter: string) => {
      if (sortFilter === filter) {
        setSortDirection(sortDirection === "desc" ? "asc" : "desc");
      } else {
        setSortFilter(filter);
        setSortDirection("desc");
      }
      setCurrentPage(1);
    },
    [sortFilter, sortDirection]
  );

  const debouncedSetCurrentPage = useCallback(
    debounce((page: number) => setCurrentPage(page), 300),
    []
  );

  const indexOfLastToken = currentPage * pageSize;
  const indexOfFirstToken = indexOfLastToken - pageSize;
  const currentTokens = sortedTokens.slice(indexOfFirstToken, indexOfLastToken);
  const totalPages = Math.ceil(sortedTokens.length / pageSize);

  // Animation variants for table rows
  const rowVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  // Render
  if (!isMounted) {
    return (
      <div className="w-screen h-screen bg-gray-950 text-gray-200 font-sans m-0 p-0 overflow-hidden">
        <div className="flex flex-col w-full h-full">
          <div className="sticky top-0 z-50 bg-gray-900 shadow-lg w-full border-b border-blue-500/30 h-16"></div>
          <div className="bg-gray-900 p-3 sm:p-4 border-b border-blue-500/30 shadow-inner h-16"></div>
          <div className="flex-1 flex flex-col overflow-x-auto overflow-y-auto">
            <div className="p-4 text-center text-gray-400 font-sans uppercase">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-gray-950 text-gray-200 font-sans m-0 p-0 overflow-hidden">
      {error && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-gray-200 font-sans py-2 px-4 rounded-lg shadow-xl z-50 border border-blue-500/30 uppercase">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-sm font-bold">
            ×
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-gray-200 py-2 px-4 rounded-lg shadow-xl z-50 border border-blue-500/30 font-sans uppercase">
          {toast}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-gray-900 text-gray-200 p-6 rounded-lg shadow-xl w-80 border border-blue-500/30">
            <button onClick={closeModal} className="absolute top-2 right-2 text-xl font-bold font-sans">
              ×
            </button>
            {!submissionSuccess ? (
              <>
                <h2 className="text-xl font-bold mb-4 font-sans uppercase">Submit Token Listing</h2>
                <form onSubmit={handleSubmitListing}>
                  <div className="mb-4">
                    <label className="block mb-1 font-sans uppercase">Token Symbol</label>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      className="w-full border border-blue-500/30 p-2 rounded font-sans bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                      required
                      maxLength={10}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block mb-1 font-sans uppercase">Token Address</label>
                    <input
                      type="text"
                      value={tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                      className="w-full border border-blue-500/30 p-2 rounded font-sans bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                      required
                      placeholder="0x..."
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block mb-1 font-sans uppercase">Logo URL</label>
                    <input
                      type="url"
                      value={tokenLogo}
                      onChange={(e) => setTokenLogo(e.target.value)}
                      className="w-full border border-blue-500/30 p-2 rounded font-sans bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                      required
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="bg-gray-900 hover:bg-gray-800 text-gray-200 py-2 px-4 rounded font-sans border border-blue-500/30 uppercase"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      type="submit"
                      className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 py-2 px-4 rounded font-sans uppercase border border-blue-500/30"
                    >
                      Submit
                    </motion.button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center">
                <h2 className="text-xl font-bold mb-4 font-sans uppercase">Token Listing Submitted!</h2>
                <p className="mb-4 text-sm font-sans uppercase">
                  Your token has been submitted for review. We’ll notify you once it’s listed!
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={closeModal}
                  className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 py-2 px-4 rounded font-sans uppercase border border-blue-500/30"
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
          <div className="relative bg-gray-900 text-gray-200 p-6 rounded-lg shadow-xl w-80 border border-blue-500/30">
            <h2 className="text-xl font-bold mb-4 font-sans uppercase">Boost Info</h2>
            <p className="text-sm mb-4 font-sans uppercase">
              Purchase a boost with USDC on our website to increase your token's visibility. Boosts add a score to your
              token's trending rank:
            </p>
            <ul className="text-sm mb-4 list-disc list-inside font-sans uppercase">
              {boostInfo.map((info) => (
                <li key={info.boost} className="font-sans uppercase">
                  Boost ({info.boost}) - {info.cost} USDC ({info.duration})
                </li>
              ))}
              <li className="font-sans uppercase">Ad ({adInfo.type}) - {adInfo.cost} USDC</li>
            </ul>
            <p className="text-sm mb-4 font-sans uppercase">
              Once the transaction is confirmed, your token will appear boosted in the screener!
            </p>
            <div className="flex justify-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBoostNow}
                className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 py-2 px-4 rounded font-sans uppercase border border-blue-500/30"
              >
                Boost Now
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {showFavoritePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-gray-900 text-gray-200 p-6 rounded-lg shadow-xl w-80 border border-blue-500/30">
            <button
              onClick={() => setShowFavoritePopup(false)}
              className="absolute top-2 right-2 text-xl font-bold font-sans"
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4 font-sans uppercase">Authentication Required</h2>
            <p className="text-sm mb-4 font-sans uppercase">Please sign in to favorite a token.</p>
            <div className="flex flex-col space-y-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowFavoritePopup(false);
                  router.push("/login");
                }}
                className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 py-2 px-4 rounded w-full font-sans uppercase border border-blue-500/30"
              >
                Sign In
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFavoritePopup(false)}
                className="bg-gray-900 hover:bg-gray-800 text-gray-200 py-2 px-4 rounded w-full font-sans border border-blue-500/30 uppercase"
              >
                Cancel
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {selectedAlerts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-gray-200 p-8 rounded-lg shadow-xl w-[448px] border border-blue-500/30">
            <h2 className="text-xl font-bold mb-4 font-sans uppercase">Alerts ({selectedAlerts.length})</h2>
            <ul className="space-y-3 max-h-96 overflow-y-auto">
              {selectedAlerts.map((alert, idx) => {
                const token = tokens.find((t) => t.pairAddress === alert.pairAddress);
                const colorClass =
                  alert.type === "new_token"
                    ? "text-purple-500"
                    : alert.type === "volume_spike" || alert.type === "boost"
                    ? "text-blue-400"
                    : alert.type === "mover" || (alert.priceChangePercent && alert.priceChangePercent >= 0)
                    ? "text-green-500"
                    : "text-red-500";
                return (
                  <li key={idx} className="text-sm font-sans flex items-center space-x-3 uppercase">
                    {token && token.info && (
                      <img
                        src={token.info.imageUrl || "/fallback.png"}
                        alt={token.baseToken.symbol}
                        className="w-6 h-6 rounded-full border border-blue-500/30"
                      />
                    )}
                    <div>
                      <span className="font-bold">{alert.type.replace("_", " ").toUpperCase()}:</span>{" "}
                      <span className={colorClass}>{alert.message}</span>
                      <br />
                      <span className="text-xs text-gray-400 font-sans uppercase">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedAlerts(null)}
                className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 py-2 px-4 rounded font-sans uppercase border border-blue-500/30"
              >
                Close
              </motion.button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col w-full h-full">
        <div className="sticky top-0 z-50 bg-gray-900 shadow-lg w-full border-b border-blue-500/30">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 space-y-2 sm:space-y-0">
            <div className="flex flex-row items-center space-x-4">
              <div className="flex items-center space-x-2 bg-gray-900 border border-blue-500/30 rounded-lg px-4 py-2 shadow-inner">
                <span className="text-blue-400 animate-pulse font-sans uppercase" title="Live Pulse">
                  ●
                </span>
                <div className="text-sm sm:text-base text-gray-200 font-sans flex items-center space-x-2 uppercase">
                  <span>LIVE {viewerCount} Traders</span>
                  <span className="flex items-center">
                    <FaBell className={`inline mr-1 ${getBellColor(alerts)}`} />
                    <span className={alerts.length === 0 ? "text-gray-400" : ""}>{notificationCount}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative w-full sm:w-80">
                <div className="flex items-center bg-gray-900 rounded-lg px-3 py-2 border border-blue-500/30 w-full h-9 shadow-sm">
                  <FaSearch className="text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search tokens..."
                    onChange={(e) => debouncedSetSearchQuery(e.target.value)}
                    onFocus={() => setShowSearchDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                    className="bg-transparent text-gray-200 focus:outline-none text-sm font-sans w-full p-1 touch-friendly h-6 placeholder-gray-400 uppercase"
                  />
                </div>
                {showSearchDropdown && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-gray-900 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto border border-blue-500/30">
                    {searchSuggestions.map((token) => (
                      <div
                        key={token.pairAddress}
                        onClick={() => {
                          setSearchQuery("");
                          setShowSearchDropdown(false);
                          handleTokenClick(token.pairAddress);
                        }}
                        className="flex items-center space-x-3 p-3 hover:bg-gray-800 cursor-pointer transition-colors duration-150"
                      >
                        {token.info && (
                          <img
                            src={token.info.imageUrl || "/fallback.png"}
                            alt={token.baseToken.symbol}
                            className="w-6 h-6 rounded-full border border-blue-500/30"
                          />
                        )}
                        <span className="text-sm font-sans truncate text-gray-200 uppercase">
                          {token.baseToken.name} / {token.quoteToken.symbol} ({token.baseToken.symbol})
                        </span>
                        <span className="text-sm text-gray-400 ml-auto font-sans uppercase">
                          {formatPrice(token.priceUsd)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowBoostModal(true)}
                className="flex items-center space-x-2 bg-gray-900 border border-blue-500/30 text-gray-200 text-sm font-sans whitespace-nowrap px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm uppercase"
              >
                <FaBolt className="text-blue-400" />
                <span>[Boost Info]</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowModal(true)}
                className="flex items-center space-x-2 bg-gray-900 border border-blue-500/30 text-gray-200 text-sm font-sans whitespace-nowrap px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm uppercase"
              >
                <FaPlusCircle className="text-blue-400" />
                <span>[Submit Listing]</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/account")}
                className="flex items-center space-x-2 bg-gray-900 border border-blue-500/30 text-gray-200 text-sm font-sans whitespace-nowrap px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm uppercase"
              >
                <FaUser className="text-gray-200" />
                <span>[Account]</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReturn}
                className="flex items-center space-x-2 bg-gray-900 border border-blue-500/30 text-gray-200 text-sm font-sans whitespace-nowrap px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm uppercase"
              >
                <span>[Return]</span>
              </motion.button>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 border-b border-blue-500/30 shadow-inner">
          <div className="flex flex-col sm:flex-row gap-2 w-full items-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode("all")}
              className={`p-2 text-gray-200 rounded-lg text-sm sm:text-base w-full sm:w-auto font-sans transition-colors shadow-sm border border-blue-500/30 truncate uppercase ${
                viewMode === "all" ? "bg-blue-500/20 text-blue-400" : "bg-gray-900 hover:bg-gray-800"
              }`}
              title="All Tokens"
            >
              All Tokens
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode("favorites")}
              className={`p-2 text-gray-200 rounded-lg text-sm sm:text-base w-full sm:w-auto font-sans transition-colors shadow-sm border border-blue-500/30 truncate uppercase ${
                viewMode === "favorites" ? "bg-blue-500/20 text-blue-400" : "bg-gray-900 hover:bg-gray-800"
              }`}
              title="Favorites"
            >
              Favorites
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode("baseAI")}
              className={`p-2 text-gray-200 rounded-lg text-sm sm:text-base w-full sm:w-auto font-sans transition-colors shadow-sm border border-blue-500/30 truncate uppercase ${
                viewMode === "baseAI" ? "bg-blue-500/20 text-blue-400" : "bg-gray-900 hover:bg-gray-800"
              }`}
              title="Base AI Index"
            >
              Base AI Index
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode("alerts")}
              className={`p-2 text-gray-200 rounded-lg text-sm sm:text-base w-full sm:w-auto font-sans transition-colors shadow-sm border border-blue-500/30 truncate uppercase ${
                viewMode === "alerts" ? "bg-red-500/20 text-red-400" : "bg-gray-900 hover:bg-gray-800"
              }`}
              title="Alerts"
            >
              Alerts
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setViewMode("new")}
              className={`p-2 text-gray-200 rounded-lg text-sm sm:text-base w-full sm:w-auto font-sans transition-colors shadow-sm border border-blue-500/30 truncate uppercase ${
                viewMode === "new" ? "bg-blue-500/20 text-blue-400" : "bg-gray-900 hover:bg-gray-800"
              }`}
              title="New Tokens"
            >
              New Tokens
            </motion.button>
            <motion.button
              disabled
              className="p-2 text-gray-400 rounded-lg text-sm sm:text-base w-full sm:w-auto font-sans transition-colors shadow-sm border border-blue-500/30 bg-gray-900 opacity-50 cursor-not-allowed truncate uppercase"
              title="New Pairs v2 (Locked)"
            >
              New Pairs v2
            </motion.button>

            {/* Mobile Filters (Dropdowns) */}
            <div className="sm:hidden flex flex-col gap-2 w-full">
              <select
                value={filters.minLiquidity || 0}
                onChange={(e) => setFilters({ ...filters, minLiquidity: Number(e.target.value) })}
                className="p-2 bg-gray-900 text-gray-200 border border-blue-500/30 rounded-lg text-sm font-sans shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                title="Minimum Liquidity ($)"
              >
                <option value={0}>Min Liq ($): Any</option>
                <option value={1000}>$1,000</option>
                <option value={5000}>$5,000</option>
                <option value={10000}>$10,000</option>
                <option value={50000}>$50,000</option>
              </select>
              <select
                value={filters.minVolume || 0}
                onChange={(e) => setFilters({ ...filters, minVolume: Number(e.target.value) })}
                className="p-2 bg-gray-900 text-gray-200 border border-blue-500/30 rounded-lg text-sm font-sans shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                title="Minimum Volume ($)"
              >
                <option value={0}>Min Vol ($): Any</option>
                <option value={1000}>$1,000</option>
                <option value={5000}>$5,000</option>
                <option value={10000}>$10,000</option>
                <option value={50000}>$50,000</option>
              </select>
              <select
                value={filters.minAge || 0}
                onChange={(e) => setFilters({ ...filters, minAge: Number(e.target.value) })}
                className="p-2 bg-gray-900 text-gray-200 border border-blue-500/30 rounded-lg text-sm font-sans shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                title="Minimum Age (days)"
              >
                <option value={0}>Min Age (d): Any</option>
                                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
              <select
                value={filters.maxAge === Infinity ? "Infinity" : filters.maxAge}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    maxAge: e.target.value === "Infinity" ? Infinity : Number(e.target.value),
                  })
                }
                className="p-2 bg-gray-900 text-gray-200 border border-blue-500/30 rounded-lg text-sm font-sans shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                title="Maximum Age (days)"
              >
                <option value="Infinity">Max Age (d): Any</option>
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            {/* Desktop Filters (Inputs) */}
            <div className="hidden sm:flex gap-2">
              <input
                type="number"
                placeholder="Min Liq ($)"
                value={filters.minLiquidity || ""}
                onChange={(e) => setFilters({ ...filters, minLiquidity: Number(e.target.value) })}
                className="p-2 bg-gray-900 text-gray-200 border border-blue-500/30 rounded-lg text-sm sm:text-base w-full sm:w-32 font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                title="Minimum Liquidity ($)"
              />
              <input
                type="number"
                placeholder="Min Vol ($)"
                value={filters.minVolume || ""}
                onChange={(e) => setFilters({ ...filters, minVolume: Number(e.target.value) })}
                className="p-2 bg-gray-900 text-gray-200 border border-blue-500/30 rounded-lg text-sm sm:text-base w-full sm:w-32 font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                title="Minimum Volume ($)"
              />
              <input
                type="number"
                placeholder="Min Age (d)"
                value={filters.minAge || ""}
                onChange={(e) => setFilters({ ...filters, minAge: Number(e.target.value) })}
                className="p-2 bg-gray-900 text-gray-200 border border-blue-500/30 rounded-lg text-sm sm:text-base w-full sm:w-32 font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                title="Minimum Age (days)"
              />
              <input
                type="number"
                placeholder="Max Age (d)"
                value={filters.maxAge === Infinity ? "" : filters.maxAge}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    maxAge: e.target.value ? Number(e.target.value) : Infinity,
                  })
                }
                className="p-2 bg-gray-900 text-gray-200 border border-blue-500/30 rounded-lg text-sm sm:text-base w-full sm:w-32 font-sans placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                title="Maximum Age (days)"
              />
            </div>
          </div>
        </div>

        {viewMode === "baseAI" && (
          <div className="bg-gray-900 p-4 border-b border-blue-500/30 shadow-inner">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-gray-900 p-3 rounded-lg border border-blue-500/30 shadow-sm">
                <p className="text-sm font-sans text-gray-400 uppercase">Total Volume (24h)</p>
                <p className="text-lg font-sans text-gray-200 uppercase">${indexMetrics.totalVolume.toLocaleString()}</p>
              </div>
              <div className="bg-gray-900 p-3 rounded-lg border border-blue-500/30 shadow-sm">
                <p className="text-sm font-sans text-gray-400 uppercase">Total Market Cap</p>
                <p className="text-lg font-sans text-gray-200 uppercase">${indexMetrics.totalMarketCap.toLocaleString()}</p>
              </div>
              <div className="bg-gray-900 p-3 rounded-lg border border-blue-500/30 shadow-sm">
                <p className="text-sm font-sans text-gray-400 uppercase">Avg. Price Change (24h)</p>
                <p className={`text-lg font-sans ${getColorClass(indexMetrics.avgPriceChange)} uppercase`}>
                  {indexMetrics.avgPriceChange.toFixed(2)}%
                </p>
              </div>
              <div className="bg-gray-900 p-3 rounded-lg border border-blue-500/30 shadow-sm">
                <p className="text-sm font-sans text-gray-400 uppercase">Token Count</p>
                <p className="text-lg font-sans text-gray-200 uppercase">{indexMetrics.tokenCount}</p>
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-semibold font-sans text-gray-200 uppercase">Index Growth</h3>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-x-auto overflow-y-auto">
          {loading ? (
            <div className="p-4">
              <table className="table-auto w-full whitespace-nowrap text-sm font-sans uppercase">
                <thead className="bg-gray-900 text-gray-400 sticky top-0 z-10 border-b border-blue-500/30">
                  <tr>
                    <th className="p-3 text-left" title="Rank by trending score">
                      #
                    </th>
                    <th className="p-3 text-left" title="Token Pair">
                      POOL
                    </th>
                    <th className="p-3 text-right" title="Price in USD">
                      PRICE
                    </th>
                    <th className="p-3 text-right" title="Age of the token pair">
                      AGE
                    </th>
                    <th className="p-3 text-right" title="Total transactions in 24 hours">
                      TXN
                    </th>
                    <th className="p-3 text-right" title="Price change in last 5 minutes">
                      5M
                    </th>
                    <th className="p-3 text-right" title="Price change in last 1 hour">
                      1H
                    </th>
                    <th className="p-3 text-right" title="Price change in last 6 hours">
                      6H
                    </th>
                    <th className="p-3 text-right" title="Price change in last 24 hours">
                      24H
                    </th>
                    <th className="p-3 text-right" title="Trading volume in last 24 hours">
                      VOLUME
                    </th>
                    <th className="p-3 text-right" title="Liquidity in USD">
                      LIQUIDITY
                    </th>
                    <th className="p-3 text-right" title="Market capitalization">
                      MKT CAP
                    </th>
                    <th className="p-3 text-center" title="Alerts">
                      ALERTS
                    </th>
                    <th className="p-3 text-center" title="Actions">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <SkeletonRow key={index} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredTokens.length === 0 && viewMode !== "alerts" ? (
            <div className="p-4 text-center text-gray-400 font-sans uppercase">
              No tokens match your filters. Try adjusting filters or check Firebase data.
            </div>
          ) : viewMode === "alerts" ? (
            <div className="w-full h-full bg-gray-900 overflow-y-auto">
              <div className="p-4 border-b border-blue-500/30">
                <h2 className="text-xl font-bold font-sans text-gray-200 uppercase">Alerts Feed</h2>
              </div>
              {alerts.length === 0 ? (
                <p className="p-4 text-gray-400 font-sans uppercase">No recent alerts.</p>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((alert, idx) => {
                    const token = tokens.find((t) => t.pairAddress === alert.pairAddress);
                    const colorClass =
                      alert.type === "new_token"
                        ? "text-purple-500"
                        : alert.type === "volume_spike" || alert.type === "boost"
                        ? "text-blue-400"
                        : alert.type === "mover" || (alert.priceChangePercent && alert.priceChangePercent >= 0)
                        ? "text-green-500"
                        : "text-red-500";

                    // Extract the numeric part (e.g., % change or $ spike) for coloring
                    const messageParts = alert.message.split(/(\d+\.?\d*)/);
                    const formattedMessage = messageParts.map((part, index) => {
                      if (/^\d+\.?\d*$/.test(part)) {
                        if (alert.type === "volume_spike") {
                          return <span key={index} className="text-blue-400">{part}</span>;
                        }
                        if (alert.priceChangePercent !== undefined) {
                          return (
                            <span key={index} className={getColorClass(alert.priceChangePercent)}>
                              {part}
                            </span>
                          );
                        }
                      }
                      return <span key={index}>{part}</span>;
                    });

                    return (
                      <li
                        key={idx}
                        className="flex items-center justify-between p-3 hover:bg-gray-800 transition-colors duration-150 border-b border-blue-500/30"
                      >
                        <div className="flex items-center space-x-3">
                          {token && token.info && (
                            <img
                              src={token.info.imageUrl || "/fallback.png"}
                              alt={token.baseToken.symbol}
                              className="w-6 h-6 rounded-full border border-blue-500/30"
                            />
                          )}
                          <div>
                            <p className="text-sm font-sans uppercase">
                              <span className="font-bold">{alert.type.replace("_", " ").toUpperCase()}:</span>{" "}
                              {formattedMessage}
                            </p>
                            <p className="text-xs text-gray-400 font-sans uppercase">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {token && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleTokenClick(token.pairAddress)}
                            className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 px-3 py-1 rounded font-sans text-sm uppercase border border-blue-500/30"
                          >
                            View
                          </motion.button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <table className="table-auto w-full whitespace-nowrap text-sm font-sans uppercase">
                  <thead className="bg-gray-900 text-gray-400 sticky top-0 z-10 border-b border-blue-500/30">
                    <tr>
                      <th
                        className="p-3 text-left cursor-pointer w-[140px] hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("trending")}
                        title="Rank by trending score"
                      >
                        #{sortFilter === "trending" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th className="p-3 text-left" title="Token Pair">
                        POOL
                      </th>
                      <th className="p-3 text-right" title="Price in USD">
                        PRICE
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("age")}
                        title="Age of the token pair"
                      >
                        AGE{sortFilter === "age" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th className="p-3 text-right" title="Total transactions in 24 hours">
                        TXN
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("5m")}
                        title="Price change in last 5 minutes"
                      >
                        5M{sortFilter === "5m" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("1h")}
                        title="Price change in last 1 hour"
                      >
                        1H{sortFilter === "1h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("6h")}
                        title="Price change in last 6 hours"
                      >
                        6H{sortFilter === "6h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("24h")}
                        title="Price change in last 24 hours"
                      >
                        24H{sortFilter === "24h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("volume")}
                        title="Trading volume in last 24 hours"
                      >
                        VOLUME{sortFilter === "volume" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("liquidity")}
                        title="Liquidity in USD"
                      >
                        LIQUIDITY{sortFilter === "liquidity" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-3 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("marketCap")}
                        title="Market capitalization"
                      >
                        MKT CAP{sortFilter === "marketCap" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th className="p-3 text-center" title="Alerts">
                        ALERTS
                      </th>
                      <th className="p-3 text-center" title="Actions">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTokens.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-4 text-center text-gray-400 font-sans uppercase">
                          No tokens available for this page. Try adjusting filters or check Firebase/DexScreener data.
                        </td>
                      </tr>
                    ) : (
                      currentTokens.map((token, index) => {
                        const rank = indexOfFirstToken + index + 1;
                        const tokenAlerts = alerts.filter((alert) => alert.pairAddress === token.pairAddress);
                        if (!/^0x[a-fA-F0-9]{40}$/.test(token.pairAddress)) {
                          console.warn(`Invalid pair address: ${token.pairAddress}`);
                          return null;
                        }
                        const isAd = false;
                        return (
                          <motion.tr
                            key={token.pairAddress}
                            className="border-b border-blue-500/30 hover:bg-gradient-to-r hover:from-gray-900 hover:to-gray-800 transition-colors duration-200"
                            variants={rowVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <td className="p-3">
                              <div className="flex items-center space-x-2">
                                <div className="bg-gray-900 rounded-full px-2 py-1 flex items-center justify-center w-12 font-sans text-gray-200 shadow-sm border border-blue-500/30 uppercase">
                                  {getTrophy(rank) || rank}
                                </div>
                                <div className="flex items-center space-x-1">
                                  {token.boosted && (
                                    <>
                                      <MarketingIcon />
                                      <span className="text-blue-400 text-xs uppercase">+{token.boostValue}</span>
                                    </>
                                  )}
                                  {isAd && <AdIcon />}
                                </div>
                              </div>
                            </td>
                            <td className="p-3 font-sans uppercase">
                              <div
                                onClick={() => handleTokenClick(token.pairAddress)}
                                className="flex items-center space-x-2 hover:text-blue-400 cursor-pointer transition-colors duration-150"
                              >
                                {token.info && (
                                  <img
                                    src={token.info.imageUrl || "/fallback.png"}
                                    alt={token.baseToken.symbol}
                                    className="w-6 h-6 rounded-full border border-blue-500/30"
                                  />
                                )}
                                <div>
                                  <span className="font-bold text-gray-200">{token.baseToken.symbol}</span> /{" "}
                                  <span className="text-gray-400">{token.quoteToken.symbol}</span>
                                  <br />
                                  <span className="text-xs text-gray-400">{token.baseToken.name}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-right text-gray-200">{formatPrice(token.priceUsd)}</td>
                            <td className="p-3 text-right text-gray-200">{getAge(token.pairCreatedAt)}</td>
                            <td className="p-3 text-right text-gray-200">{getTxns24h(token)}</td>
                            <td className={`p-3 text-right ${getColorClass(token.priceChange?.m5 || 0)}`}>
                              {(token.priceChange?.m5 || 0).toFixed(2)}%
                            </td>
                            <td className={`p-3 text-right ${getColorClass(token.priceChange?.h1 || 0)}`}>
                              {(token.priceChange?.h1 || 0).toFixed(2)}%
                            </td>
                            <td className={`p-3 text-right ${getColorClass(token.priceChange?.h6 || 0)}`}>
                              {(token.priceChange?.h6 || 0).toFixed(2)}%
                            </td>
                            <td className={`p-3 text-right ${getColorClass(token.priceChange?.h24 || 0)}`}>
                              {(token.priceChange?.h24 || 0).toFixed(2)}%
                            </td>
                            <td className="p-3 text-right text-gray-200">
                              ${(token.volume?.h24 || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-right text-gray-200">
                              ${(token.liquidity?.usd || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-right text-gray-200">
                              ${(token.marketCap || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-center">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setSelectedAlerts(tokenAlerts)}
                                className="px-3 py-1 rounded"
                                title="View Alerts"
                              >
                                <div
                                  className={`bg-gray-800 border border-blue-500/30 rounded-full px-2 py-1 flex items-center justify-center space-x-2 ${getBellColor(
                                    tokenAlerts
                                  )}`}
                                >
                                  <FaBell className="w-4 h-4" />
                                  <span className="text-xs">{tokenAlerts.length}</span>
                                </div>
                              </motion.button>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  onClick={() => toggleFavorite(token.pairAddress)}
                                  className="text-yellow-400"
                                  title={
                                    favorites.includes(token.pairAddress)
                                      ? "Remove from Favorites"
                                      : "Add to Favorites"
                                  }
                                >
                                  <FaStar
                                    className={`w-5 h-5 ${
                                      favorites.includes(token.pairAddress)
                                        ? "text-yellow-400"
                                        : "text-gray-400"
                                    }`}
                                  />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  onClick={() => handleCopy(token.pairAddress)}
                                  className="text-gray-400"
                                  title="Copy Pair Address"
                                >
                                  <FaClipboard className="w-5 h-5" />
                                </motion.button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Table View */}
              <div className="md:hidden">
                <table className="table-auto w-full whitespace-nowrap text-xs font-sans uppercase">
                  <thead className="bg-gray-900 text-gray-400 sticky top-0 z-10 border-b border-blue-500/30">
                    <tr>
                      <th
                        className="p-2 text-left cursor-pointer w-[100px] hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("trending")}
                        title="Rank by trending score"
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
                        className="p-2 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("age")}
                        title="Age of the token pair"
                      >
                        AGE{sortFilter === "age" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th className="p-2 text-right" title="Total transactions in 24 hours">
                        TXN
                      </th>
                      <th
                        className="p-2 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("5m")}
                        title="Price change in last 5 minutes"
                      >
                        5M{sortFilter === "5m" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-2 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("1h")}
                        title="Price change in last 1 hour"
                      >
                        1H{sortFilter === "1h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-2 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("6h")}
                        title="Price change in last 6 hours"
                      >
                        6H{sortFilter === "6h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-2 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("24h")}
                        title="Price change in last 24 hours"
                      >
                        24H{sortFilter === "24h" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-2 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("volume")}
                        title="Trading volume in last 24 hours"
                      >
                        VOL{sortFilter === "volume" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-2 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("liquidity")}
                        title="Liquidity in USD"
                      >
                        LIQ{sortFilter === "liquidity" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th
                        className="p-2 text-right cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => handleFilterChange("marketCap")}
                        title="Market capitalization"
                      >
                        MC{sortFilter === "marketCap" && (sortDirection === "desc" ? " ↓" : " ↑")}
                      </th>
                      <th className="p-2 text-center" title="Alerts">
                        ALT
                      </th>
                      <th className="p-2 text-center" title="Actions">
                        ACT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTokens.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-4 text-center text-gray-400 font-sans uppercase">
                          No tokens available for this page. Try adjusting filters or check Firebase/DexScreener data.
                        </td>
                      </tr>
                    ) : (
                      currentTokens.map((token, index) => {
                        const rank = indexOfFirstToken + index + 1;
                        const tokenAlerts = alerts.filter((alert) => alert.pairAddress === token.pairAddress);
                        if (!/^0x[a-fA-F0-9]{40}$/.test(token.pairAddress)) {
                          console.warn(`Invalid pair address: ${token.pairAddress}`);
                          return null;
                        }
                        const isAd = false;
                        return (
                          <motion.tr
                            key={token.pairAddress}
                            className="border-b border-blue-500/30 hover:bg-gradient-to-r hover:from-gray-900 hover:to-gray-800 transition-colors duration-200"
                            variants={rowVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <td className="p-2">
                              <div className="flex items-center space-x-1">
                                <div className="bg-gray-900 rounded-full px-2 py-1 flex items-center justify-center w-10 font-sans text-gray-200 shadow-sm border border-blue-500/30 uppercase">
                                  {getTrophy(rank) || rank}
                                </div>
                                <div className="flex items-center space-x-1">
                                  {token.boosted && (
                                    <>
                                      <MarketingIcon />
                                      <span className="text-blue-400 text-[10px] uppercase">+{token.boostValue}</span>
                                    </>
                                  )}
                                  {isAd && <AdIcon />}
                                </div>
                              </div>
                            </td>
                            <td className="p-2 font-sans uppercase">
                              <div
                                onClick={() => handleTokenClick(token.pairAddress)}
                                className="flex items-center space-x-1 hover:text-blue-400 cursor-pointer transition-colors duration-150"
                              >
                                {token.info && (
                                  <img
                                    src={token.info.imageUrl || "/fallback.png"}
                                    alt={token.baseToken.symbol}
                                    className="w-5 h-5 rounded-full border border-blue-500/30"
                                  />
                                )}
                                <div>
                                  <span className="font-bold text-gray-200">{token.baseToken.symbol}</span> /{" "}
                                  <span className="text-gray-400">{token.quoteToken.symbol}</span>
                                  <br />
                                  <span className="text-[10px] text-gray-400 truncate">{token.baseToken.name}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-2 text-right text-gray-200">{formatPrice(token.priceUsd)}</td>
                            <td className="p-2 text-right text-gray-200">{getAge(token.pairCreatedAt)}</td>
                            <td className="p-2 text-right text-gray-200">{getTxns24h(token)}</td>
                            <td className={`p-2 text-right ${getColorClass(token.priceChange?.m5 || 0)}`}>
                              {(token.priceChange?.m5 || 0).toFixed(2)}%
                            </td>
                            <td className={`p-2 text-right ${getColorClass(token.priceChange?.h1 || 0)}`}>
                              {(token.priceChange?.h1 || 0).toFixed(2)}%
                            </td>
                            <td className={`p-2 text-right ${getColorClass(token.priceChange?.h6 || 0)}`}>
                              {(token.priceChange?.h6 || 0).toFixed(2)}%
                            </td>
                            <td className={`p-2 text-right ${getColorClass(token.priceChange?.h24 || 0)}`}>
                              {(token.priceChange?.h24 || 0).toFixed(2)}%
                            </td>
                            <td className="p-2 text-right text-gray-200">
                              ${(token.volume?.h24 || 0).toLocaleString()}
                            </td>
                            <td className="p-2 text-right text-gray-200">
                              ${(token.liquidity?.usd || 0).toLocaleString()}
                            </td>
                            <td className="p-2 text-right text-gray-200">
                              ${(token.marketCap || 0).toLocaleString()}
                            </td>
                            <td className="p-2 text-center">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setSelectedAlerts(tokenAlerts)}
                                className="px-2 py-1 rounded"
                                title="View Alerts"
                              >
                                <div
                                  className={`bg-gray-800 border border-blue-500/30 rounded-full px-2 py-1 flex items-center justify-center space-x-1 ${getBellColor(
                                    tokenAlerts
                                  )}`}
                                >
                                  <FaBell className="w-4 h-4" />
                                  <span className="text-[10px]">{tokenAlerts.length}</span>
                                </div>
                              </motion.button>
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  onClick={() => toggleFavorite(token.pairAddress)}
                                  className="text-yellow-400"
                                  title={
                                    favorites.includes(token.pairAddress)
                                      ? "Remove from Favorites"
                                      : "Add to Favorites"
                                  }
                                >
                                  <FaStar
                                    className={`w-4 h-4 ${
                                      favorites.includes(token.pairAddress)
                                        ? "text-yellow-400"
                                        : "text-gray-400"
                                    }`}
                                  />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  onClick={() => handleCopy(token.pairAddress)}
                                  className="text-gray-400"
                                  title="Copy Pair Address"
                                >
                                  <FaClipboard className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 flex justify-center items-center space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="bg-gray-900 hover:bg-gray-800 text-gray-200 py-1 px-3 rounded font-sans disabled:opacity-50 border border-blue-500/30 uppercase"
                  >
                    Previous
                  </motion.button>
                  <input
                    type="number"
                    value={currentPage}
                    onChange={(e) => {
                      const page = Number(e.target.value);
                      if (page >= 1 && page <= totalPages) {
                        debouncedSetCurrentPage(page);
                      }
                    }}
                    className="w-16 p-1 bg-gray-900 text-gray-200 border border-blue-500/30 rounded font-sans text-center focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                    min={1}
                    max={totalPages}
                  />
                  <span className="text-gray-400 font-sans uppercase">of {totalPages}</span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="bg-gray-900 hover:bg-gray-800 text-gray-200 py-1 px-3 rounded font-sans disabled:opacity-50 border border-blue-500/30 uppercase"
                  >
                    Next
                  </motion.button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
