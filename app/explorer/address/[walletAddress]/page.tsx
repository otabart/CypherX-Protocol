"use client";

import { notFound } from "next/navigation";
import { useState, useEffect } from "react";
import { ClipboardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_FIREBASE_MESSAGING_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "YOUR_FIREBASE_APP_ID",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface Token {
  name: string;
  symbol: string;
  balance: string;
  contractAddress: string;
  usdValue: number | null;
  recentActivity: number; // Number of transfers in the last 24 hours
  tokenType: "ERC-20" | "ERC-721"; // Added for filtering
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  gasUsed?: string; // Added for gas usage
  timestamp?: number; // Added for timeline
}

interface WalletData {
  ethBalance: number;
  ethUsdValue: number;
  totalUsdValue: number; // Added for summary
  tokens: Token[];
  txList: Transaction[];
  ensName?: string;
  lastScannedBlock?: { number: string; timestamp: number };
}

interface Ad {
  createdAt: string;
  destinationUrl: string;
  imageUrl: string;
  type: "banner" | "sidebar" | "inline";
}

export default function WalletPage({ params }: { params: Promise<{ walletAddress: string }> }) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [txPage, setTxPage] = useState<number>(1);
  const [tokenSearch, setTokenSearch] = useState<string>("");
  const [tokenSort, setTokenSort] = useState<string>("usd-desc");
  const [tokenTypes, setTokenTypes] = useState<string[]>(["ERC-20", "ERC-721"]);
  const [showInactiveTokens, setShowInactiveTokens] = useState<boolean>(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const itemsPerPage = 10;

  // Theme classes (reverted to original)
  const themeClasses = {
    background: "bg-gray-950",
    text: "text-gray-200",
    border: "border-blue-500/30",
    headerBg: "bg-gray-950",
    containerBg: "bg-[#141A2F]",
    hoverBg: "hover:bg-[#1E263B] hover:border-blue-400/50",
    secondaryText: "text-gray-400",
    errorText: "text-red-400",
    buttonBg: "bg-blue-500/20",
    buttonHover: "hover:bg-blue-500/40",
    buttonDisabled: "bg-gray-800",
    shadow: "shadow-[0_2px_8px_rgba(59,130,246,0.2)]",
    tabActive: "border-blue-400 text-blue-400",
    tabInactive: "border-transparent text-gray-400",
    inputBg: "bg-[#1E263B]",
    selectBg: "bg-[#1E263B]",
    dropdownBg: "bg-[#1E263B]",
  };

  // Fallback ads
  const fallbackAds: Ad[] = [
    {
      createdAt: "May 12, 2025 at 9:27:33 AM UTC-7",
      destinationUrl: "https://x.com/CypherSystems_",
      imageUrl:
        "https://firebasestorage.googleapis.com/v0/b/homebase-dapp.firebasestorage.app/o/photo_2025-05-12_09-21-39.jpg?alt=media&token=b0b00101-e9f3-408f-bd19-89305dcef807",
      type: "banner",
    },
    {
      createdAt: "May 12, 2025 at 9:28:30 AM UTC-7",
      destinationUrl: "https://x.com/CypherSystems_",
      imageUrl:
        "https://firebasestorage.googleapis.com/v0/b/homebase-dapp.firebasestorage.app/o/photo_2025-05-12_09-21-44.jpg?alt=media&token=45799df2-1492-49aa-a842-a032d8d9df9c",
      type: "sidebar",
    },
  ];

  // Fetch ads from Firebase
  useEffect(() => {
    async function fetchAds() {
      try {
        const adsCollection = collection(db, "ads");
        const adsSnapshot = await getDocs(adsCollection);
        const adsList = adsSnapshot.docs.map((doc) => doc.data() as Ad);
        console.log("Fetched ads:", adsList);
        setAds(adsList.length > 0 ? adsList : fallbackAds);
      } catch (err) {
        console.error("Error fetching ads:", err);
        setAds(fallbackAds);
      }
    }
    fetchAds();
  }, []);

  // Fetch ETH price and token prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const ethRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        if (!ethRes.ok) throw new Error("Failed to fetch ETH price");
        const ethData = await ethRes.json();
        setEthPrice(ethData.ethereum.usd);

        if (walletData) {
          const updatedTokens = walletData.tokens.map((token) => {
            const usdValue = token.usdValue != null ? token.usdValue : null;
            return { ...token, usdValue };
          });
          setWalletData((prev) => (prev ? { ...prev, tokens: updatedTokens } : null));
        }
      } catch (err) {
        console.error("Error fetching prices:", err);
        setEthPrice(3000);
      }
    };
    fetchPrices();
  }, [walletData]);

  // Fetch wallet data with Alchemy enhancements
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const resolvedParams = await params;
        const address = resolvedParams.walletAddress.toLowerCase();
        setWalletAddress(address);

        // Validate wallet address
        const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
        if (!isValidAddress) notFound();

        // Alchemy API setup (replace with your Alchemy API URL)
        const alchemyUrl = "https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY";

        // Fetch latest block number
        let latestBlock = "0";
        let blockTimestamp = 0;
        try {
          const blockNumberRes = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
          });
          if (!blockNumberRes.ok) throw new Error("Failed to fetch block number");
          const blockNumberData = await blockNumberRes.json();
          if (blockNumberData.error) throw new Error(blockNumberData.error.message);
          latestBlock = parseInt(blockNumberData.result, 16).toString();

          // Fetch block details for timestamp
          const blockDetailsRes = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getBlockByNumber",
              params: [latestBlock, false],
              id: 1,
            }),
          });
          if (!blockDetailsRes.ok) throw new Error("Failed to fetch block details");
          const blockDetails = await blockDetailsRes.json();
          if (blockDetails.error) throw new Error(blockDetails.error.message);
          blockTimestamp = blockDetails.result?.timestamp ? parseInt(blockDetails.result.timestamp, 16) : 0;
        } catch (blockErr) {
          console.error("Error fetching block data:", blockErr);
        }

        // Fetch ENS name via eth_getLogs (simplified for Base Mainnet ENS)
        let ensName: string | undefined;
        try {
          const ensLogsRes = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getLogs",
              params: [
                {
                  fromBlock: "0x0",
                  toBlock: "latest",
                  address: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1", // ENS Registry (simplified)
                  topics: [
                    "0x3a77e426f1f0a5283f7d0f3a836f fashiona0a4b6e2b8c9e8e5f0c9", // NameRegistered event (simplified)
                    `0x000000000000000000000000${address.slice(2)}`,
                  ],
                },
              ],
              id: 1,
            }),
          });
          if (!ensLogsRes.ok) throw new Error("Failed to fetch ENS logs");
          const ensLogs = await ensLogsRes.json();
          if (ensLogs.error) throw new Error(ensLogs.error.message);
          if (ensLogs.result?.length > 0) {
            ensName = `${address.slice(2, 6)}.base.eth`; // Placeholder; decode log data in production
          }
        } catch (ensErr) {
          console.warn("Failed to fetch ENS name:", ensErr);
        }

        // Fetch wallet data from server-side API route
        let data: any = null;
        try {
          const response = await fetch(`/api/wallet/${address}`);
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Wallet API fetch failed:", response.status, errorText);
            throw new Error(`Failed to fetch wallet data: ${errorText || response.statusText}`);
          }

          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const errorText = await response.text();
            console.error("Unexpected response format:", errorText);
            throw new Error("Response is not JSON");
          }

          data = await response.json();
          if (data.error) throw new Error(data.error);
        } catch (apiErr) {
          console.error("Error fetching wallet data from API:", apiErr);
          // Fallback data to prevent UI from breaking
          data = {
            ethBalance: 0,
            tokens: [],
            txList: [],
          };
        }

        // Enhance tokens with recent activity using eth_getLogs
        const updatedTokens = await Promise.all(
          data.tokens.map(async (token: Token) => {
            let recentActivity = 0;
            try {
              const logsRes = await fetch(alchemyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  method: "eth_getLogs",
                  params: [
                    {
                      fromBlock: "0x" + (parseInt(latestBlock) - 172800).toString(16), // Approx 24 hours
                      toBlock: "latest",
                      address: token.contractAddress,
                      topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"], // Transfer event
                    },
                  ],
                  id: 1,
                }),
              });
              if (!logsRes.ok) throw new Error("Failed to fetch token logs");
              const logs = await logsRes.json();
              if (logs.error) throw new Error(logs.error.message);
              recentActivity = logs.result?.length || 0;
            } catch (tokenErr) {
              console.warn(`Failed to fetch token activity for ${token.contractAddress}:`, tokenErr);
            }
            return { ...token, recentActivity, tokenType: "ERC-20" as const }; // Simplified
          })
        );

        // Enhance transactions with gas usage and timestamps
        const updatedTxList = await Promise.all(
          data.txList.map(async (tx: Transaction) => {
            let gasUsed = "N/A";
            let timestamp = 0;

            try {
              const txReceiptRes = await fetch(alchemyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  method: "eth_getTransactionReceipt",
                  params: [tx.hash],
                  id: 1,
                }),
              });
              if (!txReceiptRes.ok) throw new Error("Failed to fetch transaction receipt");
              const txReceipt = await txReceiptRes.json();
              if (txReceipt.error) throw new Error(txReceipt.error.message);

              if (txReceipt.result && txReceipt.result.gasUsed) {
                gasUsed = parseInt(txReceipt.result.gasUsed, 16).toString();

                // Fetch transaction block for timestamp
                const txBlockRes = await fetch(alchemyUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_getBlockByHash",
                    params: [txReceipt.result.blockHash, false],
                    id: 1,
                  }),
                });
                if (!txBlockRes.ok) throw new Error("Failed to fetch block by hash");
                const txBlock = await txBlockRes.json();
                if (txBlock.error) throw new Error(txBlock.error.message);
                timestamp = txBlock.result?.timestamp ? parseInt(txBlock.result.timestamp, 16) : 0;
              }
            } catch (txErr) {
              console.warn(`Failed to fetch transaction details for hash ${tx.hash}:`, txErr);
            }

            return { ...tx, gasUsed, timestamp };
          })
        );

        const ethUsdValue = data.ethBalance * ethPrice;
        const totalUsdValue = ethUsdValue + updatedTokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);

        setWalletData({
          ethBalance: data.ethBalance,
          ethUsdValue,
          totalUsdValue,
          tokens: updatedTokens,
          txList: updatedTxList,
          ensName,
          lastScannedBlock: { number: latestBlock, timestamp: blockTimestamp },
        });

        if (data.ethBalance === 0 && data.tokens.length === 0 && data.txList.length === 0) {
          setError("No data found for this address on Base Mainnet.");
          setWalletData(null);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Error fetching wallet data:", errorMessage);
        setError(`Failed to load wallet data: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params, ethPrice]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  // Token filtering and sorting
  const filteredTokens = walletData?.tokens
    .filter((token) => tokenTypes.includes(token.tokenType))
    .filter(
      (token) =>
        token.name.toLowerCase().includes(tokenSearch.toLowerCase()) ||
        token.symbol.toLowerCase().includes(tokenSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (tokenSort === "usd-desc") {
        return (b.usdValue || 0) - (a.usdValue || 0);
      } else if (tokenSort === "usd-asc") {
        return (a.usdValue || 0) - (b.usdValue || 0);
      } else if (tokenSort === "activity-desc") {
        return b.recentActivity - a.recentActivity;
      } else if (tokenSort === "activity-asc") {
        return a.recentActivity - b.recentActivity;
      }
      return 0;
    });

  const activeTokens = filteredTokens?.filter((token) => parseFloat(token.balance) > 0);
  const inactiveTokens = filteredTokens?.filter((token) => parseFloat(token.balance) === 0);

  const paginatedTxList = walletData?.txList.slice((txPage - 1) * itemsPerPage, txPage * itemsPerPage);
  const totalTxPages = Math.ceil((walletData?.txList.length || 0) / itemsPerPage);

  return (
    <div className={`min-h-screen w-full font-mono ${themeClasses.background} ${themeClasses.text}`}>
      {/* Header */}
      <div className={`w-full py-4 sm:py-6 px-4 sm:px-6 ${themeClasses.headerBg} border-b ${themeClasses.border}`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold uppercase">Wallet Scan</h1>
          <span className={`${themeClasses.secondaryText} text-xs sm:text-sm uppercase`}>
            {walletData?.lastScannedBlock
              ? `Last Scanned Block: ${parseInt(walletData.lastScannedBlock.number, 16)}`
              : "Scanning..."}
          </span>
        </div>
      </div>

      {/* Banner Ad */}
      <div className="max-w-7xl mx-auto mt-4 px-4 sm:px-6">
        {ads
          .filter((ad) => ad.type === "banner")
          .slice(0, 1)
          .map((ad, index) => (
            <a
              key={index}
              href={ad.destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`block mx-auto mb-4 rounded-lg overflow-hidden ${themeClasses.shadow}`}
              style={{ width: "728px", height: "90px" }}
            >
              <img src={ad.imageUrl} alt="Advertisement" className="w-full h-full object-cover" />
            </a>
          ))}
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6 max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Main Content Area */}
        <div className="flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-6">
              <svg
                className="w-6 h-6 animate-spin text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" />
              </svg>
              <span className={`${themeClasses.secondaryText} ml-2 text-sm sm:text-base uppercase`}>Loading...</span>
            </div>
          ) : error ? (
            <p className={`${themeClasses.errorText} text-center py-6 text-sm sm:text-base uppercase`}>Error: {error}</p>
          ) : !walletData ? (
            <p className={`${themeClasses.secondaryText} text-center py-6 text-sm sm:text-base uppercase`}>No Data Available</p>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              {/* Address Section */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center space-x-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-semibold uppercase">Address</h2>
                  <span className="text-blue-400 truncate max-w-[200px] sm:max-w-[300px] text-sm sm:text-base">
                    {walletData.ensName || walletAddress}
                  </span>
                  <button
                    onClick={() => copyToClipboard(walletAddress)}
                    className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full border ${themeClasses.border}`}
                  >
                    <ClipboardIcon className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                  </button>
                  <a
                    href={`https://basescan.org/address/${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full border ${themeClasses.border}`}
                  >
                    <ArrowTopRightOnSquareIcon className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                  </a>
                </div>
                <span className={`${themeClasses.secondaryText} text-xs sm:text-sm uppercase`}>Base Mainnet</span>
              </div>

              {/* Wallet Summary */}
              <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 sm:p-6 rounded-lg`}>
                <h3 className="text-base sm:text-lg font-semibold text-blue-400 mb-4 uppercase">Wallet Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className={`p-4 rounded-lg border ${themeClasses.border} ${themeClasses.shadow}`}>
                    <h4 className="text-sm font-semibold text-blue-400 uppercase">Total Value</h4>
                    <p className={`${themeClasses.text} text-base sm:text-lg mt-1`}>${walletData.totalUsdValue.toFixed(2)} USD</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${themeClasses.border} ${themeClasses.shadow}`}>
                    <h4 className="text-sm font-semibold text-blue-400 uppercase">Active Tokens</h4>
                    <p className={`${themeClasses.text} text-base sm:text-lg mt-1`}>{activeTokens?.length || 0}</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${themeClasses.border} ${themeClasses.shadow}`}>
                    <h4 className="text-sm font-semibold text-blue-400 uppercase">Recent Activity</h4>
                    <p className={`${themeClasses.text} text-base sm:text-lg mt-1`}>{walletData.txList.length} Txns</p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-blue-400">
                <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto">
                  {["overview", "transactions", "tokens", "activity"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-2 px-3 sm:px-4 text-sm sm:text-base font-semibold border-b-2 whitespace-nowrap ${
                        activeTab === tab ? themeClasses.tabActive : themeClasses.tabInactive
                      } hover:${themeClasses.tabActive} transition-all duration-200 uppercase`}
                    >
                      {tab}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="mt-4 sm:mt-6">
                {activeTab === "overview" && (
                  <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 sm:p-6 rounded-lg`}>
                    <h3 className="text-base sm:text-lg font-semibold text-blue-400 mb-4 uppercase">Overview</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className={`p-4 rounded-lg border ${themeClasses.border} ${themeClasses.shadow}`}>
                        <h4 className="text-sm font-semibold text-blue-400 uppercase">Balance</h4>
                        <p className={`${themeClasses.text} text-base sm:text-lg mt-1`}>{walletData.ethBalance.toFixed(4)} BASE ETH</p>
                        <p className={`${themeClasses.secondaryText} text-xs sm:text-sm`}>${walletData.ethUsdValue.toFixed(2)} USD</p>
                      </div>
                      <div className={`p-4 rounded-lg border ${themeClasses.border} ${themeClasses.shadow}`}>
                        <h4 className="text-sm font-semibold text-blue-400 uppercase">Tokens</h4>
                        <p className={`${themeClasses.text} text-base sm:text-lg mt-1`}>{walletData.tokens.length}</p>
                      </div>
                      <div className={`p-4 rounded-lg border ${themeClasses.border} ${themeClasses.shadow}`}>
                        <h4 className="text-sm font-semibold text-blue-400 uppercase">Transactions</h4>
                        <p className={`${themeClasses.text} text-base sm:text-lg mt-1`}>{walletData.txList.length}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "transactions" && (
                  <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 sm:p-6 rounded-lg`}>
                    <h3 className="text-base sm:text-lg font-semibold text-blue-400 mb-4 uppercase">Transactions</h3>
                    {walletData.txList.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs sm:text-sm">
                            <thead>
                              <tr className={`text-blue-400 border-b ${themeClasses.border}`}>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Hash</th>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">From</th>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">To</th>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Value</th>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Asset</th>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Gas Used</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedTxList?.map((tx: Transaction, index: number) => (
                                <tr key={index} className={`border-b ${themeClasses.border} ${themeClasses.hoverBg} transition-colors`}>
                                  <td className="py-3 px-3 sm:px-4 truncate">
                                    <div className="flex items-center space-x-2">
                                      <Link href={`/explorer/hash/${tx.hash}`} className="text-blue-400 hover:underline">
                                        {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                                      </Link>
                                      <a
                                        href={`https://basescan.org/tx/${tx.hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400"
                                      >
                                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                      </a>
                                      <button
                                        onClick={() => copyToClipboard(tx.hash)}
                                        className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full border ${themeClasses.border}`}
                                      >
                                        <ClipboardIcon className="w-4 h-4 text-blue-400" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 sm:px-4 truncate">
                                    <Link href={`/explorer/address/${tx.from}`} className="text-blue-400 hover:underline">
                                      {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                                    </Link>
                                  </td>
                                  <td className="py-3 px-3 sm:px-4 truncate">
                                    {tx.to === "N/A" ? (
                                      "N/A"
                                    ) : (
                                      <Link href={`/explorer/address/${tx.to}`} className="text-blue-400 hover:underline">
                                        {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                                      </Link>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 sm:px-4">{tx.value}</td>
                                  <td className="py-3 px-3 sm:px-4">{tx.asset}</td>
                                  <td className="py-3 px-3 sm:px-4">{tx.gasUsed}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
                          <button
                            onClick={() => setTxPage((prev) => Math.max(prev - 1, 1))}
                            disabled={txPage === 1}
                            className={`px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} ${txPage === 1 ? themeClasses.buttonDisabled : ""} rounded-lg text-sm uppercase w-full sm:w-auto ${themeClasses.shadow}`}
                          >
                            Previous
                          </button>
                          <span className={`${themeClasses.text} text-sm uppercase`}>
                            Page {txPage} of {totalTxPages}
                          </span>
                          <button
                            onClick={() => setTxPage((prev) => Math.min(prev + 1, totalTxPages))}
                            disabled={txPage === totalTxPages}
                            className={`px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} ${txPage === totalTxPages ? themeClasses.buttonDisabled : ""} rounded-lg text-sm uppercase w-full sm:w-auto ${themeClasses.shadow}`}
                          >
                            Next
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className={`${themeClasses.secondaryText} text-sm sm:text-base uppercase`}>No Transactions Found</p>
                    )}
                  </div>
                )}

                {activeTab === "tokens" && (
                  <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 sm:p-6 rounded-lg`}>
                    <h3 className="text-base sm:text-lg font-semibold text-blue-400 mb-4 uppercase">Token Holdings</h3>
                    {/* Filtering and Sorting Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                      <input
                        type="text"
                        placeholder="Search tokens by name or symbol..."
                        value={tokenSearch}
                        onChange={(e) => setTokenSearch(e.target.value)}
                        className={`flex-1 ${themeClasses.inputBg} ${themeClasses.text} border ${themeClasses.border} p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50`}
                      />
                      <select
                        value={tokenSort}
                        onChange={(e) => setTokenSort(e.target.value)}
                        className={`${themeClasses.selectBg} ${themeClasses.text} border ${themeClasses.border} p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                      >
                        <option value="usd-desc">USD Value (High to Low)</option>
                        <option value="usd-asc">USD Value (Low to High)</option>
                        <option value="activity-desc">Activity (High to Low)</option>
                        <option value="activity-asc">Activity (Low to High)</option>
                      </select>
                      <select
                        multiple
                        value={tokenTypes}
                        onChange={(e) => setTokenTypes(Array.from(e.target.selectedOptions, (option) => option.value))}
                        className={`${themeClasses.selectBg} ${themeClasses.text} border ${themeClasses.border} p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                      >
                        <option value="ERC-20">ERC-20</option>
                        <option value="ERC-721">ERC-721</option>
                      </select>
                    </div>
                    {/* Active Tokens */}
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2 uppercase">Active Tokens</h4>
                      {activeTokens && activeTokens.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs sm:text-sm">
                            <thead>
                              <tr className={`text-blue-400 border-b ${themeClasses.border}`}>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Name</th>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Symbol</th>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Balance</th>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">USD Value</th>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Contract</th>
                                <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Recent Activity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeTokens.map((token: Token, index: number) => (
                                <tr key={index} className={`border-b ${themeClasses.border} ${themeClasses.hoverBg} transition-colors`}>
                                  <td className="py-3 px-3 sm:px-4">{token.name}</td>
                                  <td className="py-3 px-3 sm:px-4">{token.symbol}</td>
                                  <td className="py-3 px-3 sm:px-4">{token.balance}</td>
                                  <td className="py-3 px-3 sm:px-4">
                                    {token.usdValue != null ? `$${token.usdValue.toFixed(2)}` : "Price Unavailable"}
                                  </td>
                                  <td className="py-3 px-3 sm:px-4 truncate">
                                    <Link href={`/explorer/address/${token.contractAddress}`} className="text-blue-400 hover:underline">
                                      {token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}
                                    </Link>
                                  </td>
                                  <td className="py-3 px-3 sm:px-4">{token.recentActivity} Transfers</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className={`${themeClasses.secondaryText} text-sm sm:text-base uppercase`}>No Active Tokens Found</p>
                      )}
                    </div>
                    {/* Inactive Tokens (Collapsible) */}
                    {inactiveTokens && inactiveTokens.length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowInactiveTokens(!showInactiveTokens)}
                          className={`flex items-center space-x-2 px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-lg text-sm uppercase ${themeClasses.shadow}`}
                        >
                          <span>{showInactiveTokens ? "Hide Inactive Tokens" : "Show Inactive Tokens"}</span>
                          <svg
                            className={`w-4 h-4 transform ${showInactiveTokens ? "rotate-180" : "rotate-0"} transition-transform`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {showInactiveTokens && (
                          <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm">
                              <thead>
                                <tr className={`text-blue-400 border-b ${themeClasses.border}`}>
                                  <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Name</th>
                                  <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Symbol</th>
                                  <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Balance</th>
                                  <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">USD Value</th>
                                  <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Contract</th>
                                  <th className="py-3 px-3 sm:px-4 text-left font-semibold uppercase">Recent Activity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inactiveTokens.map((token: Token, index: number) => (
                                  <tr key={index} className={`border-b ${themeClasses.border} ${themeClasses.hoverBg} transition-colors`}>
                                    <td className="py-3 px-3 sm:px-4">{token.name}</td>
                                    <td className="py-3 px-3 sm:px-4">{token.symbol}</td>
                                    <td className="py-3 px-3 sm:px-4">{token.balance}</td>
                                    <td className="py-3 px-3 sm:px-4">
                                      {token.usdValue != null ? `$${token.usdValue.toFixed(2)}` : "Price Unavailable"}
                                    </td>
                                    <td className="py-3 px-3 sm:px-4 truncate">
                                      <Link href={`/explorer/address/${token.contractAddress}`} className="text-blue-400 hover:underline">
                                        {token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}
                                      </Link>
                                    </td>
                                    <td className="py-3 px-3 sm:px-4">{token.recentActivity} Transfers</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "activity" && (
                  <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 sm:p-6 rounded-lg`}>
                    <h3 className="text-base sm:text-lg font-semibold text-blue-400 mb-4 uppercase">Activity Timeline</h3>
                    {walletData.txList.length > 0 ? (
                      <div className="overflow-x-auto">
                        <div className="flex flex-wrap gap-4 pb-4">
                          {walletData.txList.slice(0, 10).map((tx, index) => (
                            <div
                              key={index}
                              className={`flex-shrink-0 w-full sm:w-64 p-4 rounded-lg border ${themeClasses.border} ${themeClasses.shadow}`}
                            >
                              <p className={`${themeClasses.secondaryText} text-xs uppercase`}>
                                {tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : "N/A"}
                              </p>
                              <p className="text-sm mt-1">
                                <span className="font-medium">Hash:</span>{" "}
                                <Link href={`/explorer/hash/${tx.hash}`} className="text-blue-400 hover:underline">
                                  {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                                </Link>
                              </p>
                              <p className="text-sm mt-1">
                                <span className="font-medium">Value:</span> {tx.value} {tx.asset}
                              </p>
                              <p className="text-sm mt-1">
                                <span className="font-medium">Gas Used:</span> {tx.gasUsed}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className={`${themeClasses.secondaryText} text-sm sm:text-base uppercase`}>No Recent Activity</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Ad (Visible on Larger Screens) */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          {ads
            .filter((ad) => ad.type === "sidebar")
            .slice(0, 1)
            .map((ad, index) => (
              <a
                key={index}
                href={ad.destinationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`block rounded-lg overflow-hidden ${themeClasses.shadow}`}
                style={{ width: "300px", height: "600px" }}
              >
                <img src={ad.imageUrl} alt="Advertisement" className="w-full h-full object-contain" />
              </a>
            ))}
        </div>
      </div>
    </div>
  );
}