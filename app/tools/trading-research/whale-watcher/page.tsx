'use client';

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Transaction {
  id: string;
  wallet: string;
  token: string;
  amount: number;
  value: number;
  type: string;
  tokenSupply: number | "N/A";
  time: string;
}

export default function WhaleWatcherPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h");
  const [selectedType, setSelectedType] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWhaleTransactions() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/whales?page=1");
        if (!res.ok) throw new Error("Failed to fetch data");

        const data = await res.json();
        
        // Filter transactions to include both Buy and Sell if they meet these conditions:
        //  - tokenSupply is available,
        //  - transaction value is at least $5,000,
        //  - transaction amount represents at least 0.04% of token supply.
        const filteredData = data.filter((tx: Transaction) =>
          tx.tokenSupply !== "N/A" &&
          tx.value >= 5000 &&
          (tx.amount / tx.tokenSupply) >= 0.0004
        );

        setTransactions(filteredData);
      } catch (err) {
        setError("Error fetching whale transactions");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchWhaleTransactions();
    const interval = setInterval(fetchWhaleTransactions, 10000); // Refresh every 10 sec
    return () => clearInterval(interval);
  }, []);

  const filteredTransactions = transactions.filter((tx) => {
    if (selectedType === "All") return true;
    return tx.type === selectedType;
  });

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header Section */}
      <div className="w-full px-6 py-6 bg-primaryBlue text-white text-center shadow-md">
        <h1 className="text-4xl font-extrabold">Whale Watcher</h1>
        <p className="text-lg opacity-90">Tracking large Base Chain transactions in real-time.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap justify-center space-x-3 bg-gray-100 py-4 border-b border-gray-300">
        {/* Timeframe Filter */}
        <div className="flex space-x-2 bg-white p-2 rounded-lg shadow-md">
          {["5m", "1h", "6h", "24h"].map((time) => (
            <button
              key={time}
              onClick={() => setSelectedTimeframe(time)}
              className={`px-4 py-2 text-sm font-semibold rounded-md ${
                selectedTimeframe === time ? "bg-primaryBlue text-white" : "bg-gray-200 hover:bg-gray-300"
              } transition-all`}
            >
              {time}
            </button>
          ))}
        </div>

        {/* Transaction Type Filter */}
        <div className="flex space-x-2 bg-white p-2 rounded-lg shadow-md">
          {["All", "Buys", "Sells"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 text-sm font-semibold rounded-md ${
                selectedType === type ? "bg-primaryBlue text-white" : "bg-gray-200 hover:bg-gray-300"
              } transition-all`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Table Container */}
      <div className="w-full px-6 overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead className="bg-primaryBlue text-white">
            <tr className="border-b border-gray-400">
              {["#", "Wallet Address", "Token", "Amount", "Value ($)", "Tx Type", "Supply %", "Time"].map((header, index) => (
                <th key={index} className="px-4 py-3 text-left text-sm uppercase">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx, index) => (
                <motion.tr
                  key={tx.id}
                  className="border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <td className="px-4 py-3 text-sm">{index + 1}</td>
                  <td className="px-4 py-3 text-sm break-all">{tx.wallet}</td>
                  <td className="px-4 py-3 text-sm font-bold">{tx.token || "Unknown"}</td>
                  <td className="px-4 py-3 text-sm">{tx.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm">${tx.value.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-sm font-semibold ${
                    tx.type === "Buy" ? "text-green-600" : "text-red-600"
                  }`}>
                    {tx.type}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {tx.tokenSupply !== "N/A" ? ((tx.amount / tx.tokenSupply) * 100).toFixed(2) + "%" : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(tx.time).toLocaleString()}
                  </td>
                </motion.tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-3 text-center text-gray-500">
                  {loading ? "Fetching latest transactions..." : "No whale transactions found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
























