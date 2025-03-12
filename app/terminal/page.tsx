"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// Helper sleep function for typewriter effect.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function HomebaseTerminal() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([
    "Welcome to Homebase Terminal! Type '/help' to see available commands.",
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [userCommands, setUserCommands] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [accentColor, setAccentColor] = useState("#0052FF");
  const [statsLoading, setStatsLoading] = useState(false);

  // Available non-stats commands.
  const availableCommands: Record<string, string> = {
    "/whalewatchers": "/whale-watchers",
    "/news": "/base-chain-news",
    "/home": "/",
    "/menu": "",
    "/help": "",
    "/clear": "",
    "/about": "",
    "/version": "",
  };

  // Static mapping of token symbols to addresses.
  const tokenSymbolToAddress: Record<string, string> = {
    "KEYCAT": "0x3c8cd0db9a01efa063a7760267b822a129bc7dca",
    "SKIDOG": "0x1bc0c42215582d5a085795f4badbac3ff36d1bcb",
    "KAITO": "0x9704d2adbc02c085ff526a37ac64872027ac8a50",
    "B3": "0xbc45647ea894030a4e9801ec03479739fa2485f0",
    "KTA": "0x1185cb5122edad199bdbc0cbd7a0457e448f23c7",
    "SKICAT": "0xb33ff54b9f7242ef1593d2c9bcd8f9df46c77935",
  };

  // Update suggestions using fuzzy matching.
  useEffect(() => {
    if (input.trim() === "") {
      setSuggestions([]);
    } else {
      const lower = input.toLowerCase();
      const filtered = Object.keys(availableCommands).filter((cmd) =>
        cmd.toLowerCase().includes(lower)
      );
      setSuggestions(filtered);
    }
  }, [input]);

  // Command history navigation (up/down arrow keys).
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
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

  // Typewriter effect: print lines with a delay.
  async function typeOutLines(lines: string[]) {
    for (const line of lines) {
      setHistory((prev) => [...prev, line]);
      await sleep(500);
    }
  }

  // Fetch token stats for a given token symbol using static mapping.
  async function fetchTokenStats(tokenSymbol: string) {
    const tokenAddress = tokenSymbolToAddress[tokenSymbol];
    if (!tokenAddress) {
      setHistory((prev) => [...prev, `Token symbol ${tokenSymbol} not recognized.`]);
      return;
    }
    setStatsLoading(true);
    setHistory((prev) => [...prev, `Fetching stats for ${tokenSymbol}...`]);
    try {
      const res = await fetch(`/api/tokens?chainId=base&tokenAddresses=${tokenAddress}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      console.log("Fetched token data for", tokenSymbol, data);
      const tokenData = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (tokenData) {
        const lines = [
          `Stats for ${tokenSymbol}:`,
          `Market Cap: $${Number(tokenData.marketCap).toLocaleString()}`,
          `Price: $${Number(tokenData.priceUsd).toFixed(4)}`,
          `24hr Change: ${Number(tokenData.priceChange?.h24 || 0).toFixed(2)}%`,
          `Volume (24hr): $${Number(tokenData.volume.h24).toLocaleString()}`,
        ];
        await typeOutLines(lines);
      } else {
        setHistory((prev) => [...prev, `No stats available for ${tokenSymbol}.`]);
      }
    } catch (error: any) {
      setHistory((prev) => [
        ...prev,
        `Failed to fetch stats for ${tokenSymbol}: ${error.message}`,
      ]);
    } finally {
      setStatsLoading(false);
    }
  }

  // Handle command input.
  function handleCommand(command: string) {
    // Log the command.
    setHistory((prev) => [...prev, `[ user@homebase ~ v1 ] $ ${command}`]);
    setUserCommands((prev) => [...prev, command]);
    setHistoryIndex(-1);

    if (command === "/menu") {
      setHistory((prev) => [
        ...prev,
        "Available commands:",
        "/whalewatchers - Navigate to Whale Watchers page",
        "/news - Navigate to News Terminal",
        "/home - Return to Home page",
        "/help - Show help information",
        "/about - About Homebase Terminal",
        "/version - Show version information",
        "/clear - Clear terminal history",
        "/<TOKEN>-stats - Fetch stats for a token (e.g., /KEYCAT-stats)",
      ]);
    } else if (command === "/help") {
      setHistory((prev) => [
        ...prev,
        "Help:",
        "/whalewatchers - Navigate to Whale Watchers page",
        "/news - Navigate to News Terminal",
        "/home - Return to Home page",
        "/clear - Clear terminal history",
        "/menu - List available commands",
        "/about - About Homebase Terminal",
        "/version - Show version information",
        "/<TOKEN>-stats - Fetch stats for a token (e.g., /KEYCAT-stats)",
        "/help - Show this help message",
      ]);
    } else if (command === "/clear") {
      setHistory([
        "Welcome to Homebase Terminal! Type '/help' to see available commands.",
      ]);
    } else if (command === "/about") {
      setHistory((prev) => [...prev, "Homebase Terminal v1.0. Created by [Your Name]."]);
    } else if (command === "/version") {
      setHistory((prev) => [...prev, "Version 1.0.0"]);
    } else if (command in availableCommands && availableCommands[command] !== "") {
      const route = availableCommands[command];
      setHistory((prev) => [...prev, `Navigating to ${route}...`]);
      router.push(route);
    } else {
      // Check for token stats command pattern: /TOKEN-stats
      const statsRegex = /^\/([A-Z]+)-stats$/i;
      const match = command.match(statsRegex);
      if (match) {
        const tokenSymbol = match[1].toUpperCase();
        fetchTokenStats(tokenSymbol);
      } else {
        setHistory((prev) => [...prev, `Command not recognized: ${command}`]);
      }
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    handleCommand(trimmed);
    setInput("");
    setSuggestions([]);
  }

  function handleSuggestionClick(suggestion: string) {
    setInput(suggestion);
    setSuggestions([]);
  }

  return (
    <motion.div
      className="w-screen h-screen bg-black text-white font-mono p-4 overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Top Bar: Header & Accent Color Picker */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Homebase Terminal</h1>
        <div className="flex items-center space-x-2">
          <label htmlFor="accentColor" className="text-sm text-gray-500">
            Accent Color:
          </label>
          <input
            id="accentColor"
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="w-8 h-8 border-none p-0"
          />
        </div>
      </div>

      {/* Terminal History */}
      <div className="mb-4 overflow-auto" style={{ maxHeight: "40%" }}>
        {history.map((line, idx) => (
          <div
            key={idx}
            className="mb-1 text-sm break-words"
            style={{
              color:
                line.startsWith("Navigating") ||
                line.startsWith("Stats for") ||
                line.startsWith("Market Cap:") ||
                line.startsWith("Price:") ||
                line.startsWith("24hr Change:") ||
                line.startsWith("Volume")
                  ? accentColor
                  : line.includes("Welcome to Homebase Terminal!")
                  ? "gray"
                  : undefined,
            }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Command Input and Autocomplete Suggestions */}
      <div>
        <form onSubmit={handleSubmit} className="flex items-center">
          <span className="mr-2 text-sm" style={{ color: accentColor }}>
            [ user@homebase ~ v1 ] $
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-black outline-none border-none flex-1 text-sm text-white"
            autoFocus
            placeholder="Type a command..."
            aria-label="Terminal command input"
          />
          <span className="ml-1 blinking-cursor" style={{ color: accentColor }}>
            |
          </span>
        </form>
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div
              className="mt-2 bg-gray-800 p-2 rounded"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="cursor-pointer text-sm text-gray-300 hover:text-white"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}










