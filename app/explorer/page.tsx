"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// Header/Footer remain unchanged
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

/** ──────────── Enhanced Search Icon ──────────── **/
function SearchIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z"
      />
    </svg>
  );
}

/** ──────────── Data Interfaces ──────────── **/
interface Block {
  number: number;
  hash: string;
  timestamp: string;
  timestampRaw: number;
  transactionCount: number;
  validator: string;
  gasUsed: string;
  difficulty: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
}

interface WhaleTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
}

/** ──────────── Main ExplorerPage Component ──────────── **/
export default function ExplorerPage() {
  const router = useRouter();
  const pathname = usePathname();

  // ─── Search + Data States ───
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const [recentBlocks, setRecentBlocks] = useState<Block[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [whaleTransactions, setWhaleTransactions] = useState<WhaleTransaction[]>([]);

  const [loading, setLoading] = useState<{ blocks: boolean; transactions: boolean; whales: boolean }>({
    blocks: true,
    transactions: true,
    whales: true,
  });
  const [updating, setUpdating] = useState<{ blocks: boolean; transactions: boolean; whales: boolean }>({
    blocks: false,
    transactions: false,
    whales: false,
  });

  const [error, setError] = useState<{ blocks: string | null; transactions: string | null; whales: string | null }>({
    blocks: null,
    transactions: null,
    whales: null,
  });

  /** Network Stats **/
  const [totalTxns, setTotalTxns] = useState<number>(0);
  const [latestBlock, setLatestBlock] = useState<number>(0);
  const [gasPrice, setGasPrice] = useState<string>("0 Gwei");
  const [pendingTxns, setPendingTxns] = useState<number>(0);
  const [activeAddresses, setActiveAddresses] = useState<number>(0);
  const [avgBlockTime, setAvgBlockTime] = useState<string>("0 s");
  const [networkHashRate, setNetworkHashRate] = useState<string>("0 TH/s");
  const [avgGasFee, setAvgGasFee] = useState<string>("0 Gwei");

  /** Toast for "Copied to clipboard" **/
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /** Refs to compare previous data **/
  const prevBlocksRef = useRef<Block[]>([]);
  const prevTransactionsRef = useRef<Transaction[]>([]);
  const prevWhaleTransactionsRef = useRef<WhaleTransaction[]>([]);

  /** Alchemy API URL **/
  const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

  /** Load search history from localStorage **/
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('explorer-search-history');
      if (savedHistory) {
        const history = JSON.parse(savedHistory);
        setSearchHistory(Array.isArray(history) ? history : []);
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }, []);

  /** Save search history to localStorage **/
  const saveSearchHistory = useCallback((query: string) => {
    try {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      setSearchHistory(prev => {
        const newHistory = [trimmedQuery, ...prev.filter(item => item !== trimmedQuery)].slice(0, 10);
        localStorage.setItem('explorer-search-history', JSON.stringify(newHistory));
        return newHistory;
      });
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }, []);

  /** Clear search history **/
  const clearSearchHistory = useCallback(() => {
    try {
      localStorage.removeItem('explorer-search-history');
      setSearchHistory([]);
    } catch (error) {
      console.warn('Failed to clear search history:', error);
    }
  }, []);

  /** Close any mobile menu in Header on route change **/
  useEffect(() => {
    document.body.style.overflow = "";
  }, [pathname]);

  /** Auto‐dismiss toast after 3 seconds **/
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  /** ──────────── Enhanced Search Suggestions ──────────── **/
  const generateSearchSuggestions = useCallback((query: string) => {
    if (!query.trim()) {
      // Show search history when input is empty
      setSearchSuggestions(searchHistory.map(item => `History: ${item}`));
      return;
    }

    const suggestions = [];
    
    // Add search history matches
    const historyMatches = searchHistory
      .filter(item => item.toLowerCase().includes(query.toLowerCase()))
      .map(item => `History: ${item}`);
    suggestions.push(...historyMatches);
    
    // Block number suggestions
    if (/^\d+$/.test(query)) {
      suggestions.push(`Block #${query}`);
    }
    
    // Address suggestions
    if (/^0x[a-fA-F0-9]{0,40}$/.test(query)) {
      if (query.length === 42) {
        suggestions.push(`Address: ${query}`);
      } else {
        suggestions.push(`Address: ${query}...`);
      }
    }
    
    // Transaction hash suggestions
    if (/^0x[a-fA-F0-9]{0,64}$/.test(query)) {
      if (query.length === 66) {
        suggestions.push(`Transaction: ${query}`);
      } else {
        suggestions.push(`Transaction: ${query}...`);
      }
    }

    setSearchSuggestions(suggestions);
  }, [searchHistory]);

  useEffect(() => {
    generateSearchSuggestions(searchQuery);
  }, [searchQuery, generateSearchSuggestions]);

  /** ──────────── fetchWhaleTransactions ──────────── **/
  const fetchWhaleTransactions = useCallback(async () => {
    try {
      const { getFirestore, collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");
      const { initializeApp, getApps } = await import("firebase/app");

      if (!getApps().length) {
        initializeApp({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        });
      }

      const db = getFirestore();
      const whaleQuery = query(collection(db, "whaleTransactions"), orderBy("timestamp", "desc"), limit(3));
      const whaleSnapshot = await getDocs(whaleQuery);

      const whaleData: WhaleTransaction[] = whaleSnapshot.docs.map((doc) => {
        const data = doc.data() as {
          hash?: string;
          fromAddress?: string;
          toAddress?: string;
          amountToken?: number;
          timestamp?: unknown;
        };
        return {
          hash: data.hash ?? "",
          from: data.fromAddress ?? "",
          to: data.toAddress ?? "",
          value: data.amountToken ? data.amountToken.toFixed(4) : "0",
          timestamp: data.timestamp
            ? formatDistanceToNow(new Date(
                data.timestamp && typeof data.timestamp === 'object' && 'toDate' in data.timestamp 
                  ? (data.timestamp as { toDate(): Date }).toDate() 
                  : String(data.timestamp)
              ), { addSuffix: true }).toUpperCase()
            : "",
        };
      });

      const hasNewWhales = whaleData.some(
        (tx, i) => !prevWhaleTransactionsRef.current[i] || tx.hash !== prevWhaleTransactionsRef.current[i].hash
      );
      if (hasNewWhales) {
        setWhaleTransactions(whaleData);
        prevWhaleTransactionsRef.current = whaleData;
      }
    } catch (err: unknown) {
      console.error("Error fetching whale transactions:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError((prev) => ({ ...prev, whales: `Error: ${errorMessage}` }));
    }
  }, []);

  /** ──────────── fetchData ──────────── **/
  const fetchData = useCallback(
    async (isInitialFetch: boolean = false) => {
      if (!alchemyUrl) {
        console.error("Missing Alchemy API URL");
        setError({
          blocks: "Alchemy API URL is missing.",
          transactions: "Alchemy API URL is missing.",
          whales: "Alchemy API URL is missing.",
        });
        setLoading({ blocks: false, transactions: false, whales: false });
        return;
      }

      // Only show updating indicator for subsequent fetches, not initial load
      if (!isInitialFetch) {
        setUpdating({ blocks: true, transactions: true, whales: true });
      } else {
        setLoading({ blocks: true, transactions: true, whales: true });
      }

      try {
        /*********************
         * 1) Fetch Gas Price
         *********************/
        try {
          const gasPriceResponse = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_gasPrice",
              params: [],
              id: 0,
            }),
          });
          const gasPriceData = await gasPriceResponse.json();
          if (gasPriceData.error) throw new Error(gasPriceData.error.message);
          const newGasPrice = (parseInt(gasPriceData.result, 16) / 1e9).toFixed(4) + " Gwei";
          setGasPrice(newGasPrice);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.warn("Gas Price fetch failed:", errorMessage);
        }

        /************************
         * 2) Fetch Fee History (last 10 blocks) → Avg Gas Fee
         ************************/
        try {
          const feeHistoryResponse = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_feeHistory",
              params: [10, "latest", [25, 50, 75]],
              id: 1,
            }),
          });
          const feeHistoryData = await feeHistoryResponse.json();
          if (feeHistoryData.error) throw new Error(feeHistoryData.error.message);
          const baseFees: number[] = feeHistoryData.result.baseFeePerGas.map((fee: string) => parseInt(fee, 16));
          const avgFeeInWei = baseFees.reduce((sum, fee) => sum + fee, 0) / baseFees.length;
          setAvgGasFee((avgFeeInWei / 1e9).toFixed(4) + " Gwei");
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.warn("Fee History fetch failed:", errorMessage);
        }

        /************************
         * 3) Fetch Pending Transactions Count
         ************************/
        try {
          const pendingTxResponse = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getBlockTransactionCountByNumber",
              params: ["pending"],
              id: 2,
            }),
          });
          const pendingTxData = await pendingTxResponse.json();
          if (pendingTxData.error) throw new Error(pendingTxData.error.message);
          setPendingTxns(parseInt(pendingTxData.result, 16));
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.warn("Pending Txns fetch failed:", errorMessage);
        }

        /************************
         * 4) Fetch Latest Block Number
         ************************/
        let latestBlockNumber = latestBlock;
        try {
          const blockNumberResponse = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_blockNumber",
              params: [],
              id: 3,
            }),
          });
          const blockNumberData = await blockNumberResponse.json();
          if (blockNumberData.error) throw new Error(blockNumberData.error.message);
          latestBlockNumber = parseInt(blockNumberData.result, 16);
          setLatestBlock(latestBlockNumber);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.warn("Latest Block Number fetch failed:", errorMessage);
        }

        /************************
         * 5) Fetch the Last 3 Blocks
         ************************/
        let blocksJson: Array<{
          error?: { message: string };
          result?: {
            number: string;
            hash: string;
            timestamp: string;
            transactions: Array<{
              hash: string;
              from: string;
              to?: string;
              value?: string;
            }>;
            miner?: string;
            gasUsed: string;
            difficulty: string;
          };
        }> = [];
        let blockData: Block[] = [];
        try {
          const blockPromises = [];
          for (let i = 0; i < 3; i++) {
            const blockNumHex = "0x" + (latestBlockNumber - i).toString(16);
            blockPromises.push(
              fetch(alchemyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  method: "eth_getBlockByNumber",
                  params: [blockNumHex, true],
                  id: 4 + i,
                }),
              })
            );
          }
          const blockResponses = await Promise.all(blockPromises);
          blocksJson = await Promise.all(blockResponses.map((r) => r.json()));

          blockData = blocksJson.map((b) => {
            if (b.error) throw new Error(b.error.message);
            if (!b.result) throw new Error("No result in block data");
            return {
              number: parseInt(b.result.number, 16),
              hash: b.result.hash,
              timestamp: formatDistanceToNow(
                new Date(parseInt(b.result.timestamp, 16) * 1000),
                { addSuffix: true }
              ).toUpperCase(),
              timestampRaw: parseInt(b.result.timestamp, 16),
              transactionCount: b.result.transactions.length,
              validator: b.result.miner ?? "0x4200000000000000000000000000000000000011",
              gasUsed: (parseInt(b.result.gasUsed, 16) / 1e6).toFixed(2) + "M",
              difficulty: (parseInt(b.result.difficulty, 16) / 1e12).toFixed(2) + "T",
            };
          });

          const hasNewBlocks = blockData.some(
            (blk, i) => !prevBlocksRef.current[i] || blk.hash !== prevBlocksRef.current[i].hash
          );
          if (hasNewBlocks) {
            setRecentBlocks(blockData);
            prevBlocksRef.current = blockData;
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.warn("Block fetch failed:", errorMessage);
          setError((prev) => ({ ...prev, blocks: `Error: ${errorMessage}` }));
        }

        /********************************************************
         * 6) Calculate Avg Block Time & Network Hash Rate
         ********************************************************/
        if (blockData.length > 1) {
          const timeDiffs: number[] = [];
          for (let i = 1; i < blockData.length; i++) {
            timeDiffs.push(blockData[i - 1].timestampRaw - blockData[i].timestampRaw);
          }
          const avgTime = timeDiffs.reduce((sum, d) => sum + d, 0) / timeDiffs.length;
          setAvgBlockTime(avgTime.toFixed(2) + " s");

          const avgDifficulty =
            blockData.reduce((sum, blk) => sum + parseFloat(blk.difficulty), 0) / blockData.length;
          const hashRateCalc = ((avgDifficulty * 1e12) / avgTime) / 1e12; // TH/s
          setNetworkHashRate(hashRateCalc.toFixed(2) + " TH/s");
        }

        /*******************************************
         * 7) Build "Recent Transactions" from blocksJson
         *******************************************/
        try {
          const txTemp: Transaction[] = [];
          outerLoop: for (const b of blocksJson) {
            if (!b.result) continue;
            for (const tx of b.result.transactions) {
              const val = tx.value ? parseInt(tx.value, 16) / 1e18 : 0;
              txTemp.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to || "N/A",
                value: val.toFixed(4),
                timestamp: formatDistanceToNow(
                  new Date(parseInt(b.result.timestamp, 16) * 1000),
                  { addSuffix: true }
                ).toUpperCase(),
              });
              if (txTemp.length >= 3) break outerLoop;
            }
          }

          const hasNewTxns = txTemp.some(
            (tx, i) => !prevTransactionsRef.current[i] || tx.hash !== prevTransactionsRef.current[i].hash
          );
          if (hasNewTxns) {
            setRecentTransactions(txTemp);
            prevTransactionsRef.current = txTemp;
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.warn("Recent Tx fetch failed:", errorMessage);
          setError((prev) => ({ ...prev, transactions: `Error: ${errorMessage}` }));
        }

        /*******************************************
         * 8) Total Txns (last 3 blocks)
         *******************************************/
        let totalCount = 0;
        blockData.forEach((blk) => {
          totalCount += blk.transactionCount;
        });
        setTotalTxns(totalCount);

        /*******************************************
         * 9) Fetch Active Addresses (last 50 blocks)
         *******************************************/
        try {
          const fromBlockHex = "0x" + (latestBlockNumber - 50).toString(16);
          const transfersResponse = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "alchemy_getAssetTransfers",
              params: [
                {
                  fromBlock: fromBlockHex,
                  toBlock: "latest",
                  category: ["external"],
                  maxCount: "0x64", // 100 in hex
                },
              ],
              id: 9,
            }),
          });
          const transfersData = await transfersResponse.json();
          if (transfersData.error) throw new Error(transfersData.error.message);

          const addrSet = new Set<string>();
          transfersData.result.transfers.forEach((t: { from: string; to?: string }) => {
            addrSet.add(t.from);
            if (t.to) addrSet.add(t.to);
          });
          setActiveAddresses(addrSet.size);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.warn("Active Addresses fetch failed:", errorMessage);
        }

        /*******************************************
         * 10) Fetch Whale Transactions
         *******************************************/
        await fetchWhaleTransactions();

        setLoading({ blocks: false, transactions: false, whales: false });
        setUpdating({ blocks: false, transactions: false, whales: false });
      } catch (outerErr: unknown) {
        const errorMessage = outerErr instanceof Error ? outerErr.message : "Unknown error";
        console.error("Error fetching explorer data:", errorMessage);
        setError({
          blocks: `Error: ${errorMessage}`,
          transactions: `Error: ${errorMessage}`,
          whales: `Error: ${errorMessage}`,
        });
        setLoading({ blocks: false, transactions: false, whales: false });
        setUpdating({ blocks: false, transactions: false, whales: false });
      }
    },
    [alchemyUrl, fetchWhaleTransactions, latestBlock] // Added back latestBlock dependency
  );

  // Initial fetch + poll every 15s
  useEffect(() => {
    // Add a small delay to prevent flickering on initial load
    const initialTimer = setTimeout(() => {
      fetchData(true);
    }, 100);
    
    const interval = setInterval(() => fetchData(false), 15000);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [fetchData]); // Removed alchemyUrl dependency since it's already in fetchData

  /** ──────────── Enhanced handleSearch ──────────── **/
  const handleSearch = useCallback(() => {
    const query = searchQuery.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
      router.push(`/explorer/address/${query}`);
    } else if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
      router.push(`/explorer/latest/tx/${query}`);
    } else if (/^\d+$/.test(query)) {
      router.push(`/explorer/latest/block/${query}`);
    } else {
      setToastMessage("Invalid search query. Please enter a valid address, tx hash, or block number.");
    }
    setShowSuggestions(false);
    saveSearchHistory(query); // Save search history on successful search
  }, [searchQuery, router, saveSearchHistory]);

  /** ──────────── retryFetch ──────────── **/
  const retryFetch = useCallback(
    (section: keyof typeof loading) => {
      setError((prev) => ({ ...prev, [section]: null }));
      setLoading((prev) => ({ ...prev, [section]: true }));
      fetchData(true);
    },
    [fetchData]
  );

  /** ──────────── Error State ──────────── **/
  const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <motion.div 
      className="flex flex-col items-center justify-center py-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-red-400 text-center uppercase text-xs">{message}</p>
      <button
        onClick={onRetry}
        className="mt-2 px-3 py-1 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-blue-400 border border-blue-500/30 text-xs font-medium uppercase transition-all duration-200 hover:scale-105"
      >
        Retry
      </button>
    </motion.div>
  );

  /** ──────────── Enhanced ExplorerPanel ──────────── **/
  interface ExplorerPanelProps<T> {
    title: string;
    isLoading: boolean;
    isUpdating: boolean;
    error: string | null;
    items: T[];
    renderItem: (item: T) => React.ReactNode;
    viewAllHref: string;
    emptyMessage: string;
    retry: () => void;
  }

  function ExplorerPanel<T>({
    title,
    isLoading,
    isUpdating,
    error,
    items,
    renderItem,
    viewAllHref,
    emptyMessage,
    retry,
  }: ExplorerPanelProps<T>) {
    return (
      <motion.div
        className="flex-1 rounded-lg border border-blue-500/30 bg-gray-800 p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-200 uppercase">{title}</h3>
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs uppercase font-medium transition-all duration-200 hover:scale-105"
          >
            View All
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="space-y-3">
          {error ? (
            <ErrorState message={error} onRetry={retry} />
          ) : isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="h-16 bg-gradient-to-r from-gray-700 to-gray-600 animate-pulse rounded-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                />
              ))}
            </div>
          ) : items.length > 0 ? (
            <>
              {items.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  {renderItem(item)}
                </motion.div>
              ))}
              {isUpdating && (
                <motion.div
                  className="flex items-center justify-center py-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex items-center gap-2 text-blue-400 text-xs">
                    <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Updating...</span>
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            <p className="text-center text-gray-400 py-8 text-sm">{emptyMessage}</p>
          )}
        </div>
      </motion.div>
    );
  }

  /** ──────────── themeClasses ──────────── **/
  const themeClasses = {
    background: "bg-gray-950",
    text: "text-gray-200",
    border: "border-blue-500/30",
    containerBg: "bg-[#141A2F]",
    secondaryText: "text-gray-400",
    errorText: "text-red-400",
    buttonBg: "bg-blue-500/20",
    buttonHover: "hover:bg-blue-500/40",
    buttonDisabled: "bg-gray-800",
    toastBg: "bg-blue-500/80",
  };

  return (
    <div className={`min-h-screen w-full flex flex-col font-mono ${themeClasses.background} ${themeClasses.text}`}>
      {/* ─── Disable Any Animation on Header SVGs ─── */}
      <style jsx>{`
        header svg {
          animation: none !important;
        }
      `}</style>

      {/* ─── Enhanced Toast Notification ─── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            role="alert"
            aria-live="assertive"
            className={`fixed top-4 right-4 px-4 py-2 rounded-lg ${themeClasses.toastBg} text-white text-sm shadow-lg z-50`}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Header ─── */}
      <Header />

      {/* ─── Enhanced Hero / Search with Background Image ─── */}
      <section className="relative w-full min-h-[300px] sm:min-h-[400px]">
        {/* Background Image sits absolutely under everything */}
        <Image
          src="https://i.imgur.com/YVycXUz.jpeg"
          alt="Hero background"
          fill
          className="absolute inset-0 w-full h-full object-cover"
          priority
        />
        {/* Enhanced overlay with gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />

        {/* Content sits on top via z‐index */}
        <div className="relative z-10 flex flex-col justify-center min-h-[300px] sm:min-h-[400px]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <motion.h1 
              className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-200 uppercase mb-4 sm:mb-6 text-center leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              Blockchain Explorer
            </motion.h1>

            {/* Enhanced Search Input + Button */}
            <motion.div 
              className="mx-auto max-w-2xl relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Search address, tx hash, or block number"
                  aria-label="Search blockchain data"
                  className={`w-full py-4 pl-12 pr-16 text-base rounded-xl ${themeClasses.containerBg} ${themeClasses.text} border-2 ${themeClasses.border} placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all duration-300 shadow-lg`}
                />
                <SearchIcon className="w-6 h-6 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim()}
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg ${themeClasses.buttonBg} hover:${themeClasses.buttonHover} disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300`}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
                
                {/* Enhanced Search Suggestions */}
                <AnimatePresence>
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <motion.div
                      className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-blue-500/30 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {searchSuggestions.map((suggestion, index) => {
                        const isHistory = suggestion.startsWith('History: ');
                        const actualQuery = isHistory ? suggestion.replace('History: ', '') : suggestion.split(': ')[1] || suggestion;
                        
                        return (
                          <button
                            key={index}
                            onClick={() => {
                              if (isHistory) {
                                setSearchQuery(actualQuery);
                              } else {
                                setSearchQuery(actualQuery);
                              }
                              setShowSuggestions(false);
                            }}
                            className={`w-full px-4 py-4 text-left text-sm hover:bg-blue-500/20 transition-colors duration-200 border-b border-blue-500/20 last:border-b-0 ${
                              isHistory ? 'text-gray-300' : 'text-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{suggestion}</span>
                              {isHistory && (
                                <span className="text-xs text-gray-500">History</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      
                      {/* Clear History Button */}
                      {searchHistory.length > 0 && !searchQuery.trim() && (
                        <button
                          onClick={() => {
                            clearSearchHistory();
                            setShowSuggestions(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/20 transition-colors duration-200 border-t border-blue-500/20"
                        >
                          Clear Search History
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Enhanced Latest Block and Gas Price Display */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 sm:mt-8 max-w-md mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-sm text-blue-400 uppercase font-medium">Latest Block</p>
                <p className="text-xl font-bold text-gray-200">{latestBlock.toLocaleString()}</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 backdrop-blur-sm">
                <p className="text-sm text-green-400 uppercase font-medium">Gas Price</p>
                <p className="text-xl font-bold text-gray-200">{gasPrice}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Enhanced Network Stats ─── */}
      <section className="w-full bg-gradient-to-b from-gray-900 to-gray-950">
        <div className="mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
          <motion.h2 
            className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-200 uppercase mb-4 sm:mb-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Network Statistics
          </motion.h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {[
              { title: "Transactions", value: totalTxns.toLocaleString(), color: "blue" },
              { title: "Pending Txns", value: pendingTxns.toLocaleString(), color: "yellow" },
              { title: "Active Addresses", value: activeAddresses.toLocaleString(), color: "green" },
              { title: "Avg Block Time", value: avgBlockTime, color: "purple" },
              { title: "Network Hash Rate", value: networkHashRate, color: "red" },
              { title: "Avg Gas Fee", value: avgGasFee, color: "teal" },
            ].map((metric, idx) => (
              <motion.div
                key={idx}
                className={`flex flex-col items-center p-4 border border-blue-500/30 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 ${
                  loading.blocks && loading.transactions ? 'animate-pulse' : ''
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              >
                <p className={`text-xs sm:text-sm text-${metric.color}-400 uppercase font-medium mb-2 text-center`}>
                  {metric.title}
                </p>
                <p className="text-sm sm:text-base lg:text-lg font-bold text-gray-200 text-center">
                  {metric.value}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Enhanced Three Data Panels ─── */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col lg:flex-row lg:space-x-6 space-y-6 lg:space-y-0">
        {/* Latest Blocks Panel */}
        <ExplorerPanel
          title="Latest Blocks"
          isLoading={loading.blocks}
          isUpdating={updating.blocks}
          error={error.blocks}
          items={recentBlocks}
          renderItem={(block: Block) => (
            <div className="bg-gradient-to-br from-gray-800 to-gray-700 p-3 sm:p-4 rounded-lg border border-blue-500/20 hover:border-blue-400/40 transition-all duration-300 hover:shadow-lg">
              <div className="flex flex-col justify-between items-start gap-2 sm:gap-3">
                <div className="w-full">
                  <Link
                    href={`/explorer/latest/block/${block.number}`}
                    className="text-blue-400 font-semibold hover:text-blue-300 text-sm transition-colors"
                  >
                    Block #{block.number.toLocaleString()}
                  </Link>
                  <p className="text-gray-400 text-xs mt-1">{block.timestamp}</p>
                </div>
                <div className="w-full space-y-1">
                  <p className="text-gray-200 text-xs font-medium">{block.transactionCount} txns</p>
                  <p className="text-gray-400 text-xs">Gas Used: {block.gasUsed}</p>
                  <p className="text-gray-400 text-xs">Difficulty: {block.difficulty}</p>
                  <p className="text-gray-400 text-xs truncate">
                    Validator: {block.validator.slice(0, 6)}…{block.validator.slice(-4)}
                  </p>
                </div>
              </div>
            </div>
          )}
          viewAllHref="/explorer/latest/blocks"
          emptyMessage="No blocks found"
          retry={() => retryFetch("blocks")}
        />

        {/* Latest Transactions Panel */}
        <ExplorerPanel
          title="Latest Transactions"
          isLoading={loading.transactions}
          isUpdating={updating.transactions}
          error={error.transactions}
          items={recentTransactions}
          renderItem={(tx: Transaction) => (
            <div className="bg-gradient-to-br from-gray-800 to-gray-700 p-3 sm:p-4 rounded-lg border border-blue-500/20 hover:border-blue-400/40 transition-all duration-300 hover:shadow-lg">
              <div className="flex flex-col justify-between items-start gap-2 sm:gap-3">
                <div className="w-full">
                  <Link
                    href={`/explorer/tx/${tx.hash}`}
                    className="text-blue-400 font-semibold hover:text-blue-300 text-sm transition-colors break-all"
                  >
                    {tx.hash.slice(0, 8)}…{tx.hash.slice(-6)}
                  </Link>
                  <p className="text-gray-400 text-xs mt-1">{tx.timestamp}</p>
                </div>
                <div className="w-full space-y-1">
                  <p className="text-gray-200 text-xs">
                    From: <span className="text-gray-400 break-all">{tx.from.slice(0, 8)}…{tx.from.slice(-6)}</span>
                  </p>
                  <p className="text-gray-200 text-xs">
                    To: <span className="text-gray-400 break-all">{tx.to.slice(0, 8)}…{tx.to.slice(-6)}</span>
                  </p>
                  <p className="text-gray-200 text-xs font-medium">Value: {tx.value}</p>
                </div>
              </div>
            </div>
          )}
          viewAllHref="/explorer/latest/transactions"
          emptyMessage="No transactions found"
          retry={() => retryFetch("transactions")}
        />

        {/* Whale Transactions Panel */}
        <ExplorerPanel
          title="Whale Transactions"
          isLoading={loading.whales}
          isUpdating={updating.whales}
          error={error.whales}
          items={whaleTransactions}
          renderItem={(tx: WhaleTransaction) => (
            <div className="bg-gradient-to-br from-gray-800 to-gray-700 p-3 sm:p-4 rounded-lg border border-blue-500/20 hover:border-blue-400/40 transition-all duration-300 hover:shadow-lg">
              <div className="flex flex-col justify-between items-start gap-2 sm:gap-3">
                <div className="w-full">
                  <Link
                    href={`/explorer/tx/${tx.hash}`}
                    className="text-blue-400 font-semibold hover:text-blue-300 text-sm transition-colors break-all"
                  >
                    {tx.hash.slice(0, 8)}…{tx.hash.slice(-6)}
                  </Link>
                  <p className="text-gray-400 text-xs mt-1">{tx.timestamp}</p>
                </div>
                <div className="w-full space-y-1">
                  <p className="text-gray-200 text-xs">
                    From: <span className="text-gray-400 break-all">{tx.from.slice(0, 8)}…{tx.from.slice(-6)}</span>
                  </p>
                  <p className="text-gray-200 text-xs">
                    To: <span className="text-gray-400 break-all">{tx.to.slice(0, 8)}…{tx.to.slice(-6)}</span>
                  </p>
                  <p className="text-gray-200 text-xs font-medium text-green-400">Value: {tx.value}</p>
                </div>
              </div>
            </div>
          )}
          viewAllHref="/whale-watcher"
          emptyMessage="No whale transactions found"
          retry={() => retryFetch("whales")}
        />
      </section>

      {/* ─── Footer ─── */}
      <Footer />
    </div>
  );
}






