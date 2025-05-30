"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ClipboardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

// Components
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

// Search Icon Component
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

// External Link Icon Component
function ExternalLinkIcon({ className }: { className: string }) {
  return <ArrowTopRightOnSquareIcon className={className} />;
}

// Spinner Icon for Updating Indicator
function SpinnerIcon({ className }: { className: string }) {
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
        d="M4 12a8 8 0 018-8v2a6 6 0 00-6 6h-2zm8-8v2a6 6 0 016 6h2a8 8 0 01-8 8v-2a6 6 0 00-6-6H4z"
      />
    </svg>
  );
}

interface Block {
  number: number;
  hash: string;
  timestamp: string;
  transactionCount: number;
  validator: string;
  gasUsed: string;
  difficulty: string;
  timestampRaw: number;
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

export default function ExplorerPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState<string>("");
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
  const [totalTxns, setTotalTxns] = useState<number>(0);
  const [latestBlock, setLatestBlock] = useState<number>(0);
  const [gasPrice, setGasPrice] = useState<string>("0");
  const [pendingTxns, setPendingTxns] = useState<number>(0);
  const [activeAddresses, setActiveAddresses] = useState<number>(0);
  const [avgBlockTime, setAvgBlockTime] = useState<string>("0");
  const [networkHashRate, setNetworkHashRate] = useState<string>("0");
  const [avgGasFee, setAvgGasFee] = useState<string>("0");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Use refs to store previous data for comparison
  const prevBlocksRef = useRef<Block[]>([]);
  const prevTransactionsRef = useRef<Transaction[]>([]);
  const prevWhaleTransactionsRef = useRef<WhaleTransaction[]>([]);

  // Alchemy API URL
  const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

  // Theme classes
  const themeClasses = {
    background: "bg-gray-950",
    text: "text-gray-200",
    border: "border-blue-500/30",
    headerBg: "bg-gray-950",
    containerBg: "bg-[#141A2F]",
    hoverBg: "hover:bg-[#1E263B] hover:shadow-lg hover:scale-[1.01]",
    secondaryText: "text-gray-400",
    errorText: "text-red-400",
    buttonBg: "bg-blue-500/20",
    buttonHover: "hover:bg-blue-500/40",
    buttonDisabled: "bg-gray-800",
    shadow: "shadow-[0_2px_8px_rgba(59,130,246,0.2)]",
    toastBg: "bg-blue-500/80",
    panelHeader: "bg-[#141A2F] w-full -mx-4 sm:-mx-6 -mt-6 pt-6 pb-3 px-4 sm:px-6",
    statsBg: "bg-[#141A2F]",
    separator: "bg-blue-400",
  };

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [isMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch whale transactions from Firestore
  const fetchWhaleTransactions = async () => {
    try {
      const { getFirestore } = await import("firebase/firestore");
      const { initializeApp, getApps } = await import("firebase/app");

      // Initialize Firebase if not already initialized
      if (!getApps().length) {
        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };
        initializeApp(firebaseConfig);
      }

      const db = getFirestore();
      const { collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");

      const whaleQuery = query(
        collection(db, "whaleTransactions"),
        orderBy("timestamp", "desc"),
        limit(3)
      );
      const whaleSnapshot = await getDocs(whaleQuery);
      const whaleData: WhaleTransaction[] = whaleSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          hash: data.hash || "",
          from: data.fromAddress || "",
          to: data.toAddress || "",
          value: data.amountToken ? data.amountToken.toFixed(4) : "0",
          timestamp: data.timestamp
            ? formatDistanceToNow(new Date(data.timestamp.toDate()), { addSuffix: true }).toUpperCase()
            : "",
        };
      });

      const hasNewWhaleTransactions = whaleData.some(
        (tx, i) => !prevWhaleTransactionsRef.current[i] || tx.hash !== prevWhaleTransactionsRef.current[i].hash
      );
      if (hasNewWhaleTransactions) {
        setWhaleTransactions(whaleData);
        prevWhaleTransactionsRef.current = whaleData;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error fetching whale transactions from Firestore:", errorMessage);
      setError((prev) => ({ ...prev, whales: `Error: ${errorMessage}` }));
    }
  };

  // Fetch blockchain data
  const fetchData = async (isInitialFetch: boolean = false) => {
    if (!alchemyUrl) {
      console.error("Missing Alchemy API URL. Set NEXT_PUBLIC_ALCHEMY_API_URL in .env.local.");
      setError({
        blocks: "Alchemy API URL is missing.",
        transactions: "Alchemy API URL is missing.",
        whales: "Alchemy API URL is missing.",
      });
      setLoading({ blocks: false, transactions: false, whales: false });
      return;
    }

    try {
      if (!isInitialFetch) {
        setUpdating({ blocks: true, transactions: true, whales: true });
      }

      // Fetch Gas Price
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
      if (newGasPrice !== gasPrice) setGasPrice(newGasPrice);

      // Fetch Fee History (last 10 blocks)
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
      const baseFees = feeHistoryData.result.baseFeePerGas.map((fee: string) => parseInt(fee, 16));
      const avgFeeInWei = baseFees.reduce((sum: number, fee: number) => sum + fee, 0) / baseFees.length;
      const newAvgGasFee = (avgFeeInWei / 1e9).toFixed(4) + " Gwei";
      if (newAvgGasFee !== avgGasFee) setAvgGasFee(newAvgGasFee);

      // Fetch Pending Transactions
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
      const newPendingTxns = parseInt(pendingTxData.result, 16);
      if (newPendingTxns !== pendingTxns) setPendingTxns(newPendingTxns);

      // Fetch Latest Block Number
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
      const latestBlockNumber = parseInt(blockNumberData.result, 16);
      if (latestBlockNumber !== latestBlock) setLatestBlock(latestBlockNumber);

      // Fetch Blocks (last 3 for display)
      const blockPromises = [];
      for (let i = 0; i < 3; i++) {
        const blockNum = latestBlockNumber - i;
        blockPromises.push(
          fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getBlockByNumber",
              params: [`0x${blockNum.toString(16)}`, true],
              id: i + 4,
            }),
          })
        );
      }
      const blockResponses = await Promise.all(blockPromises);
      const blocks = await Promise.all(blockResponses.map((res) => res.json()));

      const blockData: Block[] = blocks.map((block: any, index: number) => {
        if (block.error) {
          throw new Error(`Failed to fetch block ${latestBlockNumber - index}: ${block.error.message}`);
        }
        return {
          number: parseInt(block.result.number, 16),
          hash: block.result.hash,
          timestamp: formatDistanceToNow(new Date(parseInt(block.result.timestamp, 16) * 1000), {
            addSuffix: true,
          }).toUpperCase(),
          timestampRaw: parseInt(block.result.timestamp, 16),
          transactionCount: block.result.transactions.length,
          validator: block.result.miner || "0x4200000000000000000000000000000000000011",
          gasUsed: (parseInt(block.result.gasUsed, 16) / 1e6).toFixed(2) + "M",
          difficulty: (parseInt(block.result.difficulty, 16) / 1e12).toFixed(2) + "T",
        };
      });

      // Calculate Average Block Time and Network Hash Rate
      if (blockData.length > 1) {
        const timeDiffs = [];
        for (let i = 1; i < blockData.length; i++) {
          const diff = blockData[i - 1].timestampRaw - blockData[i].timestampRaw;
          timeDiffs.push(diff);
        }
        const avgTime = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
        const newAvgBlockTime = avgTime.toFixed(2) + " s";
        if (newAvgBlockTime !== avgBlockTime) setAvgBlockTime(newAvgBlockTime);

        const avgDifficulty = blockData.reduce((sum, block) => sum + parseFloat(block.difficulty), 0) / blockData.length;
        const hashRate = (avgDifficulty * 1e12) / avgTime / 1e12;
        const newNetworkHashRate = hashRate.toFixed(2) + " TH/s";
        if (newNetworkHashRate !== networkHashRate) setNetworkHashRate(newNetworkHashRate);
      }

      // Compare blocks
      const hasNewBlocks = blockData.some((block, i) => !prevBlocksRef.current[i] || block.hash !== prevBlocksRef.current[i].hash);
      if (hasNewBlocks) {
        setRecentBlocks(blockData);
        prevBlocksRef.current = blockData;
      }

      // Fetch Transactions
      const txData: Transaction[] = [];
      for (const block of blocks) {
        if (block.error || !block.result) continue;
        for (const tx of block.result.transactions.slice(0, 3 - txData.length)) {
          if (txData.length >= 3) break;
          const value = tx.value ? parseInt(tx.value, 16) / 1e18 : 0;
          txData.push({
            hash: tx.hash,
            from: tx.from,
            to: tx.to || "N/A",
            value: value.toFixed(4),
            timestamp: formatDistanceToNow(new Date(parseInt(block.result.timestamp, 16) * 1000), {
              addSuffix: true,
            }).toUpperCase(),
          });
        }
        if (txData.length >= 3) break;
      }
      const hasNewTransactions = txData.some((tx, i) => !prevTransactionsRef.current[i] || tx.hash !== prevTransactionsRef.current[i].hash);
      if (hasNewTransactions) {
        setRecentTransactions(txData);
        prevTransactionsRef.current = txData;
      }

      // Total Transactions (from last 3 blocks)
      let totalTxCount = 0;
      for (const block of blocks) {
        if (block.result) {
          totalTxCount += block.result.transactions.length;
        }
      }
      if (totalTxCount !== totalTxns) setTotalTxns(totalTxCount);

      // Fetch Active Addresses (from last 50 blocks)
      const addresses = new Set<string>();
      const transfersResponse = await fetch(alchemyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: `0x${(latestBlockNumber - 50).toString(16)}`,
              toBlock: "latest",
              category: ["external"],
              maxCount: "0x64", // 100 transfers
            },
          ],
          id: 9,
        }),
      });
      const transfersData = await transfersResponse.json();
      if (transfersData.error) {
        throw new Error(transfersData.error.message);
      }
      transfersData.result.transfers.forEach((tx: any) => {
        addresses.add(tx.from);
        if (tx.to) addresses.add(tx.to);
      });
      const newActiveAddresses = addresses.size;
      if (newActiveAddresses !== activeAddresses) setActiveAddresses(newActiveAddresses);

      // Fetch Whale Transactions from Firestore
      await fetchWhaleTransactions();

      setLoading({ blocks: false, transactions: false, whales: false });
      setUpdating({ blocks: false, transactions: false, whales: false });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error fetching explorer data:", errorMessage);
      setError({
        blocks: `Error: ${errorMessage}`,
        transactions: `Error: ${errorMessage}`,
        whales: `Error: ${errorMessage}`,
      });
      setLoading({ blocks: false, transactions: false, whales: false });
      setUpdating({ blocks: false, transactions: false, whales: false });
    }
  };

  useEffect(() => {
    fetchData(true); // Initial fetch
    const interval = setInterval(() => fetchData(false), 15000); // Subsequent fetches
    return () => clearInterval(interval);
  }, [alchemyUrl]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToastMessage("Copied to clipboard!");
  };

  const handleSearch = () => {
    const query = searchQuery.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
      router.push(`/explorer/address/${query}`);
    } else if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
      router.push(`/explorer/latest/tx/${query}`);
    } else if (/^\d+$/.test(query)) {
      router.push(`/explorer/latest/block/${query}`);
    } else {
      setToastMessage("Invalid search query. Please enter a valid address, transaction hash, or block number.");
    }
  };

  const retryFetch = (section: keyof typeof loading) => {
    setError((prev) => ({ ...prev, [section]: null }));
    setLoading((prev) => ({ ...prev, [section]: true }));
    fetchData(true);
  };

  return (
    <div className={`min-h-screen w-full font-mono ${themeClasses.background} ${themeClasses.text}`}>
      <style jsx>{`
        /* Temporary override to hide potential tick mark in Header */
        header svg:not(.search-icon) {
          display: none !important;
        }
      `}</style>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg ${themeClasses.toastBg} text-white text-sm shadow-lg z-50 animate-fade-in-out`}
        >
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="relative">
        <Header />
        <div className="h-px bg-blue-500/30 w-full">
          <div className={`h-px ${themeClasses.separator}`}></div>
        </div>
      </div>

      {/* Main Content */}
      <main className={`w-full ${themeClasses.background}`}>
        {/* Hero Section */}
        <section className={`w-full bg-gradient-to-b from-gray-950 to-gray-900 text-center`}>
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-white uppercase mb-4 relative">
              Blockchain Explorer
            </h1>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search address, tx hash, or block number"
                className={`w-full py-3 pl-10 pr-10 text-base rounded-lg ${themeClasses.containerBg} ${themeClasses.text} border ${themeClasses.border} focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all duration-300 placeholder-gray-500 transform focus:scale-[1.01] focus:shadow-glow`}
                aria-label="Search blockchain data"
              />
              <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 search-icon" />
              <button
                onClick={handleSearch}
                disabled={!searchQuery}
                className={`mt-3 w-full py-2 ${themeClasses.buttonBg} ${searchQuery ? themeClasses.buttonHover : themeClasses.buttonDisabled} rounded-lg text-blue-400 border ${themeClasses.border} text-sm font-medium transition-all duration-200 uppercase disabled:cursor-not-allowed`}
                aria-label="Search"
              >
                Search
              </button>
            </div>
            <div className="mt-4 flex justify-center gap-4 sm:gap-6">
              <div>
                <p className="text-xs text-blue-400 uppercase">Latest Block</p>
                <p className="text-base font-semibold">{latestBlock.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-blue-400 uppercase">Gas Price</p>
                <p className="text-base font-semibold">{gasPrice}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Network Stats Section */}
        <section className={`w-full ${themeClasses.statsBg}`}>
          <div className="mx-auto px-4 sm:px-6 py-3">
            <h2 className="text-lg sm:text-xl font-bold text-white uppercase mb-3 text-center">Network Stats</h2>
            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-3 w-full -mx-4 sm:-mx-6`}>
              {[
                { title: "Transactions", value: totalTxns.toLocaleString() },
                { title: "Pending Txns", value: pendingTxns.toLocaleString() },
                { title: "Active Addresses", value: activeAddresses.toLocaleString() },
                { title: "Avg Block Time", value: avgBlockTime },
                { title: "Network Hash Rate", value: networkHashRate },
                { title: "Avg Gas Fee", value: avgGasFee },
              ].map((metric, index) => (
                <div
                  key={index}
                  className={`flex flex-col items-center p-2 rounded-md hover:bg-[#1E263B] transition-all duration-200 ${themeClasses.shadow}`}
                >
                  <p className="text-xs text-blue-400 uppercase text-center">{metric.title}</p>
                  <p className="text-base font-semibold animate-fade-in">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Separator Line */}
        <div className={`h-px w-full ${themeClasses.separator}`} />

        {/* Data Sections */}
        <section className="w-full">
          <div className={`flex flex-col sm:flex-row divide-x divide-blue-500/30`}>
            {/* Latest Blocks */}
            <div className={`flex-1 ${themeClasses.containerBg}`}>
              <div className="px-4 sm:px-6 py-6">
                <div className="flex items-center">
                  <h2 className={`text-lg font-bold text-white uppercase ${themeClasses.panelHeader} flex-1`}>Latest Blocks</h2>
                  {updating.blocks && <SpinnerIcon className="w-4 h-4 text-blue-400 animate-spin mr-4 sm:mr-6" />}
                </div>
                <div className="p-3">
                  {loading.blocks ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-3 bg-gray-700/50 rounded w-3/4 mb-1"></div>
                          <div className="h-2 bg-gray-700/50 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : error.blocks ? (
                    <div className="flex flex-col items-center justify-center py-4">
                      <p className={`${themeClasses.errorText} text-center uppercase text-xs`}>{error.blocks}</p>
                      <button
                        onClick={() => retryFetch("blocks")}
                        className={`mt-2 px-3 py-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-lg text-blue-400 border ${themeClasses.border} text-xs font-medium uppercase`}
                      >
                        Retry
                      </button>
                    </div>
                  ) : recentBlocks.length > 0 ? (
                    <div className="space-y-2">
                      {recentBlocks.map((block) => (
                        <div
                          key={block.hash}
                          className={`p-2 ${themeClasses.border} rounded-lg ${themeClasses.hoverBg} transition-all duration-200 animate-fade-in`}
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                              <Link
                                href={`/explorer/latest/block/${block.number}`}
                                className="text-blue-400 font-semibold hover:underline text-sm"
                              >
                                Block #{block.number}
                              </Link>
                              <p className={`${themeClasses.secondaryText} text-xs mt-1`}>{block.timestamp}</p>
                            </div>
                            <div className="text-left sm:text-right space-y-1">
                              <p className={`${themeClasses.text} text-xs`}>{block.transactionCount} txns</p>
                              <p className={`${themeClasses.secondaryText} text-xs`}>Gas Used: {block.gasUsed}</p>
                              <p className={`${themeClasses.secondaryText} text-xs`}>Difficulty: {block.difficulty}</p>
                              <p className={`${themeClasses.secondaryText} text-xs truncate`}>
                                Validator: {block.validator.slice(0, 6)}...{block.validator.slice(-4)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end mt-2">
                        <Link
                          href="/explorer/latest/blocks"
                          className="text-blue-400 hover:underline text-xs block text-center mt-3 uppercase"
                        >
                          View All Blocks
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className={`${themeClasses.secondaryText} text-center py-4 uppercase text-xs`}>No blocks found</p>
                  )}
                </div>
              </div>
            </div>

            {/* Latest Transactions */}
            <div className={`flex-1 ${themeClasses.containerBg}`}>
              <div className="px-4 sm:px-6 py-6">
                <div className="flex items-center">
                  <h2 className={`text-lg font-bold text-white uppercase ${themeClasses.panelHeader} flex-1`}>Latest Transactions</h2>
                  {updating.transactions && <SpinnerIcon className="w-4 h-4 text-blue-400 animate-spin mr-4 sm:mr-6" />}
                </div>
                <div className="p-3">
                  {loading.transactions ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-3 bg-gray-700/50 rounded w-3/4 mb-1"></div>
                          <div className="h-2 bg-gray-700/50 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : error.transactions ? (
                    <div className="flex flex-col items-center justify-center py-4">
                      <p className={`${themeClasses.errorText} text-center uppercase text-xs`}>{error.transactions}</p>
                      <button
                        onClick={() => retryFetch("transactions")}
                        className={`mt-2 px-3 py-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-lg text-blue-400 border ${themeClasses.border} text-xs font-medium uppercase`}
                      >
                        Retry
                      </button>
                    </div>
                  ) : recentTransactions.length > 0 ? (
                    <div className="space-y-2">
                      {recentTransactions.map((tx) => (
                        <div
                          key={tx.hash}
                          className={`p-2 ${themeClasses.border} rounded-lg ${themeClasses.hoverBg} transition-all duration-200 animate-fade-in`}
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                              <Link
                                href={`/explorer/latest/tx/${tx.hash}`}
                                className="text-blue-400 font-semibold hover:underline text-sm truncate"
                              >
                                {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                              </Link>
                              <p className={`${themeClasses.secondaryText} text-xs mt-1`}>{tx.timestamp}</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className={`${themeClasses.text} text-xs truncate`}>From: {tx.from.slice(0, 6)}...{tx.from.slice(-4)}</p>
                              <p className={`${themeClasses.text} text-xs mt-1 truncate`}>
                                To: {tx.to === "N/A" ? "N/A" : `${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`}
                              </p>
                              <p className={`${themeClasses.secondaryText} text-xs mt-1`}>{tx.value} ETH</p>
                            </div>
                          </div>
                          <div className="flex justify-end gap-1 mt-2">
                            <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLinkIcon className="w-4 h-4 text-blue-400 hover:text-blue-500 transition-all" />
                            </a>
                            <button
                              onClick={() => copyToClipboard(tx.hash)}
                              className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full border ${themeClasses.border} transition-all`}
                              aria-label="Copy transaction hash"
                            >
                              <ClipboardIcon className="w-4 h-4 text-blue-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end mt-2">
                        <Link
                          href="/explorer/latest/transactions"
                          className="text-blue-400 hover:underline text-xs block text-center mt-3 uppercase"
                        >
                          View All Transactions
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className={`${themeClasses.secondaryText} text-center py-4 uppercase text-xs`}>No transactions found</p>
                  )}
                </div>
              </div>
            </div>

            {/* Whale Transactions */}
            <div className={`flex-1 ${themeClasses.containerBg}`}>
              <div className="px-4 sm:px-6 py-6">
                <div className="flex items-center">
                  <h2 className={`text-lg font-bold text-white uppercase ${themeClasses.panelHeader} flex-1`}>Whale Transactions</h2>
                  {updating.whales && <SpinnerIcon className="w-4 h-4 text-blue-400 animate-spin mr-4 sm:mr-6" />}
                </div>
                <div className="p-3">
                  {loading.whales ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-3 bg-gray-700/50 rounded w-3/4 mb-1"></div>
                          <div className="h-2 bg-gray-700/50 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : error.whales ? (
                    <div className="flex flex-col items-center justify-center py-4">
                      <p className={`${themeClasses.errorText} text-center uppercase text-xs`}>{error.whales}</p>
                      <button
                        onClick={() => retryFetch("whales")}
                        className={`mt-2 px-3 py-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-lg text-blue-400 border ${themeClasses.border} text-xs font-medium uppercase`}
                      >
                        Retry
                      </button>
                    </div>
                  ) : whaleTransactions.length > 0 ? (
                    <div className="space-y-2">
                      {whaleTransactions.map((tx) => (
                        <div
                          key={tx.hash}
                          className={`p-2 ${themeClasses.border} rounded-lg ${themeClasses.hoverBg} transition-all duration-200 animate-fade-in`}
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                              <Link
                                href={`/explorer/latest/tx/${tx.hash}`}
                                className="text-blue-400 font-semibold hover:underline text-sm truncate"
                              >
                                {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                              </Link>
                              <p className={`${themeClasses.secondaryText} text-xs mt-1`}>{tx.timestamp}</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className={`${themeClasses.text} text-xs truncate`}>From: {tx.from.slice(0, 6)}...{tx.from.slice(-4)}</p>
                              <p className={`${themeClasses.text} text-xs mt-1 truncate`}>
                                To: {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                              </p>
                              <p className={`${themeClasses.secondaryText} text-xs mt-1`}>{tx.value} ETH</p>
                            </div>
                          </div>
                          <div className="flex justify-end gap-1 mt-2">
                            <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLinkIcon className="w-4 h-4 text-blue-400 hover:text-blue-500 transition-all" />
                            </a>
                            <button
                              onClick={() => copyToClipboard(tx.hash)}
                              className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full border ${themeClasses.border} transition-all`}
                              aria-label="Copy transaction hash"
                            >
                              <ClipboardIcon className="w-4 h-4 text-blue-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end mt-2">
                        <Link
                          href="/whale-watchers"
                          className="text-blue-400 hover:underline text-xs block text-center mt-3 uppercase"
                        >
                          View All Whale Transactions
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className={`${themeClasses.secondaryText} text-center py-4 uppercase text-xs`}>No whale transactions found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}