"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaArrowUp, FaBell, FaTimes, FaEye, FaEyeSlash, FaThumbtack } from "react-icons/fa";
import { onAuthStateChanged } from "firebase/auth";
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

interface Plugin {
  name: string;
  description: string;
  command: string;
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

// Constants
const PRICE_CHECK_INTERVAL = 60_000; // 1 minute
const ETH_STATS_INTERVAL = 1_800_000; // 30 minutes
const AI_INDEX_INTERVAL = 14_400_000; // 4 hours

// Utility Functions
const getColorClass = (type: string, theme: string): string => {
  if (theme === "hacker") {
    return "text-green-500";
  } else if (theme === "vintage") {
    return "text-[#4A3728]";
  } else {
    switch (type) {
      case "mover":
        return "bg-green-800 text-blue-300";
      case "loser":
        return "bg-red-800 text-blue-300";
      case "volume_spike":
        return "bg-blue-800 text-blue-300";
      case "price_spike":
        return "bg-blue-800 text-blue-300";
      case "news":
        return "bg-teal-800 text-blue-300";
      case "ai_index":
        return "bg-blue-900 text-blue-300";
      case "eth_stats":
        return "bg-purple-800 text-blue-300";
      case "new_token":
        return "bg-orange-800 text-blue-300";
      default:
        return "bg-gray-800 text-blue-300";
    }
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
const terminalStyles = {
  classic: {
    background: "bg-gray-900",
    text: "text-blue-300",
    accentText: "text-blue-300",
    border: "border-blue-600 border-opacity-80",
    separator: "border-blue-600 border-opacity-80",
    panelBg: "bg-gray-900",
    statusBarBg: "bg-gray-800",
    commandLineBg: "bg-gray-800",
  },
  hacker: {
    background: "bg-black",
    text: "text-green-500",
    accentText: "text-green-500",
    border: "border-green-500 border-opacity-80",
    separator: "border-green-500 border-opacity-80",
    panelBg: "bg-black",
    statusBarBg: "bg-black",
    commandLineBg: "bg-black",
  },
  vintage: {
    background: "bg-[#D2B48C]",
    text: "text-[#4A3728]",
    accentText: "text-[#4A3728]",
    border: "border-[#F5F5DC] border-opacity-80",
    separator: "border-[#F5F5DC] border-opacity-80",
    panelBg: "bg-[#D2B48C]",
    statusBarBg: "bg-[#D2B48C]",
    commandLineBg: "bg-[#D2B48C]",
  },
};

export default function HomebaseTerminal() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string[]>([
    "Welcome to Homebase Terminal v1.0 - Type /menu for commands",
    "",
    "/menu - Show this menu",
    "/clear - Clear the terminal",
    "/refresh-notifications - Refresh Notification Center",
    "/shortcuts - Show keyboard shortcuts",
    "/account - Manage your account",
    "/news - Navigate to Base Chain News",
    "/dashboard - Navigate to Competitions Dashboard",
    "/tournaments - Navigate to Competitions",
    "/whales - Navigate to Whale Watcher page",
    "/scan <token-address> - Audits the smart contract",
    "/token-stats <symbol> - e.g. /token-stats CLANKER to fetch stats",
    "/screener - Open Token Screener",
    "/setdisplayname <name> - Set your display name",
    "/signup <email> <password> - Create a new account",
    "/login <email> <password> - Login to your account",
    "/logout - Logout of your account",
    "/settings <option> <value> - e.g. /settings notifications mover off",
    "/snooze <symbol> <duration> - e.g. /snooze CLANKER 1h",
    "/plugin - List user-contributed scripts",
    "/stats - Show market trends",
    "/sync-alerts - Fetch latest alerts instantly",
    "/status - Show system status",
    "/history - Show command history",
    "/notify-me <symbol> <threshold> <above|below> - Set custom price alert",
    "",
    "Available commands:",
  ]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationCache, setNotificationCache] = useState<Notification[]>([]);
  const [pinnedNotifications, setPinnedNotifications] = useState<string[]>([]); // For pinned notifications
  const [notificationFilter, setNotificationFilter] = useState<{
    type: string;
    excludeTypes: string[];
  }>({ type: "all", excludeTypes: [] });
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastCommand, setLastCommand] = useState("");
  const [isAlertSoundEnabled, setIsAlertSoundEnabled] = useState(true);
  const [showNotifications, setShowNotifications] = useState(true); // For mobile toggle
  const [sysUpdates] = useState<string[]>([
    "Checking system integrity...",
    "Fetching security patches...",
    "Optimizing database...",
    "Syncing with blockchain...",
    "Updating AI models...",
    "Refreshing token data...",
    "Clearing cache...",
    "Finalizing updates...",
  ]);
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

  // Commands
  const commands = [
    "/menu",
    "/clear",
    "/refresh-notifications",
    "/shortcuts",
    "/account",
    "/news",
    "/dashboard",
    "/tournaments",
    "/whales",
    "/scan",
    "/token-stats",
    "/screener",
    "/setdisplayname",
    "/signup",
    "/login",
    "/logout",
    "/settings",
    "/snooze",
    "/plugin",
    "/stats",
    "/sync-alerts",
    "/status",
    "/history",
    "/notify-me",
  ];

  // Debounced setNotifications to improve performance
  const debouncedSetNotifications = useCallback(
    debounce((newNotifications: Notification[]) => {
      setNotifications(newNotifications);
    }, 500),
    []
  );

  // Authentication, Preferences, and Persistent Filters
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const prefsQuery = query(
          collection(db, `users/${currentUser.uid}/preferences`)
        );
        onSnapshot(prefsQuery, (snapshot) => {
          const prefsData: any = {};
          snapshot.forEach((doc) => {
            prefsData[doc.id] = doc.data().value;
          });
          setPreferences((prev) => ({
            ...prev,
            notifications: prefsData.notifications || prev.notifications,
            favorites: prefsData.favorites || prev.favorites,
            terminalStyle: prefsData.terminalStyle || prev.terminalStyle,
            prioritizeNotifications:
              prefsData.prioritizeNotifications ??
              prev.prioritizeNotifications,
            notificationFilter: prefsData.notificationFilter || prev.notificationFilter,
          }));
          // Load persistent filters
          if (prefsData.notificationFilter) {
            setNotificationFilter(prefsData.notificationFilter);
          }
        });

        const snoozeQuery = query(
          collection(db, `users/${currentUser.uid}/snoozed`)
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
          collection(db, `users/${currentUser.uid}/favorites`)
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
        setNotificationFilter({ type: "all", excludeTypes: [] }); // Reset filters for non-logged-in users
      }
    });
    return () => unsubscribe();
  }, []);

  // Save notification filters to Firestore when they change
  useEffect(() => {
    if (user) {
      setDoc(
        doc(db, `users/${user.uid}/preferences/notificationFilter`),
        { value: notificationFilter }
      );
    }
  }, [notificationFilter, user]);

  // Fetch Tokens (Shared with Screener via Firestore)
  useEffect(() => {
    const tokenCacheQuery = query(collection(db, "tokenDataCache"));
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

  // Fetch Notifications from Firestore
  useEffect(() => {
    // Note: Add a TTL policy in Firestore to delete notifications older than 24 hours
    // e.g., using a Cloud Function or Firestore TTL feature
    const enabledTypes = Object.keys(preferences.notifications).filter(
      (type) => preferences.notifications[type]
    );
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("type", "in", enabledTypes.length > 0 ? enabledTypes : ["none"]), // Firestore requires non-empty array
      limit(50) // Performance: Limit to 50 most recent notifications
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

      // Apply filters
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

      // Sort by timestamp (newest first), no weights
      const sortedNotifications = filteredNotifications.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Separate pinned and unpinned notifications
      const pinned = sortedNotifications.filter((n) =>
        pinnedNotifications.includes(n.id)
      );
      const unpinned = sortedNotifications.filter(
        (n) => !pinnedNotifications.includes(n.id)
      );
      const finalNotifications = [...pinned, ...unpinned];

      // Debounced update for performance
      debouncedSetNotifications(finalNotifications);

      // Play alert sound for new notifications
      const newAlerts = finalNotifications.filter(
        (n) => !notificationCache.some((cached) => cached.id === n.id)
      );
      if (newAlerts.length > 0 && isAlertSoundEnabled && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }

      // Update cache (last 10 minutes)
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

  // Fetch News (Terminal-Specific)
  useEffect(() => {
    const fetchNews = debounce(async () => {
      try {
        const newsQuery = query(collection(db, "news"));
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
    const interval = setInterval(fetchNews, 3_600_000); // Every hour
    return () => clearInterval(interval);
  }, []);

  // Fetch Base AI Index (Terminal-Specific)
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
    const interval = setInterval(fetchAIIndex, AI_INDEX_INTERVAL); // Every 4 hours
    return () => clearInterval(interval);
  }, []);

  // Fetch Ethereum Stats (Terminal-Specific)
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
    const interval = setInterval(fetchEthStats, ETH_STATS_INTERVAL); // Every 30 minutes
    return () => clearInterval(interval);
  }, []);

  // Custom Price Alerts
  const [customAlerts, setCustomAlerts] = useState<
    { symbol: string; threshold: number; direction: "above" | "below" }[]
  >([]);

  useEffect(() => {
    const checkCustomAlerts = () => {
      tokens.forEach((token) => {
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

  // Uptime and Online Status
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

  // Command Handlers
  const handleCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;
      setHistory((prev) => [...prev, command]);
      setHistoryIndex(-1);
      setLastCommand(command);

      const [cmd, ...args] = command.trim().split(" ");
      const lowerCmd = cmd.toLowerCase();

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
            "/dashboard - Navigate to Competitions Dashboard",
            "/tournaments - Navigate to Competitions",
            "/whales - Navigate to Whale Watcher page",
            "/scan <token-address> - Audits the smart contract",
            "/token-stats <symbol> - e.g. /token-stats CLANKER to fetch stats",
            "/screener - Open Token Screener",
            "/setdisplayname <name> - Set your display name",
            "/signup <email> <password> - Create a new account",
            "/login <email> <password> - Login to your account",
            "/logout - Logout of your account",
            "/settings <option> <value> - e.g. /settings notifications mover off",
            "/snooze <symbol> <duration> - e.g. /snooze CLANKER 1h",
            "/plugin - List user-contributed scripts",
            "/stats - Show market trends",
            "/sync-alerts - Fetch latest alerts instantly",
            "/status - Show system status",
            "/history - Show command history",
            "/notify-me <symbol> <threshold> <above|below> - Set custom price alert",
            "",
            user ? `Available commands:` : `Please login to access all commands`,
          ]);
          break;

        case "/clear":
          setOutput(["Terminal cleared."]); // Only clear terminal output
          break;

        case "/refresh-notifications":
          setOutput(["Refreshing notifications..."]);
          setNotifications([]);
          setNotificationCache([]);
          setPinnedNotifications([]); // Clear pinned notifications as well
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
          router.push("/news");
          break;

        case "/dashboard":
          router.push("/dashboard");
          break;

        case "/tournaments":
          router.push("/tournaments");
          break;

        case "/whales":
          router.push("/whales");
          break;

        case "/scan":
          if (args[0]) {
            setOutput([
              `Scanning token: ${args[0]}...`,
              "Checking for vulnerabilities...",
              "Analyzing contract code...",
              "Scan complete. No vulnerabilities found.",
            ]);
          } else {
            setOutput(["Please provide a token address: /scan <token-address>"]);
          }
          break;

        case "/token-stats":
          if (args[0]) {
            const token = tokens.find(
              (t) =>
                t.baseToken.symbol.toLowerCase() === args[0].toLowerCase()
            );
            if (token) {
              setOutput([
                `Stats for ${token.baseToken.symbol}:`,
                `Price: $${Number(token.priceUsd).toFixed(5)}`,
                `24h Change: ${
                  token.priceChange?.h24?.toFixed(2) ?? "N/A"
                }%`,
                `Volume (24h): $${token.volume.h24.toLocaleString()}`,
                `Liquidity: $${token.liquidity.usd.toLocaleString()}`,
                `Market Cap: ${
                  token.marketCap
                    ? `$${token.marketCap.toLocaleString()}`
                    : "N/A"
                }`,
              ]);
            } else {
              setOutput([`Token ${args[0]} not found.`]);
            }
          } else {
            setOutput(["Please provide a token symbol: /token-stats <symbol>"]);
          }
          break;

        case "/screener":
          router.push("/screener");
          break;

        case "/setdisplayname":
          if (!user) {
            setOutput(["Please login to set display name."]);
            return;
          }
          if (args[0]) {
            await setDoc(
              doc(db, `users/${user.uid}/preferences/displayName`),
              { value: args.join(" ") }
            );
            setOutput([`Display name set to: ${args.join(" ")}`]);
          } else {
            setOutput(["Please provide a name: /setdisplayname <name>"]);
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
                doc(db, `users/${user.uid}/preferences/notifications`),
                { value: updatedPrefs }
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
              doc(db, `users/${user.uid}/preferences/prioritizeNotifications`),
              { value }
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
              "Usage: /snooze <symbol> <duration> (e.g., /snooze CLANKER 1h)",
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

        case "/plugin":
          try {
            const pluginsSnapshot = await getDocs(collection(db, "plugins"));
            const plugins = pluginsSnapshot.docs.map(
              (doc) => doc.data() as Plugin
            );
            if (plugins.length === 0) {
              setOutput(["No plugins available. Check back later!"]);
            } else {
              setOutput([
                "User-Contributed Plugins:",
                ...plugins.map(
                  (p) => `${p.name}: ${p.description} (Run: ${p.command})`
                ),
              ]);
            }
          } catch (err) {
            console.error("Failed to fetch plugins:", err);
            setOutput(["No plugins available at this time."]);
          }
          break;

        case "/stats":
          try {
            const movers = notifications
              .filter((n) => n.type === "mover")
              .slice(0, 1);
            const losers = notifications
              .filter((n) => n.type === "loser")
              .slice(0, 1);
            const volumes = notifications
              .filter((n) => n.type === "volume_spike")
              .slice(0, 1);
            setOutput([
              "Market Trends:",
              ...movers.map((n) => `Top Mover: ${n.message}`),
              ...losers.map((n) => `Top Loser: ${n.message}`),
              ...volumes.map((n) => `Most Active: ${n.message}`),
            ]);
          } catch (err) {
            console.error("Failed to fetch stats:", err);
            setOutput(["No market trends available."]);
          }
          break;

        case "/sync-alerts":
          setOutput(["Syncing alerts..."]);
          setNotifications([]);
          setNotificationCache([]);
          setPinnedNotifications([]); // Clear pinned notifications as well
          setOutput(["Notifications synced: Check Notification Center."]);
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

        default:
          const pluginMatch = commands.find((c) => c === command);
          if (pluginMatch) {
            setOutput([
              `Running plugin: ${command}`,
              "Result: Custom analysis complete.",
            ]);
          } else {
            setOutput([
              `Command not found: ${command}`,
              "Type /menu for available commands.",
            ]);
          }
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
    ]
  );

  // Autocomplete and Keyboard Shortcuts
  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.startsWith("/")) {
      const matchingCommands = commands.filter((cmd) =>
        cmd.toLowerCase().startsWith(value.toLowerCase())
      );
      setSuggestions(matchingCommands);
    } else {
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, notifications]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Terminal Style Handler
  const handleStyleChange = async (style: string) => {
    if (user) {
      await setDoc(doc(db, `users/${user.uid}/preferences/terminalStyle`), {
        value: style,
      });
    } else {
      setPreferences((prev) => ({ ...prev, terminalStyle: style }));
    }
  };

  const currentStyle =
    terminalStyles[
      preferences.terminalStyle as keyof typeof terminalStyles
    ] || terminalStyles.classic;

  // Notification Filter Handlers
  const toggleExcludeType = (type: string) => {
    setNotificationFilter((prev) => ({
      ...prev,
      excludeTypes: prev.excludeTypes.includes(type)
        ? prev.excludeTypes.filter((t) => t !== type)
        : [...prev.excludeTypes, type],
    }));
  };

  // Clear All Notifications
  const handleClearAllNotifications = () => {
    setNotifications([]);
    setNotificationCache([]);
    setPinnedNotifications([]);
  };

  // Pin/Unpin Notification
  const togglePinNotification = (id: string) => {
    setPinnedNotifications((prev) => {
      const isPinned = prev.includes(id);
      if (isPinned) {
        return prev.filter((pid) => pid !== id);
      } else {
        return [id, ...prev.filter((pid) => pid !== id)]; // Move to top
      }
    });

    // Reorder notifications to place pinned ones at the top
    setNotifications((prev) => {
      const notification = prev.find((n) => n.id === id);
      if (!notification) return prev;

      const isPinned = pinnedNotifications.includes(id);
      if (isPinned) {
        // If already pinned, unpin by removing from pinned list
        return prev;
      } else {
        // Pin by moving to the top
        const others = prev.filter((n) => n.id !== id);
        return [notification, ...others];
      }
    });
  };

  // Snooze Notification for 1 Hour
  const handleSnoozeNotification = async (symbol: string) => {
    if (!user) {
      setOutput(["Please login to snooze notifications."]);
      return;
    }
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour
    await setDoc(doc(db, `users/${user.uid}/snoozed/${symbol}`), {
      expiry,
    });
    setOutput([
      `Notifications for ${symbol} snoozed until ${new Date(
        expiry
      ).toLocaleString()}.`,
    ]);
  };

  // Dismiss Notification
  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setPinnedNotifications((prev) => prev.filter((pid) => pid !== id));
  };

  // Section Header Component
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="mb-4">
      <div className={`w-full h-0.5 bg-gray-600`} /> {/* Thicker, darker separator */}
      <div className={`relative py-2 px-4 bg-gray-700`}>
        <h2 className={`text-lg font-bold ${currentStyle.accentText} text-center`}>
          {title.replace("_", " ")}
        </h2>
        <div className="absolute top-1/2 right-4 transform -translate-y-1/2 flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
      </div>
      <div className={`w-full h-0.5 bg-gray-600`} /> {/* Thicker, darker separator */}
    </div>
  );

  return (
    <div
      className={`w-screen h-screen ${currentStyle.background} ${currentStyle.text} font-mono m-0 p-0 overflow-hidden flex flex-col`}
      style={{ textShadow: preferences.terminalStyle === "classic" ? "0 0 5px rgba(37,99,235,0.5)" : undefined }}
    >
      <audio ref={audioRef} src="/alert.mp3" preload="auto" />

      {/* Desktop Layout: Three Columns */}
      <div className="hidden md:flex flex-1 w-full h-[calc(100vh-80px)]">
        {/* SYS_UPDATE Panel */}
        <div
          className={`w-[35%] h-full ${currentStyle.border} border-r ${currentStyle.panelBg} p-4 overflow-y-auto`} // 35%
        >
          <SectionHeader title="SYS_UPDATE" />
          <div className={`w-full h-0.5 bg-gray-600 mb-4`} /> {/* Thicker separator */}
          <div className="space-y-2">
            {sysUpdates.map((update, idx) => (
              <p key={idx} className="text-sm">{update}</p>
            ))}
          </div>
          <p className="text-sm mt-4">Last update: 5 mins ago</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Terminal Style:</label>
              <select
                value={preferences.terminalStyle}
                onChange={(e) => handleStyleChange(e.target.value)}
                className={`rounded p-1 text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  preferences.terminalStyle === "classic"
                    ? "bg-gray-800 text-blue-300 border-gray-600"
                    : preferences.terminalStyle === "hacker"
                    ? "bg-black text-green-500 border-green-500"
                    : "bg-[#D2B48C] text-[#4A3728] border-[#F5F5DC]"
                }`}
              >
                <option value="classic">Classic</option>
                <option value="hacker">Hacker</option>
                <option value="vintage">Vintage</option>
              </select>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className={`w-px h-full ${currentStyle.separator}`} />

        {/* TERMINAL_OUTPUT Panel */}
        <div
          className={`w-2/5 h-full ${currentStyle.border} border-r ${currentStyle.panelBg} p-4 flex flex-col`} // 40%
        >
          <SectionHeader title="TERMINAL_OUTPUT" />
          <div className={`w-full h-0.5 bg-gray-600 mb-4`} /> {/* Thicker separator */}
          <div ref={outputRef} className="flex-1 overflow-y-auto">
            {output.map((line, idx) => (
              <p key={idx} className="text-sm">{line}</p>
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className={`w-px h-full ${currentStyle.separator}`} />

        {/* NOTIFICATION_CENTER Panel */}
        <div
          className={`w-1/4 h-full ${currentStyle.panelBg} p-4 overflow-y-auto`} // 25%
        >
          <SectionHeader title="NOTIFICATION_CENTER" />
          <div className={`w-full h-0.5 bg-gray-600 mb-4`} /> {/* Thicker separator */}
          <div className="mb-4 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Exclude Types:</label>
                <div className="flex flex-wrap gap-1">
                  {[
                    "mover",
                    "loser",
                    "volume_spike",
                    "price_spike",
                    "news",
                    "ai_index",
                    "eth_stats",
                    "new_token",
                  ].map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleExcludeType(type)}
                      className={`text-xs px-2 py-1 rounded-full transition-colors duration-200 flex items-center space-x-1 ${
                        notificationFilter.excludeTypes.includes(type)
                          ? preferences.terminalStyle === "classic"
                            ? "bg-red-600 text-white"
                            : preferences.terminalStyle === "hacker"
                            ? "bg-green-700 text-white"
                            : "bg-[#4A3728] text-[#D2B48C]"
                          : preferences.terminalStyle === "classic"
                          ? "bg-gray-700 text-blue-300 hover:bg-gray-600"
                          : preferences.terminalStyle === "hacker"
                          ? "bg-gray-800 text-green-500 hover:bg-gray-700"
                          : "bg-[#F5F5DC] text-[#4A3728] hover:bg-[#C2A47C]"
                      }`}
                    >
                      <span>{type.replace("_", " ")}</span>
                      {notificationFilter.excludeTypes.includes(type) && (
                        <FaTimes className="w-3 h-3" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Show Only:</label>
                <select
                  value={notificationFilter.type}
                  onChange={(e) =>
                    setNotificationFilter((prev) => ({
                      ...prev,
                      type: e.target.value,
                    }))
                  }
                  className={`rounded p-1 text-sm border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    preferences.terminalStyle === "classic"
                      ? "bg-gray-800 text-blue-300 border-gray-600"
                      : preferences.terminalStyle === "hacker"
                      ? "bg-black text-green-500 border-green-500"
                      : "bg-[#D2B48C] text-[#4A3728] border-[#F5F5DC]"
                  }`}
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
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Alert Sound:</label>
                  <input
                    type="checkbox"
                    checked={isAlertSoundEnabled}
                    onChange={(e) => setIsAlertSoundEnabled(e.target.checked)}
                    className={`w-4 h-4 rounded focus:ring-blue-500 ${
                      preferences.terminalStyle === "classic"
                        ? "text-blue-600 bg-gray-800 border-gray-600"
                        : preferences.terminalStyle === "hacker"
                        ? "text-green-500 bg-black border-green-500"
                        : "text-[#4A3728] bg-[#D2B48C] border-[#F5F5DC]"
                    }`}
                  />
                </div>
                <button
                  onClick={handleClearAllNotifications}
                  className={`text-sm px-3 py-1 rounded transition-colors duration-200 ${
                    preferences.terminalStyle === "classic"
                      ? "bg-gray-700 text-blue-300 hover:bg-gray-600"
                      : preferences.terminalStyle === "hacker"
                      ? "bg-gray-800 text-green-500 hover:bg-gray-700"
                      : "bg-[#F5F5DC] text-[#4A3728] hover:bg-[#C2A47C]"
                  }`}
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm">No notifications.</p>
            ) : (
              notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-sm ${
                    getColorClass(notification.type, preferences.terminalStyle) +
                    (notification.type === "price_spike" && preferences.terminalStyle === "classic"
                      ? notification.message.includes("up")
                        ? " bg-green-800"
                        : " bg-red-800"
                      : "")
                  } flex items-start justify-between space-x-3 p-2 rounded transition-colors duration-200 hover:brightness-110 cursor-pointer`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <FaBell className="w-5 h-5" />
                      <p className="font-medium">
                        {notification.type.toUpperCase().replace("_", " ")}: {notification.message}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-xs opacity-80">
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                      {notification.pairAddress && (
                        <button
                          onClick={() =>
                            router.push(`/app/token-scanner/${notification.pairAddress}/chart/page.tsx`)
                          }
                          className={`text-xs underline transition-colors duration-200 ${
                            preferences.terminalStyle === "classic"
                              ? "text-blue-300 hover:text-blue-400"
                              : preferences.terminalStyle === "hacker"
                              ? "text-green-500 hover:text-green-400"
                              : "text-[#4A3728] hover:text-[#C2A47C]"
                          }`}
                        >
                          View Chart
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => togglePinNotification(notification.id)}
                      className={`p-1 rounded-full transition-colors duration-200 ${
                        pinnedNotifications.includes(notification.id)
                          ? "text-yellow-400"
                          : "text-gray-400 hover:text-yellow-400"
                      }`}
                      title={pinnedNotifications.includes(notification.id) ? "Unpin" : "Pin"}
                    >
                      <FaThumbtack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        handleSnoozeNotification(notification.message.split(" ")[0])
                      }
                      className="p-1 rounded-full text-gray-400 hover:text-blue-400 transition-colors duration-200"
                      title="Snooze for 1h"
                    >
                      <span className="text-xs">Snooze</span>
                    </button>
                    <button
                      onClick={() => handleDismissNotification(notification.id)}
                      className="p-1 rounded-full text-gray-400 hover:text-red-400 transition-colors duration-200"
                      title="Dismiss"
                    >
                      <span className="text-xs">Dismiss</span>
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout: Stacked with Collapsible Notifications */}
      <div className="md:hidden flex-1 w-full h-[calc(100vh-80px)] p-4 flex flex-col">
        <SectionHeader title="TERMINAL OUTPUT" />
        <div className={`w-full h-0.5 bg-gray-600 mb-4`} /> {/* Thicker separator */}
        <div ref={outputRef} className="flex-1 overflow-y-auto">
          {output.map((line, idx) => (
            <p key={idx} className="text-sm">{line}</p>
          ))}
        </div>
        <div className="mt-4">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`flex items-center space-x-2 text-sm px-3 py-1 rounded transition-colors duration-200 ${
              preferences.terminalStyle === "classic"
                ? "bg-gray-700 text-blue-300 hover:bg-gray-600"
                : preferences.terminalStyle === "hacker"
                ? "bg-gray-800 text-green-500 hover:bg-gray-700"
                : "bg-[#F5F5DC] text-[#4A3728] hover:bg-[#C2A47C]"
            }`}
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
          </button>
          {showNotifications && (
            <div className="mt-2 space-y-3">
              {notifications.length === 0 ? (
                <p className="text-sm">No notifications.</p>
              ) : (
                notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-sm ${
                      getColorClass(notification.type, preferences.terminalStyle) +
                      (notification.type === "price_spike" && preferences.terminalStyle === "classic"
                        ? notification.message.includes("up")
                          ? " bg-green-800"
                          : " bg-red-800"
                        : "")
                    } flex items-start justify-between space-x-3 p-2 rounded transition-colors duration-200 hover:brightness-110 cursor-pointer`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <FaBell className="w-5 h-5" />
                        <p className="font-medium">
                          {notification.type.toUpperCase().replace("_", " ")}: {notification.message}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-xs opacity-80">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                        {notification.pairAddress && (
                          <button
                            onClick={() =>
                              router.push(`/app/token-scanner/${notification.pairAddress}/chart/page.tsx`)
                            }
                            className={`text-xs underline transition-colors duration-200 ${
                              preferences.terminalStyle === "classic"
                                ? "text-blue-300 hover:text-blue-400"
                                : preferences.terminalStyle === "hacker"
                                ? "text-green-500 hover:text-green-400"
                                : "text-[#4A3728] hover:text-[#C2A47C]"
                            }`}
                          >
                            View Chart
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => togglePinNotification(notification.id)}
                        className={`p-1 rounded-full transition-colors duration-200 ${
                          pinnedNotifications.includes(notification.id)
                            ? "text-yellow-400"
                            : "text-gray-400 hover:text-yellow-400"
                        }`}
                        title={pinnedNotifications.includes(notification.id) ? "Unpin" : "Pin"}
                      >
                        <FaThumbtack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleSnoozeNotification(notification.message.split(" ")[0])
                        }
                        className="p-1 rounded-full text-gray-400 hover:text-blue-400 transition-colors duration-200"
                        title="Snooze for 1h"
                      >
                        <span className="text-xs">Snooze</span>
                      </button>
                      <button
                        onClick={() => handleDismissNotification(notification.id)}
                        className="p-1 rounded-full text-gray-400 hover:text-red-400 transition-colors duration-200"
                        title="Dismiss"
                      >
                        <span className="text-xs">Dismiss</span>
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Command Line (Above Status Bar) */}
      <div
        className={`w-full h-10 flex items-center space-x-2 px-4 py-2 border-t border-b ${currentStyle.commandLineBg} ${currentStyle.separator}`}
      >
        <span className={`text-sm ${currentStyle.accentText}`}>
          user@homebase ~ v1 $
        </span>
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full bg-transparent ${currentStyle.text} focus:outline-none text-sm p-1`}
            placeholder="Type command here..."
          />
          {suggestions.length > 0 && (
            <div className={`absolute bottom-full left-0 w-full rounded shadow-lg z-50 max-h-40 overflow-y-auto ${
              preferences.terminalStyle === "classic"
                ? "bg-gray-700 text-blue-300"
                : preferences.terminalStyle === "hacker"
                ? "bg-gray-800 text-green-500"
                : "bg-[#F5F5DC] text-[#4A3728]"
            }`}>
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={`p-1 cursor-pointer text-sm ${
                    preferences.terminalStyle === "classic"
                      ? "hover:bg-gray-600"
                      : preferences.terminalStyle === "hacker"
                      ? "hover:bg-gray-700"
                      : "hover:bg-[#C2A47C]"
                  }`}
                  onMouseDown={() => {
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
      </div>

      {/* Status Bar */}
      <div
        className={`w-full ${currentStyle.statusBarBg} ${currentStyle.text} p-2 text-xs flex justify-between items-center border-t ${currentStyle.separator}`}
      >
        <span>
          <span className="text-red-500">O</span> 1 ISSUE{" "}
          <span className="text-green-500">X</span> v1.0
        </span>
        <span>OS: web</span>
        <span>Uptime: {uptime}</span>
        <span>Network: 1.2Mbps</span>
        <span>Last Command: {lastCommand || "None"}</span>
        <span className={isOnline ? "text-green-500" : "text-red-500"}>
          Status: {isOnline ? "ONLINE" : "OFFLINE"}
        </span>
      </div>
    </div>
  );
}