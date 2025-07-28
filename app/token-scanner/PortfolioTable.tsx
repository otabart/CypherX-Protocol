"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaClipboard, FaTrash, FaEdit, FaChartLine } from "react-icons/fa";
import type { TokenData, PortfolioItem } from "./page";
import { toast as reactToast } from "react-toastify";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface PortfolioTableProps {
  portfolio: PortfolioItem[];
  tokens: TokenData[];
  handleTokenClick: (pool: string) => void;
  handleRemoveFromPortfolio: (poolAddress: string) => Promise<void>;
  handleEditPortfolioEntry: (poolAddress: string, amount: number, purchasePrice: number) => Promise<void>;
  formatPrice: (price: string | number) => string;
  getColorClass: (value: number) => string;
  setEditingPortfolio: (item: PortfolioItem | null) => void;
  setPortfolioForm: (form: { poolAddress: string; amount: string; purchasePrice: string }) => void;
}

const PortfolioTable: React.FC<PortfolioTableProps> = ({
  portfolio,
  tokens,
  handleTokenClick,
  handleRemoveFromPortfolio,
  formatPrice,
  getColorClass,
  setEditingPortfolio,
  setPortfolioForm,
}) => {
  const rowVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const calculatePnL = (item: PortfolioItem, token: TokenData | undefined): number => {
    if (!token) return 0;
    const currentPrice = parseFloat(token.priceUsd || "0");
    return item.amount * (currentPrice - item.purchasePrice);
  };

  const calculateVolatility = (prices: number[]): number => {
    if (prices.length < 2) return 0;
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, p) => a + Math.pow(p - mean, 2), 0) / prices.length;
    return Math.sqrt(variance);
  };

  const handleCopy = (poolAddress: string) => {
    const token = tokens.find((t) => t.poolAddress === poolAddress);
    const address = token ? token.tokenAddress : poolAddress;
    if (address) {
      navigator.clipboard.writeText(address).then(() => {
        reactToast.success("Token address copied!");
      }).catch(() => reactToast.error("Copy failed"));
    } else {
      reactToast.error("No address available");
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="table-auto w-full whitespace-nowrap text-sm font-sans uppercase hidden md:table">
        <thead className="bg-gray-900 text-gray-400 sticky top-0 z-10 border-b border-blue-500/30">
          <tr>
            <th className="p-3 text-left" title="Token Pair">Token</th>
            <th className="p-3 text-right" title="Amount of tokens held">Amount</th>
            <th className="p-3 text-right" title="Purchase price per token">Purchase Price</th>
            <th className="p-3 text-right" title="Total invested">Total Invested</th>
            <th className="p-3 text-right" title="Current price per token">Current Price</th>
            <th className="p-3 text-right" title="Current value of holding">Current Value</th>
            <th className="p-3 text-right" title="Price change in last 24 hours">24H Change</th>
            <th className="p-3 text-right" title="Profit and Loss">P&L</th>
            <th className="p-3 text-right" title="Profit and Loss %">P&L %</th>
            <th className="p-3 text-center" title="Actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.map((item) => {
            const token = tokens.find((t) => t.poolAddress === item.poolAddress);
            const currentPrice = token ? parseFloat(token.priceUsd || "0") : 0;
            const value = item.amount * currentPrice;
            const invested = item.amount * item.purchasePrice;
            const pnl = calculatePnL(item, token);
            const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
            const roi = item.purchasePrice > 0 ? ((currentPrice / item.purchasePrice - 1) * 100) : 0;
            const prices = item.history?.map(h => h.price) || [];
            const volatility = calculateVolatility(prices);
            return (
              <React.Fragment key={item.poolAddress}>
                <motion.tr
                  variants={rowVariants}
                  initial="hidden"
                  animate="visible"
                  className="border-b border-blue-500/30 hover:bg-gray-800 transition-colors duration-200"
                >
                  <td className="p-3">
                    <div
                      className="flex items-center space-x-2 cursor-pointer"
                      onClick={() => handleTokenClick(item.poolAddress)}
                    >
                      {token?.info?.imageUrl && (
                        <img
                          src={token.info.imageUrl || "/fallback.png"}
                          alt={token.symbol}
                          className="w-6 h-6 rounded-full border border-blue-500/30"
                        />
                      )}
                      <span className="font-bold text-gray-200">
                        {token ? `${token.symbol} / WETH` : "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right">{item.amount.toFixed(8)}</td>
                  <td className="p-3 text-right">{formatPrice(item.purchasePrice)}</td>
                  <td className="p-3 text-right">{formatPrice(invested)}</td>
                  <td className="p-3 text-right">{token ? formatPrice(token.priceUsd ?? 0) : "N/A"}</td>
                  <td className="p-3 text-right">{formatPrice(value)}</td>
                  <td className={`p-3 text-right ${getColorClass(token?.priceChange?.h24 || 0)}`}>
                    {token ? `${(token.priceChange?.h24 || 0).toFixed(2)}%` : "N/A"}
                  </td>
                  <td className={`p-3 text-right ${getColorClass(pnl)}`}>
                    {formatPrice(Math.abs(pnl))} {pnl >= 0 ? "↑" : "↓"}
                  </td>
                  <td className={`p-3 text-right ${getColorClass(pnlPercent)}`}>
                    {pnlPercent.toFixed(2)}%
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={() => handleCopy(item.poolAddress)}
                        className="text-gray-400"
                        title="Copy the token's contract address to clipboard"
                      >
                        <FaClipboard className="w-5 h-5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={() => {
                          setEditingPortfolio(item);
                          setPortfolioForm({
                            poolAddress: item.poolAddress,
                            amount: item.amount.toString(),
                            purchasePrice: item.purchasePrice.toString(),
                          });
                        }}
                        className="text-blue-400"
                        title="Edit portfolio entry"
                      >
                        <FaEdit className="w-5 h-5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={() => setExpandedRow(expandedRow === item.poolAddress ? null : item.poolAddress)}
                        className="text-purple-400"
                        title="View Analytics"
                      >
                        <FaChartLine className="w-5 h-5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={() => handleRemoveFromPortfolio(item.poolAddress)}
                        className="text-red-400"
                        title="Remove from Portfolio"
                      >
                        <FaTrash className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
                {expandedRow === item.poolAddress && (
                  <tr className="bg-gray-800">
                    <td colSpan={10} className="p-4">
                      <div>
                        <h4 className="text-lg font-bold mb-2 uppercase">Analytics for {token?.symbol}</h4>
                        {item.history && item.history.length > 0 ? (
                          <>
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart data={item.history}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="price" stroke="#8884d8" name="Price" />
                                <Line type="monotone" dataKey="pnl" stroke="#82ca9d" name="P&L" />
                              </LineChart>
                            </ResponsiveContainer>
                            <div className="mt-4 grid grid-cols-2 gap-4">
                              <div>
                                <p className="uppercase">ROI: {roi.toFixed(2)}%</p>
                              </div>
                              <div>
                                <p className="uppercase">Volatility: {volatility.toFixed(4)}</p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="uppercase">No history data available.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-4 p-4">
        {portfolio.map((item) => {
          const token = tokens.find((t) => t.poolAddress === item.poolAddress);
          const currentPrice = token ? parseFloat(token.priceUsd || "0") : 0;
          const value = item.amount * currentPrice;
          const invested = item.amount * item.purchasePrice;
          const pnl = calculatePnL(item, token);
          const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
          const roi = item.purchasePrice > 0 ? ((currentPrice / item.purchasePrice - 1) * 100) : 0;
          const prices = item.history?.map(h => h.price) || [];
          const volatility = calculateVolatility(prices);
          return (
            <div key={item.poolAddress} className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 shadow-sm">
              <div className="flex items-center space-x-2 mb-2 cursor-pointer" onClick={() => handleTokenClick(item.poolAddress)}>
                {token?.info?.imageUrl && (
                  <img
                    src={token.info.imageUrl || "/fallback.png"}
                    alt={token.symbol}
                    className="w-8 h-8 rounded-full border border-blue-500/30"
                  />
                )}
                <h3 className="font-bold text-gray-200 uppercase">{token ? `${token.symbol} / WETH` : "Unknown"}</h3>
              </div>
              <p className="uppercase">Amount: {item.amount.toFixed(8)}</p>
              <p className="uppercase">Purchase Price: {formatPrice(item.purchasePrice)}</p>
              <p className="uppercase">Current Price: {token ? formatPrice(token.priceUsd ?? 0) : "N/A"}</p>
              <p className="uppercase">Current Value: {formatPrice(value)}</p>
              <p className={`uppercase ${getColorClass(token?.priceChange?.h24 || 0)}`}>24H Change: {token ? `${(token.priceChange?.h24 || 0).toFixed(2)}%` : "N/A"}</p>
              <p className={`uppercase ${getColorClass(pnl)}`}>P&L: {formatPrice(Math.abs(pnl))} {pnl >= 0 ? "↑" : "↓"} ({pnlPercent.toFixed(2)}%)</p>
              <div className="flex space-x-2 mt-4">
                <motion.button whileHover={{ scale: 1.1 }} onClick={() => handleCopy(item.poolAddress)} className="text-gray-400">
                  <FaClipboard className="w-5 h-5" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.1 }} onClick={() => {
                  setEditingPortfolio(item);
                  setPortfolioForm({
                    poolAddress: item.poolAddress,
                    amount: item.amount.toString(),
                    purchasePrice: item.purchasePrice.toString(),
                  });
                }} className="text-blue-400">
                  <FaEdit className="w-5 h-5" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.1 }} onClick={() => setExpandedRow(expandedRow === item.poolAddress ? null : item.poolAddress)} className="text-purple-400">
                  <FaChartLine className="w-5 h-5" />
                </motion.button>
                <motion.button whileHover={{ scale: 1.1 }} onClick={() => handleRemoveFromPortfolio(item.poolAddress)} className="text-red-400">
                  <FaTrash className="w-5 h-5" />
                </motion.button>
              </div>
              {expandedRow === item.poolAddress && (
                <div className="mt-4">
                  <h4 className="text-md font-bold mb-2 uppercase">Analytics for {token?.symbol}</h4>
                  {item.history && item.history.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={item.history}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="price" stroke="#8884d8" name="Price" />
                          <Line type="monotone" dataKey="pnl" stroke="#82ca9d" name="P&L" />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <p className="uppercase">ROI: {roi.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="uppercase">Volatility: {volatility.toFixed(4)}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="uppercase">No history data available.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PortfolioTable;