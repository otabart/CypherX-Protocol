"use client";

import { useState, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ClipboardIcon } from "@heroicons/react/24/outline";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc } from "firebase/firestore";
import Chart from "chart.js/auto";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";

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
// LOADER (SKELETON) COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonLoader({ type }: { type: "table" | "chart" | "metric" }) {
  if (type === "table") {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-[#1F2937] animate-pulse rounded" />
        ))}
      </div>
    );
  }
  if (type === "chart") {
    return <div className="h-full bg-[#1F2937] animate-pulse rounded-md" />;
  }
  return (
    <div className="flex flex-col p-4 rounded-lg bg-[#141A2F] animate-pulse">
      <div className="h-4 w-1/2 bg-[#1F2937] rounded mb-2" />
      <div className="h-6 w-3/4 bg-[#1F2937] rounded" />
    </div>
  );
}

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

interface HistoricalBalance {
  date: string;
  ethBalance: number;
  tokenBalances: { [contractAddress: string]: number };
  totalUsdValue: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT: WalletPage
// ─────────────────────────────────────────────────────────────────────────────
export default function WalletPage({ params }: { params: Promise<{ walletAddress: string }> }) {
  // ─── STATE HOOKS ────────────────────────────────────────────────────────────
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "tokens" | "transactions">("overview");
  const [tokenSearch, setTokenSearch] = useState<string>("");
  const [tokenSort, setTokenSort] = useState<
    "value-desc" | "value-asc" | "balance-desc" | "balance-asc" | "price-desc" | "price-asc"
  >("value-desc");
  const [txPage, setTxPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [ethPriceChanges, setEthPriceChanges] = useState<{
    "24h"?: number;
    "7d"?: number;
    "30d"?: number;
  }>({});
  const [depositCount, setDepositCount] = useState<number>(0);
  const [withdrawalCount, setWithdrawalCount] = useState<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState<"local" | "utc">("local");
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState<number>(0);
  const [historicalBalances, setHistoricalBalances] = useState<HistoricalBalance[]>([]);
  const [chartTimeRange, setChartTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [txFilterAsset, setTxFilterAsset] = useState<string>("all");
  const [txFilterType, setTxFilterType] = useState<string>("all");
  const [txFilterDate, setTxFilterDate] = useState<string>("all");
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

  useEffect(() => {
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
  }, [fallbackAds]);

  useEffect(() => {
    const bannerAds = ads.filter((ad) => ad.type === "banner");
    if (bannerAds.length > 1) {
      const interval = setInterval(() => {
        setCurrentAdIndex((prev) => (prev + 1) % bannerAds.length);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [ads]);

  const trackAdClick = async (ad: Ad) => {
    try {
      await addDoc(collection(db, "ad_clicks"), {
        adId: ad.destinationUrl,
        timestamp: new Date().toISOString(),
        walletAddress,
      });
    } catch {
      console.error("Failed to track ad click");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAILWIND THEME CLASSES
  // ─────────────────────────────────────────────────────────────────────────────
  const theme = {
    background: "bg-gray-950",
    text: "text-gray-200",
    border: "border-blue-500/30",
    containerBg: "bg-[#141A2F]",
    hoverBg: "hover:bg-[#1E263B] hover:border-blue-400/50",
    secondaryText: "text-gray-400",
    errorText: "text-red-400",
    buttonBg: "bg-blue-500/20",
    buttonHover: "hover:bg-blue-500/40",
    buttonDisabled: "bg-gray-800",
    shadow: "shadow-[0_2px_8px_rgba(59,130,246,0.2)]",
    tabActive: "border-b-2 border-blue-400 text-blue-400",
    tabInactive: "border-b-2 border-transparent text-gray-400",
    inputBg: "bg-[#1E263B]",
    selectBg: "bg-[#1E263B]",
    positive: "text-green-400",
    negative: "text-red-400",
    tooltip: "bg-[#1F2937] text-gray-200 text-xs rounded p-2",
  };

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
    const mockHistoricalBalances: HistoricalBalance[] = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toISOString().split("T")[0],
        ethBalance: walletData?.ethBalance || 0 * (1 + Math.random() * 0.1 - 0.05),
        tokenBalances: walletData?.tokens.reduce(
          (acc, t) => ({
            ...acc,
            [t.contractAddress]: parseFloat(t.balance) * (1 + Math.random() * 0.1 - 0.05),
          }),
          {}
        ) || {},
        totalUsdValue:
          (walletData?.totalUsdValue || 0) * (1 + Math.random() * 0.2 - 0.1),
      };
    }).reverse();
    setHistoricalBalances(mockHistoricalBalances);
  }, [walletData]);

  // ─── BALANCES HISTORY CHART ────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "overview" || !walletData || !historicalBalances.length) return;

    const ctx = document.getElementById("balancesChart") as HTMLCanvasElement;
    if (!ctx) return;

    const filteredData = historicalBalances.filter((b) => {
      const date = new Date(b.date);
      const now = new Date();
      if (chartTimeRange === "7d") return date >= new Date(now.setDate(now.getDate() - 7));
      if (chartTimeRange === "30d") return date >= new Date(now.setDate(now.getDate() - 30));
      return date >= new Date(now.setDate(now.getDate() - 90));
    });

    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: filteredData.map((b) => b.date),
        datasets: [
          {
            label: "Net Worth (USD)",
            data: filteredData.map((b) => b.totalUsdValue),
            borderColor: "#3B82F6",
            backgroundColor: "rgba(59, 130, 246, 0.2)",
            fill: true,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            display: true,
            title: { display: true, text: "Date", color: "#9CA3AF" },
            grid: { color: "#374151" },
            ticks: { color: "#9CA3AF" },
          },
          y: {
            display: true,
            title: { display: true, text: "USD Value", color: "#9CA3AF" },
            beginAtZero: false,
            grid: { color: "#374151" },
            ticks: { color: "#9CA3AF" },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1F2937",
            titleColor: "#F3F4F6",
            bodyColor: "#F3F4F6",
            callbacks: {
              label: (context) => `$${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [activeTab, walletData, historicalBalances, chartTimeRange]);

  // ─── PORTFOLIO PIE CHART ───────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "overview" || !walletData) return;

    const ctx = document.getElementById("portfolioChart") as HTMLCanvasElement;
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["ETH", "Tokens"],
        datasets: [
          {
            data: [
              walletData.portfolioAllocation?.eth || 0,
              walletData.portfolioAllocation?.tokens || 0,
            ],
            backgroundColor: ["#3B82F6", "#10B981"],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "60%",
        plugins: {
          legend: {
            position: "right",
            labels: { color: "#9CA3AF" },
          },
          tooltip: {
            backgroundColor: "#1F2937",
            titleColor: "#F3F4F6",
            bodyColor: "#F3F4F6",
            callbacks: {
              label: (context) => `${context.label}: ${context.parsed.toFixed(2)}%`,
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [activeTab, walletData]);

  // ─── MAIN DATA FETCH ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      const retry = async <T,>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
        for (let i = 0; i < retries; i++) {
          try {
            return await fn();
          } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise((res) => setTimeout(res, delay));
          }
        }
        throw new Error("Max retries reached");
      };

      try {
        const resolved = await params;
        const address = resolved.walletAddress.toLowerCase();
        setWalletAddress(address);

        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          notFound();
          return;
        }

        const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL!;
        if (!alchemyUrl) throw new Error("Missing ALCHEMY_API_URL");

        // Batch basic info
        const batchBasic = [
          { jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
          { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 },
          { jsonrpc: "2.0", method: "eth_getTransactionCount", params: [address, "latest"], id: 3 },
          { jsonrpc: "2.0", method: "eth_getCode", params: [address, "latest"], id: 4 },
          { jsonrpc: "2.0", method: "eth_getBalance", params: [address, "latest"], id: 5 },
        ];

        const basicResp = await retry(() => fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batchBasic),
        }).then(res => res.json()));

        const [chainIdRes, blockNumRes, txCountRes, codeRes, balanceRes] = basicResp;

        const chainId = parseInt(chainIdRes.result, 16).toString();
        const latestBlockHex = blockNumRes.result;
        const nonce = parseInt(txCountRes.result, 16);
        const isContract = codeRes.result !== "0x";
        const ethBalance = parseInt(balanceRes.result, 16) / 1e18;

        // Block timestamp
        const blockRes = await retry(() => fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBlockByNumber",
            params: [latestBlockHex, false],
            id: 6,
          }),
        }).then(res => res.json()));
        const blockTimestamp = parseInt(blockRes.result.timestamp, 16) || 0;

        // Token balances
        const tokenBalRes = await retry(() => fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "alchemy_getTokenBalances",
            params: [address],
            id: 7,
          }),
        }).then(res => res.json()));

        const tokenBalances = tokenBalRes.result.tokenBalances.filter((t: any) => t.tokenBalance !== "0x0");

        const tokenContracts = tokenBalances.map((t: any) => t.contractAddress.toLowerCase());

        // Token metadata batch (serial for simplicity)
        const tokenMeta: any = {};
        for (const contract of tokenContracts) {
          const metaRes = await retry(() => fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "alchemy_getTokenMetadata",
              params: [contract],
              id: 8,
            }),
          }).then(res => res.json()));
          tokenMeta[contract] = metaRes.result;
        }

        // Token prices from CoinGecko
        let tokenPrices: any = {};
        if (tokenContracts.length) {
          const batchSize = 50;
          for (let i = 0; i < tokenContracts.length; i += batchSize) {
            const batch = tokenContracts.slice(i, i + batchSize);
            const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${batch.join(',')}&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_30d_change=true`);
            if (priceRes.ok) {
              const batchPrices = await priceRes.json();
              tokenPrices = { ...tokenPrices, ...batchPrices };
            }
          }
        }

        const enhancedTokens: Token[] = [];
        for (const tb of tokenBalances) {
          const contract = tb.contractAddress.toLowerCase();
          const meta = tokenMeta[contract] || {};
          const decimals = meta.decimals || 18;
          const balanceRaw = parseInt(tb.tokenBalance, 16);
          const balance = balanceRaw / 10 ** decimals;
          if (balance <= 0) continue;
          const priceInfo = tokenPrices[contract] || { usd: 0, usd_24h_change: 0, usd_7d_change: 0, usd_30d_change: 0 };
          const usdValue = balance * priceInfo.usd;

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
                    fromBlock: "0x" + (parseInt(latestBlockHex, 16) - 86400 * 2).toString(16),
                    toBlock: "latest",
                    address: contract,
                    topics: [["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]],
                  },
                ],
                id: 9,
              }),
            }).then(res => res.json());
            recentActivity = logsRes.result?.length || 0;
          } catch {}

          enhancedTokens.push({
            name: meta.name || "Unknown",
            symbol: meta.symbol || "UNK",
            balance: balance.toString(),
            contractAddress: contract,
            usdValue,
            recentActivity,
            tokenType: "ERC-20",
            logo: meta.logo || "",
            decimals,
            priceChange24h: priceInfo.usd_24h_change,
            priceChange7d: priceInfo.usd_7d_change,
            priceChange30d: priceInfo.usd_30d_change,
          });
        }

        // Transactions
        const categories = ["external", "internal", "erc20", "erc721", "erc1155"];
        const fromParams = { fromBlock: "0x0", toBlock: "latest", fromAddress: address, category: categories, withMetadata: true, excludeZeroValue: true, maxCount: "0x3e8" };
        const toParams = { fromBlock: "0x0", toBlock: "latest", toAddress: address, category: categories, withMetadata: true, excludeZeroValue: true, maxCount: "0x3e8" };

        const [fromRes, toRes] = await Promise.all([
          fetch(alchemyUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "alchemy_getAssetTransfers", params: [fromParams], id: 10 }) }).then(res => res.json()),
          fetch(alchemyUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "alchemy_getAssetTransfers", params: [toParams], id: 11 }) }).then(res => res.json())
        ]);

        const transfers = [...(fromRes.result?.transfers || []), ...(toRes.result?.transfers || [])];

        const enhancedTxs: Transaction[] = transfers.map(transfer => {
          const timestamp = transfer.metadata?.blockTimestamp ? new Date(transfer.metadata.blockTimestamp).getTime() / 1000 : 0;
          let valueStr = transfer.value ? transfer.value.toString() : "0";
          let asset = transfer.asset || "ETH";
          let txType = "Transfer";

          if (transfer.rawContract) {
            const decimals = transfer.rawContract.decimal ? parseInt(transfer.rawContract.decimal, 16) : 18;
            valueStr = (parseInt(transfer.rawContract.value || "0x0", 16) / 10 ** decimals).toString();
            asset = transfer.asset || transfer.rawContract.address;
            txType = "Token Transfer";
          } else if (transfer.category === "internal") {
            txType = "Internal Transfer";
          }

          return {
            hash: transfer.hash,
            from: transfer.from,
            to: transfer.to || "",
            value: valueStr,
            asset,
            timestamp,
            type: txType,
            gasUsed: "—",
            gasFeeUsd: 0,
          };
        });

        // Aggregates
        const ethUsd = ethBalance * ethPrice;
        const tokenUsdSum = enhancedTokens.reduce((sum, t) => sum + t.usdValue, 0);
        const totalUsd = ethUsd + tokenUsdSum;
        const portfolioAllocation = totalUsd ? {
          eth: (ethUsd / totalUsd) * 100,
          tokens: (tokenUsdSum / totalUsd) * 100,
        } : { eth: 0, tokens: 0 };

        const firstTxDate = enhancedTxs.length ? Math.min(...enhancedTxs.map(t => t.timestamp || Infinity)) : undefined;

        const txByMonth = enhancedTxs.reduce((acc, tx) => {
          if (tx.timestamp) {
            const month = new Date(tx.timestamp * 1000).toISOString().slice(0, 7);
            acc[month] = (acc[month] || 0) + 1;
          }
          return acc;
        }, {} as { [key: string]: number });
        const mostActivePeriod = Object.entries(txByMonth).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

        let deposits = 0;
        let withdrawals = 0;
        enhancedTxs.forEach(tx => {
          if (tx.to.toLowerCase() === address) deposits++;
          if (tx.from.toLowerCase() === address) withdrawals++;
        });
        setDepositCount(deposits);
        setWithdrawalCount(withdrawals);

        setWalletData({
          ethBalance,
          ethUsdValue: ethUsd,
          totalUsdValue: totalUsd,
          tokens: enhancedTokens,
          txList: enhancedTxs,
          lastScannedBlock: { number: parseInt(latestBlockHex, 16).toString(), timestamp: blockTimestamp },
          nonce,
          isContract,
          chainId,
          portfolioAllocation,
          firstTxDate,
          mostActivePeriod,
        });

        if (ethBalance === 0 && enhancedTokens.length === 0 && enhancedTxs.length === 0) {
          setError("No data found for this address on Base Mainnet. Please verify the address or try again later.");
        }
      } catch (err: any) {
        setError(`Failed to load: ${err.message || "Unknown error"}. Please try again later.`);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params, ethPrice]);

  // ─── FILTER & SORT TOKENS ───────────────────────────────────────────────────
  const filteredTokens = (walletData?.tokens || [])
    .filter((t) => t.tokenType === "ERC-20")
    .filter(
      (t) =>
        (t.name.toLowerCase().includes(tokenSearch.toLowerCase()) ||
          t.symbol.toLowerCase().includes(tokenSearch.toLowerCase()))
    )
    .sort((a, b) => {
      switch (tokenSort) {
        case "value-desc":
          return b.usdValue - a.usdValue;
        case "value-asc":
          return a.usdValue - b.usdValue;
        case "balance-desc":
          return parseFloat(b.balance) - parseFloat(a.balance);
        case "balance-asc":
          return parseFloat(a.balance) - parseFloat(b.balance);
        case "price-desc":
          return (b.usdValue / parseFloat(b.balance)) - (a.usdValue / parseFloat(a.balance));
        case "price-asc":
          return (a.usdValue / parseFloat(a.balance)) - (b.usdValue / parseFloat(b.balance));
        default:
          return 0;
      }
    });

  // ─── FILTER & PAGINATE TRANSACTIONS ─────────────────────────────────────────
  const filteredTxList = (walletData?.txList || [])
    .filter((tx) => (txFilterAsset === "all" ? true : tx.asset === txFilterAsset))
    .filter((tx) => (txFilterType === "all" ? true : tx.type === txFilterType))
    .filter((tx) => {
      if (txFilterDate === "all") return true;
      if (!tx.timestamp) return false;
      const txDate = new Date(tx.timestamp * 1000);
      const now = new Date();
      if (txFilterDate === "24h") return txDate >= new Date(now.setHours(now.getHours() - 24));
      if (txFilterDate === "7d") return txDate >= new Date(now.setDate(now.getDate() - 7));
      if (txFilterDate === "30d") return txDate >= new Date(now.setDate(now.getDate() - 30));
      return true;
    });

  const paginatedTxList = filteredTxList.slice(
    (txPage - 1) * itemsPerPage,
    txPage * itemsPerPage
  );
  const totalTxPages = Math.ceil(filteredTxList.length / itemsPerPage);

  // ─── UNIQUE COUNTERPARTIES ──────────────────────────────────────────────────
  let uniqueCounterparties = 0;
  if (walletData) {
    const addrSet = new Set<string>();
    walletData.txList.forEach((tx) => {
      addrSet.add(tx.from);
      if (tx.to && tx.to !== "") addrSet.add(tx.to);
    });
    uniqueCounterparties = addrSet.size;
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen w-full flex flex-col ${theme.background} ${theme.text}`}>
      <Header />
      {/* ─── TOAST ──────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 right-4 px-3 py-2 rounded-md bg-blue-500/80 text-white text-xs z-50">
          {toast}
        </div>
      )}

      {/* ─── HEADER ─────────────────────────────────────────────────────────────── */}
      <header className={`w-full border-b ${theme.border} bg-[#0F172A]`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <p className="break-all text-gray-400 text-sm md:text-base">{walletAddress || "—"}</p>
              <button
                onClick={() => copyToClipboard(walletAddress)}
                disabled={!walletAddress}
                className={`flex items-center gap-1 ${
                  walletAddress ? theme.buttonBg : theme.buttonDisabled
                } border ${theme.border} px-2 py-1 rounded-md text-xs md:text-sm uppercase ${
                  walletAddress ? theme.buttonHover : "opacity-50 cursor-not-allowed"
                }`}
                title="Copy wallet address to clipboard"
              >
                <ClipboardIcon className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-medium">Copy</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <Image
              src={failedImages["eth-header"] || "https://assets.coingecko.com/coins/images/279/small/ethereum.png"}
              alt="ETH Logo"
              width={32}
              height={32}
              className="w-8 h-8"
              onError={() => handleImageError("eth-header")}
              priority={true}
              aria-label="ETH Logo"
            />
            {ethPrice > 0 ? (
              <div className="flex flex-col">
                <span className="text-lg md:text-xl font-semibold">${ethPrice.toLocaleString()}</span>
                <span
                  className={`text-xs ${ethPriceChanges["24h"]! > 0 ? theme.positive : theme.negative}`}
                >
                  {ethPriceChanges["24h"]?.toFixed(2)}% (24h)
                </span>
              </div>
            ) : (
              <SkeletonLoader type="metric" />
            )}
          </div>
        </div>
      </header>

      {/* ─── SIDEBAR ADS ────────────────────────────────────────────────────────── */}
      <div className="hidden lg:block fixed right-4 top-1/4 w-40">
        {ads
          .filter((ad) => ad.type === "sidebar")
          .slice(0, 1)
          .map((ad, idx) => (
            <a
              key={idx}
              href={ad.destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackAdClick(ad)}
              className={`block overflow-hidden rounded-md ${theme.shadow}`}
              style={{ width: "160px", height: "600px" }}
            >
              <Image
                src={failedImages[`ad-sidebar-${idx}`] || ad.imageUrl}
                alt="Advertisement"
                width={160}
                height={600}
                className="w-full h-full object-cover"
                onError={() => handleImageError(`ad-sidebar-${idx}`)}
                priority={false}
                aria-label="Advertisement"
              />
            </a>
          ))}
      </div>

      {/* ─── METRIC ROW ─────────────────────────────────────────────────────────── */}
      <section className="w-full bg-[#0F172A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div
            className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}
            title="Total ETH held in the wallet"
          >
            <span className="text-xs font-semibold text-blue-400 uppercase">ETH Balance</span>
            {loading ? (
              <SkeletonLoader type="metric" />
            ) : (
              <>
                <span className="mt-1 text-lg font-bold">
                  {walletData
                    ? walletData.ethBalance.toLocaleString(undefined, {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                      })
                    : "—"}{" "}
                  ETH
                </span>
                <span className="mt-1 text-gray-400 text-xs">
                  $
                  {walletData
                    ? walletData.ethUsdValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}{" "}
                  USD
                </span>
              </>
            )}
          </div>
          <div
            className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}
            title="Total value of ETH and tokens in USD"
          >
            <span className="text-xs font-semibold text-blue-400 uppercase">Net Worth</span>
            {loading ? (
              <SkeletonLoader type="metric" />
            ) : (
              <span className="mt-1 text-lg font-bold">
                {walletData
                  ? `$${walletData.totalUsdValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : "—"}
              </span>
            )}
          </div>
          <div
            className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}
            title="Number of unique tokens held"
          >
            <span className="text-xs font-semibold text-blue-400 uppercase">Tokens</span>
            {loading ? (
              <SkeletonLoader type="metric" />
            ) : (
              <span className="mt-1 text-lg font-bold">
                {walletData ? walletData.tokens.length.toLocaleString() : "—"}
              </span>
            )}
          </div>
          <div
            className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}
            title="Total number of transactions"
          >
            <span className="text-xs font-semibold text-blue-400 uppercase">Transactions</span>
            {loading ? (
              <SkeletonLoader type="metric" />
            ) : (
              <span className="mt-1 text-lg font-bold">
                {walletData ? walletData.txList.length.toLocaleString() : "—"}
              </span>
            )}
          </div>
          <div
            className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}
            title="Number of unique addresses interacted with"
          >
            <span className="text-xs font-semibold text-blue-400 uppercase">Counterparties</span>
            {loading ? (
              <SkeletonLoader type="metric" />
            ) : (
              <span className="mt-1 text-lg font-bold">
                {walletData ? uniqueCounterparties.toLocaleString() : "—"}
              </span>
            )}
          </div>
          <div
            className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}
            title="First transaction date"
          >
            <span className="text-xs font-semibold text-blue-400 uppercase">First Activity</span>
            {loading ? (
              <SkeletonLoader type="metric" />
            ) : (
              <span className="mt-1 text-lg font-bold">
                {walletData?.firstTxDate
                  ? new Date(walletData.firstTxDate * 1000).toLocaleDateString()
                  : "—"}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ─── DEPOSITS / WITHDRAWALS ─────────────────────────────────────────────── */}
      {walletData && (
        <section className="w-full bg-[#0F172A] border-t border-b border-blue-500/30">
          <div className="max-w-full px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}
              title="Number of incoming transactions"
            >
              <span className="text-xs lg:text-sm font-semibold text-blue-400 uppercase">Deposits</span>
              <span className="mt-1 text-lg lg:text-xl font-bold">
                {depositCount.toLocaleString()}
              </span>
            </div>
            <div
              className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}
              title="Number of outgoing transactions"
            >
              <span className="text-xs lg:text-sm font-semibold text-blue-400 uppercase">Withdrawals</span>
              <span className="mt-1 text-lg lg:text-xl font-bold">
                {withdrawalCount.toLocaleString()}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ─── NAVIGATION MENU ────────────────────────────────────────────────────── */}
      <nav className={`w-full bg-[#0F172A] border-t border-b ${theme.border}`}>
        <div className="max-w-full px-4 sm:px-6">
          <ul className="grid grid-cols-3 text-center text-xs lg:text-sm uppercase">
            <li>
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-3 w-full ${
                  activeTab === "overview" ? theme.tabActive : theme.tabInactive
                } hover:${theme.tabActive} transition-colors`}
              >
                Overview
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab("tokens")}
                className={`py-3 w-full ${
                  activeTab === "tokens" ? theme.tabActive : theme.tabInactive
                } hover:${theme.tabActive} transition-colors`}
              >
                Tokens
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab("transactions")}
                className={`py-3 w-full ${
                  activeTab === "transactions" ? theme.tabActive : theme.tabInactive
                } hover:${theme.tabActive} transition-colors`}
              >
                Transactions
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* ─── MAIN CONTENT ───────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full overflow-auto px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <SkeletonLoader type="chart" />
            <span className="mt-2 text-gray-400 uppercase text-xs lg:text-sm">
              Loading data…
            </span>
          </div>
        ) : error ? (
          <p className="text-center text-red-400 uppercase text-xs lg:text-sm">{error}</p>
        ) : !walletData ? (
          <p className="text-center text-gray-400 uppercase text-xs lg:text-sm">
            No data available
          </p>
        ) : (
          <>
            {/* ─── OVERVIEW PANEL ─────────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <section className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-lg border ${theme.border} ${theme.containerBg} p-4 h-96">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-200 uppercase">Net Worth History</h3>
                      <select
                        value={chartTimeRange}
                        onChange={(e) => setChartTimeRange(e.target.value as "7d" | "30d" | "90d")}
                        className={`text-xs ${theme.selectBg} ${theme.text} border ${theme.border} p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                      >
                        <option value="7d">7 Days</option>
                        <option value="30d">30 Days</option>
                        <option value="90d">90 Days</option>
                      </select>
                    </div>
                    {loading || !historicalBalances.length ? (
                      <SkeletonLoader type="chart" />
                    ) : (
                      <canvas id="balancesChart" className="h-full" />
                    )}
                  </div>
                  <div className="rounded-lg border ${theme.border} ${theme.containerBg} p-4 h-96">
                    <h3 className="text-lg font-semibold text-gray-200 uppercase mb-4">Portfolio Allocation</h3>
                    {loading ? (
                      <SkeletonLoader type="chart" />
                    ) : (
                      <canvas id="portfolioChart" className="h-full" />
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ─── TOKENS PANEL ───────────────────────────────────────────────────── */}
            {activeTab === "tokens" && (
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-blue-400 uppercase">
                    Token Holdings
                  </h2>
                  <button
                    onClick={() =>
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
                      )
                    }
                    className={`px-3 py-1 ${theme.buttonBg} ${theme.buttonHover} rounded-md text-xs uppercase`}
                    title="Export token holdings to CSV"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Search tokens by name or symbol…"
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    className={`flex-1 ${theme.inputBg} ${theme.text} border ${theme.border} p-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50`}
                  />
                  <select
                    value={tokenSort}
                    onChange={(e) => setTokenSort(e.target.value as any)}
                    className={`flex-1 ${theme.selectBg} ${theme.text} border ${theme.border} p-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                  >
                    <option value="value-desc">Value ↓</option>
                    <option value="value-asc">Value ↑</option>
                    <option value="price-desc">Price ↓</option>
                    <option value="price-asc">Price ↑</option>
                    <option value="balance-desc">Balance ↓</option>
                    <option value="balance-asc">Balance ↑</option>
                  </select>
                </div>
                {loading ? (
                  <SkeletonLoader type="table" />
                ) : filteredTokens.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-blue-400 bg-[#1F2937]">
                          <th className="px-4 py-3 text-left uppercase">Asset</th>
                          <th className="px-4 py-3 text-left uppercase">Price (USD)</th>
                          <th className="px-4 py-3 text-left uppercase">Balance</th>
                          <th className="px-4 py-3 text-left uppercase">Value (USD)</th>
                          <th className="px-4 py-3 text-left uppercase">24h %</th>
                          <th className="px-4 py-3 text-left uppercase">7d %</th>
                          <th className="px-4 py-3 text-left uppercase">30d %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTokens.map((token, idx) => {
                          const rawBal = parseFloat(token.balance);
                          const tokenPriceUsd = rawBal > 0 ? token.usdValue / rawBal : 0;
                          return (
                            <tr
                              key={idx}
                              className="border-b border-blue-500/30 hover:bg-[#1E263B] transition"
                            >
                              <td className="px-4 py-3 flex items-center gap-2">
                                {token.logo && failedImages[`token-table-${token.contractAddress}`] !== null && (
                                  <Image
                                    src={token.logo}
                                    alt={token.symbol || "Token"}
                                    width={20}
                                    height={20}
                                    className="w-5 h-5 rounded-full"
                                    onError={() => handleImageError(`token-table-${token.contractAddress}`)}
                                  />
                                )}
                                <div>
                                  <div className="font-medium">{token.name}</div>
                                  <div className="text-gray-400 text-xs">{token.symbol}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {tokenPriceUsd > 0
                                  ? `$${tokenPriceUsd.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 6,
                                    })}`
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {rawBal.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                })}
                              </td>
                              <td className="px-4 py-3 font-medium">
                                ${token.usdValue.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td
                                className={`px-4 py-3 ${
                                  token.priceChange24h! > 0 ? theme.positive : theme.negative
                                }`}
                              >
                                {token.priceChange24h?.toFixed(2) || "—"}%
                              </td>
                              <td
                                className={`px-4 py-3 ${
                                  token.priceChange7d! > 0 ? theme.positive : theme.negative
                                }`}
                              >
                                {token.priceChange7d?.toFixed(2) || "—"}%
                              </td>
                              <td
                                className={`px-4 py-3 ${
                                  token.priceChange30d! > 0 ? theme.positive : theme.negative
                                }`}
                              >
                                {token.priceChange30d?.toFixed(2) || "—"}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-8">No tokens found</p>
                )}
              </section>
            )}

            {/* ─── TRANSACTIONS PANEL ─────────────────────────────────────────────── */}
            {activeTab === "transactions" && (
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-blue-400 uppercase">
                    Transaction History
                  </h2>
                  <button
                    onClick={() =>
                      exportToCSV(
                        filteredTxList.map((tx) => ({
                          time: tx.timestamp
                            ? timeZone === "local"
                              ? new Date(tx.timestamp * 1000).toLocaleString()
                              : new Date(tx.timestamp * 1000).toUTCString()
                            : "—",
                          from: tx.from,
                          to: tx.to || "—",
                          value: tx.value,
                          asset: tx.asset,
                          type: tx.type || "Unknown",
                        })),
                        `transactions_${walletAddress}.csv`,
                        ["Time", "From", "To", "Value", "Asset", "Type"]
                      )
                    }
                    className={`px-3 py-1 ${theme.buttonBg} ${theme.buttonHover} rounded-md text-xs uppercase`}
                    title="Export transactions to CSV"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="flex flex-col md:flex-row gap-2">
                  <select
                    value={txFilterAsset}
                    onChange={(e) => setTxFilterAsset(e.target.value)}
                    className={`flex-1 ${theme.selectBg} ${theme.text} border ${theme.border} p-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                  >
                    <option value="all">All Assets</option>
                    <option value="ETH">ETH</option>
                    {walletData?.tokens.map((t) => (
                      <option key={t.contractAddress} value={t.symbol}>
                        {t.symbol}
                      </option>
                    ))}
                  </select>
                  <select
                    value={txFilterType}
                    onChange={(e) => setTxFilterType(e.target.value)}
                    className={`flex-1 ${theme.selectBg} ${theme.text} border ${theme.border} p-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                  >
                    <option value="all">All Types</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Swap">Swap</option>
                    <option value="Contract Interaction">Contract Interaction</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                  <select
                    value={txFilterDate}
                    onChange={(e) => setTxFilterDate(e.target.value)}
                    className={`flex-1 ${theme.selectBg} ${theme.text} border ${theme.border} p-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                  >
                    <option value="all">All Time</option>
                    <option value="24h">Last 24h</option>
                    <option value="7d">Last 7d</option>
                    <option value="30d">Last 30d</option>
                  </select>
                  <select
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value as "local" | "utc")}
                    className={`flex-1 ${theme.selectBg} ${theme.text} border ${theme.border} p-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                  >
                    <option value="local">Local Time</option>
                    <option value="utc">UTC</option>
                  </select>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className={`flex-1 ${theme.selectBg} ${theme.text} border ${theme.border} p-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                  >
                    <option value="10">10 per page</option>
                    <option value="25">25 per page</option>
                    <option value="50">50 per page</option>
                  </select>
                </div>
                {loading ? (
                  <SkeletonLoader type="table" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-blue-400 bg-[#1F2937]">
                          <th className="px-4 py-3 text-left uppercase">Time</th>
                          <th className="px-4 py-3 text-left uppercase">From</th>
                          <th className="px-4 py-3 text-left uppercase">To</th>
                          <th className="px-4 py-3 text-left uppercase">Value</th>
                          <th className="px-4 py-3 text-left uppercase">Asset</th>
                          <th className="px-4 py-3 text-left uppercase">Type</th>
                          <th className="px-4 py-3 text-left uppercase">Hash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTxList.map((tx, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-blue-500/30 hover:bg-[#1E263B] transition"
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                              {tx.timestamp
                                ? timeZone === "local"
                                  ? new Date(tx.timestamp * 1000).toLocaleString()
                                  : new Date(tx.timestamp * 1000).toUTCString()
                                : "—"}
                            </td>
                            <td className="px-4 py-3 truncate">
                              <Link
                                href={`/explorer/address/${tx.from}`}
                                className="text-blue-400 hover:underline"
                                title={tx.from}
                              >
                                {tx.from.slice(0, 6)}…{tx.from.slice(-4)}
                              </Link>
                            </td>
                            <td className="px-4 py-3 truncate">
                              {tx.to && tx.to !== "" ? (
                                <Link
                                  href={`/explorer/address/${tx.to}`}
                                  className="text-blue-400 hover:underline"
                                  title={tx.to}
                                >
                                  {tx.to.slice(0, 6)}…{tx.to.slice(-4)}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-medium">
                              {parseFloat(tx.value).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 4,
                              })}
                            </td>
                            <td className="px-4 py-3">
                              {tx.asset}
                            </td>
                            <td className="px-4 py-3">
                              {tx.type || "Unknown"}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/explorer/hash/${tx.hash}`}
                                className="text-blue-400 hover:underline"
                                title="View transaction details"
                              >
                                {tx.hash.slice(0, 6)}…{tx.hash.slice(-4)}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-center items-center gap-4 mt-4">
                  <button
                    onClick={() => setTxPage((p) => Math.max(p - 1, 1))}
                    disabled={txPage === 1}
                    className={`px-4 py-2 ${theme.buttonBg} ${theme.buttonHover} ${
                      txPage === 1 ? theme.buttonDisabled : ""
                    } rounded-md text-sm uppercase ${theme.shadow}`}
                  >
                    ← Previous
                  </button>
                  <span className="text-gray-200 text-sm">
                    Page {txPage} of {totalTxPages}
                  </span>
                  <button
                    onClick={() => setTxPage((p) => Math.min(p + 1, totalTxPages))}
                    disabled={txPage === totalTxPages}
                    className={`px-4 py-2 ${theme.buttonBg} ${theme.buttonHover} ${
                      txPage === totalTxPages ? theme.buttonDisabled : ""
                    } rounded-md text-sm uppercase ${theme.shadow}`}
                  >
                    Next →
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ─── BANNER AD ──────────────────────────────────────────────────────────── */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 mb-6">
        {ads
          .filter((ad) => ad.type === "banner")
          .slice(currentAdIndex, currentAdIndex + 1)
          .map((ad, idx) => (
            <a
              key={idx}
              href={ad.destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackAdClick(ad)}
              className={`block mx-auto overflow-hidden rounded-md ${theme.shadow} md:max-w-[728px] h-[90px]`}
            >
              <Image
                src={failedImages[`ad-banner-${idx}`] || ad.imageUrl}
                alt="Advertisement"
                width={728}
                height={90}
                className="w-full h-full object-cover"
                onError={() => handleImageError(`ad-banner-${idx}`)}
                priority={false}
                aria-label="Advertisement"
              />
            </a>
          ))}
      </section>
      <Footer />
    </div>
  );
}