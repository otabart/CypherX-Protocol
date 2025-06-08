"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ClipboardIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Sparklines, SparklinesLine } from "react-sparklines";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { db } from "@/lib/firebase";
import Footer from "../../../components/Footer";
import Swap from "./swap";

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Types
interface TokenMetadata {
  poolAddress: string;
  pairAddress: string;
  baseToken: { name: string; symbol: string; address?: string };
  quoteToken: { name: string; symbol: string; address?: string };
  priceUsd: string;
  liquidity: { usd: number };
  marketCap: number;
  fdv: number;
  bannerUrl?: string;
  logoUrl?: string;
  adImageUrl?: string;
  priceChange?: { m5: number; h1: number; h6: number; h24: number };
}

interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndicatorData {
  x: number;
  y: number;
}

interface MACDData {
  x: number;
  macd: number;
  signal: number;
  histogram: number;
}

interface SupertrendData extends IndicatorData {
  trend: "Bullish" | "Bearish";
  signalStrength: number;
  action: "Buy" | "Sell" | "Hold";
}

interface PerformanceMetrics {
  change_5m: number;
  change_1h: number;
  change_4h: number;
  change_24h: number;
}

interface Transaction {
  id: string;
  from: string;
  to: string;
  value: string;
  tokenAmount: number;
  timestamp: number;
  blockNumber: number;
  tokenSymbol?: string;
  decimals?: number;
  hash: string;
}

interface TrendInsight {
  text: string;
  trend?: "Bullish" | "Bearish";
  rsiStatus?: "Overbought" | "Oversold" | "Neutral";
  crossoverType?: "Golden Cross" | "Death Cross";
}

type TrendingToken = {
  symbol: string;
  name: string;
  priceUsd: string;
  priceChange24h: number;
  imageUrl: string;
  pairAddress: string;
};

export default function ChartPage() {
  const { poolAddress } = useParams();
  const [token, setToken] = useState<TokenMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<string>("1h");
  const [candleData, setCandleData] = useState<any[]>([]);
  const [lineData, setLineData] = useState<IndicatorData[]>([]);
  const [marketCapData, setMarketCapData] = useState<any[]>([]);
  const [volumeData, setVolumeData] = useState<IndicatorData[]>([]);
  const [sma20Data, setSma20Data] = useState<IndicatorData[]>([]);
  const [sma50Data, setSma50Data] = useState<IndicatorData[]>([]);
  const [rsiData, setRsiData] = useState<IndicatorData[]>([]);
  const [macdData, setMacdData] = useState<MACDData[]>([]);
  const [vwapData, setVwapData] = useState<IndicatorData[]>([]);
  const [supertrendData, setSupertrendData] = useState<SupertrendData[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [activeIndicatorTab, setActiveIndicatorTab] = useState<string>("Volume");
  const [chartView, setChartView] = useState<"Price" | "MarketCap">("Price");
  const [chartType, setChartType] = useState<"Candlestick" | "Line">("Candlestick");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [xAxisRange, setXAxisRange] = useState<{ min: number; max: number } | null>(null);
  const [vwapSignals, setVwapSignals] = useState<{ x: number; y: number; type: "Buy" | "Sell" }[]>([]);
  const [smaCrossovers, setSmaCrossovers] = useState<{ x: number; y: number; type: "Golden Cross" | "Death Cross" }[]>([]);
  const [supertrendSignals, setSupertrendSignals] = useState<{ x: number; y: number; type: "Buy" | "Sell" }[]>([]);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const transactionLimit = 10;
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [showTrendModal, setShowTrendModal] = useState(false);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastTransactionRef = useRef<HTMLTableRowElement | null>(null);
  const transactionContainerRef = useRef<HTMLDivElement | null>(null);
  const availableIndicators = ["Volume", "SMA", "RSI", "MACD", "VWAP", "Supertrend"];

  // Utility Functions
  const throttle = <F extends (...args: any[]) => void>(func: F, wait: number) => {
    let lastTime: number | null = null;
    return (...args: Parameters<F>) => {
      const now = Date.now();
      if (lastTime === null || now - lastTime >= wait) {
        lastTime = now;
        func(...args);
      }
    };
  };

  const downsampleData = (data: OHLCVData[], factor: number): OHLCVData[] => {
    if (data.length <= factor) return data;
    return data.filter((_, index) => index % factor === 0);
  };

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const getVisibleData = (data: any[]) => {
    if (!xAxisRange) return data;
    return data.filter((d: any) => {
      const timestamp = d.x.getTime ? d.x.getTime() : d.x;
      return timestamp >= xAxisRange.min && timestamp <= xAxisRange.max;
    });
  };

  // Indicator Calculations
  const calculateSupertrend = useCallback((data: OHLCVData[], period = 14, multiplier = 3) => {
    const atr = data.slice(period - 1).map((_, i) => {
      const slice = data.slice(i, i + period);
      const trs = slice.map((d, idx) => {
        if (idx === 0) return d.high - d.low;
        return Math.max(d.high - d.low, Math.abs(d.high - slice[idx - 1].close), Math.abs(d.low - slice[idx - 1].close));
      });
      return trs.reduce((sum, tr) => sum + tr, 0) / period;
    });
    const result: SupertrendData[] = [];
    let upperBand = 0,
      lowerBand = 0,
      supertrend = 0,
      trend: "Bullish" | "Bearish" = "Bullish";
    data.slice(period - 1).forEach((d, i) => {
      const hl2 = (d.high + d.low) / 2;
      const basicUpper = hl2 + multiplier * atr[i];
      const basicLower = hl2 - multiplier * atr[i];
      upperBand = basicUpper < upperBand || d.close > upperBand ? basicUpper : upperBand;
      lowerBand = basicLower > lowerBand || d.close < lowerBand ? basicLower : lowerBand;
      if (i === 0) {
        supertrend = lowerBand;
        trend = d.close > supertrend ? "Bullish" : "Bearish";
      } else {
        supertrend =
          trend === "Bullish" && d.close < supertrend
            ? upperBand
            : trend === "Bearish" && d.close > supertrend
            ? lowerBand
            : supertrend;
        trend = d.close > supertrend ? "Bullish" : "Bearish";
      }
      const signalStrength = Math.abs(d.close - supertrend) / atr[i];
      const action = signalStrength > 1 ? (trend === "Bullish" ? "Buy" : "Sell") : "Hold";
      result.push({ x: d.timestamp, y: supertrend, trend, signalStrength, action });
    });
    return result;
  }, []);

  const calculateSupertrendSignals = useCallback((data: OHLCVData[], supertrend: SupertrendData[], rsi: IndicatorData[]) => {
    const signals: { x: number; y: number; type: "Buy" | "Sell" }[] = [];
    for (let i = 1; i < data.length; i++) {
      const prevSupertrend = supertrend[i - 1]?.y;
      const currSupertrend = supertrend[i]?.y;
      const prevClose = data[i - 1].close;
      const currClose = data[i].close;
      const rsiValue = rsi[i]?.y || 50;
      if (prevClose < prevSupertrend && currClose > currSupertrend && rsiValue < 30) {
        signals.push({ x: data[i].timestamp, y: currClose, type: "Buy" });
      } else if (prevClose > prevSupertrend && currClose < currSupertrend && rsiValue > 70) {
        signals.push({ x: data[i].timestamp, y: currClose, type: "Sell" });
      }
    }
    return signals;
  }, []);

  const calculatePerformanceMetrics = useCallback((tokenData: TokenMetadata): PerformanceMetrics => {
    try {
      const priceChange = tokenData.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 };
      return {
        change_5m: priceChange.m5 || 0,
        change_1h: priceChange.h1 || 0,
        change_4h: priceChange.h6 || 0,
        change_24h: priceChange.h24 || 0,
      };
    } catch (err) {
      console.error("Performance metrics calculation error:", err);
      setError("Failed to calculate performance metrics. Using default values.");
      return { change_5m: 0, change_1h: 0, change_4h: 0, change_24h: 0 };
    }
  }, []);

  // Effects
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        const data = await res.json();
        setEthPrice(data.ethereum.usd);
      } catch (err) {
        console.error("Error fetching ETH price:", err);
        setEthPrice(3000);
      }
    };
    fetchEthPrice();
  }, []);

  useEffect(() => {
    const fetchTrendingTokens = async () => {
      try {
        setTrendingLoading(true);
        const res = await fetch("/api/trending-widget", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch trending tokens");
        const data = await res.json();
        setTrendingTokens(data.slice(0, 10));
        setTrendingError(null);
      } catch (err) {
        console.error("Error fetching trending tokens:", err);
        setTrendingError("Failed to load trending tokens");
      } finally {
        setTrendingLoading(false);
      }
    };
    fetchTrendingTokens();
    const interval = setInterval(fetchTrendingTokens, 300_000);
    return () => clearInterval(interval);
  }, []);

  const fetchTransactionsFromAlchemy = useCallback(
    async (pairAddress: string, pageKey: string | null = null) => {
      try {
        const ALCHEMY_API_URL =
          process.env.NEXT_PUBLIC_ALCHEMY_API_URL ||
          "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
        const requestBody = {
          id: 1,
          jsonrpc: "2.0",
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromBlock: "0x0",
              toBlock: "latest",
              toAddress: pairAddress,
              category: ["external", "erc20"],
              withMetadata: true,
              maxCount: "0x" + transactionLimit.toString(16),
              order: "desc",
              ...(pageKey && { pageKey }),
            },
          ],
        };
        const response = await fetch(ALCHEMY_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) throw new Error("Failed to fetch transactions from Alchemy");
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const transfers = data.result.transfers || [];
        const newPageKey = data.result.pageKey || null;
        const filteredTransfers = transfers.filter(
          (transfer: any) => transfer.from.toLowerCase() !== transfer.to.toLowerCase()
        );
        const transactions: Transaction[] = filteredTransfers.map((transfer: any) => {
          const isErc20 = transfer.category === "erc20";
          let tokenAmount: number = 0;
          let value: string = "0";
          let decimals = 18;
          try {
            if (isErc20 && transfer.value) {
              tokenAmount = parseFloat(transfer.value) || 0;
              value = BigInt(Math.round(tokenAmount * 1e18)).toString();
              decimals = transfer.rawContract?.decimal ? parseInt(transfer.rawContract.decimal, 16) : 18;
            } else if (transfer.value) {
              value = BigInt(Math.round(transfer.value * 1e18)).toString();
              tokenAmount = parseFloat(transfer.value) || 0;
            }
          } catch (err) {
            console.error(`Error parsing transaction value for hash ${transfer.hash}:`, err);
            tokenAmount = 0;
            value = "0";
          }
          return {
            id: transfer.hash,
            hash: transfer.hash,
            from: transfer.from,
            to: transfer.to,
            value,
            tokenAmount,
            timestamp: new Date(transfer.metadata.blockTimestamp).getTime(),
            blockNumber: parseInt(transfer.blockNum, 16),
            tokenSymbol: transfer.asset || "ETH",
            decimals,
          };
        });
        return { transactions, newPageKey };
      } catch (err) {
        console.error("Error fetching transactions from Alchemy:", err);
        setError(`Failed to load transactions: ${err instanceof Error ? err.message : "Unknown error"}`);
        return { transactions: [], newPageKey: null };
      }
    },
    []
  );

  const loadMoreTransactions = useCallback(async () => {
    if (transactionLoading || !hasMoreTransactions || !token || !isUserScrolling) return;
    setTransactionLoading(true);
    try {
      const { transactions: newTransactions, newPageKey } = await fetchTransactionsFromAlchemy(
        token.pairAddress,
        pageKey
      );
      if (newTransactions.length > 0) {
        setTransactions((prev) => {
          const existingIds = new Set(prev.map((tx) => tx.id));
          const filteredNewTransactions = newTransactions.filter((tx) => !existingIds.has(tx.id));
          return [...prev, ...filteredNewTransactions];
        });
        setPageKey(newPageKey);
        setHasMoreTransactions(newTransactions.length === transactionLimit);
      } else {
        setHasMoreTransactions(false);
      }
    } catch (err) {
      console.error("Error loading more transactions:", err);
    } finally {
      setTransactionLoading(false);
    }
  }, [transactionLoading, hasMoreTransactions, token, pageKey, fetchTransactionsFromAlchemy, isUserScrolling]);

  useEffect(() => {
    if (!token || !poolAddress || initialLoading) return;
    const loadInitialTransactions = async () => {
      setTransactionLoading(true);
      try {
        const { transactions: alchemyTransactions, newPageKey } = await fetchTransactionsFromAlchemy(
          token.pairAddress
        );
        setTransactions(alchemyTransactions);
        setPageKey(newPageKey);
        setHasMoreTransactions(alchemyTransactions.length === transactionLimit);
      } catch (err) {
        console.error("Error loading initial transactions:", err);
      } finally {
        setTransactionLoading(false);
      }
    };
    loadInitialTransactions();
  }, [token, poolAddress, initialLoading, fetchTransactionsFromAlchemy]);

  useEffect(() => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreTransactions && isUserScrolling) {
          loadMoreTransactions();
        }
      },
      { threshold: 0.1 }
    );
    if (lastTransactionRef.current) {
      observer.current.observe(lastTransactionRef.current);
    }
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [hasMoreTransactions, loadMoreTransactions, isUserScrolling]);

  useEffect(() => {
    const handleScroll = () => {
      setIsUserScrolling(true);
    };

    const container = transactionContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  useEffect(() => {
    if (!token?.pairAddress || initialLoading || !ethPrice) return;
    const wsUrl = "wss://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
    const ws = new WebSocket(wsUrl);
    let transactionBuffer: Transaction[] = [];
    let chartBuffer: { candle: any; line: IndicatorData }[] = [];
    const bufferTimeout = 500;
    let bufferTimer: NodeJS.Timeout | null = null;

    const fetchTransactionDetails = async (txHash: string) => {
      try {
        const requestBody = {
          id: 1,
          jsonrpc: "2.0",
          method: "eth_getTransactionByHash",
          params: [txHash],
        };
        const response = await fetch(wsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        if (data.result) {
          const tx = data.result;
          const isErc20 =
            tx.to?.toLowerCase() === token.pairAddress.toLowerCase() &&
            tx.input &&
            tx.input.startsWith("0xa9059cbb");
          let tokenAmount: number = 0;
          let value: string = "0";
          let decimals = 18;
          try {
            if (isErc20) {
              tokenAmount = parseFloat(token.priceUsd) || 0;
              value = BigInt(Math.round(tokenAmount * 1e18)).toString();
              decimals = token.baseToken.symbol === "ETH" ? 18 : 18;
            } else if (tx.value) {
              value = tx.value;
              tokenAmount = parseFloat(tx.value) / 1e18 || 0;
            }
          } catch (err) {
            console.error(`Error parsing transaction value for hash ${tx.hash}:`, err);
            tokenAmount = 0;
            value = "0";
          }
          const newTransaction: Transaction = {
            id: tx.hash,
            hash: tx.hash,
            from: tx.from,
            to: tx.to || token.pairAddress,
            value,
            tokenAmount,
            timestamp: Date.now(),
            blockNumber: parseInt(tx.blockNumber || "0", 16),
            tokenSymbol: isErc20 ? token.baseToken.symbol : "ETH",
            decimals,
          };
          transactionBuffer.push(newTransaction);

          const tokenPriceInUsd = token?.priceUsd ? parseFloat(token.priceUsd) : 0;
          const timestamp = newTransaction.timestamp;
          const newLinePoint = { x: timestamp, y: tokenPriceInUsd };
          const newCandle = {
            x: new Date(timestamp),
            y: [tokenPriceInUsd, tokenPriceInUsd, tokenPriceInUsd, tokenPriceInUsd],
          };
          chartBuffer.push({ candle: newCandle, line: newLinePoint });
        }
      } catch (err) {
        console.error("Error fetching transaction details:", err);
      }
    };

    const processBuffer = () => {
      if (transactionBuffer.length === 0 && chartBuffer.length === 0) return;

      if (transactionBuffer.length > 0) {
        transactionBuffer = transactionBuffer.filter((tx) => tx.from.toLowerCase() !== tx.to.toLowerCase());
        if (transactionBuffer.length > 0) {
          setTransactions((prev) => {
            const existingIds = new Set(prev.map((tx) => tx.id));
            const filteredNewTransactions = transactionBuffer.filter((tx) => !existingIds.has(tx.id));
            return [...filteredNewTransactions, ...prev];
          });
        }
        transactionBuffer = [];
      }

      if (chartBuffer.length > 0) {
        setLineData((prev) => {
          const newData = [...prev, ...chartBuffer.map((item) => item.line)].slice(-300);
          return newData;
        });
        setCandleData((prev) => {
          const newData = [...prev, ...chartBuffer.map((item) => item.candle)].slice(-300);
          const newOhlcvList = newData.map((d) => ({
            timestamp: d.x.getTime(),
            open: d.y[0],
            high: d.y[1],
            low: d.y[2],
            close: d.y[3],
            volume: 0,
          }));
          const supertrendValues = calculateSupertrend(newOhlcvList);
          setSupertrendData(supertrendValues);

          const totalSupply =
            token?.marketCap && token?.priceUsd ? token.marketCap / parseFloat(token.priceUsd) : 0;
          setMarketCapData((prev) => {
            const newMarketCapData = newData.map((d) => ({
              x: d.x,
              y: d.y.map((val: number) => val * totalSupply),
            }));
            return newMarketCapData.slice(-300);
          });

          return newData;
        });
        chartBuffer = [];
      }

      setLastUpdated(new Date().toLocaleString());
      setIsUserScrolling(false);
    };

    ws.onopen = () => {
      console.log("Alchemy WebSocket connected");
      const subscription = {
        id: 1,
        jsonrpc: "2.0",
        method: "eth_subscribe",
        params: ["newHeads"],
      };
      ws.send(JSON.stringify(subscription));
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.method === "eth_subscription" && data.params?.result) {
          const blockHash = data.params.result.hash;
          const blockRequest = {
            id: 2,
            jsonrpc: "2.0",
            method: "eth_getBlockByHash",
            params: [blockHash, true],
          };
          const response = await fetch(wsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(blockRequest),
          });
          const blockData = await response.json();
          if (blockData.result && blockData.result.transactions) {
            const { transactions: txs } = blockData.result;
            const relevantTxs = txs.filter(
              (tx: any) =>
                tx.from.toLowerCase() === token?.pairAddress.toLowerCase() ||
                tx.to?.toLowerCase() === token?.pairAddress.toLowerCase()
            );
            for (const tx of relevantTxs) {
              await fetchTransactionDetails(tx.hash);
            }
            if (bufferTimer) clearTimeout(bufferTimer);
            bufferTimer = setTimeout(processBuffer, bufferTimeout);
          }
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("Geckoterminal WebSocket error:", err);
      setError("Real-time updates unavailable.");
    };

    ws.onclose = () => {
      console.log("Alchemy WebSocket closed");
    };

    return () => {
      ws.close();
      if (bufferTimer) clearTimeout(bufferTimer);
    };
  }, [token, initialLoading, ethPrice, calculateSupertrend]);

  const fetchTokenData = useCallback(async (poolAddress: string) => {
    try {
      const dexScreenerRes = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/base/${poolAddress}`,
        { cache: "no-store" }
      );
      if (!dexScreenerRes.ok) throw new Error("Failed to fetch token data from DexScreener");
      const dexScreenerData = await dexScreenerRes.json();
      if (!dexScreenerData.pairs || dexScreenerData.pairs.length === 0)
        throw new Error("No token data found");

      const pair = dexScreenerData.pairs[0];
      let logoUrl = pair.baseToken?.image || pair.info?.image || "https://i.imgur.com/NWLAQXV.jpeg";
      let bannerUrl = pair.info?.image || pair.baseToken?.image || "https://i.imgur.com/NWLAQXV.jpeg";
      let adImageUrl = "";

      try {
        const tokenDocRef = doc(db as any, "tokens", poolAddress);
        const tokenDoc = await getDoc(tokenDocRef);
        if (tokenDoc.exists()) {
          const data = tokenDoc.data();
          logoUrl = data.logoUrl && data.logoUrl !== "https://i.imgur.com/suFIyxm.png";
          bannerUrl = data.bannerUrl && data.bannerUrl !== "https://i.imgur.com/suFIyxm.png";
          adImageUrl = data.adImageUrl && data.adImageUrl !== "https://i.imgur.com/suFIyxm.png";
        }
      } catch (err) {
        console.error("Error fetching images from Firebase:", err);
      }

      const newMetadata: TokenMetadata = {
        poolAddress: poolAddress,
        pairAddress: pair.pairAddress || poolAddress,
        baseToken: {
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          address: pair.baseToken.address,
        },
        quoteToken: {
          name: pair.quoteToken.name,
          symbol: pair.quoteToken.symbol,
          address: pair.quoteToken.address || "0x4200000000000000000000000000000000000006",
        },
        priceUsd: pair.priceUsd,
        liquidity: { usd: pair.liquidity?.usd || 0 },
        marketCap: pair.marketCap || 0,
        fdv: pair.fdv || 0,
        bannerUrl,
        logoUrl,
        adImageUrl,
        priceChange: {
          m5: pair.priceChange?.m5 || 0,
          h1: pair.priceChange?.h1 || 0,
          h6: pair.priceChange?.h6 || 0,
          h24: pair.priceChange?.h24 || 0,
        },
      };

      setToken(newMetadata);
      setLastUpdated(new Date().toLocaleString());
      setError(null);
      return newMetadata;
    } catch (err: any) {
      setError(`Failed to load token data: ${err.message}`);
      throw err;
    }
  }, []);

  const fetchChartData = useCallback(
    async (poolAddress: string, tokenData: TokenMetadata) => {
      try {
        setInitialLoading(true);
        const timeframeMap: { [key: string]: { timeframe: string; aggregate: string } } = {
          "1m": { timeframe: "minute", aggregate: "1" },
          "5m": { timeframe: "minute", aggregate: "5" },
          "15m": { timeframe: "minute", aggregate: "15" },
          "1h": { timeframe: "hour", aggregate: "1" },
          "4h": { timeframe: "hour", aggregate: "4" },
          "12h": { timeframe: "hour", aggregate: "12" },
          "1d": { timeframe: "day", aggregate: "1" },
        };
        const { timeframe: timeframeParam, aggregate } = timeframeMap[timeframe] || timeframeMap["1h"];
        const url = `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddress}/ohlcv/${timeframeParam}?aggregate=${aggregate}&limit=300`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch chart data");
        const data = await res.json();
        if (!data.data || !data.data.attributes || !data.data.attributes.ohlcv_list)
          throw new Error("No chart data returned");
        const ohlcvList: OHLCVData[] = data.data.attributes.ohlcv_list.map(
          ([timestamp, open, high, low, close, volume]: number[]) => ({
            timestamp: timestamp * 1000,
            open,
            high,
            low,
            close,
            volume,
          })
        );
        const downsampledOhlcvList = downsampleData(ohlcvList, 1);

        // Build candle data
        const newPriceData = downsampledOhlcvList.map((d: OHLCVData) => ({
          x: new Date(d.timestamp),
          y: [d.open, d.high, d.low, d.close],
        }));
        setCandleData(newPriceData);

        // Build line data
        const newLineData = downsampledOhlcvList.map((d: OHLCVData) => ({
          x: d.timestamp,
          y: d.close,
        }));
        setLineData(newLineData);

        // Build market cap data
        const newMarketCapData = downsampledOhlcvList.map((d: OHLCVData) => {
          const pricePerToken = parseFloat(tokenData.priceUsd || "0");
          const totalSupply = pricePerToken ? (tokenData.marketCap || 0) / pricePerToken : 0;
          return {
            x: new Date(d.timestamp),
            y: [d.open * totalSupply, d.high * totalSupply, d.low * totalSupply, d.close * totalSupply],
          };
        });
        setMarketCapData(newMarketCapData);

        // Build volume data
        const newVolumeData = downsampledOhlcvList.map((d: OHLCVData) => ({
          x: d.timestamp,
          y: d.volume,
        }));
        setVolumeData(newVolumeData);

        // SMA calculations
        const smaPeriod20 = 20;
        const smaPeriod50 = 50;
        const sma20Values: IndicatorData[] = [];
        const sma50Values: IndicatorData[] = [];
        for (let i = smaPeriod50 - 1; i < downsampledOhlcvList.length; i++) {
          if (i >= smaPeriod20 - 1) {
            const sma20Slice: OHLCVData[] = downsampledOhlcvList.slice(i - smaPeriod20 + 1, i + 1);
            const avg20: number = sma20Slice.reduce((sum: number, d: OHLCVData) => sum + d.close, 0) / smaPeriod20;
            sma20Values.push({ x: downsampledOhlcvList[i].timestamp, y: avg20 });
          }
          const sma50Slice: OHLCVData[] = downsampledOhlcvList.slice(i - smaPeriod50 + 1, i + 1);
          const avg50: number = sma50Slice.reduce((sum: number, d: OHLCVData) => sum + d.close, 0) / smaPeriod50;
          sma50Values.push({ x: downsampledOhlcvList[i].timestamp, y: avg50 });
        }
        setSma20Data(sma20Values);
        setSma50Data(sma50Values);

        // Detect SMA crossovers
        const crossovers: { x: number; y: number; type: "Golden Cross" | "Death Cross" }[] = [];
        for (let i = 1; i < sma20Values.length; i++) {
          const prevSma20 = sma20Values[i - 1].y;
          const currSma20 = sma20Values[i].y;
          const prevSma50 = sma50Values[i - 1].y;
          const currSma50 = sma50Values[i].y;
          if (prevSma20 <= prevSma50 && currSma20 > currSma50) {
            crossovers.push({ x: sma20Values[i].x, y: currSma20, type: "Golden Cross" });
          } else if (prevSma20 >= prevSma50 && currSma20 < currSma50) {
            crossovers.push({ x: sma20Values[i].x, y: currSma20, type: "Death Cross" });
          }
        }
        setSmaCrossovers(crossovers);

        // RSI calculations
        const rsiPeriod = 14;
        const rsiValues: IndicatorData[] = [];
        const changes: number[] = downsampledOhlcvList.slice(1).map((d, i) => d.close - downsampledOhlcvList[i].close);
        for (let i = rsiPeriod; i < changes.length; i++) {
          const rsiSlice: number[] = changes.slice(i - rsiPeriod, i);
          const gains: number =
            rsiSlice.filter((c: number) => c > 0).reduce((sum: number, c: number) => sum + c, 0) / rsiPeriod;
          const losses: number =
            Math.abs(rsiSlice.filter((c: number) => c < 0).reduce((sum: number, c: number) => sum + c, 0)) / rsiPeriod;
          const rs: number = gains / (losses || 1);
          const rsi: number = 100 - 100 / (1 + rs);
          rsiValues.push({ x: downsampledOhlcvList[i + 1].timestamp, y: rsi });
        }
        setRsiData(rsiValues);

        // MACD calculations
        const macdFast = 12,
          macdSlow = 26,
          macdSignal = 9;
        const ema = (data: number[], period: number): number[] => {
          const k: number = 2 / (period + 1);
          const emaValues: number[] = [];
          let emaValue: number = data.slice(0, period).reduce((sum: number, v: number) => sum + v, 0) / period;
          emaValues.push(emaValue);
          for (let i = period; i < data.length; i++) {
            emaValue = (data[i] - emaValue) * k + emaValue;
            emaValues.push(emaValue);
          }
          return emaValues;
        };
        const closes: number[] = downsampledOhlcvList.map((d) => d.close);
        const ema12: number[] = ema(closes, macdFast);
        const ema26: number[] = ema(closes, macdSlow);
        const macdLine: number[] = ema12.map((v, i) => v - (ema26[i] || 0)).slice(macdSlow - macdFast);
        const signalLine: number[] = ema(macdLine, macdSignal);
        const macdValues: MACDData[] = macdLine.slice(macdSignal - 1).map((macd, i) => ({
          x: downsampledOhlcvList[i + macdSlow - macdFast + macdSignal - 1].timestamp,
          macd,
          signal: signalLine[i],
          histogram: macd - signalLine[i],
        }));
        setMacdData(macdValues);

        // VWAP calculations & signals
        const vwapValues: IndicatorData[] = [];
        let cumulativePV = 0;
        let cumulativeVolume = 0;
        const vwapSignals: { x: number; y: number; type: "Buy" | "Sell" }[] = [];
        downsampledOhlcvList.forEach((d, index) => {
          const typicalPrice = (d.high + d.low + d.close) / 3;
          cumulativePV += typicalPrice * d.volume;
          cumulativeVolume += d.volume;
          const vwap = cumulativePV / (cumulativeVolume || 1);
          vwapValues.push({ x: d.timestamp, y: vwap });
          if (index > 0) {
            const prevClose = downsampledOhlcvList[index - 1].close;
            const prevVwap = vwapValues[index - 1].y;
            const prevVolume = downsampledOhlcvList[index - 1].volume;
            const currentVolume = d.volume;
            const volumeIncrease = prevVolume > 0 ? ((currentVolume - prevVolume) / prevVolume) * 100 : 0;
            if (prevClose < prevVwap && d.close > vwap && volumeIncrease >= 20) {
              vwapSignals.push({ x: d.timestamp, y: d.close, type: "Buy" });
            } else if (prevClose > prevVwap && d.close < vwap && volumeIncrease >= 20) {
              vwapSignals.push({ x: d.timestamp, y: d.close, type: "Sell" });
            }
          }
        });
        setVwapData(vwapValues);
        setVwapSignals(vwapSignals);

        // Supertrend
        const supertrendValues = calculateSupertrend(downsampledOhlcvList);
        setSupertrendData(supertrendValues);
        const supertrendSignals = calculateSupertrendSignals(downsampledOhlcvList, supertrendValues, rsiValues);
        setSupertrendSignals(supertrendSignals);

        // Performance metrics
        const metrics = calculatePerformanceMetrics(tokenData);
        setPerformanceMetrics(metrics);
      } catch (err: any) {
        setError(`Failed to load chart data: ${err.message}`);
      } finally {
        setInitialLoading(false);
      }
    },
    [timeframe, calculateSupertrend, calculateSupertrendSignals, calculatePerformanceMetrics]
  );

  useEffect(() => {
    if (!poolAddress || typeof poolAddress !== "string") return;
    let ws: WebSocket;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectInterval = 5000;
    const connectWebSocket = () => {
      ws = new WebSocket(`wss://api.geckoterminal.com/ws/pools/base/${poolAddress}`);
      ws.onopen = () => {
        console.log("Geckoterminal WebSocket connected");
        reconnectAttempts = 0;
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const parsedData = {
            ...data,
            price_usd: parseFloat(data.price_usd || "0"),
            market_cap_usd: parseFloat(data.market_cap_usd || "0"),
            liquidity_usd: parseFloat(data.liquidity_usd || "0"),
          };
          setToken((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              priceUsd: parsedData.price_usd.toString(),
              marketCap: parsedData.market_cap_usd,
              liquidity: { usd: parsedData.liquidity_usd },
            };
          });
          setLastUpdated(new Date().toLocaleString());
        } catch (err) {
          console.error("WebSocket parse error:", err);
        }
      };
      ws.onerror = (err) => {
        console.error("Geckoterminal WebSocket error:", err);
        setError("Real-time updates unavailable.");
      };
      ws.onclose = () => {
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts++;
            connectWebSocket();
          }, reconnectInterval * Math.pow(2, reconnectAttempts));
        } else {
          setError("Failed to reconnect WebSocket.");
        }
      };
    };
    connectWebSocket();
    return () => ws?.close();
  }, [poolAddress]);

  useEffect(() => {
    if (!poolAddress || typeof poolAddress !== "string") return;
    const refreshData = async () => {
      try {
        const tokenData = await fetchTokenData(poolAddress as string);
        if (tokenData) {
          await fetchChartData(poolAddress as string, tokenData);
        }
      } catch (err) {
        console.error("Periodic data refresh error:", err);
      }
    };
    const interval = setInterval(refreshData, 3 * 36 * 600);
    return () => clearInterval(interval);
  }, [poolAddress, fetchTokenData, fetchChartData]);

  useEffect(() => {
    if (!poolAddress || typeof poolAddress !== "string") {
      setError("Invalid or missing pool address.");
      setInitialLoading(false);
      return;
    }
    const loadData = async () => {
      setInitialLoading(true);
      try {
        const tokenData = await fetchTokenData(poolAddress);
        if (tokenData) {
          await fetchChartData(poolAddress, tokenData);
        }
      } catch (err) {
        console.error("Initial data load error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [poolAddress, fetchTokenData, fetchChartData]);

  // Chart Options
  const candlestickOptions = useMemo<ApexCharts.ApexOptions>(() => {
    const allData = chartView === "Price" ? candleData : marketCapData;
    const visibleCandleData = getVisibleData(allData);
    const yValues = visibleCandleData.flatMap((d: any) => d.y);
    const lowestLow = yValues.length ? Math.min(...yValues) : 0;
    const highestHigh = yValues.length ? Math.max(...yValues) : 0;
    const yPadding = (highestHigh - lowestLow) * 0.3;
    const yMin = lowestLow - yPadding;
    const yMax = highestHigh + yPadding;
    const xValues = allData.map((d: any) => d.x.getTime());
    const xMin = xValues.length ? Math.min(...xValues) : Date.now();
    const xMax = xValues.length ? Math.max(...xValues) : Date.now();
    const futurePadding = (xMax - xMin) * 0.2;
    const xMaxWithPadding = xMax + futurePadding;

    // Dynamic subtitle: current price or market cap
    const subtitleText =
      chartView === "Price"
        ? token
          ? `$${parseFloat(token.priceUsd).toFixed(4)}`
          : ""
        : token
        ? `${formatLargeNumber(token.marketCap)}`
        : "";

    return {
      chart: {
        type: "candlestick",
        height: isMounted && window.innerWidth < 768 ? 350 : 500,
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: {
          show: true,
          tools: {
            download: false,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
          autoSelected: "pan",
        },
        zoom: { enabled: true, type: "xy", autoScaleYaxis: true },
        events: {
          zoomed: throttle((_: any, { xaxis }: any) => {
            if (xaxis) setXAxisRange({ min: xaxis.min, max: xaxis.max });
          }, 500),
          scrolled: throttle((_: any, { xaxis }: any) => {
            if (xaxis) setXAxisRange({ min: xaxis.min, max: xaxis.max });
          }, 500),
        },
        animations: { enabled: false },
      },
      subtitle: {
        text: subtitleText,
        align: "right",
        style: { color: "#D1D1D6", fontSize: "12px", fontFamily: "Inter, sans-serif" },
      },
      title: {
        text: chartView,
        align: "left",
        style: {
          color: "#D1D1D6",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
        },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: {
          datetimeUTC: false,
          format: "HH:mm:ss",
          style: {
            colors: "#A1A1AA",
            fontSize: isMounted && window.innerWidth < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          rotate: 0,
          rotateAlways: false,
        },
        tickAmount: 6,
        title: {
          text: "Time",
          offsetY: 70,
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" },
        },
      },
      yaxis: {
        title: {
          text: chartView === "Price" ? "Price (USD)" : "Market Cap (USD)",
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" },
        },
        labels: {
          style: {
            colors: "#A1A1AA",
            fontSize: isMounted && window.innerWidth < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          formatter: (val: number) =>
            chartView === "Price" ? `$${val.toFixed(4)}` : `$${formatLargeNumber(val)}`,
        },
        tickAmount: 5,
        min: yMin,
        max: yMax,
      },
      grid: {
        borderColor: "#2A3B5A",
        opacity: 0.1,
        strokeDashArray: 0,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: true } },
      },
      plotOptions: {
        candlestick: {
          colors: { upward: "#10B981", downward: "#EF4444" },
          wick: { useFillColor: true },
          columnWidth: isMounted && window.innerWidth < 768 ? "30%" : "20%",
        },
      },
      annotations: {
        points: supertrendSignals.map((signal) => ({
          x: signal.x,
          y: signal.y,
          marker: { size: 6, fillColor: signal.type === "Buy" ? "#10B981" : "#EF4444" },
          label: {
            text: signal.type,
            style: {
              color: "#000000",
              background: signal.type === "Buy" ? "#10B981" : "#EF4444",
              fontSize: "10px",
              fontFamily: "Inter, sans-serif",
            },
          },
        })),
      },
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "HH:mm:ss" },
        y: {
          formatter: (val: number) =>
            chartView === "Price" ? `$${val.toFixed(4)}` : `$${formatLargeNumber(val)}`,
        },
        style: { fontFamily: "Inter, sans-serif" },
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
          const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
          const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
          const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
          const time = new Date(w.globals.seriesX[seriesIndex][dataPointIndex]).toLocaleTimeString();
          const formatter =
            chartView === "Price"
              ? (val: number) => `$${val.toFixed(4)}`
              : (val: number) => `$${formatLargeNumber(val)}`;
          return `
            <div class="p-2 bg-[#1A263F] rounded-lg shadow-lg">
              <p class="text-sm text-gray-100"><span class="text-gray-400">Time:</span> ${time}</p>
              <p class="text-sm text-gray-100"><span class="text-gray-400">Open:</span> ${formatter(
                o
              )}</p>
              <p class="text-sm text-gray-100"><span class="text-gray-400">High:</span> ${formatter(
                h
              )}</p>
              <p class="text-sm text-gray-100"><span class="text-gray-400">Low:</span> ${formatter(
                l
              )}</p>
              <p class="text-sm text-gray-100"><span class="text-gray-400">Close:</span> ${formatter(
                c
              )}</p>
            </div>
          `;
        },
      },
      markers: { size: 0 },
      crosshair: {
        show: true,
        x: {
          show: true,
          stroke: {
            color: "#A1A1AA",
            width: 1,
            dashArray: 5,
          },
        },
        y: {
          show: true,
          stroke: {
            color: "#A1A1AA",
            width: 1,
            dashArray: 5,
          },
        },
      },
    };
  }, [
    chartView,
    timeframe,
    xAxisRange,
    supertrendSignals,
    candleData,
    marketCapData,
    isMounted,
    token,
  ]);

  const lineOptions = useMemo<ApexCharts.ApexOptions>(() => {
    const allData = lineData;
    const visibleLineData = getVisibleData(allData);
    const yValues = visibleLineData.map((d: any) => d.y);
    const lowestLow = yValues.length ? Math.min(...yValues) : 0;
    const highestHigh = yValues.length ? Math.max(...yValues) : 0;
    const yPadding = (highestHigh - lowestLow) * 0.3;
    const yMin = lowestLow - yPadding;
    const yMax = highestHigh + yPadding;
    const xValues = allData.map((d: any) => d.x);
    const xMin = xValues.length ? Math.min(...xValues) : Date.now();
    const xMax = xValues.length ? Math.max(...xValues) : Date.now();
    const futurePadding = (xMax - xMin) * 0.2;
    const xMaxWithPadding = xMax + futurePadding;

    // Dynamic subtitle: current price
    const subtitleText =
      token && chartView === "Price"
        ? `$${parseFloat(token.priceUsd).toFixed(4)}`
        : "";

    return {
      chart: {
        type: "line",
        height: isMounted && window.innerWidth < 768 ? 350 : 500,
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: {
          show: true,
          tools: {
            download: false,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
          autoSelected: "pan",
        },
        zoom: { enabled: true, type: "xy", autoScaleYaxis: true },
        events: {
          zoomed: throttle((_: any, { xaxis }: any) => {
            if (xaxis) setXAxisRange({ min: xaxis.min, max: xaxis.max });
          }, 500),
          scrolled: throttle((_: any, { xaxis }: any) => {
            if (xaxis) setXAxisRange({ min: xaxis.min, max: xaxis.max });
          }, 500),
        },
        animations: { enabled: false },
      },
      subtitle: {
        text: subtitleText,
        align: "right",
        style: { color: "#D1D1D6", fontSize: "12px", fontFamily: "Inter, sans-serif" },
      },
      title: {
        text: "Price (Line)",
        align: "left",
        style: {
          color: "#D1D1D6",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
        },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: {
          datetimeUTC: false,
          format: "HH:mm:ss",
          style: {
            colors: "#A1A1AA",
            fontSize: isMounted && window.innerWidth < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          rotate: 0,
          rotateAlways: false,
        },
        tickAmount: 6,
        title: {
          text: "Time",
          offsetY: 70,
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" },
        },
      },
      yaxis: {
        title: {
          text: "Price (USD)",
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" },
        },
        labels: {
          style: {
            colors: "#A1A1AA",
            fontSize: isMounted && window.innerWidth < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          formatter: (val: number) => `$${val.toFixed(4)}`,
        },
        tickAmount: 5,
        min: yMin,
        max: yMax,
      },
      grid: {
        borderColor: "#2A3B5A",
        opacity: 0.1,
        strokeDashArray: 0,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: true } },
      },
      stroke: { curve: "smooth", width: 2 },
      colors: ["#3B82F6"],
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "HH:mm:ss" },
        y: { formatter: (val: number) => `$${val.toFixed(4)}` },
        style: { fontFamily: "Inter, sans-serif" },
      },
      markers: { size: 0 },
      crosshair: {
        show: true,
        x: {
          show: true,
          stroke: {
            color: "#A1A1AA",
            width: 1,
            dashArray: 5,
          },
        },
        y: {
          show: true,
          stroke: {
            color: "#A1A1AA",
            width: 1,
            dashArray: 5,
          },
        },
      },
    };
  }, [timeframe, xAxisRange, lineData, isMounted, token, chartView]);

  const volumeOptions = useMemo<ApexCharts.ApexOptions>(() => {
    return {
      chart: {
        type: "bar",
        height: isMounted && window.innerWidth < 768 ? 150 : 250,
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: false },
      },
      title: {
        text: "Volume",
        align: "left",
        style: {
          color: "#D1D1D6",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
        },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : undefined,
        max: xAxisRange ? xAxisRange.max : undefined,
        labels: { show: false },
        tickAmount: isMounted && window.innerWidth < 768 ? 6 : 8,
      },
      yaxis: {
        title: { text: "Volume", style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => formatLargeNumber(val),
        },
        tickAmount: 3,
      },
      dataLabels: { enabled: false },
      colors: ["#A855F7"],
      plotOptions: {
        bar: {
          columnWidth: isMounted && window.innerWidth < 768 ? "30%" : "50%",
        },
      },
      fill: { type: "solid", opacity: 0.8 },
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "HH:mm:ss" },
        y: {
          formatter: (val: number) => {
            const pricePerToken = parseFloat(token?.priceUsd || "0");
            const volumeUsd = val * pricePerToken;
            return `$${formatLargeNumber(volumeUsd)}`;
          },
        },
        style: { fontFamily: "Inter, sans-serif" },
      },
      grid: {
        borderColor: "#2A3B5A",
        opacity: 0.1,
      },
      crosshair: {
        show: true,
        x: {
          show: true,
          stroke: { color: "#A1A1AA", width: 1, dashArray: 5 },
        },
        y: { show: true, stroke: { color: "#A1A1AA", width: 1, dashArray: 5 } },
      },
    };
  }, [xAxisRange, token, isMounted]);

  const smaOptions = useMemo<ApexCharts.ApexOptions>(() => {
    return {
      chart: {
        type: "line",
        height: isMounted && window.innerWidth < 768 ? 150 : 250,
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: false },
      },
      title: {
        text: "SMA (20 & 50)",
        align: "left",
        style: {
          color: "#D1D1D6",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
        },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : undefined,
        max: xAxisRange ? xAxisRange.max : undefined,
        labels: { show: false },
      },
      yaxis: {
        title: { text: "SMA", style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          offsetX: -15,
          style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => val.toFixed(2),
        },
        tickAmount: 6,
      },
      stroke: { curve: "smooth", width: 2 },
      colors: ["#FBBF24", "#F87171"],
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "HH:mm:ss" },
        y: { formatter: (val: number) => val.toFixed(2) },
        style: { fontFamily: "Inter, sans-serif" },
      },
      annotations: {
        points: smaCrossovers.map((crossover) => ({
          x: crossover.x,
          y: crossover.y,
          marker: {
            size: 6,
            fillColor: crossover.type === "Golden Cross" ? "#10B981" : "#EF4444",
          },
          label: {
            text: crossover.type,
            style: {
              color: "#000000",
              background: crossover.type === "Golden Cross" ? "#10B981" : "#EF4444",
              fontSize: "10px",
              fontFamily: "Inter, sans-serif",
            },
          },
        })),
      },
      grid: {
        borderColor: "#2A3B5A",
        opacity: 0.1,
      },
      crosshair: {
        show: true,
        x: {
          show: true,
          stroke: { color: "#A1A1AA", width: 1, dashArray: 5 },
        },
        y: { show: true, stroke: { color: "#A1A1AA", width: 1, dashArray: 5 } },
      },
    };
  }, [xAxisRange, smaCrossovers, isMounted]);

  const rsiOptions = useMemo<ApexCharts.ApexOptions>(() => {
    return {
      chart: {
        id: "rsi-chart",
        height: isMounted && window.innerWidth < 768 ? 150 : 250,
        type: "line",
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: false },
      },
      title: {
        text: "RSI",
        align: "left",
        style: {
          color: "#D1D1D6",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
        },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : undefined,
        max: xAxisRange ? xAxisRange.max : undefined,
        labels: { show: false },
      },
      yaxis: {
        min: 0,
        max: 100,
        title: { text: "RSI", style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          offsetX: -15,
          style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => val.toFixed(0),
        },
        tickAmount: 5,
      },
      stroke: { curve: "smooth", width: 2 },
      colors: ["#3B82F6"],
      grid: {
        borderColor: "#2A3B5A",
        opacity: 0.1,
      },
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "HH:mm:ss" },
        y: { formatter: (val: number) => val.toFixed(2) },
        style: { fontFamily: "Inter, sans-serif" },
      },
      crosshair: {
        show: true,
        x: {
          show: true,
          stroke: { color: "#A1A1AA", width: 1, dashArray: 5 },
        },
        y: { show: true, stroke: { color: "#A1A1AA", width: 1, dashArray: 5 } },
      },
    };
  }, [xAxisRange, isMounted]);

  const macdOptions = useMemo<ApexCharts.ApexOptions>(() => {
    return {
      chart: {
        id: "macd-chart",
        height: isMounted && window.innerWidth < 768 ? 150 : 250,
        type: "line",
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: false },
      },
      title: {
        text: "MACD",
        align: "left",
        style: {
          color: "#D1D1D6",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
        },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : undefined,
        max: xAxisRange ? xAxisRange.max : undefined,
        labels: { show: false },
      },
      yaxis: {
        title: { text: "MACD", style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          offsetX: -15,
          style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => val.toFixed(2),
        },
        tickAmount: 5,
      },
      stroke: { curve: "smooth", width: 2 },
      colors: ["#3B82F6", "#F97316", "#10B981"],
      grid: {
        borderColor: "#2A3B5A",
        opacity: 0.1,
      },
      plotOptions: {
        bar: { columnWidth: "80%" },
      },
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "HH:mm:ss" },
        y: { formatter: (val: number) => val.toFixed(2) },
        style: { fontFamily: "Inter, sans-serif" },
      },
      crosshair: {
        show: true,
        x: {
          show: true,
          stroke: { color: "#A1A1AA", width: 1, dashArray: 5 },
        },
        y: { show: true, stroke: { color: "#A1A1AA", width: 1, dashArray: 5 } },
      },
    };
  }, [xAxisRange, isMounted]);

  const vwapOptions = useMemo<ApexCharts.ApexOptions>(() => {
    return {
      chart: {
        type: "line",
        height: isMounted && window.innerWidth < 768 ? 150 : 250,
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: false },
      },
      title: {
        text: "VWAP",
        align: "left",
        style: {
          color: "#D1D1D6",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
        },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : undefined,
        max: xAxisRange ? xAxisRange.max : undefined,
        labels: { show: false },
      },
      yaxis: {
        title: { text: "VWAP", style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          offsetX: -15,
          style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => val.toFixed(2),
        },
        tickAmount: 6,
      },
      stroke: { curve: "smooth", width: 2 },
      colors: ["#F97316"],
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "HH:mm:ss" },
        y: { formatter: (val: number) => val.toFixed(2) },
        style: { fontFamily: "Inter, sans-serif" },
      },
      annotations: {
        points: vwapSignals.map((signal) => ({
          x: signal.x,
          y: signal.y,
          marker: { size: 6, fillColor: signal.type === "Buy" ? "#10B981" : "#EF4444" },
          label: {
            text: signal.type,
            style: {
              color: "#000000",
              background: signal.type === "Buy" ? "#10B981" : "#EF4444",
              fontSize: "10px",
              fontFamily: "Inter, sans-serif",
            },
          },
        })),
      },
      grid: {
        borderColor: "#2A3B5A",
        opacity: 0.1,
      },
      crosshair: {
        show: true,
        x: {
          show: true,
          stroke: { color: "#A1A1AA", width: 1, dashArray: 5 },
        },
        y: { show: true, stroke: { color: "#A1A1AA", width: 1, dashArray: 5 } },
      },
    };
  }, [xAxisRange, vwapSignals, isMounted]);

  const supertrendOptions = useMemo<ApexCharts.ApexOptions>(() => {
    const bullishData: IndicatorData[] = [];
    const bearishData: IndicatorData[] = [];
    let currentBullish: IndicatorData[] = [];
    let currentBearish: IndicatorData[] = [];
    supertrendData.forEach((point, index) => {
      const dataPoint = { xI: true, x: point.x, y: point.y };
      if (point.trend === "Bullish") {
        if (currentBearish.length > 0) {
          bearishData.push(...currentBearish);
          currentBearish = [];
        }
        currentBullish.push(dataPoint);
      } else {
        if (currentBullish.length > 0) {
          bullishData.push(...currentBullish);
          currentBullish = [];
        }
        currentBearish.push(dataPoint);
      }
      if (index === supertrendData.length - 1) {
        if (currentBullish.length > 0) bullishData.push(...currentBullish);
        if (currentBearish.length > 0) bearishData.push(...currentBearish);
      }
    });
    return {
      chart: {
        type: "line",
        height: isMounted && window.innerWidth < 768 ? 150 : 250,
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: false },
      },
      title: {
        text: "Supertrend",
        align: "left",
        style: {
          color: "#D1D1D6",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
        },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : undefined,
        max: xAxisRange ? xAxisRange.max : undefined,
        labels: { show: false },
      },
      yaxis: {
        title: { text: "Price", style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          offsetX: -15,
          style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => val.toFixed(2),
        },
        tickAmount: 6,
      },
      stroke: { curve: "smooth", width: 2 },
      colors: ["#10B981", "#EF4444"],
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "HH:mm:ss" },
        custom: ({ dataPointIndex }: any) => {
          const supertrend = supertrendData[dataPointIndex];
          return `
            <div class="p-2 bg-[#1A263F] rounded-lg shadow-lg">
              <p class="text-sm font-semibold text-gray-100"><span class="text-gray-400">Price:</span> $${supertrend.y.toFixed(
                2
              )}</p>
              <p class="text-sm text-gray-100"><span class="text-gray-400">Trend:</span> <span class="${
                supertrend.trend === "Bullish" ? "text-green-400" : "text-red-400"
              }">${supertrend.trend}</span></p>
              <p class="text-sm text-gray-100"><span class="text-gray-400">Signal Strength:</span> ${supertrend.signalStrength.toFixed(
                2
              )}</p>
              <p class="text-sm text-gray-100"><span class="text-gray-400">Action:</span> ${supertrend.action}</p>
            </div>
          `;
        },
        style: { fontFamily: "Inter, sans-serif" },
      },
      series: [
        { name: "Supertrend (Bullish)", data: bullishData },
        { name: "Supertrend (Bearish)", data: bearishData },
      ],
      grid: {
        borderColor: "#2A3B5A",
        opacity: 0.1,
      },
      crosshair: {
        show: true,
        x: {
          show: true,
          stroke: { color: "#A1A1AA", width: 1, dashArray: 5 },
        },
        y: { show: true, stroke: { color: "#A1A1AA", width: 1, dashArray: 5 } },
      },
    };
  }, [xAxisRange, supertrendData, isMounted]);

  // Ensure the component only renders after mounting to avoid SSR issues
  if (!isMounted) {
    return null;
  }

  // Calculate OHLC for the latest candle
  const latestCandle = candleData[candleData.length - 1];
  const ohlc = latestCandle
    ? {
        open: latestCandle.y[0].toFixed(4),
        high: latestCandle.y[1].toFixed(4),
        low: latestCandle.y[2].toFixed(4),
        close: latestCandle.y[3].toFixed(4),
      }
    : { open: "-", high: "-", low: "-", close: "-" };

  // Construct SYMBOL for branding overlay
  const symbol = token ? `${token.baseToken.symbol}/${token.quoteToken.symbol}` : "Loading...";

  // Utility functions for trend analysis and sparkline
  const getSparklineData = () => {
    return lineData.slice(-50).map((d) => d.y);
  };

  const getTrendAnalysis = () => {
    const latestSupertrend = supertrendData[supertrendData.length - 1];
    const latestRsi = rsiData[rsiData.length - 1];
    const latestSmaCrossover = smaCrossovers[smaCrossovers.length - 1];

    const insights: TrendInsight[] = [];
    if (latestSupertrend) {
      insights.push({
        text: `Supertrend indicates a ${latestSupertrend.trend} trend with a signal strength of ${latestSupertrend.signalStrength.toFixed(
          2
        )}. Suggested action: ${latestSupertrend.action}.`,
        trend: latestSupertrend.trend,
      });
    }
    if (latestRsi) {
      const rsiStatus = latestRsi.y > 70 ? "Overbought" : latestRsi.y < 30 ? "Oversold" : "Neutral";
      insights.push({
        text: `RSI is at ${latestRsi.y.toFixed(2)} (${rsiStatus}).`,
        rsiStatus,
      });
    }
    if (latestSmaCrossover) {
      insights.push({
        text: `Latest SMA Crossover: ${latestSmaCrossover.type} at ${new Date(
          latestSmaCrossover.x
        ).toLocaleString()}.`,
        crossoverType: latestSmaCrossover.type,
      });
    }
    return insights.length > 0 ? insights : [{ text: "No trend analysis available." }];
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        toast.error("Failed to copy to clipboard.");
      });
  };

  // JSX Return Statement
  return (
    <div className="min-h-screen font-sans bg-gray-950 text-gray-200 w-full">
      <style jsx>{`
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.5;
          }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        .pulse {
          animation: pulse 1.5s infinite ease-in-out;
        }
        .tooltip {
          position: relative;
          display: inline-block;
        }
        .tooltip .tooltiptext {
          visibility: hidden;
          width: 120px;
          background-color: #2a3b5a;
          color: #d1d1d6;
          text-align: center;
          border-radius: 4px;
          padding: 5px;
          position: absolute;
          z-index: 1;
          bottom: 125%;
          left: 50%;
          margin-left: -60px;
          opacity: 0;
          transition: opacity 0.3s;
          font-size: 10px;
        }
        .tooltip:hover .tooltiptext {
          visibility: visible;
          opacity: 1;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #3b82f6 #0d1a2e;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0d1a2e;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #3b82f6;
          border-radius: 4px;
          border: 2px solid #0d1a2e;
        }
        .custom-scrollbar-x-none {
          overflow-x: hidden; /* Remove horizontal scrollbar */
        }
        .transaction-table-container {
          max-height: 300px;
          overflow-y: auto;
          position: relative;
        }
        .transaction-table-container.loading {
          min-height: 300px; /* Ensure space for loading indicator */
        }
        .trending-banner {
          background-color: #0d1a2e;
          border-bottom: 1px solid #2a3b5a;
          padding: 0;
          overflow: hidden;
          white-space: nowrap;
          width: 100%;
          position: relative;
          margin: 0;
        }
        .trending-tokens-container {
          display: inline-flex;
          width: max-content;
          animation: marquee 20s linear infinite;
        }
        .trending-tokens-container:hover {
          animation-play-state: paused;
        }
        .trending-token-card {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          margin-right: 0;
          background-color: #0d1a2e;
          border: 1px solid #2a3b5a;
          border-right: none;
          min-width: 220px;
          white-space: nowrap;
        }
        .trending-token-card:last-child {
          border-right: 1px solid #2a3b5a;
        }
        .trending-token-card:not(:last-child)::after {
          content: "";
          width: 1px;
          height: 100%;
          background-color: #a1a1aa;
          position: absolute;
          right: 0;
        }
        .trending-token-card img {
          width: 24px;
          height: 24px;
          object-fit: cover;
          aspect-ratio: 1/1;
          background-color: #2a3b5a;
          border: 1px solid #2a3b5a;
          overflow: hidden;
          margin-right: 8px;
        }
        .rank-badge {
          background-color: #2a3b5a;
          color: #d1d1d6;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #a1a1aa;
          margin-right: 8px;
        }
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .swap-form-container {
          background-color: #1a263f;
          border: 1px solid #2a3b5a;
          border-radius: 4px;
          padding: 16px;
        }
        .swap-input {
          background-color: #2a3b5a;
          border: 1px solid #2a3b5a;
          border-radius: 4px;
          padding: 8px;
          color: #d1d1d6;
          width: 100%;
          font-size: 14px;
          outline: none;
        }
        .swap-input:disabled {
          background-color: #1a263f;
          color: #a1a1aa;
        }
        .swap-button {
          background-color: #3b82f6;
          color: #ffffff;
          padding: 8px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s ease-in-out;
          width: 100%;
        }
        .swap-button:hover {
          background-color: #2563eb;
        }
        .swap-button:disabled {
          background-color: #2563eb;
          opacity: 0.5;
          cursor: not-allowed;
        }
        .swap-arrow {
          background-color: #2a3b5a;
          border-radius: 4px;
          padding: 8px;
          cursor: pointer;
          transition: transform 0.2s ease-in-out;
        }
        .swap-arrow:hover {
          transform: scale(1.1);
        }
        .swap-info {
          font-size: 12px;
          color: #a1a1aa;
        }
        .wallet-button {
          background-color: #3b82f6;
          color: #ffffff;
          padding: 8px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s ease-in-out;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .wallet-button:hover {
          background-color: #2563eb;
        }
        .wallet-address {
          background-color: #2a3b5a;
          border: 1px solid #2a3b5a;
          border-radius: 4px;
          padding: 8px;
          color: #d1d1d6;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .wallet-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 50;
        }
        .wallet-modal-content {
          background-color: #1a263f;
          border: 1px solid #2a3b5a;
          border-radius: 8px;
          padding: 16px;
          width: 300px;
          max-width: 90%;
        }
        .wallet-option {
          background-color: #2a3b5a;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .wallet-option:hover {
          background-color: #3b4a6b;
        }
        .trend-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 60;
        }
        .trend-modal-content {
          background-color: #1a263f;
          border: 1px solid #2a3b5a;
          border-radius: 8px;
          padding: 24px;
          width: 400px;
          max-width: 95%;
          max-height: 80vh;
          overflow-y: auto;
        }
        .main-layout {
          display: flex;
          flex-direction: row;
          width: 100%;
        }
        .chart-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #2a3b5a;
          min-height: calc(100vh - 80px);
        }
        .sidebar {
          width: 300px;
          background-color: #0d1a2e;
          overflow-y: auto;
          padding-bottom: 16px;
        }
        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid #2a3b5a;
        }
        .branding-overlay {
          font-family: "Inter", sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: #d1d1d6;
          background: rgba(13, 26, 46, 0.8);
          padding: 4px 8px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-sizing: border-box;
        }
        .branding-overlay .symbol {
          color: #d1d1d6;
          font-weight: 600;
        }
        .branding-overlay .ohlc {
          color: #a1a1aa;
          font-size: 10px;
        }
        .branding-overlay .cypher {
          color: #3b82f6;
          font-size: 10px;
        }
        @media (max-width: 768px) {
          .main-layout {
            flex-direction: column;
          }
          .chart-section {
            border-right: none;
            border-bottom: 1px solid #2a3b5a;
            min-height: auto;
          }
          .sidebar {
            width: 100%;
          }
          .transactions-table th,
          .transactions-table td {
            padding: 4px;
            font-size: 10px;
          }
          .trending-banner {
            padding: 0;
            width: 100%;
          }
          .trending-token-card {
            padding: 6px 10px;
            margin-right: 0;
            min-width: 200px;
          }
          .trending-token-card img {
            width: 20px;
            height: 20px;
            margin-right: 6px;
          }
          .rank-badge {
            font-size: 9px;
            padding: 1px 4px;
            margin-right: 6px;
          }
        }
      `}</style>

      {/* Trending Tokens Banner */}
      <div className="trending-banner">
        {trendingError ? (
          <div className="text-red-400 text-sm px-4 py-2">Error: {trendingError}</div>
        ) : trendingLoading ? (
          <div className="text-gray-400 text-sm px-4 py-2 flex items-center">
            <svg
              className="animate-spin h-5 w-5 text-blue-500 mr-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Loading trending tokens...
          </div>
        ) : trendingTokens.length === 0 ? (
          <div className="text-gray-400 text-sm px-4 py-2">No trending tokens available.</div>
        ) : (
          <div className="trending-tokens-container">
            {([...trendingTokens, ...trendingTokens] as TrendingToken[]).map((tokenObj, index) => (
              <Link
                href={`/token-screener/${tokenObj.pairAddress}/chart`}
                key={`${tokenObj.pairAddress}-${index}`}
                passHref
              >
                <div className="trending-token-card relative">
                  <span className="rank-badge">#{(index % trendingTokens.length) + 1}</span>
                  <img
                    src={tokenObj.imageUrl}
                    alt={`${tokenObj.symbol} logo`}
                    onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/24/1F2937/FFFFFF?text=T")}
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-100 text-sm">{tokenObj.symbol}</span>
                    <span className="block text-xs text-gray-400 truncate max-w-[60px]">{tokenObj.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-gray-100 text-sm">${parseFloat(tokenObj.priceUsd).toFixed(4)}</span>
                    <span className={`text-xs ${tokenObj.priceChange24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {tokenObj.priceChange24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-2 border-b border-[#2A3B5A] flex flex-wrap justify-between items-center w-full bg-gray-950 shadow-sm header">
        <div className="flex items-center gap-2">
          {token?.logoUrl && (
            <img
              src={token.logoUrl}
              alt={`${token.baseToken.name} logo`}
              className="w-6 h-6 rounded-full border border-[#2A3B5A]"
              onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/48")}
            />
          )}
          <h1 className="text-base font-semibold tracking-tight text-gray-100">
            {token ? `${token.baseToken.symbol}/${token.quoteToken.symbol}` : "Loading..."}
            <span className="ml-2 text-xs text-gray-400 font-normal">on Base Chain</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-400">Last Updated: {lastUpdated}</div>
          {performanceMetrics && (
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`px-2 py-1 rounded-lg ${
                  performanceMetrics.change_5m >= 0 ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                }`}
              >
                5m: {performanceMetrics.change_5m >= 0 ? "+" : ""}
                {performanceMetrics.change_5m.toFixed(2)}%
              </span>
              <span
                className={`px-2 py-1 rounded-lg ${
                  performanceMetrics.change_1h >= 0 ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                }`}
              >
                1h: {performanceMetrics.change_1h >= 0 ? "+" : ""}
                {performanceMetrics.change_1h.toFixed(2)}%
              </span>
              <span
                className={`px-2 py-1 rounded-lg ${
                  performanceMetrics.change_4h >= 0 ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                }`}
              >
                4h: {performanceMetrics.change_4h >= 0 ? "+" : ""}
                {performanceMetrics.change_4h.toFixed(2)}%
              </span>
              <span
                className={`px-2 py-1 rounded-lg ${
                  performanceMetrics.change_24h >= 0 ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                }`}
              >
                24h: {performanceMetrics.change_24h >= 0 ? "+" : ""}
                {performanceMetrics.change_24h.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="main-layout">
        {/* Chart Section */}
        <div className="chart-section">
          {initialLoading ? (
            <div className="text-center text-sm flex items-center justify-center h-full bg-gray-950">
              <svg
                className="animate-spin h-6 w-6 text-blue-500 mr-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Loading...
            </div>
          ) : error ? (
            <div className="text-red-400 text-center text-sm bg-gray-950 p-4 h-full flex items-center justify-center">
              {error}
            </div>
          ) : (
            <div className="bg-gray-950 w-full flex flex-col">
              {/* Controls: View, Type, Timeframe, Trend Button */}
              <div className="flex flex-wrap justify-between items-center px-4 py-2 border-b border-[#2A3B5A]">
                <div className="flex space-x-2 mb-2 lg:mb-0">
                  <button
                    onClick={() => setChartView("Price")}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                      chartView === "Price"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "bg-[#1A263F] text-gray-400 hover:bg-[#2A3B5A]"
                    }`}
                  >
                    Price
                  </button>
                  <button
                    onClick={() => setChartView("MarketCap")}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                      chartView === "MarketCap"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "bg-[#1A263F] text-gray-400 hover:bg-[#2A3B5A]"
                    }`}
                  >
                    Market Cap
                  </button>
                  {chartView === "Price" && (
                    <>
                      <button
                        onClick={() => setChartType("Candlestick")}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                          chartType === "Candlestick"
                            ? "bg-blue-500 text-white shadow-sm"
                            : "bg-[#1A263F] text-gray-400 hover:bg-[#2A3B5A]"
                        }`}
                      >
                        Candlestick
                      </button>
                      <button
                        onClick={() => setChartType("Line")}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                          chartType === "Line"
                            ? "bg-blue-500 text-white shadow-sm"
                            : "bg-[#1A263F] text-gray-400 hover:bg-[#2A3B5A]"
                        }`}
                      >
                        Line
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={timeframe}
                    onChange={(e) => {
                      setTimeframe(e.target.value);
                      if (token) fetchChartData(poolAddress as string, token);
                    }}
                    disabled={initialLoading}
                    className="bg-[#1A263F] text-gray-400 text-sm px-3 py-1 rounded-lg focus:outline-none"
                  >
                    {["1m", "5m", "15m", "1h", "4h", "12h", "1d"].map((tf) => (
                      <option key={tf} value={tf}>
                        {tf}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowTrendModal(true)}
                    className="px-3 py-1 rounded-lg text-sm font-medium bg-[#1A263F] text-gray-400 hover:bg-[#2A3B5A] transition-all"
                  >
                    Trend
                  </button>
                </div>
              </div>

              <div className="relative px-4 py-2 flex-shrink-0">
                <div className="branding-overlay mb-2">
                  <span className="symbol">{symbol}</span>
                  <span className="ohlc">
                    O: {ohlc.open} H: {ohlc.high} L: {ohlc.low} C: {ohlc.close}
                  </span>
                  <span className="cypher">cypher.io</span>
                </div>

                {chartView === "Price" ? (
                  chartType === "Candlestick" ? (
                    candleData.length > 0 ? (
                      <Chart
                        options={candlestickOptions}
                        series={[{ data: candleData }]}
                        type="candlestick"
                        height={isMounted && window.innerWidth < 768 ? 350 : 500}
                        width="100%"
                      />
                    ) : (
                      <div className="text-center text-sm text-gray-400 h-full flex items-center justify-center">
                        No chart data available.
                      </div>
                    )
                  ) : lineData.length > 0 ? (
                    <Chart
                      options={lineOptions}
                      series={[{ name: "Price", data: lineData }]}
                      type="line"
                      height={isMounted && window.innerWidth < 768 ? 350 : 500}
                      width="100%"
                    />
                  ) : (
                    <div className="text-center text-sm text-gray-400 h-full flex items-center justify-center">
                      No chart data available.
                    </div>
                  )
                ) : marketCapData.length > 0 ? (
                  <Chart
                    options={candlestickOptions}
                    series={[{ data: marketCapData }]}
                    type="candlestick"
                    height={isMounted && window.innerWidth < 768 ? 350 : 500}
                    width="100%"
                  />
                ) : (
                  <div className="text-center text-sm text-gray-400 h-full flex items-center justify-center">
                    No chart data available.
                  </div>
                )}
              </div>

              {/* Transactions Table */}
              <div className="px-4 py-1 flex-shrink-0">
                <h3 className="text-sm font-semibold mb-2 text-gray-100">Transactions</h3>
                <div
                  className={`transaction-table-container custom-scrollbar custom-scrollbar-x-none w-full ${
                    transactionLoading ? "loading" : ""
                  }`}
                  ref={transactionContainerRef}
                >
                  <table className="w-full text-[12px] text-left font-sans transactions-table table-auto">
                    <thead className="text-[10px] text-gray-400 uppercase bg-gray-950 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-2 py-2 whitespace-nowrap">
                          Time
                        </th>
                        <th scope="col" className="px-2 py-2 whitespace-nowrap">
                          Type
                        </th>
                        <th scope="col" className="px-2 py-2 whitespace-nowrap">
                          Price (USD)
                        </th>
                        <th scope="col" className="px-2 py-2 whitespace-nowrap">
                          Price (ETH)
                        </th>
                        <th scope="col" className="px-2 py-2 whitespace-nowrap text-right">
                          Token Amount
                        </th>
                        <th scope="col" className="px-2 py-2 whitespace-nowrap text-right">
                          Token Price
                        </th>
                        <th scope="col" className="px-2 py-2 whitespace-nowrap text-right">
                          From
                        </th>
                        <th scope="col" className="px-2 py-2 whitespace-nowrap text-right">
                          To
                        </th>
                        <th scope="col" className="px-2 py-2 whitespace-nowrap text-right">
                          Maker
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 && !transactionLoading ? (
                        <tr>
                          <td colSpan={9} className="px-2 py-3 text-center text-gray-400">
                            No transactions available.
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx, index) => {
                          // Find index in lineData for this transaction timestamp to determine direction
                          const idx = lineData.findIndex((d) => d.x > tx.timestamp);
                          const currentPrice = idx > 0 ? lineData[idx - 1].y : lineData[0]?.y || 0;
                          const prevPrice = idx > 1 ? lineData[idx - 2].y : currentPrice;
                          const isSell = currentPrice < prevPrice;
                          const txLabel = isSell ? "SELL" : "BUY";

                          const tokenAmount = tx.tokenAmount || 0;
                          const tokenPriceInUsd = token?.priceUsd ? parseFloat(token.priceUsd) : 0;
                          const usdValue = Number.isFinite(tokenAmount * tokenPriceInUsd)
                            ? (tokenAmount * tokenPriceInUsd).toFixed(2)
                            : "0.00";
                          const ethValue =
                            ethPrice && Number.isFinite((tokenAmount * tokenPriceInUsd) / ethPrice)
                              ? ((tokenAmount * tokenPriceInUsd) / ethPrice).toFixed(4)
                              : "0.0000";

                          const maker = isSell ? tx.to : tx.from;
                          const shortFrom = `${tx.from.slice(0, 4)}...${tx.from.slice(-4)}`;
                          const shortTo = `${tx.to.slice(0, 4)}...${tx.to.slice(-4)}`;
                          const shortMaker = `${maker.slice(0, 4)}...${maker.slice(-4)}`;

                          return (
                            <tr
                              key={tx.id}
                              className={`border-b border-[#2A3B5A] text-gray-100 fade-in ${
                                index % 2 === 0 ? "bg-[#1A263F]" : "bg-[#0F1C34]"
                              }`}
                              ref={index === transactions.length - 1 ? lastTransactionRef : null}
                            >
                              <td className="px-2 py-2 whitespace-nowrap">
                                {new Date(tx.timestamp).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                  hour12: true,
                                })}
                              </td>
                              <td
                                className={`px-2 py-2 whitespace-nowrap ${
                                  isSell ? "text-red-400" : "text-green-400"
                                } font-bold`}
                              >
                                {txLabel}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-gray-100">${usdValue}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-gray-100">{ethValue}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-right">
                                {Number.isFinite(tokenAmount) ? tokenAmount.toFixed(4) : "0.0000"}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-right text-gray-100">
                                $
                                {Number.isFinite(tokenPriceInUsd)
                                  ? tokenPriceInUsd.toFixed(6)
                                  : "0.000000"}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-right">
                                <div className="tooltip">
                                  <a
                                    href={`https://basescan.org/address/${tx.from}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  >
                                    {shortFrom}
                                  </a>
                                  <span className="tooltiptext">{tx.from}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-right">
                                <div className="tooltip">
                                  <a
                                    href={`https://basescan.org/address/${tx.to}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  >
                                    {shortTo}
                                  </a>
                                  <span className="tooltiptext">{tx.to}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap text-right">
                                <div className="tooltip">
                                  <a
                                    href={`https://basescan.org/address/${maker}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:underline"
                                  >
                                    {shortMaker}
                                  </a>
                                  <span className="tooltiptext">{maker}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  {transactionLoading && (
                    <div className="text-center text-sm text-gray-400 py-2">
                      <svg
                        className="animate-spin h-5 w-5 text-blue-500 mx-auto pulse"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Indicators */}
              <div className="px-4 py-1 flex-shrink-0">
                <div className="flex overflow-x-auto border-t border-b border-[#2A3B5A] bg-gray-950 mb-4 w-full">
                  {availableIndicators.map((indicator) => (
                    <button
                      key={indicator}
                      onClick={() => setActiveIndicatorTab(indicator)}
                      className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                        activeIndicatorTab === indicator
                          ? "bg-blue-500 text-white"
                          : "text-gray-400 hover:bg-[#2A3B5A]"
                      }`}
                    >
                      {indicator}
                    </button>
                  ))}
                </div>

                <div className="w-full">
                  {activeIndicatorTab === "Volume" && (
                    <Chart
                      options={volumeOptions}
                      series={[{ name: "Volume", data: volumeData }]}
                      type="bar"
                      height={isMounted && window.innerWidth < 768 ? 150 : 250}
                      width="100%"
                    />
                  )}
                  {activeIndicatorTab === "SMA" && (
                    <Chart
                      options={smaOptions}
                      series={[
                        { name: "SMA 20", data: sma20Data },
                        { name: "SMA 50", data: sma50Data },
                      ]}
                      type="line"
                      height={isMounted && window.innerWidth < 768 ? 150 : 250}
                      width="100%"
                    />
                  )}
                  {activeIndicatorTab === "RSI" && (
                    <Chart
                      options={rsiOptions}
                      series={[{ name: "RSI", data: rsiData }]}
                      type="line"
                      height={isMounted && window.innerWidth < 768 ? 150 : 250}
                      width="100%"
                    />
                  )}
                  {activeIndicatorTab === "MACD" && (
                    <Chart
                      options={macdOptions}
                      series={[
                        { name: "MACD", data: macdData.map((d) => ({ x: d.x, y: d.macd })) },
                        { name: "Signal", data: macdData.map((d) => ({ x: d.x, y: d.signal })) },
                        { name: "Histogram", data: macdData.map((d) => ({ x: d.x, y: d.histogram })), type: "bar" },
                      ]}
                      type="line"
                      height={isMounted && window.innerWidth < 768 ? 150 : 250}
                      width="100%"
                    />
                  )}
                  {activeIndicatorTab === "VWAP" && (
                    <Chart
                      options={vwapOptions}
                      series={[{ name: "VWAP", data: vwapData }]}
                      type="line"
                      height={isMounted && window.innerWidth < 768 ? 150 : 250}
                      width="100%"
                    />
                  )}
                  {activeIndicatorTab === "Supertrend" && (
                    <Chart
                      options={supertrendOptions}
                      series={supertrendOptions.series as any}
                      type="line"
                      height={isMounted && window.innerWidth < 768 ? 150 : 250}
                      width="100%"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            <h2 className="text-lg font-semibold text-gray-100">
              {token ? `${token.baseToken.symbol}/${token.quoteToken.symbol}` : "Details"}
            </h2>
          </div>
          <div className="p-4 space-y-6">
            {initialLoading ? (
              <div className="text-center text-sm text-gray-400 bg-[#1A263F] rounded-lg p-4">
                Loading token data...
              </div>
            ) : error ? (
              <div className="text-red-400 text-center text-sm bg-[#1A263F] rounded-lg p-4">{error}</div>
            ) : token ? (
              <>
                {/* Token Info Card */}
                <div className="bg-[#1A263F] rounded-lg p-4 border border-[#2A3B5A]">
                  <div className="relative mb-4">
                    <img
                      src={token.bannerUrl}
                      alt={`${token.baseToken.name} banner`}
                      className="w-full h-20 object-cover rounded-lg border border-[#2A3B5A]"
                      onError={(e) => (e.currentTarget.src = "https://i.imgur.com/Fo2D7cK.png")}
                    />
                    <img
                      src={token.logoUrl}
                      alt={`${token.baseToken.name} logo`}
                      className="absolute -bottom-4 left-2 w-10 h-10 rounded-full border-2 border-[#2A3B5A]"
                      onError={(e) =>
                        (e.currentTarget.src =
                          "https://firebasestorage.googleapis.com/v0/b/homebase-dapp.firebasestorage.app/o/0x73cb479f2ccf77bad90bcda91e3987358437240a(2).png?alt=media&token=1cd408cf-c6a9-4264-8d30-0e1c5a544397")
                      }
                    />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight mt-4 text-gray-100">
                    {token.baseToken.name} ({token.baseToken.symbol})
                  </h2>
                  <div className="mt-2">
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>Pool:</span>
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[140px]">{token.poolAddress}</span>
                        <button onClick={() => copyToClipboard(token.poolAddress)} className="hover:text-blue-500">
                          <ClipboardIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400 mt-1">
                      <span>Pair:</span>
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[140px]">{token.pairAddress}</span>
                        <button onClick={() => copyToClipboard(token.pairAddress)} className="hover:text-blue-500">
                          <ClipboardIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Swap Form Card */}
                <Swap token={token} ethPrice={ethPrice} />

                {/* Market Stats Card */}
                <div className="bg-[#1A263F] rounded-lg p-4 border border-[#2A3B5A]">
                  <h3 className="text-sm font-semibold mb-3 text-gray-100">Market Stats</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Price (USD)</span>
                      <span className="font-medium text-gray-100">${parseFloat(token.priceUsd).toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Market Cap</span>
                      <span className="font-medium text-gray-100">{formatLargeNumber(token.marketCap)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Liquidity</span>
                      <span className="font-medium text-gray-100">{formatLargeNumber(token.liquidity.usd)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">FDV</span>
                      <span className="font-medium text-gray-100">{formatLargeNumber(token.fdv)}</span>
                    </div>
                  </div>
                </div>

                {/* Ads Card */}
                <div className="bg-[#1A263F] rounded-lg p-4 border border-[#2A3B5A]">
                  <h3 className="text-sm font-semibold mb-3 text-gray-100">Advertisement</h3>
                  {token.adImageUrl ? (
                    <img
                      src={token.adImageUrl}
                      alt="Project Ad"
                      className="w-full h-20 object-cover rounded-lg border border-[#2A3B5A]"
                      onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/300x100?text=Ad+Space")}
                    />
                  ) : (
                    <div className="text-sm text-gray-400 text-center bg-[#2A3B5A] rounded-lg p-4">
                      Advertise Here
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center text-sm text-gray-400 bg-[#1A263F] rounded-lg p-4">
                No token data available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trend Modal */}
      {showTrendModal && (
        <div className="trend-modal">
          <div className="trend-modal-content">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Trend Analysis</h3>
              <button onClick={() => setShowTrendModal(false)} className="text-gray-400 hover:text-gray-200">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="text-sm text-gray-400 space-y-3">
              {getTrendAnalysis().map((insight, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {insight.trend && (
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        insight.trend === "Bullish" ? "bg-green-400 text-gray-100" : "bg-red-400 text-gray-100"
                      }`}
                    >
                      {insight.trend}
                    </span>
                  )}
                  {insight.rsiStatus && (
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        insight.rsiStatus === "Overbought"
                          ? "bg-red-400 text-gray-100"
                          : insight.rsiStatus === "Oversold"
                          ? "bg-green-400 text-gray-100"
                          : "bg-[#2A3B5A] text-gray-100"
                      }`}
                    >
                      {insight.rsiStatus}
                    </span>
                  )}
                  {insight.crossoverType && (
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        insight.crossoverType === "Golden Cross" ? "bg-green-400 text-gray-100" : "bg-red-400 text-gray-100"
                      }`}
                    >
                      {insight.crossoverType}
                    </span>
                  )}
                  <span className="text-gray-400">{insight.text}</span>
                </div>
              ))}
              <div className="mt-3">
                <Sparklines data={getSparklineData()} width={240} height={40}>
                  <SparklinesLine
                    color={
                      getSparklineData()[getSparklineData().length - 1] >= getSparklineData()[0] ? "#10B981" : "#EF4444"
                    }
                  />
                </Sparklines>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}



