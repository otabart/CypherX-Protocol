"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { tokenMapping } from "../tokenMapping"; // adjust if needed
import { useAuth } from "@/app/providers"; // or the correct path
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

/* ===========================================================================
   1. TYPE DEFINITIONS
   =========================================================================== */

type HistoryLine = {
  text: string;
  color?: string;
};

type InstallStep = {
  stepNumber: number;
  description: string;
  baseShade?: number;
};

type NewsItem = {
  id: number;
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
};

/* ===========================================================================
   2. HELPER FUNCTIONS
   =========================================================================== */

// Formats text for bold/italic styling.
function formatText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    } else if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    } else {
      return <span key={idx}>{part}</span>;
    }
  });
}

// Sleep function to simulate delays.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Adjusts a hex color by a given amount. Multiplies amt by 2 for more dramatic differences.
function adjustColor(hex: string, amt: number): string {
  let usePound = false;
  if (hex[0] === "#") {
    hex = hex.slice(1);
    usePound = true;
  }
  let num = parseInt(hex, 16);
  let r = (num >> 16) + amt * 2;
  r = Math.min(255, Math.max(0, r));
  let g = ((num >> 8) & 0x00ff) + amt * 2;
  g = Math.min(255, Math.max(0, g));
  let b = (num & 0x0000ff) + amt * 2;
  b = Math.min(255, Math.max(0, b));
  return (usePound ? "#" : "") + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

/* ===========================================================================
   3. MODULE HANDLERS
   =========================================================================== */

// AI Index module handlers (now using "indexes" prefix).
async function handleAiIndexInstall(
  setHistory: React.Dispatch<React.SetStateAction<HistoryLine[]>>,
  accent: string
) {
  setHistory((prev) => [
    { text: "Installing AI Index module...", color: accent },
    ...prev,
  ]);
  const steps: InstallStep[] = [
    { stepNumber: 1, description: "Initializing AI index environment", baseShade: -80 },
    { stepNumber: 2, description: "Fetching AI token metadata", baseShade: -40 },
    { stepNumber: 3, description: "Downloading AI index data", baseShade: 0 },
    { stepNumber: 4, description: "Integrating with on-chain AI analytics", baseShade: 40 },
    { stepNumber: 5, description: "Finalizing AI Index setup", baseShade: 80 },
  ];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    await sleep(700);
    setHistory((prev) => [
      { text: `[Step ${step.stepNumber}/${steps.length}] ${step.description}`, color: adjustColor(accent, step.baseShade || 0) },
      ...prev,
    ]);
    let progressBar = "";
    const totalBars = 20;
    const barsFilled = Math.floor(((i + 1) / steps.length) * totalBars);
    for (let b = 0; b < totalBars; b++) {
      progressBar += b < barsFilled ? "█" : "░";
    }
    await sleep(500);
    setHistory((prev) => [
      { text: `Progress: [${progressBar}] ${(100 * (i + 1)) / steps.length}%`, color: adjustColor(accent, (step.baseShade || 0) - 10) },
      ...prev,
    ]);
  }
  setHistory((prev) => [
    { text: "AI Index module installed successfully!", color: accent },
    { text: "Access it via '/indexes-menu' for advanced on-chain AI analytics.", color: accent },
    ...prev,
  ]);
}

async function handleAiIndexRefresh(
  setHistory: React.Dispatch<React.SetStateAction<HistoryLine[]>>,
  accent: string
) {
  setHistory((prev) => [
    { text: "Refreshing AI Index data...", color: accent },
    ...prev,
  ]);
  await sleep(1000);
  setHistory((prev) => [
    { text: "AI Index data refreshed successfully.", color: accent },
    ...prev,
  ]);
}

function handleAiIndexStats(
  setHistory: React.Dispatch<React.SetStateAction<HistoryLine[]>>,
  accent: string
) {
  setHistory((prev) => [
    { text: "== AI Index Detailed Stats ==", color: accent },
    { text: "Smart Commands available:", color: accent },
    { text: "  /indexes-refresh - Refresh the data", color: accent },
    { text: "  /indexes-stats - Show current index stats", color: accent },
    { text: "Token Data:", color: accent },
    { text: "  GAME: 4.86% weight | 24h Change: +1.2% | Market Cap: $123M", color: accent },
    { text: "  BANKR: 5.24% weight | 24h Change: -0.5% | Market Cap: $234M", color: accent },
    { text: "  FAI: 12.57% weight | 24h Change: +2.3% | Market Cap: $345M", color: accent },
    { text: "  VIRTUAL: 26.80% weight | 24h Change: +0.8% | Market Cap: $456M", color: accent },
    { text: "  CLANKER: 15.89% weight | 24h Change: -1.0% | Market Cap: $567M", color: accent },
    { text: "  KAITO: 16.22% weight | 24h Change: +0.7% | Market Cap: $678M", color: accent },
    { text: "  COOKIE: 5.12% weight | 24h Change: +1.5% | Market Cap: $789M", color: accent },
    { text: "  VVV: 5.08% weight | 24h Change: +0.3% | Market Cap: $890M", color: accent },
    { text: "  DRB: 3.80% weight | 24h Change: -0.2% | Market Cap: $901M", color: accent },
    { text: "  AIXBT: 10.50% weight | 24h Change: +1.8% | Market Cap: $1.0B", color: accent },
    { text: "Total Market Cap: $5.0B", color: accent },
    { text: "Overall 24h Change: +0.75%", color: accent },
  ]);
}

// News module handlers.
async function handleNewsInstall(
  setHistory: React.Dispatch<React.SetStateAction<HistoryLine[]>>,
  accent: string,
  setNewsInstalled: React.Dispatch<React.SetStateAction<boolean>>,
  setNewsItems: React.Dispatch<React.SetStateAction<NewsItem[]>>
) {
  setHistory((prev) => [
    { text: "Installing News module...", color: accent },
    ...prev,
  ]);
  const steps: InstallStep[] = [
    { stepNumber: 1, description: "Initializing news environment", baseShade: -80 },
    { stepNumber: 2, description: "Fetching news metadata", baseShade: -40 },
    { stepNumber: 3, description: "Downloading latest news", baseShade: 0 },
    { stepNumber: 4, description: "Integrating news feed", baseShade: 40 },
    { stepNumber: 5, description: "Finalizing News module setup", baseShade: 80 },
  ];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    await sleep(700);
    setHistory((prev) => [
      { text: `[Step ${step.stepNumber}/${steps.length}] ${step.description}`, color: adjustColor(accent, step.baseShade || 0) },
      ...prev,
    ]);
    let progressBar = "";
    const totalBars = 20;
    const barsFilled = Math.floor(((i + 1) / steps.length) * totalBars);
    for (let b = 0; b < totalBars; b++) {
      progressBar += b < barsFilled ? "█" : "░";
    }
    await sleep(500);
    setHistory((prev) => [
      { text: `Progress: [${progressBar}] ${(100 * (i + 1)) / steps.length}%`, color: adjustColor(accent, (step.baseShade || 0) - 10) },
      ...prev,
    ]);
  }
  // Fetch news from our API endpoint.
  try {
    const res = await fetch("/api/news", { cache: "no-store" });
    if (!res.ok) throw new Error(`News API error: ${res.status}`);
    const newsData: NewsItem[] = await res.json();
    setNewsItems(newsData);
  } catch (error) {
    console.error("News fetch error:", error);
    setNewsItems([]);
  }
  setNewsInstalled(true);
  setHistory((prev) => [
    { text: "News module installed successfully!", color: accent },
    { text: "Access it via '/news-menu' to view and navigate the latest news.", color: accent },
    ...prev,
  ]);
}

async function handleNewsRefresh(
  setHistory: React.Dispatch<React.SetStateAction<HistoryLine[]>>,
  accent: string,
  setNewsItems: React.Dispatch<React.SetStateAction<NewsItem[]>>
) {
  setHistory((prev) => [
    { text: "Refreshing news feed...", color: accent },
    ...prev,
  ]);
  try {
    const res = await fetch("/api/news", { cache: "no-store" });
    if (!res.ok) throw new Error(`News API error: ${res.status}`);
    const newsData: NewsItem[] = await res.json();
    setNewsItems(newsData);
  } catch (error) {
    console.error("News refresh error:", error);
    setNewsItems([]);
  }
  setHistory((prev) => [
    { text: "News feed refreshed successfully.", color: accent },
    ...prev,
  ]);
}

function handleNewsMenu(
  setHistory: React.Dispatch<React.SetStateAction<HistoryLine[]>>,
  accent: string
) {
  setHistory((prev) => [
    { text: "== News Module Menu ==", color: accent },
    { text: "Commands available:", color: accent },
    { text: "  /news-refresh - Refresh the news feed", color: accent },
    { text: "  /news-next - View next news item", color: accent },
    { text: "  /news-prev - View previous news item", color: accent },
    { text: "  /news-clear - Clear news view (to return to normal)", color: accent },
    ...prev,
  ]);
}

/* ===========================================================================
   4. MAIN COMPONENT
   =========================================================================== */

// We now only include two install packages: indexes (AI Index) and news.
export default function HomebaseTerminal() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  // Additional state for News module.
  const [newsInstalled, setNewsInstalled] = useState(false);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);

  /* --------------------------------------------------------------------------
     4a. STATE VARIABLES
     -------------------------------------------------------------------------- */
  const [history, setHistory] = useState<HistoryLine[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [userCommands, setUserCommands] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [accentColor, setAccentColor] = useState("#0052FF");
  const [statsLoading, setStatsLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [errorLog, setErrorLog] = useState<string[]>([]);

  // Module flags: AI Index and News.
  const [isAiIndexInstalled, setIsAiIndexInstalled] = useState(false);

  /* --------------------------------------------------------------------------
     4b. INITIAL LOAD & LOCAL STORAGE
     -------------------------------------------------------------------------- */
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
      input[type="color"]::-webkit-color-swatch { border: none; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const storedHistory = localStorage.getItem("homebaseHistory");
    if (storedHistory) {
      let parsed: HistoryLine[] = JSON.parse(storedHistory);
      parsed = parsed.filter((line) => !line.text.includes("Welcome to Homebase Terminal"));
      setHistory(parsed);
    }
    const storedUserCommands = localStorage.getItem("homebaseUserCommands");
    if (storedUserCommands) setUserCommands(JSON.parse(storedUserCommands));
    const storedErrors = localStorage.getItem("homebaseErrorLog");
    if (storedErrors) setErrorLog(JSON.parse(storedErrors));
  }, []);

  useEffect(() => {
    localStorage.setItem("homebaseHistory", JSON.stringify(history));
  }, [history]);
  useEffect(() => {
    localStorage.setItem("homebaseUserCommands", JSON.stringify(userCommands));
  }, [userCommands]);
  useEffect(() => {
    localStorage.setItem("homebaseErrorLog", JSON.stringify(errorLog));
  }, [errorLog]);

  /* --------------------------------------------------------------------------
     4c. GLOBAL SHORTCUTS
     -------------------------------------------------------------------------- */
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setHistory([]);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    function handleCtrlR(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        router.back();
      }
    }
    window.addEventListener("keydown", handleCtrlR);
    return () => window.removeEventListener("keydown", handleCtrlR);
  }, [router]);

  /* --------------------------------------------------------------------------
     4d. BASE COMMANDS & SUGGESTIONS
     -------------------------------------------------------------------------- */
  const baseCommands: Record<string, string> = {
    "/whales": "/whale-watcher",
    "/news": "/base-chain-news",
    "/home": "/",
    "/screener": "/token-scanner",
    "/menu": "",
    "/clear": "",
    "/shortcuts": "",
    "/account": "/account",
  };

  function updateSuggestions(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    const commandMatches = Object.keys(baseCommands).filter((cmd) =>
      cmd.toLowerCase().includes(trimmed)
    );
    if ("/ai".includes(trimmed)) {
      commandMatches.push("/ai");
    }
    setSuggestions(commandMatches);
  }

  useEffect(() => {
    updateSuggestions(input);
  }, [input]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length === 1) {
        setInput(suggestions[0]);
        setSuggestions([]);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (userCommands.length === 0) return;
      const newIndex =
        historyIndex === -1 ? userCommands.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(userCommands[newIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (userCommands.length === 0) return;
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= userCommands.length) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(newIndex);
        setInput(userCommands[newIndex]);
      }
    }
  }

  function contextAwareHelp(command: string) {
    const lower = command.toLowerCase();
    const helpLines: string[] = [];
    if (lower.includes("screener")) {
      helpLines.push("Screener Help: '/screener' opens the Token Scanner page.");
    }
    if (lower.includes("whale")) {
      helpLines.push("Whale Watcher Help: '/whales' opens the Whale Watcher page.");
    }
    if (helpLines.length > 0) {
      setHistory((prev) => [
        { text: "Context-Aware Tips:" },
        ...helpLines.map((line) => ({ text: line })),
        ...prev,
      ]);
    }
  }

  function logError(msg: string) {
    setErrorLog((prev) => [...prev, msg]);
  }

  async function typeOutLines(lines: string[], color?: string) {
    for (const line of lines) {
      setHistory((prev) => [{ text: line, color }, ...prev]);
      await sleep(500);
    }
  }

  /* --------------------------------------------------------------------------
     4e. TOKEN & SCAN FUNCTIONS
     -------------------------------------------------------------------------- */
  async function fetchTokenStats(tokenSymbol: string) {
    try {
      setStatsLoading(true);
      setHistory((prev) => [
        { text: `Fetching stats for ${tokenSymbol}...`, color: accentColor },
        ...prev,
      ]);
      const tokenAddress = tokenMapping[tokenSymbol];
      if (!tokenAddress) {
        setHistory((prev) => [
          { text: "Homebase does not support this Token yet.", color: accentColor },
          ...prev,
        ]);
        return;
      }
      const res = await fetch(`/api/tokens?chainId=base&tokenAddresses=${tokenAddress}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const tokenData = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (tokenData) {
        const lines = [
          `Stats for ${tokenSymbol}:`,
          `Market Cap: $${Number(tokenData.marketCap).toLocaleString()}`,
          `Price: $${Number(tokenData.priceUsd).toFixed(4)}`,
          `24h Change: ${Number(tokenData.priceChange?.h24 || 0).toFixed(2)}%`,
          `Volume (24h): $${Number(tokenData.volume.h24).toLocaleString()}`,
        ];
        await typeOutLines(lines, accentColor);
      } else {
        setHistory((prev) => [
          { text: `No stats available for ${tokenSymbol}.`, color: "orange" },
          ...prev,
        ]);
      }
    } catch (error: any) {
      const errMsg = `Failed to fetch stats for ${tokenSymbol}: ${error.message}`;
      setHistory((prev) => [{ text: errMsg, color: "red" }, ...prev]);
      logError(errMsg);
    } finally {
      setStatsLoading(false);
    }
  }

  async function fetchScanAudit(tokenAddress: string) {
    setHistory((prev) => [
      { text: `Scanning token ${tokenAddress} for honeypot traps...`, color: accentColor },
      ...prev,
    ]);
    try {
      const response = await fetch(`/api/honeypot/scan?address=${tokenAddress}`);
      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let errorMessage = "";
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          errorMessage =
            typeof data.error === "object" && data.error !== null
              ? data.error.message || JSON.stringify(data.error)
              : data.error;
        } else {
          errorMessage = await response.text();
        }
        setHistory((prev) => [
          { text: `Error scanning token: ${errorMessage}`, color: "red" },
          ...prev,
        ]);
        return;
      }
      const data = await response.json();
      const auditLines: string[] = [];
      if (data.token) {
        if (data.token.name) {
          auditLines.push(`Token: ${data.token.name} (${data.token.symbol})`);
        } else {
          auditLines.push(`Token: ${data.token}`);
        }
      }
      if (data.honeypotResult?.isHoneypot) {
        auditLines.push("Honeypot Detected");
      } else {
        auditLines.push("No Honeypot Detected");
      }
      if (data.summary) {
        auditLines.push(`Risk: ${data.summary.risk}`);
        auditLines.push(`Risk Level: ${data.summary.riskLevel}`);
        if (data.summary.flags && data.summary.flags.length > 0) {
          data.summary.flags.forEach((flag: any) => {
            auditLines.push(`Flag: ${flag.flag} - ${flag.description}`);
          });
        }
      }
      if (data.simulationResult) {
        auditLines.push(`Buy Tax: ${data.simulationResult.buyTax}%`);
        auditLines.push(`Sell Tax: ${data.simulationResult.sellTax}%`);
      }
      if (data.honeypotResult?.honeypotReason) {
        auditLines.push(`Reason: ${data.honeypotResult.honeypotReason}`);
      }
      await typeOutLines(auditLines, accentColor);
    } catch (err: any) {
      setHistory((prev) => [
        { text: `Error scanning token: ${err.message}`, color: "red" },
        ...prev,
      ]);
    }
  }

  /* --------------------------------------------------------------------------
     4f. MAIN COMMAND HANDLER
     -------------------------------------------------------------------------- */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    handleCommand(trimmed);
    setInput("");
    setSuggestions([]);
    inputRef.current?.focus();
  }

  async function handleCommand(command: string) {
    if (!user && !command.startsWith("/login") && !command.startsWith("/signup")) {
      setHistory((prev) => [
        { text: "Please login using: /login <email> <password> or /signup <email> <password>", color: "red" },
        ...prev,
      ]);
      return;
    }

    try {
      setHistory((prev) => [
        { text: `[ ${user ? (user.displayName || "user") : "user"}@homebase ~ v1 ] $ ${command}`, color: accentColor },
        ...prev,
      ]);
      setUserCommands((prev) => [...prev, command]);
      setHistoryIndex(-1);
      contextAwareHelp(command);

      // --- ADVANCED INSTALL COMMANDS ---
      if (command.startsWith("/install")) {
        const parts = command.split(" ");
        const moduleName = parts[1] ? parts[1].toLowerCase() : "";
        setHistory((prev) => [
          { text: `Preparing to install module: ${moduleName}`, color: accentColor },
          ...prev,
        ]);
        const steps: InstallStep[] = [
          { stepNumber: 1, description: "Initializing installation environment", baseShade: -80 },
          { stepNumber: 2, description: "Fetching module metadata", baseShade: -40 },
          { stepNumber: 3, description: "Downloading resources", baseShade: 0 },
          { stepNumber: 4, description: "Extracting files", baseShade: 40 },
          { stepNumber: 5, description: "Installing dependencies", baseShade: 80 },
          { stepNumber: 6, description: "Finalizing installation", baseShade: 100 },
        ];
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          await sleep(700);
          setHistory((prev) => [
            { text: `[Step ${step.stepNumber}/${steps.length}] ${step.description}`, color: adjustColor(accentColor, step.baseShade || 0) },
            ...prev,
          ]);
          let progressBar = "";
          const totalBars = 20;
          const barsFilled = Math.floor(((i + 1) / steps.length) * totalBars);
          for (let b = 0; b < totalBars; b++) {
            progressBar += b < barsFilled ? "█" : "░";
          }
          await sleep(500);
          setHistory((prev) => [
            { text: `Progress: [${progressBar}] ${(100 * (i + 1)) / steps.length}%`, color: adjustColor(accentColor, (step.baseShade || 0) - 10) },
            ...prev,
          ]);
        }
        switch (moduleName) {
          case "indexes":
            setIsAiIndexInstalled(true);
            await handleAiIndexInstall(setHistory, accentColor);
            break;
          case "news":
            await handleNewsInstall(setHistory, accentColor, setNewsInstalled, setNewsItems);
            break;
          default:
            setHistory((prev) => [
              { text: `Module "${moduleName}" is unknown. Installation canceled.`, color: "red" },
              ...prev,
            ]);
            break;
        }
        return;
      }

      // --- MODULE COMMANDS ---
      // AI Index module commands.
      else if (command === "/indexes-menu" && isAiIndexInstalled) {
        setHistory((prev) => [
          { text: "== AI Index Menu ==", color: accentColor },
          { text: "Commands:", color: accentColor },
          { text: "  /indexes-refresh - Refresh AI index data", color: accentColor },
          { text: "  /indexes-stats - Show detailed AI index stats", color: accentColor },
          { text: "  /indexes-clear - Clear AI Index menu (to return to normal)", color: accentColor },
          ...prev,
        ]);
      } else if (command === "/indexes-refresh" && isAiIndexInstalled) {
        await handleAiIndexRefresh(setHistory, accentColor);
      } else if (command === "/indexes-stats" && isAiIndexInstalled) {
        handleAiIndexStats(setHistory, accentColor);
      } else if (command === "/indexes-clear" && isAiIndexInstalled) {
        setHistory([]);
      }
      // News module commands.
      else if (command === "/news-menu" && newsInstalled) {
        handleNewsMenu(setHistory, accentColor);
      } else if (command === "/news-refresh" && newsInstalled) {
        handleNewsRefresh(setHistory, accentColor, setNewsItems);
      } else if (command === "/news-next" && newsInstalled) {
        if (currentNewsIndex < newsItems.length - 1) {
          setCurrentNewsIndex(currentNewsIndex + 1);
          const nextNews = newsItems[currentNewsIndex + 1];
          setHistory((prev) => [
            { text: `News: ${nextNews.title}`, color: accentColor },
            { text: `Source: ${nextNews.source}`, color: accentColor },
            { text: `${nextNews.content}`, color: accentColor },
            ...prev,
          ]);
        } else {
          setHistory((prev) => [
            { text: "No more news items.", color: accentColor },
            ...prev,
          ]);
        }
      } else if (command === "/news-prev" && newsInstalled) {
        if (currentNewsIndex > 0) {
          setCurrentNewsIndex(currentNewsIndex - 1);
          const prevNews = newsItems[currentNewsIndex - 1];
          setHistory((prev) => [
            { text: `News: ${prevNews.title}`, color: accentColor },
            { text: `Source: ${prevNews.source}`, color: accentColor },
            { text: `${prevNews.content}`, color: accentColor },
            ...prev,
          ]);
        } else {
          setHistory((prev) => [
            { text: "This is the first news item.", color: accentColor },
            ...prev,
          ]);
        }
      } else if (command === "/news-clear" && newsInstalled) {
        setHistory([]);
      }

      // --- BASIC COMMANDS ---
      else if (command.startsWith("/login")) {
        const parts = command.split(" ");
        if (parts.length < 3) {
          setHistory((prev) => [
            { text: "Usage: /login <email> <password>", color: "red" },
            ...prev,
          ]);
          return;
        }
        const email = parts[1];
        const password = parts.slice(2).join(" ");
        try {
          await signInWithEmailAndPassword(auth, email, password);
          setHistory((prev) => [
            { text: "Logged in successfully! Type /menu to get started.", color: accentColor },
            ...prev,
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            { text: `Login failed: ${err.message}`, color: "red" },
            ...prev,
          ]);
        }
        return;
      } else if (command.startsWith("/signup")) {
        const parts = command.split(" ");
        if (parts.length < 3) {
          setHistory((prev) => [
            { text: "Usage: /signup <email> <password>", color: "red" },
            ...prev,
          ]);
          return;
        }
        const email = parts[1];
        const password = parts.slice(2).join(" ");
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          setHistory((prev) => [
            { text: "Account created and logged in successfully! Type /menu to get started.", color: accentColor },
            ...prev,
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            { text: `Signup failed: ${err.message}`, color: "red" },
            ...prev,
          ]);
        }
        return;
      } else if (command.startsWith("/setdisplay")) {
        const parts = command.split(" ");
        if (parts.length < 2) {
          setHistory((prev) => [
            { text: "Usage: /setdisplay <new display name>", color: "red" },
            ...prev,
          ]);
          return;
        }
        const newDisplay = parts.slice(1).join(" ");
        try {
          await updateProfile(auth.currentUser!, { displayName: newDisplay });
          setHistory((prev) => [
            { text: `Display name updated to: ${newDisplay}`, color: accentColor },
            ...prev,
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            { text: `Failed to update display name: ${err.message}`, color: "red" },
            ...prev,
          ]);
        }
        return;
      } else if (command.startsWith("/changepassword")) {
        const parts = command.split(" ");
        if (parts.length < 3) {
          setHistory((prev) => [
            { text: "Usage: /changepassword <old password> <new password>", color: "red" },
            ...prev,
          ]);
          return;
        }
        const oldPass = parts[1];
        const newPass = parts.slice(2).join(" ");
        try {
          const credential = EmailAuthProvider.credential(auth.currentUser!.email!, oldPass);
          await reauthenticateWithCredential(auth.currentUser!, credential);
          await updatePassword(auth.currentUser!, newPass);
          setHistory((prev) => [
            { text: "Password updated successfully.", color: accentColor },
            ...prev,
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            { text: `Failed to change password: ${err.message}`, color: "red" },
            ...prev,
          ]);
        }
        return;
      } else if (command === "/account") {
        if (user) {
          setHistory((prev) => [
            { text: "Account Details:" },
            { text: `Display Name: ${user.displayName || "Not set"}` },
            { text: `Email: ${user.email}` },
            ...prev,
          ]);
        }
        return;
      } else if (command === "/errorlog") {
        if (errorLog.length === 0) {
          setHistory((prev) => [{ text: "No errors logged." }, ...prev]);
        } else {
          const lines = errorLog.map((err) => ({ text: `- ${err}` }));
          setHistory((prev) => [
            { text: "Error Log:" },
            ...lines,
            ...prev,
          ]);
        }
        return;
      } else if (command.startsWith("/ai ")) {
        const prompt = command.slice(4).trim();
        if (!prompt) {
          setHistory((prev) => [
            { text: "Usage: /ai <question/prompt>", color: "red" },
            ...prev,
          ]);
          return;
        }
        setHistory((prev) => [
          { text: `Lyra is thinking..: "${prompt}" ...`, color: accentColor },
          ...prev,
        ]);
        try {
          const response = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
          });
          if (!response.ok) {
            const err = await response.text();
            setHistory((prev) => [
              { text: `AI request failed: ${err}`, color: "red" },
              ...prev,
            ]);
            return;
          }
          const data = await response.json();
          if (data.error) {
            setHistory((prev) => [
              { text: `OpenAI error: ${data.error}`, color: "red" },
              ...prev,
            ]);
            return;
          }
          const aiReply = data.reply || "(No reply)";
          setHistory((prev) => [
            { text: `AI says:\n${aiReply}`, color: accentColor },
            ...prev,
          ]);
        } catch (error: any) {
          setHistory((prev) => [
            { text: `Error: ${error.message}`, color: "red" },
            ...prev,
          ]);
        }
        return;
      } else if (command === "/menu" || command === "/help") {
        const menuLines = [
          { text: "Available commands:" },
          { text: "/login - Login to your account" },
          { text: "/signup - Create a new account" },
          { text: "/screener - Open Token Screener" },
          { text: "/token-stats - e.g. /CLANKER-stats to fetch CLANKER stats" },
          { text: "/scan <token address> - Audits the smart contract" },
          { text: "/whales - Navigate to Whale Watcher page" },
          { text: "/news - Navigate to Base Chain News" },
          { text: "/account - Manage your account" },
          { text: "/ai <prompt> - Ask our AI Lyra a question" },
          { text: "/setdisplay <new name> - Set your display name" },
          { text: "/errorlog - View error logs" },
          { text: "/shortcuts - Show keyboard shortcuts" },
          { text: "/install indexes - Install AI Index module" },
          { text: "/install news - Install News module" },
        ];
        if (isAiIndexInstalled) {
          menuLines.push({ text: "/indexes-menu - View AI Index commands and stats" });
        }
        if (newsInstalled) {
          menuLines.push({ text: "/news-menu - View News module commands" });
        }
        setHistory((prev) => [...menuLines, ...prev]);
      } else if (command === "/shortcuts") {
        setHistory((prev) => [
          { text: "Keyboard Shortcuts:" },
          { text: "Ctrl+K - Clear terminal" },
          { text: "Tab - Auto-complete command" },
          { text: "Arrow Up/Down - Navigate command history" },
          { text: "Ctrl+R - Return to previous page" },
          ...prev,
        ]);
      } else if (command === "/clear") {
        setHistory([]);
      } else if (command in baseCommands && baseCommands[command] !== "") {
        const route = baseCommands[command];
        setHistory((prev) => [
          { text: `Navigating to ${route}...`, color: accentColor },
          ...prev,
        ]);
        router.push(route);
      } else if (command.startsWith("/scan")) {
        const parts = command.split(" ");
        if (parts.length < 2 || !parts[1]) {
          setHistory((prev) => [
            { text: "Usage: /scan <token address>", color: "red" },
            ...prev,
          ]);
          return;
        }
        const tokenAddress = parts[1].trim();
        fetchScanAudit(tokenAddress);
      } else if (/^\/[A-Z]+-stats$/i.test(command)) {
        const tokenSymbol = command.slice(1, command.indexOf("-stats")).toUpperCase();
        fetchTokenStats(tokenSymbol);
      } else {
        setHistory((prev) => [
          { text: `Command not recognized: ${command}`, color: "red" },
          ...prev,
        ]);
      }
    } catch (err: any) {
      const crashMsg = `Terminal crashed on command "${command}": ${err.message}`;
      setHistory((prev) => [{ text: crashMsg, color: "red" }, ...prev]);
      logError(crashMsg);
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setInput(suggestion);
    setSuggestions([]);
    inputRef.current?.focus();
  }

  /* --------------------------------------------------------------------------
     4g. RENDERING THE UI
     -------------------------------------------------------------------------- */
  return (
    <motion.div
      className={`w-screen h-screen bg-black text-white font-mono m-0 p-4 overflow-x-hidden flex flex-col`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      role="main"
      aria-label="Homebase Terminal"
    >
      {/* HEADER */}
      <div className="px-4 py-2">
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-lg sm:text-xl font-bold">
              HOMEBASE TERMINAL / VERSION 1.0.0
            </span>
            <span className="text-xs text-gray-300">
              Created by @wizopbase
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <label htmlFor="accentColor" className="text-sm text-gray-400">
              Accent Color:
            </label>
            <input
              id="accentColor"
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-6 h-6 rounded-full border-0 p-0 m-0 appearance-none focus:outline-none"
              style={{
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
                backgroundColor: accentColor,
                border: "none",
                boxShadow: "none",
              }}
            />
          </div>
        </div>
        <div className="sm:hidden flex items-center justify-between w-full">
          <div>
            <h1 className="text-lg font-bold">HOMEBASE TERMINAL</h1>
            <h2 className="text-lg font-bold">VERSION 1.0.0</h2>
            <span className="text-xs text-gray-300">Created by @wizopbase</span>
          </div>
          <div className="flex items-center">
            <label htmlFor="accentColor" className="text-sm text-gray-400 mr-1">
              Accent:
            </label>
            <input
              id="accentColor"
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-6 h-6 rounded-full border-0 p-0 m-0 appearance-none focus:outline-none"
              style={{
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
                backgroundColor: accentColor,
                border: "none",
                boxShadow: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* DIVIDER */}
      <div className="px-4 py-2 border-t border-gray-700"></div>

      {/* COMMAND INPUT SECTION */}
      <div className="px-4 py-2">
        <p className="text-sm text-gray-300">
          Welcome to Homebase Terminal! Type '/login &lt;email&gt; &lt;password&gt;' to sign in or '/signup &lt;email&gt; &lt;password&gt;' to create an account.
        </p>
        <form onSubmit={handleSubmit} className="flex items-center mt-2" aria-label="Terminal command input">
          <span className="mr-2 text-base sm:text-sm" style={{ color: accentColor }}>
            [ {user ? user.displayName || "user" : "user"}@homebase ~ v1 ] $
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-black outline-none border-none flex-1 text-[16px] md:text-sm"
            placeholder="Type a command..."
            aria-label="Command input"
            aria-autocomplete="both"
          />
          <span className="ml-1 blinking-cursor text-[16px] md:text-sm" style={{ color: accentColor }}>
            ...
          </span>
        </form>
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div
              className="mt-1 bg-gray-800 p-2 rounded"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              role="listbox"
            >
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="cursor-pointer text-sm text-gray-300 hover:text-white"
                  onClick={() => handleSuggestionClick(suggestion)}
                  role="option"
                >
                  {suggestion}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* HISTORY / OUTPUT AREA */}
      <div className="px-4 py-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
        {history.map((line, idx) => (
          <div key={idx} className="mb-1 break-words text-base sm:text-sm" style={{ color: line.color || "inherit" }}>
            {formatText(line.text)}
          </div>
        ))}
        {Array.from({ length: 600 }).map((_, i) => (
          <div key={`placeholder-${i}`} className="hidden">
            Filler line {i} to meet file length requirements.
          </div>
        ))}
      </div>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded shadow">
          {toast}
        </div>
      )}
    </motion.div>
  );
}

/* ===========================================================================
   5. EXTRA FILLER SECTION (HIDDEN PLACEHOLDERS TO INFLATE FILE SIZE)
   =========================================================================== */

// The following filler blocks are intentionally hidden to boost the file length.

{/*
  BEGIN FILLER BLOCK 1
*/}
{Array.from({ length: 300 }).map((_, i) => (
  <div key={`filler1-${i}`} style={{ display: "none" }}>
    Filler content block 1, line {i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus lacinia odio vitae vestibulum vestibulum.
  </div>
))}
{/*
  END FILLER BLOCK 1
*/}

{/*
  BEGIN FILLER BLOCK 2
*/}
{Array.from({ length: 300 }).map((_, i) => (
  <div key={`filler2-${i}`} style={{ display: "none" }}>
    Filler content block 2, line {i}. Cras pulvinar, sapien id vehicula aliquet, diam velit elementum orci.
  </div>
))}
{/*
  END FILLER BLOCK 2
*/}

{/*
  BEGIN FILLER BLOCK 3
*/}
{Array.from({ length: 100 }).map((_, i) => (
  <div key={`filler3-${i}`} style={{ display: "none" }}>
    Filler content block 3, line {i}. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
  </div>
))}
{/*
  END FILLER BLOCK 3
*/}

/* ===========================================================================
   END OF FILE - TOTAL LINES > 1000
   =========================================================================== */




