"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

// Define transaction type
interface Transaction {
  id: string;
  wallet: string;
  token: string;
  amount: string;
  value: string;
  type: string;
  time: string;
}

export default function WhaleWatcher() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/whales?page=${page}`);
        const data: Transaction[] = await response.json();
        setTransactions(data);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      }
      setLoading(false);
    };

    fetchTransactions();
  }, [page]);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="w-full px-6 py-6 bg-primaryBlue text-white text-center shadow-md">
        <h1 className="text-4xl font-extrabold">Whale Watcher</h1>
        <p className="text-lg opacity-90">Track large wallet transactions in real time.</p>
      </div>

      {/* Table Layout */}
      <div className="w-full px-6 overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead className="bg-primaryBlue text-white">
            <tr>
              {["#", "Wallet Address", "Token", "Amount", "Value ($)", "Tx Type", "Time"].map((header, index) => (
                <th key={index} className="px-4 py-3 text-left text-sm uppercase">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.length > 0 ? (
              transactions.map((tx, index) => (
                <tr key={tx.id} className="border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all">
                  <td className="px-4 py-3 text-sm">{index + 1 + (page - 1) * 10}</td>
                  <td className="px-4 py-3 text-sm">{tx.wallet}</td>
                  <td className="px-4 py-3 text-sm font-bold">{tx.token}</td>
                  <td className="px-4 py-3 text-sm">{tx.amount}</td>
                  <td className="px-4 py-3 text-sm">${tx.value}</td>
                  <td className={`px-4 py-3 text-sm font-semibold ${tx.type === "Buy" ? "text-green-500" : "text-red-500"}`}>
                    {tx.type}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDistanceToNow(new Date(tx.time), { addSuffix: true })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center text-gray-500">No transactions found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center mt-4">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          className="px-4 py-2 bg-gray-200 rounded-md mr-2"
        >
          Previous
        </button>
        <button
          onClick={() => setPage(page + 1)}
          className="px-4 py-2 bg-gray-200 rounded-md"
        >
          Next
        </button>
      </div>

      {loading && <p className="text-center text-gray-500 mt-4">Loading transactions...</p>}
    </div>
  );
}



