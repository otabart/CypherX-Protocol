"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Helper: returns a "time ago" string for a given ISO date string
function timeAgo(dateString: string) {
  const now = new Date();
  const txDate = new Date(dateString);
  const diffMs = now.getTime() - txDate.getTime();

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) {
    return `${diffMins} mins ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

// A better whale icon – a more refined design.
// Feel free to adjust the SVG path to better match your branding.
function BetterWhaleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* This path creates a stylized whale silhouette */}
      <path d="M4,30 C4,20 20,10 32,10 C44,10 60,20 60,30 C60,40 44,50 32,50 C20,50 4,40 4,30 Z M32,12 C18,12 8,22 8,30 C8,38 18,48 32,48 C46,48 56,38 56,30 C56,22 46,12 32,12 Z" />
      <circle cx="24" cy="28" r="3" fill="white" />
      <circle cx="40" cy="28" r="3" fill="white" />
    </svg>
  );
}

interface Transaction {
  id: string;
  wallet: string;
  token: string;
  amount: number | string;
  value: number;
  type: string;
  tokenSupply: number | string;
  time: string;
}

export default function WhaleWatcherTerminal() {
  // 10 fake transactions (all values over $5,000, odd numbers, using specified coin tickers)
  const [transactions] = useState<Transaction[]>([
    {
      id: "fake1",
      wallet: "0xABC123FAKE000111222333444555666777888999",
      token: "KEYCAT",
      amount: 283001,
      value: 5001,
      type: "Buy",
      tokenSupply: 10000000,
      time: "2025-03-11T09:00:00Z",
    },
    {
      id: "fake2",
      wallet: "0xCDEF999FAKE000111222333444555666777888111",
      token: "SKIDOG",
      amount: 999755,
      value: 7531,
      type: "Sell",
      tokenSupply: 50000000,
      time: "2025-03-11T08:55:00Z",
    },
    {
      id: "fake3",
      wallet: "0xAABBCCFAKE000111222333444555666777888222",
      token: "KAITO",
      amount: 27459,
      value: 8753,
      type: "Buy",
      tokenSupply: 1000000,
      time: "2025-03-11T08:50:00Z",
    },
    {
      id: "fake4",
      wallet: "0x123456FAKE000111222333444555666777888AAA",
      token: "B3",
      amount: 88559,
      value: 9259,
      type: "Buy",
      tokenSupply: 2000000,
      time: "2025-03-11T08:45:00Z",
    },
    {
      id: "fake5",
      wallet: "0x654321FAKE000111222333444555666777888BBB",
      token: "KTA",
      amount: 45321,
      value: 6317,
      type: "Sell",
      tokenSupply: 8000000,
      time: "2025-03-11T08:40:00Z",
    },
    {
      id: "fake6",
      wallet: "0xFACE999FAKE000111222333444555666777888CCC",
      token: "SKICAT",
      amount: 99999,
      value: 7777,
      type: "Buy",
      tokenSupply: 9000000,
      time: "2025-03-11T08:35:00Z",
    },
    {
      id: "fake7",
      wallet: "0xDEADFAKE000111222333444555666777888DDD333",
      token: "KEYCAT",
      amount: 123457,
      value: 9999,
      type: "Sell",
      tokenSupply: 10000000,
      time: "2025-03-11T08:30:00Z",
    },
    {
      id: "fake8",
      wallet: "0xFADEFAKE000111222333444555666777888EEE666",
      token: "B3",
      amount: 200003,
      value: 5511,
      type: "Buy",
      tokenSupply: 2000000,
      time: "2025-03-11T08:25:00Z",
    },
    {
      id: "fake9",
      wallet: "0xF00DFAKE000111222333444555666777888FFF999",
      token: "KAITO",
      amount: 5111,
      value: 6973,
      type: "Sell",
      tokenSupply: 500000,
      time: "2025-03-11T08:20:00Z",
    },
    {
      id: "fake10",
      wallet: "0xBEEF123FAKE000111222333444555666777888000",
      token: "SKICAT",
      amount: 33331,
      value: 8195,
      type: "Buy",
      tokenSupply: 1000000,
      time: "2025-03-11T08:15:00Z",
    },
  ]);

  return (
    <motion.div
      className="w-screen h-screen bg-black text-white font-mono overflow-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header / Top Bar */}
      <div className="border-b border-gray-700 p-4">
        <a
          href="/terminal"
          className="text-sm underline text-white hover:text-gray-300 transition"
        >
          Back to Terminal
        </a>
        <h1 className="text-xl font-bold mt-2 mb-1">
          Whale Watcher Terminal
        </h1>
        <p className="text-xs text-gray-400">
          Tracking major transactions on Base in real time.
        </p>
      </div>

      {/* Transactions List */}
      <div className="p-4">
        {transactions.map((tx) => {
          const ago = timeAgo(tx.time);
          return (
            <div
              key={tx.id}
              className="py-3 border-b border-gray-700 last:border-none"
            >
              {/* Row with Whale Icon and Token Name */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <BetterWhaleIcon className="w-6 h-6 text-blue-400" />
                  <span className="text-sm font-bold">{tx.token}</span>
                </div>
                <span className="text-xs text-gray-400">{ago}</span>
              </div>

              {/* Transaction details */}
              <div className="flex flex-wrap items-center text-xs space-x-3 mt-1">
                <span
                  className={`px-1 rounded ${
                    tx.type === "Buy"
                      ? "bg-green-600"
                      : tx.type === "Sell"
                      ? "bg-red-600"
                      : "bg-gray-600"
                  }`}
                >
                  {tx.type}
                </span>
                <span className="text-gray-300">
                  Amount:{" "}
                  {typeof tx.amount === "number"
                    ? tx.amount.toLocaleString()
                    : tx.amount}
                </span>
                <span className="text-gray-300">
                  Value: ${tx.value.toLocaleString()}
                </span>
                <span className="text-gray-300">
                  Supply %:{" "}
                  {typeof tx.tokenSupply === "number"
                    ? ((+tx.amount / +tx.tokenSupply) * 100).toFixed(4) + "%"
                    : "N/A"}
                </span>
                {/* Clickable wallet address linking to BaseScan */}
                <a
                  href={`https://basescan.org/address/${tx.wallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:underline"
                >
                  {tx.wallet}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}





