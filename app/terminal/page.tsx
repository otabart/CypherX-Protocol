"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaBell, FaTimes, FaEye, FaEyeSlash, FaThumbtack, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase.ts";
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
    | "new_token";
  message: string;
  timestamp: string;
  pairAddress?: string;
}

interface UserPreferences {
  notifications: { [key: string]: boolean };
  favorites: string[];
  terminalStyle: string;
  prioritizeNotifications: boolean;
  notificationFilter?: { type: string; excludeTypes: string[] };
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

// Constants
const PRICE_CHECK_INTERVAL = 60_000;
const ETH_STATS_INTERVAL = 1_800_000;
const AI_INDEX_INTERVAL = 14_400_000;

// Utility Functions
const getColorClass = (type: string, theme: string): string => {
  if (theme === "hacker") {
    return "bg-green-900/30 text-green-400 border-green-700/50";
  }
  switch (type) {
    case "mover":
      return "bg-green-900/30 text-green-400 border-green-700/50";
    case "loser":
      return "bg-red-900/30 text-red-400 border-red-700/50";
    case "volume_spike":
      return "bg-blue-900/30 text-blue-400 border-blue-700/50";
    case "price_spike":
      return "bg-blue-900/30 text-blue-400 border-blue-700/50";
    case "news":
      return "bg-teal-900/30 text-teal-400 border-teal-700/50";
    case "ai_index":
      return "bg-indigo-900/30 text-indigo-400 border-indigo-700/50";
    case "eth_stats":
      return "bg-purple-900/30 text-purple-400 border-purple-700/50";
    case "new_token":
      return "bg-orange-900/30 text-orange-400 border-orange-700/50";
    default:
      return "bg-gray-900/30 text-gray-400 border-gray-700/50";
  }
};

const formatUptime = (startTime: number): string => {
  const diff = Date.now() - startTime;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor(((diff % (1000 * 60 * 60)) % (1000 * 60)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
};

// Terminal Styles
const terminalStyles: Record<string, TerminalStyle> = {
  classic: {
    background: "bg-[#1A2533]",
    text: "text-blue-300",
    accentText: "text-blue-400",
    border: "border-blue-600/50",
    separator: "border-blue-600/50",
    panelBg: "bg-[#1A2533]",
    panelBorder: "border-blue-600/20",
    statusBarBg: "bg-[#141C27]",
    commandLineBg: "bg-[#141C27]",
    buttonBg: "bg-blue-600/20 hover:bg-blue-600/40",
    buttonText: "text-blue-300 hover:text-blue-200",
    inputBg: "bg-[#141C27]",
  },
  hacker: {
    background: "bg-[#0F1A1F]",
    text: "text-green-400",
    accentText: "text-green-300",
    border: "border-green-600/50",
    separator: "border-green-600/50",
    panelBg: "bg-[#0F1A1F]",
    panelBorder: "border-green-600/20",
    statusBarBg: "bg-[#0A1215]",
    commandLineBg: "bg-[#0A1215]",
    buttonBg: "bg-green-600/20 hover:bg-green-600/40",
    buttonText: "text-green-400 hover:text-green-300",
    inputBg: "bg-[#0A1215]",
  },
};

export default function HomebaseTerminal() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string[]>([
    "Welcome to Homebase Terminal v1.0 - Type /menu for commands",
  ]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationCache, setNotificationCache] = useState<Notification[]>([]);
  const [pinnedNotifications, setPinnedNotifications] = useState<string[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<{
    type: string;
    excludeTypes: string[];
  }>({ type: "all", excludeTypes: [] });
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastCommand, setLastCommand] = useState("");
  const [isAlertSoundEnabled, setIsAlertSoundEnabled] = useState(true);
  const [showNotifications, setShowNotifications] = useState(true);
  const [sysUpdates, setSysUpdates] = useState<string[]>([]);
  const [bootSequenceComplete, setBootSequenceComplete] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notifications: {
      mover: true,
      loser: true,
      volume_spike: true,
      price_spike: true,
      news: true,
      ai_index: true,
      eth_stats: true,
      new_token: true,
    },
    favorites: [],
    terminalStyle: "classic",
    prioritizeNotifications: true,
  });
  const [snoozedTokens, setSnoozedTokens] = useState<SnoozedToken[]>([]);
  const [startTime] = useState(Date.now());
  const [uptime, setUptime] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [tokens, setTokens] = useState<DexToken[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const commands = [
    "/menu",
    "/clear",
    "/refresh-notifications",
    "/shortcuts",
    "/account",
    "/news",
    "/tournaments",
    "/whales",
    "/scan",
    "/screener",
    "/setdisplay",
    "/signup",
    "/login",
    "/logout",
    "/settings",
    "/snooze",
    "/status",
    "/history",
    "/notify-me",
    "/ca",
  ];

  const debouncedSetNotifications = useCallback(
    debounce((newNotifications: Notification[]) => {
      setNotifications(newNotifications);
    }, 500),
    []
  );

  // Memoize currentStyle to prevent unnecessary re-renders
  const currentStyle = useMemo(
    () =>
      terminalStyles[
        preferences.terminalStyle as keyof typeof terminalStyles
      ] || terminalStyles.classic,
    [preferences.terminalStyle]
  );

  // Boot-Up Sequence
  useEffect(() => {
    const bootSteps = [
      "[INIT] Booting Homebase Terminal...",
      "[SYS] Checking system integrity...",
      "[SEC] Fetching security patches...",
      "[DB] Optimizing database...",
      "[CHAIN] Syncing with blockchain...",
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
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
            }));
            if (userData.preferences?.notificationFilter) {
              setNotificationFilter(userData.preferences.notificationFilter);
            }
          }
        });

        const snoozeQuery = query(
          collection(db, `users/${currentUser.uid}/snoozed`),
          limit(50)
        );
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

        const favoritesQuery = query(
          collection(db, `users/${currentUser.uid}/favorites`),
          limit(50)
        );
        onSnapshot(favoritesQuery, (snapshot) => {
          const favoriteList = snapshot.docs.map(
            (doc) => doc.data().pairAddress as string
          );
          setPreferences((prev) => ({ ...prev, favorites: favoriteList }));
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
            ai_index: true,
            eth_stats: true,
            new_token: true,
          },
          favorites: [],
          terminalStyle: "classic",
          prioritizeNotifications: true,
        });
        setSnoozedTokens([]);
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
          },
        },
        { merge: true }
      );
    }
  }, [notificationFilter, user, preferences]);

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
      const finalNotifications = [...pinned, ...unpinned];

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

  // Fetch AI Index
  useEffect(() => {
    const fetchAIIndex = debounce(async () => {
      try {
        const res = await fetch("/api/ai-index");
        if (!res.ok) return;
        const data = await res.json();
        const notification = {
          type: "ai_index" as const,
          message: `Base AI Index: ${data.indexValue.toFixed(2)}`,
          timestamp: new Date().toISOString(),
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
        const res = await fetch("/api/eth-stats");
        if (!res.ok) return;
        const data = await res.json();
        const notification = {
          type: "eth_stats" as const,
          message: `ETH Stats: Price $${data.price.toFixed(2)}, 24h Change ${data.priceChange24h.toFixed(2)}%, Gas ${data.gasPrice} Gwei`,
          timestamp: new Date().toISOString(),
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

  const [customAlerts, setCustomAlerts] = useState<
    { symbol: string; threshold: number; direction: "above" | "below" }[]
  >([]);

  // Check custom alerts
  useEffect(() => {
    const checkCustomAlerts = () => {
      tokens.forEach((token) => {
        if (!token.baseToken || !token.baseToken.symbol) {
          console.warn("Invalid token data:", token);
          return;
        }
        const symbol = token.baseToken.symbol;
        const currentPrice = parseFloat(token.priceUsd || "0");
        customAlerts.forEach(async (alert) => {
          if (alert.symbol !== symbol) return;
          const threshold = alert.threshold;
          const shouldAlert =
            (alert.direction === "above" && currentPrice >= threshold) ||
            (alert.direction === "below" && currentPrice <= threshold);
          if (shouldAlert) {
            const notification = {
              type: "price_spike" as const,
              message: `${symbol} price ${alert.direction} ${threshold}: $${currentPrice.toFixed(
                5
              )}`,
              timestamp: new Date().toISOString(),
              pairAddress: token.pairAddress,
            };
            await addDoc(collection(db, "notifications"), {
              ...notification,
              createdAt: serverTimestamp(),
            });
            setCustomAlerts((prev) =>
              prev.filter((a) => a.symbol !== symbol)
            );
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
  const fetchTokenAddress = useCallback(async (tokenSymbol: string): Promise<string | null> => {
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
  }, []);

  const handleCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;
      setHistory((prev) => [...prev, command]);
      setHistoryIndex(-1);
      setLastCommand(command);

      const [cmd, ...args] = command.trim().split(" ");
      const lowerCmd = cmd.toLowerCase();

      if (lowerCmd.endsWith("-stats")) {
        const tokenName = lowerCmd.replace(/-stats$/, "").replace("/", "");
        if (tokenName) {
          setOutput([`Fetching stats for ${tokenName.toUpperCase()}...`]);
          try {
            const tokenAddress = await fetchTokenAddress(tokenName.toUpperCase());
            if (!tokenAddress) {
              setOutput([`Token ${tokenName.toUpperCase()} not found in tokens collection.`]);
              return;
            }

            const response = await fetch(
              `/api/tokens?chainId=base&tokenAddresses=${tokenAddress}`,
              { method: "GET" }
            );
            if (!response.ok) {
              const errorData = await response.json();
              setOutput([
                `Failed to fetch stats for ${tokenName.toUpperCase()}: ${errorData.error || "Network error"}`,
              ]);
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
            } else {
              setOutput([`Token ${tokenName.toUpperCase()} data not available.`]);
            }
          } catch (err) {
            console.error("Failed to fetch token stats:", err);
            setOutput([`Failed to fetch stats for ${tokenName.toUpperCase()}: An error occurred.`]);
          }
        }
        return;
      }

      switch (lowerCmd) {
        case "/menu":
          setOutput([
            "Welcome to Homebase Terminal v1.0 - Type /menu for commands",
            "",
            "/menu - Show this menu",
            "/clear - Clear the terminal",
            "/refresh-notifications - Refresh Notification Center",
            "/shortcuts - Show keyboard shortcuts",
            "/account - Manage your account",
            "/news - Navigate to Base Chain News",
            "/tournaments - Navigate to Trading Competitions",
            "/whales - Navigate to Whale Watchers page",
            "/scan <token-address> - Audits the smart contract",
            "/<tokenname>-stats - e.g. /HIGHER-stats to fetch stats",
            "/screener - Open Token Scanner",
            "/setdisplay <name> - Set your display name",
            "/signup <email> <password> - Create a new account",
            "/login <email> <password> - Login to your account",
            "/logout - Logout of your account",
            "/settings <option> <value> - e.g. /settings notifications mover off",
            "/snooze <symbol> <duration> - e.g. /snooze HIGHER 1h",
            "/status - Show system status",
            "/history - Show command history",
            "/notify-me <symbol> <threshold> <above|below> - Set custom price alert",
            "/ca <token-symbol> - Fetch contract address for a token (e.g., /ca HIGHER)",
            "",
            user ? `Available commands:` : `Please login to access all commands`,
          ]);
          break;

        case "/clear":
          setOutput(["Terminal cleared."]);
          break;

        case "/refresh-notifications":
          setOutput(["Refreshing notifications..."]);
          setNotifications([]);
          setNotificationCache([]);
          setPinnedNotifications([]);
          setOutput(["Notifications refreshed."]);
          break;

        case "/shortcuts":
          setOutput([
            "Keyboard Shortcuts:",
            "Ctrl + L: Clear terminal",
            "Tab: Autocomplete command",
            "Up Arrow: Previous command",
            "Down Arrow: Next command",
          ]);
          break;

        case "/account":
          router.push("/account");
          break;

        case "/news":
          router.push("/base-chain-news");
          break;

        case "/tournaments":
          router.push("/tradingcompetition");
          break;

        case "/whales":
          router.push("/whale-watchers");
          break;

        case "/scan":
          if (args[0]) {
            setOutput([`Scanning token: ${args[0]}...`]);
            try {
              const response = await fetch(`/api/honeypot/scan?address=${args[0]}`, {
                method: "GET",
              });
              if (!response.ok) {
                const errorData = await response.json();
                setOutput([`Failed to scan token ${args[0]}: ${errorData.error || "Network error"}`]);
                return;
              }
              const result = await response.json();
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
                outputLines.push(`Buy Tax: ${result.simulationResult.buyTax !== undefined ? `${result.simulationResult.buyTax}%` : "N/A"}`);
                outputLines.push(`Sell Tax: ${result.simulationResult.sellTax !== undefined ? `${result.simulationResult.sellTax}%` : "N/A"}`);
              }
              setOutput(outputLines);
            } catch (err) {
              console.error("Honeypot scan failed:", err);
              setOutput(["Failed to scan token: An error occurred."]);
            }
          } else {
            setOutput(["Please provide a token address: /scan <token-address>"]);
          }
          break;

        case "/screener":
          router.push("/token-scanner");
          break;

        case "/setdisplay":
          if (!user) {
            setOutput(["Please login to set display name."]);
            return;
          }
          if (args[0]) {
            const newDisplayName = args.join(" ");
            await setDoc(
              doc(db, `users/${user.uid}`),
              {
                displayName: newDisplayName,
                preferences: preferences,
              },
              { merge: true }
            );
            setOutput([`Display name set to: ${newDisplayName}`]);
          } else {
            setOutput(["Please provide a name: /setdisplay <name>"]);
          }
          break;

        case "/signup":
          if (args.length < 2) {
            setOutput(["Usage: /signup <email> <password>"]);
            return;
          }
          setOutput(["Signing up..."]);
          setOutput(["Signup successful! Please login."]);
          break;

        case "/login":
          if (args.length < 2) {
            setOutput(["Usage: /login <email> <password>"]);
            return;
          }
          setOutput(["Logging in..."]);
          setOutput(["Login successful!"]);
          break;

        case "/logout":
          setOutput(["Logging out..."]);
          await auth.signOut();
          setOutput(["Logged out successfully."]);
          break;

        case "/settings":
          if (!user) {
            setOutput(["Please login to manage settings."]);
            return;
          }
          if (args[0]?.toLowerCase() === "notifications" && args[1] && args[2]) {
            const type = args[1].toLowerCase();
            const value = args[2].toLowerCase() === "on";
            if (preferences.notifications.hasOwnProperty(type)) {
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
              setOutput([
                `Notification ${type} set to ${value ? "on" : "off"}.`,
              ]);
            } else {
              setOutput(["Invalid notification type."]);
            }
          } else if (args[0]?.toLowerCase() === "favorites" && args[1]) {
            if (args[1].toLowerCase() === "list") {
              setOutput(["Favorites:", ...preferences.favorites]);
            } else {
              const pairAddress = args[1];
              const isFavorited = preferences.favorites.includes(pairAddress);
              const favoriteDocRef = doc(
                db,
                `users/${user.uid}/favorites`,
                pairAddress
              );
              if (isFavorited) {
                await deleteDoc(favoriteDocRef);
                setOutput([`Removed ${pairAddress} from favorites.`]);
              } else {
                await setDoc(favoriteDocRef, {
                  pairAddress,
                  createdAt: serverTimestamp(),
                });
                setOutput([`Added ${pairAddress} to favorites.`]);
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
            setOutput([
              `Notification prioritization ${value ? "enabled" : "disabled"}.`,
            ]);
          } else {
            setOutput([
              "Usage: /settings <notifications|favorites|prioritize> <option> <value>",
            ]);
          }
          break;

        case "/snooze":
          if (!user) {
            setOutput(["Please login to snooze notifications."]);
            return;
          }
          if (args.length < 2) {
            setOutput([
              "Usage: /snooze <symbol> <duration> (e.g., /snooze HIGHER 1h)",
            ]);
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
          setOutput([
            `Notifications for ${symbol} snoozed until ${new Date(
              expiry
            ).toLocaleString()}.`,
          ]);
          break;

        case "/status":
          setOutput([
            "System Status:",
            `Uptime: ${uptime}`,
            `Last Command: ${lastCommand || "None"}`,
            `Online: ${isOnline ? "Yes" : "No"}`,
            `Notifications: ${notifications.length} active`,
          ]);
          break;

        case "/history":
          setOutput(["Command History:", ...history.slice(-10)]);
          break;

        case "/notify-me":
          if (args.length < 3) {
            setOutput([
              "Usage: /notify-me <symbol> <threshold> <above|below>",
            ]);
            return;
          }
          const alertSymbol = args[0].toUpperCase();
          const threshold = parseFloat(args[1]);
          const direction = args[2].toLowerCase() as "above" | "below";
          if (isNaN(threshold) || !["above", "below"].includes(direction)) {
            setOutput([
              "Invalid threshold or direction. Usage: /notify-me <symbol> <threshold> <above|below>",
            ]);
            return;
          }
          setCustomAlerts((prev) => [
            ...prev,
            { symbol: alertSymbol, threshold, direction },
          ]);
          setOutput([
            `Custom alert set: Notify when ${alertSymbol} goes ${direction} $${threshold}.`,
          ]);
          break;

        case "/ca":
          if (args.length < 1) {
            setOutput(["Usage: /ca <token-symbol> (e.g., /ca HIGHER)"]);
            return;
          }
          const tokenSymbol = args[0].toUpperCase();
          setOutput([`Fetching contract address for ${tokenSymbol}...`]);
          try {
            const contractAddress = await fetchTokenAddress(tokenSymbol);
            if (!contractAddress) {
              setOutput([`Token ${tokenSymbol} not found in tokens collection.`]);
              return;
            }
            setOutput([`Contract Address for ${tokenSymbol}: ${contractAddress}`]);
          } catch (err) {
            console.error("Failed to fetch contract address:", err);
            setOutput([`Failed to fetch contract address for ${tokenSymbol}: An error occurred.`]);
          }
          break;

        default:
          setOutput([
            `Command not found: ${command}`,
            "Type /menu for available commands.",
          ]);
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
      fetchTokenAddress,
    ]
  );

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    if (value.startsWith("/")) {
      const matchingCommands = commands.filter((cmd) =>
        cmd.toLowerCase().startsWith(value.toLowerCase())
      );
      setSuggestions(matchingCommands);
    } else {
      setSuggestions([]);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [handleCommand, input, suggestions, history, historyIndex]);

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

  const handleStyleChange = useCallback(async (style: string) => {
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
  }, [user, preferences]);

  const toggleExcludeType = useCallback((type: string) => {
    setNotificationFilter((prev) => ({
      ...prev,
      excludeTypes: prev.excludeTypes.includes(type)
        ? prev.excludeTypes.filter((t) => t !== type)
        : [...prev.excludeTypes, type],
    }));
  }, []);

  const handleClearAllNotifications = useCallback(() => {
    setNotifications([]);
    setNotificationCache([]);
    setPinnedNotifications([]);
  }, []);

  const togglePinNotification = useCallback((id: string) => {
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
        return [notification, ...others];
      }
    });
  }, [pinnedNotifications]);

  const handleSnoozeNotification = useCallback(async (symbol: string) => {
    if (!user) {
      setOutput(["Please login to snooze notifications."]);
      return;
    }
    const expiry = Date.now() + 60 * 60 * 1000;
    await setDoc(doc(db, `users/${user.uid}/snoozed/${symbol}`), {
      expiry,
    });
    setOutput([
      `Notifications for ${symbol} snoozed until ${new Date(
        expiry
      ).toLocaleString()}.`,
    ]);
  }, [user]);

  const handleDismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setPinnedNotifications((prev) => prev.filter((pid) => pid !== id));
  }, []);

  // Section Header Component
  interface SectionHeaderProps {
    title: string;
    showDots?: boolean;
    currentStyle: TerminalStyle;
  }

  const SectionHeader = ({ title, showDots = false, currentStyle }: SectionHeaderProps) => (
    <div className="mb-4 -mx-4 -mt-4">
      <div className={`w-full py-2 px-4 flex justify-between items-center border-b ${currentStyle.separator}`}>
        <h2 className={`text-lg font-bold ${currentStyle.accentText}`}>
          {title.replace("_", " ")}
        </h2>
        {showDots && (
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 bg-red-500 rounded-full opacity-80 hover:opacity-100 transition-opacity duration-200" />
            <div className="w-3 h-3 bg-yellow-500 rounded-full opacity-80 hover:opacity-100 transition-opacity duration-200" />
            <div className="w-3 h-3 bg-green-500 rounded-full opacity-80 hover:opacity-100 transition-opacity duration-200" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`w-screen h-screen ${currentStyle.background} ${currentStyle.text} font-mono m-0 p-0 overflow-hidden flex flex-col touch-none select-none`}
    >
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />

      {/* Desktop Layout: Three Columns */}
      <div className="hidden md:flex flex-1 w-full h-[calc(100vh-80px)]">
        {/* SYS_UPDATE Panel with Boot Sequence */}
        <div
          className={`w-[35%] h-full border-r ${currentStyle.panelBg} ${currentStyle.panelBorder} p-4 overflow-y-auto shadow-lg overscroll-contain`}
        >
          <SectionHeader title="SYS_UPDATE" showDots={true} currentStyle={currentStyle} />
          <div className="space-y-3">
            {sysUpdates.map((update, idx) => (
              <motion.p
                key={idx}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className={`text-sm ${
                  update && typeof update === "string" && update.includes("[READY]")
                    ? currentStyle.accentText
                    : "opacity-90"
                } hover:opacity-100 transition-opacity duration-200`}
              >
                {update}
              </motion.p>
            ))}
            {bootSequenceComplete && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="text-sm opacity-70"
              >
                Last update: 5 mins ago
              </motion.p>
            )}
          </div>
          {bootSequenceComplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="mt-4 space-y-3"
            >
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium">Terminal Style:</label>
                <select
                  value={preferences.terminalStyle}
                  onChange={(e) => handleStyleChange(e.target.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm border focus:outline-none transition-all duration-200 ${currentStyle.inputBg} ${currentStyle.text}`}
                >
                  <option value="classic">Classic</option>
                  <option value="hacker">Hacker</option>
                </select>
              </div>
            </motion.div>
          )}
        </div>

        {/* Separator */}
        <div className={`w-px h-full ${currentStyle.separator}`} />

        {/* TERMINAL_OUTPUT Panel */}
        <div
          className={`w-2/5 h-full border-r ${currentStyle.panelBg} p-4 flex flex-col shadow-lg overscroll-contain`} // Removed panelBorder
        >
          <SectionHeader title="TERMINAL_OUTPUT" currentStyle={currentStyle} />
          <div ref={outputRef} className="flex-1 overflow-y-auto space-y-2">
            <AnimatePresence>
              {output.map((line, idx) => (
                <motion.p
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.1 }}
                  className="text-sm opacity-90 hover:opacity-100 transition-opacity duration-200"
                >
                  {line}
                </motion.p>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* NOTIFICATION_CENTER Panel (Removed Separator) */}
        <div
          className={`w-1/4 h-full ${currentStyle.panelBg} ${currentStyle.panelBorder} p-4 overflow-y-auto shadow-lg overscroll-contain`}
          ref={notificationRef}
        >
          <SectionHeader title="NOTIFICATION_CENTER" currentStyle={currentStyle} />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="mb-4 space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium">Exclude Types:</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "mover",
                    "loser",
                    "volume_spike",
                    "price_spike",
                    "news",
                    "ai_index",
                    "eth_stats",
                    "new_token",
                  ].map((type, idx) => (
                    <motion.button
                      key={type}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: idx * 0.02, duration: 0.1 }}
                      onClick={() => toggleExcludeType(type)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all duration-200 flex items-center space-x-1.5 ${currentStyle.buttonBg} ${currentStyle.buttonText} ${
                        notificationFilter.excludeTypes.includes(type)
                          ? "bg-red-600/30 text-red-300 border-red-600/50"
                          : ""
                      }`}
                    >
                      <span>{type.replace("_", " ")}</span>
                      {notificationFilter.excludeTypes.includes(type) && (
                        <FaTimes className="w-3 h-3" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium">Show Only:</label>
                <select
                  value={notificationFilter.type}
                  onChange={(e) =>
                    setNotificationFilter((prev) => ({
                      ...prev,
                      type: e.target.value,
                    }))
                  }
                  className={`rounded-lg px-3 py-1.5 text-sm border focus:outline-none transition-all duration-200 ${currentStyle.inputBg} ${currentStyle.text}`}
                >
                  <option value="all">All</option>
                  <option value="mover">Movers</option>
                  <option value="loser">Losers</option>
                  <option value="volume_spike">Volume Spikes</option>
                  <option value="price_spike">Price Spikes</option>
                  <option value="news">News</option>
                  <option value="ai_index">AI Index</option>
                  <option value="eth_stats">ETH Stats</option>
                  <option value="new_token">New Tokens</option>
                </select>
              </div>
              <div className="flex items-center justify-between space-x-3">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Alert Sound:</label>
                  <input
                    type="checkbox"
                    checked={isAlertSoundEnabled}
                    onChange={(e) => setIsAlertSoundEnabled(e.target.checked)}
                    className={`w-4 h-4 rounded focus:outline-none transition-all duration-200 ${currentStyle.inputBg}`}
                  />
                </div>
                <button
                  onClick={handleClearAllNotifications}
                  className={`text-sm px-4 py-1.5 rounded-lg transition-all duration-200 ${currentStyle.buttonBg} ${currentStyle.buttonText}`}
                >
                  Clear All
                </button>
              </div>
            </div>
          </motion.div>
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="text-sm opacity-70"
              >
                No notifications.
              </motion.p>
            ) : (
              notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.1 }}
                  className={`text-xs ${getColorClass(
                    notification.type,
                    preferences.terminalStyle
                  )} flex p-2 rounded-lg border transition-all duration-200 hover:brightness-125 cursor-pointer relative shadow-sm min-h-[60px]`}
                >
                  <div className="flex items-start space-x-2 flex-1">
                    <FaBell className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-80" />
                    <div className="flex-1">
                      <p className="font-semibold leading-tight">
                        {notification.message}
                      </p>
                      <div className="mt-1">
                        <p className="text-xs opacity-80 leading-tight">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                        {notification.pairAddress && (
                          <button
                            onClick={() =>
                              router.push(
                                `/app/token-scanner/${notification.pairAddress}/chart/page.tsx`
                              )
                            }
                            className={`text-xs underline mt-1 transition-all duration-200 ${currentStyle.buttonText}`}
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
                      className={`p-1 rounded-full transition-all duration-200 ${
                        pinnedNotifications.includes(notification.id)
                          ? "text-yellow-400"
                          : "text-gray-400 hover:text-yellow-400"
                      }`}
                      title={pinnedNotifications.includes(notification.id) ? "Unpin" : "Pin"}
                    >
                      <FaThumbtack className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() =>
                        handleSnoozeNotification(notification.message.split(" ")[0])
                      }
                      className="p-1 rounded-full text-gray-400 hover:text-blue-400 transition-all duration-200"
                      title="Snooze for 1h"
                    >
                      <span className="text-xs">Snooze</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDismissNotification(notification.id)}
                      className="p-1 rounded-full text-gray-400 hover:text-red-400 transition-all duration-200"
                      title="Dismiss"
                    >
                      <span className="text-xs">Dismiss</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout: Stacked with Collapsible Notifications */}
      <div className="md:hidden flex-1 w-full h-screen flex flex-col relative">
        {/* TERMINAL_OUTPUT Panel */}
        <div className="flex-1 p-4 pb-[128px]">
          <SectionHeader title="TERMINAL_OUTPUT" currentStyle={currentStyle} />
          <div
            ref={outputRef}
            className="h-[calc(100vh-250px)] overflow-y-auto space-y-2 overscroll-contain"
          >
            <AnimatePresence>
              {output.map((line, idx) => (
                <motion.p
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.1 }}
                  className="text-sm opacity-90 hover:opacity-100 transition-opacity duration-200"
                >
                  {line}
                </motion.p>
              ))}
            </AnimatePresence>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="mt-4"
          >
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`flex items-center justify-center space-x-2 text-sm px-4 py-2 rounded-lg w-full transition-all duration-200 ${currentStyle.buttonBg} ${currentStyle.buttonText}`}
            >
              {showNotifications ? (
                <>
                  <FaEyeSlash className="w-4 h-4" />
                  <span>Hide Notifications</span>
                </>
              ) : (
                <>
                  <FaEye className="w-4 h-4" />
                  <span>Show Notifications</span>
                </>
              )}
              {showNotifications ? (
                <FaChevronUp className="w-4 h-4 ml-2" />
              ) : (
                <FaChevronDown className="w-4 h-4 ml-2" />
              )}
            </button>
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2 space-y-2 overflow-hidden max-h-[150px] overflow-y-auto overscroll-contain"
                >
                  {notifications.length === 0 ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm opacity-70"
                    >
                      No notifications.
                    </motion.p>
                  ) : (
                    notifications.slice(0, 10).map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.1 }}
                        className={`text-xs ${getColorClass(
                          notification.type,
                          preferences.terminalStyle
                        )} flex p-2 rounded-lg border transition-all duration-200 hover:brightness-125 cursor-pointer relative shadow-sm min-h-[60px]`}
                      >
                        <div className="flex items-start space-x-2 flex-1">
                          <FaBell className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-80" />
                          <div className="flex-1">
                            <p className="font-semibold leading-tight">
                              {notification.message}
                            </p>
                            <div className="mt-1">
                              <p className="text-xs opacity-80 leading-tight">
                                {new Date(notification.timestamp).toLocaleString()}
                              </p>
                              {notification.pairAddress && (
                                <button
                                  onClick={() =>
                                    router.push(
                                      `/app/token-scanner/${notification.pairAddress}/chart/page.tsx`
                                    )
                                  }
                                  className={`text-xs underline mt-1 transition-all duration-200 ${currentStyle.buttonText}`}
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
                            className={`p-1 rounded-full transition-all duration-200 ${
                              pinnedNotifications.includes(notification.id)
                                ? "text-yellow-400"
                                : "text-gray-400 hover:text-yellow-400"
                            }`}
                            title={pinnedNotifications.includes(notification.id) ? "Unpin" : "Pin"}
                          >
                            <FaThumbtack className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() =>
                              handleSnoozeNotification(notification.message.split(" ")[0])
                            }
                            className="p-1 rounded-full text-gray-400 hover:text-blue-400 transition-all duration-200"
                            title="Snooze for 1h"
                          >
                            <span className="text-xs">Snooze</span>
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDismissNotification(notification.id)}
                            className="p-1 rounded-full text-gray-400 hover:text-red-400 transition-all duration-200"
                            title="Dismiss"
                          >
                            <span className="text-xs">Dismiss</span>
                          </motion.button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Command Line - Fixed to Bottom on Mobile */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={`fixed bottom-12 left-0 right-0 h-12 flex items-center space-x-3 px-4 py-2 border-t border-b ${currentStyle.commandLineBg} ${currentStyle.separator} md:static md:bottom-auto md:border-b-0 z-10`}
        >
          <span className={`text-sm font-medium ${currentStyle.accentText}`}>
            user@homebase ~ v1 $
          </span>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`w-full rounded-lg px-3 py-1.5 ${currentStyle.inputBg} ${currentStyle.text} focus:outline-none transition-all duration-200 text-sm placeholder-opacity-50`}
              placeholder="Type command here..."
            />
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.1 }}
                className={`absolute bottom-full left-0 w-full rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto ${currentStyle.panelBg} ${currentStyle.text}`}
              >
                {suggestions.map((suggestion, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02, duration: 0.1 }}
                    className={`p-2 cursor-pointer text-sm ${currentStyle.buttonBg} ${currentStyle.buttonText} rounded-lg`}
                    onMouseDown={() => {
                      setInput(suggestion);
                      setSuggestions([]);
                    }}
                  >
                    {suggestion}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Status Bar - Fixed to Bottom on Mobile */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={`fixed bottom-0 left-0 right-0 ${currentStyle.statusBarBg} ${currentStyle.text} p-2 text-xs flex justify-between items-center ${currentStyle.separator} border-t md:static md:bottom-auto z-10`}
        >
          <span className="flex items-center space-x-2">
            <span className="text-red-400 cursor-pointer hover:text-red-300 transition-colors duration-200">
              O 1 ISSUE
            </span>
            <span className="text-green-400">X v1.0</span>
          </span>
          <span>OS: web</span>
          <span>Uptime: {uptime}</span>
          <span className="flex items-center space-x-1">
            <span>Network: 1.2Mbps</span>
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"} animate-pulse`}
            />
          </span>
        </motion.div>
      </div>

      {/* Command Line - Desktop Only */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={`hidden md:flex w-full h-12 items-center space-x-3 px-4 py-2 border-t border-b ${currentStyle.commandLineBg} ${currentStyle.separator}`}
      >
        <span className={`text-sm font-medium ${currentStyle.accentText}`}>
          user@homebase ~ v1 $
        </span>
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full rounded-lg px-3 py-1.5 ${currentStyle.inputBg} ${currentStyle.text} focus:outline-none transition-all duration-200 text-sm placeholder-opacity-50`}
            placeholder="Type command here..."
          />
          {suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.1 }}
              className={`absolute bottom-full left-0 w-full rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto ${currentStyle.panelBg} ${currentStyle.text}`}
            >
              {suggestions.map((suggestion, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02, duration: 0.1 }}
                  className={`p-2 cursor-pointer text-sm ${currentStyle.buttonBg} ${currentStyle.buttonText} rounded-lg`}
                  onMouseDown={() => {
                    setInput(suggestion);
                    setSuggestions([]);
                  }}
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
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={`hidden md:flex w-full ${currentStyle.statusBarBg} ${currentStyle.text} p-2 text-xs justify-between items-center ${currentStyle.separator} border-t`}
      >
        <span className="flex items-center space-x-2">
          <span className="text-red-400 cursor-pointer hover:text-red-300 transition-colors duration-200">
            O 1 ISSUE
          </span>
          <span className="text-green-400">X v1.0</span>
        </span>
        <span>OS: web</span>
        <span>Uptime: {uptime}</span>
        <span className="flex items-center space-x-1">
          <span>Network: 1.2Mbps</span>
          <span
            className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"} animate-pulse`}
          />
        </span>
      </motion.div>
    </div>
  );
}