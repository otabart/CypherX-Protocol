"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FaShareAlt,
  FaTimes,
  FaCoins,
  FaAngleLeft,
  FaAngleRight,
  FaFilter,
  FaExternalLinkAlt,
  FaCopy,
  FaArrowUp,
  FaArrowDown,
  FaArrowRight,
} from "react-icons/fa";
import { GiWhaleTail } from "react-icons/gi";
import Header from "../components/Header";
import Footer from "../components/Footer";
import toast, { Toaster } from "react-hot-toast";

// ────────── Enhanced Interfaces ──────────

interface WhaleTransaction {
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
  eventType: "Transfer" | "Swap" | "Buy" | "Sell";
  transactionType: "Buy" | "Sell" | "Transfer";
  percentSupply: number;
  gasUsed?: number;
  gasPrice?: number;
  swapDetails?: {
    amountIn: number;
    amountOut: number;
    tokenIn: string;
    tokenOut: string;
    path?: string[];
  };
  whaleAddress?: string;
  whaleLabel?: string;
  impactScore?: number;
}

// interface Token {
//   address: string;
//   symbol: string;
//   name: string;
//   pool: string;
//   price?: number;
//   marketCap?: number;
//   volume24h?: number;
// }

interface FilterState {
  tokenSymbol: string;
  transactionType: "all" | "Buy" | "Sell" | "Transfer";
  timeRange: "all" | "hour" | "day" | "week" | "month";
  minUSD: string;
  maxUSD: string;
  minVolume: string;
  minPercentage: string;
  whaleAddress: string;
  showOnlyWhales: boolean;
}

// ────────── Utility Functions ──────────

const formatAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatNumber = (num: number, decimals: number = 2): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
  return num.toFixed(decimals);
};

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

const getTransactionTypeColor = (type: string): string => {
  switch (type) {
    case 'Buy': return 'text-green-400 bg-green-400/10 border-green-400/20';
    case 'Sell': return 'text-red-400 bg-red-400/10 border-red-400/20';
    case 'Transfer': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  }
};

const getImpactScore = (amountUSD: number, percentSupply: number): number => {
  const usdScore = Math.min(amountUSD / 100000, 1) * 50; // Max 50 points for USD
  const supplyScore = Math.min(percentSupply * 10, 1) * 50; // Max 50 points for supply %
  return Math.round(usdScore + supplyScore);
};

// ────────── Enhanced Transaction Classification ──────────

const classifyTransaction = (tx: {
  eventType?: string;
  swapDetails?: {
    tokenIn?: string;
    tokenOut?: string;
  };
  tokenSymbol?: string;
  amountToken?: number;
  amountUSD?: number;
}): "Buy" | "Sell" | "Transfer" => {
  // Enhanced logic for classifying transactions
  if (tx.eventType === "Swap") {
    // Check if it's a buy (ETH -> Token) or sell (Token -> ETH)
    if (tx.swapDetails) {
      const tokenIn = tx.swapDetails.tokenIn?.toLowerCase();
      const tokenOut = tx.swapDetails.tokenOut?.toLowerCase();
      
      // If input is ETH/WETH and output is the token, it's a buy
      if ((tokenIn === 'eth' || tokenIn === 'weth') && tokenOut === tx.tokenSymbol?.toLowerCase()) {
        return "Buy";
      }
      // If input is the token and output is ETH/WETH, it's a sell
      if (tokenIn === tx.tokenSymbol?.toLowerCase() && (tokenOut === 'eth' || tokenOut === 'weth')) {
        return "Sell";
      }
    }
    
    // Fallback: determine by amount change
    if ((tx.amountToken ?? 0) > 0) return "Buy";
    if ((tx.amountToken ?? 0) < 0) return "Sell";
  }
  
  // For transfers, check if it's a whale transaction
  if (tx.eventType === "Transfer") {
    // If it's a large transfer, classify based on context
    if ((tx.amountUSD ?? 0) > 10000) {
      // Could be a buy/sell depending on the addresses involved
      return "Transfer";
    }
  }
  
  return "Transfer";
};

// ────────── Components ──────────

const WhaleIcon: React.FC<{ className?: string; size?: number }> = ({ className = "", size = 24 }) => {
  return (
    <motion.div
      animate={{ 
        rotate: [0, 5, -5, 0],
        scale: [1, 1.1, 1]
      }}
      transition={{ 
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={className}
    >
      <GiWhaleTail size={size} />
    </motion.div>
  );
};

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="text-blue-500"
    >
      <WhaleIcon size={32} />
    </motion.div>
  </div>
);

const TransactionCard: React.FC<{
  transaction: WhaleTransaction;
  onViewDetails: (tx: WhaleTransaction) => void;
  onShare: (tx: WhaleTransaction) => void;
}> = ({ transaction, onViewDetails, onShare }) => {
  const impactScore = getImpactScore(transaction.amountUSD, transaction.percentSupply);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-xl border border-gray-600/30 p-4 hover:border-gray-500/50 transition-all duration-300 cursor-pointer"
      onClick={() => onViewDetails(transaction)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getTransactionTypeColor(transaction.transactionType)}`}>
            {transaction.transactionType}
          </div>
          <div className="flex items-center gap-2">
            <FaCoins className="text-yellow-400" size={14} />
            <span className="font-semibold text-white">{transaction.tokenSymbol}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <FaCoins />
            <span>{impactScore}</span>
          </div>
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onShare(transaction);
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-gray-400 hover:text-blue-400 transition-colors"
          >
            <FaShareAlt size={14} />
          </motion.button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Amount</span>
          <span className="text-white font-medium">
            {formatNumber(transaction.amountToken)} {transaction.tokenSymbol}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">USD Value</span>
          <span className="text-green-400 font-medium">
            ${formatNumber(transaction.amountUSD)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Supply %</span>
          <span className="text-blue-400 font-medium">
            {transaction.percentSupply.toFixed(2)}%
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Time</span>
          <span className="text-gray-300 text-sm">
            {formatTimeAgo(transaction.timestamp)}
          </span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-600/30">
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>From: {formatAddress(transaction.fromAddress)}</span>
          <span>To: {formatAddress(transaction.toAddress)}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ────────── Main Component ──────────

export default function WhaleWatcherPage() {
  // State management
  const [transactions, setTransactions] = useState<WhaleTransaction[]>([]);

  // const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<WhaleTransaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    tokenSymbol: "",
    transactionType: "all",
    timeRange: "all",
    minUSD: "",
    maxUSD: "",
    minVolume: "",
    minPercentage: "",
    whaleAddress: "",
    showOnlyWhales: false,
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage] = useState(20);

  // ────────── Data Fetching ──────────

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tokens (commented out for now)
        // const tokensQuery = query(collection(db, "tokens"));
        // const tokensSnapshot = await getDocs(tokensQuery);
        // const tokensData = tokensSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Token));
        // setTokens(tokensData);

        // Set up real-time listener for whale transactions
        const transactionsQuery = query(
          collection(db, "whaleTransactions"),
          orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
          const transactionsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              transactionType: classifyTransaction(data),
              impactScore: getImpactScore(data.amountUSD || 0, data.percentSupply || 0),
            } as WhaleTransaction;
          });
          
          setTransactions(transactionsData);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching whale data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ────────── Filtering Logic ──────────

  const filteredData = useMemo(() => {
    let filtered = transactions;

    // Token filter
    if (filters.tokenSymbol) {
      filtered = filtered.filter(tx => 
        tx.tokenSymbol.toLowerCase().includes(filters.tokenSymbol.toLowerCase()) ||
        tx.tokenName.toLowerCase().includes(filters.tokenSymbol.toLowerCase())
      );
    }

    // Transaction type filter
    if (filters.transactionType !== "all") {
      filtered = filtered.filter(tx => tx.transactionType === filters.transactionType);
    }

    // Time range filter
    if (filters.timeRange !== "all") {
      const now = Date.now();
      const timeRanges = {
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
      };
      const cutoff = now - timeRanges[filters.timeRange as keyof typeof timeRanges];
      filtered = filtered.filter(tx => tx.timestamp > cutoff);
    }

    // USD range filter
    if (filters.minUSD) {
      filtered = filtered.filter(tx => tx.amountUSD >= parseFloat(filters.minUSD));
    }
    if (filters.maxUSD) {
      filtered = filtered.filter(tx => tx.amountUSD <= parseFloat(filters.maxUSD));
    }

    // Volume filter
    if (filters.minVolume) {
      filtered = filtered.filter(tx => tx.amountToken >= parseFloat(filters.minVolume));
    }

    // Percentage filter
    if (filters.minPercentage) {
      filtered = filtered.filter(tx => tx.percentSupply >= parseFloat(filters.minPercentage));
    }

    // Whale address filter
    if (filters.whaleAddress) {
      filtered = filtered.filter(tx => 
        tx.fromAddress.toLowerCase().includes(filters.whaleAddress.toLowerCase()) ||
        tx.toAddress.toLowerCase().includes(filters.whaleAddress.toLowerCase())
      );
    }

    // Show only whale transactions (high impact)
    if (filters.showOnlyWhales) {
      filtered = filtered.filter(tx => getImpactScore(tx.amountUSD, tx.percentSupply) >= 70);
    }

    return filtered;
  }, [transactions, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / transactionsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * transactionsPerPage,
    currentPage * transactionsPerPage
  );

  // ────────── Event Handlers ──────────

  const handleViewDetails = (transaction: WhaleTransaction) => {
    setSelectedTransaction(transaction);
    setShowDetails(true);
  };

  const handleShare = (transaction: WhaleTransaction) => {
    const shareText = `🐋 Whale Alert: ${transaction.transactionType} ${formatNumber(transaction.amountToken)} ${transaction.tokenSymbol} ($${formatNumber(transaction.amountUSD)})`;
    const shareUrl = `/explorer/tx/${transaction.hash}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Whale Transaction',
        text: shareText,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('Transaction details copied to clipboard!');
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard!');
  };

  const updateFilter = (key: keyof FilterState, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  // ────────── Render ──────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <Header />
        <LoadingSpinner />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col">
      <Header />
      <Toaster position="top-right" />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <WhaleIcon className="text-blue-400" size={32} />
            <h1 className="text-4xl font-bold text-white">🐋 Whale Watcher</h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Track large cryptocurrency transactions in real-time. Monitor whale movements, 
            analyze market impact, and stay ahead of significant trading activity.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20 p-4"
          >
            <div className="flex items-center gap-3">
              <FaCoins className="text-blue-400" size={20} />
              <div>
                <p className="text-gray-400 text-sm">Total Transactions</p>
                <p className="text-white font-bold text-xl">{transactions.length.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20 p-4"
          >
            <div className="flex items-center gap-3">
              <FaArrowUp className="text-green-400" size={20} />
              <div>
                <p className="text-gray-400 text-sm">Buy Transactions</p>
                <p className="text-white font-bold text-xl">
                  {transactions.filter(tx => tx.transactionType === 'Buy').length.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-r from-red-500/10 to-pink-500/10 rounded-xl border border-red-500/20 p-4"
          >
            <div className="flex items-center gap-3">
              <FaArrowDown className="text-red-400" size={20} />
              <div>
                <p className="text-gray-400 text-sm">Sell Transactions</p>
                <p className="text-white font-bold text-xl">
                  {transactions.filter(tx => tx.transactionType === 'Sell').length.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-xl border border-purple-500/20 p-4"
          >
            <div className="flex items-center gap-3">
              <FaArrowRight className="text-purple-400" size={20} />
              <div>
                <p className="text-gray-400 text-sm">Transfer Transactions</p>
                <p className="text-white font-bold text-xl">
                  {transactions.filter(tx => tx.transactionType === 'Transfer').length.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters Section */}
        <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Filters</h2>
            <motion.button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaFilter size={14} />
              {showFilters ? 'Hide' : 'Show'} Filters
            </motion.button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Token Symbol</label>
                  <input
                    type="text"
                    placeholder="e.g., WETH, USDC"
                    value={filters.tokenSymbol}
                    onChange={(e) => updateFilter('tokenSymbol', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Transaction Type</label>
                  <select
                    value={filters.transactionType}
                    onChange={(e) => updateFilter('transactionType', e.target.value as "all" | "Buy" | "Sell" | "Transfer")}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Types</option>
                    <option value="Buy">Buy</option>
                    <option value="Sell">Sell</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Time Range</label>
                  <select
                    value={filters.timeRange}
                    onChange={(e) => updateFilter('timeRange', e.target.value as "all" | "hour" | "day" | "week" | "month")}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Time</option>
                    <option value="hour">Last Hour</option>
                    <option value="day">Last Day</option>
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Min USD Value</label>
                  <input
                    type="number"
                    placeholder="e.g., 10000"
                    value={filters.minUSD}
                    onChange={(e) => updateFilter('minUSD', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Max USD Value</label>
                  <input
                    type="number"
                    placeholder="e.g., 1000000"
                    value={filters.maxUSD}
                    onChange={(e) => updateFilter('maxUSD', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Min Token Amount</label>
                  <input
                    type="number"
                    placeholder="e.g., 1000"
                    value={filters.minVolume}
                    onChange={(e) => updateFilter('minVolume', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Min Supply %</label>
                  <input
                    type="number"
                    placeholder="e.g., 0.1"
                    value={filters.minPercentage}
                    onChange={(e) => updateFilter('minPercentage', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Whale Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={filters.whaleAddress}
                    onChange={(e) => updateFilter('whaleAddress', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 text-gray-400 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.showOnlyWhales}
                      onChange={(e) => updateFilter('showOnlyWhales', e.target.checked)}
                      className="rounded border-gray-600 text-blue-500 focus:ring-blue-500"
                    />
                    Show only high-impact transactions
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Results Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">
              Transactions ({filteredData.length.toLocaleString()})
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Page {currentPage} of {totalPages}</span>
            </div>
          </div>

          {paginatedData.length === 0 ? (
            <div className="text-center py-12">
              <WhaleIcon className="text-gray-600 mx-auto mb-4" size={48} />
              <p className="text-gray-400 text-lg">No transactions found</p>
              <p className="text-gray-500 text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedData.map((transaction) => (
                <TransactionCard
                  key={transaction.hash}
                  transaction={transaction}
                  onViewDetails={handleViewDetails}
                  onShare={handleShare}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <motion.button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaAngleLeft size={14} />
            </motion.button>
            
            <span className="text-gray-400 px-4">
              {currentPage} of {totalPages}
            </span>
            
            <motion.button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaAngleRight size={14} />
            </motion.button>
          </div>
        )}
      </main>

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {showDetails && selectedTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Transaction Details</h2>
                  <motion.button
                    onClick={() => setShowDetails(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <FaTimes size={20} />
                  </motion.button>
                </div>

                <div className="space-y-6">
                  {/* Transaction Overview */}
                  <div className="bg-gray-700/30 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getTransactionTypeColor(selectedTransaction.transactionType)}`}>
                        {selectedTransaction.transactionType}
                      </div>
                      <span className="text-white font-semibold">{selectedTransaction.tokenSymbol}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm">Amount</p>
                        <p className="text-white font-semibold">
                          {formatNumber(selectedTransaction.amountToken)} {selectedTransaction.tokenSymbol}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">USD Value</p>
                        <p className="text-green-400 font-semibold">
                          ${formatNumber(selectedTransaction.amountUSD)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Supply %</p>
                        <p className="text-blue-400 font-semibold">
                          {selectedTransaction.percentSupply.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Impact Score</p>
                        <p className="text-yellow-400 font-semibold">
                          {getImpactScore(selectedTransaction.amountUSD, selectedTransaction.percentSupply)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-2">From Address</p>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm">
                          {formatAddress(selectedTransaction.fromAddress)}
                        </span>
                        <motion.button
                          onClick={() => handleCopyAddress(selectedTransaction.fromAddress)}
                          className="text-gray-400 hover:text-blue-400 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FaCopy size={14} />
                        </motion.button>
                        <motion.a
                          href={`/explorer/address/${selectedTransaction.fromAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-400 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FaExternalLinkAlt size={14} />
                        </motion.a>
                      </div>
                    </div>

                    <div>
                      <p className="text-gray-400 text-sm mb-2">To Address</p>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm">
                          {formatAddress(selectedTransaction.toAddress)}
                        </span>
                        <motion.button
                          onClick={() => handleCopyAddress(selectedTransaction.toAddress)}
                          className="text-gray-400 hover:text-blue-400 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FaCopy size={14} />
                        </motion.button>
                        <motion.a
                          href={`/explorer/address/${selectedTransaction.toAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-400 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FaExternalLinkAlt size={14} />
                        </motion.a>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Details */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm">Block Number</p>
                        <p className="text-white font-mono text-sm">{selectedTransaction.blockNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Timestamp</p>
                        <p className="text-white text-sm">
                          {new Date(selectedTransaction.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-gray-400 text-sm mb-2">Transaction Hash</p>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm">
                          {formatAddress(selectedTransaction.hash)}
                        </span>
                        <motion.button
                          onClick={() => handleCopyAddress(selectedTransaction.hash)}
                          className="text-gray-400 hover:text-blue-400 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FaCopy size={14} />
                        </motion.button>
                        <motion.a
                          href={`/explorer/tx/${selectedTransaction.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-400 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <FaExternalLinkAlt size={14} />
                        </motion.a>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-gray-700">
                    <motion.button
                      onClick={() => handleShare(selectedTransaction)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FaShareAlt size={14} />
                      Share
                    </motion.button>
                    <motion.a
                                              href={`/explorer/tx/${selectedTransaction.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FaExternalLinkAlt size={14} />
                      View on Explorer
                    </motion.a>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
