"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

/** Transaction interface */
interface Transaction {
  id: string;
  wallet: string;
  token: string;
  amount: number | string; // we store number or 'N/A'
  value: number;           // in USD
  type: string;            // "Buy", "Sell", or "N/A"
  tokenSupply: number | string; // can be 'N/A'
  time: string;            // ISO date/time
}

export default function WhaleWatcherPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // On mount, fetch from our server route at /tools/whale-watchers
    async function fetchData() {
      try {
        const res = await fetch("/tools/whale-watchers");
        if (!res.ok) {
          throw new Error(`Failed to fetch. Status: ${res.status}`);
        }
        const data: Transaction[] = await res.json();
        setTransactions(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || String(err));
      }
    }
    fetchData();
  }, []);

  return (
    <motion.div
      className="min-h-screen w-screen bg-white text-black m-0 p-0 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Top Banner */}
      <div className="w-full bg-primaryBlue text-white shadow-md m-0 p-0">
        <div className="grid grid-cols-3 items-center p-2 m-0">
          {/* Left Column: Back Button */}
          <div className="flex items-center">
            <Link
              href="/tools"
              className="inline-block ml-4 px-4 py-2 border border-white text-white rounded hover:bg-white hover:text-primaryBlue transition"
            >
              Back to Tools
            </Link>
          </div>
          {/* Center Column: Title */}
          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-extrabold m-0">Whale Watcher</h1>
            <p className="text-lg opacity-90 m-0">
              Tracking major transactions on Base in real time.
            </p>
          </div>
          {/* Right Column: Spacer */}
          <div className="hidden md:block"></div>
        </div>
      </div>

      {/* Content Section */}
      <div className="w-full overflow-x-auto mt-0">
        {error && (
          <p className="text-red-500 text-center p-4">
            Error: {error}
          </p>
        )}
        <table className="w-full border-collapse border border-gray-300">
          <thead className="bg-primaryBlue text-white">
            <tr className="border-b border-gray-400">
              {[
                "#",
                "Wallet Address",
                "Token",
                "Amount",
                "Value ($)",
                "Tx Type",
                "Supply %",
                "Time",
              ].map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-3 text-left text-sm uppercase"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.length > 0 ? (
              transactions.map((tx, index) => (
                <motion.tr
                  key={tx.id}
                  className="border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <td className="px-4 py-3 text-sm">{index + 1}</td>
                  <td className="px-4 py-3 text-sm break-all">{tx.wallet}</td>
                  <td className="px-4 py-3 text-sm font-bold">{tx.token}</td>
                  <td className="px-4 py-3 text-sm">
                    {typeof tx.amount === "number"
                      ? tx.amount.toLocaleString()
                      : tx.amount}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {tx.value.toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm font-semibold ${
                      tx.type === "Buy"
                        ? "text-green-600"
                        : tx.type === "Sell"
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {tx.type}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {typeof tx.tokenSupply === "number"
                      ? ((+tx.amount / +tx.tokenSupply) * 100).toFixed(4) + "%"
                      : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(tx.time).toLocaleString()}
                  </td>
                </motion.tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-3 text-center text-gray-500">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}












