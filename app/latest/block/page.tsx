"use client";

import React, { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "../../../lib/firebase.ts";
import { doc, getDoc, setDoc, query, where, getDocs, collection } from "firebase/firestore";

interface Block {
  number: number;
  status: string;
  timestamp: string;
  hash: string;
  transactions: number;
}

const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL || "";

export default function HomeScanPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [theme, setTheme] = useState<string>("dark");
  const router = useRouter();
  const blocksPerPage = 50;

  const fetchBlocks = async (startPage: number, count: number) => {
    setLoading(true);
    setError(null);
    try {
      const alchemyBlockRes = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });

      if (!alchemyBlockRes.ok) {
        const errorText = await alchemyBlockRes.text();
        throw new Error(`Alchemy API error: ${alchemyBlockRes.status} - ${errorText}`);
      }

      const alchemyBlockData = await alchemyBlockRes.json();
      if (!alchemyBlockData?.result) {
        throw new Error("Invalid Alchemy block number response: No result found");
      }

      const latestBlock = parseInt(alchemyBlockData.result, 16) || 0;
      if (latestBlock <= 0) {
        throw new Error("Invalid latest block number");
      }

      const fetchedBlocks: Block[] = [];
      for (let i = 0; i < count; i++) {
        const blockNumber = latestBlock - (startPage - 1) * count - i;
        if (blockNumber < 0) break;

        const blockRef = doc(db, "blocks", blockNumber.toString());
        const blockSnap = await getDoc(blockRef);

        if (blockSnap.exists()) {
          const blockData = blockSnap.data() as Block;
          fetchedBlocks.push(blockData);
          continue;
        }

        const blockRes = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBlockByNumber",
            params: [`0x${blockNumber.toString(16)}`, false],
            id: 1,
          }),
        });

        if (!blockRes.ok) {
          const errorText = await blockRes.text();
          console.warn(`Failed to fetch block ${blockNumber}: ${errorText}`);
          continue;
        }

        const blockData = await blockRes.json();
        const block = blockData?.result;

        if (block) {
          const timestamp = new Date(parseInt(block.timestamp, 16) * 1000);
          const timeAgo = formatDistanceToNow(timestamp, {
            addSuffix: true,
            includeSeconds: false,
          })
            .toUpperCase()
            .replace("LESS THAN A MINUTE", "1 MINUTE");
          const blockInfo: Block = {
            number: blockNumber,
            status: "Finalized",
            timestamp: timeAgo,
            hash: block.hash,
            transactions: block.transactions?.length || 0,
          };
          fetchedBlocks.push(blockInfo);

          try {
            await setDoc(blockRef, blockInfo);
            console.log(`Block ${blockNumber} stored in Firestore`);
          } catch (writeError: any) {
            console.warn(`Failed to store block ${blockNumber} in Firestore: ${writeError.message}`);
          }
        }
      }

      setBlocks(fetchedBlocks);
      if (fetchedBlocks.length === 0) {
        setError("No blocks found in the fetched range");
      }
    } catch (err: any) {
      console.error("Fetch blocks error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    try {
      if (/^\d+$/.test(searchQuery)) {
        router.push(`/latest/block/${searchQuery}`);
      } else if (/^0x[a-fA-F0-9]{64}$/.test(searchQuery)) {
        const blocksRef = collection(db, "blocks");
        const q = query(blocksRef, where("hash", "==", searchQuery));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const blockData = querySnapshot.docs[0].data() as Block;
          router.push(`/latest/hash/${searchQuery}`);
        } else {
          setError("Block hash not found in local database");
        }
      } else {
        setError("Invalid search: Enter a block number or valid hash");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      setError("Failed to search: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchBlocks(page, blocksPerPage);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const filteredBlocks = blocks.filter((block) =>
    filterStatus === "All" ? true : block.status === filterStatus
  );

  const themeClasses = {
    background: theme === "dark" ? "bg-black" : "bg-white",
    text: theme === "dark" ? "text-white" : "text-black",
    border: theme === "dark" ? "border-[#333333]" : "border-gray-200",
    headerBg: theme === "dark" ? "bg-[#1A1A1A]" : "bg-gray-100",
    containerBg: theme === "dark" ? "bg-[#1A1A1A]" : "bg-gray-100",
    hoverBg: theme === "dark" ? "hover:bg-[#222222]" : "hover:bg-gray-50",
    placeholder: theme === "dark" ? "placeholder-gray-400" : "placeholder-gray-400",
    secondaryText: theme === "dark" ? "text-gray-400" : "text-gray-600",
    errorText: theme === "dark" ? "text-red-400" : "text-red-600",
    buttonBg: theme === "dark" ? "bg-[#0052FF]" : "bg-blue-600",
    buttonHover: theme === "dark" ? "hover:bg-[#003ECB]" : "hover:bg-blue-700",
    buttonDisabled: theme === "dark" ? "bg-[#4A4A4A]" : "bg-gray-400",
    shadow: theme === "dark" ? "shadow-[0_2px_8px_rgba(0,82,255,0.2)]" : "shadow-[0_2px_8px_rgba(0,0,0,0.1)]",
    filterBg: theme === "dark" ? "bg-[#1A1A1A]" : "bg-white",
  };

  useEffect(() => {
    if (!db) {
      setError("Firestore is not initialized");
      return;
    }
    if (alchemyUrl) {
      fetchBlocks(page, blocksPerPage);
    } else {
      setError("Alchemy URL is not configured");
    }
  }, [page]);

  return (
    <div className={`min-h-screen w-full font-mono ${themeClasses.background} ${themeClasses.text}`}>
      <div className={`border ${themeClasses.border} ${themeClasses.shadow} w-full min-h-screen`}>
        <div className={`flex items-center justify-between px-4 py-3 sm:px-3 sm:py-2 ${themeClasses.headerBg}`}>
          <h1 className={`${themeClasses.text} text-lg sm:text-base font-semibold`}>[ HOMESCAN ]</h1>
          <button
            onClick={toggleTheme}
            className={`p-2 sm:p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} transition-colors ${themeClasses.shadow}`}
          >
            {theme === "dark" ? (
              <svg
                className="w-5 h-5 sm:w-4 sm:h-4 text-white"
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
                className="w-5 h-5 sm:w-4 sm:h-4 text-black"
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
        <div className="p-4 sm:p-3">
          <div className="flex flex-col space-y-4 sm:space-y-3 mb-4 sm:mb-3">
            <form onSubmit={handleSearch} className={`flex items-center w-full ${themeClasses.containerBg} border ${themeClasses.border} p-2 flex-wrap`}>
              <span className="text-[#0052FF] mr-2 sm:mr-1 text-sm sm:text-xs shrink-0">user@homescan:~$</span>
              <input
                type="text"
                placeholder="find block/hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`flex-1 bg-transparent focus:outline-none ${themeClasses.text} ${themeClasses.placeholder} text-sm sm:text-xs min-w-0`}
              />
              <button
                type="submit"
                className={`px-2 py-1 ${themeClasses.buttonBg} ${themeClasses.text} ${themeClasses.buttonHover} transition-colors ${themeClasses.shadow} text-sm sm:text-xs shrink-0 mt-1 sm:mt-0`}
              >
                EXEC
              </button>
            </form>
            <div className="flex items-center space-x-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`${themeClasses.filterBg} ${themeClasses.text} border ${themeClasses.border} px-2 py-1 text-sm sm:text-xs`}
              >
                <option value="All">All Statuses</option>
                <option value="Finalized">Finalized</option>
              </select>
              <button
                onClick={handleRefresh}
                className={`px-2 py-1 ${themeClasses.buttonBg} ${themeClasses.text} ${themeClasses.buttonHover} transition-colors ${themeClasses.shadow} flex items-center text-sm sm:text-xs`}
                disabled={loading}
              >
                <svg
                  className={`w-4 h-4 sm:w-4 sm:h-4 mr-1 ${loading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                REFRESH
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm sm:text-xs">
              <thead>
                <tr className={`text-[#0052FF] border-b border-[#0052FF]`}>
                  <th className="py-2 px-2 text-left font-semibold">BLOCK</th>
                  <th className="py-2 px-2 text-left font-semibold">STATUS</th>
                  <th className="py-2 px-2 text-left font-semibold">TIMESTAMP</th>
                  <th className="py-2 px-2 text-left font-semibold">HASH</th>
                  <th className="py-2 px-2 text-left font-semibold">TXNS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 sm:py-3">
                      <div className="flex justify-center items-center">
                        <svg
                          className="w-6 h-6 sm:w-5 sm:h-5 animate-spin text-[#0052FF]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z"
                          />
                        </svg>
                        <span className={`ml-2 ${themeClasses.secondaryText} text-sm sm:text-xs`}>[LOADING...]</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className={`text-center py-4 sm:py-3 ${themeClasses.errorText} text-sm sm:text-xs`}>
                      ERR: {error}
                    </td>
                  </tr>
                ) : filteredBlocks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`text-center py-4 sm:py-3 ${themeClasses.secondaryText} text-sm sm:text-xs`}>
                      [NO BLOCKS DETECTED]
                    </td>
                  </tr>
                ) : (
                  filteredBlocks.map((block) => (
                    <tr
                      key={block.number}
                      className={`border-b ${themeClasses.border} ${themeClasses.hoverBg} transition-colors`}
                    >
                      <td className="py-2 px-2">
                        <Link
                          href={`/latest/block/${block.number}`}
                          className="text-[#0052FF] hover:underline"
                        >
                          {block.number}
                        </Link>
                      </td>
                      <td className="py-2 px-2">
                        <span className="text-green-500 whitespace-nowrap">[ {block.status} ]</span>
                      </td>
                      <td className={`py-2 px-2 ${themeClasses.secondaryText}`}>{block.timestamp}</td>
                      <td className="py-2 px-2 truncate">
                        <Link
                          href={`/latest/hash/${block.hash}`}
                          className="text-[#0052FF] hover:underline"
                        >
                          {block.hash}
                        </Link>
                      </td>
                      <td className="py-2 px-2">{block.transactions}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-4 sm:mt-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className={`px-2 py-1 ${themeClasses.buttonBg} ${themeClasses.text} ${themeClasses.buttonHover} disabled:${themeClasses.buttonDisabled} disabled:cursor-not-allowed transition-colors ${themeClasses.shadow} text-sm sm:text-xs`}
            >
              PREV
            </button>
            <span className={`${themeClasses.secondaryText} text-sm sm:text-xs`}>[ PAGE {page} ]</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
              className={`px-2 py-1 ${themeClasses.buttonBg} ${themeClasses.text} ${themeClasses.buttonHover} disabled:${themeClasses.buttonDisabled} disabled:cursor-not-allowed transition-colors ${themeClasses.shadow} text-sm sm:text-xs`}
            >
              NEXT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}