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

type HistoryLine = {
  text: string;
  color?: string;
};

function formatText(text: string): React.ReactNode {
  // Splits text into bold/italic parts
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function HomebaseTerminal() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  // Terminal state variables – always call hooks
  const [history, setHistory] = useState<HistoryLine[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [userCommands, setUserCommands] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [accentColor, setAccentColor] = useState("#0052FF");
  const [statsLoading, setStatsLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [errorLog, setErrorLog] = useState<string[]>([]);

  // Global style override to remove white outline from color input swatch
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      input[type="color"]::-webkit-color-swatch-wrapper {
        padding: 0;
      }
      input[type="color"]::-webkit-color-swatch {
        border: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Load from local storage on mount
  useEffect(() => {
    const storedHistory = localStorage.getItem("homebaseHistory");
    if (storedHistory) setHistory(JSON.parse(storedHistory));
    const storedUserCommands = localStorage.getItem("homebaseUserCommands");
    if (storedUserCommands) setUserCommands(JSON.parse(storedUserCommands));
    const storedErrors = localStorage.getItem("homebaseErrorLog");
    if (storedErrors) setErrorLog(JSON.parse(storedErrors));
  }, []);

  // Save changes to local storage
  useEffect(() => {
    localStorage.setItem("homebaseHistory", JSON.stringify(history));
  }, [history]);
  useEffect(() => {
    localStorage.setItem("homebaseUserCommands", JSON.stringify(userCommands));
  }, [userCommands]);
  useEffect(() => {
    localStorage.setItem("homebaseErrorLog", JSON.stringify(errorLog));
  }, [errorLog]);

  // Global shortcut: Ctrl+K clears terminal and resets the welcome message.
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setHistory([
          {
            text:
              "Welcome to Homebase Terminal! Type '/login <email> <password>' to sign in or '/signup <email> <password>' to create an account.",
            color: "gray",
          },
        ]);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Global shortcut: Ctrl+R returns to previous page.
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

  // Base commands (excluding /login and /signup)
  const baseCommands: Record<string, string> = {
    "/whalewatchers": "/whale-watcher",
    "/news": "/base-chain-news",
    "/home": "/",
    "/screener": "/token-scanner",
    "/menu": "",
    "/clear": "",
    "/about": "",
    "/shortcuts": "",
    "/trading": "/TradingCompetition",
    "/dashboard": "/TradingCompetition/dashboard",
    "/errorlog": "",
    "/account": "", // Handled specially below
  };

  const tokenSymbols = Object.keys(tokenMapping).map((sym) => sym.toUpperCase());

  function updateSuggestions(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    const commandMatches = Object.keys(baseCommands).filter((cmd) =>
      cmd.toLowerCase().includes(trimmed)
    );
    let tokenMatches: string[] = [];
    if (trimmed.startsWith("/")) {
      const partialSymbol = trimmed.slice(1).toUpperCase();
      tokenMatches = tokenSymbols
        .filter((ts) => ts.includes(partialSymbol))
        .map((ts) => `/${ts}-stats`);
    }
    setSuggestions([...commandMatches, ...tokenMatches]);
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

  async function typeOutLines(lines: string[], color?: string) {
    for (const line of lines) {
      setHistory((prev) => [...prev, { text: line, color }]);
      await sleep(500);
    }
  }

  function contextAwareHelp(command: string) {
    const lower = command.toLowerCase();
    const helpLines: string[] = [];
    if (lower.includes("screener")) {
      helpLines.push("Screener Help: '/screener' opens the Token Scanner page.");
    }
    if (lower.includes("whale")) {
      helpLines.push("Whale Watcher Help: '/whalewatchers' opens the Whale Watcher page.");
    }
    if (helpLines.length > 0) {
      setHistory((prev) => [
        ...prev,
        { text: "Context-Aware Tips:" },
        ...helpLines.map((line) => ({ text: line })),
      ]);
    }
  }

  function logError(msg: string) {
    setErrorLog((prev) => [...prev, msg]);
  }

  async function fetchTokenStats(tokenSymbol: string) {
    try {
      const tokenAddress = tokenMapping[tokenSymbol];
      if (!tokenAddress) {
        setHistory((prev) => [
          ...prev,
          { text: "Homebase does not support this Token yet.", color: accentColor },
        ]);
        return;
      }
      setStatsLoading(true);
      setHistory((prev) => [...prev, { text: `Fetching stats for ${tokenSymbol}...` }]);
      const res = await fetch(`/api/tokens?chainId=base&tokenAddresses=${tokenAddress}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const tokenData = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (tokenData) {
        const lines = [
          `Stats for ${tokenSymbol}:`,
          `Market Cap: $${Number(tokenData.marketCap).toLocaleString()}`,
          `Price: $${Number(tokenData.priceUsd).toFixed(4)}`,
          `24hr Change: ${Number(tokenData.priceChange?.h24 || 0).toFixed(2)}%`,
          `Volume (24hr): $${Number(tokenData.volume.h24).toLocaleString()}`,
        ];
        await typeOutLines(lines, accentColor);
      } else {
        setHistory((prev) => [...prev, { text: `No stats available for ${tokenSymbol}.` }]);
      }
    } catch (error: any) {
      const errMsg = `Failed to fetch stats for ${tokenSymbol}: ${error.message}`;
      setHistory((prev) => [...prev, { text: errMsg }]);
      logError(errMsg);
    } finally {
      setStatsLoading(false);
    }
  }

  async function fetchScanAudit(tokenAddress: string) {
    setHistory((prev) => [
      ...prev,
      { text: `Scanning token ${tokenAddress} for honeypot traps...` },
    ]);
    try {
      const response = await fetch(`/api/honeypot/scan?address=${tokenAddress}`);
      const contentType = response.headers.get("content-type");
      if (!response.ok) {
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
          ...prev,
          { text: `Error scanning token: ${errorMessage}`, color: "red" },
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
        ...prev,
        { text: `Error scanning token: ${err.message}`, color: "red" },
      ]);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    handleCommand(trimmed);
    setInput("");
    setSuggestions([]);
    inputRef.current?.focus();
  }

  // Modified handleCommand: if not logged in, only allow "/login" or "/signup" commands.
  async function handleCommand(command: string) {
    if (!user && !command.startsWith("/login") && !command.startsWith("/signup")) {
      setHistory((prev) => [
        ...prev,
        {
          text:
            "Please login using: /login <email> <password> or sign up using: /signup <email> <password>",
          color: "red",
        },
      ]);
      return;
    }
    try {
      setHistory((prev) => [
        ...prev,
        {
          text: `[ ${user ? user.displayName || "user" : "user"}@homebase ~ v1 ] $ ${command}`,
        },
      ]);
      setUserCommands((prev) => [...prev, command]);
      setHistoryIndex(-1);
      contextAwareHelp(command);

      if (command.startsWith("/login")) {
        const parts = command.split(" ");
        if (parts.length < 3) {
          setHistory((prev) => [
            ...prev,
            { text: "Usage: /login <email> <password>", color: "red" },
          ]);
          return;
        }
        const email = parts[1];
        const password = parts.slice(2).join(" ");
        try {
          await signInWithEmailAndPassword(auth, email, password);
          setHistory((prev) => [
            ...prev,
            { text: "Logged in successfully! Type /menu to get started.", color: "green" },
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            ...prev,
            { text: `Login failed: ${err.message}`, color: "red" },
          ]);
        }
        return;
      }

      if (command.startsWith("/signup")) {
        const parts = command.split(" ");
        if (parts.length < 3) {
          setHistory((prev) => [
            ...prev,
            { text: "Usage: /signup <email> <password>", color: "red" },
          ]);
          return;
        }
        const email = parts[1];
        const password = parts.slice(2).join(" ");
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          setHistory((prev) => [
            ...prev,
            { text: "Account created and logged in successfully! Type /menu to get started.", color: "green" },
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            ...prev,
            { text: `Signup failed: ${err.message}`, color: "red" },
          ]);
        }
        return;
      }

      if (command.startsWith("/setdisplay")) {
        const parts = command.split(" ");
        if (parts.length < 2) {
          setHistory((prev) => [
            ...prev,
            { text: "Usage: /setdisplay <new display name>", color: "red" },
          ]);
          return;
        }
        const newDisplay = parts.slice(1).join(" ");
        try {
          await updateProfile(auth.currentUser!, { displayName: newDisplay });
          setHistory((prev) => [
            ...prev,
            { text: `Display name updated to: ${newDisplay}`, color: "green" },
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            ...prev,
            { text: `Failed to update display name: ${err.message}`, color: "red" },
          ]);
        }
        return;
      }

      if (command.startsWith("/changepassword")) {
        const parts = command.split(" ");
        if (parts.length < 3) {
          setHistory((prev) => [
            ...prev,
            { text: "Usage: /changepassword <old password> <new password>", color: "red" },
          ]);
          return;
        }
        const oldPass = parts[1];
        const newPass = parts.slice(2).join(" ");
        try {
          const credential = EmailAuthProvider.credential(user.email, oldPass);
          await reauthenticateWithCredential(auth.currentUser!, credential);
          await updatePassword(auth.currentUser!, newPass);
          setHistory((prev) => [
            ...prev,
            { text: "Password updated successfully.", color: "green" },
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            ...prev,
            { text: `Failed to change password: ${err.message}`, color: "red" },
          ]);
        }
        return;
      }

      if (command === "/account") {
        if (user) {
          setHistory((prev) => [
            ...prev,
            { text: "Account Details:" },
            { text: `Display Name: ${user.displayName || "Not set"}` },
            { text: `Email: ${user.email}` },
          ]);
        }
        return;
      }

      if (command === "/errorlog") {
        if (errorLog.length === 0) {
          setHistory((prev) => [...prev, { text: "No errors logged." }]);
        } else {
          setHistory((prev) => [
            ...prev,
            { text: "Error Log:" },
            ...errorLog.map((err) => ({ text: `- ${err}` })),
          ]);
        }
        return;
      }
      if (command === "/menu" || command === "/help") {
        setHistory((prev) => [
          ...prev,
          { text: "Available commands:" },
          { text: "/whalewatchers - Navigate to Whale Watcher page" },
          { text: "/news - Navigate to Base Chain News" },
          { text: "/home - Return to Home page" },
          { text: "/screener - Open Token Screener" },
          { text: "/trading - View Trading Competitions" },
          { text: "/dashboard - View Trading Competition Dashboard" },
          { text: "/account - Manage your account" },
          { text: "/setdisplay <new name> - Set your display name" },
          { text: "/changepassword <old> <new> - Change your password" },
          { text: "/<TOKEN>-stats - e.g., /SKITTEN-stats" },
          { text: "/scan <token address> - Perform a honeypot scan" },
          { text: "/errorlog - View error logs" },
          { text: "/about - About Homebase Terminal" },
          { text: "/shortcuts - Show keyboard shortcuts" },
          { text: "/login - Login to your account" },
          { text: "/signup - Create a new account" },
        ]);
      } else if (command === "/shortcuts") {
        setHistory((prev) => [
          ...prev,
          { text: "Keyboard Shortcuts:" },
          { text: "Ctrl+K - Clear terminal" },
          { text: "Tab - Auto-complete command" },
          { text: "Arrow Up/Down - Navigate command history" },
          { text: "Ctrl+R - Return to previous page" },
        ]);
      } else if (command === "/clear") {
        setHistory([
          {
            text: "Welcome to Homebase Terminal! Type '/login <email> <password>' to sign in or '/signup <email> <password>' to create an account.",
            color: "gray",
          },
        ]);
      } else if (command === "/about") {
        setHistory((prev) => [
          ...prev,
          { text: "Homebase Terminal v1.0. Created by Wizop." },
        ]);
      } else if (command in baseCommands && baseCommands[command] !== "") {
        const route = baseCommands[command];
        setHistory((prev) => [...prev, { text: `Navigating to ${route}...` }]);
        router.push(route);
      } else if (command.startsWith("/scan")) {
        const parts = command.split(" ");
        if (parts.length < 2 || !parts[1]) {
          setHistory((prev) => [
            ...prev,
            { text: "Usage: /scan <token address>", color: "red" },
          ]);
          return;
        }
        const tokenAddress = parts[1].trim();
        fetchScanAudit(tokenAddress);
      } else {
        const statsRegex = /^\/([A-Z]+)-stats$/i;
        const match = command.match(statsRegex);
        if (match) {
          const tokenSymbol = match[1].toUpperCase();
          fetchTokenStats(tokenSymbol);
        } else {
          setHistory((prev) => [...prev, { text: `Command not recognized: ${command}` }]);
        }
      }
    } catch (err: any) {
      const crashMsg = `Terminal crashed on command "${command}": ${err.message}`;
      setHistory((prev) => [...prev, { text: crashMsg, color: "red" }]);
      logError(crashMsg);
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setInput(suggestion);
    setSuggestions([]);
    inputRef.current?.focus();
  }

  return (
    <motion.div
      className="w-screen h-screen bg-black text-gray-300 font-mono m-0 p-4 overflow-x-hidden flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      role="main"
      aria-label="Homebase Terminal"
    >
      {/* HEADER */}
      <div className="px-4 py-2 bg-black">
        {/* Desktop view: one-line header */}
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg sm:text-xl font-bold text-white">
              HOMEBASE TERMINAL / VERSION 1.0.0
            </span>
            <span className="text-xs text-white" style={{ color: accentColor }}>
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
        {/* Mobile view: header with color selector aligned to top right */}
        <div className="sm:hidden flex items-center justify-between w-full">
          <div>
            <h1 className="text-lg font-bold text-white">HOMEBASE TERMINAL</h1>
            <h2 className="text-lg font-bold text-white">VERSION 1.0.0</h2>
            <span className="text-xs text-white" style={{ color: accentColor }}>
              Created by @wizopbase
            </span>
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

      {/* Divider */}
      <div className="px-4 py-2 border-t border-gray-700"></div>

      {/* COMMAND SECTION: Constant welcome message above command prompt */}
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
            |
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
                  className="cursor-pointer text-sm text-gray-300 hover:text-gray-400"
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

      {/* HISTORY (reversed) */}
      <div className="px-4 py-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
        {history.slice().reverse().map((line, idx) => (
          <div key={idx} className="mb-1 break-words text-base sm:text-sm" style={{ color: line.color || "inherit" }}>
            {formatText(line.text)}
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-gray-300 py-2 px-4 rounded shadow">
          {toast}
        </div>
      )}
    </motion.div>
  );

  async function handleCommand(command: string) {
    if (!user && !command.startsWith("/login") && !command.startsWith("/signup")) {
      setHistory((prev) => [
        ...prev,
        {
          text:
            "Please login using: /login <email> <password> or sign up using: /signup <email> <password>",
          color: "red",
        },
      ]);
      return;
    }
    try {
      setHistory((prev) => [
        ...prev,
        {
          text: `[ ${user ? user.displayName || "user" : "user"}@homebase ~ v1 ] $ ${command}`,
        },
      ]);
      setUserCommands((prev) => [...prev, command]);
      setHistoryIndex(-1);
      contextAwareHelp(command);

      if (command.startsWith("/login")) {
        const parts = command.split(" ");
        if (parts.length < 3) {
          setHistory((prev) => [
            ...prev,
            { text: "Usage: /login <email> <password>", color: "red" },
          ]);
          return;
        }
        const email = parts[1];
        const password = parts.slice(2).join(" ");
        try {
          await signInWithEmailAndPassword(auth, email, password);
          setHistory((prev) => [
            ...prev,
            { text: "Logged in successfully! Type /menu to get started.", color: "green" },
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            ...prev,
            { text: `Login failed: ${err.message}`, color: "red" },
          ]);
        }
        return;
      }

      if (command.startsWith("/signup")) {
        const parts = command.split(" ");
        if (parts.length < 3) {
          setHistory((prev) => [
            ...prev,
            { text: "Usage: /signup <email> <password>", color: "red" },
          ]);
          return;
        }
        const email = parts[1];
        const password = parts.slice(2).join(" ");
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          setHistory((prev) => [
            ...prev,
            { text: "Account created and logged in successfully! Type /menu to get started.", color: "green" },
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            ...prev,
            { text: `Signup failed: ${err.message}`, color: "red" },
          ]);
        }
        return;
      }

      if (command.startsWith("/setdisplay")) {
        const parts = command.split(" ");
        if (parts.length < 2) {
          setHistory((prev) => [
            ...prev,
            { text: "Usage: /setdisplay <new display name>", color: "red" },
          ]);
          return;
        }
        const newDisplay = parts.slice(1).join(" ");
        try {
          await updateProfile(auth.currentUser!, { displayName: newDisplay });
          setHistory((prev) => [
            ...prev,
            { text: `Display name updated to: ${newDisplay}`, color: "green" },
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            ...prev,
            { text: `Failed to update display name: ${err.message}`, color: "red" },
          ]);
        }
        return;
      }

      if (command.startsWith("/changepassword")) {
        const parts = command.split(" ");
        if (parts.length < 3) {
          setHistory((prev) => [
            ...prev,
            { text: "Usage: /changepassword <old password> <new password>", color: "red" },
          ]);
          return;
        }
        const oldPass = parts[1];
        const newPass = parts.slice(2).join(" ");
        try {
          const credential = EmailAuthProvider.credential(user.email, oldPass);
          await reauthenticateWithCredential(auth.currentUser!, credential);
          await updatePassword(auth.currentUser!, newPass);
          setHistory((prev) => [
            ...prev,
            { text: "Password updated successfully.", color: "green" },
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            ...prev,
            { text: `Failed to change password: ${err.message}`, color: "red" },
          ]);
        }
        return;
      }

      if (command === "/account") {
        if (user) {
          setHistory((prev) => [
            ...prev,
            { text: "Account Details:" },
            { text: `Display Name: ${user.displayName || "Not set"}` },
            { text: `Email: ${user.email}` },
          ]);
        }
        return;
      }

      if (command === "/errorlog") {
        if (errorLog.length === 0) {
          setHistory((prev) => [...prev, { text: "No errors logged." }]);
        } else {
          setHistory((prev) => [
            ...prev,
            { text: "Error Log:" },
            ...errorLog.map((err) => ({ text: `- ${err}` })),
          ]);
        }
        return;
      }
      if (command === "/menu" || command === "/help") {
        setHistory((prev) => [
          ...prev,
          { text: "Available commands:" },
          { text: "/whalewatchers - Navigate to Whale Watcher page" },
          { text: "/news - Navigate to Base Chain News" },
          { text: "/home - Return to Home page" },
          { text: "/screener - Open Token Screener" },
          { text: "/trading - View Trading Competitions" },
          { text: "/dashboard - View Trading Competition Dashboard" },
          { text: "/account - Manage your account" },
          { text: "/setdisplay <new name> - Set your display name" },
          { text: "/changepassword <old> <new> - Change your password" },
          { text: "/<TOKEN>-stats - e.g., /SKITTEN-stats" },
          { text: "/scan <token address> - Perform a honeypot scan" },
          { text: "/errorlog - View error logs" },
          { text: "/about - About Homebase Terminal" },
          { text: "/shortcuts - Show keyboard shortcuts" },
          { text: "/login - Login to your account" },
          { text: "/signup - Create a new account" },
        ]);
      } else if (command === "/shortcuts") {
        setHistory((prev) => [
          ...prev,
          { text: "Keyboard Shortcuts:" },
          { text: "Ctrl+K - Clear terminal" },
          { text: "Tab - Auto-complete command" },
          { text: "Arrow Up/Down - Navigate command history" },
          { text: "Ctrl+R - Return to previous page" },
        ]);
      } else if (command === "/clear") {
        setHistory([
          {
            text: "Welcome to Homebase Terminal! Type '/login <email> <password>' to sign in or '/signup <email> <password>' to create an account.",
            color: "gray",
          },
        ]);
      } else if (command === "/about") {
        setHistory((prev) => [
          ...prev,
          { text: "Homebase Terminal v1.0. Created by Wizop." },
        ]);
      } else if (command in baseCommands && baseCommands[command] !== "") {
        const route = baseCommands[command];
        setHistory((prev) => [...prev, { text: `Navigating to ${route}...` }]);
        router.push(route);
      } else if (command.startsWith("/scan")) {
        const parts = command.split(" ");
        if (parts.length < 2 || !parts[1]) {
          setHistory((prev) => [
            ...prev,
            { text: "Usage: /scan <token address>", color: "red" },
          ]);
          return;
        }
        const tokenAddress = parts[1].trim();
        fetchScanAudit(tokenAddress);
      } else {
        const statsRegex = /^\/([A-Z]+)-stats$/i;
        const match = command.match(statsRegex);
        if (match) {
          const tokenSymbol = match[1].toUpperCase();
          fetchTokenStats(tokenSymbol);
        } else {
          setHistory((prev) => [...prev, { text: `Command not recognized: ${command}` }]);
        }
      }
    } catch (err: any) {
      const crashMsg = `Terminal crashed on command "${command}": ${err.message}`;
      setHistory((prev) => [...prev, { text: crashMsg, color: "red" }]);
      logError(crashMsg);
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setInput(suggestion);
    setSuggestions([]);
    inputRef.current?.focus();
  }
}
