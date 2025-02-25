"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

/** Transaction interface */
interface Transaction {
  id: string;
  wallet: string;
  token: string;
  amount: number; // token quantity
  value: number; // USD value
  type: string; // "Buy" or "Sell"
  tokenSupply: number; // token supply
  time: string; // ISO date/time
}

/** Generate a random wallet address */
function getRandomWallet(): string {
  let hex = "0x";
  for (let i = 0; i < 40; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

/** Generate a random integer between min and max (inclusive) */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate 20 fake transactions that satisfy:
 *  - value >= $5,000,
 *  - (amount / tokenSupply) >= 0.00025 (0.025%)
 */
function generateFakeTransactions(): Transaction[] {
  // Expanded token list with popular Base coins.
  const tokens = ["USDbC", "DAI", "cbETH", "WETH", "BASE", "Virtuals", "Brett", "Toshi", "Mochi"];
  const fakeTxs: Transaction[] = [];

  for (let i = 1; i <= 20; i++) {
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const tokenSupply = randInt(1_000_000, 10_000_000);
    const minAmount = Math.ceil(0.00025 * tokenSupply);
    const maxAmount = Math.ceil(0.001 * tokenSupply);
    const amount = randInt(minAmount, maxAmount);
    const value = randInt(5000, 30000);
    const type = Math.random() > 0.5 ? "Buy" : "Sell";
    const now = Date.now();
    const twoDaysMs = 48 * 60 * 60 * 1000;
    const randomPastTime = now - Math.floor(Math.random() * twoDaysMs);
    const time = new Date(randomPastTime).toISOString();

    fakeTxs.push({
      id: `fakeTx_${i}`,
      wallet: getRandomWallet(),
      token,
      amount,
      value,
      type,
      tokenSupply,
      time,
    });
  }
  return fakeTxs;
}

export default function WhaleWatcherPage() {
  const [transactions] = useState<Transaction[]>(() => generateFakeTransactions());

  return (
    <motion.div
      className="min-h-screen w-screen bg-white text-black m-0 p-0 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Banner: full width, flush with top */}
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
          {/* Center Column: Heading and Subheading */}
          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-extrabold m-0">
              Whale Watcher
            </h1>
            <p className="text-lg opacity-90 m-0">
              Tracking major transactions on Base in real time.
            </p>
          </div>
          {/* Right Column: Spacer */}
          <div className="hidden md:block"></div>
        </div>
      </div>

      {/* Table Container */}
      <div className="w-full overflow-x-auto mt-0">
        <table className="w-full border-collapse border border-gray-300">
          <thead className="bg-primaryBlue text-white">
            <tr className="border-b border-gray-400">
              {["#", "Wallet Address", "Token", "Amount", "Value ($)", "Tx Type", "Supply %", "Time"].map(
                (header, index) => (
                  <th key={index} className="px-4 py-3 text-left text-sm uppercase">
                    {header}
                  </th>
                )
              )}
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
                  <td className="px-4 py-3 text-sm">{tx.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">${tx.value.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-sm font-semibold ${tx.type === "Buy" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {((tx.amount / tx.tokenSupply) * 100).toFixed(4) + "%"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(tx.time).toLocaleString()}
                  </td>
                </motion.tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-3 text-center text-gray-500">
                  No transactions (shouldn’t happen with our mock data!)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}










