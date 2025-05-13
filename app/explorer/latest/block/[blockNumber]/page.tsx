"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { db, auth } from "../../../../../lib/firebase.ts";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface BlockDetailsProps {
  blockNumber: string;
}

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
  transactionList?: Transaction[];
}

const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL || "";

const BlockDetails: React.FC<BlockDetailsProps> = ({ blockNumber }) => {
  const [block, setBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>("dark");

  const fetchBlock = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!db) {
        throw new Error("Firestore is not initialized. Check Firebase configuration.");
      }

      const blockRef = doc(db, "blocks", blockNumber);
      const blockSnap = await getDoc(blockRef);

      if (blockSnap.exists()) {
        const blockData = blockSnap.data() as Block;
        setBlock(blockData);
        console.log(`Block ${blockNumber} loaded from Firestore`);
        return;
      }

      if (!alchemyUrl) {
        throw new Error("Alchemy API URL is not configured.");
      }

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
        transactionList: block.transactions?.map((tx: any) => ({
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
        } catch (writeError: any) {
          console.warn("Failed to write block to Firestore:", writeError.message);
        }
      } else {
        console.log("Skipping Firestore write: User not authenticated");
      }
    } catch (err: any) {
      console.error("Fetch block error:", err);
      setError(`Failed to fetch block: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!blockNumber) {
      setError("Block number is missing");
      return;
    }

    const blockNum = parseInt(blockNumber, 10);
    if (isNaN(blockNum) || blockNum < 0) {
      setError("Invalid block number: Must be a positive integer");
      return;
    }

    fetchBlock();
  }, [blockNumber]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const themeClasses = {
    background: theme === "dark" ? "bg-black" : "bg-white",
    text: theme === "dark" ? "text-white" : "text-black",
    border: theme === "dark" ? "border-[#333333]" : "border-gray-200",
    headerBg: theme === "dark" ? "bg-[#1A1A1A]" : "bg-gray-100",
    hoverBg: theme === "dark" ? "hover:bg-[#222222]" : "hover:bg-gray-50",
    secondaryText: theme === "dark" ? "text-gray-400" : "text-gray-600",
    errorText: theme === "dark" ? "text-red-400" : "text-red-600",
    buttonBg: theme === "dark" ? "bg-[#0052FF]" : "bg-blue-600",
    buttonHover: theme === "dark" ? "hover:bg-[#003ECB]" : "hover:bg-blue-700",
    shadow: theme === "dark" ? "shadow-[0_2px_8px_rgba(0,82,255,0.2)]" : "shadow-[0_2px_8px_rgba(0,0,0,0.1)]",
  };

  return (
    <div className={`min-h-screen font-mono ${themeClasses.background} ${themeClasses.text}`}>
      <div className={`border ${themeClasses.border} ${themeClasses.shadow} w-full mx-auto`}>
        <div className={`flex items-center justify-between px-4 py-3 ${themeClasses.headerBg}`}>
          <div className="flex items-center space-x-3">
            <Link
              href="/explorer/latest/block"
              className={`inline-flex items-center px-2 py-1 ${themeClasses.buttonBg} ${themeClasses.text} ${themeClasses.buttonHover} transition-colors ${themeClasses.shadow} text-sm`}
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              BACK
            </Link>
            <h1 className={`${themeClasses.text} text-lg font-semibold`}>Block #{blockNumber} - CYPHERSCAN</h1>
          </div>
          <button
            onClick={toggleTheme}
            className={`p-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} transition-colors ${themeClasses.shadow}`}
          >
            {theme === "dark" ? (
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center items-center py-6">
              <svg
                className="w-6 h-6 animate-spin text-[#0052FF]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" />
              </svg>
              <span className={`ml-2 ${themeClasses.secondaryText}`}>[LOADING...]</span>
            </div>
          ) : error ? (
            <p className={`text-center py-6 ${themeClasses.errorText}`}>
              Error: {error}. Please try a different block number or contact support.
            </p>
          ) : block ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-[#0052FF] text-base font-semibold border-b border-[#0052FF] pb-2 mb-4">[ BLOCK OVERVIEW ]</h2>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-3">
                    <p className="text-sm">
                      <strong className="text-[#0052FF]">BLOCK:</strong>{" "}
                      <a
                        href={`https://basescan.org/block/${block.number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0052FF] hover:underline"
                      >
                        {block.number}
                      </a>
                    </p>
                    <p className="text-sm">
                      <strong className="text-[#0052FF]">STATUS:</strong>{" "}
                      <span className="text-green-500">[ {block.status} ]</span>
                    </p>
                    <p className="text-sm">
                      <strong className="text-[#0052FF]">TIMESTAMP:</strong>{" "}
                      <span className={`${themeClasses.secondaryText}`}>{block.timestamp}</span>
                    </p>
                    <p className="flex items-center text-sm">
                      <strong className="text-[#0052FF] mr-2">HASH:</strong>
                      <a
                        href={`https://basescan.org/block/${block.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate flex-1 text-[#0052FF] hover:underline"
                      >
                        {block.hash}
                      </a>
                      <button
                        onClick={() => copyToClipboard(block.hash, "hash")}
                        className="ml-1 p-1 text-[#0052FF] hover:text-[#003ECB]"
                      >
                        {copiedField === "hash" ? (
                          <svg
                            className="w-4 h-4 text-green-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                    </p>
                    <p className="flex items-center text-sm">
                      <strong className="text-[#0052FF] mr-2">PARENT HASH:</strong>
                      <a
                        href={`https://basescan.org/block/${block.parentHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate flex-1 text-[#0052FF] hover:underline"
                      >
                        {block.parentHash}
                      </a>
                      <button
                        onClick={() => copyToClipboard(block.parentHash, "parentHash")}
                        className="ml-1 p-1 text-[#0052FF] hover:text-[#003ECB]"
                      >
                        {copiedField === "parentHash" ? (
                          <svg
                            className="w-4 h-4 text-green-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                    </p>
                    <p className="flex items-center text-sm">
                      <strong className="text-[#0052FF] mr-2">MINER:</strong>
                      <a
                        href={`https://basescan.org/address/${block.miner}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate flex-1 text-[#0052FF] hover:underline"
                      >
                        {block.miner}
                      </a>
                      <button
                        onClick={() => copyToClipboard(block.miner, "miner")}
                        className="ml-1 p-1 text-[#0052FF] hover:text-[#003ECB]"
                      >
                        {copiedField === "miner" ? (
                          <svg
                            className="w-4 h-4 text-green-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-[#0052FF] text-base font-semibold border-b border-[#0052FF] pb-2 mb-4">[ GAS INFORMATION ]</h2>
                <div className="grid grid-cols-1 gap-3">
                  <p className="text-sm">
                    <strong className="text-[#0052FF]">GAS USED:</strong> {block.gasUsed}
                  </p>
                  <p className="text-sm">
                    <strong className="text-[#0052FF]">GAS LIMIT:</strong> {block.gasLimit}
                  </p>
                </div>
              </div>
              <div>
                <h2 className="text-[#0052FF] text-base font-semibold border-b border-[#0052FF] pb-2 mb-4">[ TRANSACTIONS ]</h2>
                <p className="mb-4 text-sm">
                  <strong className="text-[#0052FF]">TOTAL TXNS:</strong> {block.transactions}
                </p>
                {block.transactionList && block.transactionList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[#0052FF] border-b border-[#0052FF]">
                          <th className="py-2 px-2 text-left font-semibold">HASH</th>
                          <th className="py-2 px-2 text-left font-semibold">FROM</th>
                          <th className="py-2 px-2 text-left font-semibold">TO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.transactionList.map((tx, index) => (
                          <tr key={index} className={`border-b ${themeClasses.border} ${themeClasses.hoverBg} transition-colors`}>
                            <td className="py-2 px-2 truncate">
                              <a
                                href={`https://basescan.org/tx/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#0052FF] hover:underline"
                              >
                                {tx.hash}
                              </a>
                            </td>
                            <td className="py-2 px-2 truncate">
                              <a
                                href={`https://basescan.org/address/${tx.from}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#0052FF] hover:underline"
                              >
                                {tx.from}
                              </a>
                            </td>
                            <td className="py-2 px-2 truncate">
                              <a
                                href={`https://basescan.org/address/${tx.to}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#0052FF] hover:underline"
                              >
                                {tx.to}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={`text-sm ${themeClasses.secondaryText}`}>[ NO TRANSACTIONS DETECTED ]</p>
                )}
              </div>
            </div>
          ) : (
            <p className={`text-center py-6 ${themeClasses.secondaryText} text-sm`}>
              No block data available. Please check the block number or try again later.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockDetails;