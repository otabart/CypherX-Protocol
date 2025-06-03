"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaBell, FaTimes, FaEye, FaEyeSlash, FaThumbtack, FaMinus } from "react-icons/fa";
import { Bars3Icon } from "@heroicons/react/24/solid";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  limit,
  where,
} from "firebase/firestore";
import debounce from "lodash/debounce";
import Fuse from "fuse.js";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { ethers } from "ethers";
import toast, { Toaster } from "react-hot-toast";
import { useSwipeable } from "react-swipeable";

// Alchemy Provider for Base Mainnet
const provider = new ethers.JsonRpcProvider(
  "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN"
);

// Types
interface Notification {
  id: string;
  type:
    | "mover"
    | "loser"
    | "volume_spike"
    | "price_spike"
    | "news"
    | "ai_index"
    | "eth_stats"
    | "new_token"
    | "article";
  message: string;
  timestamp: string;
  pairAddress?: string;
}

interface UserPreferences {
  notifications: { [key: string]: boolean };
  favorites: string[];
  terminalStyle: string;
  prioritizeNotifications: boolean;
  notificationFilter: { type: string; excludeTypes: string[] };
  panelWidths: { sysUpdate: number; terminalOutput: number; notificationCenter: number };
}

interface SnoozedToken {
  symbol: string;
  expiry: number;
}

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
  info?: { imageUrl?: string };
}

interface PriceAlert {
  symbol: string;
  threshold: number;
  direction: "above" | "below";
  interval: number;
}

interface CustomAlert {
  symbol: string;
  threshold: number;
  direction: "above" | "below";
}

interface TerminalStyle {
  background: string;
  text: string;
  accentText: string;
  border: string;
  separator: string;
  panelBg: string;
  panelBorder: string;
  statusBarBg: string;
  commandLineBg: string;
  buttonBg: string;
  buttonText: string;
  inputBg: string;
}

interface PanelState {
  sysUpdate: { minimized: boolean; width: number };
  terminalOutput: { minimized: boolean; width: number };
  notificationCenter: { minimized: boolean; width: number };
}

interface HoneypotScanResult {
  tokenName?: string;
  tokenSymbol?: string;
  IsHoneypot?: boolean;
  honeypotReason?: string;
  simulationResult?: {
    buyTax?: number;
    sellTax?: number;
  };
}

interface ChartDataResponse {
  prices: number[];
}

interface WalletDataResponse {
  ethBalance: number;
  tokens: {
    symbol: string;
    name: string;
    balance: string;
    contractAddress: string;
  }[];
  txList: {
    asset: string;
    value: string;
    from: string;
    to: string;
    timestamp: string;
  }[];
}

// Constants
const PRICE_CHECK_INTERVAL = 60_000;
const ETH_STATS_INTERVAL = 1_800_000;
const AI_INDEX_INTERVAL = 14_400_000;
const ARTICLE_INTERVAL = 3_600_000;

// Utility Functions
const getColorClass = (type: string, theme: string): string => {
  if (theme === "hacker") {
    return "bg-green-900/20 text-green-400 border-green-500/20";
  } else if (theme === "light") {
    return "bg-blue-100/50 text-gray-800 border-blue-300/50";
  }
  switch (type) {
    case "mover":
      return "bg-green-900/20 text-green-400 border-green-500/20";
    case "loser":
      return "bg-red-900/20 text-red-400 border-red-500/20";
    case "volume_spike":
      return "bg-blue-900/20 text-blue-400 border-blue-500/20";
    case "price_spike":
      return "bg-blue-900/20 text-blue-400 border-blue-500/20";
    case "news":
      return "bg-teal-900/20 text-teal-400 border-teal-500/20";
    case "article":
      return "bg-teal-900/20 text-teal-400 border-teal-500/20";
    case "ai_index":
      return "bg-indigo-900/20 text-indigo-400 border-indigo-500/20";
    case "eth_stats":
      return "bg-purple-900/20 text-purple-400 border-purple-500/20";
    case "new_token":
      return "bg-orange-900/20 text-orange-400 border-orange-500/20";
    default:
      return "bg-gray-900/20 text-gray-400 border-gray-500/20";
  }
};

const formatUptime = (startTime: number): string => {
  const diff = Date.now() - startTime;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor(((diff % (1000 * 60 * 60)) % (1000 * 60)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
};

const generateSparkline = (data: number[]): string => {
  const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data
    .map((value) => {
      const normalized = Math.round(((value - min) / range) * (chars.length - 1));
      return chars[normalized];
    })
    .join("");
};

// Terminal Styles
const terminalStyles: Record<string, TerminalStyle> = {
  classic: {
    background: "bg-gray-950",
    text: "text-blue-300",
    accentText: "text-blue-400",
    border: "border-blue-500/20",
    separator: "border-blue-500/20",
    panelBg: "bg-gray-950",
    panelBorder: "border-blue-500/20",
    statusBarBg: "bg-gray-900",
    commandLineBg: "bg-gray-950",
    buttonBg: "bg-blue-500/20 hover:bg-blue-500/40",
    buttonText: "text-blue-300 hover:text-blue-200",
    inputBg: "bg-gray-900",
  },
  hacker: {
    background: "bg-gray-950",
    text: "text-green-400",
    accentText: "text-green-300",
    border: "border-green-500/20",
    separator: "border-green-500/20",
    panelBg: "bg-gray-950",
    panelBorder: "border-green-500/20",
    statusBarBg: "bg-gray-900",
    commandLineBg: "bg-gray-950",
    buttonBg: "bg-green-500/20 hover:bg-green-500/40",
    buttonText: "text-green-400 hover:text-green-300",
    inputBg: "bg-gray-900",
  },
  dark: {
    background: "bg-black",
    text: "text-gray-100",
    accentText: "text-blue-400",
    border: "border-gray-700/20",
    separator: "border-gray-700/20",
    panelBg: "bg-black",
    panelBorder: "border-gray-700/20",
    statusBarBg: "bg-gray-900",
    commandLineBg: "bg-black",
    buttonBg: "bg-blue-600/20 hover:bg-blue-600/40",
    buttonText: "text-blue-300 hover:text-blue-200",
    inputBg: "bg-gray-900",
  },
  light: {
    background: "bg-blue-50",
    text: "text-gray-800",
    accentText: "text-blue-600",
    border: "border-blue-300/50",
    separator: "border-blue-300/50",
    panelBg: "bg-blue-50",
    panelBorder: "border-blue-300/50",
    statusBarBg: "bg-blue-100",
    commandLineBg: "bg-blue-50",
    buttonBg: "bg-blue-500/20 hover:bg-blue-500/40",
    buttonText: "text-blue-600 hover:text-blue-500",
    inputBg: "bg-white",
  },
};

export default function CypherXTerminal() {
  const router = useRouter();
  const { address: walletAddress, isConnected } = useAccount();
  const { data: balance } = useBalance({ address: walletAddress });
  const { disconnect } = useDisconnect();
  const [user, setUser] = useState<User | null>(null);
  const [input, setInput] = useState<string>("");
  const [output, setOutput] = useState<string[]>([
    "Welcome to CypherX Terminal v2.0 - Type /menu for commands",
  ]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationCache, setNotificationCache] = useState<Notification[]>([]);
  const [pinnedNotifications, setPinnedNotifications] = useState<string[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [notificationFilter, setNotificationFilter] = useState<{
    type: string;
    excludeTypes: string[];
  }>({ type: "all", excludeTypes: [] });
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastCommand, setLastCommand] = useState<string>("");
  const [isAlertSoundEnabled, setIsAlertSoundEnabled] = useState<boolean>(true);
  const [showNotifications, setShowNotifications] = useState<boolean>(true);
  const [sysUpdates, setSysUpdates] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notifications: {
      mover: true,
      loser: true,
      volume_spike: true,
      price_spike: true,
      news: true,
      article: true,
      ai_index: true,
      eth_stats: true,
      new_token: true,
    },
    favorites: [],
    terminalStyle: "classic",
    prioritizeNotifications: true,
    notificationFilter: { type: "all", excludeTypes: [] },
    panelWidths: { sysUpdate: 33.33, terminalOutput: 33.33, notificationCenter: 33.33 },
  });
  const [panelState, setPanelState] = useState<PanelState>({
    sysUpdate: { minimized: false, width: 33.33 },
    terminalOutput: { minimized: false, width: 33.33 },
    notificationCenter: { minimized: false, width: 33.33 },
  });
  const [snoozedTokens, setSnoozedTokens] = useState<SnoozedToken[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [customAlerts, setCustomAlerts] = useState<CustomAlert[]>([]);
  const [startTime] = useState<number>(Date.now());
  const [uptime, setUptime] = useState<string>("");
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [tokens, setTokens] = useState<DexToken[]>([]);
  const [networkLatency, setNetworkLatency] = useState<number>(0);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startX: number; startWidths: { [key: string]: number } }>({
    startX: 0,
    startWidths: {},
  });

  const fuse = useMemo(() => {
    const commands: string[] = [
      "/menu",
      "/clear",
      "/refresh-notifications",
      "/account",
      "/news",
      "/tournaments",
      "/whales",
      "/scan",
      "/screener",
      "/logout",
      "/settings",
      "/snooze",
      "/status",
      "/history",
      "/notify-me",
      "/ca",
      "/address",
      "/token-balance",
      "/tx-history",
      "/calendar",
      "/smart-money",
      "/marketplace",
      "/connect-wallet",
      "/disconnect-wallet",
      "/price-alert",
      "/chart",
      "/block-info",
      "/tx-receipt",
      "/balance",
      "/watch-token",
      "/shortcuts",
    ];

    return new Fuse(commands, {
      threshold: 0.3,
      includeScore: true,
    });
  }, []);

  const debouncedSetNotifications = useCallback(
    (newNotifications: Notification[]) => {
      const debouncedFn = debounce(() => {
        setNotifications(newNotifications);
      }, 500);
      debouncedFn();
      return debouncedFn.cancel;
    },
    []
  );

  const currentStyle = useMemo(
    () => terminalStyles[preferences.terminalStyle] || terminalStyles.classic,
    [preferences.terminalStyle]
  );

  const getPanelWidth = useCallback((): number => {
    const activePanels = Object.keys(panelState).filter(
      (p) => !panelState[p as keyof PanelState].minimized
    );
    const isMobile = window.innerWidth < 768;
    if (isMobile) return 100;
    if (activePanels.length === 0) return 33.33;
    const availableWidth = 100;
    return availableWidth / activePanels.length;
  }, [panelState]);

  useEffect(() => {
    const bootSteps: string[] = [
      "[INIT] Booting CypherX Terminal v2.0...",
      "[SYS] Checking system integrity...",
      "[SEC] Fetching security patches...",
      "[DB] Optimizing database...",
      "[CHAIN] Syncing with Base chain...",
      "[AI] Updating AI models...",
      "[DATA] Refreshing token data...",
      "[CACHE] Clearing cache...",
      "[FINAL] Finalizing updates...",
      "[READY] System online.",
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < bootSteps.length) {
        setSysUpdates((prev) => [...prev, bootSteps[stepIndex]]);
        stepIndex++;
      } else {
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser: User | null) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, `users/${currentUser.uid}`);
        onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data();
            setPreferences((prev) => ({
              ...prev,
              notifications: userData.preferences?.notifications || prev.notifications,
              favorites: userData.preferences?.favorites || prev.favorites,
              terminalStyle: userData.preferences?.terminalStyle || prev.terminalStyle,
              prioritizeNotifications:
                userData.preferences?.prioritizeNotifications ?? prev.prioritizeNotifications,
              notificationFilter: userData.preferences?.notificationFilter || prev.notificationFilter,
              panelWidths: userData.preferences?.panelWidths || prev.panelWidths,
            }));
            if (userData.preferences?.notificationFilter) {
              setNotificationFilter(userData.preferences.notificationFilter);
            }
            if (userData.preferences?.panelWidths) {
              setPanelState((prev) => ({
                sysUpdate: { minimized: prev.sysUpdate.minimized, width: userData.preferences.panelWidths.sysUpdate },
                terminalOutput: {
                  minimized: prev.terminalOutput.minimized,
                  width: userData.preferences.panelWidths.terminalOutput,
                },
                notificationCenter: {
                  minimized: prev.notificationCenter.minimized,
                  width: userData.preferences.panelWidths.notificationCenter,
                },
              }));
            }
          }
        });

        const snoozeQuery = query(collection(db, `users/${currentUser.uid}/snoozed`), limit(50));
        onSnapshot(snoozeQuery, (snapshot) => {
          const snoozed: SnoozedToken[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.expiry > Date.now()) {
              snoozed.push({ symbol: doc.id, expiry: data.expiry });
            }
          });
          setSnoozedTokens(snoozed);
        });

        const favoritesQuery = query(collection(db, `users/${currentUser.uid}/favorites`), limit(50));
        onSnapshot(favoritesQuery, (snapshot) => {
          const favoriteList = snapshot.docs.map((doc) => doc.data().pairAddress as string);
          setPreferences((prev) => ({ ...prev, favorites: favoriteList }));
        });

        const priceAlertsQuery = query(collection(db, `users/${currentUser.uid}/priceAlerts`), limit(50));
        onSnapshot(priceAlertsQuery, (snapshot) => {
          const alerts: PriceAlert[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            alerts.push({
              symbol: doc.id,
              threshold: data.threshold,
              direction: data.direction,
              interval: data.interval,
            });
          });
          setPriceAlerts(alerts);
        });
      } else {
        setUser(null);
        setPreferences({
          notifications: {
            mover: true,
            loser: true,
            volume_spike: true,
            price_spike: true,
            news: true,
            article: true,
            ai_index: true,
            eth_stats: true,
            new_token: true,
          },
          favorites: [],
          terminalStyle: "classic",
          prioritizeNotifications: true,
          notificationFilter: { type: "all", excludeTypes: [] },
          panelWidths: { sysUpdate: 33.33, terminalOutput: 33.33, notificationCenter: 33.33 },
        });
        setSnoozedTokens([]);
        setPriceAlerts([]);
        setCustomAlerts([]);
        setNotificationFilter({ type: "all", excludeTypes: [] });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      setDoc(
        doc(db, `users/${user.uid}`),
        {
          preferences: {
            ...preferences,
            notificationFilter,
            panelWidths: {
              sysUpdate: panelState.sysUpdate.width,
              terminalOutput: panelState.terminalOutput.width,
              notificationCenter: panelState.notificationCenter.width,
            },
          },
        },
        { merge: true }
      );
    }
  }, [notificationFilter, user, preferences, panelState]);

  useEffect(() => {
    const tokenCacheQuery = query(collection(db, "tokenDataCache"), limit(100));
    const unsubscribe = onSnapshot(tokenCacheQuery, (snapshot) => {
      const tokenList: DexToken[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        tokenList.push(data as DexToken);
      });
      setTokens(tokenList);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const enabledTypes = Object.keys(preferences.notifications).filter(
      (type) => preferences.notifications[type]
    );
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("type", "in", enabledTypes.length > 0 ? enabledTypes : ["none"]),
      limit(50)
    );
    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const newNotifications: Notification[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const notification = { id: doc.id, ...data } as Notification;
        const isSnoozed = snoozedTokens.some(
          (snooze) =>
            snooze.symbol === notification.message.split(" ")[0] &&
            snooze.expiry > Date.now()
        );
        if (!isSnoozed) {
          newNotifications.push(notification);
        }
      });

      let filteredNotifications = newNotifications;
      if (notificationFilter.type !== "all") {
        filteredNotifications = filteredNotifications.filter(
          (n) => n.type === notificationFilter.type
        );
      }
      if (notificationFilter.excludeTypes.length > 0) {
        filteredNotifications = filteredNotifications.filter(
          (n) => !notificationFilter.excludeTypes.includes(n.type)
        );
      }

      const sortedNotifications = filteredNotifications.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const pinned = sortedNotifications.filter((n) =>
        pinnedNotifications.includes(n.id)
      );
      const unpinned = sortedNotifications.filter(
        (n) => !pinnedNotifications.includes(n.id)
      );
      const finalNotifications = preferences.prioritizeNotifications
        ? [...pinned, ...unpinned]
        : sortedNotifications;

      debouncedSetNotifications(finalNotifications);

      const newAlerts = finalNotifications.filter(
        (n) => !notificationCache.some((cached) => cached.id === n.id)
      );
      if (newAlerts.length > 0) {
        setUnreadNotifications((prev) => prev + newAlerts.length);
        if (isAlertSoundEnabled && audioRef.current) {
          audioRef.current.play().catch((error) => {
            console.error("Failed to play alert sound:", error);
          });
        }
      }

      setNotificationCache((prev) => {
        const updatedCache = [...prev, ...newAlerts].filter(
          (n) => new Date(n.timestamp).getTime() > Date.now() - 10 * 60 * 1000
        );
        return updatedCache;
      });
    });

    return () => unsubscribe();
  }, [
    notificationFilter,
    snoozedTokens,
    isAlertSoundEnabled,
    preferences.notifications,
    preferences.prioritizeNotifications,
    notificationCache,
    pinnedNotifications,
    debouncedSetNotifications,
  ]);

  useEffect(() => {
    const fetchNews = debounce(async () => {
      try {
        const newsQuery = query(collection(db, "news"), limit(10));
        const snapshot = await getDocs(newsQuery);
        const newsItems = snapshot.docs.map((doc) => ({
          id: doc.id,
          type: "news" as const,
          message: doc.data().title,
          timestamp: doc.data().createdAt.toDate().toISOString(),
        }));
        await Promise.all(
          newsItems.map((item) =>
            addDoc(collection(db, "notifications"), {
              ...item,
              createdAt: serverTimestamp(),
            })
          )
        );
      } catch (err) {
        console.error("Failed to fetch news:", err);
      }
    }, 5000);

    fetchNews();
    const interval = setInterval(fetchNews, 3_600_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchArticles = debounce(async () => {
      try {
        const articlesQuery = query(collection(db, "articles"), limit(10));
        const snapshot = await getDocs(articlesQuery);
        const articleItems = snapshot.docs.map((doc) => ({
          id: doc.id,
          type: "article" as const,
          message: `New Article: ${doc.data().title}`,
          timestamp: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString(),
        }));
        await Promise.all(
          articleItems.map((item) =>
            addDoc(collection(db, "notifications"), {
              ...item,
              createdAt: serverTimestamp(),
            })
          )
        );
      } catch (err) {
        console.error("Failed to fetch articles:", err);
      }
    }, 5000);

    fetchArticles();
    const interval = setInterval(fetchArticles, ARTICLE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAIIndex = debounce(async () => {
      try {
        const start = Date.now();
        const res = await fetch("/api/ai-index");
        setNetworkLatency(Date.now() - start);
        if (!res.ok) return;
        const data = await res.json();
        const notification: Notification = {
          type: "ai_index",
          message: `Base AI Index: ${data.indexValue.toFixed(2)}`,
          timestamp: new Date().toISOString(),
          id: `ai_index_${Date.now()}`,
        };
        await addDoc(collection(db, "notifications"), {
          ...notification,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to fetch AI Index:", err);
      }
    }, 5000);

    fetchAIIndex();
    const interval = setInterval(fetchAIIndex, AI_INDEX_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchEthStats = async () => {
      try {
        const start = Date.now();
        const res = await fetch("/api/eth-stats");
        setNetworkLatency(Date.now() - start);
        if (!res.ok) return;
        const data = await res.json();
        const notification: Notification = {
          type: "eth_stats",
          message: `ETH Stats: Price $${data.price.toFixed(2)}, 24h Change ${data.priceChange24h.toFixed(2)}%, Gas ${data.gasPrice} Gwei`,
          timestamp: new Date().toISOString(),
          id: `eth_stats_${Date.now()}`,
        };
        await addDoc(collection(db, "notifications"), {
          ...notification,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to fetch ETH stats:", err);
      }
    };

    fetchEthStats();
    const interval = setInterval(fetchEthStats, ETH_STATS_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkPriceAlerts = async () => {
      for (const alert of priceAlerts) {
        const token = tokens.find((t) => t.baseToken.symbol === alert.symbol);
        if (!token) continue;
        const currentPrice = parseFloat(token.priceUsd || "0");
        const shouldAlert =
          (alert.direction === "above" && currentPrice >= alert.threshold) ||
          (alert.direction === "below" && currentPrice <= alert.threshold);
        if (shouldAlert) {
          const notification: Notification = {
            type: "price_spike",
            message: `${alert.symbol} price ${alert.direction} ${alert.threshold}: $${currentPrice.toFixed(5)}`,
            timestamp: new Date().toISOString(),
            id: `price_spike_${alert.symbol}_${Date.now()}`,
            pairAddress: token.pairAddress,
          };
          await addDoc(collection(db, "notifications"), {
            ...notification,
            createdAt: serverTimestamp(),
          });
        }
      }
    };

    checkPriceAlerts();
    const interval = setInterval(checkPriceAlerts, PRICE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [priceAlerts, tokens]);

  useEffect(() => {
    const checkCustomAlerts = async () => {
      const alertsToRemove: string[] = [];
      for (const alert of customAlerts) {
        const token = tokens.find((t) => t.baseToken.symbol === alert.symbol);
        if (!token || !token.baseToken || !token.baseToken.symbol) {
          console.warn("Invalid token data:", token);
          continue;
        }
        const currentPrice = parseFloat(token.priceUsd || "0");
        const shouldAlert =
          (alert.direction === "above" && currentPrice >= alert.threshold) ||
          (alert.direction === "below" && currentPrice <= alert.threshold);
        if (shouldAlert) {
          const notification: Notification = {
            type: "price_spike",
            message: `${alert.symbol} price ${alert.direction} ${alert.threshold}: $${currentPrice.toFixed(5)}`,
            timestamp: new Date().toISOString(),
            id: `price_spike_${alert.symbol}_${Date.now()}`,
            pairAddress: token.pairAddress,
          };
          await addDoc(collection(db, "notifications"), {
            ...notification,
            createdAt: serverTimestamp(),
          });
          alertsToRemove.push(alert.symbol);
          toast.success(`Price alert triggered for ${alert.symbol}!`, { duration: 3000 });
        }
      }
      if (alertsToRemove.length > 0) {
        setCustomAlerts((prev) =>
          prev.filter((a) => !alertsToRemove.includes(a.symbol))
        );
      }
    };

    checkCustomAlerts();
    const interval = setInterval(checkCustomAlerts, PRICE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [tokens, customAlerts]);

  useEffect(() => {
    const updateUptime = () => setUptime(formatUptime(startTime));
    updateUptime();
    const interval = setInterval(updateUptime, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const fetchTokenAddress = useCallback(
    async (tokenSymbol: string): Promise<string | null> => {
      try {
        const tokensQuery = query(
          collection(db, "tokens"),
          where("symbol", "==", tokenSymbol),
          limit(1)
        );
        const snapshot = await getDocs(tokensQuery);
        if (snapshot.empty) {
          return null;
        }
        const tokenDoc = snapshot.docs[0];
        const tokenData = tokenDoc.data();
        return tokenData.address || null;
      } catch (err) {
        console.error("Failed to fetch token address from Firebase:", err);
        return null;
      }
    },
    []
  );

  const startResize = useCallback(
    (panel: string, e: React.MouseEvent<HTMLDivElement>) => {
      setIsResizing(panel);
      resizeRef.current = {
        startX: e.clientX,
        startWidths: {
          sysUpdate: panelState.sysUpdate.width,
          terminalOutput: panelState.terminalOutput.width,
          notificationCenter: panelState.notificationCenter.width,
        },
      };
      toast(`Resizing ${panel.replace(/([A-Z])/g, " $1").trim()} panel...`, {
        icon: "ℹ",
        duration: 3000,
      });
    },
    [panelState]
  );

  const onResize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = ((e.clientX - resizeRef.current.startX) / window.innerWidth) * 100;
      setPanelState((prev) => {
        if (isResizing === "sysUpdate") {
          const newSysWidth = Math.max(20, Math.min(60, resizeRef.current.startWidths.sysUpdate + deltaX));
          const remainingWidth = 100 - newSysWidth - (prev.notificationCenter.minimized ? 0 : prev.notificationCenter.width);
          return {
            ...prev,
            sysUpdate: { ...prev.sysUpdate, width: newSysWidth },
            terminalOutput: { ...prev.terminalOutput, width: remainingWidth },
          };
        } else if (isResizing === "terminalOutput") {
          const newTermWidth = Math.max(20, Math.min(60, resizeRef.current.startWidths.terminalOutput + deltaX));
          const remainingWidth = 100 - newTermWidth - (prev.sysUpdate.minimized ? 0 : prev.sysUpdate.width);
          return {
            ...prev,
            terminalOutput: { ...prev.terminalOutput, width: newTermWidth },
            notificationCenter: { ...prev.notificationCenter, width: remainingWidth },
          };
        }
        return prev;
      });
    },
    [isResizing]
  );

  const stopResize = useCallback(() => {
    setIsResizing(null);
    if (isResizing) {
      toast.success(`${isResizing.replace(/([A-Z])/g, " $1").trim()} panel resized.`, { duration: 3000 });
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", onResize);
      window.addEventListener("mouseup", stopResize);
      return () => {
        window.removeEventListener("mousemove", onResize);
        window.removeEventListener("mouseup", stopResize);
      };
    }
  }, [isResizing, onResize, stopResize]);

  const handleTokenStats = useCallback(
    async (tokenName: string, toastId: string) => {
      setOutput([`Fetching stats for ${tokenName.toUpperCase()}...`]);
      try {
        const tokenAddress = await fetchTokenAddress(tokenName.toUpperCase());
        if (!tokenAddress) {
          setOutput([`Token ${tokenName.toUpperCase()} not found in tokens collection.`]);
          toast.error(`Token ${tokenName.toUpperCase()} not found.`, { id: toastId, duration: 3000 });
          return;
        }

        const response = await fetch(`/api/tokens?chainId=base&tokenAddresses=${tokenAddress}`);
        if (!response.ok) {
          const errorData = await response.json();
          setOutput([`Failed to fetch stats for ${tokenName.toUpperCase()}: ${errorData.error || "Network error"}`]);
          toast.error(`Failed to fetch stats for ${tokenName.toUpperCase()}.`, { id: toastId, duration: 3000 });
          return;
        }
        const data: DexToken[] = await response.json();
        if (data && data.length > 0) {
          const token: DexToken = data[0];
          setOutput([
            `Stats for ${token.baseToken?.symbol || tokenName.toUpperCase()}:`,
            `Price: $${Number(token.priceUsd || "0").toFixed(5)}`,
            `24h Change: ${token.priceChange?.h24?.toFixed(2) ?? "N/A"}%`,
            `Volume (24h): $${token.volume?.h24?.toLocaleString() || "N/A"}`,
            `Liquidity: $${token.liquidity?.usd?.toLocaleString() || "N/A"}`,
            `Market Cap: ${token.marketCap ? `$${token.marketCap.toLocaleString()}` : "N/A"}`,
          ]);
          toast.success(`Stats fetched for ${tokenName.toUpperCase()}.`, { id: toastId, duration: 3000 });
        } else {
          setOutput([`Token ${tokenName.toUpperCase()} data not available.`]);
          toast.error(`No data for ${tokenName.toUpperCase()}.`, { id: toastId, duration: 3000 });
        }
      } catch (err) {
        console.error("Failed to fetch token stats:", err);
        setOutput([`Failed to fetch stats for ${tokenName.toUpperCase()}: An error occurred.`]);
        toast.error(`Error fetching stats for ${tokenName.toUpperCase()}.`, { id: toastId, duration: 3000 });
      }
    },
    [fetchTokenAddress]
  );

  const handlePriceAlert = useCallback(
    async (args: string[]) => {
      if (!user) {
        setOutput(["Please login to set price alerts."]);
        toast.error("Login required.", { duration: 3000 });
        return;
      }
      if (args.length < 5 || args[3].toLowerCase() !== "repeat") {
        setOutput([
          "Usage: /price-alert <symbol> <threshold> <above|below> repeat <interval> (e.g., /price-alert HIGHER 0.01 above repeat 1h)",
        ]);
        toast.error("Invalid price-alert command.", { duration: 3000 });
        return;
      }
      const symbol = args[0].toUpperCase();
      const threshold = parseFloat(args[1]);
      const direction = args[2].toLowerCase() as "above" | "below";
      const intervalStr = args[4].toLowerCase();
      const interval = intervalStr.endsWith("h")
        ? parseInt(intervalStr) * 60 * 60 * 1000
        : parseInt(intervalStr) * 60 * 1000;
      if (
        isNaN(threshold) ||
        !["above", "below"].includes(direction) ||
        isNaN(interval)
      ) {
        setOutput([
          "Invalid parameters. Usage: /price-alert <symbol> <threshold> <above|below> repeat <interval>",
        ]);
        toast.error("Invalid price-alert parameters.", { duration: 3000 });
        return;
      }
      await setDoc(doc(db, `users/${user.uid}/priceAlerts/${symbol}`), {
        threshold,
        direction,
        interval,
      });
      setOutput([
        `Recurring price alert set: Notify when ${symbol} goes ${direction} $${threshold} every ${interval / 1000 / 60} minutes.`,
      ]);
      toast.success(`Price alert set for ${symbol}.`, { duration: 3000 });
    },
    [user]
  );

  const handleChart = useCallback(
    async (args: string[], toastId: string) => {
      if (args.length < 2) {
        setOutput(["Usage: /chart <token-symbol> <timeframe> (e.g., /chart HIGHER 1h)"]);
        toast.error("Invalid chart command.", { duration: 3000 });
        return;
      }
      const chartSymbol = args[0].toUpperCase();
      const timeframe = args[1].toLowerCase();
      if (!["1h", "6h", "24h"].includes(timeframe)) {
        setOutput(["Supported timeframes: 1h, 6h, 24h"]);
        toast.error("Unsupported timeframe.", { duration: 3000 });
        return;
      }
      setOutput([`Fetching price chart for ${chartSymbol} (${timeframe})...`]);
      try {
        const response = await fetch(`/api/token-chart?symbol=${chartSymbol}&timeframe=${timeframe}`);
        if (!response.ok) {
          const errorData = await response.json();
          setOutput([`Failed to fetch chart: ${errorData.error || "Network error"}`]);
          toast.error("Failed to fetch chart.", { id: toastId, duration: 3000 });
          return;
        }
        const data: ChartDataResponse = await response.json();
        const prices = data.prices || [];
        if (prices.length === 0) {
          setOutput([`No chart data available for ${chartSymbol}.`]);
          toast.error(`No chart data for ${chartSymbol}.`, { id: toastId, duration: 3000 });
          return;
        }
        const sparkline = generateSparkline(prices);
        setOutput([
          `Price Chart for ${chartSymbol} (${timeframe}):`,
          sparkline,
          `Min: $${Math.min(...prices).toFixed(5)}`,
          `Max: $${Math.max(...prices).toFixed(5)}`,
          `Current: $${prices[prices.length - 1].toFixed(5)}`,
        ]);
        toast.success(`Chart fetched for ${chartSymbol}.`, { id: toastId, duration: 3000 });
      } catch (err) {
        console.error("Failed to fetch chart:", err);
        setOutput(["Failed to fetch chart: An error occurred."]);
        toast.error("Error fetching chart.", { id: toastId, duration: 3000 });
      }
    },
    []
  );

  const handleCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;
      setHistory((prev) => [...prev, command]);
      setHistoryIndex(-1);
      setLastCommand(command);

      const [cmd, ...args] = command.trim().split(" ");
      const lowerCmd = cmd.toLowerCase();
      const showLoading = () => toast.loading("Processing command...", { duration: 1000 });
      const dismissLoading = (id: string) => toast.dismiss(id);

      if (lowerCmd.endsWith("-stats")) {
        const tokenName = lowerCmd.replace(/-stats$/, "").replace("/", "");
        if (tokenName) {
          const toastId = showLoading();
          await handleTokenStats(tokenName, toastId);
          dismissLoading(toastId);
        } else {
          toast.error("Invalid token name for stats command.", { duration: 3000 });
        }
        return;
      }

      switch (lowerCmd) {
        case "/menu":
          setOutput([
            "Welcome to CypherX Terminal v2.0 - Type /menu for commands",
            "",
            "/menu - Show this menu",
            "/clear - Clear the terminal",
            "/refresh-notifications - Refresh Notification Center",
            "/account - Manage your account",
            "/news - Navigate to Base Chain News",
            "/tournaments - Navigate to Trading Competitions",
            "/whales - Navigate to Whale Watchers page",
            "/scan <token-address> - Audits the smart contract",
            "/<tokenname>-stats - e.g. /HIGHER-stats to fetch stats",
            "/screener - Open Token Scanner",
            "/logout - Logout of your account",
            "/settings <option> <value> - e.g. /settings notifications mover off",
            "/snooze <symbol> <duration> - e.g. /snooze HIGHER 1h",
            "/status - Show system status",
            "/history - Show command history",
            "/notify-me <symbol> <threshold> <above|below> - Set one-time price alert",
            "/ca <token-symbol> - Fetch contract address for a token (e.g., /ca HIGHER)",
            "/address <wallet-address> - Fetch wallet data (balance, tokens, transactions)",
            "/token-balance <wallet-address> - Fetch token balances for a wallet",
            "/tx-history <wallet-address> - Fetch recent transactions for a wallet",
            "/calendar - Show upcoming project events",
            "/smart-money - Navigate to Smart Money page",
            "/marketplace - Navigate to Marketplace",
            "/connect-wallet - Connect your wallet",
            "/disconnect-wallet - Disconnect your wallet",
            "/price-alert <symbol> <threshold> <above|below> repeat <interval> - Set recurring price alert",
            "/chart <token-symbol> <timeframe> - Show token price chart snapshot",
            "/block-info <number> - Fetch block details",
            "/tx-receipt <tx-hash> - Fetch transaction receipt",
            "/balance <address> - Fetch ETH balance",
            "/watch-token <symbol> - Add token to watchlist",
            "/shortcuts - Show keyboard shortcuts",
            "",
            user ? `Available commands:` : `Please login to access all commands`,
          ]);
          toast.success("Menu displayed.", { duration: 3000 });
          break;

        case "/clear":
          setOutput(["Terminal cleared."]);
          toast.success("Terminal cleared.", { duration: 3000 });
          break;

        case "/refresh-notifications":
          setOutput(["Refreshing notifications..."]);
          setNotifications([]);
          setNotificationCache([]);
          setPinnedNotifications([]);
          setUnreadNotifications(0);
          setOutput(["Notifications refreshed."]);
          toast.success("Notifications refreshed.", { duration: 3000 });
          break;

        case "/account":
          router.push("/account");
          toast.success("Navigating to account.", { duration: 3000 });
          break;

        case "/news":
          router.push("/base-chain-news");
          toast.success("Navigating to news.", { duration: 3000 });
          break;

        case "/tournaments":
          router.push("/tradingcompetition");
          toast.success("Navigating to tournaments.", { duration: 3000 });
          break;

        case "/whales":
          router.push("/whale-watchers");
          toast.success("Navigating to whale watchers.", { duration: 3000 });
          break;

        case "/scan":
          if (args[0]) {
            const toastId = showLoading();
            setOutput([`Scanning token: ${args[0]}...`]);
            try {
              const response = await fetch(`/api/honeypot/scan?address=${args[0]}`);
              if (!response.ok) {
                const errorData = await response.json();
                setOutput([`Failed to scan token ${args[0]}: ${errorData.error || "Network error"}`]);
                toast.error(`Failed to scan token ${args[0]}.`, { id: toastId, duration: 3000 });
                dismissLoading(toastId);
                return;
              }
              const result: HoneypotScanResult = await response.json();
              const outputLines = [`Scan result for ${args[0]}:`];
              outputLines.push(
                `Token: ${result.tokenName || "Unknown"} (${result.tokenSymbol || "N/A"})`
              );
              if (result.IsHoneypot) {
                outputLines.push("⚠️ WARNING: Potential honeypot detected!");
                if (result.honeypotReason) {
                  outputLines.push(`Reason: ${result.honeypotReason}`);
                }
              } else {
                outputLines.push("✅ No honeypot detected.");
              }
              if (result.simulationResult) {
                outputLines.push(
                  `Buy Tax: ${
                    result.simulationResult.buyTax !== undefined
                      ? `${result.simulationResult.buyTax}%`
                      : "N/A"
                  }`
                );
                outputLines.push(
                  `Sell Tax: ${
                    result.simulationResult.sellTax !== undefined
                      ? `${result.simulationResult.sellTax}%`
                      : "N/A"
                  }`
                );
              }
              setOutput(outputLines);
              toast.success(`Token ${args[0]} scanned.`, { id: toastId, duration: 3000 });
              dismissLoading(toastId);
            } catch (err) {
              console.error("Honeypot scan failed:", err);
              setOutput(["Failed to scan token: An error occurred."]);
              toast.error("Failed to scan token.", { id: toastId, duration: 3000 });
              dismissLoading(toastId);
            }
          } else {
            setOutput(["Please provide a token address: /scan <token-address>"]);
            toast.error("Token address required.", { duration: 3000 });
          }
          break;

        case "/screener":
          router.push("/token-scanner");
          toast.success("Navigating to token scanner.", { duration: 3000 });
          break;

        case "/logout":
          setOutput(["Logging out..."]);
          await auth.signOut();
          setOutput(["Logged out successfully."]);
          toast.success("Logged out successfully.", { duration: 3000 });
          break;

        case "/settings":
          if (!user) {
            setOutput(["Please login to manage settings."]);
            toast.error("Login required.", { duration: 3000 });
            return;
          }
          if (args[0]?.toLowerCase() === "notifications" && args[1] && args[2]) {
            const type = args[1].toLowerCase();
            const value = args[2].toLowerCase() === "on";
            if (Object.prototype.hasOwnProperty.call(preferences.notifications, type)) {
              const updatedPrefs = {
                ...preferences.notifications,
                [type]: value,
              };
              await setDoc(
                doc(db, `users/${user.uid}`),
                {
                  preferences: {
                    ...preferences,
                    notifications: updatedPrefs,
                  },
                },
                { merge: true }
              );
              setOutput([`Notification ${type} set to ${value ? "on" : "off"}.`]);
              toast.success(`Notification ${type} set to ${value ? "on" : "off"}.`, { duration: 3000 });
            } else {
              setOutput(["Invalid notification type."]);
              toast.error("Invalid notification type.", { duration: 3000 });
            }
          } else if (args[0]?.toLowerCase() === "favorites" && args[1]) {
            if (args[1].toLowerCase() === "list") {
              setOutput(["Favorites:", ...preferences.favorites]);
              toast.success("Favorites listed.", { duration: 3000 });
            } else {
              const pairAddress = args[1];
              const isFavorited = preferences.favorites.includes(pairAddress);
              const favoriteDocRef = doc(db, `users/${user.uid}/favorites`, pairAddress);
              if (isFavorited) {
                await deleteDoc(favoriteDocRef);
                setOutput([`Removed ${pairAddress} from favorites.`]);
                toast.success(`Removed ${pairAddress} from favorites.`, { duration: 3000 });
              } else {
                await setDoc(favoriteDocRef, {
                  pairAddress,
                  createdAt: serverTimestamp(),
                });
                setOutput([`Added ${pairAddress} to favorites.`]);
                toast.success(`Added ${pairAddress} to favorites.`, { duration: 3000 });
              }
            }
          } else if (args[0]?.toLowerCase() === "prioritize" && args[1]) {
            const value = args[1].toLowerCase() === "on";
            await setDoc(
              doc(db, `users/${user.uid}`),
              {
                preferences: {
                  ...preferences,
                  prioritizeNotifications: value,
                },
              },
              { merge: true }
            );
            setOutput([`Notification prioritization ${value ? "enabled" : "disabled"}.`]);
            toast.success(`Notification prioritization ${value ? "enabled" : "disabled"}.`, { duration: 3000 });
          } else {
            setOutput(["Usage: /settings <notifications|favorites|prioritize> <option> <value>"]);
            toast.error("Invalid settings command.", { duration: 3000 });
          }
          break;

        case "/snooze":
          if (!user) {
            setOutput(["Please login to snooze notifications."]);
            toast.error("Login required.", { duration: 3000 });
            return;
          }
          if (args.length < 2) {
            setOutput(["Usage: /snooze <symbol> <duration> (e.g., /snooze HIGHER 1h)"]);
            toast.error("Invalid snooze command.", { duration: 3000 });
            return;
          }
          const symbol = args[0].toUpperCase();
          const durationStr = args[1].toLowerCase();
          const duration = durationStr.endsWith("h")
            ? parseInt(durationStr) * 60 * 60 * 1000
            : parseInt(durationStr) * 60 * 1000;
          const expiry = Date.now() + duration;
          await setDoc(doc(db, `users/${user.uid}/snoozed/${symbol}`), {
            expiry,
          });
          setOutput([`Notifications for ${symbol} snoozed until ${new Date(expiry).toLocaleString()}.`]);
          toast.success(`Notifications for ${symbol} snoozed.`, { duration: 3000 });
          break;

        case "/status":
          setOutput([
            "System Status:",
            `Uptime: ${uptime}`,
            `Last Command: ${lastCommand || "None"}`,
            `Online: ${isOnline ? "Yes" : "No"}`,
            `Notifications: ${notifications.length} active`,
            `Pinned: ${pinnedNotifications.length}`,
            `Wallet: ${isConnected ? walletAddress ?? "Unknown" : "Not connected"}`,
            `Network Latency: ${networkLatency}ms`,
          ]);
          toast.success("System status displayed.", { duration: 3000 });
          break;

        case "/history":
          setOutput(["Command History:", ...history.slice(-10)]);
          toast.success("Command history displayed.", { duration: 3000 });
          break;

        case "/notify-me":
          if (args.length < 3) {
            setOutput(["Usage: /notify-me <symbol> <threshold> <above|below>"]);
            toast.error("Invalid notify-me command.", { duration: 3000 });
            return;
          }
          const alertSymbol = args[0].toUpperCase();
          const threshold = parseFloat(args[1]);
          const direction = args[2].toLowerCase() as "above" | "below";
          if (isNaN(threshold) || !["above", "below"].includes(direction)) {
            setOutput(["Invalid threshold or direction. Usage: /notify-me <symbol> <threshold> <above|below>"]);
            toast.error("Invalid threshold or direction.", { duration: 3000 });
            return;
          }
          setCustomAlerts((prev: CustomAlert[]) => [
            ...prev,
            { symbol: alertSymbol, threshold, direction },
          ]);
          setOutput([`Custom alert set: Notify when ${alertSymbol} goes ${direction} $${threshold}.`]);
          toast.success(`Alert set for ${alertSymbol}.`, { duration: 3000 });
          break;

        case "/ca":
          if (args.length < 1) {
            setOutput(["Usage: /ca <token-symbol> (e.g., /ca HIGHER)"]);
            toast.error("Token symbol required.", { duration: 3000 });
            return;
          }
          const tokenSymbol = args[0].toUpperCase();
          const toastId = showLoading();
          setOutput([`Fetching contract address for ${tokenSymbol}...`]);
          try {
            const contractAddress = await fetchTokenAddress(tokenSymbol);
            if (!contractAddress) {
              setOutput([`Token ${tokenSymbol} not found in tokens collection.`]);
              toast.error(`Token ${tokenSymbol} not found.`, { id: toastId, duration: 3000 });
              dismissLoading(toastId);
              return;
            }
            setOutput([`Contract Address for ${tokenSymbol}: ${contractAddress}`]);
            toast.success(`Contract address fetched for ${tokenSymbol}.`, { id: toastId, duration: 3000 });
            dismissLoading(toastId);
          } catch (err) {
            console.error("Failed to fetch contract address:", err);
            setOutput([`Failed to fetch contract address for ${tokenSymbol}: An error occurred.`]);
            toast.error(`Error fetching contract address for ${tokenSymbol}.`, { id: toastId, duration: 3000 });
            dismissLoading(toastId);
          }
          break;

        case "/address":
          if (args.length < 1) {
            setOutput(["Usage: /address <wallet-address>"]);
            toast.error("Wallet address required.", { duration: 3000 });
            return;
          }
          const walletAddressInput = args[0];
          if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddressInput)) {
            setOutput(["Invalid wallet address."]);
            toast.error("Invalid wallet address.", { duration: 3000 });
            return;
          }
          const toastIdAddress = showLoading();
          setOutput([`Fetching wallet data for ${walletAddressInput}...`]);
          try {
            const response = await fetch(`/api/wallet/${walletAddressInput}`);
            if (!response.ok) {
              const errorData = await response.json();
              setOutput([`Failed to fetch wallet data: ${errorData.error || "Network error"}`]);
              toast.error("Failed to fetch wallet data.", { id: toastIdAddress, duration: 3000 });
              dismissLoading(toastIdAddress);
              return;
            }
            const data: WalletDataResponse = await response.json();
            setOutput([
              `Wallet Data for ${walletAddressInput}:`,
              `ETH Balance: ${data.ethBalance.toFixed(4)} ETH`,
              `Tokens:`,
              ...data.tokens.map(
                (token) =>
                  `${token.symbol} (${token.name}): ${token.balance} (Contract: ${token.contractAddress})`
              ),
              `Recent Transactions:`,
              ...data.txList.slice(0, 5).map(
                (tx) =>
                  `${tx.asset} - ${tx.value} from ${tx.from} to ${tx.to} at ${tx.timestamp}`
              ),
            ]);
            toast.success("Wallet data fetched.", { id: toastIdAddress, duration: 3000 });
            dismissLoading(toastIdAddress);
          } catch (err) {
            console.error("Failed to fetch wallet data:", err);
            setOutput(["Failed to fetch wallet data: An error occurred."]);
            toast.error("Error fetching wallet data.", { id: toastIdAddress, duration: 3000 });
            dismissLoading(toastIdAddress);
          }
          break;

        case "/token-balance":
          if (args.length < 1) {
            setOutput(["Usage: /token-balance <wallet-address>"]);
            toast.error("Wallet address required.", { duration: 3000 });
            return;
          }
          const tokenBalanceAddress = args[0];
          if (!/^0x[a-fA-F0-9]{40}$/.test(tokenBalanceAddress)) {
            setOutput(["Invalid wallet address."]);
            toast.error("Invalid wallet address.", { duration: 3000 });
            return;
          }
          const toastIdToken = showLoading();
          setOutput([`Fetching token balances for ${tokenBalanceAddress}...`]);
          try {
            const response = await fetch(`/api/wallet/${tokenBalanceAddress}`);
            if (!response.ok) {
              const errorData = await response.json();
              setOutput([`Failed to fetch token balances: ${errorData.error || "Network error"}`]);
              toast.error("Failed to fetch token balances.", { id: toastIdToken, duration: 3000 });
              dismissLoading(toastIdToken);
              return;
            }
            const data: WalletDataResponse = await response.json();
            setOutput([
              `Token Balances for ${tokenBalanceAddress}:`,
              ...data.tokens.map(
                (token) =>
                  `${token.symbol} (${token.name}): ${token.balance} (Contract: ${token.contractAddress})`
              ),
            ]);
            toast.success("Token balances fetched.", { id: toastIdToken, duration: 3000 });
            dismissLoading(toastIdToken);
          } catch (err) {
            console.error("Failed to fetch token balances:", err);
            setOutput(["Failed to fetch token balances: An error occurred."]);
            toast.error("Error fetching token balances.", { id: toastIdToken, duration: 3000 });
            dismissLoading(toastIdToken);
          }
          break;

        case "/tx-history":
          if (args.length < 1) {
            setOutput(["Usage: /tx-history <wallet-address>"]);
            toast.error("Wallet address required.", { duration: 3000 });
            return;
          }
          const txHistoryAddress = args[0];
          if (!/^0x[a-fA-F0-9]{40}$/.test(txHistoryAddress)) {
            setOutput(["Invalid wallet address."]);
            toast.error("Invalid wallet address.", { duration: 3000 });
            return;
          }
          const toastIdTx = showLoading();
          setOutput([`Fetching transaction history for ${txHistoryAddress}...`]);
          try {
            const response = await fetch(`/api/wallet/${txHistoryAddress}`);
            if (!response.ok) {
              const errorData = await response.json();
              setOutput([`Failed to fetch transactions: ${errorData.error || "Network error"}`]);
              toast.error("Failed to fetch transactions.", { id: toastIdTx, duration: 3000 });
              dismissLoading(toastIdTx);
              return;
            }
            const data: WalletDataResponse = await response.json();
            setOutput([
              `Recent Transactions for ${txHistoryAddress}:`,
              ...data.txList.slice(0, 5).map(
                (tx) =>
                  `${tx.asset} - ${tx.value} from ${tx.from} to ${tx.to} at ${tx.timestamp}`
              ),
            ]);
            toast.success("Transactions fetched.", { id: toastIdTx, duration: 3000 });
            dismissLoading(toastIdTx);
          } catch (err) {
            console.error("Failed to fetch transactions:", err);
            setOutput(["Failed to fetch transactions: An error occurred."]);
            toast.error("Error fetching transactions.", { id: toastIdTx, duration: 3000 });
            dismissLoading(toastIdTx);
          }
          break;

        case "/calendar":
          const toastIdCalendar = showLoading();
          setOutput(["Fetching upcoming project events..."]);
          try {
            const eventsQuery = query(collection(db, "projectEvents"), limit(10));
            const snapshot = await getDocs(eventsQuery);
            const events = snapshot.docs.map((doc) => ({
              id: doc.id,
              title: doc.data().title,
              date: doc.data().date?.toDate().toISOString() || "N/A",
              description: doc.data().description || "No description available",
            }));
            if (events.length === 0) {
              setOutput(["No upcoming events found."]);
              toast.success("No upcoming events.", { id: toastIdCalendar, duration: 3000 });
              dismissLoading(toastIdCalendar);
            } else {
              setOutput([
                "Upcoming Project Events:",
                ...events.map(
                  (event) =>
                    `${event.title} - ${new Date(event.date).toLocaleString()}: ${event.description}`
                ),
              ]);
              toast.success("Events fetched.", { id: toastIdCalendar, duration: 3000 });
              dismissLoading(toastIdCalendar);
            }
          } catch (err) {
            console.error("Failed to fetch events:", err);
            setOutput(["Failed to fetch events: An error occurred."]);
            toast.error("Error fetching events.", { id: toastIdCalendar, duration: 3000 });
            dismissLoading(toastIdCalendar);
          }
          break;

        case "/smart-money":
          router.push("/smart-money");
          toast.success("Navigating to smart money.", { duration: 3000 });
          break;

        case "/marketplace":
          router.push("/marketplace");
          toast.success("Navigating to marketplace.", { duration: 3000 });
          break;

        case "/connect-wallet":
          if (isConnected) {
            setOutput([
              "Wallet already connected:",
              walletAddress ?? "Unknown",
              `Balance: ${balance?.formatted || "0"} ETH`,
            ]);
            toast.success("Wallet already connected.", { duration: 3000 });
          } else {
            setOutput(["Please connect your wallet via the UI."]);
            toast.error("Connect wallet via UI.", { duration: 3000 });
          }
          break;

        case "/disconnect-wallet":
          if (!isConnected) {
            setOutput(["No wallet connected."]);
            toast.error("No wallet connected.", { duration: 3000 });
          } else {
            disconnect();
            setOutput(["Wallet disconnected."]);
            toast.success("Wallet disconnected.", { duration: 3000 });
          }
          break;

        case "/price-alert":
          const toastIdPriceAlert = showLoading();
          await handlePriceAlert(args);
          dismissLoading(toastIdPriceAlert);
          break;

        case "/chart":
          const toastIdChart = showLoading();
          await handleChart(args, toastIdChart);
          dismissLoading(toastIdChart);
          break;

        case "/block-info":
          if (args.length < 1) {
            setOutput(["Usage: /block-info <number>"]);
            toast.error("Block number required.", { duration: 3000 });
            return;
          }
          const blockNumber = args[0];
          const toastIdBlock = showLoading();
          setOutput([`Fetching block info for block ${blockNumber}...`]);
          try {
            const block = await provider.getBlock(parseInt(blockNumber));
            if (!block) {
              setOutput([`Block ${blockNumber} not found.`]);
              toast.error(`Block ${blockNumber} not found.`, { id: toastIdBlock, duration: 3000 });
              dismissLoading(toastIdBlock);
              return;
            }
            setOutput([
              `Block Info for ${blockNumber}:`,
              `Hash: ${block.hash}`,
              `Timestamp: ${new Date(block.timestamp * 1000).toLocaleString()}`,
              `Transactions: ${block.transactions.length}`,
              `Gas Used: ${block.gasUsed.toString()}`,
              `Gas Limit: ${block.gasLimit.toString()}`,
            ]);
            toast.success(`Block info fetched for ${blockNumber}.`, { id: toastIdBlock, duration: 3000 });
            dismissLoading(toastIdBlock);
          } catch (err) {
            console.error("Failed to fetch block info:", err);
            setOutput(["Failed to fetch block info: An error occurred."]);
            toast.error("Error fetching block info.", { id: toastIdBlock, duration: 3000 });
            dismissLoading(toastIdBlock);
          }
          break;

        case "/tx-receipt":
          if (args.length < 1) {
            setOutput(["Usage: /tx-receipt <tx-hash>"]);
            toast.error("Transaction hash required.", { duration: 3000 });
            return;
          }
          const txHash = args[0];
          const toastIdTxReceipt = showLoading();
          setOutput([`Fetching transaction receipt for ${txHash}...`]);
          try {
            const receipt = await provider.getTransactionReceipt(txHash);
            if (!receipt) {
              setOutput([`Transaction receipt not found for ${txHash}.`]);
              toast.error(`Receipt not found for ${txHash}.`, { id: toastIdTxReceipt, duration: 3000 });
              dismissLoading(toastIdTxReceipt);
              return;
            }
            setOutput([
              `Transaction Receipt for ${txHash}:`,
              `Status: ${receipt.status === 1 ? "Success" : "Failed"}`,
              `Block Number: ${receipt.blockNumber}`,
              `Gas Used: ${receipt.gasUsed.toString()}`,
              `From: ${receipt.from}`,
              `To: ${receipt.to || "Contract Creation"}`,
            ]);
            toast.success(`Receipt fetched for ${txHash}.`, { id: toastIdTxReceipt, duration: 3000 });
            dismissLoading(toastIdTxReceipt);
          } catch (err) {
            console.error("Failed to fetch transaction receipt:", err);
            setOutput(["Failed to fetch transaction receipt: An error occurred."]);
            toast.error("Error fetching transaction receipt.", { id: toastIdTxReceipt, duration: 3000 });
            dismissLoading(toastIdTxReceipt);
          }
          break;

        case "/balance":
          if (args.length < 1) {
            setOutput(["Usage: /balance <address>"]);
            toast.error("Address required.", { duration: 3000 });
            return;
          }
          const address = args[0];
          if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            setOutput(["Invalid address."]);
            toast.error("Invalid address.", { duration: 3000 });
            return;
          }
          const toastIdBalance = showLoading();
          setOutput([`Fetching balance for ${address}...`]);
          try {
            const balance = await provider.getBalance(address);
            const ethBalance = ethers.formatEther(balance);
            setOutput([`Balance for ${address}: ${ethBalance} ETH`]);
            toast.success(`Balance fetched for ${address}.`, { id: toastIdBalance, duration: 3000 });
            dismissLoading(toastIdBalance);
          } catch (err) {
            console.error("Failed to fetch balance:", err);
            setOutput(["Failed to fetch balance: An error occurred."]);
            toast.error("Error fetching balance.", { id: toastIdBalance, duration: 3000 });
            dismissLoading(toastIdBalance);
          }
          break;

        case "/watch-token":
          if (!user) {
            setOutput(["Please login to watch tokens."]);
            toast.error("Login required.", { duration: 3000 });
            return;
          }
          if (args.length < 1) {
            setOutput(["Usage: /watch-token <symbol>"]);
            toast.error("Token symbol required.", { duration: 3000 });
            return;
          }
          const watchSymbol = args[0].toUpperCase();
          const token = tokens.find((t) => t.baseToken.symbol === watchSymbol);
          if (!token) {
            setOutput([`Token ${watchSymbol} not found.`]);
            toast.error(`Token ${watchSymbol} not found.`, { duration: 3000 });
            return;
          }
          await setDoc(doc(db, `users/${user.uid}/watchTokens/${watchSymbol}`), {
            symbol: watchSymbol,
            createdAt: serverTimestamp(),
          });
          setOutput([`Watching ${watchSymbol} for price updates.`]);
          toast.success(`Watching ${watchSymbol}.`, { duration: 3000 });
          break;

        case "/shortcuts":
          setOutput([
            "Keyboard Shortcuts:",
            "Ctrl+L - Clear terminal",
            "Tab - Auto-complete command",
            "ArrowUp - Previous command",
            "ArrowDown - Next command",
          ]);
          toast.success("Shortcuts displayed.", { duration: 3000 });
          break;

        default:
          setOutput([`Command not found: ${command}`, "Type /menu for available commands."]);
          toast.error("Command not found.", { duration: 3000 });
      }
    },
    [
      user,
      preferences,
      notifications,
      router,
      tokens,
      uptime,
      isOnline,
      lastCommand,
      history,
      networkLatency,
      isConnected,
      walletAddress,
      balance,
      disconnect,
      fetchTokenAddress,
      handleChart,
      handlePriceAlert,
      handleTokenStats,
      pinnedNotifications,
    ]
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (value.startsWith("/")) {
        const results = fuse.search(value).map((result) => result.item);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    },
    [fuse]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleCommand(input);
        setInput("");
        setSuggestions([]);
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (suggestions.length > 0) {
          setInput(suggestions[0]);
          setSuggestions([]);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setInput(history[history.length - 1 - newIndex]);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex > -1) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(newIndex === -1 ? "" : history[history.length - 1 - newIndex]);
        }
      } else if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        handleCommand("/clear");
      }
    },
    [handleCommand, input, suggestions, history, historyIndex]
  );

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    if (notificationRef.current) {
      notificationRef.current.scrollTop = notificationRef.current.scrollHeight;
    }
  }, [notifications]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleStyleChange = useCallback(
    async (style: string) => {
      if (user) {
        await setDoc(
          doc(db, `users/${user.uid}`),
          {
            preferences: {
              ...preferences,
              terminalStyle: style,
            },
          },
          { merge: true }
        );
      } else {
        setPreferences((prev) => ({ ...prev, terminalStyle: style }));
      }
      toast.success(`Theme switched to ${style.charAt(0).toUpperCase() + style.slice(1)}.`, { duration: 3000 });
    },
    [user, preferences]
  );

  const toggleExcludeType = useCallback(
    (type: string) => {
      setNotificationFilter((prev) => ({
        ...prev,
        excludeTypes: prev.excludeTypes.includes(type)
          ? prev.excludeTypes.filter((t) => t !== type)
          : [...prev.excludeTypes, type],
      }));
      toast.success(`Toggled filter for ${type}.`, { duration: 3000 });
    },
    []
  );

  const handleClearAllNotifications = useCallback(() => {
    setNotifications([]);
    setNotificationCache([]);
    setPinnedNotifications([]);
    setUnreadNotifications(0);
    toast.success("All notifications cleared.", { duration: 3000 });
  }, []);

const togglePinNotification = useCallback(
      (id: string) => {
      setPinnedNotifications((prev) => {
        const isPinned = prev.includes(id);
        if (isPinned) {
          return prev.filter((pid) => pid !== id);
        } else {
          return [id, ...prev.filter((pid) => pid !== id)];
        }
      });
      setNotifications((prev) => {
        const notification = prev.find((n) => n.id === id);
        if (!notification) return prev;

        const isPinned = pinnedNotifications.includes(id);
        if (isPinned) {
          return prev;
        } else {
          const others = prev.filter((n) => n.id !== id);
          return preferences.prioritizeNotifications ? [notification, ...others] : prev;
        }
      });
      toast.success(pinnedNotifications.includes(id) ? "Notification unpinned." : "Notification pinned.", { duration: 3000 });
    },
    [pinnedNotifications, preferences.prioritizeNotifications]
  );

  const handleSnoozeNotification = useCallback(
    async (symbol: string) => {
      if (!user) {
        setOutput(["Please login to snooze notifications."]);
        toast.error("Login required.", { duration: 3000 });
        return;
      }
      const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
      await setDoc(doc(db, `users/${user.uid}/snoozed/${symbol}`), { expiry });
      setOutput([`Notifications for ${symbol} snoozed until ${new Date(expiry).toLocaleString()}.`]);
      toast.success(`Notifications for ${symbol} snoozed.`, { duration: 3000 });
    },
    [user]
  );

  const handleDismissNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setPinnedNotifications((prev) => prev.filter((pid) => pid !== id));
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
      toast.success("Notification dismissed.", { duration: 3000 });
    },
    []
  );

  const togglePanelMinimize = useCallback(
    (panel: keyof PanelState) => {
      setPanelState((prev) => {
        const newState = {
          ...prev,
          [panel]: { ...prev[panel], minimized: !prev[panel].minimized },
        };
        Object.keys(newState).forEach((p) => {
          if (!newState[p as keyof PanelState].minimized) {
            newState[p as keyof PanelState].width = getPanelWidth();
          }
        });
        return newState;
      });
      const panelName = panel.replace(/([A-Z])/g, " $1").trim();
      toast.success(`${panelName} ${panelState[panel].minimized ? "restored" : "minimized"}.`, { duration: 3000 });
    },
    [getPanelWidth, panelState]
  );

  const togglePrioritizeNotifications = useCallback(
    async () => {
      if (!user) {
        setOutput(["Please login to manage settings."]);
        toast.error("Login required.", { duration: 3000 });
        return;
      }
      const newValue = !preferences.prioritizeNotifications;
      await setDoc(
        doc(db, `users/${user.uid}`),
        {
          preferences: {
            ...preferences,
            prioritizeNotifications: newValue,
          },
        },
        { merge: true }
      );
      setPreferences((prev) => ({ ...prev, prioritizeNotifications: newValue }));
      setNotifications((prev) => {
        if (!newValue) return prev.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const pinned = prev.filter((n) => pinnedNotifications.includes(n.id));
        const unpinned = prev.filter((n) => !pinnedNotifications.includes(n.id));
        return [...pinned, ...unpinned];
      });
      toast.success(`Notification prioritization ${newValue ? "enabled" : "disabled"}.`, { duration: 3000 });
    },
    [user, preferences, pinnedNotifications]
  );

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      setShowNotifications(false);
      toast(`Notifications hidden.`, { icon: "ℹ", duration: 3000 });
    },
    onSwipedRight: () => {
      setShowNotifications(true);
      toast(`Notifications shown.`, { icon: "ℹ", duration: 3000 });
    },
  });

  // Determine minimized panels for tabbed interface
  const minimizedPanels = Object.keys(panelState).filter(
    (panel) => panelState[panel as keyof PanelState].minimized
  ) as (keyof PanelState)[];

  return (
    <div
      className={`flex flex-col h-screen overflow-hidden ${currentStyle.background} ${currentStyle.text} font-mono`}
      {...swipeHandlers}
    >
      <style jsx global>{`
        .tooltip {
          position: relative;
        }
        .tooltip:hover::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 10;
        }
        .panel-shadow {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .minimized-tab {
          transition: background-color 0.2s;
        }
        .command-prefix::before {
          content: "> ";
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: inherit;
          opacity: 0.7;
        }
        @media (max-width: 768px) {
          .panel-width {
            width: 100% !important;
          }
          .separator {
            display: none;
          }
          .text-sm {
            font-size: 0.85rem;
          }
          .text-xs {
            font-size: 0.7rem;
          }
          .p-3 {
            padding: 0.75rem;
          }
        }
      `}</style>
      <Toaster position="top-right" />
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />
      <div className={`relative flex items-center justify-between p-3 ${currentStyle.statusBarBg}`}>
        <div className="flex items-center space-x-3 flex-wrap">
          <Bars3Icon className="w-6 h-6" />
          <span className="text-sm font-semibold">CypherX Terminal v2.0</span>
          <span className="text-xs opacity-75">
            Status: {isOnline ? "Online" : "Offline"} | Uptime: {uptime}
          </span>
          <span className="text-xs opacity-75">
            Latency: {networkLatency}ms
          </span>
          <span className="text-xs opacity-75">
            Theme: {preferences.terminalStyle.charAt(0).toUpperCase() + preferences.terminalStyle.slice(1)}
          </span>
          <span className="text-xs opacity-75">
            Alerts: {priceAlerts.length}
          </span>
          <span className="text-xs opacity-75">
            Favorites: {preferences.favorites.length}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          {minimizedPanels.length > 0 && (
            <div className="flex space-x-2">
              {minimizedPanels.map((panel) => (
                <button
                  key={panel}
                  onClick={() => togglePanelMinimize(panel)}
                  className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded text-xs minimized-tab tooltip transition-colors duration-200`}
                  data-tooltip={`Restore ${panel.replace(/([A-Z])/g, " $1").trim()}`}
                  aria-label={`Restore ${panel.replace(/([A-Z])/g, " $1").trim()} panel`}
                >
                  {panel.replace(/([A-Z])/g, " $1").trim()}
                </button>
              ))}
            </div>
          )}
          {isConnected && walletAddress && (
            <span className="text-xs">
              Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          )}
          <button
            onClick={() => {
              setIsAlertSoundEnabled(!isAlertSoundEnabled);
              toast.success(isAlertSoundEnabled ? "Alerts muted." : "Alerts unmuted.", { duration: 3000 });
            }}
            className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded text-sm tooltip transition-colors duration-200`}
            data-tooltip={isAlertSoundEnabled ? "Mute Alerts" : "Unmute Alerts"}
            aria-label={isAlertSoundEnabled ? "Mute alerts" : "Unmute alerts"}
          >
            {isAlertSoundEnabled ? "Mute" : "Unmute"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* System Updates Panel */}
        {!panelState.sysUpdate.minimized && (
          <motion.div
            className={`flex flex-col h-full ${currentStyle.panelBg} ${currentStyle.panelBorder} panel-shadow rounded-none panel-width relative`}
            style={{ width: `${panelState.sysUpdate.width}%` }}
            animate={{ width: `${panelState.sysUpdate.width}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className={`flex items-center justify-between p-3 ${currentStyle.statusBarBg}`}>
              <span className="text-sm font-semibold">System Updates</span>
              <button
                onClick={() => togglePanelMinimize("sysUpdate")}
                className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded tooltip transition-colors duration-200`}
                data-tooltip="Minimize Panel"
                aria-label="Minimize System Updates"
              >
                <FaMinus />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {sysUpdates.map((update, index) => (
                <div key={index} className="text-sm mb-2">
                  {update}
                </div>
              ))}
            </div>
            {window.innerWidth >= 768 && (
              <>
                <div
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-gray-500/20 hover:bg-gray-500/40 transition-colors"
                  onMouseDown={(e) => startResize("sysUpdate", e)}
                  aria-label="Resize System Updates panel"
                />
                <div className={`separator absolute top-0 right-0 w-px h-full ${currentStyle.separator}`} />
              </>
            )}
          </motion.div>
        )}

        {/* Terminal Output Panel */}
        {!panelState.terminalOutput.minimized && (
          <motion.div
            className={`flex flex-col h-full ${currentStyle.panelBg} ${currentStyle.panelBorder} panel-shadow rounded-none panel-width relative`}
            style={{ width: `${panelState.terminalOutput.width}%` }}
            animate={{ width: `${panelState.terminalOutput.width}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className={`flex items-center justify-between p-3 ${currentStyle.statusBarBg}`}>
              <span className="text-sm font-semibold">Terminal Output</span>
              <button
                onClick={() => togglePanelMinimize("terminalOutput")}
                className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded tooltip transition-colors duration-200`}
                data-tooltip="Minimize Panel"
                aria-label="Minimize Terminal Output"
              >
                <FaMinus />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3" ref={outputRef}>
              {output.map((line, index) => (
                <div key={index} className="text-sm mb-2">
                  {line}
                </div>
              ))}
            </div>
            <div className={`p-3 ${currentStyle.commandLineBg} border-t ${currentStyle.border}`}>
              {history.length > 0 && (
                <select
                  className={`w-full p-2 mb-2 rounded ${currentStyle.inputBg} ${currentStyle.text} text-sm shadow-sm`}
                  onChange={(e) => {
                    setInput(e.target.value);
                    handleCommand(e.target.value);
                  }}
                  value=""
                  aria-label="Select previous command"
                >
                  <option value="" disabled>
                    Recent Commands
                  </option>
                  {history.slice(-5).reverse().map((cmd, index) => (
                    <option key={index} value={cmd}>
                      {cmd}
                    </option>
                  ))}
                </select>
              )}
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`w-full p-3 pl-8 ${currentStyle.inputBg} ${currentStyle.text} text-sm focus:outline-none border ${currentStyle.border} rounded shadow-sm command-prefix`}
                  placeholder="Enter command..."
                  aria-label="Command input"
                />
              </div>
              {suggestions.length > 0 && (
                <div className={`mt-2 p-2 ${currentStyle.panelBg} ${currentStyle.border} rounded shadow-sm`}>
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className={`text-sm p-1 hover:${currentStyle.buttonBg} cursor-pointer transition-colors duration-150 rounded`}
                      onClick={() => {
                        setInput(suggestion);
                        setSuggestions([]);
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {window.innerWidth >= 768 && (
              <>
                <div
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-gray-500/20 hover:bg-gray-500/40 transition-colors"
                  onMouseDown={(e) => startResize("terminalOutput", e)}
                  aria-label="Resize Terminal Output panel"
                />
                <div className={`separator absolute top-0 right-0 w-px h-full ${currentStyle.separator}`} />
              </>
            )}
          </motion.div>
        )}

        {/* Notification Center Panel */}
        {!panelState.notificationCenter.minimized && (
          <motion.div
            className={`flex flex-col h-full ${currentStyle.panelBg} ${currentStyle.panelBorder} panel-shadow rounded-none panel-width`}
            style={{ width: `${panelState.notificationCenter.width}%` }}
            animate={{ width: `${panelState.notificationCenter.width}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className={`flex items-center justify-between p-3 ${currentStyle.statusBarBg}`}>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold">Notification Center</span>
                {unreadNotifications > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {unreadNotifications}
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    toast.success(showNotifications ? "Notifications hidden." : "Notifications shown.", { duration: 3000 });
                  }}
                  className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded tooltip transition-colors duration-200`}
                  data-tooltip={showNotifications ? "Hide Notifications" : "Show Notifications"}
                  aria-label={showNotifications ? "Hide Notifications" : "Show Notifications"}
                >
                  {showNotifications ? <FaEyeSlash /> : <FaEye />}
                </button>
                <button
                  onClick={() => togglePanelMinimize("notificationCenter")}
                  className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded tooltip transition-colors duration-200`}
                  data-tooltip="Minimize Panel"
                  aria-label="Minimize Notification Center"
                >
                  <FaMinus />
                </button>
              </div>
            </div>
            {showNotifications && (
              <>
                <div className="p-3 flex space-x-2">
                  <select
                    value={notificationFilter.type}
                    onChange={(e) =>
                      setNotificationFilter((prev) => ({ ...prev, type: e.target.value }))
                    }
                    className={`p-2 rounded ${currentStyle.inputBg} ${currentStyle.text} text-sm focus:outline-none shadow-sm`}
                    aria-label="Filter notification type"
                  >
                    <option value="all">All</option>
                    <option value="mover">Movers</option>
                    <option value="loser">Losers</option>
                    <option value="volume_spike">Volume Spikes</option>
                    <option value="price_spike">Price Spikes</option>
                    <option value="news">News</option>
                    <option value="article">Articles</option>
                    <option value="ai_index">AI Index</option>
                    <option value="eth_stats">ETH Stats</option>
                    <option value="new_token">New Tokens</option>
                  </select>
                  <button
                    onClick={handleClearAllNotifications}
                    className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded text-sm tooltip transition-colors duration-200`}
                    data-tooltip="Clear All Notifications"
                    aria-label="Clear all notifications"
                  >
                    Clear All
                  </button>
                </div>
                <div className="p-3">
                  {Object.keys(preferences.notifications).map((type) => (
                    <label key={type} className="flex items-center space-x-2 text-sm mb-2">
                      <input
                        type="checkbox"
                        checked={!notificationFilter.excludeTypes.includes(type)}
                        onChange={() => toggleExcludeType(type)}
                        className="rounded"
                        aria-label={`Toggle ${type} notifications`}
                      />
                      <span>{type.replace("_", " ").toUpperCase()}</span>
                    </label>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-3" ref={notificationRef}>
                  <AnimatePresence>
                    {notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className={`p-3 mb-2 rounded border ${getColorClass(
                          notification.type,
                          preferences.terminalStyle
                        )} flex justify-between items-center transition-all duration-200`}
                        onClick={() => setUnreadNotifications((prev) => Math.max(0, prev - 1))}
                      >
                        <div>
                          <div className="text-sm">{notification.message}</div>
                          <div className="text-xs opacity-75">
                            {new Date(notification.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => togglePinNotification(notification.id)}
                            className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded tooltip transition-colors duration-200`}
                            data-tooltip={pinnedNotifications.includes(notification.id) ? "Unpin" : "Pin"}
                            aria-label={pinnedNotifications.includes(notification.id) ? "Unpin notification" : "Pin notification"}
                          >
                            <FaThumbtack
                              className={pinnedNotifications.includes(notification.id) ? "text-yellow-400" : ""}
                            />
                          </button>
                          <button
                            onClick={() => handleSnoozeNotification(notification.message.split(" ")[0])}
                            className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded tooltip transition-colors duration-200`}
                            data-tooltip="Snooze"
                            aria-label="Snooze notification"
                          >
                            <FaBell />
                          </button>
                          <button
                            onClick={() => handleDismissNotification(notification.id)}
                            className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded tooltip transition-colors duration-200`}
                            data-tooltip="Dismiss"
                            aria-label="Dismiss notification"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      <div className={`p-3 ${currentStyle.statusBarBg} flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0`}>
        <div className="flex space-x-3 flex-wrap justify-center">
          {Object.keys(terminalStyles).map((style) => (
            <button
              key={style}
              onClick={() => handleStyleChange(style)}
              className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded capitalize text-sm tooltip transition-colors duration-200 ${
                preferences.terminalStyle === style ? "border-2 border-blue-500" : ""
              }`}
              data-tooltip={`Switch to ${style} theme`}
              aria-label={`Switch to ${style} theme`}
            >
              {style}
            </button>
          ))}
        </div>
        <button
          onClick={togglePrioritizeNotifications}
          className={`${currentStyle.buttonBg} ${currentStyle.buttonText} p-2 rounded text-sm tooltip transition-colors duration-200`}
          data-tooltip={preferences.prioritizeNotifications ? "Disable Prioritization" : "Enable Prioritization"}
          aria-label={preferences.prioritizeNotifications ? "Disable notification prioritization" : "Enable notification prioritization"}
        >
          {preferences.prioritizeNotifications ? "Disable" : "Enable"} Prioritization
        </button>
      </div>
    </div>
  );
}