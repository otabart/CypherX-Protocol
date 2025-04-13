"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase.js";
import { FaArrowUp, FaArrowDown, FaShareAlt } from "react-icons/fa";

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
  priceTrend?: "up" | "down" | "neutral"; // New field for trend indicator
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
  const router = useRouter();
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
          // Simulate price trend for demo purposes (in a real app, this would come from an API)
          const priceTrend = Math.random() > 0.5 ? "up" : Math.random() > 0.5 ? "down" : "neutral";
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
            priceTrend,
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

  const handleShare = (tx: WhaleTx) => {
    const shareText = `🐳 Whale Transaction Alert: ${tx.tokenSymbol} - $${tx.amountUSD.toLocaleString()} (${tx.percentSupply.toFixed(2)}% of supply) at ${new Date(tx.timestamp).toLocaleString()}`;
    if (navigator.share) {
      navigator.share({
        title: "Whale Transaction Alert",
        text: shareText,
        url: window.location.href,
      }).catch((err) => console.error("Share failed:", err));
    } else {
      navigator.clipboard.writeText(shareText);
      alert("Transaction details copied to clipboard!");
    }
  };

  // Determine transaction type (simplified logic for demo)
  const getTransactionType = (tx: WhaleTx) => {
    // In a real app, you'd check if toAddress/fromAddress matches known exchange addresses
    if (tx.toAddress && tx.toAddress.toLowerCase().includes("exchange")) return "Sell";
    if (tx.fromAddress && tx.fromAddress.toLowerCase().includes("exchange")) return "Buy";
    return "Transfer";
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono p-4 sm:p-8">
      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-white">Transaction Details</h3>
            <div className="space-y-2 text-xs sm:text-sm">
              <p><span className="text-gray-300">Token:</span> {selectedTx.tokenSymbol}</p>
              <p><span className="text-gray-300">Type:</span> {getTransactionType(selectedTx)}</p>
              <p><span className="text-gray-300">Amount:</span> {selectedTx.amountToken.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p><span className="text-gray-300">USD Value:</span> ${selectedTx.amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p><span className="text-gray-300">Percent of Supply:</span> {selectedTx.percentSupply.toFixed(3)}%</p>
              <p><span className="text-gray-300">From:</span> {selectedTx.fromAddress || "-"}</p>
              <p><span className="text-gray-300">To:</span> {selectedTx.toAddress || "-"}</p>
              <p><span className="text-gray-300">Source:</span> {selectedTx.source || "-"}</p>
              <p><span className="text-gray-300">Timestamp:</span> {new Date(selectedTx.timestamp).toLocaleString()}</p>
            </div>
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => handleShare(selectedTx)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <FaShareAlt /> Share
              </button>
              <button
                onClick={() => setSelectedTx(null)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-6 sm:mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <WhaleIcon className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse" />
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-wider text-white drop-shadow-[0_0_10px_rgba(0,82,255,0.5)]">
              Whale Watchers
            </h1>
            <div className="flex items-center space-x-2 mt-2">
              <span className="text-xs sm:text-sm text-gray-300 animate-pulse">● Live</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-2 w-full sm:w-auto">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition-colors duration-200 w-full sm:w-auto min-h-[44px]"
          >
            [Back]
          </button>
          <button
            onClick={() => {
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                setLastUpdated(new Date());
              }, 500);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors duration-200 w-full sm:w-auto min-h-[44px]"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-8 border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
            <h2 className="text-lg sm:text-xl font-semibold text-white">
              Recent Whale Transactions
            </h2>
            <input
              type="text"
              placeholder="Filter by token (e.g., FARTCOIN)"
              value={tokenFilter}
              onChange={(e) => setTokenFilter(e.target.value)}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 min-h-[44px] text-sm"
            />
            {/* Sorting Dropdown for Mobile */}
            <div className="block sm:hidden">
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [key, order] = e.target.value.split("-") as [keyof WhaleTx, "asc" | "desc"];
                  setSortBy(key);
                  setSortOrder(order);
                }}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-h-[44px] text-sm"
              >
                <option value="timestamp-desc">Time (Newest First)</option>
                <option value="timestamp-asc">Time (Oldest First)</option>
                <option value="amountUSD-desc">USD Value (High to Low)</option>
                <option value="amountUSD-asc">USD Value (Low to High)</option>
                <option value="percentSupply-desc">% of Supply (High to Low)</option>
                <option value="percentSupply-asc">% of Supply (Low to High)</option>
                <option value="tokenSymbol-asc">Token (A to Z)</option>
                <option value="tokenSymbol-desc">Token (Z to A)</option>
              </select>
            </div>
          </div>
          {lastUpdated && (
            <p className="text-xs text-gray-300 text-center sm:text-right">
              Last Updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {/* Loading Skeleton for Desktop */}
            <div className="hidden sm:block">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="animate-pulse flex space-x-4 p-4 border-b border-gray-700">
                  <div className="rounded-full bg-gray-600 h-6 w-6"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-600 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-600 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
            {/* Loading Skeleton for Mobile */}
            <div className="block sm:hidden space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="animate-pulse bg-gray-700 p-4 rounded-lg">
                  <div className="flex space-x-3">
                    <div className="rounded-full bg-gray-600 h-6 w-6"></div>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-gray-600 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-600 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <p className="text-gray-300 text-center py-12">
            No whale transactions found. Waiting for transfers...
          </p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-700 text-gray-200 uppercase text-xs tracking-wider">
                    <th className="py-4 px-6 text-left cursor-pointer" onClick={() => handleSort("tokenSymbol")}>
                      Token {sortBy === "tokenSymbol" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="py-4 px-6 text-left">Type</th>
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
                    <th className="py-4 px-6 text-center">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, index) => (
                    <tr
                      key={tx.id}
                      className={`${
                        index % 2 === 0 ? "bg-gray-800" : "bg-gray-750"
                      } border-b border-gray-700 hover:bg-gray-600 transition-all duration-300 animate-fade-in cursor-pointer shadow-sm`}
                      onClick={() => setSelectedTx(tx)}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <WhaleIcon className="w-6 h-6" />
                          <span className="font-semibold text-blue-400">{tx.tokenSymbol}</span>
                          {tx.priceTrend === "up" && <FaArrowUp className="text-green-400" />}
                          {tx.priceTrend === "down" && <FaArrowDown className="text-red-400" />}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-200">{getTransactionType(tx)}</td>
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
                      <td className="py-4 px-6 text-gray-200">
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
                                className="text-xs text-gray-400 hover:text-gray-200 p-2"
                              >
                                📋
                              </button>
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-200">
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
                                className="text-xs text-gray-400 hover:text-gray-200 p-2"
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
                      <td className="py-4 px-6 text-right text-gray-300">
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(tx);
                          }}
                          className="text-gray-400 hover:text-gray-200 p-2"
                        >
                          <FaShareAlt />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-4">
              {filteredTransactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className={`bg-gray-800 rounded-lg p-4 border border-gray-700 hover:bg-gray-600 transition-all duration-300 animate-fade-in cursor-pointer shadow-sm ${
                    index % 2 === 0 ? "bg-gray-800" : "bg-gray-750"
                  }`}
                  onClick={() => setSelectedTx(tx)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <WhaleIcon className="w-6 h-6" />
                      <span className="font-semibold text-blue-400 text-sm">{tx.tokenSymbol}</span>
                      {tx.priceTrend === "up" && <FaArrowUp className="text-green-400" />}
                      {tx.priceTrend === "down" && <FaArrowDown className="text-red-400" />}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(tx);
                        }}
                        className="text-gray-400 hover:text-gray-200 p-2"
                      >
                        <FaShareAlt />
                      </button>
                      <span className="text-xs text-gray-300">
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-300">Type:</span>{" "}
                      <span className="text-gray-200">{getTransactionType(tx)}</span>
                    </div>
                    <div>
                      <span className="text-gray-300">Amount:</span>{" "}
                      <span className="text-gray-200">
                        {tx.amountToken.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-300">USD Value:</span>{" "}
                      <span className="text-green-400">
                        ${tx.amountUSD.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-300">% of Supply:</span>{" "}
                      <span className="text-yellow-400">{tx.percentSupply.toFixed(3)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-300">Source:</span>{" "}
                      <span className="text-gray-200">{tx.source || "-"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-300">From:</span>{" "}
                      {tx.fromAddress ? (
                        <div className="flex items-center space-x-2 mt-1">
                          <a
                            href={`https://basescan.org/address/${tx.fromAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-blue-400 transition-colors duration-200 text-gray-200"
                          >
                            {tx.fromAddress.slice(0, 6)}...{tx.fromAddress.slice(-4)}
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAddress(tx.fromAddress);
                            }}
                            className="text-xs text-gray-400 hover:text-gray-200 p-2"
                          >
                            📋
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-200">-</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-300">To:</span>{" "}
                      {tx.toAddress ? (
                        <div className="flex items-center space-x-2 mt-1">
                          <a
                            href={`https://basescan.org/address/${tx.toAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-blue-400 transition-colors duration-200 text-gray-200"
                          >
                            {tx.toAddress.slice(0, 6)}...{tx.toAddress.slice(-4)}
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAddress(tx.toAddress);
                            }}
                            className="text-xs text-gray-400 hover:text-gray-200 p-2"
                          >
                            📋
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-200">-</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}