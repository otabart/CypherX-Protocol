"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FaShareAlt,
  FaCopy,
  FaTimes,
  FaFilter,
  FaRedo,
  FaAngleLeft,
  FaAngleRight,
  FaExternalLinkAlt,
  FaChartLine,
  FaStar,
  FaSort,
  FaCoins,
  FaExchangeAlt,
  FaStore,
  FaClock,
  FaDollarSign,
  FaArrowLeft,
  FaPause,
  FaPlay,
  FaPercent,
} from "react-icons/fa";
import { GiWhaleTail } from "react-icons/gi";
import { motion, AnimatePresence } from "framer-motion";
import { debounce } from "lodash";

// Interface for whale transactions (aligned with backend)
interface WhaleTx {
  id?: string;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  amountToken: number;
  amountUSD: number;
  blockNumber: number;
  fromAddress: string;
  toAddress: string;
  source: string;
  timestamp: number;
  hash: string;
  eventType: "Transfer" | "Swap";
  swapDetails?: {
    amountIn: number;
    amountOut: number;
    tokenIn: string;
    tokenOut: string;
  };
  percentSupply: number;
}

// Whale Icon with Animation
function WhaleIcon({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <GiWhaleTail className={className} />
    </motion.div>
  );
}

// Loading Spinner with Whale Animation
function LoadingSpinner() {
  return (
    <motion.div
      className="flex justify-center items-center py-8"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <WhaleIcon className="w-12 h-12 text-[#66B0FF]" />
      </motion.div>
    </motion.div>
  );
}

// Skeleton Loader with Staggered Animation
function SkeletonLoader() {
  return (
    <motion.div
      className="space-y-3 w-full px-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="bg-[#1E2A44] rounded-lg p-4 animate-pulse flex flex-col space-y-2 border border-[#1E2A44] w-full"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.1 }}
        >
          <div className="h-3 bg-[#2A3655] rounded w-1/4" />
          <div className="h-3 bg-[#2A3655] rounded w-1/2" />
          <div className="h-3 bg-[#2A3655] rounded w-3/4" />
        </motion.div>
      ))}
    </motion.div>
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
  const [typeFilter, setTypeFilter] = useState<"all" | "Buy" | "Sell" | "Transfer" | "Swap">("all");
  const [minUSD, setMinUSD] = useState("");
  const [maxUSD, setMaxUSD] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "hour" | "day" | "week">("all");
  const [sortBy, setSortBy] = useState<keyof WhaleTx>("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedTx, setSelectedTx] = useState<WhaleTx | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [page, setPage] = useState(1);
  const [minPercentage, setMinPercentage] = useState("");
  const [exchangeFilter, setExchangeFilter] = useState<"all" | "Uniswap V3" | "Aerodrome" | "Base">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const transactionsPerPage = 20;
  const modalRef = useRef<HTMLDivElement>(null);

  // Debounced token filter
  const debouncedSetTokenFilter = useCallback(
    debounce((value: string) => {
      setTokenFilter(value);
      setFilterLoading(false);
    }, 300),
    []
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedTx) setSelectedTx(null);
        if (showFilters) setShowFilters(false);
      }
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        handleRefresh();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [selectedTx, showFilters]);

  // Focus trapping in modal
  useEffect(() => {
    if (selectedTx && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      first?.focus();
      const trap = (e: KeyboardEvent) => {
        if (e.key === "Tab") {
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      modalRef.current.addEventListener("keydown", trap);
      return () => modalRef.current?.removeEventListener("keydown", trap);
    }
  }, [selectedTx]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Start monitoring with retry logic
  useEffect(() => {
    if (!isClient || !liveUpdates) return;

    const startMonitoring = async (retries = 3, delayMs = 5000) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch("/api/whale-watchers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startMonitoring: true }),
          });
          const data = await res.json();
          console.log("Monitoring API response:", data);
          if (data.success) return;
          throw new Error(data.error || "Monitoring failed");
        } catch (err) {
          console.error(`Monitoring attempt ${i + 1} failed:`, err);
          if (i < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            setError("Failed to start monitoring. Please try again.");
          }
        }
      }
    };

    startMonitoring();
  }, [isClient, liveUpdates]);

  // Fetch transactions from Firestore
  useEffect(() => {
    if (!isClient || !liveUpdates) return;

    const q = query(collection(db, "whaleTransactions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txs: WhaleTx[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          const timestamp =
            data.timestamp instanceof Timestamp
              ? data.timestamp.toDate().getTime()
              : typeof data.timestamp === "number"
              ? data.timestamp
              : new Date().getTime();
          return {
            id: doc.id,
            tokenSymbol: data.tokenSymbol || "Unknown",
            tokenName: data.tokenName || "Unknown",
            tokenAddress: data.tokenAddress || "",
            amountToken: Number(data.amountToken) || 0,
            amountUSD: Number(data.amountUSD) || 0,
            blockNumber: Number(data.blockNumber) || 0,
            fromAddress: data.fromAddress || "",
            toAddress: data.toAddress || "",
            source: data.source || "Unknown",
            timestamp,
            hash: data.hash || "",
            eventType: data.eventType || "Transfer",
            swapDetails: data.swapDetails,
            percentSupply: Number(data.percentSupply) || 0,
          };
        });
        setTransactions(txs);
        setLoading(false);
        setLastUpdated(new Date());
        setError(null);
      },
      (error) => {
        console.error("Firestore onSnapshot error:", error);
        setError("Failed to load transactions. Please try refreshing.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isClient, liveUpdates]);

  // Apply filters and sorting
  useEffect(() => {
    if (!isClient) return;
    setFilterLoading(true);
    let filtered = [...transactions];

    if (tokenFilter) {
      filtered = filtered.filter((tx) =>
        tx.tokenSymbol.toLowerCase().includes(tokenFilter.toLowerCase())
      );
    }
    if (typeFilter !== "all") {
      filtered = filtered.filter((tx) => getTransactionType(tx) === typeFilter);
    }
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
    const now = Date.now();
    if (timeFilter === "hour") {
      filtered = filtered.filter((tx) => now - tx.timestamp <= 60 * 60 * 1000);
    } else if (timeFilter === "day") {
      filtered = filtered.filter((tx) => now - tx.timestamp <= 24 * 60 * 60 * 1000);
    } else if (timeFilter === "week") {
      filtered = filtered.filter((tx) => now - tx.timestamp <= 7 * 24 * 60 * 1000);
    }
    if (minPercentage) {
      const min = parseFloat(minPercentage);
      if (!isNaN(min)) {
        filtered = filtered.filter((tx) => tx.percentSupply >= min);
      }
    }
    if (exchangeFilter !== "all") {
      filtered = filtered.filter((tx) => tx.source === exchangeFilter);
    }

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
    setTimeout(() => setFilterLoading(false), 300);
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

  const handleCopyAddress = (address: string) => {
    if (address && navigator.clipboard) {
      navigator.clipboard.writeText(address).then(() => {
        alert("Address copied to clipboard!");
      }).catch((err) => {
        console.error("Failed to copy address:", err);
      });
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
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        alert("Transaction details copied to clipboard!");
      }).catch((err) => {
        console.error("Failed to copy share text:", err);
      });
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whale-watchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startMonitoring: true }),
      });
      if (!res.ok) throw new Error("Failed to refresh monitoring");
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Refresh failed:", err);
      setError("Failed to refresh data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setTokenFilter("");
    setTypeFilter("all");
    setMinUSD("");
    setMaxUSD("");
    setTimeFilter("all");
    setMinPercentage("");
    setExchangeFilter("all");
    debouncedSetTokenFilter("");
  };

  const applyQuickFilter = (filter: {
    minUSD?: string;
    timeFilter?: "all" | "hour" | "day" | "week";
  }) => {
    setMinUSD(filter.minUSD || "");
    setTimeFilter(filter.timeFilter || "all");
    setFilterLoading(true);
    setTimeout(() => setFilterLoading(false), 300);
  };

  const getTransactionType = (tx: WhaleTx): "Buy" | "Sell" | "Transfer" | "Swap" => {
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
    return tx.eventType;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Sell":
        return "text-red-400";
      case "Buy":
        return "text-green-400";
      case "Transfer":
      case "Swap":
        return "text-[#66B0FF]";
      default:
        return "text-gray-400";
    }
  };

  const getImpactLabel = (tx: WhaleTx) => {
    if (tx.percentSupply > 5 || tx.amountUSD > 5000000) {
      return { label: "High Impact", color: "text-yellow-400 border-yellow-400" };
    }
    if (tx.percentSupply > 2 || tx.amountUSD > 1000000) {
      return { label: "Medium Impact", color: "text-orange-400 border-orange-400" };
    }
    return null;
  };

  const activeFilters = [
    tokenFilter && `Token: ${tokenFilter}`,
    typeFilter !== "all" && `Type: ${typeFilter}`,
    minUSD && `Min USD: $${minUSD}`,
    maxUSD && `Max USD: $${maxUSD}`,
    timeFilter !== "all" && `Time: Last ${timeFilter}`,
    minPercentage && `Min %: ${minPercentage}%`,
    exchangeFilter !== "all" && `Exchange: ${exchangeFilter}`,
  ].filter(Boolean);

  const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (page - 1) * transactionsPerPage,
    page * transactionsPerPage
  );

  const handlePageJump = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= totalPages) {
      setPage(value);
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-screen w-full bg-[#0A0F1C] text-white font-sans overflow-x-hidden overflow-y-auto flex flex-col">
      <style jsx>{`
        html, body {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
        }
        ::-webkit-scrollbar {
          display: none;
        }
        html {
          scrollbar-width: none;
        }
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        .animate-bounce {
          animation: bounce 1s infinite;
        }
        .font-sans {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        button:focus, a:focus, input:focus, select:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(102, 176, 255, 0.3);
        }
      `}</style>

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {selectedTx && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-3 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              ref={modalRef}
              className="bg-[#1E2A44] rounded-lg w-full max-w-md border border-[#1E2A44] max-h-[80vh] overflow-y-auto shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center bg-[#2A3655] text-white p-3 sticky top-0 border-b border-[#1E2A44]">
                <span className="text-sm font-semibold text-[#66B0FF] uppercase">Transaction Details</span>
                <motion.button
                  onClick={() => setSelectedTx(null)}
                  className="text-gray-400 hover:text-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] p-1 rounded"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FaTimes size={16} />
                </motion.button>
              </div>
              <div className="p-3 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Token:</span>
                  <span className="text-[#66B0FF] font-medium">{selectedTx.tokenSymbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Type:</span>
                  <span className={getTypeColor(getTransactionType(selectedTx))}>
                    {getTransactionType(selectedTx)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-white">
                    {selectedTx.amountToken.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">USD Value:</span>
                  <span className="text-green-400">
                    ${selectedTx.amountUSD.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Percent Supply:</span>
                  <span className="text-white">
                    {selectedTx.percentSupply.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Block Number:</span>
                  <span className="text-white">{selectedTx.blockNumber}</span>
                </div>
                {selectedTx.eventType === "Swap" && selectedTx.swapDetails && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Swap Input:</span>
                      <span className="text-white">
                        {selectedTx.swapDetails.amountIn.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {selectedTx.swapDetails.tokenIn}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Swap Output:</span>
                      <span className="text-white">
                        {selectedTx.swapDetails.amountOut.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {selectedTx.swapDetails.tokenOut}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">From:</span>
                  <a
                    href={`https://basescan.org/address/${selectedTx.fromAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#66B0FF] hover:text-[#88CFFF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] rounded transition"
                  >
                    {selectedTx.fromAddress.slice(0, 6)}...{selectedTx.fromAddress.slice(-4)}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">To:</span>
                  <a
                    href={`https://basescan.org/address/${selectedTx.toAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#66B0FF] hover:text-[#88CFFF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] rounded transition"
                  >
                    {selectedTx.toAddress.slice(0, 6)}...{selectedTx.toAddress.slice(-4)}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Hash:</span>
                  <a
                    href={`https://basescan.org/tx/${selectedTx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#66B0FF] hover:text-[#88CFFF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] rounded transition"
                  >
                    {selectedTx.hash.slice(0, 6)}...{selectedTx.hash.slice(-4)}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Source:</span>
                  <span className="text-white">{selectedTx.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Timestamp:</span>
                  <span className="text-white">{new Date(selectedTx.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 p-3 pt-0">
                <motion.a
                  href={`https://basescan.org/tx/${selectedTx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all flex items-center justify-center gap-1 border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaExternalLinkAlt size={14} /> View on Basescan
                </motion.a>
                <motion.button
                  onClick={() => handleShare(selectedTx)}
                  className="flex-1 px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all flex items-center justify-center gap-1 border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaShareAlt size={14} /> Share
                </motion.button>
                <motion.button
                  onClick={() => setSelectedTx(null)}
                  className="flex-1 px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        className="bg-[#0A0F1C] w-full py-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-1 sticky top-0 z-20 shadow-[0_4px_12px_rgba(0,0,0,0.5)] border-b border-[#1E2A44]"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center space-x-1">
            <WhaleIcon className="w-5 h-5 text-[#66B0FF]" />
            <h1 className="text-xl font-bold text-white tracking-tight uppercase">
              Whale Watcher
            </h1>
          </div>
        </div>

        <div className="flex items-center justify-center sm:justify-end gap-1 sm:gap-2 w-full sm:w-auto">
          <div className="flex gap-1">
            <motion.button
              onClick={() => router.back()}
              className="p-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Go back"
            >
              <FaArrowLeft size={12} />
            </motion.button>
            <motion.button
              onClick={handleRefresh}
              className="p-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all flex items-center justify-center border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Refresh data"
            >
              <FaRedo size={12} />
            </motion.button>
            <motion.button
              onClick={() => setLiveUpdates(!liveUpdates)}
              className={`p-1 rounded-lg text-xs transition-all flex items-center justify-center border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md ${
                liveUpdates
                  ? "bg-[#1652F0] hover:bg-[#66B0FF] text-white"
                  : "bg-[#1E2A44] hover:bg-[#2A3655] text-gray-400"
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label={liveUpdates ? "Pause live updates" : "Resume live updates"}
            >
              {liveUpdates ? <FaPause size={12} /> : <FaPlay size={12} />}
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Desktop Filter Bar */}
      <motion.div
        className="hidden sm:flex items-center justify-between bg-[#0A0F1C] px-4 py-3 border-b border-[#1E2A44]"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-2">
          <div className="relative group">
            <select
              value={tokenFilter}
              onChange={(e) => {
                setFilterLoading(true);
                debouncedSetTokenFilter(e.target.value);
              }}
              className="pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm transition-all"
              aria-label="Filter by token symbol"
            >
              <option value="">All Tokens</option>
              {[...new Set(transactions.map((tx) => tx.tokenSymbol))].map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
            <FaCoins className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
          </div>

          <div className="relative group">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "Buy" | "Sell" | "Transfer" | "Swap")}
              className="pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm transition-all"
              aria-label="Filter by transaction type"
            >
              <option value="all">All Types</option>
              <option value="Buy">Buy</option>
              <option value="Sell">Sell</option>
              <option value="Transfer">Transfer</option>
              <option value="Swap">Swap</option>
            </select>
            <FaExchangeAlt className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
          </div>

          <div className="relative group">
            <select
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value as "all" | "Uniswap V3" | "Aerodrome" | "Base")}
              className="pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm transition-all"
              aria-label="Filter by exchange"
            >
              <option value="all">All Exchanges</option>
              <option value="Uniswap V3">Uniswap V3</option>
              <option value="Aerodrome">Aerodrome</option>
              <option value="Base">Base</option>
            </select>
            <FaStore className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
          </div>

          <div className="relative group">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as "all" | "hour" | "day" | "week")}
              className="pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm transition-all"
              aria-label="Filter by time range"
            >
              <option value="all">All Time</option>
              <option value="hour">Last Hour</option>
              <option value="day">Last Day</option>
              <option value="week">Last Week</option>
            </select>
            <FaClock className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
          </div>

          <div className="relative group">
            <input
              type="number"
              placeholder="Min USD"
              value={minUSD}
              onChange={(e) => setMinUSD(e.target.value)}
              className="pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 w-24 transition-all"
              aria-label="Minimum USD value"
            />
            <FaDollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
          </div>

          <div className="relative group">
            <input
              type="number"
              placeholder="Min % Supply"
              value={minPercentage}
              onChange={(e) => setMinPercentage(e.target.value)}
              className="pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 w-24 transition-all"
              aria-label="Minimum percentage of token supply"
            />
            <FaPercent className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
          </div>
        </div>

        <motion.button
          onClick={handleResetFilters}
          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-all flex items-center gap-1 border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-red-500 shadow-md"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FaRedo size={14} /> Reset
        </motion.button>
      </motion.div>

      {/* Main Content */}
      <main className="flex-1 w-full flex flex-col">
        {/* Mobile Filter Bottom Sheet */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              className="sm:hidden fixed inset-0 bg-black bg-opacity-80 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setShowFilters(false)}
            >
              <motion.div
                className="absolute bottom-0 w-full bg-[#1E2A44] p-4 border-t border-[#1E2A44] overflow-y-auto max-h-[80vh]"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-base font-semibold text-[#66B0FF] uppercase">Filters</h2>
                  <motion.button
                    onClick={() => setShowFilters(false)}
                    className="text-gray-400 hover:text-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] p-1 rounded"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <FaTimes size={16} />
                  </motion.button>
                </div>
                <div className="space-y-3">
                  <div className="relative group">
                    <label htmlFor="token-filter-mobile" className="text-xs text-gray-400 mb-1 block">
                      Token
                    </label>
                    <select
                      id="token-filter-mobile"
                      value={tokenFilter}
                      onChange={(e) => {
                        setFilterLoading(true);
                        debouncedSetTokenFilter(e.target.value);
                      }}
                      className="w-full pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm transition-all"
                      aria-label="Filter by token symbol"
                    >
                      <option value="">All Tokens</option>
                      {[...new Set(transactions.map((tx) => tx.tokenSymbol))].map((token) => (
                        <option key={token} value={token}>
                          {token}
                        </option>
                      ))}
                    </select>
                    <FaCoins className="absolute left-2 top-8 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
                  </div>
                  <div className="relative group">
                    <label htmlFor="type-filter-mobile" className="text-xs text-gray-400 mb-1 block">
                      Type
                    </label>
                    <select
                      id="type-filter-mobile"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as "all" | "Buy" | "Sell" | "Transfer" | "Swap")}
                      className="w-full pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm transition-all"
                      aria-label="Filter by transaction type"
                    >
                      <option value="all">All Types</option>
                      <option value="Buy">Buy</option>
                      <option value="Sell">Sell</option>
                      <option value="Transfer">Transfer</option>
                      <option value="Swap">Swap</option>
                    </select>
                    <FaExchangeAlt className="absolute left-2 top-8 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
                  </div>
                  <div className="relative group">
                    <label htmlFor="exchange-filter-mobile" className="text-xs text-gray-400 mb-1 block">
                      Exchange
                    </label>
                    <select
                      id="exchange-filter-mobile"
                      value={exchangeFilter}
                      onChange={(e) => setExchangeFilter(e.target.value as "all" | "Uniswap V3" | "Aerodrome" | "Base")}
                      className="w-full pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm transition-all"
                      aria-label="Filter by exchange"
                    >
                      <option value="all">All Exchanges</option>
                      <option value="Uniswap V3">Uniswap V3</option>
                      <option value="Aerodrome">Aerodrome</option>
                      <option value="Base">Base</option>
                    </select>
                    <FaStore className="absolute left-2 top-8 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
                  </div>
                  <div className="relative group">
                    <label htmlFor="time-filter-mobile" className="text-xs text-gray-400 mb-1 block">
                      Time Range
                    </label>
                    <select
                      id="time-filter-mobile"
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value as "all" | "hour" | "day" | "week")}
                      className="w-full pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm transition-all"
                      aria-label="Filter by time range"
                    >
                      <option value="all">All Time</option>
                      <option value="hour">Last Hour</option>
                      <option value="day">Last Day</option>
                      <option value="week">Last Week</option>
                    </select>
                    <FaClock className="absolute left-2 top-8 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
                  </div>
                  <div className="relative group">
                    <label htmlFor="min-usd-mobile" className="text-xs text-gray-400 mb-1 block">
                      Min USD
                    </label>
                    <input
                      id="min-usd-mobile"
                      type="number"
                      placeholder="e.g., 1000"
                      value={minUSD}
                      onChange={(e) => setMinUSD(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 transition-all"
                      aria-label="Minimum USD value"
                    />
                    <FaDollarSign className="absolute left-2 top-8 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
                  </div>
                  <div className="relative group">
                    <label htmlFor="min-percentage-mobile" className="text-xs text-gray-400 mb-1 block">
                      Min % Supply
                    </label>
                    <input
                      id="min-percentage-mobile"
                      type="number"
                      placeholder="e.g., 1"
                      value={minPercentage}
                      onChange={(e) => setMinPercentage(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 transition-all"
                      aria-label="Minimum percentage of token supply"
                    />
                    <FaPercent className="absolute left-2 top-8 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF] transition-all" size={14} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <motion.button
                    onClick={() => applyQuickFilter({ minUSD: "1000" })}
                    className="px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Low Value (>$1K)
                  </motion.button>
                  <motion.button
                    onClick={() => applyQuickFilter({ timeFilter: "hour" })}
                    className="px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Last Hour
                  </motion.button>
                  <motion.button
                    onClick={handleResetFilters}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs transition-all flex items-center gap-1 border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-red-500 shadow-md"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaRedo size={14} /> Reset Filters
                  </motion.button>
                </div>
                {lastUpdated && (
                  <p className="text-xs text-gray-400 text-right mt-2">
                    Last Updated: {lastUpdated.toLocaleString()}
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Transactions Area */}
        <div className="flex-1 w-full overflow-y-auto">
          {/* Active Filters Summary */}
          {activeFilters.length > 0 && (
            <motion.div
              className="flex flex-wrap gap-2 p-3 bg-[#0A0F1C] w-full border-b border-[#1E2A44]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-xs text-gray-400">Active Filters:</span>
              {activeFilters.map((filter, index) => (
                <motion.span
                  key={index}
                  className="px-2 py-1 bg-[#1652F0] text-white rounded-full text-xs"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2, delay: index * 0.1 }}
                >
                  {filter}
                </motion.span>
              ))}
              <motion.button
                onClick={handleResetFilters}
                className="px-2 py-1 bg-red-500 text-white rounded-full text-xs flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-red-500"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Clear All <FaTimes size={12} />
              </motion.button>
            </motion.div>
          )}

          {/* Filter Loading Indicator */}
          {filterLoading && (
            <motion.div
              className="text-center py-2 text-[#66B0FF] text-sm animate-pulse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              Applying filters...
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              className="bg-red-500/20 border border-red-500 text-red-400 text-center py-3 rounded-lg mx-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {error}
              <motion.button
                onClick={handleRefresh}
                className="ml-2 text-red-300 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FaRedo size={14} />
              </motion.button>
            </motion.div>
          )}

          {/* Loading State */}
          {loading && !filteredTransactions.length && <SkeletonLoader />}
          {loading && filteredTransactions.length > 0 && <LoadingSpinner />}

          {/* No Transactions */}
          {!loading && filteredTransactions.length === 0 && (
            <motion.p
              className="text-gray-400 text-center py-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              No whale transactions found. Try adjusting filters or refreshing.
            </motion.p>
          )}

          {/* Transactions */}
          {!loading && filteredTransactions.length > 0 && (
            <>
              {/* Desktop Card Grid with Sorting Headers */}
              <motion.div
                className="hidden sm:block p-4 w-full max-w-7xl mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 mb-3">
                  <div className="col-span-full flex justify-between text-xs text-gray-400 bg-[#1E2A44] p-2 rounded-lg border border-[#1E2A44] shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                    <button
                      onClick={() => handleSort("tokenSymbol")}
                      className="flex items-center gap-1 hover:text-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF]"
                    >
                      Token
                      {sortBy === "tokenSymbol" && (
                        <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                      )}
                    </button>
                    <button
                      onClick={() => handleSort("eventType")}
                      className="flex items-center gap-1 hover:text-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF]"
                    >
                      Type
                      {sortBy === "eventType" && (
                        <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                      )}
                    </button>
                    <button
                      onClick={() => handleSort("amountUSD")}
                      className="flex items-center gap-1 hover:text-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF]"
                    >
                      USD Value
                      {sortBy === "amountUSD" && (
                        <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                      )}
                    </button>
                    <button
                      onClick={() => handleSort("timestamp")}
                      className="flex items-center gap-1 hover:text-[#66B0FF] focus:outline-none focus:ring-2 focus:ring-[#66B0FF]"
                    >
                      Time
                      {sortBy === "timestamp" && (
                        <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                  {paginatedTransactions.map((tx, index) => {
                    const impact = getImpactLabel(tx);
                    return (
                      <motion.div
                        key={tx.id}
                        className={`relative bg-[#1E2A44] rounded-lg p-4 border border-[#1E2A44] transition-all duration-200 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-[#2A3655] hover:border-[#66B0FF] ${
                          impact ? `${impact.color} border-opacity-50` : ""
                        }`}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        whileHover={{ scale: 1.03 }}
                        onClick={() => setSelectedTx(tx)}
                      >
                        <div className="absolute inset-0 bg-[#66B0FF]/10 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-[#66B0FF]/20 rounded-full flex items-center justify-center">
                              <WhaleIcon className="w-4 h-4 text-[#66B0FF]" />
                            </div>
                            <span className="font-bold text-[#66B0FF] text-base">
                              {tx.tokenSymbol}
                            </span>
                            {impact && (
                              <span className={`text-xs ${impact.color} border ${impact.color} border-opacity-50 rounded-full px-2 py-0.5`}>
                                {impact.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <motion.button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShare(tx);
                              }}
                              className="text-gray-400 hover:text-[#66B0FF] p-1 focus:outline-none focus:ring-2 focus:ring-[#66B0FF] rounded"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <FaShareAlt size={14} />
                            </motion.button>
                            <span className="text-xs text-gray-400">
                              {new Date(tx.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Type:</span>
                            <span className={getTypeColor(getTransactionType(tx))}>
                              {getTransactionType(tx)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Amount:</span>
                            <span className="text-white">
                              {tx.amountToken.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">USD Value:</span>
                            <span className="text-green-400">
                              ${tx.amountUSD.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Percent Supply:</span>
                            <span className="text-white">
                              {tx.percentSupply.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Source:</span>
                            <span className="text-white">{tx.source}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert("View Chart functionality coming soon!");
                            }}
                            className="flex-1 px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all flex items-center justify-center gap-1 border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <FaChartLine size={14} /> Chart
                          </motion.button>
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert("Added to watchlist!");
                            }}
                            className="flex-1 px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all flex items-center justify-center gap-1 border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <FaStar size={14} /> Watchlist
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Mobile Cards */}
              <motion.div
                className="block sm:hidden space-y-4 p-4 w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {paginatedTransactions.map((tx, index) => {
                  const impact = getImpactLabel(tx);
                  const isExpanded = expandedCard === tx.id;
                  return (
                    <motion.div
                      key={tx.id}
                      className={`relative bg-[#1E2A44] rounded-lg p-4 border border-[#1E2A44] transition-all duration-200 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-[#2A3655] hover:border-[#66B0FF] ${
                        impact ? `${impact.color} border-opacity-50` : ""
                      }`}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      whileHover={{ scale: 1.03 }}
                      onClick={() => setExpandedCard(isExpanded ? null : tx.id!)}
                    >
                      <div className="absolute inset-0 bg-[#66B0FF]/10 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-[#66B0FF]/20 rounded-full flex items-center justify-center">
                            <WhaleIcon className="w-4 h-4 text-[#66B0FF]" />
                          </div>
                          <span className="font-bold text-[#66B0FF] text-base">
                            {tx.tokenSymbol}
                          </span>
                          {impact && (
                            <span className={`text-xs ${impact.color} border ${impact.color} border-opacity-50 rounded-full px-2 py-0.5`}>
                              {impact.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShare(tx);
                            }}
                            className="text-gray-400 hover:text-[#66B0FF] p-1 focus:outline-none focus:ring-2 focus:ring-[#66B0FF] rounded"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <FaShareAlt size={14} />
                          </motion.button>
                          <span className="text-xs text-gray-400">
                            {new Date(tx.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Type:</span>
                          <span className={getTypeColor(getTransactionType(tx))}>
                            {getTransactionType(tx)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amount:</span>
                          <span className="text-white">
                            {tx.amountToken.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">USD Value:</span>
                          <span className="text-green-400">
                            ${tx.amountUSD.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Percent Supply:</span>
                          <span className="text-white">
                            {tx.percentSupply.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Source:</span>
                          <span className="text-white">{tx.source}</span>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="space-y-2 mt-2"
                            >
                              {tx.eventType === "Swap" && tx.swapDetails && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Swap In:</span>
                                    <span className="text-white">
                                      {tx.swapDetails.amountIn.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{" "}
                                      {tx.swapDetails.tokenIn}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Swap Out:</span>
                                    <span className="text-white">
                                      {tx.swapDetails.amountOut.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{" "}
                                      {tx.swapDetails.tokenOut}
                                    </span>
                                  </div>
                                </>
                              )}
                              <div>
                                <span className="text-gray-400">Block Number:</span>
                                <span className="text-white">{tx.blockNumber}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">From:</span>
                                <div className="flex items-center space-x-1 mt-1">
                                  <a
                                    href={`https://basescan.org/address/${tx.fromAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#66B0FF] hover:text-[#88CFFF] truncate focus:outline-none focus:ring-2 focus:ring-[#66B0FF] rounded transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {tx.fromAddress.slice(0, 6)}...{tx.fromAddress.slice(-4)}
                                  </a>
                                  <motion.button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyAddress(tx.fromAddress);
                                    }}
                                    className="text-gray-400 hover:text-[#66B0FF] p-1 focus:outline-none focus:ring-2 focus:ring-[#66B0FF] rounded"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                  >
                                    <FaCopy size={14} />
                                  </motion.button>
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-400">To:</span>
                                <div className="flex items-center space-x-1 mt-1">
                                  <a
                                    href={`https://basescan.org/address/${tx.toAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#66B0FF] hover:text-[#88CFFF] truncate focus:outline-none focus:ring-2 focus:ring-[#66B0FF] rounded transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {tx.toAddress.slice(0, 6)}...{tx.toAddress.slice(-4)}
                                  </a>
                                  <motion.button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyAddress(tx.toAddress);
                                    }}
                                    className="text-gray-400 hover:text-[#66B0FF] p-1 focus:outline-none focus:ring-2 focus:ring-[#66B0FF] rounded"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                  >
                                    <FaCopy size={14} />
                                  </motion.button>
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-400">Hash:</span>
                                <div className="mt-1">
                                  <a
                                    href={`https://basescan.org/tx/${tx.hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#66B0FF] hover:text-[#88CFFF] truncate focus:outline-none focus:ring-2 focus:ring-[#66B0FF] rounded transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                                  </a>
                                </div>
                              </div>
                              <div className="flex gap-2 mt-3">
                                <motion.button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    alert("View Chart functionality coming soon!");
                                  }}
                                  className="flex-1 px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all flex items-center justify-center gap-1 border border-[#1E2A44] focusbearer:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <FaChartLine size={14} /> Chart
                                </motion.button>
                                <motion.button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    alert("Added to watchlist!");
                                  }}
                                  className="flex-1 px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all flex items-center justify-center gap-1 border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <FaStar size={14} /> Watchlist
                                </motion.button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Pagination */}
              {totalPages > 1 && (
                <motion.div
                  className="flex items-center justify-center space-x-2 p-3 w-full bg-[#0A0F1C] border-t border-[#1E2A44]"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all flex items-center justify-center gap-1 border border-[#1E2A44] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaAngleLeft size={14} /> Prev
                  </motion.button>
                  <div className="flex items-center space-x-1 text-xs text-gray-400">
                    <span>Page</span>
                    <input
                      type="number"
                      value={page}
                      onChange={handlePageJump}
                      className="w-12 px-1 py-0.5 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] focus:outline-none focus:ring-2 focus:ring-[#66B0FF] text-center"
                      aria-label="Current page number"
                    />
                    <span>of {totalPages}</span>
                  </div>
                  <motion.button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs transition-all flex items-center justify-center gap-1 border border-[#1E2A44] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Next <FaAngleRight size={14} />
                  </motion.button>
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Floating Action Button (Mobile) */}
      <motion.button
        onClick={() => setShowFilters(true)}
        className="sm:hidden fixed bottom-4 right-4 p-3 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-[#66B0FF] animate-bounce"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Open filters menu"
      >
        <FaFilter size={16} />
      </motion.button>
    </div>
  );
}