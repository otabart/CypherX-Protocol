"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { collection, query, orderBy, onSnapshot, Timestamp, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FaShareAlt,
  FaTimes,
  FaSort,
  FaCoins,
  FaExchangeAlt,
  FaClock,
  FaDollarSign,
  FaPercent,
  FaAngleLeft,
  FaAngleRight,
  FaSyncAlt,
} from "react-icons/fa";
import { GiWhaleTail } from "react-icons/gi";
import { motion, AnimatePresence } from "framer-motion";
import { debounce } from "lodash";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import Footer from "../components/Footer";
import Fuse from "fuse.js";

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
  swapType?: "Buy" | "Sell" | "Swap";
  percentSupply: number;
  swapDetails?: {
    amountIn: number;
    amountOut: number;
    tokenIn: string;
    tokenOut: string;
  };
}

// Interface for token from Firestore
interface Token {
  address: string;
  symbol: string;
  name: string;
  pool: string;
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
      className="space-y-3 w-full px-4"
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

// Transaction Row Component for Virtualized List
interface TransactionRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    transactions: WhaleTx[];
    getTypeColor: (type: string) => string;
    getTransactionType: (tx: WhaleTx) => string;
    handleShare: (tx: WhaleTx) => void;
    setSelectedTx: (tx: WhaleTx | null) => void;
  };
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  index,
  style,
  data: { transactions, getTypeColor, getTransactionType, handleShare, setSelectedTx },
}) => {
  const tx = transactions[index];
  return (
    <motion.div
      style={{ ...style, padding: "0 16px" }}
      className="grid grid-cols-[1fr_1fr_1fr_0.5fr] sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_0.5fr] gap-4 py-3 text-sm border-b border-[#1E2A44] hover:bg-[#2A3655] cursor-pointer transition-all w-full items-center"
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
      <span className={`${getTypeColor(getTransactionType(tx))} truncate text-center`}>
        {getTransactionType(tx)}
      </span>
      <span className="text-white truncate text-right">
        {tx.amountToken.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
      <span className="text-green-400 truncate text-right sm:block hidden">
        ${tx.amountUSD.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
      <span className="text-white truncate text-right sm:block hidden">{tx.percentSupply.toFixed(2)}%</span>
      <span className="text-white truncate text-center sm:block hidden">{tx.source}</span>
      <span className="text-gray-400 truncate text-right sm:block hidden">{new Date(tx.timestamp).toLocaleString()}</span>
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
  );
};

export default function WhaleWatcherPage() {
  const [transactions, setTransactions] = useState<WhaleTx[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<WhaleTx[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [tokenSuggestions, setTokenSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tokenFilter, setTokenFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "Buy" | "Sell" | "Transfer">("all");
  const [minUSD, setMinUSD] = useState("");
  const [maxUSD, setMaxUSD] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "hour" | "day" | "week">("all");
  const [sortBy, setSortBy] = useState<keyof WhaleTx>("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedTx, setSelectedTx] = useState<WhaleTx | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [page, setPage] = useState(1);
  const [minPercentage, setMinPercentage] = useState("");
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

  const activeFilters = [
    tokenFilter && `Token: ${tokenFilter}`,
    typeFilter !== "all" && `Type: ${typeFilter}`,
    minUSD && `Min USD: $${minUSD}`,
    maxUSD && `Max USD: $${maxUSD}`,
    minVolume && `Min Volume: ${minVolume}`,
    timeFilter !== "all" && `Time: Last ${timeFilter}`,
    minPercentage && `Min %: ${minPercentage}%`,
  ].filter(Boolean);

  const debouncedSetTokenFilter = useCallback(
    debounce((value: string) => {
      setTokenFilter(value);
      setFilterLoading(false);
    }, 300),
    []
  );

  // Fetch tokens for search suggestions
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const tokensSnapshot = await getDocs(collection(db, "tokens"));
        const tokenList = tokensSnapshot.docs
          .map((doc) => ({
            address: doc.data().address,
            symbol: doc.data().symbol,
            name: doc.data().name || doc.data().symbol,
            pool: doc.data().pool || "",
          }))
          .filter((token) => token.symbol && /^0x[a-fA-F0-9]{40}$/.test(token.address));
        setTokens(tokenList);
      } catch (err) {
        console.error("Failed to fetch tokens for search:", err);
      }
    };
    fetchTokens();
  }, []);

  // Update token suggestions based on search input
  useEffect(() => {
    if (tokenFilter) {
      const fuse = new Fuse(tokens, {
        keys: ["symbol", "name"],
        threshold: 0.2, // Tighter match threshold for better accuracy
        includeScore: true,
        minMatchCharLength: 2, // Require at least 2 characters for search
      });
      const results = fuse
        .search(tokenFilter)
        .filter((result) => result.score! < 0.4) // Filter out low-confidence matches
        .map((result) => result.item.symbol);
      setTokenSuggestions(results.slice(0, 5));
    } else {
      setTokenSuggestions([]);
    }
  }, [tokenFilter, tokens]);

  useEffect(() => {
    const updateHeights = () => {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
      if (filterBarRef.current) setFilterBarHeight(filterBarRef.current.offsetHeight);
      if (activeFiltersRef.current) setActiveFiltersHeight(activeFiltersRef.current.offsetHeight);
      else setActiveFiltersHeight(0);
      if (filterLoadingRef.current) setFilterLoadingHeight(filterLoadingRef.current.offsetHeight);
      else setFilterLoadingHeight(0);
    };

    updateHeights();
    window.addEventListener("resize", updateHeights);
    return () => window.removeEventListener("resize", updateHeights);
  }, [activeFilters, filterLoading]);

  const calculateTableHeaderTop = () => {
    const baseHeight = headerHeight + (window.innerWidth >= 640 ? filterBarHeight : 0);
    const additionalHeight = activeFiltersHeight + filterLoadingHeight;
    return Math.max(baseHeight + additionalHeight, 0);
  };

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

  useEffect(() => {
    if (!isClient) return;

    const q = query(collection(db, "whaleTransactions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txs: WhaleTx[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const timestamp =
              data.timestamp instanceof Timestamp
                ? data.timestamp.toDate().getTime()
                : typeof data.timestamp === "number"
                ? data.timestamp
                : new Date().getTime();
            return {
              id: doc.id,
              tokenSymbol: data.tokenSymbol || "UNKNOWN",
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
              swapType: data.swapType,
              swapDetails: data.swapDetails,
              percentSupply: Number(data.percentSupply) || 0,
            };
          })
          .filter((tx) => tx.tokenSymbol !== "TEST");
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

  const applyFilters = useCallback(
    debounce((txs: WhaleTx[]) => {
      let filtered = [...txs];

      if (tokenFilter) {
        const fuse = new Fuse(txs, {
          keys: ["tokenSymbol", "tokenName"],
          threshold: 0.2,
          includeScore: true,
          minMatchCharLength: 2,
        });
        filtered = fuse
          .search(tokenFilter)
          .filter((result) => result.score! < 0.4)
          .map((result) => result.item);
      }
      if (typeFilter !== "all") {
        filtered = filtered.filter((tx) => getTransactionType(tx) === typeFilter);
      }
      if (minUSD) {
        const min = parseFloat(minUSD);
        if (!isNaN(min)) filtered = filtered.filter((tx) => tx.amountUSD >= min);
      }
      if (maxUSD) {
        const max = parseFloat(maxUSD);
        if (!isNaN(max)) filtered = filtered.filter((tx) => tx.amountUSD <= max);
      }
      if (minVolume) {
        const min = parseFloat(minVolume);
        if (!isNaN(min)) filtered = filtered.filter((tx) => tx.amountToken >= min);
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
        if (!isNaN(min)) filtered = filtered.filter((tx) => tx.percentSupply >= min);
      }

      filtered.sort((a, b) => {
        const aValue = a[sortBy] ?? 0;
        const bValue = b[sortBy] ?? 0;
        return sortOrder === "asc" ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1;
      });

      setFilteredTransactions(filtered);
      setPage(1);
      setFilterLoading(false);
    }, 300),
    [tokenFilter, typeFilter, minUSD, maxUSD, minVolume, timeFilter, minPercentage, sortBy, sortOrder]
  );

  useEffect(() => {
    if (!isClient) return;
    setFilterLoading(true);
    applyFilters(transactions);
  }, [
    transactions,
    tokenFilter,
    typeFilter,
    minUSD,
    maxUSD,
    minVolume,
    timeFilter,
    minPercentage,
    sortBy,
    sortOrder,
    isClient,
    applyFilters,
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
    const shareText = `🐳 Whale Alert: ${tx.tokenSymbol} - $${tx.amountUSD.toLocaleString()} (${getTransactionType(tx)}) at ${new Date(tx.timestamp).toLocaleString()} on ${tx.source} #WhaleAlert #Crypto`;
    if (navigator.share) {
      navigator
        .share({
          title: "Whale Transaction Alert",
          text: shareText,
          url: `/explorer/tx/${tx.hash}`,
        })
        .catch((err) => console.error("Share failed:", err));
    } else if (navigator.clipboard) {
      navigator.clipboard
        .writeText(shareText)
        .then(() => alert("Transaction details copied to clipboard!"))
        .catch((err) => console.error("Failed to copy share text:", err));
    }
  };

  const handleRefreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/whale-watchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startMonitoring: true }),
      });
      const data = await res.json();
      if (data.success) {
        const q = query(collection(db, "whaleTransactions"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const txs: WhaleTx[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const timestamp =
              data.timestamp instanceof Timestamp
                ? data.timestamp.toDate().getTime()
                : typeof data.timestamp === "number"
                ? data.timestamp
                : new Date().getTime();
            return {
              id: doc.id,
              tokenSymbol: data.tokenSymbol || "UNKNOWN",
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
              swapType: data.swapType,
              swapDetails: data.swapDetails,
              percentSupply: Number(data.percentSupply) || 0,
            };
          })
          .filter((tx) => tx.tokenSymbol !== "TEST");
        setTransactions(txs);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.error || "Refresh failed");
      }
    } catch (err) {
      console.error("Refresh error:", err);
      setError("Failed to refresh data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const applyQuickFilter = (filter: {
    minUSD?: string;
    timeFilter?: "all" | "hour" | "day" | "week";
    minVolume?: string;
  }) => {
    setMinUSD(filter.minUSD || "");
    setMinVolume(filter.minVolume || "");
    setTimeFilter(filter.timeFilter || "all");
    setFilterLoading(true);
    setTimeout(() => setFilterLoading(false), 300);
  };

  const getTransactionType = (tx: WhaleTx): "Buy" | "Sell" | "Transfer" => {
    if (tx.eventType === "Swap" && tx.swapType) {
      return tx.swapType;
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
    <div className="min-h-screen w-full bg-[#0A0F1C] text-white font-sans flex flex-col overflow-x-hidden">
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
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        ::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        html {
          scrollbar-width: thin;
          scrollbar-color: #888 #f1f1f1;
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
              <div className="p-4 text-sm space-y-3">
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
                    href={`/explorer/tx/${selectedTx.hash}`}
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
                  href={`/explorer/tx/${selectedTx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-lg text-sm flex items-center justify-center gap-2 border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaShareAlt size={14} /> View on Explorer
                </motion.a>
                <motion.button
                  onClick={() => handleShare(selectedTx)}
                  className="flex-1 px-4 py-2 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-lg text-sm flex items-center justify-center gap-2 border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaShareAlt size={14} /> Share
                </motion.button>
                <motion.button
                  onClick={() => setSelectedTx(null)}
                  className="flex-1 px-4 py-2 bg-[#1E2A44] hover:bg-[#2A3655] text-white rounded-lg text-sm border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
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
        <motion.button
          className="sm:hidden px-4 py-2 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-lg text-sm"
          onClick={() => setShowFilters(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Filters
        </motion.button>
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
            <input
              type="text"
              placeholder="Search Token (e.g., WETH)"
              value={tokenFilter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setFilterLoading(true);
                debouncedSetTokenFilter(e.target.value);
              }}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 w-40"
              list="token-suggestions"
              aria-label="Search by token symbol or name"
            />
            <FaCoins className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
            <datalist id="token-suggestions">
              {tokenSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </div>
          <div className="relative group">
            <select
              value={typeFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value as "all" | "Buy" | "Sell" | "Transfer")}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm w-32"
              aria-label="Filter by transaction type"
            >
              <option value="all">All Types</option>
              <option value="Buy">Buy</option>
              <option value="Sell">Sell</option>
              <option value="Transfer">Transfer</option>
            </select>
            <FaExchangeAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
          <div className="relative group">
            <select
              value={timeFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTimeFilter(e.target.value as "all" | "hour" | "day" | "week")}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm w-32"
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
              placeholder="Min USD (4000)"
              value={minUSD}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinUSD(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 w-32"
              aria-label="Minimum USD value"
            />
            <FaDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
          <div className="relative group">
            <input
              type="number"
              placeholder="Max USD"
              value={maxUSD}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxUSD(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 w-32"
              aria-label="Maximum USD value"
            />
            <FaDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
          <div className="relative group">
            <input
              type="number"
              placeholder="Min Volume"
              value={minVolume}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinVolume(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 w-32"
              aria-label="Minimum token volume"
            />
            <FaCoins className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
          <div className="relative group">
            <input
              type="number"
              placeholder="Min % (0.05)"
              value={minPercentage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinPercentage(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400 w-32"
              aria-label="Minimum percentage of token supply"
            />
            <FaPercent className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
          </div>
        </div>
        <motion.button
          onClick={handleRefreshData}
          className="px-4 py-2 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-lg text-sm flex items-center gap-2 border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FaSyncAlt size={14} /> Refresh
        </motion.button>
      </motion.div>

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
                  <label htmlFor="token-filter-mobile" className="text-sm text-gray-400 mb-1 block">
                    Token
                  </label>
                  <input
                    id="token-filter-mobile"
                    type="text"
                    placeholder="Search Token (e.g., WETH)"
                    value={tokenFilter}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setFilterLoading(true);
                      debouncedSetTokenFilter(e.target.value);
                    }}
                    className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm"
                    list="token-suggestions-mobile"
                    aria-label="Search by token symbol or name"
                  />
                  <FaCoins className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
                  <datalist id="token-suggestions-mobile">
                    {tokenSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                </div>
                <div className="relative group">
                  <label htmlFor="type-filter-mobile" className="text-sm text-gray-400 mb-1 block">
                    Type
                  </label>
                  <select
                    id="type-filter-mobile"
                    value={typeFilter}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value as "all" | "Buy" | "Sell" | "Transfer")}
                    className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm"
                    aria-label="Filter by transaction type"
                  >
                    <option value="all">All Types</option>
                    <option value="Buy">Buy</option>
                    <option value="Sell">Sell</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                  <FaExchangeAlt className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
                </div>
                <div className="relative group">
                  <label htmlFor="time-filter-mobile" className="text-sm text-gray-400 mb-1 block">
                    Time Range
                  </label>
                  <select
                    id="time-filter-mobile"
                    value={timeFilter}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTimeFilter(e.target.value as "all" | "hour" | "day" | "week")}
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
                  <label htmlFor="min-usd-mobile" className="text-sm text-gray-400 mb-1 block">
                    Min USD
                  </label>
                  <input
                    id="min-usd-mobile"
                    type="number"
                    placeholder="e.g., 4000"
                    value={minUSD}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinUSD(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400"
                    aria-label="Minimum USD value"
                  />
                  <FaDollarSign className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
                </div>
                <div className="relative group">
                  <label htmlFor="max-usd-mobile" className="text-sm text-gray-400 mb-1 block">
                    Max USD
                  </label>
                  <input
                    id="max-usd-mobile"
                    type="number"
                    placeholder="e.g., 100000"
                    value={maxUSD}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxUSD(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400"
                    aria-label="Maximum USD value"
                  />
                  <FaDollarSign className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
                </div>
                <div className="relative group">
                  <label htmlFor="min-volume-mobile" className="text-sm text-gray-400 mb-1 block">
                    Min Volume
                  </label>
                  <input
                    id="min-volume-mobile"
                    type="number"
                    placeholder="e.g., 100"
                    value={minVolume}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinVolume(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400"
                    aria-label="Minimum token volume"
                  />
                  <FaCoins className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
                </div>
                <div className="relative group">
                  <label htmlFor="min-percentage-mobile" className="text-sm text-gray-400 mb-1 block">
                    Min % Supply
                  </label>
                  <input
                    id="min-percentage-mobile"
                    type="number"
                    placeholder="e.g., 0.05"
                    value={minPercentage}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinPercentage(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#1E2A44] text-white rounded-lg border border-[#1E2A44] hover:border-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-sm placeholder-gray-400"
                    aria-label="Minimum percentage of token supply"
                  />
                  <FaPercent className="absolute left-3 top-9 text-gray-400 group-hover:text-[#66B0FF]" size={16} />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                <motion.button
                  onClick={() => applyQuickFilter({ minUSD: "4000", minVolume: "100" })}
                  className="px-4 py-2 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-lg text-sm border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Low Value ($4K)
                </motion.button>
                <motion.button
                  onClick={() => applyQuickFilter({ timeFilter: "hour" })}
                  className="px-4 py-2 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-lg text-sm border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Last Hour
                </motion.button>
                <motion.button
                  onClick={handleRefreshData}
                  className="px-4 py-2 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-lg text-sm flex items-center gap-2 border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaSyncAlt size={14} /> Refresh
                </motion.button>
                <motion.button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-lg text-sm border border-[#1E2A44] focus:ring-2 focus:ring-[#66B0FF] shadow-md"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Apply Filters
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
          <span className="text-sm text-gray-400">Active Filters:</span>
          {activeFilters.map((filter, index) => (
            <motion.span
              key={index}
              className="px-2 py-1 bg-[#2A3655] text-white rounded-full text-xs"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.1 }}
            >
              {filter}
            </motion.span>
          ))}
          <motion.button
            onClick={handleRefreshData}
            className="px-2 py-1 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-full text-xs flex items-center gap-1 focus:ring-2 focus:ring-[#66B0FF]"
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
          className="w-full flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="bg-[#1E2A44] text-gray-400 text-sm font-semibold uppercase border-b border-[#1E2A44] sticky z-10 shadow-md"
            style={{ top: `${calculateTableHeaderTop()}px` }}
          >
            <div className="grid grid-cols-[1fr_1fr_1fr_0.5fr] sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_0.5fr] gap-4 px-4 py-3 items-center w-full">
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
                className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-center"
              >
                Type
                {sortBy === "eventType" && (
                  <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                )}
              </button>
              <button
                onClick={() => handleSort("amountToken")}
                className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-right"
              >
                Amount
                {sortBy === "amountToken" && (
                  <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                )}
              </button>
              <button
                onClick={() => handleSort("amountUSD")}
                className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-right sm:block hidden"
              >
                USD Value
                {sortBy === "amountUSD" && (
                  <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                )}
              </button>
              <button
                onClick={() => handleSort("percentSupply")}
                className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-right sm:block hidden"
              >
                % Supply
                {sortBy === "percentSupply" && (
                  <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                )}
              </button>
              <button
                onClick={() => handleSort("source")}
                className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-center sm:block hidden"
              >
                Source
                {sortBy === "source" && (
                  <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                )}
              </button>
              <button
                onClick={() => handleSort("timestamp")}
                className="flex items-center gap-1 hover:text-[#66B0FF] focus:ring-2 focus:ring-[#66B0FF] text-right sm:block hidden"
              >
                Timestamp
                {sortBy === "timestamp" && (
                  <FaSort className={sortOrder === "asc" ? "rotate-180" : ""} size={12} />
                )}
              </button>
              <span className="text-center">Actions</span>
            </div>
          </div>
          <div className="w-full" style={{ height: `calc(100vh - ${calculateTableHeaderTop() + 60}px)` }}>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  height={height}
                  width={width}
                  itemCount={paginatedTransactions.length}
                  itemSize={60}
                  itemData={{
                    transactions: paginatedTransactions,
                    getTypeColor,
                    getTransactionType,
                    handleShare,
                    setSelectedTx,
                  }}
                >
                  {TransactionRow}
                </List>
              )}
            </AutoSizer>
          </div>
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          className="flex items-center justify-center space-x-2 p-4 bg-[#0A0F1C] border-t border-[#1E2A44] sticky bottom-0 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-lg text-sm flex items-center gap-2 border border-[#1E2A44] disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#66B0FF] shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaAngleLeft size={14} /> Prev
          </motion.button>
          <div className="flex items-center space-x-1 text-sm text-gray-400">
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
            className="px-4 py-2 bg-[#2A3655] hover:bg-[#66B0FF] text-white rounded-lg text-sm flex items-center gap-2 border border-[#1E2A44] disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#66B0FF] shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Next <FaAngleRight size={14} />
          </motion.button>
        </motion.div>
      )}
      <Footer />
    </div>
  );
}
