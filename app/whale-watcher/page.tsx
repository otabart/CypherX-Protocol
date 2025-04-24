"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase.ts";
import { FaShareAlt, FaCopy } from "react-icons/fa";
import { GiWhaleTail } from "react-icons/gi";
import { debounce } from "lodash";

// Interface for whale transactions
interface WhaleTx {
  id?: string;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress?: string;
  amountToken: number;
  amountUSD: number;
  fromAddress?: string;
  toAddress?: string;
  source?: string;
  timestamp: number;
  hash?: string;
  eventType: "Transfer" | "Swap";
  swapDetails?: {
    amountIn: number;
    amountOut: number;
    tokenIn: string;
    tokenOut: string;
  };
  percentage: number;
}

// Whale Icon using react-icons
function WhaleIcon({ className }: { className?: string }) {
  return <GiWhaleTail className={className} />;
}

// Loading Spinner with Coinbase Blue
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <svg
        className="animate-spin h-12 w-12 text-blue-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

export default function WhaleWatcherPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<WhaleTx[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<WhaleTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tokenFilter, setTokenFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "Buy" | "Sell" | "Transfer" | "Swap">(
    "all"
  );
  const [minUSD, setMinUSD] = useState("");
  const [maxUSD, setMaxUSD] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "hour" | "day" | "week">("all");
  const [sortBy, setSortBy] = useState<keyof WhaleTx>("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedTx, setSelectedTx] = useState<WhaleTx | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [page, setPage] = useState(1);
  const [newTxCount, setNewTxCount] = useState(0);
  const [minPercentage, setMinPercentage] = useState("");
  const [exchangeFilter, setExchangeFilter] = useState<
    "all" | "Uniswap V3" | "Aerodrome" | "Base"
  >("all");
  const transactionsPerPage = 20;

  // Debounced token filter
  const debouncedSetTokenFilter = useCallback(
    debounce((value: string) => setTokenFilter(value), 300),
    []
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Start monitoring
  useEffect(() => {
    if (!isClient) return;
    fetch("/api/whale-watchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startMonitoring: true }),
    })
      .then((res) => res.json())
      .then((data) => console.log("Monitoring API response:", data))
      .catch((err) => console.error("Failed to start monitoring:", err));
  }, [isClient]);

  // Fetch transactions from Firestore
  useEffect(() => {
    if (!isClient) return;
    const q = query(collection(db, "whaleTransactions"), orderBy("timestamp", "desc"));

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
            fromAddress: data.fromAddress,
            toAddress: data.toAddress,
            source: data.source,
            timestamp: Number(data.timestamp) || 0,
            hash: data.hash,
            eventType: data.eventType || "Transfer",
            swapDetails: data.swapDetails,
            percentage: Number(data.percentage) || 0,
          };
        });
        console.log(
          "Fetched transactions:",
          txs.map((tx) => ({
            id: tx.id,
            tokenSymbol: tx.tokenSymbol,
            timestamp: new Date(tx.timestamp).toISOString(),
            eventType: tx.eventType,
          }))
        );
        setTransactions((prev) => {
          const newTxs = txs.filter((tx) => !prev.some((p) => p.id === tx.id));
          setNewTxCount((count) => count + newTxs.length);
          setTimeout(() => setNewTxCount(0), 5000);
          return txs;
        });
        setLoading(false);
        setLastUpdated(new Date());
        setError(null);
      },
      (error) => {
        console.error("Firestore onSnapshot error:", error);
        setError("Failed to load transactions. Please try again.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isClient]);

  // Apply filters and sorting
  useEffect(() => {
    if (!isClient) return;
    let filtered = [...transactions];

    // Token filter
    if (tokenFilter) {
      filtered = filtered.filter((tx) =>
        tx.tokenSymbol.toLowerCase().includes(tokenFilter.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((tx) => getTransactionType(tx) === typeFilter);
    }

    // USD value filter
    if (minUSD) {
      const min = parseFloat(minUSD);
      if (!isNaN(min)) {
        filtered = filtered.filter((tx) => tx.amountUSD >= min);
      }
    }
    if (maxUSD) {
      const max = parseFloat(maxUSD);
      if (!isNaN(max)) {
        filtered = filtered.filter((tx) => tx.amountUSD <= max);
      }
    }

    // Time filter
    const now = Date.now();
    if (timeFilter === "hour") {
      filtered = filtered.filter((tx) => now - tx.timestamp <= 60 * 60 * 1000);
    } else if (timeFilter === "day") {
      filtered = filtered.filter((tx) => now - tx.timestamp <= 24 * 60 * 60 * 1000);
    } else if (timeFilter === "week") {
      filtered = filtered.filter((tx) => now - tx.timestamp <= 7 * 24 * 60 * 60 * 1000);
    }

    // Percentage filter
    if (minPercentage) {
      const min = parseFloat(minPercentage);
      if (!isNaN(min)) {
        filtered = filtered.filter((tx) => tx.percentage >= min);
      }
    }

    // Exchange filter
    if (exchangeFilter !== "all") {
      filtered = filtered.filter((tx) => tx.source === exchangeFilter);
    }

    // Sorting
    filtered.sort((a, b) => {
      const aValue = a[sortBy] ?? 0;
      const bValue = b[sortBy] ?? 0;
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    setFilteredTransactions(filtered);
    setPage(1);
  }, [
    transactions,
    tokenFilter,
    typeFilter,
    minUSD,
    maxUSD,
    timeFilter,
    sortBy,
    sortOrder,
    minPercentage,
    exchangeFilter,
    isClient,
  ]);

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
    const shareText = `🐳 Whale Transaction Alert: ${tx.tokenSymbol} - $${tx.amountUSD.toLocaleString()} (${
      tx.eventType
    }) at ${new Date(tx.timestamp).toLocaleString()} on ${tx.source}`;
    if (navigator.share) {
      navigator
        .share({
          title: "Whale Transaction Alert",
          text: shareText,
          url: `https://basescan.org/tx/${tx.hash}`,
        })
        .catch((err) => console.error("Share failed:", err));
    } else {
      navigator.clipboard.writeText(shareText);
      alert("Transaction details copied to clipboard!");
    }
  };

  // Transaction type logic
  const getTransactionType = (tx: WhaleTx) => {
    if (tx.eventType === "Swap" && tx.swapDetails) {
      const { tokenIn, tokenOut } = tx.swapDetails;
      const stablecoinSymbols = ["USDC", "USDbC"];
      if (stablecoinSymbols.includes(tokenIn)) {
        return "Buy";
      }
      if (stablecoinSymbols.includes(tokenOut)) {
        return "Sell";
      }
      return "Swap";
    }

    const exchangeAddresses = [
      "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad",
      "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae",
    ].map((addr) => addr.toLowerCase());
    const stablecoinAddresses = [
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
    ].map((addr) => addr.toLowerCase());

    if (
      tx.toAddress &&
      (exchangeAddresses.includes(tx.toAddress.toLowerCase()) ||
        stablecoinAddresses.includes(tx.toAddress.toLowerCase()))
    ) {
      return "Sell";
    }
    if (
      tx.fromAddress &&
      (exchangeAddresses.includes(tx.fromAddress.toLowerCase()) ||
        stablecoinAddresses.includes(tx.fromAddress.toLowerCase()))
    ) {
      return "Buy";
    }
    return "Transfer";
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Sell":
        return "text-red-500";
      case "Buy":
        return "text-green-500";
      case "Transfer":
      case "Swap":
        return "text-blue-500";
      default:
        return "text-gray-200";
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (page - 1) * transactionsPerPage,
    page * transactionsPerPage
  );

  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono p-4 sm:p-8 relative">
      <style jsx>{`
        @keyframes typewriter {
          from {
            width: 0;
          }
          to {
            width: 100%;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-typewriter {
          display: inline-block;
          overflow: hidden;
          animation: typewriter 2s steps(40) 1;
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>

      {/* CRT scanline overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[url('/scanlines.png')] opacity-10 z-10" />

      {/* New transaction toast */}
      {newTxCount > 0 && (
        <div className="fixed bottom-4 left-4 bg-blue-900 text-blue-300 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          {newTxCount} new transaction{newTxCount > 1 ? "s" : ""} detected
        </div>
      )}

      {/* Modal for transaction details */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-blue-400">Transaction Details</h3>
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-gray-400">Token:</span>{" "}
                <span className="text-blue-400">{selectedTx.tokenSymbol}</span>
              </p>
              <p>
                <span className="text-gray-400">Type:</span>{" "}
                <span className={getTypeColor(getTransactionType(selectedTx))}>
                  {getTransactionType(selectedTx)}
                </span>
              </p>
              <p>
                <span className="text-gray-400">Amount:</span>{" "}
                {selectedTx.amountToken.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p>
                <span className="text-gray-400">USD Value:</span>{" "}
                <span className="text-green-400">
                  ${selectedTx.amountUSD.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </p>
              {selectedTx.eventType === "Swap" && selectedTx.swapDetails && (
                <>
                  <p>
                    <span className="text-gray-400">Swap Input:</span>{" "}
                    {selectedTx.swapDetails.amountIn.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {selectedTx.swapDetails.tokenIn}
                  </p>
                  <p>
                    <span className="text-gray-400">Swap Output:</span>{" "}
                    {selectedTx.swapDetails.amountOut.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    {selectedTx.swapDetails.tokenOut}
                  </p>
                </>
              )}
              <p>
                <span className="text-gray-400">From:</span>{" "}
                {selectedTx.fromAddress ? (
                  <a
                    href={`https://basescan.org/address/${selectedTx.fromAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {selectedTx.fromAddress.slice(0, 6)}...
                    {selectedTx.fromAddress.slice(-4)}
                  </a>
                ) : (
                  "-"
                )}
              </p>
              <p>
                <span className="text-gray-400">To:</span>{" "}
                {selectedTx.toAddress ? (
                  <a
                    href={`https://basescan.org/address/${selectedTx.toAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {selectedTx.toAddress.slice(0, 6)}...{selectedTx.toAddress.slice(-4)}
                  </a>
                ) : (
                  "-"
                )}
              </p>
              <p>
                <span className="text-gray-400">Hash:</span>{" "}
                {selectedTx.hash ? (
                  <a
                    href={`https://basescan.org/tx/${selectedTx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {selectedTx.hash.slice(0, 6)}...{selectedTx.hash.slice(-4)}
                  </a>
                ) : (
                  "-"
                )}
              </p>
              <p>
                <span className="text-gray-400">Source:</span> {selectedTx.source || "-"}
              </p>
              <p>
                <span className="text-gray-400">Timestamp:</span>{" "}
                {new Date(selectedTx.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => handleShare(selectedTx)}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <FaShareAlt /> Share
              </button>
              <button
                onClick={() => setSelectedTx(null)}
                className="flex-1 px-4 py-2 bg-blue-800 hover:bg-blue-700 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-6 sm:mb-8 flex flex-col items-center gap-4">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-4">
            <WhaleIcon className="w-12 h-12 sm:w-16 sm:h-16 text-blue-500 animate-pulse" />
            <h1 className="text-3xl sm:text-4xl font-bold tracking-wider text-blue-400 drop-shadow-[0_0_10px_rgba(0,82,255,0.5)] animate-typewriter">
              Whale Watchers
            </h1>
          </div>
          <p className="text-sm text-gray-400 text-center">
            Real-time monitoring of large transactions on Base chain
          </p>
        </div>
        <div className="flex space-x-2 w-full sm:w-auto justify-center">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors w-full sm:w-auto min-h-[44px]"
          >
            [Back]
          </button>
          <button
            onClick={() => {
              setLoading(true);
              fetch("/api/whale-watchers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startMonitoring: true }),
              })
                .then(() => setLoading(false))
                .catch(() => setLoading(false));
              setLastUpdated(new Date());
            }}
            className="px-4 py-2 bg-blue-800 hover:bg-blue-700 rounded-lg text-sm transition-colors w-full sm:w-auto min-h-[44px]"
          >
            [Refresh]
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="bg-gray-900 rounded-xl shadow-2xl p-4 sm:p-6 border border-gray-800">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-4">
          <div className="flex flex-col space-y-4 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <h2 className="text-xl font-semibold text-blue-400">Whale Transactions</h2>
              <input
                type="text"
                placeholder="Filter by token (e.g., $checkr)"
                onChange={(e) => debouncedSetTokenFilter(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 min-h-[44px] text-sm"
                aria-label="Filter by token symbol"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] text-sm"
                aria-label="Filter by transaction type"
              >
                <option value="all">All Types</option>
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
                <option value="Transfer">Transfer</option>
                <option value="Swap">Swap</option>
              </select>
              <input
                type="number"
                placeholder="Min USD"
                value={minUSD}
                onChange={(e) => setMinUSD(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 min-h-[44px] text-sm"
                aria-label="Minimum USD value"
              />
              <input
                type="number"
                placeholder="Max USD"
                value={maxUSD}
                onChange={(e) => setMaxUSD(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 min-h-[44px] text-sm"
                aria-label="Maximum USD value"
              />
              <input
                type="number"
                placeholder="Min % Supply"
                value={minPercentage}
                onChange={(e) => setMinPercentage(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 min-h-[44px] text-sm"
                aria-label="Minimum percentage of token supply"
              />
              <select
                value={exchangeFilter}
                onChange={(e) => setExchangeFilter(e.target.value as any)}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] text-sm"
                aria-label="Filter by exchange"
              >
                <option value="all">All Exchanges</option>
                <option value="Uniswap V3">Uniswap V3</option>
                <option value="Aerodrome">Aerodrome</option>
                <option value="Base">Base (Transfers)</option>
              </select>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] text-sm"
                aria-label="Filter by time range"
              >
                <option value="all">All Time</option>
                <option value="hour">Last Hour</option>
                <option value="day">Last Day</option>
                <option value="week">Last Week</option>
              </select>
            </div>
          </div>
          {lastUpdated && (
            <p className="text-xs text-gray-400 text-center sm:text-right">
              Last Updated: {lastUpdated.toLocaleString()}
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && <div className="text-red-500 text-center py-4">{error}</div>}

        {/* Loading State */}
        {loading && <LoadingSpinner />}

        {/* No Transactions */}
        {!loading && filteredTransactions.length === 0 && (
          <p className="text-gray-400 text-center py-12">
            No whale transactions found. Waiting for transfers or swaps...
          </p>
        )}

        {/* Transactions */}
        {!loading && filteredTransactions.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-gray-300 uppercase text-xs tracking-wider border-b border-gray-700">
                    <th
                      className="py-3 px-4 text-left cursor-pointer"
                      onClick={() => handleSort("tokenSymbol")}
                      aria-sort={
                        sortBy === "tokenSymbol"
                          ? sortOrder === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      Token {sortBy === "tokenSymbol" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="py-3 px-4 text-left">Type</th>
                    <th
                      className="py-3 px-4 text-right cursor-pointer"
                      onClick={() => handleSort("amountToken")}
                      aria-sort={
                        sortBy === "amountToken"
                          ? sortOrder === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      Amount {sortBy === "amountToken" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="py-3 px-4 text-right cursor-pointer"
                      onClick={() => handleSort("amountUSD")}
                      aria-sort={
                        sortBy === "amountUSD"
                          ? sortOrder === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      USD Value {sortBy === "amountUSD" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="py-3 px-4 text-left">From</th>
                    <th className="py-3 px-4 text-left">To</th>
                    <th className="py-3 px-4 text-left">Hash</th>
                    <th className="py-3 px-4 text-left">Source</th>
                    <th
                      className="py-3 px-4 text-right cursor-pointer"
                      onClick={() => handleSort("timestamp")}
                      aria-sort={
                        sortBy === "timestamp"
                          ? sortOrder === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      Time {sortBy === "timestamp" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="py-3 px-4 text-center">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-800 hover:bg-gray-800 transition-all duration-300 animate-fade-in cursor-pointer"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <WhaleIcon className="w-6 h-6 text-blue-500" />
                          <span className="font-semibold text-blue-400">
                            {tx.tokenSymbol}
                          </span>
                        </div>
                      </td>
                      <td
                        className={`py-3 px-4 font-medium ${getTypeColor(
                          getTransactionType(tx)
                        )}`}
                      >
                        {getTransactionType(tx)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-200">
                        {tx.amountToken.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right text-green-400">
                        ${tx.amountUSD.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-gray-200">
                        <div className="flex items-center space-x-2">
                          {tx.fromAddress ? (
                            <>
                              <a
                                href={`https://basescan.org/address/${tx.fromAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {tx.fromAddress.slice(0, 6)}...
                                {tx.fromAddress.slice(-4)}
                              </a>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyAddress(tx.fromAddress);
                                }}
                                className="text-gray-500 hover:text-gray-300 p-1"
                                aria-label="Copy from address"
                              >
                                <FaCopy />
                              </button>
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-200">
                        <div className="flex items-center space-x-2">
                          {tx.toAddress ? (
                            <>
                              <a
                                href={`https://basescan.org/address/${tx.toAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {tx.toAddress.slice(0, 6)}...
                                {tx.toAddress.slice(-4)}
                              </a>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyAddress(tx.toAddress);
                                }}
                                className="text-gray-500 hover:text-gray-300 p-1"
                                aria-label="Copy to address"
                              >
                                <FaCopy />
                              </button>
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-200">
                        {tx.hash ? (
                          <a
                            href={`https://basescan.org/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-200">{tx.source || "-"}</td>
                      <td className="py-3 px-4 text-right text-gray-400">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(tx);
                          }}
                          className="text-gray-500 hover:text-gray-300 p-1"
                          aria-label="Share transaction"
                        >
                          <FaShareAlt />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="block sm:hidden space-y-4">
              {paginatedTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:bg-gray-700 transition-all duration-300 animate-fade-in cursor-pointer"
                  onClick={() => setSelectedTx(tx)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <WhaleIcon className="w-6 h-6 text-blue-500" />
                      <span className="font-semibold text-blue-400 text-sm">
                        {tx.tokenSymbol}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(tx);
                        }}
                        className="text-gray-500 hover:text-gray-300 p-1"
                        aria-label="Share transaction"
                      >
                        <FaShareAlt />
                      </button>
                      <span className="text-xs text-gray-400">
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Type:</span>{" "}
                      <span className={getTypeColor(getTransactionType(tx))}>
                        {getTransactionType(tx)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Amount:</span>{" "}
                      <span className="text-gray-200">
                        {tx.amountToken.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">USD Value:</span>{" "}
                      <span className="text-green-400">
                        ${tx.amountUSD.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Source:</span>{" "}
                      <span className="text-gray-200">{tx.source || "-"}</span>
                    </div>
                    {tx.eventType === "Swap" && tx.swapDetails && (
                      <>
                        <div>
                          <span className="text-gray-400">Swap In:</span>{" "}
                          <span className="text-gray-200">
                            {tx.swapDetails.amountIn.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            {tx.swapDetails.tokenIn}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Swap Out:</span>{" "}
                          <span className="text-gray-200">
                            {tx.swapDetails.amountOut.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            {tx.swapDetails.tokenOut}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="col-span-2">
                      <span className="text-gray-400">From:</span>{" "}
                      {tx.fromAddress ? (
                        <div className="flex items-center space-x-2 mt-1">
                          <a
                            href={`https://basescan.org/address/${tx.fromAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tx.fromAddress.slice(0, 6)}...
                            {tx.fromAddress.slice(-4)}
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAddress(tx.fromAddress);
                            }}
                            className="text-gray-500 hover:text-gray-300 p-1"
                            aria-label="Copy from address"
                          >
                            <FaCopy />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-200">-</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400">To:</span>{" "}
                      {tx.toAddress ? (
                        <div className="flex items-center space-x-2 mt-1">
                          <a
                            href={`https://basescan.org/address/${tx.toAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tx.toAddress.slice(0, 6)}...
                            {tx.toAddress.slice(-4)}
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAddress(tx.toAddress);
                            }}
                            className="text-gray-500 hover:text-gray-300 p-1"
                            aria-label="Copy to address"
                          >
                            <FaCopy />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-200">-</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400">Hash:</span>{" "}
                      {tx.hash ? (
                        <a
                          href={`https://basescan.org/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                        </a>
                      ) : (
                        <span className="text-gray-200">-</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}