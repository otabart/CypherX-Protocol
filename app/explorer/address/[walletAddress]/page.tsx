"use client";

import { useState, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import WalletMetrics from "@/app/components/WalletMetrics";
import WalletExplorer from "@/app/components/WalletExplorer";

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};
initializeApp(firebaseConfig);
const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
interface Token {
  name: string;
  symbol: string;
  balance: string;
  contractAddress: string;
  usdValue: number;
  recentActivity: number;
  tokenType: "ERC-20";
  logo?: string;
  decimals: number;
  priceChange24h?: number;
  priceChange7d?: number;
  priceChange30d?: number;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  gasUsed?: string;
  gasFeeUsd?: number;
  timestamp?: number;
  type?: string;
}

interface WalletData {
  ethBalance: number;
  ethUsdValue: number;
  totalUsdValue: number;
  tokens: Token[];
  txList: Transaction[];
  lastScannedBlock?: { number: string; timestamp: number };
  nonce?: number;
  isContract?: boolean;
  chainId?: string;
  portfolioAllocation?: { eth: number; tokens: number };
  firstTxDate?: number;
  mostActivePeriod?: string;
}

interface Ad {
  createdAt: string;
  destinationUrl: string;
  imageUrl: string;
  type: "banner" | "sidebar";
}

// interface HistoricalBalance {
//   date: string;
//   ethBalance: number;
//   tokenBalances: { [contractAddress: string]: number };
//   totalUsdValue: number;
// }

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT: WalletPage
// ─────────────────────────────────────────────────────────────────────────────
export default function WalletPage({ params }: { params: Promise<{ walletAddress: string }> }) {
  // ─── STATE HOOKS ────────────────────────────────────────────────────────────
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tokens" | "transactions">("transactions");
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [ethPriceChanges, setEthPriceChanges] = useState<{
    "24h"?: number;
    "7d"?: number;
    "30d"?: number;
  }>({});
  const [toast, setToast] = useState<string | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, string | null>>({});

  // ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────────
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setToast("Copied!");
  }, []);

  const handleImageError = (imageKey: string) => {
    setFailedImages((prev) => ({
      ...prev,
      [imageKey]: null,
    }));
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(id);
  }, [toast]);

  // CSV Export
  type CSVRow = Record<string, string | number>;
  const exportToCSV = useCallback((data: CSVRow[], filename: string, headers: string[]) => {
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header.toLowerCase().replace(/\s/g, "_")] || "";
            return `"${value.toString().replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // ─── ADS MANAGEMENT ─────────────────────────────────────────────────────────
  useEffect(() => {
  const fallbackAds: Ad[] = [
    {
      createdAt: "May 12, 2025",
      destinationUrl: "https://x.com/CypherSystems_",
      imageUrl:
        "https://firebasestorage.googleapis.com/v0/b/homebase-dapp.firebasestorage.app/o/photo_2025-05-12_09-21-39.jpg?alt=media&token=b0b00101-e9f3-408f-bd19-89305dcef807",
      type: "banner",
    },
    {
      createdAt: "May 12, 2025",
      destinationUrl: "https://x.com/CypherSystems_",
      imageUrl:
        "https://firebasestorage.googleapis.com/v0/b/homebase-dapp.firebasestorage.app/o/photo_2025-05-12_09-21-44.jpg?alt=media&token=45799df2-1492-49aa-a842-a032d8d9df9c",
      type: "banner",
    },
  ];

    async function fetchAds() {
      try {
        const adsCol = collection(db, "ads");
        const snap = await getDocs(adsCol);
        const list = snap.docs.map((doc) => doc.data() as Ad);
        setAds(list.length ? list : fallbackAds);
      } catch {
        setAds(fallbackAds);
      }
    }
    fetchAds();
  }, []);

  useEffect(() => {
    const bannerAds = ads.filter((ad) => ad.type === "banner");
    if (bannerAds.length > 1) {
      const interval = setInterval(() => {
        // setCurrentAdIndex((prev) => (prev + 1) % bannerAds.length); // This line is removed
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [ads]);

  // ─── CACHING UTILITY ────────────────────────────────────────────────────────
  const cacheData = (key: string, data: unknown, ttl: number) => {
    const item = { data, expiry: Date.now() + ttl };
    localStorage.setItem(key, JSON.stringify(item));
  };

  const getCachedData = (key: string) => {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    const item = JSON.parse(itemStr);
    if (Date.now() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return item.data;
  };

  // ─── FETCH ETH PRICE AND CHANGES FROM COINGECKO ─────────────────────────────
  useEffect(() => {
    async function fetchPrice() {
      const cacheKey = "eth_price";
      const cached = getCachedData(cacheKey);
      if (cached) {
        setEthPrice(cached.price);
        setEthPriceChanges(cached.changes);
        return;
      }

      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_30d_change=true'
        );
        if (!res.ok) throw new Error("Failed to fetch ETH price");
        const data = await res.json();
        const price = data.ethereum.usd;
        const changes = {
          "24h": data.ethereum.usd_24h_change,
          "7d": data.ethereum.usd_7d_change,
          "30d": data.ethereum.usd_30d_change,
        };
        setEthPrice(price);
        setEthPriceChanges(changes);
        cacheData(cacheKey, { price, changes }, 5 * 60 * 1000); // 5 min TTL
      } catch {
        setEthPrice(3000);
        setEthPriceChanges({});
      }
    }
    fetchPrice();
  }, []);

  // ─── FETCH HISTORICAL BALANCE DATA (MOCK FOR DEMO) ─────────────────────────
  useEffect(() => {
    // Replace with real API call to fetch historical balances
    // const mockHistoricalBalances: HistoricalBalance[] = Array.from({ length: 30 }, (_, i) => {
    //   const date = new Date();
    //   date.setDate(date.getDate() - i);
    //   return {
    //     date: date.toISOString().split("T")[0],
    //     ethBalance: walletData?.ethBalance || 0 * (1 + Math.random() * 0.1 - 0.05),
    //     tokenBalances: walletData?.tokens.reduce(
    //       (acc, t) => ({
    //         ...acc,
    //         [t.contractAddress]: parseFloat(t.balance) * (1 + Math.random() * 0.1 - 0.05),
    //       }),
    //       {}
    //     ) || {},
    //     totalUsdValue:
    //       (walletData?.totalUsdValue || 0) * (1 + Math.random() * 0.2 - 0.1),
    //   };
    // }).reverse();
    // setHistoricalBalances(mockHistoricalBalances); // This state variable is no longer used
  }, [walletData]);

  // ─── BALANCES HISTORY CHART ────────────────────────────────────────────────
  useEffect(() => {
    // This effect is no longer relevant for the new activeTab
    // if (activeTab !== "overview" || !walletData || !historicalBalances.length) return;

    // const ctx = document.getElementById("balancesChart") as HTMLCanvasElement;
    // if (!ctx) return;

    // const filteredData = historicalBalances.filter((b) => {
    //   const date = new Date(b.date);
    //   const now = new Date();
    //   if (chartTimeRange === "7d") return date >= new Date(now.setDate(now.getDate() - 7));
    //   if (chartTimeRange === "30d") return date >= new Date(now.setDate(now.getDate() - 30));
    //   return date >= new Date(now.setDate(now.getDate() - 90));
    // });

    // const chart = new Chart(ctx, {
    //   type: "line",
    //   data: {
    //     labels: filteredData.map((b) => b.date),
    //     datasets: [
    //       {
    //         label: "Net Worth (USD)",
    //         data: filteredData.map((b) => b.totalUsdValue),
    //         borderColor: "#3B82F6",
    //         backgroundColor: "rgba(59, 130, 246, 0.2)",
    //         fill: true,
    //         tension: 0.1,
    //       },
    //     ],
    //   },
    //   options: {
    //     responsive: true,
    //     maintainAspectRatio: false,
    //     scales: {
    //       x: {
    //         display: true,
    //         title: { display: true, text: "Date", color: "#9CA3AF" },
    //         grid: { color: "#374151" },
    //         ticks: { color: "#9CA3AF" },
    //       },
    //       y: {
    //         display: true,
    //         title: { display: true, text: "USD Value", color: "#9CA3AF" },
    //         beginAtZero: false,
    //         grid: { color: "#374151" },
    //         ticks: { color: "#9CA3AF" },
    //       },
    //     },
    //     plugins: {
    //       legend: { display: false },
    //       tooltip: {
    //         backgroundColor: "#1F2937",
    //         titleColor: "#F3F4F6",
    //         bodyColor: "#F3F4F6",
    //         callbacks: {
    //           label: (context) => `$${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    //         },
    //       },
    //     },
    //   },
    // });

    // return () => chart.destroy();
  }, [activeTab, walletData]); // Removed historicalBalances and chartTimeRange from dependencies

  // ─── PORTFOLIO PIE CHART ───────────────────────────────────────────────────
  useEffect(() => {
    // This effect is no longer relevant for the new activeTab
    // if (activeTab !== "overview" || !walletData) return;

    // const ctx = document.getElementById("portfolioChart") as HTMLCanvasElement;
    // if (!ctx) return;

    // const chart = new Chart(ctx, {
    //   type: "pie",
    //   data: {
    //     labels: ["ETH", "Tokens"],
    //     datasets: [
    //       {
    //         data: [
    //           walletData.portfolioAllocation?.eth || 0,
    //           walletData.portfolioAllocation?.tokens || 0,
    //         ],
    //         backgroundColor: ["#3B82F6", "#10B981"],
    //         borderWidth: 0,
    //         hoverOffset: 4,
    //       },
    //     ],
    //   },
    //   options: {
    //     responsive: true,
    //     maintainAspectRatio: false,
    //     cutout: "60%",
    //     plugins: {
    //       legend: {
    //         position: "right",
    //         labels: { color: "#9CA3AF" },
    //       },
    //       tooltip: {
    //         backgroundColor: "#1F2937",
    //         titleColor: "#F3F4F6",
    //         bodyColor: "#F3F4F6",
    //         callbacks: {
    //           label: (context) => `${context.label}: ${context.parsed.toFixed(2)}%`,
    //         },
    //       },
    //     },
    //   },
    // });

    // return () => chart.destroy();
  }, [activeTab, walletData]); // Removed historicalBalances and chartTimeRange from dependencies

  // ─── MAIN DATA FETCH ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const resolved = await params;
        const address = resolved.walletAddress.toLowerCase();
        setWalletAddress(address);

        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          notFound();
          return;
        }

        const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;
        console.log("Alchemy URL:", alchemyUrl); // Debug log
        
        if (!alchemyUrl) {
          console.error("Missing ALCHEMY_API_URL environment variable");
          setError("Alchemy API URL is not configured. Please check your environment variables.");
          setLoading(false);
          return;
        }

        // TODO: Implement real Alchemy API calls
        // For now, set empty data structure
        const emptyWalletData: WalletData = {
          ethBalance: 0.0,
          ethUsdValue: 0.0,
          totalUsdValue: 0.0,
          tokens: [],
          txList: [],
          lastScannedBlock: { number: "0", timestamp: 0 },
          nonce: 0,
          isContract: false,
          chainId: "8453",
          portfolioAllocation: { eth: 0, tokens: 0 },
          firstTxDate: undefined,
          mostActivePeriod: "—",
        };

        setWalletData(emptyWalletData);
        setLoading(false);

        // TODO: Uncomment and implement when Alchemy API is configured
        /*
        // Batch basic info
        const batchBasic = [
          { jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
          { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 },
          { jsonrpc: "2.0", method: "eth_getTransactionCount", params: [address, "latest"], id: 3 },
          { jsonrpc: "2.0", method: "eth_getCode", params: [address, "latest"], id: 4 },
          { jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 5 },
        ];

        const basicResp = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batchBasic),
        }).then(res => res.json());

        // ... rest of the Alchemy API calls
        */

      } catch (err: unknown) {
        console.error("Error in fetchData:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(`Failed to load: ${errorMessage}. Please try again later.`);
        setLoading(false);
      }
    }
    fetchData();
  }, [params, ethPrice]);

  // ─── EXPORT FUNCTIONS ──────────────────────────────────────────────────────
  const exportTokensCSV = useCallback(() => {
    if (!walletData) return;
    
    const filteredTokens = walletData.tokens.filter((t) => t.tokenType === "ERC-20");
    exportToCSV(
      filteredTokens.map((token) => {
        const rawBal = parseFloat(token.balance);
        const tokenPriceUsd = rawBal > 0 ? token.usdValue / rawBal : 0;
        return {
          name: token.name,
          symbol: token.symbol,
          balance: rawBal.toLocaleString(undefined, {
            minimumFractionDigits: Math.min(token.decimals, 4),
            maximumFractionDigits: Math.min(token.decimals, 4),
          }),
          usd_value: token.usdValue.toFixed(2),
          activity_24h: token.recentActivity.toString(),
          token_price_usd: tokenPriceUsd > 0 ? tokenPriceUsd.toFixed(4) : "—",
          contract: token.contractAddress,
        };
      }),
      `tokens_${walletAddress}.csv`,
      ["Name", "Symbol", "Balance", "USD Value", "Activity (24h)", "Token Price (USD)", "Contract"]
    );
  }, [walletData, walletAddress, exportToCSV]);

  const exportTransactionsCSV = useCallback(() => {
    if (!walletData) return;
    
    exportToCSV(
      walletData.txList.map((tx) => ({
        time: tx.timestamp
          ? new Date(tx.timestamp * 1000).toLocaleString()
          : "—",
        from: tx.from,
        to: tx.to || "—",
        value: tx.value,
        asset: tx.asset,
        type: tx.type || "Unknown",
      })),
      `transactions_${walletAddress}.csv`,
      ["Time", "From", "To", "Value", "Asset", "Type"]
    );
  }, [walletData, walletAddress, exportToCSV]);

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex flex-col bg-gray-950 text-gray-200">
      <Header />
      
      {/* ─── TOAST ──────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            className="fixed top-4 right-4 px-3 py-2 rounded-md bg-blue-500/80 text-white text-xs z-50"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MAIN CONTENT ───────────────────────────────────────────────────────── */}
      <div className="flex-1 w-full">
        {/* ─── WALLET METRICS ────────────────────────────────────────────────────── */}
        <WalletMetrics
          walletData={walletData}
          loading={loading}
          ethPrice={ethPrice}
          ethPriceChanges={ethPriceChanges}
          onCopyAddress={() => copyToClipboard(walletAddress)}
          failedImages={failedImages}
          onImageError={handleImageError}
          walletAddress={walletAddress}
        />

        {/* ─── WALLET EXPLORER ───────────────────────────────────────────────────── */}
        <WalletExplorer
          walletData={walletData}
          loading={loading}
          error={error}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onExportTokensCSV={exportTokensCSV}
          onExportTransactionsCSV={exportTransactionsCSV}
          failedImages={failedImages}
          onImageError={handleImageError}
        />
      </div>
      
      <Footer />
    </div>
  );
}