"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../../../../lib/firebase.ts";
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
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiInfo,
  FiArrowUpRight,
  FiMinus,
  FiPlus,
} from "react-icons/fi";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";

interface Transaction {
  hash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  nonce: number;
  input: string;
  transactionIndex: number;
  status: "success" | "failed" | "pending";
  timestamp: string;
  receipt: {
    status: string;
    gasUsed: string;
    logs: Array<{
      address: string;
      topics: string[];
      data: string;
      logIndex: string;
      transactionIndex: string;
      transactionHash: string;
      blockHash: string;
      blockNumber: string;
    }>;
    contractAddress?: string;
  };
}

const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL || "";

export default function TransactionDetails() {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const router = useRouter();
  const params = useParams();
  const txHash = params.txHash as string;

  const fetchTransaction = useCallback(async () => {
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
      const txRef = doc(db, "transactions", txHash);
      const txSnap = await getDoc(txRef);

      if (txSnap.exists()) {
        const txData = txSnap.data() as Transaction;
        setTransaction(txData);
        console.log(`Transaction ${txHash} loaded from Firestore`);
        return;
      }

      // Fetch from Alchemy if not in Firestore
      const response = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionByHash",
          params: [txHash],
          id: 1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alchemy API error: ${response.status} - ${errorText}`);
      }

      const txData = await response.json();
      if (!txData?.result) {
        throw new Error("Transaction not found");
      }

      const tx = txData.result;
      
      // Get transaction receipt
      const receiptResponse = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [txHash],
          id: 1,
        }),
      });

      const receiptData = await receiptResponse.json();
      const receipt = receiptData?.result;

      const timestamp = new Date(parseInt(tx.blockNumber, 16) * 1000);
      const timeAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);

      const transactionInfo: Transaction = {
        hash: tx.hash || txHash,
        blockNumber: parseInt(tx.blockNumber, 16) || 0,
        blockHash: tx.blockHash || "N/A",
        from: tx.from || "N/A",
        to: tx.to || "N/A",
        value: tx.value ? (parseInt(tx.value, 16) / 1e18).toString() : "0",
        gas: parseInt(tx.gas, 16).toString() || "0",
        gasPrice: tx.gasPrice ? (parseInt(tx.gasPrice, 16) / 1e9).toString() : "0",
        gasUsed: receipt?.gasUsed ? parseInt(receipt.gasUsed, 16).toString() : "0",
        nonce: parseInt(tx.nonce, 16) || 0,
        input: tx.input || "0x",
        transactionIndex: parseInt(tx.transactionIndex, 16) || 0,
        status: receipt?.status === "0x1" ? "success" : receipt?.status === "0x0" ? "failed" : "pending",
        timestamp: `${timeAgo} SEC${timeAgo === 1 ? "" : "S"} AGO`,
        receipt: {
          status: receipt?.status || "0x0",
          gasUsed: receipt?.gasUsed ? parseInt(receipt.gasUsed, 16).toString() : "0",
          logs: receipt?.logs || [],
          contractAddress: receipt?.contractAddress,
        },
      };

      setTransaction(transactionInfo);

      // Store in Firestore
      try {
        await setDoc(txRef, transactionInfo);
        console.log(`Transaction ${txHash} stored in Firestore`);
      } catch (writeError: unknown) {
        const errorMessage = writeError instanceof Error ? writeError.message : "Unknown error";
        console.warn("Failed to write transaction to Firestore:", errorMessage);
      }
    } catch (err: unknown) {
      console.error("Fetch transaction error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to fetch transaction: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [txHash]);

  useEffect(() => {
    if (!txHash) {
      router.push("/explorer");
      return;
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      setError("Invalid transaction hash format");
      return;
    }

    fetchTransaction();
  }, [txHash, router, fetchTransaction]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <FiCheckCircle className="w-5 h-5 text-green-400" />;
      case "failed":
        return <FiXCircle className="w-5 h-5 text-red-400" />;
      case "pending":
        return <FiClock className="w-5 h-5 text-yellow-400" />;
      default:
        return <FiInfo className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-900/30 text-green-400 border-green-500/30";
      case "failed":
        return "bg-red-900/30 text-red-400 border-red-500/30";
      case "pending":
        return "bg-yellow-900/30 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-gray-900/30 text-gray-400 border-gray-500/30";
    }
  };

  const formatValue = (value: string) => {
    const numValue = parseFloat(value);
    if (numValue === 0) return "0 ETH";
    if (numValue < 0.001) return `${numValue.toFixed(6)} ETH`;
    if (numValue < 1) return `${numValue.toFixed(4)} ETH`;
    return `${numValue.toFixed(4)} ETH`;
  };

  const formatGasPrice = (gasPrice: string) => {
    const numPrice = parseFloat(gasPrice);
    if (numPrice < 1) return `${(numPrice * 1000).toFixed(2)} Gwei`;
    return `${numPrice.toFixed(2)} Gwei`;
  };

  const calculateGasCost = () => {
    if (!transaction) return "0 ETH";
    const gasUsed = parseInt(transaction.gasUsed);
    const gasPrice = parseFloat(transaction.gasPrice);
    const cost = (gasUsed * gasPrice * 1e-9) / 1e18;
    return `${cost.toFixed(8)} ETH`;
  };

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
                href="/explorer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <FiArrowLeft className="w-4 h-4" />
                Back to Explorer
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
                  <FiActivity className="w-6 h-6 mr-3 text-blue-400" />
                  Transaction Details
                </h1>
                <p className="text-gray-400">Detailed transaction information from Base network</p>
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
                <FiAlertCircle className="w-5 h-5" />
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
              <span className="text-gray-400">Loading transaction details...</span>
            </div>
          </motion.div>
        )}

        {/* Transaction Details */}
        {!loading && transaction && (
          <div className="space-y-6">
            {/* Transaction Overview Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FiHash className="w-5 h-5 text-blue-400" />
                  Transaction Overview
                </h2>
                <div className="flex items-center gap-3">
                  {getStatusIcon(transaction.status)}
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(transaction.status)}`}>
                    {transaction.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Transaction Hash</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white font-mono text-sm truncate">{transaction.hash}</span>
                      <button
                        onClick={() => copyToClipboard(transaction.hash, "hash")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "hash" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Block Number</span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/explorer/latest/block/${transaction.blockNumber}`}
                        className="text-blue-400 hover:text-blue-300 font-mono font-medium"
                      >
                        #{transaction.blockNumber.toLocaleString()}
                      </Link>
                      <a
                        href={`/explorer/latest/block/${transaction.blockNumber}`}
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
                      <span className="text-white">{transaction.timestamp}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Value</span>
                    <div className="flex items-center gap-2">
                      <FiActivity className="w-4 h-4 text-green-400" />
                      <span className="text-white font-medium">{formatValue(transaction.value)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">From Address</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white font-mono text-sm truncate">{transaction.from}</span>
                      <button
                        onClick={() => copyToClipboard(transaction.from, "from")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "from" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                      <a
                        href={`/explorer/address/${transaction.from}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">To Address</span>
                    <div className="flex items-center gap-2 max-w-xs">
                      <span className="text-white font-mono text-sm truncate">{transaction.to}</span>
                      <button
                        onClick={() => copyToClipboard(transaction.to, "to")}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {copiedField === "to" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                      </button>
                      <a
                        href={`/explorer/address/${transaction.to}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Nonce</span>
                    <span className="text-white font-mono">{transaction.nonce}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Transaction Index</span>
                    <span className="text-white font-mono">{transaction.transactionIndex}</span>
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

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Gas Used</span>
                  <p className="text-2xl font-bold text-white">{parseInt(transaction.gasUsed).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Gas Limit</span>
                  <p className="text-2xl font-bold text-white">{parseInt(transaction.gas).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Gas Price</span>
                  <p className="text-xl font-bold text-white">{formatGasPrice(transaction.gasPrice)}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-gray-400 text-sm">Total Cost</span>
                  <p className="text-xl font-bold text-white">{calculateGasCost()}</p>
                </div>
              </div>

              {/* Gas Usage Progress Bar */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Gas Usage</span>
                  <span className="text-white text-sm">
                    {Math.round((parseInt(transaction.gasUsed) / parseInt(transaction.gas)) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min((parseInt(transaction.gasUsed) / parseInt(transaction.gas)) * 100, 100)}%` 
                    }}
                  ></div>
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
                        <span className="text-gray-400">Block Hash</span>
                        <div className="flex items-center gap-2 max-w-xs">
                          <span className="text-white font-mono text-sm truncate">{transaction.blockHash}</span>
                          <button
                            onClick={() => copyToClipboard(transaction.blockHash, "blockHash")}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            {copiedField === "blockHash" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Input Data</span>
                        <span className="text-white font-mono text-sm">
                          {transaction.input === "0x" ? "No Data" : `${transaction.input.slice(0, 20)}...`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Receipt Status</span>
                        <span className="text-white font-mono text-sm">{transaction.receipt.status}</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {transaction.receipt.contractAddress && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Contract Created</span>
                          <div className="flex items-center gap-2 max-w-xs">
                            <span className="text-white font-mono text-sm truncate">{transaction.receipt.contractAddress}</span>
                            <button
                              onClick={() => copyToClipboard(transaction.receipt.contractAddress!, "contract")}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              {copiedField === "contract" ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                            </button>
                            <a
                              href={`/explorer/address/${transaction.receipt.contractAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <FiExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Logs Count</span>
                        <span className="text-white font-mono">{transaction.receipt.logs.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Logs */}
                  {transaction.receipt.logs.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Transaction Logs</h3>
                        <button
                          onClick={() => setShowLogs(!showLogs)}
                          className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
                        >
                          {showLogs ? <FiMinus className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
                          {showLogs ? "Hide" : "Show"} Logs
                        </button>
                      </div>
                      
                      <AnimatePresence>
                        {showLogs && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2"
                          >
                            {transaction.receipt.logs.map((log, index) => (
                              <div key={index} className="bg-gray-700/50 rounded p-3 text-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-gray-400">Log #{index + 1}</span>
                                  <span className="text-gray-400">Address: {log.address}</span>
                                </div>
                                <div className="text-white font-mono text-xs break-all">
                                  {log.data}
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* External Links */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6"
            >
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <FiExternalLink className="w-5 h-5 text-green-400" />
                External Links
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href={`/explorer/tx/${transaction.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FiExternalLink className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-white font-medium">View Transaction</p>
                      <p className="text-gray-400 text-sm">Our blockchain explorer</p>
                    </div>
                  </div>
                  <FiArrowUpRight className="w-5 h-5 text-gray-400" />
                </a>

                <a
                  href={`/explorer/latest/block/${transaction.blockNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FiDatabase className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-white font-medium">View Block</p>
                      <p className="text-gray-400 text-sm">Block #{transaction.blockNumber}</p>
                    </div>
                  </div>
                  <FiArrowUpRight className="w-5 h-5 text-gray-400" />
                </a>
              </div>
            </motion.div>
          </div>
        )}

        {/* No Transaction Data */}
        {!loading && !transaction && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <FiActivity className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No transaction data available</p>
            <p className="text-gray-500 text-sm mt-2">Please check the transaction hash or try again later.</p>
          </motion.div>
        )}
      </main>

      <Footer />
    </div>
  );
}
