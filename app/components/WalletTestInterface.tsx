"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaWallet, FaDownload, FaUpload, FaHistory, FaChartLine, FaCopy } from "react-icons/fa";
import Image from "next/image";

// Sample data for testing
const sampleTokenHoldings = [
  {
    contractAddress: "0x4200000000000000000000000000000000000006",
    name: "Wrapped Ether",
    symbol: "WETH",
    balance: "2.5",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/2518/thumb/weth.png",
    usdValue: 7500,
    priceUsd: 3000,
    priceChange24h: 2.5
  },
  {
    contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    name: "USD Coin",
    symbol: "USDC",
    balance: "1000",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png",
    usdValue: 1000,
    priceUsd: 1.00,
    priceChange24h: 0.1
  },
  {
    contractAddress: "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22",
    name: "Coinbase Wrapped Staked ETH",
    symbol: "cbETH",
    balance: "1.2",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/27045/thumb/cbeth.png",
    usdValue: 3600,
    priceUsd: 3000,
    priceChange24h: 1.8
  }
];

const sampleTransactions = [
  {
    hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    from: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    to: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    value: "0x0",
    asset: "WETH",
    category: "erc20",
    timestamp: Date.now() - 3600000, // 1 hour ago
    blockNumber: "12345678",
    type: 'incoming' as const,
    description: "Received 0.5 WETH",
    amount: "0.5",
    status: 'confirmed' as const,
    priceAtTime: 3000,
    usdValue: 1500
  },
  {
    hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    from: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    to: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    value: "0x0",
    asset: "USDC",
    category: "erc20",
    timestamp: Date.now() - 7200000, // 2 hours ago
    blockNumber: "12345677",
    type: 'outgoing' as const,
    description: "Sent 500 USDC",
    amount: "500",
    status: 'confirmed' as const,
    priceAtTime: 1.00,
    usdValue: 500
  }
];

const samplePnLData = [
  {
    tokenAddress: "0x4200000000000000000000000000000000000006",
    tokenSymbol: "WETH",
    totalBought: 3.0,
    totalSold: 0.5,
    currentHolding: 2.5,
    averageBuyPrice: 2800,
    currentPrice: 3000,
    unrealizedPnL: 500,
    unrealizedPnLPercentage: 7.14,
    realizedPnL: 100,
    totalPnL: 600
  },
  {
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    tokenSymbol: "USDC",
    totalBought: 1500,
    totalSold: 500,
    currentHolding: 1000,
    averageBuyPrice: 1.00,
    currentPrice: 1.00,
    unrealizedPnL: 0,
    unrealizedPnLPercentage: 0,
    realizedPnL: 0,
    totalPnL: 0
  }
];

export default function WalletTestInterface() {
  const [activeTab, setActiveTab] = useState<"overview" | "holdings" | "transactions" | "pnl">("overview");
  const [isOpen, setIsOpen] = useState(false);

  const totalPortfolioValue = sampleTokenHoldings.reduce((sum, token) => sum + token.usdValue, 0) + 7500; // + ETH value
  const ethBalance = "2.5";
  const ethPrice = 3000;

  // Format USD values
  const formatUSD = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}k`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-full shadow-lg transition-all duration-200 flex items-center space-x-2"
        >
          <FaWallet className="w-5 h-5" />
          <span>Test Enhanced Wallet</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FaWallet className="text-blue-400 text-xl" />
              <h2 className="text-xl font-bold text-gray-100">Enhanced Wallet Interface (Demo)</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* Wallet Address */}
          <div className="mt-3 flex items-center space-x-3">
            <div className="flex-1 bg-gray-700 rounded-lg px-3 py-2 font-mono text-sm text-gray-200">
              0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6
            </div>
            <button
              onClick={() => navigator.clipboard.writeText("0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6")}
              className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded-lg text-white text-sm transition-colors"
            >
              <FaCopy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="flex space-x-1 px-6">
            {[
              { id: "overview", label: "Overview", icon: FaWallet },
              { id: "holdings", label: "Holdings", icon: FaDownload },
              { id: "transactions", label: "Transactions", icon: FaHistory },
              { id: "pnl", label: "PnL", icon: FaChartLine }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-gray-900 text-blue-400 border-b-2 border-blue-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Portfolio Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-gray-400 text-sm font-medium">Total Portfolio</h3>
                    <p className="text-2xl font-bold text-gray-100">{formatUSD(totalPortfolioValue)}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-gray-400 text-sm font-medium">ETH Balance</h3>
                    <p className="text-2xl font-bold text-blue-400">{ethBalance} ETH</p>
                    <p className="text-sm text-gray-400">{formatUSD(parseFloat(ethBalance) * ethPrice)}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-gray-400 text-sm font-medium">Token Holdings</h3>
                    <p className="text-2xl font-bold text-purple-400">{sampleTokenHoldings.length}</p>
                    <p className="text-sm text-gray-400">Different tokens</p>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">Recent Transactions</h3>
                  <div className="space-y-3">
                    {sampleTransactions.map((tx) => (
                      <div key={tx.hash} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            tx.type === 'incoming' ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}>
                            {tx.type === 'incoming' ? (
                              <FaDownload className="w-4 h-4 text-green-400" />
                            ) : (
                              <FaUpload className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-200">{tx.description}</p>
                            <p className="text-sm text-gray-400">{formatTimeAgo(tx.timestamp)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-200">{tx.amount} {tx.asset}</p>
                          <p className="text-sm text-gray-400">{formatUSD(tx.usdValue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Holdings Tab */}
            {activeTab === "holdings" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-100">Token Holdings</h3>
                <div className="space-y-3">
                  {sampleTokenHoldings.map((token) => (
                    <div key={token.contractAddress} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Image
                              src={token.logo}
                              alt={token.symbol}
                              width={40}
                              height={40}
                              className="rounded-full"
                              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.symbol}&background=1f2937&color=60a5fa&size=40`;
                              }}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-100">{token.name}</p>
                            <p className="text-sm text-gray-400">{token.symbol}</p>
                            {token.priceChange24h !== undefined && (
                              <p className={`text-xs ${
                                token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}% (24h)
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-100">{parseFloat(token.balance).toFixed(4)}</p>
                          <p className="text-sm text-gray-400">${token.priceUsd.toFixed(6)}</p>
                          <p className="text-sm font-medium text-blue-400">{formatUSD(token.usdValue)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === "transactions" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-100">Transaction History</h3>
                <div className="space-y-3">
                  {sampleTransactions.map((tx) => (
                    <div key={tx.hash} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            tx.type === 'incoming' ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}>
                            {tx.type === 'incoming' ? (
                              <FaDownload className="w-5 h-5 text-green-400" />
                            ) : (
                              <FaUpload className="w-5 h-5 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-100">{tx.description}</p>
                            <p className="text-sm text-gray-400">{formatTimeAgo(tx.timestamp)}</p>
                            <p className="text-xs text-gray-500 font-mono">{tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-100">{tx.amount} {tx.asset}</p>
                          <p className="text-sm text-gray-400">{formatUSD(tx.usdValue)}</p>
                          {tx.priceAtTime && (
                            <p className="text-xs text-gray-500">${tx.priceAtTime.toFixed(6)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PnL Tab */}
            {activeTab === "pnl" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-100">Profit & Loss Analysis</h3>
                <div className="space-y-3">
                  {samplePnLData.map((pnl) => (
                    <div key={pnl.tokenAddress} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-100">{pnl.tokenSymbol}</h4>
                        <div className={`text-sm font-medium ${
                          pnl.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {pnl.totalPnL >= 0 ? '+' : ''}{formatUSD(pnl.totalPnL)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Current Holding</p>
                          <p className="text-gray-100">{pnl.currentHolding.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Avg Buy Price</p>
                          <p className="text-gray-100">${pnl.averageBuyPrice.toFixed(6)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Current Price</p>
                          <p className="text-gray-100">${pnl.currentPrice.toFixed(6)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Unrealized PnL</p>
                          <p className={`${
                            pnl.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {pnl.unrealizedPnL >= 0 ? '+' : ''}{formatUSD(pnl.unrealizedPnL)} ({pnl.unrealizedPnLPercentage.toFixed(2)}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
