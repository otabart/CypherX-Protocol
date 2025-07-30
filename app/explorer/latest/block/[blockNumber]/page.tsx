"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../../../lib/firebase.ts";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  FiArrowLeft,
  FiHash,
  FiClock,
  FiActivity,
  FiCopy,
  FiCheck,
  FiExternalLink,
  FiDatabase,
  FiZap,
  FiSettings,
  FiEye,
} from "react-icons/fi";
import Header from "../../../../components/Header";
import Footer from "../../../../components/Footer";

interface Transaction {
  hash: string;
  from: string;
  to: string;
}

interface Block {
  number: number;
  status: string;
  timestamp: string;
  hash: string;
  transactions: number;
  parentHash: string;
  miner: string;
  gasUsed: string;
  gasLimit: string;
  difficulty: string;
  totalDifficulty: string;
  size: string;
  nonce: string;
  extraData: string;
  transactionList?: Transaction[];
}

const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL || "";

export default function BlockDetails() {
  const [block, setBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const router = useRouter();
  const params = useParams();
  const blockNumber = params.blockNumber as string;

  const fetchBlock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!db) {
        throw new Error("Firestore is not initialized. Check Firebase configuration.");
      }

      if (!alchemyUrl) {
        throw new Error("Alchemy API URL is not configured.");
      }

      // Check Firestore first
      const blockRef = doc(db, "blocks", blockNumber);
      const blockSnap = await getDoc(blockRef);

      if (blockSnap.exists()) {
        const blockData = blockSnap.data() as Block;
        setBlock(blockData);
        console.log(`Block ${blockNumber} loaded from Firestore`);
        return;
      }

      // Fetch from Alchemy if not in Firestore
      const response = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBlockByNumber",
          params: [`0x${parseInt(blockNumber, 10).toString(16)}`, true],
          id: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alchemy API error: ${response.status} - ${errorText}`);
      }

      const blockData = await response.json();
      if (!blockData?.result) {
        throw new Error("Block not found in Alchemy response");
      }

      const block = blockData.result;
      const timestamp = new Date(parseInt(block.timestamp, 16) * 1000);
      const timeAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);

      const blockInfo: Block = {
        number: parseInt(block.number, 16),
        status: "Finalized",
        timestamp: `${timeAgo} SEC${timeAgo === 1 ? "" : "S"} AGO`,
        hash: block.hash || "N/A",
        transactions: block.transactions?.length || 0,
        parentHash: block.parentHash || "N/A",
        miner: block.miner || "N/A",
        gasUsed: parseInt(block.gasUsed, 16).toString() || "0",
        gasLimit: parseInt(block.gasLimit, 16).toString() || "0",
        difficulty: (parseInt(block.difficulty, 16) / 1e12).toFixed(2) + "T" || "0",
        totalDifficulty: (parseInt(block.totalDifficulty, 16) / 1e15).toFixed(2) + "P" || "0",
        size: block.size ? parseInt(block.size, 16).toString() + " bytes" : "0 bytes",
        nonce: block.nonce || "N/A",
        extraData: block.extraData || "N/A",
        transactionList: block.transactions?.map((tx: { hash?: string; from?: string; to?: string }) => ({
          hash: tx.hash || "N/A",
          from: tx.from || "N/A",
          to: tx.to || "N/A",
        })) || [],
      };

      setBlock(blockInfo);

      if (auth.currentUser) {
        try {
          await setDoc(blockRef, blockInfo);
          console.log(`Block ${blockNumber} stored in Firestore`);
        } catch (writeError: unknown) {
          const errorMessage = writeError instanceof Error ? writeError.message : "Unknown error";
          console.warn("Failed to write block to Firestore:", errorMessage);
        }
      } else {
        console.log("Skipping Firestore write: User not authenticated");
      }
    } catch (err: unknown) {
      console.error("Fetch block error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to fetch block: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [blockNumber]);

  useEffect(() => {
    if (!blockNumber) {
      router.push("/explorer/latest/block");
      return;
    }

    const blockNum = parseInt(blockNumber, 10);
    if (isNaN(blockNum) || blockNum < 0) {
      setError("Invalid block number: Must be a positive integer");
      router.push("/explorer/latest/block");
      return;
    }

    fetchBlock();
  }, [blockNumber, router, fetchBlock]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const gasUsedPercentage = block ? Math.round((parseInt(block.gasUsed) / parseInt(block.gasLimit)) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                href="/explorer/latest/block"
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <FiArrowLeft className="w-4 h-4" />
                Back to Blocks
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
                  <FiDatabase className="w-6 h-6 mr-3 text-blue-400" />
                  Block #{blockNumber}
                </h1>
                <p className="text-gray-400">Detailed block information from Base network</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="p-2 bg-gray-800 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                title="Toggle Advanced Details"
              >
                <FiSettings className="w-5 h-5" />
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

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-12"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-400">Loading block details...</span>
            </div>
          </motion.div>
        )}

        {/* Block Details */}
        {!loading && block && (
          <div className="space-y-6">
            {/* Block Overview Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FiHash className="w-5 h-5 text-blue-400" />
                  Block Overview
                </h2>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/30 text-green-400 border border-green-500/30">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  {block.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Block Number</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono font-medium">#{block.number.toLocaleString()}</span>
                      <a
                        href={`https://basescan.org/block/${block.number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Timestamp</span>
                    <div className="flex items-center gap-2">
                      <FiClock className="w-4 h-4 text-gray-400" />
                      <span className="text-white">{block.timestamp}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Transactions</span>
                    <div className="flex items-center gap-2">
                      <FiActivity className="w-4 h-4 text-gray-400" />
                      <span className="text-white font-medium">{block.transactions}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Block Hash</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white font-mono text-sm truncate">{block.hash}</span>
                      <button
                        onClick={() => copyToClipboard(block.hash, "hash")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "hash" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Parent Hash</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white font-mono text-sm truncate">{block.parentHash}</span>
                      <button
                        onClick={() => copyToClipboard(block.parentHash, "parentHash")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "parentHash" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Miner</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white font-mono text-sm truncate">{block.miner}</span>
                      <a
                        href={`https://basescan.org/address/${block.miner}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Gas Information Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6"
            >
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <FiZap className="w-5 h-5 text-orange-400" />
                Gas Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Gas Used</span>
                  <p className="text-2xl font-bold text-white">{parseInt(block.gasUsed).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Gas Limit</span>
                  <p className="text-2xl font-bold text-white">{parseInt(block.gasLimit).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Usage</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${gasUsedPercentage}%` }}
                      ></div>
                    </div>
                    <span className="text-white font-medium">{gasUsedPercentage}%</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Advanced Details */}
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6"
                >
                  <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                    <FiSettings className="w-5 h-5 text-purple-400" />
                    Advanced Details
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Difficulty</span>
                        <span className="text-white font-mono">{block.difficulty}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Total Difficulty</span>
                        <span className="text-white font-mono">{block.totalDifficulty}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Size</span>
                        <span className="text-white">{block.size}</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Nonce</span>
                        <span className="text-white font-mono text-sm">{block.nonce}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Extra Data</span>
                        <span className="text-white font-mono text-sm">{block.extraData}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Transactions Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <FiActivity className="w-5 h-5 text-green-400" />
                    Transactions ({block.transactions})
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <FiEye className="w-4 h-4" />
                    {block.transactionList?.length || 0} loaded
                  </div>
                </div>
              </div>

              {block.transactionList && block.transactionList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-800/50 text-gray-300 text-sm">
                        <th className="px-6 py-4 text-left font-medium">Hash</th>
                        <th className="px-6 py-4 text-left font-medium">From</th>
                        <th className="px-6 py-4 text-left font-medium">To</th>
                        <th className="px-6 py-4 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {block.transactionList.map((tx, index) => (
                          <motion.tr
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <Link
                                href={`/explorer/tx/${tx.hash}`}
                                className="text-blue-400 hover:text-blue-300 font-mono text-sm truncate block max-w-xs"
                              >
                                {tx.hash}
                              </Link>
                            </td>
                            <td className="px-6 py-4">
                              <Link
                                href={`/explorer/address/${tx.from}`}
                                className="text-blue-400 hover:text-blue-300 font-mono text-sm truncate block max-w-xs"
                              >
                                {tx.from}
                              </Link>
                            </td>
                            <td className="px-6 py-4">
                              <Link
                                href={`/explorer/address/${tx.to}`}
                                className="text-blue-400 hover:text-blue-300 font-mono text-sm truncate block max-w-xs"
                              >
                                {tx.to}
                              </Link>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/explorer/tx/${tx.hash}`}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors"
                                >
                                  <FiEye className="w-3 h-3" />
                                  View
                                </Link>
                                <a
                                  href={`https://basescan.org/tx/${tx.hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white transition-colors"
                                >
                                  <FiExternalLink className="w-3 h-3" />
                                  BaseScan
                                </a>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-8 text-center">
                  <FiActivity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No transactions in this block</p>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* No Block Data */}
        {!loading && !block && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <FiDatabase className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No block data available</p>
            <p className="text-gray-500 text-sm mt-2">Please check the block number or try again later.</p>
          </motion.div>
        )}
      </main>

      <Footer />
    </div>
  );
}