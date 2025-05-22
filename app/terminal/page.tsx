"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaBell, FaTimes, FaEye, FaEyeSlash, FaThumbtack, FaChevronDown, FaChevronUp, FaMinus, FaPlus } from "react-icons/fa";
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
import { useSwipeable } from "react-swipeable"; // Changed from Swipeable

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
    return "bg-gray-100/50 text-gray-800 border-gray-300/50";
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
    commandLineBg: "bg-gray-900",
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
    commandLineBg: "bg-gray-900",
    buttonBg: "bg-green-500/20 hover:bg-green-500/40",
    buttonText: "text-green-400 hover:text-green-300",
    inputBg: "bg-gray-900",
  },
  dark: {
    background: "bg-gray-800",
    text: "text-gray-200",
    accentText: "text-blue-400",
    border: "border-gray-600/20",
    separator: "border-gray-600/20",
    panelBg: "bg-gray-800",
    panelBorder: "border-gray-600/20",
    statusBarBg: "bg-gray-900",
    commandLineBg: "bg-gray-900",
    buttonBg: "bg-blue-600/20 hover:bg-blue-600/40",
    buttonText: "text-blue-300 hover:text-blue-200",
    inputBg: "bg-gray-900",
  },
  light: {
    background: "bg-gray-100",
    text: "text-gray-800",
    accentText: "text-blue-600",
    border: "border-gray-300/50",
    separator: "border-gray-300/50",
    panelBg: "bg-gray-100",
    panelBorder: "border-gray-300/50",
    statusBarBg: "bg-gray-200",
    commandLineBg: "bg-gray-200",
    buttonBg: "bg-blue-500/20 hover:bg-blue-500/40",
    buttonText: "text-blue-600 hover:text-blue-500",
    inputBg: "bg-white",
  },
};

export default function HomebaseTerminal() {
  const router = useRouter();
  const { address: walletAddress, isConnected } = useAccount();
  const { data: balance } = useBalance({ address: walletAddress });
  const { disconnect } = useDisconnect();
  const [user, setUser] = useState<User | null>(null);
  const [input, setInput] = useState<string>("");
  const [output, setOutput] = useState<string[]>([
    "Welcome to Homebase Terminal v2.0 - Type /menu for commands",
  ]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationCache, setNotificationCache] = useState<Notification[]>([]);
  const [pinnedNotifications, setPinnedNotifications] = useState<string[]>([]);
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
  const [bootSequenceComplete, setBootSequenceComplete] = useState<boolean>(false);
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

  // Fuzzy search for command suggestions
  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        threshold: 0.3,
        includeScore: true,
      }),
    []
  );

  const debouncedSetNotifications = useCallback(
    debounce((newNotifications: Notification[]) => {
      setNotifications(newNotifications);
    }, 500),
    []
  );

  const currentStyle = useMemo(
    () => terminalStyles[preferences.terminalStyle] || terminalStyles.classic,
    [preferences.terminalStyle]
  );

  // Calculate dynamic panel widths
  const getPanelWidth = useCallback(
    (panel: keyof PanelState): number => {
      const activePanels = Object.keys(panelState).filter(
        (p) => !panelState[p as keyof PanelState].minimized
      );
      if (panelState[panel].minimized) {
        return 50; // Minimized width in pixels
      }
      if (activePanels.length === 0) {
        return 33.33;
      }
      const availableWidth =
        100 - (Object.keys(panelState).length - activePanels.length) * (50 / window.innerWidth) * 100;
      return availableWidth / activePanels.length;
    },
    [panelState]
  );

  // Boot-Up Sequence
  useEffect(() => {
    const bootSteps: string[] = [
      "[INIT] Booting Homebase Terminal v2.0...",
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
        setBootSequenceComplete(true);
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // Authentication, Preferences, and Persistent Filters
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

  // Fetch tokens from tokenDataCache collection
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

  // Fetch notifications
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
      if (newAlerts.length > 0 && isAlertSoundEnabled && audioRef.current) {
        audioRef.current.play().catch((error) => {
          console.error("Failed to play alert sound:", error);
        });
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
    debouncedSetNotifications,
  ]);

  // Fetch news
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

  // Fetch articles
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

  // Fetch AI Index
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

  // Fetch ETH Stats
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

  // Check recurring price alerts
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

  // Check custom alerts (one-time)
  useEffect(() => {
    const checkCustomAlerts = () => {
      tokens.forEach((token) => {
        if (!token.baseToken || !token.baseToken.symbol) {
          console.warn("Invalid token data:", token);
          return;
        }
        const symbol = token.baseToken.symbol;
        const currentPrice = parseFloat(token.priceUsd || "0");
        customAlerts.forEach(async (alert: CustomAlert) => {
          if (alert.symbol !== symbol) return;
          const threshold = alert.threshold;
          const shouldAlert =
            (alert.direction === "above" && currentPrice >= threshold) ||
            (alert.direction === "below" && currentPrice <= threshold);
          if (shouldAlert) {
            const notification: Notification = {
              type: "price_spike",
              message: `${symbol} price ${alert.direction} ${threshold}: $${currentPrice.toFixed(5)}`,
              timestamp: new Date().toISOString(),
              id: `price_spike_${symbol}_${Date.now()}`,
              pairAddress: token.pairAddress,
            };
            await addDoc(collection(db, "notifications"), {
              ...notification,
              createdAt: serverTimestamp(),
            });
            setCustomAlerts((prev: CustomAlert[]) =>
              prev.filter((a: CustomAlert) => a.symbol !== symbol)
            );
            toast.success(`Price alert triggered for ${symbol}!`);
          }
        });
      });
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

  // Fetch token address from Firebase
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

  // Panel resizing
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
          const remainingWidth =
            100 - newSysWidth - (prev.notificationCenter.minimized ? (50 / window.innerWidth) * 100 : prev.notificationCenter.width);
          return {
            ...prev,
            sysUpdate: { ...prev.sysUpdate, width: newSysWidth },
            terminalOutput: { ...prev.terminalOutput, width: remainingWidth },
          };
        } else if (isResizing === "terminalOutput") {
          const newTermWidth = Math.max(20, Math.min(60, resizeRef.current.startWidths.terminalOutput + deltaX));
          const remainingWidth =
            100 - newTermWidth - (prev.sysUpdate.minimized ? (50 / window.innerWidth) * 100 : prev.sysUpdate.width);
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
  }, []);

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

  const handleCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;
      setHistory((prev) => [...prev, command]);
      setHistoryIndex(-1);
      setLastCommand(command);

      const [cmd, ...args] = command.trim().split(" ");
      const lowerCmd = cmd.toLowerCase();

      const showLoading = () => toast.loading("Processing command...");
      const dismissLoading = (id: string) => toast.dismiss(id);

      if (lowerCmd.endsWith("-stats")) {
        const tokenName = lowerCmd.replace(/-stats$/, "").replace("/", "");
        if (tokenName) {
          const toastId = showLoading();
          setOutput([`Fetching stats for ${tokenName.toUpperCase()}...`]);
          try {
            const tokenAddress = await fetchTokenAddress(tokenName.toUpperCase());
            if (!tokenAddress) {
              setOutput([`Token ${tokenName.toUpperCase()} not found in tokens collection.`]);
              toast.error(`Token ${tokenName.toUpperCase()} not found.`, { id: toastId });
              dismissLoading(toastId);
              return;
            }

            const response = await fetch(`/api/tokens?chainId=base&tokenAddresses=${tokenAddress}`, {
              method: "GET",
            });
            if (!response.ok) {
              const errorData = await response.json();
              setOutput([`Failed to fetch stats for ${tokenName.toUpperCase()}: ${errorData.error || "Network error"}`]);
              toast.error(`Failed to fetch stats for ${tokenName.toUpperCase()}.`, { id: toastId });
              dismissLoading(toastId);
              return;
            }
            const data = await response.json();
            if (data && data.length > 0) {
              const token = data[0];
              setOutput([
                `Stats for ${token.baseToken?.symbol || tokenName.toUpperCase()}:`,
                `Price: $${Number(token.priceUsd || "0").toFixed(5)}`,
                `24h Change: ${token.priceChange?.h24?.toFixed(2) ?? "N/A"}%`,
                `Volume (24h): $${token.volume?.h24?.toLocaleString() || "N/A"}`,
                `Liquidity: $${token.liquidity?.usd?.toLocaleString() || "N/A"}`,
                `Market Cap: ${token.marketCap ? `$${token.marketCap.toLocaleString()}` : "N/A"}`,
              ]);
              toast.success(`Stats fetched for ${tokenName.toUpperCase()}.`, { id: toastId });
              dismissLoading(toastId);
            } else {
              setOutput([`Token ${tokenName.toUpperCase()} data not available.`]);
              toast.error(`No data for ${tokenName.toUpperCase()}.`, { id: toastId });
              dismissLoading(toastId);
            }
          } catch (err) {
            console.error("Failed to fetch token stats:", err);
            setOutput([`Failed to fetch stats for ${tokenName.toUpperCase()}: An error occurred.`]);
            toast.error(`Error fetching stats for ${tokenName.toUpperCase()}.`, { id: toastId });
            dismissLoading(toastId);
          }
        }
        return;
      }

      switch (lowerCmd) {
        case "/menu":
          setOutput([
            "Welcome to Homebase Terminal v2.0 - Type /menu for commands",
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
            "/price-alert <symbol> <threshold> <above|below> <repeat> <interval> - Set recurring price alert",
            "/chart <token-symbol> <timeframe> - Show token price chart snapshot",
            "/block-info <number> - Fetch block details",
            "/tx-receipt <tx-hash> - Fetch transaction receipt",
            "/balance <address> - Fetch ETH balance",
            "/watch-token <symbol> - Add token to watchlist",
            "/shortcuts - Show keyboard shortcuts",
            "",
            user ? `Available commands:` : `Please login to access all commands`,
          ]);
          toast.success("Menu displayed.");
          break;

        case "/clear":
          setOutput(["Terminal cleared."]);
          toast.success("Terminal cleared.");
          break;

        case "/refresh-notifications":
          setOutput(["Refreshing notifications..."]);
          setNotifications([]);
          setNotificationCache([]);
          setPinnedNotifications([]);
          setOutput(["Notifications refreshed."]);
          toast.success("Notifications refreshed.");
          break;

        case "/account":
          router.push("/account");
          toast.success("Navigating to account.");
          break;

        case "/news":
          router.push("/base-chain-news");
          toast.success("Navigating to news.");
          break;

        case "/tournaments":
          router.push("/tradingcompetition");
          toast.success("Navigating to tournaments.");
          break;

        case "/whales":
          router.push("/whale-watchers");
          toast.success("Navigating to whale watchers.");
          break;

        case "/scan":
          if (args[0]) {
            const toastId = showLoading();
            setOutput([`Scanning token: ${args[0]}...`]);
            try {
              const response = await fetch(`/api/honeypot/scan?address=${args[0]}`, {
                method: "GET",
              });
              if (!response.ok) {
                const errorData = await response.json();
                setOutput([`Failed to scan token ${args[0]}: ${errorData.error || "Network error"}`]);
                toast.error(`Failed to scan token ${args[0]}.`, { id: toastId });
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
              toast.success(`Token ${args[0]} scanned.`, { id: toastId });
              dismissLoading(toastId);
            } catch (err) {
              console.error("Honeypot scan failed:", err);
              setOutput(["Failed to scan token: An error occurred."]);
              toast.error("Failed to scan token.", { id: toastId });
              dismissLoading(toastId);
            }
          } else {
            setOutput(["Please provide a token address: /scan <token-address>"]);
            toast.error("Token address required.");
          }
          break;

        case "/screener":
          router.push("/token-scanner");
          toast.success("Navigating to token scanner.");
          break;

        case "/logout":
          setOutput(["Logging out..."]);
          await auth.signOut();
          setOutput(["Logged out successfully."]);
          toast.success("Logged out successfully.");
          break;

        case "/settings":
          if (!user) {
            setOutput(["Please login to manage settings."]);
            toast.error("Login required.");
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
              toast.success(`Notification ${type} set to ${value ? "on" : "off"}.`);
            } else {
              setOutput(["Invalid notification type."]);
              toast.error("Invalid notification type.");
            }
          } else if (args[0]?.toLowerCase() === "favorites" && args[1]) {
            if (args[1].toLowerCase() === "list") {
              setOutput(["Favorites:", ...preferences.favorites]);
              toast.success("Favorites listed.");
            } else {
              const pairAddress = args[1];
              const isFavorited = preferences.favorites.includes(pairAddress);
              const favoriteDocRef = doc(db, `users/${user.uid}/favorites`, pairAddress);
              if (isFavorited) {
                await deleteDoc(favoriteDocRef);
                setOutput([`Removed ${pairAddress} from favorites.`]);
                toast.success(`Removed ${pairAddress} from favorites.`);
              } else {
                await setDoc(favoriteDocRef, {
                  pairAddress,
                  createdAt: serverTimestamp(),
                });
                setOutput([`Added ${pairAddress} to favorites.`]);
                toast.success(`Added ${pairAddress} to favorites.`);
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
            toast.success(`Notification prioritization ${value ? "enabled" : "disabled"}.`);
          } else {
            setOutput(["Usage: /settings <notifications|favorites|prioritize> <option> <value>"]);
            toast.error("Invalid settings command.");
          }
          break;

        case "/snooze":
          if (!user) {
            setOutput(["Please login to snooze notifications."]);
            toast.error("Login required.");
            return;
          }
          if (args.length < 2) {
            setOutput(["Usage: /snooze <symbol> <duration> (e.g., /snooze HIGHER 1h)"]);
            toast.error("Invalid snooze command.");
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
          toast.success(`Notifications for ${symbol} snoozed.`);
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
          toast.success("System status displayed.");
          break;

        case "/history":
          setOutput(["Command History:", ...history.slice(-10)]);
          toast.success("Command history displayed.");
          break;

        case "/notify-me":
          if (args.length < 3) {
            setOutput(["Usage: /notify-me <symbol> <threshold> <above|below>"]);
            toast.error("Invalid notify-me command.");
            return;
          }
          const alertSymbol = args[0].toUpperCase();
          const threshold = parseFloat(args[1]);
          const direction = args[2].toLowerCase() as "above" | "below";
          if (isNaN(threshold) || !["above", "below"].includes(direction)) {
            setOutput(["Invalid threshold or direction. Usage: /notify-me <symbol> <threshold> <above|below>"]);
            toast.error("Invalid threshold or direction.");
            return;
          }
          setCustomAlerts((prev: CustomAlert[]) => [
            ...prev,
            { symbol: alertSymbol, threshold, direction },
          ]);
          setOutput([`Custom alert set: Notify when ${alertSymbol} goes ${direction} $${threshold}.`]);
          toast.success(`Alert set for ${alertSymbol}.`);
          break;

        case "/ca":
          if (args.length < 1) {
            setOutput(["Usage: /ca <token-symbol> (e.g., /ca HIGHER)"]);
            toast.error("Token symbol required.");
            return;
          }
          const tokenSymbol = args[0].toUpperCase();
          const toastId = showLoading();
          setOutput([`Fetching contract address for ${tokenSymbol}...`]);
          try {
            const contractAddress = await fetchTokenAddress(tokenSymbol);
            if (!contractAddress) {
              setOutput([`Token ${tokenSymbol} not found in tokens collection.`]);
              toast.error(`Token ${tokenSymbol} not found.`, { id: toastId });
              dismissLoading(toastId);
              return;
            }
            setOutput([`Contract Address for ${tokenSymbol}: ${contractAddress}`]);
            toast.success(`Contract address fetched for ${tokenSymbol}.`, { id: toastId });
            dismissLoading(toastId);
          } catch (err) {
            console.error("Failed to fetch contract address:", err);
            setOutput([`Failed to fetch contract address for ${tokenSymbol}: An error occurred.`]);
            toast.error(`Error fetching contract address for ${tokenSymbol}.`, { id: toastId });
            dismissLoading(toastId);
          }
          break;

        case "/address":
          if (args.length < 1) {
            setOutput(["Usage: /address <wallet-address>"]);
            toast.error("Wallet address required.");
            return;
          }
          const walletAddressInput = args[0];
          if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddressInput)) {
            setOutput(["Invalid wallet address."]);
            toast.error("Invalid wallet address.");
            return;
          }
          const toastIdAddress = showLoading();
          setOutput([`Fetching wallet data for ${walletAddressInput}...`]);
          try {
            const response = await fetch(`/api/wallet/${walletAddressInput}`, {
              method: "GET",
            });
            if (!response.ok) {
              const errorData = await response.json();
              setOutput([`Failed to fetch wallet data: ${errorData.error || "Network error"}`]);
              toast.error("Failed to fetch wallet data.", { id: toastIdAddress });
              dismissLoading(toastIdAddress);
              return;
            }
            const data = await response.json();
            setOutput([
              `Wallet Data for ${walletAddressInput}:`,
              `ETH Balance: ${data.ethBalance.toFixed(4)} ETH`,
              `Tokens:`,
              ...data.tokens.map(
                (token: any) =>
                  `${token.symbol} (${token.name}): ${token.balance} (Contract: ${token.contractAddress})`
              ),
              `Recent Transactions:`,
              ...data.txList.slice(0, 5).map(
                (tx: any) =>
                  `${tx.asset} - ${tx.value} from ${tx.from} to ${tx.to} at ${tx.timestamp}`
              ),
            ]);
            toast.success("Wallet data fetched.", { id: toastIdAddress });
            dismissLoading(toastIdAddress);
          } catch (err) {
            console.error("Failed to fetch wallet data:", err);
            setOutput(["Failed to fetch wallet data: An error occurred."]);
            toast.error("Error fetching wallet data.", { id: toastIdAddress });
            dismissLoading(toastIdAddress);
          }
          break;

        case "/token-balance":
          if (args.length < 1) {
            setOutput(["Usage: /token-balance <wallet-address>"]);
            toast.error("Wallet address required.");
            return;
          }
          const tokenBalanceAddress = args[0];
          if (!/^0x[a-fA-F0-9]{40}$/.test(tokenBalanceAddress)) {
            setOutput(["Invalid wallet address."]);
            toast.error("Invalid wallet address.");
            return;
          }
          const toastIdToken = showLoading();
          setOutput([`Fetching token balances for ${tokenBalanceAddress}...`]);
          try {
            const response = await fetch(`/api/wallet/${tokenBalanceAddress}`, {
              method: "GET",
            });
            if (!response.ok) {
              const errorData = await response.json();
              setOutput([`Failed to fetch token balances: ${errorData.error || "Network error"}`]);
              toast.error("Failed to fetch token balances.", { id: toastIdToken });
              dismissLoading(toastIdToken);
              return;
            }
            const data = await response.json();
            setOutput([
              `Token Balances for ${tokenBalanceAddress}:`,
              ...data.tokens.map(
                (token: any) =>
                  `${token.symbol} (${token.name}): ${token.balance} (Contract: ${token.contractAddress})`
              ),
            ]);
            toast.success("Token balances fetched.", { id: toastIdToken });
            dismissLoading(toastIdToken);
          } catch (err) {
            console.error("Failed to fetch token balances:", err);
            setOutput(["Failed to fetch token balances: An error occurred."]);
            toast.error("Error fetching token balances.", { id: toastIdToken });
            dismissLoading(toastIdToken);
          }
          break;

        case "/tx-history":
          if (args.length < 1) {
            setOutput(["Usage: /tx-history <wallet-address>"]);
            toast.error("Wallet address required.");
            return;
          }
          const txHistoryAddress = args[0];
          if (!/^0x[a-fA-F0-9]{40}$/.test(txHistoryAddress)) {
            setOutput(["Invalid wallet address."]);
            toast.error("Invalid wallet address.");
            return;
          }
          const toastIdTx = showLoading();
          setOutput([`Fetching transaction history for ${txHistoryAddress}...`]);
          try {
            const response = await fetch(`/api/wallet/${txHistoryAddress}`, {
              method: "GET",
            });
            if (!response.ok) {
              const errorData = await response.json();
              setOutput([`Failed to fetch transactions: ${errorData.error || "Network error"}`]);
              toast.error("Failed to fetch transactions.", { id: toastIdTx });
              dismissLoading(toastIdTx);
              return;
            }
            const data = await response.json();
            setOutput([
              `Recent Transactions for ${txHistoryAddress}:`,
              ...data.txList.slice(0, 5).map(
                (tx: any) =>
                  `${tx.asset} - ${tx.value} from ${tx.from} to ${tx.to} at ${tx.timestamp}`
              ),
            ]);
            toast.success("Transactions fetched.", { id: toastIdTx });
            dismissLoading(toastIdTx);
          } catch (err) {
            console.error("Failed to fetch transactions:", err);
            setOutput(["Failed to fetch transactions: An error occurred."]);
            toast.error("Error fetching transactions.", { id: toastIdTx });
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
              toast.success("No upcoming events.", { id: toastIdCalendar });
              dismissLoading(toastIdCalendar);
            } else {
              setOutput([
                "Upcoming Project Events:",
                ...events.map(
                  (event) =>
                    `${event.title} - ${new Date(event.date).toLocaleString()}: ${event.description}`
                ),
              ]);
              toast.success("Events fetched.", { id: toastIdCalendar });
              dismissLoading(toastIdCalendar);
            }
          } catch (err) {
            console.error("Failed to fetch events:", err);
            setOutput(["Failed to fetch events: An error occurred."]);
            toast.error("Error fetching events.", { id: toastIdCalendar });
            dismissLoading(toastIdCalendar);
          }
          break;

        case "/smart-money":
          router.push("/smart-money");
          toast.success("Navigating to smart money.");
          break;

        case "/marketplace":
          router.push("/marketplace");
          toast.success("Navigating to marketplace.");
          break;

        case "/connect-wallet":
          if (isConnected) {
            setOutput([
              "Wallet already connected:",
              walletAddress ?? "Unknown",
              `Balance: ${balance?.formatted || "0"} ETH`,
            ]);
            toast.success("Wallet already connected.");
          } else {
            setOutput(["Please connect your wallet via the UI."]);
            toast.error("Connect wallet via UI.");
          }
          break;

        case "/disconnect-wallet":
          if (!isConnected) {
            setOutput(["No wallet connected."]);
            toast.error("No wallet connected.");
          } else {
            disconnect();
            setOutput(["Wallet disconnected."]);
            toast.success("Wallet disconnected.");
          }
          break;

        case "/price-alert":
          if (!user) {
            setOutput(["Please login to set price alerts."]);
            toast.error("Login required.");
            return;
          }
          if (args.length < 5 || args[3].toLowerCase() !== "repeat") {
            setOutput([
              "Usage: /price-alert <symbol> <threshold> <above|below> repeat <interval> (e.g., /price-alert HIGHER 0.01 above repeat 1h)",
            ]);
            toast.error("Invalid price-alert command.");
            return;
          }
          const priceAlertSymbol = args[0].toUpperCase();
          const priceAlertThreshold = parseFloat(args[1]);
          const priceAlertDirection = args[2].toLowerCase() as "above" | "below";
          const intervalStr = args[4].toLowerCase();
          const interval = intervalStr.endsWith("h")
            ? parseInt(intervalStr) * 60 * 60 * 1000
            : parseInt(intervalStr) * 60 * 1000;
          if (
            isNaN(priceAlertThreshold) ||
            !["above", "below"].includes(priceAlertDirection) ||
            isNaN(interval)
          ) {
            setOutput([
              "Invalid parameters. Usage: /price-alert <symbol> <threshold> <above|below> repeat <interval>",
            ]);
            toast.error("Invalid price-alert parameters.");
            return;
          }
          await setDoc(doc(db, `users/${user.uid}/priceAlerts/${priceAlertSymbol}`), {
            threshold: priceAlertThreshold,
            direction: priceAlertDirection,
            interval,
          });
          setOutput([
            `Recurring price alert set: Notify when ${priceAlertSymbol} goes ${priceAlertDirection} $${priceAlertThreshold} every ${interval / 1000 / 60} minutes.`,
          ]);
          toast.success(`Price alert set for ${priceAlertSymbol}.`);
          break;

        case "/chart":
          if (args.length < 2) {
            setOutput(["Usage: /chart <token-symbol> <timeframe> (e.g., /chart HIGHER 1h)"]);
            toast.error("Invalid chart command.");
            return;
          }
          const chartSymbol = args[0].toUpperCase();
          const timeframe = args[1].toLowerCase();
          if (!["1h", "6h", "24h"].includes(timeframe)) {
            setOutput(["Supported timeframes: 1h, 6h, 24h"]);
            toast.error("Unsupported timeframe.");
            return;
          }
          const toastIdChart = showLoading();
          setOutput([`Fetching price chart for ${chartSymbol} (${timeframe})...`]);
          try {
            const response = await fetch(`/api/token-chart?symbol=${chartSymbol}&timeframe=${timeframe}`);
            if (!response.ok) {
              const errorData = await response.json();
              setOutput([`Failed to fetch chart: ${errorData.error || "Network error"}`]);
              toast.error("Failed to fetch chart.", { id: toastIdChart });
              dismissLoading(toastIdChart);
              return;
            }
            const data = await response.json();
            const prices = data.prices || [];
            if (prices.length === 0) {
              setOutput([`No chart data available for ${chartSymbol}.`]);
              toast.error(`No chart data for ${chartSymbol}.`, { id: toastIdChart });
              dismissLoading(toastIdChart);
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
            toast.success(`Chart fetched for ${chartSymbol}.`, { id: toastIdChart });
            dismissLoading(toastIdChart);
          } catch (err) {
            console.error("Failed to fetch chart:", err);
            setOutput(["Failed to fetch chart: An error occurred."]);
            toast.error("Error fetching chart.", { id: toastIdChart });
            dismissLoading(toastIdChart);
          }
          break;

        case "/block-info":
          if (args.length < 1) {
            setOutput(["Usage: /block-info <number>"]);
            toast.error("Block number required.");
            return;
          }
          const blockNumber = args[0];
          const toastIdBlock = showLoading();
          setOutput([`Fetching block info for block ${blockNumber}...`]);
          try {
            const block = await provider.getBlock(parseInt(blockNumber));
            if (!block) {
              setOutput([`Block ${blockNumber} not found.`]);
              toast.error(`Block ${blockNumber} not found.`, { id: toastIdBlock });
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
            toast.success(`Block info fetched for ${blockNumber}.`, { id: toastIdBlock });
            dismissLoading(toastIdBlock);
          } catch (err) {
            console.error("Failed to fetch block info:", err);
            setOutput(["Failed to fetch block info: An error occurred."]);
            toast.error("Error fetching block info.", { id: toastIdBlock });
            dismissLoading(toastIdBlock);
          }
          break;

        case "/tx-receipt":
          if (args.length < 1) {
            setOutput(["Usage: /tx-receipt <tx-hash>"]);
            toast.error("Transaction hash required.");
            return;
          }
          const txHash = args[0];
          const toastIdTxReceipt = showLoading();
          setOutput([`Fetching transaction receipt for ${txHash}...`]);
          try {
            const receipt = await provider.getTransactionReceipt(txHash);
            if (!receipt) {
              setOutput([`Transaction receipt not found for ${txHash}.`]);
              toast.error(`Receipt not found for ${txHash}.`, { id: toastIdTxReceipt });
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
            toast.success(`Receipt fetched for ${txHash}.`, { id: toastIdTxReceipt });
            dismissLoading(toastIdTxReceipt);
          } catch (err) {
            console.error("Failed to fetch transaction receipt:", err);
            setOutput(["Failed to fetch transaction receipt: An error occurred."]);
            toast.error("Error fetching transaction receipt.", { id: toastIdTxReceipt });
            dismissLoading(toastIdTxReceipt);
          }
          break;

        case "/balance":
          if (args.length < 1) {
            setOutput(["Usage: /balance <address>"]);
            toast.error("Address required.");
            return;
          }
          const address = args[0];
          if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            setOutput(["Invalid address."]);
            toast.error("Invalid address.");
            return;
          }
          const toastIdBalance = showLoading();
          setOutput([`Fetching balance for ${address}...`]);
          try {
            const balance = await provider.getBalance(address);
            const ethBalance = ethers.formatEther(balance);
            setOutput([`Balance for ${address}: ${ethBalance} ETH`]);
            toast.success(`Balance fetched for ${address}.`, { id: toastIdBalance });
            dismissLoading(toastIdBalance);
          } catch (err) {
            console.error("Failed to fetch balance:", err);
            setOutput(["Failed to fetch balance: An error occurred."]);
            toast.error("Error fetching balance.", { id: toastIdBalance });
            dismissLoading(toastIdBalance);
          }
          break;

        case "/watch-token":
          if (!user) {
            setOutput(["Please login to watch tokens."]);
            toast.error("Login required.");
            return;
          }
          if (args.length < 1) {
            setOutput(["Usage: /watch-token <symbol>"]);
            toast.error("Token symbol required.");
            return;
          }
          const watchSymbol = args[0].toUpperCase();
          const token = tokens.find((t) => t.baseToken.symbol === watchSymbol);
          if (!token) {
            setOutput([`Token ${watchSymbol} not found.`]);
            toast.error(`Token ${watchSymbol} not found.`);
            return;
          }
          await setDoc(doc(db, `users/${user.uid}/watchTokens/${watchSymbol}`), {
            symbol: watchSymbol,
            createdAt: serverTimestamp(),
          });
          setOutput([`Watching ${watchSymbol} for price updates.`]);
          toast.success(`Watching ${watchSymbol}.`);
          break;

        case "/shortcuts":
          setOutput([
            "Keyboard Shortcuts:",
            "Ctrl+L - Clear terminal",
            "Tab - Auto-complete command",
            "ArrowUp - Previous command",
            "ArrowDown - Next command",
          ]);
          toast.success("Shortcuts displayed.");
          break;

        default:
          setOutput([`Command not found: ${command}`, "Type /menu for available commands."]);
          toast.error("Command not found.");
      }
    },
    [
      user,
      preferences,
      notifications,
      router,
      snoozedTokens,
      tokens,
      uptime,
      isOnline,
      lastCommand,
      history,
      customAlerts,
      networkLatency,
      fetchTokenAddress,
      isConnected,
      walletAddress,
      balance,
      disconnect,
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
      toast.success(`Theme changed to ${style}.`);
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
      toast.success(`Toggled filter for ${type}.`);
    },
    []
  );

  const handleClearAllNotifications = useCallback(() => {
    setNotifications([]);
    setNotificationCache([]);
    setPinnedNotifications([]);
    toast.success("All notifications cleared.");
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
      toast.success(pinnedNotifications.includes(id) ? "Notification unpinned." : "Notification pinned.");
    },
    [pinnedNotifications, preferences.prioritizeNotifications]
  );

  const handleSnoozeNotification = useCallback(
    async (symbol: string) => {
      if (!user) {
        setOutput(["Please login to snooze notifications."]);
        toast.error("Login required.");
        return;
      }
      const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
      await setDoc(doc(db, `users/${user.uid}/snoozed/${symbol}`), { expiry });
      setOutput([`Notifications for ${symbol} snoozed until ${new Date(expiry).toLocaleString()}.`]);
      toast.success(`Notifications for ${symbol} snoozed.`);
    },
    [user]
  );

  const handleDismissNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setPinnedNotifications((prev) => prev.filter((pid) => pid !== id));
      toast.success("Notification dismissed.");
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
          newState[p as keyof PanelState].width = getPanelWidth(p as keyof PanelState);
        });
        return newState;
      });
      toast.success(
        `${panel.replace(/([A-Z])/g, " $1").trim()} ${panelState[panel].minimized ? "restored" : "minimized"}.`
      );
    },
    [getPanelWidth, panelState]
  );

  const togglePrioritizeNotifications = useCallback(
    async () => {
      if (!user) {
        setOutput(["Please login to manage settings."]);
        toast.error("Login required.");
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
      setPreferences((prev) => ({
        ...prev,
        prioritizeNotifications: newValue,
      }));
      setOutput([`Notification prioritization ${newValue ? "enabled" : "disabled"}.`]);
      toast.success(`Notification prioritization ${newValue ? "enabled" : "disabled"}.`);
    },
    [user, preferences]
  );

  // Section Header Component
  interface SectionHeaderProps {
    title: string;
    showDots?: boolean;
    currentStyle: TerminalStyle;
    panelKey: keyof PanelState;
    isMinimized: boolean;
  }

  const SectionHeader = ({
    title,
    showDots = false,
    currentStyle,
    panelKey,
    isMinimized,
  }: SectionHeaderProps) => (
    <div className="mb-3 -mx-3 -mt-3">
      <div
        className={`w-full py-2 px-3 flex justify-between items-center border-b ${currentStyle.separator}`}
      >
        <h2
        className={`text-base font-bold uppercase ${currentStyle.accentText}`}
        >
          {title.replace("_", " ")}
        </h2>
        <div className="flex items-center space-x-2">
          {showDots && (
            <div className="flex items-center space-x-1">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full opacity-80 hover:opacity-100 transition-opacity duration-150" />
              <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full opacity-80 hover:opacity-100 transition-opacity duration-150" />
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full opacity-80 hover:opacity-100 transition-opacity duration-150" />
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => togglePanelMinimize(panelKey)}
            className={`p-1 rounded-full ${currentStyle.buttonBg} ${currentStyle.buttonText}`}
            aria-label={isMinimized ? `Restore ${title} panel` : `Minimize ${title} panel`}
            title={isMinimized ? "Restore panel" : "Minimize panel"}
          >
            {isMinimized ? <FaPlus className="w-3 h-3" /> : <FaMinus className="w-3 h-3" />}
          </motion.button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`w-screen h-screen ${currentStyle.background} ${currentStyle.text} font-mono m-0 p-0 overflow-hidden flex flex-col touch-none select-none`}
    >
      <Toaster position="top-right" />
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />

      {/* Desktop Layout: Three Columns */}
      <div className="hidden md:flex flex-1 w-full h-[calc(100vh-64px)] relative">
        {/* SYS_UPDATE Panel */}
        <motion.div
          animate={{ width: panelState.sysUpdate.minimized ? "50px" : `${panelState.sysUpdate.width}%` }}
          transition={{ duration: 0.15 }}
          className={`h-full ${currentStyle.panelBg} ${currentStyle.panelBorder} p-3 overflow-y-auto shadow-lg overscroll-contain scrollbar-hidden border-r ${currentStyle.separator} relative`}
        >
          {panelState.sysUpdate.minimized ? (
            <motion.div
              className="flex items-center justify-center h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => togglePanelMinimize("sysUpdate")}
                className={`flex items-center space-x-1 p-2 rounded-md ${currentStyle.buttonBg} ${currentStyle.buttonText}`}
                aria-label="Restore SYS_UPDATE panel"
                title="Restore SYS_UPDATE"
              >
                <FaPlus className="w-4 h-4" />
                <span className="text-xs uppercase">SYS</span>
              </motion.button>
            </motion.div>
          ) : (
            <>
              <SectionHeader
                title="SYS_UPDATE"
                showDots={true}
                currentStyle={currentStyle}
                panelKey="sysUpdate"
                isMinimized={panelState.sysUpdate.minimized}
              />
              <div className="space-y-2">
                {sysUpdates.map((update, idx) => (
                  <motion.p
                    key={idx}
                    initial={{ x: -15, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className={`text-sm ${
                      update.includes("[READY]")
                        ? currentStyle.accentText
                        : "opacity-80"
                    } hover:opacity-100 transition-opacity duration-150`}
                  >
                    {update}
                  </motion.p>
                ))}
                {bootSequenceComplete && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs opacity-60"
                  >
                    Last update: {new Date().toLocaleTimeString()}
                  </motion.p>
                )}
              </div>
              {bootSequenceComplete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="mt-3 space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium uppercase">Terminal Style:</label>
                    <select
                      value={preferences.terminalStyle}
                      onChange={(e) => handleStyleChange(e.target.value)}
                      className={`rounded-md px-2 py-1 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-150 ${currentStyle.inputBg} ${currentStyle.text}`}
                      aria-label="Select terminal style"
                    >
                      <option value="classic">Classic</option>
                      <option value="hacker">Hacker</option>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </>
          )}
          {!panelState.sysUpdate.minimized && !panelState.terminalOutput.minimized && (
            <motion.div
              className="absolute top-0 right-0 w-2 h-full cursor-col-resize bg-gray-500/20 hover:bg-gray-500/40 transition-colors duration-150"
              onMouseDown={(e) => startResize("sysUpdate", e)}
              aria-label="Resize SYS_UPDATE panel"
              title="Drag to resize"
            >
              <Bars3Icon className="w-4 h-4 absolute top-1/2 transform -translate-y-1/2 text-gray-400" />
            </motion.div>
          )}
        </motion.div>

        {/* TERMINAL_OUTPUT Panel */}
        <motion.div
          animate={{ width: panelState.terminalOutput.minimized ? "50px" : `${panelState.terminalOutput.width}%` }}
          transition={{ duration: 0.15 }}
          className={`h-full ${currentStyle.panelBg} p-3 flex flex-col shadow-lg overscroll-contain scrollbar-hidden border-r ${currentStyle.separator} relative`}
        >
          {panelState.terminalOutput.minimized ? (
            <motion.div
              className="flex items-center justify-center h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => togglePanelMinimize("terminalOutput")}
                className={`flex items-center space-x-1 p-2 rounded-md ${currentStyle.buttonBg} ${currentStyle.buttonText}`}
                aria-label="Restore TERMINAL_OUTPUT panel"
                title="Restore TERMINAL_OUTPUT"
              >
                <FaPlus className="w-4 h-4" />
                <span className="text-xs uppercase">TERM</span>
              </motion.button>
            </motion.div>
          ) : (
            <>
              <SectionHeader
                title="TERMINAL_OUTPUT"
                currentStyle={currentStyle}
                panelKey="terminalOutput"
                isMinimized={panelState.terminalOutput.minimized}
              />
              <div ref={outputRef} className="flex-1 overflow-y-auto space-y-1.5">
                <AnimatePresence>
                  {output.map((line, idx) => (
                    <motion.p
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm opacity-80 hover:opacity-100 transition-opacity duration-150"
                    >
                      {line}
                    </motion.p>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
          {!panelState.terminalOutput.minimized && !panelState.notificationCenter.minimized && (
            <motion.div
              className="absolute top-0 right-0 w-2 h-full cursor-col-resize bg-gray-500/20 hover:bg-gray-500/40 transition-colors duration-150"
              onMouseDown={(e) => startResize("terminalOutput", e)}
              aria-label="Resize TERMINAL_OUTPUT panel"
              title="Drag to resize"
            >
              <Bars3Icon className="w-4 h-4 absolute top-1/2 transform -translate-y-1/2 text-gray-400" />
            </motion.div>
          )}
        </motion.div>

        {/* NOTIFICATION_CENTER Panel */}
        <motion.div
          animate={{ width: panelState.notificationCenter.minimized ? "50px" : `${panelState.notificationCenter.width}%` }}
          transition={{ duration: 0.15 }}
          className={`h-full ${currentStyle.panelBg} ${currentStyle.panelBorder} p-3 overflow-y-auto shadow-lg overscroll-contain scrollbar-hidden`}
          ref={notificationRef}
        >
          {panelState.notificationCenter.minimized ? (
            <motion.div
              className="flex items-center justify-center h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => togglePanelMinimize("notificationCenter")}
                className={`flex items-center space-x-1 p-2 rounded-md ${currentStyle.buttonBg} ${currentStyle.buttonText}`}
                aria-label="Restore NOTIFICATION_CENTER panel"
                title="Restore NOTIFICATION_CENTER"
              >
                <FaPlus className="w-4 h-4" />
                <span className="text-xs uppercase">NOTIF</span>
              </motion.button>
            </motion.div>
          ) : (
            <>
              <SectionHeader
                title="NOTIFICATION_CENTER"
                currentStyle={currentStyle}
                panelKey="notificationCenter"
                isMinimized={panelState.notificationCenter.minimized}
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="mb-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium uppercase">
                    Pinned: {pinnedNotifications.length}
                  </span>
                  <button
                    onClick={handleClearAllNotifications}
                    className={`text-xs px-3 py-1 rounded-md uppercase transition-all duration-150 ${currentStyle.buttonBg} ${currentStyle.buttonText}`}
                    aria-label="Clear all notifications"
                    title="Clear all notifications"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium uppercase">Exclude Types:</label>
                    <div className="flex flex-wrap gap-1">
                      {[
                        "mover",
                        "loser",
                        "volume_spike",
                        "price_spike",
                        "news",
                        "article",
                        "ai_index",
                        "eth_stats",
                        "new_token",
                      ].map((type, idx) => (
                        <motion.button
                          key={type}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: idx * 0.015, duration: 0.15 }}
                          onClick={() => toggleExcludeType(type)}
                          className={`text-xs px-2 py-1 rounded-md border uppercase transition-all duration-150 flex items-center space-x-1 ${currentStyle.buttonBg} ${currentStyle.buttonText} ${
                            notificationFilter.excludeTypes.includes(type)
                              ? "bg-red-600/20 text-red-300 border-red-500/20"
                              : ""
                          }`}
                          aria-label={`Toggle ${type.replace("_", " ")} filter`}
                          title={`Toggle ${type.replace("_", " ")} filter`}
                        >
                          <span>{type.replace("_", " ")}</span>
                          {notificationFilter.excludeTypes.includes(type) && (
                            <FaTimes className="w-3 h-3" />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium uppercase">Show Only:</label>
                    <select
                      value={notificationFilter.type}
                      onChange={(e) =>
                        setNotificationFilter((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                      className={`rounded-md px-2 py-1 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-150 ${currentStyle.inputBg} ${currentStyle.text}`}
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
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium uppercase">Alert Sound:</label>
                    <input
                      type="checkbox"
                      checked={isAlertSoundEnabled}
                      onChange={(e) => setIsAlertSoundEnabled(e.target.checked)}
                      className={`w-4 h-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-150 ${currentStyle.inputBg}`}
                      aria-label="Toggle alert sound"
                      title="Toggle alert sound"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium uppercase">Prioritize Pinned:</label>
                    <input
                      type="checkbox"
                      checked={preferences.prioritizeNotifications}
                      onChange={togglePrioritizeNotifications}
                      className={`w-4 h-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-150 ${currentStyle.inputBg}`}
                      aria-label="Toggle prioritize pinned notifications"
                      title="Toggle prioritize pinned notifications"
                    />
                  </div>
                </div>
              </motion.div>
              <div className="space-y-1.5">
                {notifications.length === 0 ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs opacity-60"
                  >
                    No notifications.
                  </motion.p>
                ) : (
                  notifications.map((notification) => {
                    const handlers = useSwipeable({
                      onSwipedRight: () => handleDismissNotification(notification.id),
                      trackMouse: true,
                    });
                    return (
                      <motion.div
                        key={notification.id}
                        {...handlers}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`text-xs ${getColorClass(
                          notification.type,
                          preferences.terminalStyle
                        )} flex p-2 rounded-md border transition-all duration-150 hover:brightness-125 cursor-pointer relative shadow-sm min-h-[56px]`}
                      >
                        <div className="flex items-start space-x-2 flex-1">
                          <FaBell className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-80" />
                          <div className="flex-1">
                            <p className="font-semibold leading-tight">
                              {notification.message}
                            </p>
                            <div className="mt-0.5">
                              <p className="text-xs opacity-80 leading-tight">
                                {new Date(notification.timestamp).toLocaleString()}
                              </p>
                              {notification.pairAddress && (
                                <button
                                  onClick={() =>
                                    router.push(`/app/token-scanner/${notification.pairAddress}/chart/page.tsx`)
                                  }
                                  className={`text-xs underline mt-0.5 transition-all duration-150 ${currentStyle.buttonText}`}
                                  aria-label={`View chart for ${notification.message}`}
                                  title="View token chart"
                                >
                                  View Chart
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center space-y-1 ml-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => togglePinNotification(notification.id)}
                            className={`p-1 rounded-full transition-all duration-150 ${
                              pinnedNotifications.includes(notification.id)
                                ? "text-yellow-400"
                                : "text-gray-400 hover:text-yellow-400"
                            }`}
                            aria-label={
                              pinnedNotifications.includes(notification.id)
                                ? "Unpin notification"
                                : "Pin notification"
                            }
                            title={pinnedNotifications.includes(notification.id) ? "Unpin" : "Pin"}
                          >
                            <FaThumbtack className="w-3.5 h-3.5" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleSnoozeNotification(notification.message.split(" ")[0])}
                            className="p-1 rounded-full text-gray-400 hover:text-blue-400 transition-all duration-150 text-xs"
                            aria-label="Snooze notification for 1 hour"
                            title="Snooze for 1h"
                          >
                            Snooze
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDismissNotification(notification.id)}
                            className="p-1 rounded-full text-gray-400 hover:text-red-400 transition-all duration-150 text-xs"
                            aria-label="Dismiss notification"
                            title="Dismiss"
                          >
                            Dismiss
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Mobile Layout: Stacked with Collapsible Notifications */}
      <div className="md:hidden flex-1 w-full h-screen flex flex-col relative">
        {/* TERMINAL_OUTPUT Panel */}
        <div className="flex-1 p-3 pb-[120px]">
          <SectionHeader
            title="TERMINAL_OUTPUT"
            currentStyle={currentStyle}
            panelKey="terminalOutput"
            isMinimized={panelState.terminalOutput.minimized}
          />
          {!panelState.terminalOutput.minimized && (
            <>
              <div
                ref={outputRef}
                className="h-[calc(100vh-220px)] overflow-y-auto space-y-1.5 overscroll-contain scrollbar-hidden"
              >
                <AnimatePresence>
                  {output.map((line, idx) => (
                    <motion.p
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm opacity-80 hover:opacity-100 transition-opacity duration-150"
                    >
                      {line}
                    </motion.p>
                  ))}
                </AnimatePresence>
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="mt-2"
              >
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`flex items-center justify-center space-x-1.5 text-xs px-3 py-1.5 rounded-md uppercase w-full transition-all duration-150 ${currentStyle.buttonBg} ${currentStyle.buttonText}`}
                  aria-label={showNotifications ? "Hide notifications" : "Show notifications"}
                  title={showNotifications ? "Hide notifications" : "Show notifications"}
                >
                  {showNotifications ? (
                    <>
                      <FaEyeSlash className="w-3.5 h-3.5" />
                      <span>Hide Notifications</span>
                    </>
                  ) : (
                    <>
                      <FaEye className="w-3.5 h-3.5" />
                      <span>Show Notifications</span>
                    </>
                  )}
                  {showNotifications ? (
                    <FaChevronUp className="w-3.5 h-3.5 ml-1" />
                  ) : (
                    <FaChevronDown className="w-3.5 h-3.5 ml-1" />
                  )}
                </button>
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="mt-2 space-y-1.5 overflow-hidden max-h-[140px] overflow-y-auto overscroll-contain scrollbar-hidden"
                    >
                      {notifications.length === 0 ? (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.15 }}
                          className="text-xs opacity-60"
                        >
                          No notifications.
                        </motion.p>
                      ) : (
                        notifications.slice(0, 10).map((notification) => {
                          const handlers = useSwipeable({
                            onSwipedRight: () => handleDismissNotification(notification.id),
                            trackMouse: true,
                          });
                          return (
                            <motion.div
                              key={notification.id}
                              {...handlers}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.15 }}
                              className={`text-xs ${getColorClass(
                                notification.type,
                                preferences.terminalStyle
                              )} flex p-2 rounded-md border transition-all duration-150 hover:brightness-125 cursor-pointer relative shadow-sm min-h-[56px]`}
                            >
                              <div className="flex items-start space-x-2 flex-1">
                                <FaBell className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-80" />
                                <div className="flex-1">
                                  <p className="font-semibold leading-tight">
                                    {notification.message}
                                  </p>
                                  <div className="mt-0.5">
                                    <p className="text-xs opacity-80 leading-tight">
                                      {new Date(notification.timestamp).toLocaleString()}
                                    </p>
                                    {notification.pairAddress && (
                                      <button
                                        onClick={() =>
                                          router.push(`/app/token-scanner/${notification.pairAddress}/chart/page.tsx`)
                                        }
                                        className={`text-xs underline mt-0.5 transition-all duration-150 ${currentStyle.buttonText}`}
                                        aria-label={`View chart for ${notification.message}`}
                                        title="View token chart"
                                      >
                                        View Chart
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-center space-y-1 ml-2">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => togglePinNotification(notification.id)}
                                  className={`p-1 rounded-full transition-all duration-150 ${
                                    pinnedNotifications.includes(notification.id)
                                      ? "text-yellow-400"
                                      : "text-gray-400 hover:text-yellow-400"
                                  }`}
                                  aria-label={
                                    pinnedNotifications.includes(notification.id)
                                      ? "Unpin notification"
                                      : "Pin notification"
                                  }
                                  title={
                                    pinnedNotifications.includes(notification.id) ? "Unpin" : "Pin"
                                  }
                                >
                                  <FaThumbtack className="w-3.5 h-3.5" />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleSnoozeNotification(notification.message.split(" ")[0])}
                                  className="p-1 rounded-full text-gray-400 hover:text-blue-400 transition-all duration-150 text-xs"
                                  aria-label="Snooze notification for 1 hour"
                                  title="Snooze for 1h"
                                >
                                  Snooze
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleDismissNotification(notification.id)}
                                  className="p-1 rounded-full text-gray-400 hover:text-red-400 transition-all duration-150 text-xs"
                                  aria-label="Dismiss notification"
                                  title="Dismiss"
                                >
                                  Dismiss
                                </motion.button>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </>
          )}
        </div>

        {/* Command Line - Fixed to Bottom on Mobile */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className={`fixed bottom-10 left-0 right-0 h-10 flex items-center space-x-2 px-3 py-2 border-t ${currentStyle.commandLineBg} ${currentStyle.separator} md:static md:bottom-auto md:border-b-0 z-10`}
        >
          <span className={`text-sm font-medium uppercase ${currentStyle.accentText}`}>
            user@homebase ~ v2 $
          </span>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`w-full rounded-md px-2 py-1 ${currentStyle.inputBg} ${currentStyle.text} focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-150 text-sm placeholder-opacity-50`}
              placeholder="Type command here..."
              aria-label="Enter terminal command"
            />
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className={`absolute bottom-full left-0 w-full rounded-md shadow-xl z-50 max-h-36 overflow-y-auto ${currentStyle.panelBg} ${currentStyle.text} scrollbar-hidden`}
              >
                {suggestions.map((suggestion, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.015, duration: 0.15 }}
                    className={`p-1.5 cursor-pointer text-sm ${currentStyle.buttonBg} ${currentStyle.buttonText} rounded-md`}
                    onMouseDown={() => {
                      setInput(suggestion);
                      setSuggestions([]);
                    }}
                    role="option"
                    aria-selected={input === suggestion}
                  >
                    {suggestion}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
          {/* Minimized Panel Buttons on Mobile */}
          <div className="flex items-center space-x-2">
            {Object.entries(panelState).map(([panel, state]) =>
              state.minimized ? (
                <motion.button
                  key={panel}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => togglePanelMinimize(panel as keyof PanelState)}
                  className={`flex items-center space-x-1 p-1 rounded-md ${currentStyle.buttonBg} ${currentStyle.buttonText}`}
                  aria-label={`Restore ${panel.replace(/([A-Z])/g, " $1").trim()} panel`}
                  title={`Restore ${panel.replace(/([A-Z])/g, " $1").trim()}`}
                >
                  <FaPlus className="w-3 h-3" />
                  <span className="text-xs uppercase">
                    {panel === "sysUpdate" ? "SYS" : panel === "terminalOutput" ? "TERM" : "NOTIF"}
                  </span>
                </motion.button>
              ) : null
            )}
          </div>
        </motion.div>

        {/* Status Bar - Fixed to Bottom on Mobile */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className={`fixed bottom-0 left-0 right-0 ${currentStyle.statusBarBg} ${currentStyle.text} p-2 text-xs flex justify-between items-center ${currentStyle.separator} border-t md:static md:bottom-auto z-10`}
        >
          <span className="flex items-center space-x-1.5">
            <span
              className="text-red-400 cursor-pointer hover:text-red-300 transition-colors duration-150 uppercase"
              aria-label="View issues"
              title="View issues"
            >
              O 1 ISSUE
            </span>
            <span className="text-green-400 uppercase">X v2.0</span>
          </span>
          <span className="uppercase">OS: web</span>
          <span className="uppercase">Uptime: {uptime}</span>
          <span className="flex items-center space-x-1">
            <span className="uppercase">Network: {networkLatency}ms</span>
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"} animate-pulse`}
              aria-label={isOnline ? "Network online" : "Network offline"}
            />
          </span>
        </motion.div>
      </div>

      {/* Command Line - Desktop Only */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.15 }}
        className={`hidden md:flex w-full h-10 items-center space-x-2 px-3 py-2 border-t ${currentStyle.commandLineBg} ${currentStyle.separator}`}
      >
        <span className={`text-sm font-medium uppercase ${currentStyle.accentText}`}>
          user@homebase ~ v2 $
        </span>
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full rounded-md px-2 py-1 ${currentStyle.inputBg} ${currentStyle.text} focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-150 text-sm placeholder-opacity-50`}
            placeholder="Type command here..."
            aria-label="Enter terminal command"
          />
          {suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className={`absolute bottom-full left-0 w-full rounded-md shadow-xl z-50 max-h-36 overflow-y-auto ${currentStyle.panelBg} ${currentStyle.text} scrollbar-hidden`}
            >
              {suggestions.map((suggestion, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.015, duration: 0.15 }}
                  className={`p-1.5 cursor-pointer text-sm ${currentStyle.buttonBg} ${currentStyle.buttonText} rounded-md`}
                  onMouseDown={() => {
                    setInput(suggestion);
                    setSuggestions([]);
                  }}
                  role="option"
                  aria-selected={input === suggestion}
                >
                  {suggestion}
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Status Bar - Desktop Only */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.15 }}
        className={`hidden md:flex w-full ${currentStyle.statusBarBg} ${currentStyle.text} p-2 text-xs justify-between items-center ${currentStyle.separator} border-t`}
      >
        <span className="flex items-center space-x-2">
          <span
            className="text-red-400 cursor-pointer hover:text-red-300 transition-colors duration-150 uppercase"
            aria-label="View issues"
            title="View issues"
          >
            O 1 ISSUE
          </span>
          <span className="text-green-400 uppercase">X v2.0</span>
          {/* Minimized Panel Buttons */}
          {Object.entries(panelState).map(([panel, state]) =>
            state.minimized ? (
              <motion.button
                key={panel}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => togglePanelMinimize(panel as keyof PanelState)}
                className={`flex items-center space-x-1 p-1 rounded-md ${currentStyle.buttonBg} ${currentStyle.buttonText}`}
                aria-label={`Restore ${panel.replace(/([A-Z])/g, " $1").trim()} panel`}
                title={`Restore ${panel.replace(/([A-Z])/g, " $1").trim()}`}
              >
                <FaPlus className="w-3 h-3" />
                <span className="text-xs uppercase">
                  {panel === "sysUpdate" ? "SYS" : panel === "terminalOutput" ? "TERM" : "NOTIF"}
                </span>
              </motion.button>
            ) : null
          )}
        </span>
        <span className="uppercase">OS: web</span>
        <span className="uppercase">Uptime: {uptime}</span>
        <span className="flex items-center space-x-1">
          <span className="uppercase">Network: {networkLatency}ms</span>
          <span
            className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"} animate-pulse`}
            aria-label={isOnline ? "Network online" : "Network offline"}
          />
        </span>
      </motion.div>

      {/* Global Scrollbar Styles */}
      <style jsx global>{`
        .scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hidden {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}