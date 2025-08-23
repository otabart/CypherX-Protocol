"use client";

import React, { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../../../../lib/firebase.ts";
import { doc, getDoc, setDoc, query, where, getDocs, collection } from "firebase/firestore";
import {
  FiSearch,
  FiRefreshCw,
  FiFilter,
  FiEye,
  FiHash,
  FiClock,
  FiActivity,
  FiZap,
  FiDatabase,
  FiArrowRight,
  FiArrowLeft,
  FiGrid,
  FiList,
  FiBarChart,
} from "react-icons/fi";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";

interface Block {
  number: number;
  status: string;
  timestamp: string;
  hash: string;
  transactions: number;
}

const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL || "";

export default function CypherScanPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showStats, setShowStats] = useState<boolean>(true);
  const router = useRouter();
  const blocksPerPage = 50;

  const fetchBlocks = async (startPage: number) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch the latest block number
      const alchemyBlockRes = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });

      if (!alchemyBlockRes.ok) {
        const errorText = await alchemyBlockRes.text();
        throw new Error(`Alchemy API error: ${alchemyBlockRes.status} - ${errorText}`);
      }

      const alchemyBlockData = await alchemyBlockRes.json();
      if (!alchemyBlockData?.result) {
        throw new Error("Invalid Alchemy block number response: No result found");
      }

      const latestBlock = parseInt(alchemyBlockData.result, 16) || 0;
      if (latestBlock <= 0) {
        throw new Error("Invalid latest block number");
      }

      // Calculate the range for the last 100 blocks, adjusted for pagination
      const totalBlocksToFetch = 100;
      const startBlock = Math.max(latestBlock - totalBlocksToFetch + 1, 0);
      const endBlock = latestBlock;

      // Adjust for pagination
      const startIndex = (startPage - 1) * blocksPerPage;
      const blocksToFetch = Math.min(blocksPerPage, totalBlocksToFetch - startIndex);
      const fetchedBlocks: Block[] = [];

      // Fetch blocks in parallel for much faster loading
      const blockPromises = [];
      for (let i = 0; i < blocksToFetch; i++) {
        const blockNumber = endBlock - (startIndex + i);
        if (blockNumber < startBlock) break;

        blockPromises.push((async () => {
          // Check Firestore first
          const blockRef = doc(db, "blocks", blockNumber.toString());
          const blockSnap = await getDoc(blockRef);

          if (blockSnap.exists()) {
            const blockData = blockSnap.data() as Block;
            return { blockNumber, blockData };
          }

          // Fetch from Alchemy if not in Firestore
          const blockRes = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getBlockByNumber",
              params: [`0x${blockNumber.toString(16)}`, false],
              id: 1,
            }),
          });

          if (!blockRes.ok) {
            console.warn(`Failed to fetch block ${blockNumber}`);
            return null;
          }

          const blockData = await blockRes.json();
          const block = blockData?.result;

          if (block) {
            const timestamp = new Date(parseInt(block.timestamp, 16) * 1000);
            const timeAgo = formatDistanceToNow(timestamp, {
              addSuffix: true,
              includeSeconds: false,
            })
              .toUpperCase()
              .replace("LESS THAN A MINUTE", "1 MINUTE");
            const blockInfo: Block = {
              number: blockNumber,
              status: "Finalized",
              timestamp: timeAgo,
              hash: block.hash,
              transactions: block.transactions?.length || 0,
            };

            // Store in Firestore in background (don't wait for it)
            setDoc(blockRef, blockInfo).catch((writeError: unknown) => {
              const errorMessage = writeError instanceof Error ? writeError.message : "Unknown error";
              console.warn(`Failed to store block ${blockNumber} in Firestore: ${errorMessage}`);
            });

            return { blockNumber, blockData: blockInfo };
          }
          return null;
        })());
      }

      // Wait for all blocks to be fetched
      const results = await Promise.all(blockPromises);
      
      // Sort results by block number and add to fetchedBlocks
      results
        .filter(result => result !== null)
        .sort((a, b) => b!.blockNumber - a!.blockNumber)
        .forEach(result => {
          if (result) {
            fetchedBlocks.push(result.blockData);
          }
        });

      setBlocks(fetchedBlocks);
      if (fetchedBlocks.length === 0) {
        setError("No blocks found in the fetched range");
      }
    } catch (err: unknown) {
      console.error("Fetch blocks error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    try {
      if (/^\d+$/.test(searchQuery)) {
        router.push(`/explorer/latest/block/${searchQuery}`);
      } else if (/^0x[a-fA-F0-9]{64}$/.test(searchQuery)) {
        const blocksRef = collection(db, "blocks");
        const q = query(blocksRef, where("hash", "==", searchQuery));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          router.push(`/explorer/latest/hash/${searchQuery}`);
        } else {
          setError("Block hash not found in local database");
        }
      } else {
        setError("Invalid search: Enter a block number or valid hash");
      }
    } catch (err: unknown) {
      console.error("Search error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError("Failed to search: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchBlocks(page);
  };

  const filteredBlocks = blocks.filter((block) =>
    filterStatus === "All" ? true : block.status === filterStatus
  );

  const totalTransactions = blocks.reduce((sum, block) => sum + block.transactions, 0);
  const averageTransactions = blocks.length > 0 ? Math.round(totalTransactions / blocks.length) : 0;
  const latestBlockNumber = blocks.length > 0 ? Math.max(...blocks.map(b => b.number)) : 0;

  useEffect(() => {
    if (!db) {
      setError("Firestore is not initialized");
      return;
    }
    if (alchemyUrl) {
      fetchBlocks(page);
    } else {
      setError("Alchemy URL is not configured");
    }
  }, [page]);

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #4B5563;
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #6B7280;
        }
        .scrollbar-track-transparent::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
      <Header />
      
      {/* Separator line between header and main content */}
      <div className="h-px bg-gray-800"></div>
      
      <main className="flex-1 container mx-auto px-4 py-8 pb-8 overflow-hidden">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 flex items-center">
                <FiDatabase className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 text-blue-400" />
                Block Explorer
              </h1>
              <p className="text-gray-400 text-sm sm:text-base">Real-time blockchain data from Base network</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowStats(!showStats)}
                className="p-2 bg-gray-800 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                title="Toggle Statistics"
              >
                <FiBarChart className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
                className="p-2 bg-gray-800 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                title={`Switch to ${viewMode === "list" ? "Grid" : "List"} View`}
              >
                {viewMode === "list" ? <FiGrid className="w-4 h-4 sm:w-5 sm:h-5" /> : <FiList className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Statistics Cards */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 sm:p-6 text-white"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-200 text-xs sm:text-sm font-medium">Latest Block</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold">{latestBlockNumber.toLocaleString()}</p>
                  </div>
                  <FiHash className="w-6 h-6 sm:w-8 sm:h-8 text-blue-200" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-4 sm:p-6 text-white"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-200 text-xs sm:text-sm font-medium">Total Transactions</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold">{totalTransactions.toLocaleString()}</p>
                  </div>
                  <FiActivity className="w-6 h-6 sm:w-8 sm:h-8 text-green-200" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4 sm:p-6 text-white"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-xs sm:text-sm font-medium">Avg Transactions</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold">{averageTransactions}</p>
                  </div>
                  <FiActivity className="w-6 h-6 sm:w-8 sm:h-8 text-purple-200" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-lg p-4 sm:p-6 text-white"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-200 text-xs sm:text-sm font-medium">Blocks Loaded</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold">{blocks.length}</p>
                  </div>
                  <FiZap className="w-6 h-6 sm:w-8 sm:h-8 text-orange-200" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search and Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 mb-8 border border-gray-700"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <form onSubmit={handleSearch} className="flex-1 w-full">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by block number or hash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </form>

            <div className="flex items-center gap-3">
              <div className="relative">
                <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-10 pr-8 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Finalized">Finalized</option>
                </select>
              </div>

              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiRefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </motion.div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                Error: {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Blocks Display */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 overflow-hidden"
        >
          {/* Table Header */}
          <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Latest Blocks</h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <FiEye className="w-4 h-4" />
                Showing {filteredBlocks.length} of {blocks.length} blocks
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-400">Loading blocks...</span>
              </div>
            </div>
          )}

          {/* Blocks Table/Grid */}
          {!loading && (
            <div className="overflow-x-auto max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
              {viewMode === "list" ? (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-800/50 text-gray-300 text-sm">
                      <th className="px-6 py-4 text-left font-medium">Block</th>
                      <th className="px-6 py-4 text-left font-medium">Status</th>
                      <th className="px-6 py-4 text-left font-medium">Timestamp</th>
                      <th className="px-6 py-4 text-left font-medium">Hash</th>
                      <th className="px-6 py-4 text-left font-medium">Transactions</th>
                      <th className="px-6 py-4 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredBlocks.map((block, index) => (
                        <motion.tr
                          key={block.number}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <Link
                              href={`/explorer/latest/block/${block.number}`}
                              className="text-blue-400 hover:text-blue-300 font-mono font-medium"
                            >
                              #{block.number.toLocaleString()}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-500/30">
                              <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                              {block.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                            <div className="flex items-center gap-2">
                              <FiClock className="w-4 h-4" />
                              {block.timestamp}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              href={`/explorer/latest/hash/${block.hash}`}
                              className="text-blue-400 hover:text-blue-300 font-mono text-sm truncate block max-w-xs"
                            >
                              {block.hash}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400 border border-blue-500/30">
                              {block.transactions} txns
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              href={`/explorer/latest/block/${block.number}`}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
                            >
                              View
                              <FiArrowRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                  <AnimatePresence>
                    {filteredBlocks.map((block, index) => (
                      <motion.div
                        key={block.number}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Link
                            href={`/explorer/latest/block/${block.number}`}
                            className="text-blue-400 hover:text-blue-300 font-mono font-medium"
                          >
                            #{block.number.toLocaleString()}
                          </Link>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-500/30">
                            <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                            {block.status}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-400">
                            <FiClock className="w-4 h-4" />
                            {block.timestamp}
                          </div>
                          
                          <div className="flex items-center gap-2 text-gray-400">
                            <FiActivity className="w-4 h-4" />
                            {block.transactions} transactions
                          </div>
                          
                          <div className="pt-2">
                            <Link
                              href={`/explorer/latest/block/${block.number}`}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors"
                            >
                              View Details
                              <FiArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          <div className="bg-gray-800/50 px-6 py-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiArrowLeft className="w-4 h-4" />
                Previous
              </button>
              
              <span className="text-gray-400 font-medium">Page {page}</span>
              
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || blocks.length < blocksPerPage}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <FiArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer - Fixed at bottom */}
      <div className="flex-shrink-0">
        <Footer />
      </div>
    </div>
  );
}