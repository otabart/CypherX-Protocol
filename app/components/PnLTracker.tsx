"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FaChartLine, 
  FaArrowUp, 
  FaArrowDown, 
  FaDollarSign,
  FaCalendarAlt,
  FaFilter,
  FaDownload
} from "react-icons/fa";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

interface PnLData {
  date: string;
  totalValue: number;
  pnl: number;
  pnlPercentage: number;
  trades: number;
  volume: number;
}

interface Trade {
  id: string;
  type: "buy" | "sell";
  token: string;
  amount: number;
  price: number;
  value: number;
  timestamp: number;
  gasCost: number;
}

interface PnLTrackerProps {
  walletAddress: string;
}

const PnLTracker: React.FC<PnLTrackerProps> = ({ walletAddress }) => {
  const [pnlData, setPnlData] = useState<PnLData[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"1D" | "7D" | "30D" | "ALL">("7D");
  const [totalPnL, setTotalPnL] = useState(0);
  const [totalPnLPercentage, setTotalPnLPercentage] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalTrades, setTotalTrades] = useState(0);

  // Fetch PnL data
  const fetchPnLData = useCallback(async () => {
    if (!walletAddress) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/wallet/pnl?address=${walletAddress}&timeframe=${timeframe}`);
      if (response.ok) {
        const data = await response.json();
        setPnlData(data.pnlData || []);
        setTrades(data.trades || []);
        setTotalPnL(data.totalPnL || 0);
        setTotalPnLPercentage(data.totalPnLPercentage || 0);
        setTotalVolume(data.totalVolume || 0);
        setTotalTrades(data.totalTrades || 0);
      }
    } catch (error) {
      console.error("Error fetching PnL data:", error);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, timeframe]);

  useEffect(() => {
    fetchPnLData();
  }, [fetchPnLData]);

  // Calculate PnL for a specific trade
  const calculateTradePnL = (trade: Trade, currentPrice: number): number => {
    if (trade.type === "buy") {
      return (currentPrice - trade.price) * trade.amount - trade.gasCost;
    } else {
      return (trade.price - currentPrice) * trade.amount - trade.gasCost;
    }
  };

  // Export PnL data
  const exportPnLData = useCallback(() => {
    const csvData = pnlData.map(item => ({
      Date: item.date,
      "Total Value": `$${item.totalValue.toFixed(2)}`,
      "PnL": `$${item.pnl.toFixed(2)}`,
      "PnL %": `${item.pnlPercentage.toFixed(2)}%`,
      Trades: item.trades,
      Volume: `$${item.volume.toFixed(2)}`
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map(row => Object.values(row).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pnl-data-${walletAddress.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pnlData, walletAddress]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-blue-500/30 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading PnL data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-blue-500/30 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center border border-green-500/30">
            <FaChartLine className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-200">Profit & Loss</h2>
            <p className="text-sm text-gray-400">Trading performance analysis</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={exportPnLData}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            title="Export data"
          >
            <FaDownload className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          className="bg-gray-800 rounded-lg p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center space-x-2 mb-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              totalPnL >= 0 ? "bg-green-500/20" : "bg-red-500/20"
            }`}>
              {totalPnL >= 0 ? (
                <FaArrowUp className="w-3 h-3 text-green-400" />
              ) : (
                <FaArrowDown className="w-3 h-3 text-red-400" />
              )}
            </div>
            <span className="text-sm text-gray-400">Total PnL</span>
          </div>
          <p className={`text-2xl font-bold ${
            totalPnL >= 0 ? "text-green-400" : "text-red-400"
          }`}>
            ${totalPnL.toFixed(2)}
          </p>
          <p className={`text-sm ${
            totalPnLPercentage >= 0 ? "text-green-400" : "text-red-400"
          }`}>
            {totalPnLPercentage >= 0 ? "+" : ""}{totalPnLPercentage.toFixed(2)}%
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 rounded-lg p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
              <FaDollarSign className="w-3 h-3 text-blue-400" />
            </div>
            <span className="text-sm text-gray-400">Total Volume</span>
          </div>
          <p className="text-2xl font-bold text-gray-200">
            ${totalVolume.toFixed(2)}
          </p>
          <p className="text-sm text-gray-400">
            {totalTrades} trades
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 rounded-lg p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
              <FaCalendarAlt className="w-3 h-3 text-purple-400" />
            </div>
            <span className="text-sm text-gray-400">Avg Trade</span>
          </div>
          <p className="text-2xl font-bold text-gray-200">
            ${totalTrades > 0 ? (totalVolume / totalTrades).toFixed(2) : "0.00"}
          </p>
          <p className="text-sm text-gray-400">
            per trade
          </p>
        </motion.div>

        <motion.div
          className="bg-gray-800 rounded-lg p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center">
              <FaFilter className="w-3 h-3 text-orange-400" />
            </div>
            <span className="text-sm text-gray-400">Win Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-200">
            {totalTrades > 0 ? Math.round((trades.filter(t => calculateTradePnL(t, 0) > 0).length / totalTrades) * 100) : 0}%
          </p>
          <p className="text-sm text-gray-400">
            profitable trades
          </p>
        </motion.div>
      </div>

      {/* Timeframe Filter */}
      <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 mb-6">
        {[
          { id: "1D", label: "1 Day" },
          { id: "7D", label: "7 Days" },
          { id: "30D", label: "30 Days" },
          { id: "ALL", label: "All Time" }
        ].map((period) => (
          <button
            key={period.id}
            onClick={() => setTimeframe(period.id as "1D" | "7D" | "30D" | "ALL")}
            className={`flex-1 py-2 px-3 rounded-md font-medium text-sm transition-colors ${
              timeframe === period.id
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* PnL Chart */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">PnL Over Time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pnlData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#F9FAFB"
                }}
                formatter={(value: number, name: string) => [
                  `$${value.toFixed(2)}`,
                  name === "totalValue" ? "Portfolio Value" : "PnL"
                ]}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Area
                type="monotone"
                dataKey="totalValue"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Trades */}
      <div>
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Recent Trades</h3>
        <div className="space-y-3">
          <AnimatePresence>
            {trades.slice(0, 5).map((trade, index) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    trade.type === "buy" ? "bg-green-500/20" : "bg-red-500/20"
                  }`}>
                    <span className={`text-xs font-bold ${
                      trade.type === "buy" ? "text-green-400" : "text-red-400"
                    }`}>
                      {trade.type === "buy" ? "B" : "S"}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-200">{trade.token}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(trade.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-200">
                    {trade.amount.toFixed(4)} {trade.token}
                  </p>
                  <p className="text-sm text-gray-400">
                    ${trade.value.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${
                    calculateTradePnL(trade, 0) >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {calculateTradePnL(trade, 0) >= 0 ? "+" : ""}${calculateTradePnL(trade, 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Gas: ${trade.gasCost.toFixed(2)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PnLTracker;
