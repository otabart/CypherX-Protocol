"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { FaEthereum, FaWallet, FaExchangeAlt, FaCube, FaCoins } from "react-icons/fa";
import { SiEthereum } from "react-icons/si";
import debounce from "lodash/debounce";

// Search result types
interface TokenSearchResult {
  type: "token";
  address: string;
  poolAddress?: string;
  name: string;
  symbol: string;
  marketCap?: number;
  volume24h?: number;
  priceUsd?: string;
  liquidity?: { usd: number };
  source: string;
  imageUrl?: string;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h1: number;
    h24: number;
  };
  txns?: {
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  // Additional metadata from DexScreener
  fdv?: number;
  pairCreatedAt?: number;
  dexId?: string;
  url?: string;
  metrics?: {
    priceChange24h: number;
    priceChange1h: number;
    priceChange6h: number;
    priceChange5m: number;
    totalTxns24h: number;
    totalTxns1h: number;
    totalTxns6h: number;
    buyRatio24h: number;
    buyRatio1h: number;
    volumeChange24h: number;
    liquidityChange24h: number;
  };
}

interface WalletSearchResult {
  type: "wallet";
  address: string;
  balance?: string;
  transactionCount?: number;
  lastActivity?: string;
}

interface TransactionSearchResult {
  type: "transaction";
  hash: string;
  blockNumber?: number;
  from: string;
  to: string;
  value?: string;
  status?: number;
  timestamp?: number;
}

interface BlockSearchResult {
  type: "block";
  number: number;
  hash: string;
  timestamp?: number;
  transactions?: number;
  gasUsed?: string;
  gasLimit?: string;
}

interface SearchResults {
  tokens: TokenSearchResult[];
  wallets: WalletSearchResult[];
  transactions: TransactionSearchResult[];
  blocks: BlockSearchResult[];
}

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
  variant?: "header" | "homepage";
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ 
  placeholder = "Search for tokens, symbols, addresses, transactions, blocks...",
  className = "",
  variant = "header"
}) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    tokens: [],
    wallets: [],
    transactions: [],
    blocks: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState("");
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search function
  const debouncedSearch = useRef(
    debounce(async (searchQuery: string) => {
      if (!searchQuery || searchQuery.length < 2) {
        setResults({ tokens: [], wallets: [], transactions: [], blocks: [] });
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || { tokens: [], wallets: [], transactions: [], blocks: [] });
        } else {
          setError("Search failed");
        }
      } catch (error) {
        console.error("Search error:", error);
        setError("Search failed");
      } finally {
        setIsLoading(false);
      }
    }, 300)
  ).current;

  // Handle search query changes
  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showResults) return;

      const totalResults = results.tokens.length + results.wallets.length + results.transactions.length + results.blocks.length;
      
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(prev => prev < totalResults - 1 ? prev + 1 : prev);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0) {
            handleResultClick(getResultByIndex(selectedIndex));
          }
          break;
        case "Escape":
          setShowResults(false);
          setSelectedIndex(-1);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showResults, results, selectedIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get result by index across all result types
  const getResultByIndex = (index: number) => {
    let currentIndex = 0;
    
    // Check tokens
    if (index < results.tokens.length) {
      return { type: "token", result: results.tokens[index] };
    }
    currentIndex += results.tokens.length;
    
    // Check wallets
    if (index < currentIndex + results.wallets.length) {
      return { type: "wallet", result: results.wallets[index - currentIndex] };
    }
    currentIndex += results.wallets.length;
    
    // Check transactions
    if (index < currentIndex + results.transactions.length) {
      return { type: "transaction", result: results.transactions[index - currentIndex] };
    }
    currentIndex += results.transactions.length;
    
    // Check blocks
    if (index < currentIndex + results.blocks.length) {
      return { type: "block", result: results.blocks[index - currentIndex] };
    }
    
    return null;
  };

  // Handle result click
  const handleResultClick = (resultData: any) => {
    if (!resultData) return;
    
    const { type, result } = resultData;
    
    switch (type) {
      case "token":
        if (result.poolAddress) {
          router.push(`/token-scanner/${result.poolAddress}/chart`);
        } else {
          router.push(`/token-scanner/${result.address}/chart`);
        }
        break;
      case "wallet":
        router.push(`/explorer/address/${result.address}`);
        break;
      case "transaction":
        router.push(`/explorer/tx/${result.hash}`);
        break;
      case "block":
        router.push(`/explorer/latest/block/${result.number}`);
        break;
    }
    
    setShowResults(false);
    setQuery("");
    setSelectedIndex(-1);
  };

  // Get total results count
  const totalResults = results.tokens.length + results.wallets.length + results.transactions.length + results.blocks.length;

  // Format number for display
  const formatNumber = (num: number | undefined) => {
    if (!num) return "0";
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Get result icon
  const getResultIcon = (type: string) => {
    switch (type) {
      case "token":
        return <FaCoins className="w-4 h-4 text-yellow-400" />;
      case "wallet":
        return <FaWallet className="w-4 h-4 text-blue-400" />;
      case "transaction":
        return <FaExchangeAlt className="w-4 h-4 text-green-400" />;
      case "block":
        return <FaCube className="w-4 h-4 text-purple-400" />;
      default:
        return <SiEthereum className="w-4 h-4 text-gray-400" />;
    }
  };

  // Get result type label
  const getResultTypeLabel = (type: string) => {
    switch (type) {
      case "token":
        return "Token";
      case "wallet":
        return "Wallet";
      case "transaction":
        return "Transaction";
      case "block":
        return "Block";
      default:
        return "Unknown";
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative group">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (query.length >= 2) {
              setShowResults(true);
            }
          }}
          className={`w-full pl-12 pr-12 py-3 text-sm text-gray-100 bg-gray-800/90 backdrop-blur-xl border border-gray-600/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 placeholder-gray-400 shadow-lg group-hover:border-blue-400/50 ${
            variant === "homepage" ? "bg-gray-900/80" : ""
          }`}
        />
        
        {/* Search Icon */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors duration-300" />
        </div>
        
        {/* Status Indicator */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
          ) : query.length >= 2 ? (
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          ) : (
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          )}
        </div>
        
        {/* Clear Button */}
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setShowResults(false);
              setSelectedIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {showResults && (query.length >= 2 || totalResults > 0) && (
          <motion.div
            className={`absolute top-full left-0 right-0 mt-2 bg-gray-800/95 backdrop-blur-xl border border-blue-500/30 rounded-xl shadow-2xl max-h-96 overflow-y-auto z-50 scrollbar-hide ${
              variant === "homepage" ? "w-full" : "w-full max-w-2xl"
            }`}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Loading State */}
            {isLoading && (
              <div className="p-4 text-center text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mx-auto mb-2"></div>
                Searching...
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-4 text-center text-red-400">
                {error}
              </div>
            )}

            {/* No Results */}
            {!isLoading && !error && totalResults === 0 && query.length >= 2 && (
              <div className="p-4 text-center text-gray-400">
                No results found for "{query}"
              </div>
            )}

            {/* Results */}
            {!isLoading && !error && totalResults > 0 && (
              <div className="py-2">
                {/* Tokens */}
                {results.tokens.length > 0 && (
                  <div className="mb-4">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 sticky top-0 bg-gray-800/95 backdrop-blur-sm z-10">
                      Tokens ({results.tokens.length})
                    </div>
                    <div className="max-h-64 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {results.tokens.map((token, index) => {
                        const globalIndex = index;
                        const isSelected = selectedIndex === globalIndex;
                        
                        return (
                          <motion.div
                            key={token.address}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-4 hover:bg-blue-500/20 cursor-pointer border-b border-gray-700/50 last:border-b-0 transition-all duration-200 ${
                              isSelected ? "bg-blue-500/20" : ""
                            }`}
                            onClick={() => handleResultClick({ type: "token", result: token })}
                          >
                            <div className="flex items-start space-x-3">
                              {/* Token Icon */}
                              <div className="relative flex-shrink-0">
                                {token.imageUrl ? (
                                  <img
                                    src={token.imageUrl}
                                    alt={token.name}
                                    className="w-10 h-10 rounded-full border border-gray-600"
                                    onError={(e) => {
                                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.symbol}&background=1f2937&color=60a5fa&size=40`;
                                    }}
                                  />
                                ) : (
                                  <img
                                    src={`https://ui-avatars.com/api/?name=${token.symbol}&background=1f2937&color=60a5fa&size=40`}
                                    alt={token.name}
                                    className="w-10 h-10 rounded-full border border-gray-600"
                                  />
                                )}
                                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800"></div>
                              </div>
                              
                              {/* Token Info - Inline Layout */}
                              <div className="flex-1 min-w-0">
                                {/* First Row: Symbol, Name, Price */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <span className="font-bold text-gray-200 truncate">{token.symbol}</span>
                                    <span className="text-sm text-gray-400 truncate">({token.name})</span>
                                  </div>
                                  <div className="flex items-center space-x-2 text-sm">
                                    <span className="text-gray-300">
                                      ${token.priceUsd ? parseFloat(token.priceUsd).toFixed(6) : "0.000000"}
                                    </span>
                                    {token.priceChange?.h24 && (
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        parseFloat(token.priceChange.h24.toString()) > 0 
                                          ? 'bg-green-500/20 text-green-400' 
                                          : 'bg-red-500/20 text-red-400'
                                      }`}>
                                        {parseFloat(token.priceChange.h24.toString()) > 0 ? '+' : ''}{parseFloat(token.priceChange.h24.toString()).toFixed(2)}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Second Row: Market Cap, Volume, Transactions */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                                    <span>MC: ${formatNumber(token.marketCap)}</span>
                                    {token.volume?.h24 && (
                                      <span>Vol: ${formatNumber(token.volume.h24)}</span>
                                    )}
                                    {token.txns?.h24 && (
                                      <span>{token.txns.h24.buys + token.txns.h24.sells} txns</span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Third Row: Enhanced Metrics */}
                                {token.metrics && (
                                  <div className="flex flex-wrap gap-2">
                                    {/* Buy ratio indicator */}
                                    {token.metrics.buyRatio24h > 0 && (
                                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                                        token.metrics.buyRatio24h > 0.6 ? 'bg-green-500/20 text-green-400' : 
                                        token.metrics.buyRatio24h > 0.4 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                                      }`}>
                                        Buy: {(token.metrics.buyRatio24h * 100).toFixed(0)}%
                                      </span>
                                    )}
                                    {/* Volume change */}
                                    {token.metrics.volumeChange24h !== 0 && (
                                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                                        token.metrics.volumeChange24h > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                                      }`}>
                                        Vol: {token.metrics.volumeChange24h > 0 ? '+' : ''}{token.metrics.volumeChange24h.toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Wallets */}
                {results.wallets.length > 0 && (
                  <div className="mb-4">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 sticky top-0 bg-gray-800/95 backdrop-blur-sm z-10">
                      Wallets ({results.wallets.length})
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {results.wallets.map((wallet, index) => {
                        const globalIndex = results.tokens.length + index;
                        const isSelected = selectedIndex === globalIndex;
                        
                        return (
                          <motion.div
                            key={wallet.address}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-3 hover:bg-blue-500/20 cursor-pointer border-b border-gray-700/50 last:border-b-0 transition-all duration-200 ${
                              isSelected ? "bg-blue-500/20" : ""
                            }`}
                            onClick={() => handleResultClick({ type: "wallet", result: wallet })}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                {getResultIcon("wallet")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm text-gray-200 truncate">
                                  {wallet.address}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {wallet.balance ? `${parseFloat(wallet.balance).toFixed(4)} ETH` : "0 ETH"} • {wallet.transactionCount || 0} txs
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Transactions */}
                {results.transactions.length > 0 && (
                  <div className="mb-4">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 sticky top-0 bg-gray-800/95 backdrop-blur-sm z-10">
                      Transactions ({results.transactions.length})
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {results.transactions.map((tx, index) => {
                        const globalIndex = results.tokens.length + results.wallets.length + index;
                        const isSelected = selectedIndex === globalIndex;
                        
                        return (
                          <motion.div
                            key={tx.hash}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-3 hover:bg-blue-500/20 cursor-pointer border-b border-gray-700/50 last:border-b-0 transition-all duration-200 ${
                              isSelected ? "bg-blue-500/20" : ""
                            }`}
                            onClick={() => handleResultClick({ type: "transaction", result: tx })}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                {getResultIcon("transaction")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm text-gray-200 truncate">
                                  {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  Block {tx.blockNumber} • {tx.status === 1 ? "Success" : "Failed"}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Blocks */}
                {results.blocks.length > 0 && (
                  <div className="mb-4">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700/50 sticky top-0 bg-gray-800/95 backdrop-blur-sm z-10">
                      Blocks ({results.blocks.length})
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {results.blocks.map((block, index) => {
                        const globalIndex = results.tokens.length + results.wallets.length + results.transactions.length + index;
                        const isSelected = selectedIndex === globalIndex;
                        
                        return (
                          <motion.div
                            key={block.number}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-3 hover:bg-blue-500/20 cursor-pointer border-b border-gray-700/50 last:border-b-0 transition-all duration-200 ${
                              isSelected ? "bg-blue-500/20" : ""
                            }`}
                            onClick={() => handleResultClick({ type: "block", result: block })}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                {getResultIcon("block")}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-200">
                                  Block #{block.number}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {block.transactions || 0} transactions • {block.timestamp ? new Date(block.timestamp).toLocaleString() : "Unknown time"}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlobalSearch;
