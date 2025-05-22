"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FaShareAlt,
  FaTimes,
  FaSort,
  FaCoins,
  FaExchangeAlt,
  FaStore,
  FaClock,
  FaDollarSign,
  FaPercent,
  FaAngleLeft,
  FaAngleRight,
} from "react-icons/fa";
import { GiWhaleTail } from "react-icons/gi";
import { motion, AnimatePresence } from "framer-motion";
import { debounce } from "lodash";
import Footer from "../components/Footer";

// Interface for whale transactions
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

// Loading Spinner
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

// Skeleton Loader
function SkeletonLoader() {
  return (
    <motion.div
      className="space-y-3 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="bg-[#1E2A44] rounded-lg p-4 animate-pulse flex space-x-2 border border-[#1E2A44] w-full"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.1 }}
        >
          <div className="h-3 bg-[#2A3655] rounded w-1/6" />
          <div className="h-3 bg-[#2A3655] rounded w-1/6" />
          <div className="h-3 bg-[#2A3655] rounded w-1/6" />
          <div className="h-3 bg-[#2A3655] rounded w-1/6" />
          <div className="h-3 bg-[#2A3655] rounded w-1/6" />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default function WhaleWatcherPage() {
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
  const [headerHeight, setHeaderHeight] = useState(0);
  const [filterBarHeight, setFilterBarHeight] = useState(0);
  const [activeFiltersHeight, setActiveFiltersHeight] = useState(0);
  const [filterLoadingHeight, setFilterLoadingHeight] = useState(0);
  const transactionsPerPage = 20;
  const modalRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const activeFiltersRef = useRef<HTMLDivElement>(null);
  const filterLoadingRef = useRef<HTMLDivElement>(null);

  // Moved activeFilters declaration up here
  const activeFilters = [
    tokenFilter && `Token: ${tokenFilter}`,
    typeFilter !== "all" && `Type: ${typeFilter}`,
    minUSD && `Min USD: $${minUSD}`,
    maxUSD && `Max USD: $${maxUSD}`,
    timeFilter !== "all" && `Time: Last ${timeFilter}`,
    minPercentage && `Min %: ${minPercentage}%`,
    exchangeFilter !== "all" && `Exchange: ${exchangeFilter}`,
  ].filter(Boolean);

  // Debounced token filter
  const debouncedSetTokenFilter = useCallback(
    debounce((value: string) => {
      setTokenFilter(value);
      setFilterLoading(false);
    }, 300),
    []
  );

  // Measure the height of the header, filter bar, active filters, and filter loading indicator
  useEffect(() => {
    const updateHeights = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
      if (filterBarRef.current) {
        setFilterBarHeight(filterBarRef.current.offsetHeight);
      }
      if (activeFiltersRef.current) {
        setActiveFiltersHeight(activeFiltersRef.current.offsetHeight);
      } else {
        setActiveFiltersHeight(0);
      }
      if (filterLoadingRef.current) {
        setFilterLoadingHeight(filterLoadingRef.current.offsetHeight);
      } else {
        setFilterLoadingHeight(0);
      }
    };

    updateHeights();
    window.addEventListener("resize", updateHeights);
    return () => window.removeEventListener("resize", updateHeights);
  }, [activeFilters, filterLoading]); // Now safe to use activeFilters here

  // Calculate the top position for the table header
  const calculateTableHeaderTop = () => {
    const baseHeight = headerHeight + (window.innerWidth >= 640 ? filterBarHeight : 0);
    const additionalHeight = activeFiltersHeight + filterLoadingHeight;
    return baseHeight + additionalHeight;
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedTx) setSelectedTx(null);
        if (showFilters) setShowFilters(false);
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

  // Set client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Start monitoring
  useEffect(() => {
    if (!isClient) return;

    const startMonitoring = async (retries = 3, delayMs = 5000) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch("/api/whale-watchers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startMonitoring: true }),
          });
          const data = await res.json();
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
  }, [isClient]);

  // Fetch transactions from Firestore
  useEffect(() => {
    if (!isClient) return;

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
      (err) => {
        console.error("Firestore onSnapshot error:", err);
        setError("Failed to load transactions. Please try again.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isClient]);

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
      filtered = filtered.filter((tx) => now - tx.timestamp <= 7 * 24 * 60 * 60 * 1000);
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
      return sortOrder === "asc" ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1;
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
      navigator.clipboard
        .writeText(shareText)
        .then(() => alert("Transaction details copied to clipboard!"))
        .catch((err) => console.error("Failed to copy share text:", err));
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
      if (stablecoinSymbols.includes(tokenIn)) return "Buy";
      if (stablecoinSymbols.includes(tokenOut)) return "Sell";
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
    <div className="min-h-screen w-full bg-[#0A0F1C] text-white font-sans flex flex-col">
      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          width: 100%;
          overflow-x: hidden;
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #0a0f1c;
        }
        ::-webkit-scrollbar-thumb {
          background: #66b0ff;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #88cfff;
        }
        html {
          scrollbar-width: thin;
          scrollbar-color: #66b0ff #0a0f1c;
        }
        @keyframes bounce {
          0%,
          100% {
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
          font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
            Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
        }
        button:focus,
        a:focus,
        input:focus,
        select:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(102, 176, 255, 0.3);
        }
      `}</style>

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {selectedTx && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              ref={modalRef}
              className="bg-[#1E2A44] rounded-lg w-full max-w-md border border-[#1E2A44] max-h-[80vh] overflow-y-auto shadow-xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center bg-[#2A3655] text-white p-3 sticky top-0 border-b border-[#1E2A44]">
                <span className="text-sm font-semibold text-[#66B0FF] uppercase">Transaction Details</span>
                <motion.button
                  onClick={() => setSelectedTx(null)}
                  className="text-gray-400 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] p-1 rounded"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FaTimes size={16} />
                </motion.button>
              </div>
              <div className="p-4 text-xs space-y-3">
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
                  <span className="text-white">{selectedTx.percentSupply.toFixed(2)}%</span>
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
                    className="text-[#66B0FF] hover:text-[#88CFFF] focus:ring-2 focus:ring-[#66B0FF] rounded"
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
                    className="text-[#66B0FF] hover:text-[#88CFFF] focus:ring-2 focus:ring-[#66B0FF] rounded"
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
                    className="text-[#66B0FF] hover:text-[#88CFFF] focus:ring-2 focus:ring-[#66B0FF] rounded"
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
              <div className="flex flex-col sm:flex-row gap-2 p-4 pt-0">
                <motion.a
                  href={`https://basescan.org/tx/${selectedTx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs flex items-center justify-center gap-2 border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaShareAlt size={14} /> View on Basescan
                </motion.a>
                <motion.button
                  onClick={() => handleShare(selectedTx)}
                  className="flex-1 px-4 py-2 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs flex items-center justify-center gap-2 border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaShareAlt size={14} /> Share
                </motion.button>
                <motion.button
                  onClick={() => setSelectedTx(null)}
                  className="flex-1 px-4 py-2 bg-[#1E2A44] hover:bg-[#2A3655] text-white rounded-lg text-xs border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
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
        ref={headerRef}
        className="bg-[#0A0F1C] w-full py-4 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 border-b border-[#1E2A44] shadow-md"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        <div className="flex items-center space-x-2">
          <WhaleIcon className="w-6 h-6 text-[#66B0FF]" />
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase">Whale Watcher</h1>
        </div>
      </motion.header>

      {/* Desktop Filter Bar */}
      <motion.div
        ref={filterBarRef}
        className="hidden sm:flex items-center justify-between bg-[#0A0F1C] px-4 sm:px-6 py-4 border-b border-[#1E2A44]"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative group">
            <select
              value={tokenFilter}
              onChange={(e) => {
                setFilterLoading(true);
                debouncedSetTokenFilter(e.target.value);
              }}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm"
              aria-label="Filter by token symbol"
            >
              <option value="">All Tokens</option>
              {[...new Set(transactions.map((tx) => tx.tokenSymbol))].map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
            <FaCoins className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
          <div className="relative group">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "Buy" | "Sell" | "Transfer" | "Swap")}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm"
              aria-label="Filter by transaction type"
            >
              <option value="all">All Types</option>
              <option value="Buy">Buy</option>
              <option value="Sell">Sell</option>
              <option value="Transfer">Transfer</option>
              <option value="Swap">Swap</option>
            </select>
            <FaExchangeAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
          <div className="relative group">
            <select
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value as "all" | "Uniswap V3" | "Aerodrome" | "Base")}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm"
              aria-label="Filter by exchange"
            >
              <option value="all">All Exchanges</option>
              <option value="Uniswap V3">Uniswap V3</option>
              <option value="Aerodrome">Aerodrome</option>
              <option value="Base">Base</option>
            </select>
            <FaStore className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
          <div className="relative group">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as "all" | "hour" | "day" | "week")}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm"
              aria-label="Filter by time range"
            >
              <option value="all">All Time</option>
              <option value="hour">Last Hour</option>
              <option value="day">Last Day</option>
              <option value="week">Last Week</option>
            </select>
            <FaClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
          <div className="relative group">
            <input
              type="number"
              placeholder="Min USD"
              value={minUSD}
              onChange={(e) => setMinUSD(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 w-28"
              aria-label="Minimum USD value"
            />
            <FaDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
          <div className="relative group">
            <input
              type="number"
              placeholder="Min % Supply"
              value={minPercentage}
              onChange={(e) => setMinPercentage(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 w-28"
              aria-label="Minimum percentage of token supply"
            />
            <FaPercent className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
        </div>
        <motion.button
          onClick={handleResetFilters}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm flex items-center gap-2 border border-[#1E2A44] focus:ring-2 focus:ring-red-500 shadow-md"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FaTimes size={14} /> Reset
        </motion.button>
      </motion.div>

      {/* Main Content */}
      <main className="flex-1 w-full pb-6">
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
                className="absolute bottom-0 w-full bg-[#1E2A44] p-4 sm:p-6 border-t border-[#1E2A44] rounded-t-xl max-h-[80vh] overflow-y-auto"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-[#66B0FF] uppercase">Filters</h2>
                  <motion.button
                    onClick={() => setShowFilters(false)}
                    className="text-gray-400 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] p-1 rounded"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <FaTimes size={18} />
                  </motion.button>
                </div>
                <div className="space-y-4">
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
                      className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm"
                      aria-label="Filter by token symbol"
                    >
                      <option value="">All Tokens</option>
                      {[...new Set(transactions.map((tx) => tx.tokenSymbol))].map((token) => (
                        <option key={token} value={token}>
                          {token}
                        </option>
                      ))}
                    </select>
                    <FaCoins className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
                  </div>
                  <div className="relative group">
                    <label htmlFor="type-filter-mobile" className="text-xs text-gray-400 mb-1 block">
                      Type
                    </label>
                    <select
                      id="type-filter-mobile"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as "all" | "Buy" | "Sell" | "Transfer" | "Swap")}
                      className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm"
                      aria-label="Filter by transaction type"
                    >
                      <option value="all">All Types</option>
                      <option value="Buy">Buy</option>
                      <option value="Sell">Sell</option>
                      <option value="Transfer">Transfer</option>
                      <option value="Swap">Swap</option>
                    </select>
                    <FaExchangeAlt className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
                  </div>
                  <div className="relative group">
                    <label htmlFor="exchange-filter-mobile" className="text-xs text-gray-400 mb-1 block">
                      Exchange
                    </label>
                    <select
                      id="exchange-filter-mobile"
                      value={exchangeFilter}
                      onChange={(e) => setExchangeFilter(e.target.value as "all" | "Uniswap V3" | "Aerodrome" | "Base")}
                      className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm"
                      aria-label="Filter by exchange"
                    >
                      <option value="all">All Exchanges</option>
                      <option value="Uniswap V3">Uniswap V3</option>
                      <option value="Aerodrome">Aerodrome</option>
                      <option value="Base">Base</option>
                    </select>
                    <FaStore className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
                  </div>
                  <div className="relative group">
                    <label htmlFor="time-filter-mobile" className="text-xs text-gray-400 mb-1 block">
                      Time Range
                    </label>
                    <select
                      id="time-filter-mobile"
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value as "all" | "hour" | "day" | "week")}
                      className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm"
                      aria-label="Filter by time range"
                    >
                      <option value="all">All Time</option>
                      <option value="hour">Last Hour</option>
                      <option value="day">Last Day</option>
                      <option value="week">Last Week</option>
                    </select>
                    <FaClock className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
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
                      className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400"
                      aria-label="Minimum USD value"
                    />
                    <FaDollarSign className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
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
                      className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400"
                      aria-label="Minimum percentage of token supply"
                    />
                    <FaPercent className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <motion.button
                    onClick={() => applyQuickFilter({ minUSD: "1000" })}
                    className="px-4 py-2 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Low Value (>$1K)
                  </motion.button>
                  <motion.button
                    onClick={() => applyQuickFilter({ timeFilter: "hour" })}
                    className="px-4 py-2 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Last Hour
                  </motion.button>
                  <motion.button
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs flex items-center gap-2 border border-[#1E2A44] focus:ring-2 focus:ring-red-500 shadow-md"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaTimes size={14} /> Reset Filters
                  </motion.button>
                </div>
                {lastUpdated && (
                  <p className="text-xs text-gray-400 text-right mt-4">
                    Last Updated: {lastUpdated.toLocaleString()}
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filters Summary */}
        {activeFilters.length > 0 && (
          <motion.div
            ref={activeFiltersRef}
            className="flex flex-wrap gap-2 px-4 py-2 bg-[#0A0F1C] border-b border-[#1E2A44]"
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
              className="px-2 py-1 bg-red-500 text-white rounded-full text-xs flex items-center gap-1 focus:ring-2 focus:ring-red-500"
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
            ref={filterLoadingRef}
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
            className="bg-red-500/20 border border-red-500 text-red-400 text-center py-3 rounded-lg mx-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {error}
          </motion.div>
        )}

        {/* Loading State */}
        {loading && !filteredTransactions.length && <SkeletonLoader />}
        {loading && filteredTransactions.length > 0 && <LoadingSpinner />}

        {/* No Transactions */}
        {!loading && filteredTransactions.length === 0 && (
          <motion.p
            className="text-gray-400 text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            No whale transactions found. Try adjusting filters.
          </motion.p>
        )}

        {/* Transactions Feed */}
        {!loading && filteredTransactions.length > 0 && (
          <motion.div
            className="w-full overflow-x-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Table Header */}
            <div
              className="bg-[#1E2A44] text-gray-400 text-xs font-semibold uppercase border-b border-[#1E2A44] sticky z-10 shadow-md"
              style={{ top: `${calculateTableHeaderTop()}px` }}
            >
              <div className="grid grid-cols-[150px_100px_120px_120px_100px_100px_150px_40px] sm:grid-cols-[1fr_0.8fr_1fr_1fr_0.8fr_0.8fr_1fr_0.3fr] gap-2 p-3 items-center min-w-[780px] w-full">
                <button
                  onClick={() => handleSort("tokenSymbol")}
                  className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-left"
                >
                  Token
                  {sortBy === "tokenSymbol" && (
                    <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                  )}
                </button>
                <button
                  onClick={() => handleSort("eventType")}
                  className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-left"
                >
                  Type
                  {sortBy === "eventType" && (
                    <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                  )}
                </button>
                <button
                  onClick={() => handleSort("amountToken")}
                  className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-left"
                >
                  Amount
                  {sortBy === "amountToken" && (
                    <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                  )}
                </button>
                <button
                  onClick={() => handleSort("amountUSD")}
                  className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-left"
                >
                  USD Value
                  {sortBy === "amountUSD" && (
                    <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                  )}
                </button>
                <button
                  onClick={() => handleSort("percentSupply")}
                  className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-left"
                >
                  % Supply
                  {sortBy === "percentSupply" && (
                    <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                  )}
                </button>
                <button
                  onClick={() => handleSort("source")}
                  className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-left"
                >
                  Source
                  {sortBy === "source" && (
                    <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                  )}
                </button>
                <button
                  onClick={() => handleSort("timestamp")}
                  className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-left"
                >
                  Timestamp
                  {sortBy === "timestamp" && (
                    <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                  )}
                </button>
                <span className="text-center">Actions</span>
              </div>
            </div>

            {/* Table Rows */}
            {paginatedTransactions.map((tx, index) => (
              <motion.div
                key={tx.id}
                className="grid grid-cols-[150px_100px_120px_120px_100px_100px_150px_40px] sm:grid-cols-[1fr_0.8fr_1fr_1fr_0.8fr_0.8fr_1fr_0.3fr] gap-2 p-3 text-xs border-b border-[#1E2A44] hover:bg-[#2A3655] cursor-pointer transition-all min-w-[780px] w-full"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                onClick={() => setSelectedTx(tx)}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-[#66B0FF]/20 rounded-full flex items-center justify-center">
                    <WhaleIcon className="w-4 h-4 text-[#66B0FF]" />
                  </div>
                  <span className="font-bold text-[#66B0FF] truncate">{tx.tokenSymbol}</span>
                </div>
                <span className={`${getTypeColor(getTransactionType(tx))} truncate`}>
                  {getTransactionType(tx)}
                </span>
                <span className="text-white truncate">
                  {tx.amountToken.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-green-400 truncate">
                  ${tx.amountUSD.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-white truncate">{tx.percentSupply.toFixed(2)}%</span>
                <span className="text-white truncate">{tx.source}</span>
                <span className="text-gray-400 truncate">{new Date(tx.timestamp).toLocaleString()}</span>
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(tx);
                  }}
                  className="text-gray-400 hover:text-[#66B0FF] p-1 focus:ring-2 focus:ring-[#66B0FF] rounded mx-auto"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FaShareAlt size={14} />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            className="flex items-center justify-center space-x-2 p-4 bg-[#0A0F1C] border-t border-[#1E2A44] sticky bottom-0 z-10"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs flex items-center gap-2 border border-[#1E2A44] disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#66B0FF] shadow-md"
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
                className="w-12 px-1 py-1 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] text-center"
                aria-label="Current page number"
              />
              <span>of {totalPages}</span>
            </div>
            <motion.button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-[#1652F0] hover:bg-[#66B0FF] text-white rounded-lg text-xs flex items-center gap-2 border border-[#1E2A44] disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#66B0FF] shadow-md"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Next <FaAngleRight size={14} />
            </motion.button>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}