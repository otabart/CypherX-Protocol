"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase.js";

interface WhaleTx {
  id?: string;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress?: string;
  amountToken: number;
  amountUSD: number;
  percentSupply: number;
  fromAddress?: string;
  toAddress?: string;
  source?: string;
  timestamp: number;
}

function WhaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="whaleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#0052FF", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#60A5FA", stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <g>
        <path
          d="M52 32C52 18 42 8 32 8C22 8 12 18 12 32C12 40 16 46 22 48L18 56C17 58 18.5 60 20.5 60H43.5C45.5 60 47 58 46 56L42 48C48 46 52 40 52 32Z"
          fill="url(#whaleGradient)"
        />
        <path
          d="M12 56C10 58 8 60 4 60C0 60 -2 58 0 56C2 54 4 52 6 50C8 48 10 48 12 50C14 52 14 54 12 56Z"
          fill="url(#whaleGradient)"
        />
        <circle cx="40" cy="28" r="2" fill="white" />
        <path
          d="M32 14C32 12 34 10 36 10C38 10 40 12 40 14C40 18 36 20 36 20C36 20 34 18 32 14Z"
          fill="url(#whaleGradient)"
        />
        <path
          d="M24 38C22 40 20 40 18 38C16 36 16 34 18 32C20 30 22 30 24 32C26 34 26 36 24 38Z"
          fill="url(#whaleGradient)"
        />
        <path
          d="M40 36C38 38 36 38 34 36C32 34 32 32 34 30C36 28 38 28 40 30C42 32 42 34 40 36Z"
          fill="url(#whaleGradient)"
        />
      </g>
    </svg>
  );
}

export default function WhaleWatcherPage() {
  const [transactions, setTransactions] = useState<WhaleTx[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<WhaleTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tokenFilter, setTokenFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<keyof WhaleTx>("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedTx, setSelectedTx] = useState<WhaleTx | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    fetch("/api/start-monitoring")
      .then((res) => res.json())
      .then((data) => console.log("Monitoring API response:", data))
      .catch((err) => console.error("Failed to start monitoring:", err));
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    const q = query(
      collection(db, "whaleTransactions"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txs: WhaleTx[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          console.log(`Raw Firestore doc [${doc.id}]:`, data);
          return {
            id: doc.id,
            tokenSymbol: data.tokenSymbol || "Unknown",
            tokenName: data.tokenName || "Unknown",
            tokenAddress: data.tokenAddress,
            amountToken: Number(data.amountToken) || 0,
            amountUSD: Number(data.amountUSD) || 0,
            percentSupply: Number(data.percentSupply) || 0,
            fromAddress: data.fromAddress,
            toAddress: data.toAddress,
            source: data.source,
            timestamp: Number(data.timestamp) || 0,
          };
        }) as WhaleTx[];
        console.log(
          "Fetched transactions from Firestore:",
          txs.map((tx) => ({
            id: tx.id,
            tokenSymbol: tx.tokenSymbol,
            timestamp: new Date(tx.timestamp).toISOString(),
          }))
        );
        setTransactions(txs);
        setLoading(false);
        setLastUpdated(new Date());
      },
      (error) => {
        console.error("Firestore onSnapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    let filtered = [...transactions];

    if (tokenFilter) {
      filtered = filtered.filter((tx) =>
        tx.tokenSymbol.toLowerCase().includes(tokenFilter.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      const aValue = a[sortBy] ?? 0;
      const bValue = b[sortBy] ?? 0;
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    console.log(
      "Filtered transactions:",
      filtered.length,
      "Token filter:",
      tokenFilter,
      "Transactions:",
      filtered.map((tx) => ({
        id: tx.id,
        tokenSymbol: tx.tokenSymbol,
        timestamp: new Date(tx.timestamp).toISOString(),
      }))
    );
    setFilteredTransactions(filtered);
  }, [transactions, tokenFilter, sortBy, sortOrder, isClient]);

  const handleSort = (key: keyof WhaleTx) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
  };

  const handleCopyAddress = (address: string | undefined) => {
    if (address) {
      navigator.clipboard.writeText(address);
      alert("Address copied to clipboard!");
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono p-8">
      {selectedTx && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-gray-800">
            <h3 className="text-xl font-bold mb-4 text-white">Transaction Details</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-400">Token:</span> {selectedTx.tokenSymbol}</p>
              <p><span className="text-gray-400">Amount:</span> {selectedTx.amountToken.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p><span className="text-gray-400">USD Value:</span> ${selectedTx.amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p><span className="text-gray-400">Percent of Supply:</span> {selectedTx.percentSupply.toFixed(3)}%</p>
              <p><span className="text-gray-400">From:</span> {selectedTx.fromAddress || "-"}</p>
              <p><span className="text-gray-400">To:</span> {selectedTx.toAddress || "-"}</p>
              <p><span className="text-gray-400">Source:</span> {selectedTx.source || "-"}</p>
              <p><span className="text-gray-400">Timestamp:</span> {new Date(selectedTx.timestamp).toLocaleString()}</p>
            </div>
            <button
              onClick={() => setSelectedTx(null)}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors duration-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <WhaleIcon className="w-12 h-12 animate-pulse" />
          <h1 className="text-4xl font-bold tracking-wider text-white drop-shadow-[0_0_10px_rgba(0,82,255,0.5)]">
            Whale Watcher Terminal
          </h1>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400 animate-pulse">● Live</span>
          </div>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            setTimeout(() => {
              setLoading(false);
              setLastUpdated(new Date());
            }, 500);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors duration-200"
        >
          Refresh
        </button>
      </header>

      <div className="bg-gray-900 rounded-xl shadow-2xl p-8 border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-white">
              Recent Whale Transactions
            </h2>
            <input
              type="text"
              placeholder="Filter by token (e.g., FARTCOIN)"
              value={tokenFilter}
              onChange={(e) => setTokenFilter(e.target.value)}
              className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {lastUpdated && (
            <p className="text-xs text-gray-400">
              Last Updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-lg text-gray-300">Loading transactions...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <p className="text-gray-400 text-center py-12">
            No whale transactions found. Waiting for transfers...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-gray-300 uppercase text-xs tracking-wider">
                  <th className="py-4 px-6 text-left cursor-pointer" onClick={() => handleSort("tokenSymbol")}>
                    Token {sortBy === "tokenSymbol" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="py-4 px-6 text-right cursor-pointer" onClick={() => handleSort("amountToken")}>
                    Amount {sortBy === "amountToken" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="py-4 px-6 text-right cursor-pointer" onClick={() => handleSort("amountUSD")}>
                    USD Value {sortBy === "amountUSD" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="py-4 px-6 text-right cursor-pointer" onClick={() => handleSort("percentSupply")}>
                    % of Supply {sortBy === "percentSupply" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="py-4 px-6 text-left">From</th>
                  <th className="py-4 px-6 text-left">To</th>
                  <th className="py-4 px-6 text-left">Source</th>
                  <th className="py-4 px-6 text-right cursor-pointer" onClick={() => handleSort("timestamp")}>
                    Time {sortBy === "timestamp" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, index) => (
                  <tr
                    key={tx.id}
                    className={`${
                      index % 2 === 0 ? "bg-gray-950" : "bg-gray-900"
                    } border-b border-gray-800 hover:bg-gray-700 transition-all duration-300 animate-fade-in cursor-pointer`}
                    onClick={() => setSelectedTx(tx)}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <WhaleIcon className="w-6 h-6" />
                        <span className="font-semibold text-blue-400">{tx.tokenSymbol}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right text-gray-200">
                      {tx.amountToken.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-4 px-6 text-right text-green-400">
                      ${tx.amountUSD.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-4 px-6 text-right text-yellow-400">
                      {tx.percentSupply.toFixed(3)}%
                    </td>
                    <td className="py-4 px-6 text-gray-300">
                      <div className="flex items-center space-x-2">
                        {tx.fromAddress ? (
                          <>
                            <a
                              href={`https://basescan.org/address/${tx.fromAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-blue-400 transition-colors duration-200"
                            >
                              {tx.fromAddress.slice(0, 6)}...{tx.fromAddress.slice(-4)}
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyAddress(tx.fromAddress);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-300"
                            >
                              📋
                            </button>
                          </>
                        ) : (
                          "-"
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-300">
                      <div className="flex items-center space-x-2">
                        {tx.toAddress ? (
                          <>
                            <a
                              href={`https://basescan.org/address/${tx.toAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-blue-400 transition-colors duration-200"
                            >
                              {tx.toAddress.slice(0, 6)}...{tx.toAddress.slice(-4)}
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyAddress(tx.toAddress);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-300"
                            >
                              📋
                            </button>
                          </>
                        ) : (
                          "-"
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-200">{tx.source || "-"}</td>
                    <td className="py-4 px-6 text-right text-gray-400">
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}