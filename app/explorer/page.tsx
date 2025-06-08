"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

// ▲ Make sure we import ClipboardIcon now
import { ClipboardIcon } from "@heroicons/react/24/outline";

// Header/Footer remain unchanged
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

/** ──────────── Custom Loader Component ──────────── **/
// A simple circular spinner using Tailwind classes
function Loader() {
  return (
    <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
  );
}

/** ──────────── Search Icon ──────────── **/
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

/** ──────────── External Link Icon (Up‐Right Arrow) ──────────── **/
function ExternalLinkIcon({ className }: { className: string }) {
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
        d="M7 17l10-10M7 7h10v10"
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

  /** Toast for “Copied to clipboard” **/
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /** Refs to compare previous data **/
  const prevBlocksRef = useRef<Block[]>([]);
  const prevTransactionsRef = useRef<Transaction[]>([]);
  const prevWhaleTransactionsRef = useRef<WhaleTransaction[]>([]);

  /** Alchemy API URL **/
  const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

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

  /** ──────────── copyToClipboard ──────────── **/
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage("Copied to clipboard!");
    } catch {
      setToastMessage("Failed to copy");
    }
  }, []);

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
        const data = doc.data() as any;
        return {
          hash: data.hash ?? "",
          from: data.fromAddress ?? "",
          to: data.toAddress ?? "",
          value: data.amountToken ? data.amountToken.toFixed(4) : "0",
          timestamp: data.timestamp
            ? formatDistanceToNow(new Date(data.timestamp.toDate()), { addSuffix: true }).toUpperCase()
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
    } catch (err: any) {
      console.error("Error fetching whale transactions:", err.message);
      setError((prev) => ({ ...prev, whales: `Error: ${err.message}` }));
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

      if (!isInitialFetch) {
        setUpdating({ blocks: true, transactions: true, whales: true });
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
        } catch (err: any) {
          console.warn("Gas Price fetch failed:", err.message);
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
        } catch (err: any) {
          console.warn("Fee History fetch failed:", err.message);
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
        } catch (err: any) {
          console.warn("Pending Txns fetch failed:", err.message);
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
        } catch (err: any) {
          console.warn("Latest Block Number fetch failed:", err.message);
        }

        /************************
         * 5) Fetch the Last 3 Blocks
         ************************/
        let blocksJson: any[] = [];
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

          blockData = blocksJson.map((b: any) => {
            if (b.error) throw new Error(b.error.message);
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
        } catch (err: any) {
          console.warn("Block fetch failed:", err.message);
          setError((prev) => ({ ...prev, blocks: `Error: ${err.message}` }));
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
         * 7) Build “Recent Transactions” from blocksJson
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
        } catch (err: any) {
          console.warn("Recent Tx fetch failed:", err.message);
          setError((prev) => ({ ...prev, transactions: `Error: ${err.message}` }));
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
          transfersData.result.transfers.forEach((t: any) => {
            addrSet.add(t.from);
            if (t.to) addrSet.add(t.to);
          });
          setActiveAddresses(addrSet.size);
        } catch (err: any) {
          console.warn("Active Addresses fetch failed:", err.message);
        }

        /*******************************************
         * 10) Fetch Whale Transactions
         *******************************************/
        await fetchWhaleTransactions();

        setLoading({ blocks: false, transactions: false, whales: false });
        setUpdating({ blocks: false, transactions: false, whales: false });
      } catch (outerErr: any) {
        console.error("Error fetching explorer data:", outerErr.message);
        setError({
          blocks: `Error: ${outerErr.message}`,
          transactions: `Error: ${outerErr.message}`,
          whales: `Error: ${outerErr.message}`,
        });
        setLoading({ blocks: false, transactions: false, whales: false });
        setUpdating({ blocks: false, transactions: false, whales: false });
      }
    },
    [alchemyUrl, latestBlock, fetchWhaleTransactions]
  );

  // Initial fetch + poll every 15s
  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 15000);
    return () => clearInterval(interval);
  }, [alchemyUrl, fetchData]);

  /** ──────────── handleSearch ──────────── **/
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
  }, [searchQuery, router]);

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
    <div className="flex flex-col items-center justify-center py-4">
      <p className="text-red-400 text-center uppercase text-xs">{message}</p>
      <button
        onClick={onRetry}
        className="mt-2 px-3 py-1 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-blue-400 border border-blue-500/30 text-xs font-medium uppercase transition"
      >
        Retry
      </button>
    </div>
  );

  /** ──────────── ExplorerPanel ──────────── **/
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
      // Make panel flex-1 and flex-col so all three panels are equal height
      <div className="flex-1 flex flex-col border border-blue-500/30 bg-[#141A2F]">
        {/* Panel Header */}
        <div className="px-4 sm:px-6 py-3 flex items-center border-b border-blue-500/30">
          <h2 className="text-lg font-bold text-gray-200 uppercase flex-1">{title}</h2>
          {isUpdating && <Loader />}
        </div>

        {/* Panel Body: flex-1, and content arranged in column so “View All” is pushed to bottom */}
        <div className="p-3 flex-1 flex flex-col">
          {isLoading ? (
            <div className="flex justify-center items-center flex-1">
              <Loader />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={retry} />
          ) : items.length > 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="space-y-3 overflow-hidden">
                {items.map((item) => (
                  <div key={(item as any).hash ?? Math.random()}>{renderItem(item)}</div>
                ))}
              </div>
              {/* “View All” centered at the bottom */}
              <div className="mt-auto flex justify-center pt-2">
                <Link href={viewAllHref} className="text-blue-400 hover:underline text-xs uppercase">
                  View All {title}
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4 uppercase text-xs flex-1 flex items-center justify-center">
              {emptyMessage}
            </p>
          )}
        </div>
      </div>
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

      {/* ─── Toast Notification ─── */}
      {toastMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg ${themeClasses.toastBg} text-white text-sm shadow-lg z-50`}
        >
          {toastMessage}
        </div>
      )}

      {/* ─── Header (unchanged) ─── */}
      <div className="relative z-10">
        <Header />
      </div>

      {/* ─── Hero / Search with Background Image ─── */}
      <section className="relative w-full min-h-[300px]">
        {/* Background <img> sits absolutely under everything */}
        <img
          src="https://i.imgur.com/YVycXUz.jpeg"
          alt="Hero background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Semi‐transparent black overlay (30% opacity now) */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Content sits on top via z‐index */}
        <div className="relative z-10 flex flex-col justify-center min-h-[300px]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-200 uppercase mb-4 text-center">
              Blockchain Explorer
            </h1>

            {/* Search Input + Button */}
            <div className="grid grid-cols-1 md:grid-cols-[3fr,1fr] gap-3 mx-auto max-w-xl">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search address, tx hash, or block number"
                  aria-label="Search blockchain data"
                  className={`w-full py-3 pl-10 pr-4 text-base rounded-lg ${themeClasses.containerBg} ${themeClasses.text} border ${themeClasses.border} placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition duration-300`}
                />
                <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
              <button
                onClick={handleSearch}
                disabled={!searchQuery}
                className={`py-3 rounded-lg text-sm font-medium uppercase text-blue-400 border ${themeClasses.border} ${
                  searchQuery ? `${themeClasses.buttonBg} ${themeClasses.buttonHover}` : themeClasses.buttonDisabled
                } transition duration-200 disabled:cursor-not-allowed`}
                aria-label="Search"
              >
                Search
              </button>
            </div>

            {/* Latest Block + Gas Price */}
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4 text-center sm:text-left">
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
        </div>
      </section>

      {/* ─── Network Stats ─── */}
      <section className="w-full">
        <div className="mx-auto px-4 sm:px-6 py-6 max-w-5xl">
          <h2 className="text-lg sm:text-xl font-bold text-gray-200 uppercase mb-3 text-center">
            Network Stats
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { title: "Transactions", value: totalTxns.toLocaleString() },
              { title: "Pending Txns", value: pendingTxns.toLocaleString() },
              { title: "Active Addresses", value: activeAddresses.toLocaleString() },
              { title: "Avg Block Time", value: avgBlockTime },
              { title: "Network Hash Rate", value: networkHashRate },
              { title: "Avg Gas Fee", value: avgGasFee },
            ].map((metric, idx) => (
              <div
                key={idx}
                className={`flex flex-col items-center p-3 border ${themeClasses.border} rounded-md ${themeClasses.containerBg}`}
              >
                <p className="text-xs text-blue-400 uppercase text-center">{metric.title}</p>
                <p className="text-base font-semibold mt-1">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Three Data Panels ─── */}
      <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row lg:space-x-4 space-y-4 lg:space-y-0">
        {/* Latest Blocks Panel */}
        <ExplorerPanel
          title="Latest Blocks"
          isLoading={loading.blocks}
          isUpdating={updating.blocks}
          error={error.blocks}
          items={recentBlocks}
          renderItem={(block: Block) => (
            <div className="py-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <Link
                    href={`/explorer/latest/block/${block.number}`}
                    className="text-blue-400 font-semibold hover:underline text-sm"
                  >
                    Block #{block.number.toLocaleString()}
                  </Link>
                  <p className="text-gray-400 text-xs mt-1">{block.timestamp}</p>
                </div>
                <div className="text-left sm:text-right space-y-1">
                  <p className="text-gray-200 text-xs">{block.transactionCount} txns</p>
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
            <div className="py-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <Link
                    href={`/explorer/latest/tx/${tx.hash}`}
                    className="text-blue-400 font-semibold hover:underline text-sm truncate block max-w-[120px] sm:max-w-none"
                  >
                    {tx.hash.slice(0, 6)}…{tx.hash.slice(-4)}
                  </Link>
                  <p className="text-gray-400 text-xs mt-1">{tx.timestamp}</p>
                </div>
                <div className="text-left sm:text-right space-y-1">
                  <p className="text-gray-200 text-xs truncate">
                    From: {tx.from.slice(0, 6)}…{tx.from.slice(-4)}
                  </p>
                  <p className="text-gray-200 text-xs mt-1 truncate">
                    To: {tx.to === "N/A" ? "N/A" : `${tx.to.slice(0, 6)}…${tx.to.slice(-4)}`}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">{tx.value} ETH</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-1">
                {/* Link into your own route */}
                <Link href={`/explorer/latest/tx/${tx.hash}`}>
                  <ExternalLinkIcon className="w-4 h-4 text-blue-400 hover:text-blue-500 transition" />
                </Link>
                <button
                  onClick={() => copyToClipboard(tx.hash)}
                  className={`p-1 ${themeClasses.containerBg} border ${themeClasses.border} rounded-full transition hover:bg-blue-500/20`}
                  aria-label="Copy transaction hash"
                >
                  <ClipboardIcon className="w-4 h-4 text-blue-400" />
                </button>
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
            <div className="py-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <Link
                    href={`/explorer/latest/tx/${tx.hash}`}
                    className="text-blue-400 font-semibold hover:underline text-sm truncate block max-w-[120px] sm:max-w-none"
                  >
                    {tx.hash.slice(0, 6)}…{tx.hash.slice(-4)}
                  </Link>
                  <p className="text-gray-400 text-xs mt-1">{tx.timestamp}</p>
                </div>
                <div className="text-left sm:text-right space-y-1">
                  <p className="text-gray-200 text-xs truncate">
                    From: {tx.from.slice(0, 6)}…{tx.from.slice(-4)}
                  </p>
                  <p className="text-gray-200 text-xs mt-1 truncate">
                    To: {tx.to.slice(0, 6)}…{tx.to.slice(-4)}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">{tx.value} ETH</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-1">
                {/* Link into your own route */}
                <Link href={`/explorer/latest/tx/${tx.hash}`}>
                  <ExternalLinkIcon className="w-4 h-4 text-blue-400 hover:text-blue-500 transition" />
                </Link>
                <button
                  onClick={() => copyToClipboard(tx.hash)}
                  className={`p-1 ${themeClasses.containerBg} border ${themeClasses.border} rounded-full transition hover:bg-blue-500/20`}
                  aria-label="Copy transaction hash"
                >
                  <ClipboardIcon className="w-4 h-4 text-blue-400" />
                </button>
              </div>
            </div>
          )}
          viewAllHref="/whale-watchers"
          emptyMessage="No whale transactions found"
          retry={() => retryFetch("whales")}
        />
      </section>

      {/* ─── Footer ─── */}
      <Footer />
    </div>
  );
}






