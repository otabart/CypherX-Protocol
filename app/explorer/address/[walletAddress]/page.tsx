"use client";

import { useState, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardIcon } from "@heroicons/react/24/outline";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE INITIALIZATION (UNCHANGED)
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
// LOADER (SPINNER) COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function Loader() {
  return <div className="w-5 h-5 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
interface Token {
  name: string;
  symbol: string;
  balance: string;            // RAW token balance (string)
  contractAddress: string;
  usdValue: number;           // Computed (balance × live price)
  recentActivity: number;     // # of transfers in last 24h
  tokenType: "ERC-20" | "ERC-721";
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;             // RAW ETH value (string)
  asset: string;             // "ETH" or token symbol
  gasUsed?: string;          // Hex → converted
  timestamp?: number;        // epoch seconds
}

interface WalletData {
  ethBalance: number;        // in ETH
  ethUsdValue: number;       // in USD
  totalUsdValue: number;     // in USD (ETH + tokens)
  tokens: Token[];
  txList: Transaction[];
  lastScannedBlock?: { number: string; timestamp: number };
  nonce?: number;
  isContract?: boolean;
  chainId?: string;
}

interface Ad {
  createdAt: string;
  destinationUrl: string;
  imageUrl: string;
  type: "banner" | "sidebar" | "inline";
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

  // Tabs: "overview" | "transactions" | "tokens"
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "tokens">("overview");

  // Token filters & sorting
  const [tokenSearch, setTokenSearch] = useState<string>("");
  const [tokenSort, setTokenSort] = useState<"usd-desc" | "usd-asc" | "activity-desc" | "activity-asc">(
    "usd-desc"
  );
  const [tokenTypes, setTokenTypes] = useState<("ERC-20" | "ERC-721")[]>(["ERC-20", "ERC-721"]);

  // Pagination for transactions
  const [txPage, setTxPage] = useState<number>(1);
  const itemsPerPage = 10;

  // ETH price in USD (from CoinGecko)
  const [ethPrice, setEthPrice] = useState<number>(0);

  // Deposits / Withdrawals summary
  const [depositCount, setDepositCount] = useState<number>(0);
  const [withdrawalCount, setWithdrawalCount] = useState<number>(0);

  // Toast (“Copied!”)
  const [toast, setToast] = useState<string | null>(null);
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setToast("Copied!");
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(id);
  }, [toast]);

  // Ads from Firestore (fallback if none exist)
  const [ads, setAds] = useState<Ad[]>([]);
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
  }, []);

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
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH ETH PRICE FROM COINGECKO
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_COINGECKO_API_URL}/simple/price?ids=ethereum&vs_currencies=usd`
        );
        if (!res.ok) throw new Error("Failed to fetch ETH price");
        const data = await res.json();
        setEthPrice(data.ethereum.usd);
      } catch {
        setEthPrice(3000); // fallback
      }
    }
    fetchPrice();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN DATA FETCH: ALCHEMY + COINGECKO + FIREBASE
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const resolved = await params;
        const address = resolved.walletAddress.toLowerCase();
        setWalletAddress(address);

        // Validate address
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          notFound();
          return;
        }

        // ALCHEMY RPC URL from env
        const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL!;
        if (!alchemyUrl) throw new Error("Missing ALCHEMY_API_URL");

        // 1) Get chainId
        let chainId: string | undefined = undefined;
        try {
          const res = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
          });
          const data = await res.json();
          chainId = parseInt(data.result, 16).toString();
        } catch {
          chainId = undefined;
        }

        // 2) Get latest block & timestamp
        let latestBlockHex = "0x0";
        let blockTimestamp = 0;
        try {
          const bnRes = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 }),
          });
          const bnData = await bnRes.json();
          latestBlockHex = bnData.result;

          const blockRes = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getBlockByNumber",
              params: [latestBlockHex, false],
              id: 3,
            }),
          });
          const blockData = await blockRes.json();
          blockTimestamp = blockData.result?.timestamp ? parseInt(blockData.result.timestamp, 16) : 0;
        } catch {
          blockTimestamp = 0;
        }

        // 3) Get nonce & contract‐check
        let nonce: number | undefined = undefined;
        let isContract = false;
        try {
          // nonce
          const txCountRes = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getTransactionCount",
              params: [address, "latest"],
              id: 4,
            }),
          });
          const txCountData = await txCountRes.json();
          nonce = parseInt(txCountData.result, 16);

          // code
          const codeRes = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getCode",
              params: [address, "latest"],
              id: 5,
            }),
          });
          const codeData = await codeRes.json();
          isContract = codeData.result && codeData.result !== "0x";
        } catch {
          nonce = undefined;
          isContract = false;
        }

        // 4) Fetch raw wallet data from your server‐side API
        let rawData: any;
        try {
          const resp = await fetch(`/api/wallet/${address}`);
          if (!resp.ok) throw new Error(`API error ${resp.status}`);
          rawData = await resp.json();
        } catch {
          rawData = { ethBalance: 0, tokens: [], txList: [] };
        }

        // 5) Process tokens: filter out < $5k, no activity, and fetch live USD price
        const latestBlockNum = parseInt(latestBlockHex, 16);
        const enhancedTokens: Token[] = [];

        for (let tk of (rawData.tokens as Token[])) {
          // Compute raw balance & skip if zero
          const rawBal = parseFloat(tk.balance);
          if (isNaN(rawBal) || rawBal <= 0) continue;

          // Fetch on‐chain logs for “Transfer” in last ~24h (86400s)
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
                    fromBlock: "0x" + (latestBlockNum - 86400 * 2).toString(16),
                    toBlock: "latest",
                    address: tk.contractAddress,
                    topics: [
                      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // Transfer
                    ],
                  },
                ],
                id: 6,
              }),
            });
            const logsData = await logsRes.json();
            recentActivity = logsData.result?.length || 0;
          } catch {
            recentActivity = 0;
          }

          // Skip if no recent activity
          if (recentActivity === 0) continue;

          // Fetch USD price from CoinGecko by contract address on Ethereum
          let tokenPriceUsd = 0;
          try {
            const priceRes = await fetch(
              `${process.env.NEXT_PUBLIC_COINGECKO_API_URL}/simple/token_price/ethereum?contract_addresses=${tk.contractAddress}&vs_currencies=usd`
            );
            const priceData = await priceRes.json();
            const key = tk.contractAddress.toLowerCase();
            tokenPriceUsd = priceData[key]?.usd || 0;
          } catch {
            tokenPriceUsd = 0;
          }

          // Compute total USD value
          const usdTotal = tokenPriceUsd * rawBal;
          // Filter out if < $5k
          if (usdTotal < 5000) continue;

          enhancedTokens.push({
            name: tk.name,
            symbol: tk.symbol,
            balance: tk.balance,
            contractAddress: tk.contractAddress,
            usdValue: usdTotal,
            recentActivity,
            tokenType: "ERC-20",
          });
        }

        // 6) Process transactions: fetch gasUsed and block timestamps
        const enhancedTxs: Transaction[] = [];
        for (let tx of (rawData.txList as Transaction[])) {
          let gasUsed = "—";
          let timestamp = 0;
          try {
            const receiptRes = await fetch(alchemyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getTransactionReceipt",
                params: [tx.hash],
                id: 7,
              }),
            });
            const receiptData = await receiptRes.json();
            if (receiptData.result?.gasUsed) {
              gasUsed = parseInt(receiptData.result.gasUsed, 16).toString();
              // fetch block for timestamp
              const blockRes2 = await fetch(alchemyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  method: "eth_getBlockByHash",
                  params: [receiptData.result.blockHash, false],
                  id: 8,
                }),
              });
              const blockData2 = await blockRes2.json();
              timestamp = blockData2.result?.timestamp
                ? parseInt(blockData2.result.timestamp, 16)
                : 0;
            }
          } catch {
            gasUsed = "—";
            timestamp = 0;
          }

          enhancedTxs.push({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            asset: tx.asset,
            gasUsed,
            timestamp,
          });
        }

        // 7) Compute USD values
        const ethUsd = (rawData.ethBalance || 0) * ethPrice;
        const totalUsd =
          ethUsd + enhancedTokens.reduce((sum, t) => sum + t.usdValue, 0);

        // 8) Compute deposit/withdrawal counts
        let deposits = 0;
        let withdrawals = 0;
        enhancedTxs.forEach((tx) => {
          if (tx.to.toLowerCase() === address) deposits++;
          if (tx.from.toLowerCase() === address) withdrawals++;
        });
        setDepositCount(deposits);
        setWithdrawalCount(withdrawals);

        // 9) If no data, show error
        if (
          (rawData.ethBalance || 0) === 0 &&
          enhancedTokens.length === 0 &&
          enhancedTxs.length === 0
        ) {
          setError("No data found for this address on Base Mainnet.");
          setWalletData(null);
        } else {
          setWalletData({
            ethBalance: rawData.ethBalance || 0,
            ethUsdValue: ethUsd,
            totalUsdValue: totalUsd,
            tokens: enhancedTokens,
            txList: enhancedTxs,
            lastScannedBlock: {
              number: parseInt(latestBlockHex, 16).toString(),
              timestamp: blockTimestamp,
            },
            nonce,
            isContract,
            chainId,
          });
        }
      } catch (err: any) {
        setError(`Failed to load: ${err.message || "Unknown error"}`);
        setWalletData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params, ethPrice]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FILTER & SORT TOKENS
  // ─────────────────────────────────────────────────────────────────────────────
  const filteredTokens = (walletData?.tokens || [])
    .filter((t) => tokenTypes.includes(t.tokenType))
    .filter(
      (t) =>
        t.name.toLowerCase().includes(tokenSearch.toLowerCase()) ||
        t.symbol.toLowerCase().includes(tokenSearch.toLowerCase())
    )
    .sort((a, b) => {
      switch (tokenSort) {
        case "usd-desc":
          return b.usdValue - a.usdValue;
        case "usd-asc":
          return a.usdValue - b.usdValue;
        case "activity-desc":
          return b.recentActivity - a.recentActivity;
        case "activity-asc":
          return a.recentActivity - b.recentActivity;
        default:
          return 0;
      }
    });

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGINATE TRANSACTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const paginatedTxList = walletData?.txList.slice(
    (txPage - 1) * itemsPerPage,
    txPage * itemsPerPage
  );
  const totalTxPages = Math.ceil((walletData?.txList.length || 0) / itemsPerPage);

  // ─────────────────────────────────────────────────────────────────────────────
  // UNIQUE COUNTERPARTIES
  // ─────────────────────────────────────────────────────────────────────────────
  let uniqueCounterparties = 0;
  if (walletData) {
    const addrSet = new Set<string>();
    walletData.txList.forEach((tx) => {
      addrSet.add(tx.from);
      if (tx.to && tx.to !== "") addrSet.add(tx.to);
    });
    uniqueCounterparties = addrSet.size;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen w-full flex flex-col ${theme.background} ${theme.text}`}>
      {/* ─── TOAST ──────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 right-4 px-3 py-2 rounded-md bg-blue-500/80 text-white text-xs z-50">
          {toast}
        </div>
      )}

      {/* ─── HEADER: "WALLET SCAN" + ADDRESS + COPY, ETH PRICE/LOGO ON RIGHT ─────── */}
      <header className={`w-full border-b ${theme.border} bg-[#0F172A]`}>
        <div className="max-w-full px-6 py-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Left: Title + Address + Copy */}
          <div className="flex flex-col gap-1 w-full lg:w-auto">
            <h1 className="text-2xl lg:text-3xl font-extrabold uppercase tracking-tight">
              WALLET SCAN
            </h1>
            <div className="flex items-center gap-2">
              <p className="break-all text-gray-400 text-sm lg:text-base">{walletAddress || "—"}</p>
              <button
                onClick={() => copyToClipboard(walletAddress)}
                disabled={!walletAddress}
                className={`flex items-center gap-1 ${
                  walletAddress ? theme.buttonBg : theme.buttonDisabled
                } border ${theme.border} px-2 py-1 rounded-md text-xs lg:text-sm uppercase ${
                  walletAddress ? theme.buttonHover : "opacity-50 cursor-not-allowed"
                }`}
              >
                <ClipboardIcon className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-medium">Copy</span>
              </button>
            </div>
          </div>

          {/* Right: ETH Logo + Price */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <img
              src="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
              alt="ETH Logo"
              className="w-8 h-8"
            />
            {ethPrice > 0 ? (
              <span className="text-lg lg:text-xl font-semibold">${ethPrice.toLocaleString()}</span>
            ) : (
              <Loader />
            )}
          </div>
        </div>
      </header>

      {/* ─── METRIC ROW: FULL WIDTH, NO GAPS ──────────────────────────────────────── */}
      <section className="w-full bg-[#0F172A]">
        <div className="w-full max-w-full px-6 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 gap-4">
          {/* ETH BALANCE */}
          <div className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}>
            <span className="text-xs lg:text-sm font-semibold text-blue-400 uppercase">ETH Balance</span>
            <span className="mt-1 text-lg lg:text-xl font-bold">
              {walletData
                ? walletData.ethBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  })
                : "—"}{" "}
              ETH
            </span>
            <span className="mt-1 text-gray-400 text-xs lg:text-xs">
              $
              {walletData
                ? walletData.ethUsdValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "—"}{" "}
              USD
            </span>
          </div>

          {/* TOTAL VALUE */}
          <div className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}>
            <span className="text-xs lg:text-sm font-semibold text-blue-400 uppercase">Total Value</span>
            <span className="mt-1 text-lg lg:text-xl font-bold">
              {walletData
                ? `$${walletData.totalUsdValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : "—"}
            </span>
          </div>

          {/* TOKENS HELD */}
          <div className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}>
            <span className="text-xs lg:text-sm font-semibold text-blue-400 uppercase">Tokens Held</span>
            <span className="mt-1 text-lg lg:text-xl font-bold">
              {walletData ? walletData.tokens.length.toLocaleString() : "—"}
            </span>
          </div>

          {/* TRANSACTIONS */}
          <div className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}>
            <span className="text-xs lg:text-sm font-semibold text-blue-400 uppercase">Txns</span>
            <span className="mt-1 text-lg lg:text-xl font-bold">
              {walletData ? walletData.txList.length.toLocaleString() : "—"}
            </span>
          </div>

          {/* UNIQUE COUNTERPARTIES */}
          <div className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}>
            <span className="text-xs lg:text-sm font-semibold text-blue-400 uppercase">Unique Parties</span>
            <span className="mt-1 text-lg lg:text-xl font-bold">
              {walletData ? uniqueCounterparties.toLocaleString() : "—"}
            </span>
          </div>
        </div>
      </section>

      {/* ─── DEPOSITS / WITHDRAWALS (replaces Coinbase section) ─────────────────── */}
      {walletData && (
        <section className="w-full bg-[#0F172A] border-t border-b border-blue-500/30">
          <div className="max-w-full px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}>
              <span className="text-xs lg:text-sm font-semibold text-blue-400 uppercase">Deposits</span>
              <span className="mt-1 text-lg lg:text-xl font-bold">
                {depositCount.toLocaleString()}
              </span>
            </div>
            <div className={`flex flex-col p-4 rounded-lg border ${theme.border} ${theme.containerBg} ${theme.shadow}`}>
              <span className="text-xs lg:text-sm font-semibold text-blue-400 uppercase">Withdrawals</span>
              <span className="mt-1 text-lg lg:text-xl font-bold">
                {withdrawalCount.toLocaleString()}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ─── 3-COLUMN, FULL-WIDTH NAVIGATION MENU ────────────────────────────────── */}
      <nav className={`w-full bg-[#0F172A] border-t border-b ${theme.border}`}>
        <div className="max-w-full px-6">
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
                onClick={() => setActiveTab("transactions")}
                className={`py-3 w-full ${
                  activeTab === "transactions" ? theme.tabActive : theme.tabInactive
                } hover:${theme.tabActive} transition-colors`}
              >
                Transactions
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
          </ul>
        </div>
      </nav>

      {/* ─── MAIN CONTENT (FULL WIDTH/HEIGHT) ────────────────────────────────────── */}
      <main className="flex-1 w-full overflow-auto px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader />
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
              <section className="w-full space-y-8">
                <h2 className="text-xl lg:text-2xl font-semibold text-blue-400 uppercase">
                  Overview
                </h2>

                {/* Top: Portfolio Table & Balances History Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  {/* Portfolio Table */}
                  <div className="rounded-lg border border-blue-500/30 bg-[#111827] overflow-hidden flex flex-col h-full">
                    <div className="px-4 py-3 border-b border-blue-500/30 bg-[#1F2937]">
                      <h3 className="text-base lg:text-lg font-semibold text-gray-200 uppercase">
                        Portfolio
                      </h3>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <table className="min-w-full text-xs lg:text-sm">
                        <thead>
                          <tr className="text-blue-400 bg-[#1F2937]">
                            <th className="px-3 py-2 text-left uppercase">Asset</th>
                            <th className="px-3 py-2 text-left uppercase">Price (USD)</th>
                            <th className="px-3 py-2 text-left uppercase">Holdings</th>
                            <th className="px-3 py-2 text-left uppercase">Value (USD)</th>
                            <th className="px-3 py-2 text-left uppercase">24h %∆</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* ETH Row */}
                          <tr className="border-b border-blue-500/30 hover:bg-[#1E263B] transition">
                            <td className="px-3 py-2 flex items-center gap-2">
                              <img
                                src="https://assets.coingecko.com/coins/images/279/large/ethereum.png"
                                alt="ETH"
                                className="w-4 h-4 rounded-full"
                              />
                              <span>ETH</span>
                            </td>
                            <td className="px-3 py-2">
                              {ethPrice > 0
                                ? `$${ethPrice.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {walletData.ethBalance.toLocaleString(undefined, {
                                minimumFractionDigits: 4,
                                maximumFractionDigits: 4,
                              })}{" "}
                              ETH
                            </td>
                            <td className="px-3 py-2">
                              {walletData.ethUsdValue.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-3 py-2 text-gray-400">—{/* placeholder */}</td>
                          </tr>

                          {/* Token Rows */}
                          {walletData.tokens.map((token, idx) => {
                            const rawBal = parseFloat(token.balance);
                            const tokenPriceUsd = rawBal > 0 ? token.usdValue / rawBal : 0;
                            // Placeholder for 24h percentage change
                            const pctChange24h = 0;
                            const changeColor =
                              pctChange24h > 0
                                ? "text-green-400"
                                : pctChange24h < 0
                                ? "text-red-400"
                                : "text-gray-400";

                            return (
                              <tr
                                key={idx}
                                className="border-b border-blue-500/30 hover:bg-[#1E263B] transition"
                              >
                                <td className="px-3 py-2 flex items-center gap-2">
                                  <div className="w-4 h-4 rounded-full bg-gray-500" />
                                  <span>{token.symbol}</span>
                                </td>
                                <td className="px-3 py-2">
                                  {tokenPriceUsd > 0
                                    ? `$${tokenPriceUsd.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`
                                    : "—"}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {rawBal.toLocaleString(undefined, {
                                    minimumFractionDigits: 3,
                                    maximumFractionDigits: 3,
                                  })}{" "}
                                  {token.symbol}
                                </td>
                                <td className="px-3 py-2">
                                  {token.usdValue.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className={`px-3 py-2 ${changeColor}`}>
                                  {pctChange24h.toFixed(2)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Balances History Chart (Placeholder) */}
                  <div className="rounded-lg border border-blue-500/30 bg-[#111827] p-4 h-full flex flex-col">
                    <div className="border-b border-blue-500/30 pb-2 mb-2">
                      <h3 className="text-base lg:text-lg font-semibold text-gray-200 uppercase">
                        Balances History
                      </h3>
                    </div>
                    <div className="flex-1 bg-[#1F2937] rounded-md animate-pulse" />
                  </div>
                </div>
              </section>
            )}

            {/* ─── TRANSACTIONS PANEL ───────────────────────────────────────────────── */}
            {activeTab === "transactions" && (
              <section className="w-full h-full flex flex-col">
                <h2 className="text-xl lg:text-2xl font-semibold text-blue-400 uppercase mb-4">
                  All Transfers
                </h2>
                <div className="flex-1 overflow-x-auto">
                  <table className="min-w-full text-xs lg:text-sm h-full w-full table-fixed">
                    <thead className="sticky top-0 bg-[#1F2937] z-10">
                      <tr className="text-blue-400">
                        <th className="px-3 py-2 text-left uppercase w-[15%]">Time</th>
                        <th className="px-3 py-2 text-left uppercase w-[20%]">From</th>
                        <th className="px-3 py-2 text-left uppercase w-[20%]">To</th>
                        <th className="px-3 py-2 text-left uppercase w-[10%]">Value (ETH)</th>
                        <th className="px-3 py-2 text-left uppercase w-[10%]">Asset</th>
                        <th className="px-3 py-2 text-left uppercase w-[10%]">Gas Used</th>
                        <th className="px-3 py-2 text-left uppercase w-[15%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTxList?.map((tx, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-blue-500/30 hover:bg-[#1E263B] transition"
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            {tx.timestamp
                              ? new Date(tx.timestamp * 1000).toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2 truncate">
                            <Link
                              href={`/explorer/address/${tx.from}`}
                              className="text-blue-400 hover:underline"
                            >
                              {tx.from.slice(0, 6)}…{tx.from.slice(-4)}
                            </Link>
                          </td>
                          <td className="px-3 py-2 truncate">
                            {tx.to && tx.to !== "" ? (
                              <Link
                                href={`/explorer/address/${tx.to}`}
                                className="text-blue-400 hover:underline"
                              >
                                {tx.to.slice(0, 6)}…{tx.to.slice(-4)}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {parseFloat(tx.value).toLocaleString(undefined, {
                              minimumFractionDigits: 3,
                              maximumFractionDigits: 3,
                            })}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{tx.asset}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {tx.gasUsed && !isNaN(Number(tx.gasUsed))
                              ? Number(tx.gasUsed).toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2 flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(tx.hash)}
                              className={`p-1 ${theme.buttonBg} ${theme.buttonHover} rounded-full border ${theme.border}`}
                            >
                              <ClipboardIcon className="w-4 h-4 text-blue-400" />
                            </button>
                            <Link
                              href={`/explorer/hash/${tx.hash}`}
                              className="text-blue-400 hover:text-blue-500"
                            >
                              {/* We removed the ArrowTopRightOnSquareIcon in header,
                                  but for transactions, you still want a “view” icon.
                                  Feel free to swap this for any “external link” icon. */}
                              <span className="underline text-xs">View Hash</span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4">
                  <button
                    onClick={() => setTxPage((p) => Math.max(p - 1, 1))}
                    disabled={txPage === 1}
                    className={`px-3 py-2 ${theme.buttonBg} ${theme.buttonHover} ${
                      txPage === 1 ? theme.buttonDisabled : ""
                    } rounded-md text-xs lg:text-sm uppercase w-full sm:w-auto ${theme.shadow}`}
                  >
                    ← Previous
                  </button>
                  <span className="text-gray-200 text-xs lg:text-sm uppercase">
                    Page {txPage} of {totalTxPages}
                  </span>
                  <button
                    onClick={() => setTxPage((p) => Math.min(p + 1, totalTxPages))}
                    disabled={txPage === totalTxPages}
                    className={`px-3 py-2 ${theme.buttonBg} ${theme.buttonHover} ${
                      txPage === totalTxPages ? theme.buttonDisabled : ""
                    } rounded-md text-xs lg:text-sm uppercase w-full sm:w-auto ${theme.shadow}`}
                  >
                    Next →
                  </button>
                </div>
              </section>
            )}

            {/* ─── TOKENS PANEL ───────────────────────────────────────────────────── */}
            {activeTab === "tokens" && (
              <section className="w-full">
                <h2 className="text-xl lg:text-2xl font-semibold text-blue-400 uppercase mb-4">
                  Token Holdings
                </h2>

                {/* Search / Sort / Filter Bar */}
                <div className="flex flex-col lg:flex-row gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Search tokens by name or symbol…"
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    className={`flex-1 ${theme.inputBg} ${theme.text} border ${theme.border} p-1 rounded-md text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50`}
                  />
                  <select
                    value={tokenSort}
                    onChange={(e) => setTokenSort(e.target.value as any)}
                    className={`${theme.selectBg} ${theme.text} border ${theme.border} p-1 rounded-md text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                  >
                    <option value="usd-desc">USD Value ↓</option>
                    <option value="usd-asc">USD Value ↑</option>
                    <option value="activity-desc">Activity ↓</option>
                    <option value="activity-asc">Activity ↑</option>
                  </select>
                  <select
                    multiple
                    value={tokenTypes}
                    onChange={(e) =>
                      setTokenTypes(Array.from(e.target.selectedOptions, (opt) => opt.value as any))
                    }
                    className={`${theme.selectBg} ${theme.text} border ${theme.border} p-1 rounded-md text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase`}
                    title="Hold Ctrl (Windows) / Cmd (Mac) to select multiple"
                  >
                    <option value="ERC-20">ERC-20</option>
                    <option value="ERC-721">ERC-721</option>
                  </select>
                </div>

                {/* Token Table */}
                {filteredTokens.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs lg:text-sm">
                      <thead>
                        <tr className="text-blue-400 bg-[#1F2937]">
                          <th className="px-3 py-2 text-left uppercase">Name</th>
                          <th className="px-3 py-2 text-left uppercase">Symbol</th>
                          <th className="px-3 py-2 text-left uppercase">Balance</th>
                          <th className="px-3 py-2 text-left uppercase">USD Value</th>
                          <th className="px-3 py-2 text-left uppercase">Activity (24h)</th>
                          <th className="px-3 py-2 text-left uppercase">Token Price (USD)</th>
                          <th className="px-3 py-2 text-left uppercase">Contract</th>
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
                              <td className="px-3 py-2">{token.name}</td>
                              <td className="px-3 py-2">{token.symbol}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {rawBal.toLocaleString(undefined, {
                                  minimumFractionDigits: 3,
                                  maximumFractionDigits: 3,
                                })}{" "}
                                {token.symbol}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {token.usdValue.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {token.recentActivity.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {tokenPriceUsd > 0
                                  ? `$${tokenPriceUsd.toLocaleString(undefined, {
                                      minimumFractionDigits: 4,
                                      maximumFractionDigits: 4,
                                    })}`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 truncate max-w-[140px]">
                                <Link
                                  href={`/explorer/address/${token.contractAddress}`}
                                  className="text-blue-400 hover:underline text-xs lg:text-xs"
                                >
                                  {token.contractAddress.slice(0, 6)}…{token.contractAddress.slice(-4)}
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs lg:text-sm uppercase">No tokens found</p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* ─── INLINE BANNER AD (FLEXIBLE FULL‐WIDTH) ───────────────────────────────── */}
      <section className="w-full px-6 mb-6">
        {ads
          .filter((ad) => ad.type === "banner")
          .slice(0, 1)
          .map((ad, idx) => (
            <a
              key={idx}
              href={ad.destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`block mx-auto overflow-hidden rounded-md ${theme.shadow}`}
              style={{ maxWidth: "728px", height: "90px" }}
            >
              <img src={ad.imageUrl} alt="Advertisement" className="w-full h-full object-cover" />
            </a>
          ))}
      </section>
    </div>
  );
}
