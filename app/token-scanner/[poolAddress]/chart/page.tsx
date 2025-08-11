"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Sparklines, SparklinesLine } from "react-sparklines";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import Swap from "./swap";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Types
interface TokenMetadata {
  poolAddress: string;
  pairAddress: string;
  baseToken: { name: string; symbol: string; address: string };
  quoteToken: { name: string; symbol: string; address: string };
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

interface SupertrendData extends IndicatorData {
  trend: "Bullish" | "Bearish";
  signalStrength: number;
  action: "Buy" | "Sell" | "Hold";
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

export default function ChartPage() {
  const { poolAddress } = useParams();
  const transactionLimit = 50;
  const [token, setToken] = useState<TokenMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<string>("1h");
  const [candleData, setCandleData] = useState<any[]>([]);
  const [lineData, setLineData] = useState<any[]>([]);
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [xAxisRange, setXAxisRange] = useState<{ min: number; max: number } | null>(null);
  const [ethPrice, setEthPrice] = useState<number>(3000);
  const [width, setWidth] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [txFilter, setTxFilter] = useState<"all" | "buy" | "sell">("all");
  const [currentTime, setCurrentTime] = useState(new Date());

  const [mobileActiveTab, setMobileActiveTab] = useState<"chart" | "info" | "swap">("chart");
  const [ohlcData, setOhlcData] = useState<{ open: number; high: number; low: number; close: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [flashTransactions, setFlashTransactions] = useState<Set<string>>(new Set());

  const observer = useRef<IntersectionObserver | null>(null);
  const lastTransactionRef = useRef<HTMLTableRowElement | null>(null);
  const transactionContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setWidth(window.innerWidth);
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Utility Functions
  const throttle = <F extends (...args: unknown[]) => void>(func: F, wait: number) => {
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



  const getVisibleData = useCallback((data: Array<{ x: Date | number }>) => {
    if (!xAxisRange) return data;
    return data.filter((d) => {
      const timestamp = d.x instanceof Date ? d.x.getTime() : d.x;
      return timestamp >= xAxisRange.min && timestamp <= xAxisRange.max;
    });
  }, [xAxisRange]);

  // Calculate appropriate zoom level based on timeframe - like the reference chart
  const getDefaultZoomLevel = useCallback((tf: string) => {
    const timeframeMap: { [key: string]: number } = {
      "1m": 2 * 60 * 60 * 1000, // 2 hours (lots of 1m candles)
      "5m": 8 * 60 * 60 * 1000, // 8 hours
      "15m": 24 * 60 * 60 * 1000, // 24 hours
      "1h": 7 * 24 * 60 * 60 * 1000, // 7 days
      "4h": 30 * 24 * 60 * 60 * 1000, // 30 days
      "1d": 120 * 24 * 60 * 60 * 1000, // 120 days (4 months like reference)
    };
    return timeframeMap[tf] || timeframeMap["1h"];
  }, []);

  // Handle zoom in/out with proper chart positioning
  const handleZoomIn = useCallback(() => {
    setZoom(prevZoom => {
      const newZoom = prevZoom * 1.2;
      // Update x-axis range to zoom in while keeping center point
      if (xAxisRange) {
        const center = (xAxisRange.min + xAxisRange.max) / 2;
        const range = xAxisRange.max - xAxisRange.min;
        const newRange = range / 1.2;
        setXAxisRange({
          min: center - newRange / 2,
          max: center + newRange / 2
        });
      }
      return newZoom;
    });
  }, [xAxisRange]);

  const handleZoomOut = useCallback(() => {
    setZoom(prevZoom => {
      const newZoom = prevZoom / 1.2;
      // Update x-axis range to zoom out while keeping center point
      if (xAxisRange) {
        const center = (xAxisRange.min + xAxisRange.max) / 2;
        const range = xAxisRange.max - xAxisRange.min;
        const newRange = range * 1.2;
        setXAxisRange({
          min: center - newRange / 2,
          max: center + newRange / 2
        });
      }
      return newZoom;
    });
  }, [xAxisRange]);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setXAxisRange(null); // Reset to default view
  }, []);

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



  // Effects
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
          (transfer: { from: string; to: string }) => transfer.from.toLowerCase() !== transfer.to.toLowerCase()
        );
        const transactions: Transaction[] = filteredTransfers.map((transfer: {
          hash: string;
          from: string;
          to: string;
          value?: string;
          category?: string;
          rawContract?: { decimal?: string };
          metadata: { blockTimestamp: string };
          blockNum: string;
          asset?: string;
        }) => {
          const isErc20 = transfer.category === "erc20";
          let tokenAmount: number = 0;
          let value: string = "0";
          let decimals = 18;
          try {
            if (transfer.value != null) {
              tokenAmount = parseFloat(transfer.value) || 0;
              if (isErc20) {
                decimals = transfer.rawContract?.decimal ? parseInt(transfer.rawContract.decimal, 16) : 18;
              }
              value = BigInt(Math.round(tokenAmount * (10 ** decimals))).toString();
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
          // Combine and sort by timestamp (newest first)
          const allTransactions = [...prev, ...filteredNewTransactions];
          return allTransactions.sort((a, b) => b.timestamp - a.timestamp);
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
        // Sort transactions by timestamp (newest first)
        const sortedTransactions = alchemyTransactions.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(sortedTransactions);
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
    let chartBuffer: { candle: { x: Date; y: number[] }; line: IndicatorData }[] = [];
    const bufferTimeout = 500;
    let bufferTimer: ReturnType<typeof setTimeout> | null = null;

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
          const isErc20Transfer = tx.to?.toLowerCase() === token.pairAddress.toLowerCase() && tx.input.startsWith("0xa9059cbb");
          let isSell = false;
          if (tx.value === "0x0" && isErc20Transfer) {
            isSell = false; // Swapped: ERC20 transfer is now BUY
          } else if (tx.value !== "0x0") {
            isSell = true; // Swapped: ETH transfer is now SELL
          } else {
            return;
          }
          let tokenAmount: number = 0;
          let value: string = "0";
          let decimals = 18;
          try {
            if (isSell) {
              const amountHex = tx.input.slice(-64, -32);
              const amount = parseInt(amountHex, 16) / 10 ** decimals;
              tokenAmount = amount;
              value = BigInt(Math.round(tokenAmount * 10 ** decimals)).toString();
            } else {
              tokenAmount = parseInt(tx.value, 16) / 10 ** 18;
              value = tx.value;
              decimals = 18;
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
            tokenSymbol: isSell ? token.baseToken.symbol : "ETH",
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
              
              // Add flash animation for new transactions
              if (filteredNewTransactions.length > 0) {
                const newTransactionIds = filteredNewTransactions.map(tx => tx.id);
                setFlashTransactions(new Set(newTransactionIds));
                
                // Remove flash animation after 2 seconds
                setTimeout(() => {
                  setFlashTransactions(prev => {
                    const newSet = new Set(prev);
                    newTransactionIds.forEach(id => newSet.delete(id));
                    return newSet;
                  });
                }, 2000);
              }
              
              // Combine and sort by timestamp (newest first)
              const allTransactions = [...filteredNewTransactions, ...prev];
              return allTransactions.sort((a, b) => b.timestamp - a.timestamp);
            });
          }
          transactionBuffer = [];
        }

      if (chartBuffer.length > 0) {
        setLineData((current) => {
          const newData = [...current, ...chartBuffer.map((item) => item.line)].slice(-300);
          return newData;
        });
        setCandleData((current) => {
          const newData = [...current, ...chartBuffer.map((item) => item.candle)].slice(-300);


          // Market cap data calculation removed for simplicity

          return newData;
        });
        chartBuffer = [];
      }

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
              (tx: { from: string; to?: string }) =>
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
      console.error("Alchemy WebSocket error:", err);
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
        const tokenDocRef = doc(db, "tokens", poolAddress);
        const tokenDoc = await getDoc(tokenDocRef);
        if (tokenDoc.exists()) {
          const data = tokenDoc.data();
          logoUrl = data.logoUrl || logoUrl;
          bannerUrl = data.bannerUrl || bannerUrl;
          adImageUrl = data.adImageUrl || "";
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
          address: pair.baseToken.address as string,
        },
        quoteToken: {
          name: pair.quoteToken.name,
          symbol: pair.quoteToken.symbol,
          address: (pair.quoteToken.address as string | undefined) || "0x4200000000000000000000000000000000000006",
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
      setError(null);
      return newMetadata;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load token data: ${errorMessage}`);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (!poolAddress || typeof poolAddress !== "string") return;
    const interval = setInterval(async () => {
      try {
        const updatedToken = await fetchTokenData(poolAddress as string);
        if (updatedToken) {
          setToken(updatedToken);
        }
      } catch (err) {
        console.error("Periodic token data refresh error:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [poolAddress, fetchTokenData]);

  const fetchChartData = useCallback(
    async (poolAddress: string) => {
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
        const url = `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddress}/ohlcv/${timeframeParam}?aggregate=${aggregate}&limit=1000`;
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

        // Set OHLC data for header display
        if (downsampledOhlcvList.length > 0) {
          const latest = downsampledOhlcvList[downsampledOhlcvList.length - 1];
          setOhlcData({
            open: latest.open,
            high: latest.high,
            low: latest.low,
            close: latest.close,
          });
        }

        // Market cap data removed for simplicity
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(`Failed to load chart data: ${errorMessage}`);
      } finally {
        setInitialLoading(false);
      }
    },
    [timeframe]
  );

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
          await fetchChartData(poolAddress);
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
    const allData = candleData;
    const visibleCandleData = getVisibleData(allData);
    const yValues = visibleCandleData.flatMap((d: any) => d.y);
    const lowestLow = yValues.length ? Math.min(...yValues) : 0;
    const highestHigh = yValues.length ? Math.max(...yValues) : 0;
    

    
    const yPadding = (highestHigh - lowestLow) * 0.15; // Reduced padding for cleaner look
    const yMin = Math.max(0, lowestLow - yPadding); // Ensure minimum is not negative
    const yMax = highestHigh + yPadding;
    
    // Calculate default zoom based on timeframe and zoom state - focus on recent data
    const defaultZoomRange = getDefaultZoomLevel(timeframe);
    const now = Date.now();
    const baseRange = defaultZoomRange / zoom;
    const xMin = xAxisRange ? xAxisRange.min : now - baseRange;
    const xMax = xAxisRange ? xAxisRange.max : now;
    const futurePadding = (xMax - xMin) * 0.2; // Much more padding for larger candles
    const xMaxWithPadding = xMax + futurePadding;

    // Dynamic subtitle: current price or market cap
    const subtitleText = token
      ? `$${parseFloat(token.priceUsd).toFixed(4)}`
      : "";

    return {
      chart: {
        type: "candlestick",
        height: 600, // Increased height for more vertical display
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
        zoom: { enabled: true, type: "x", autoScaleYaxis: true },
        events: {
          zoomed: throttle((_: any, { xaxis }: any) => {
            if (xaxis) setXAxisRange({ min: xaxis.min, max: xaxis.max });
          }, 500),
          scrolled: throttle((_: any, { xaxis }: any) => {
            if (xaxis) setXAxisRange({ min: xaxis.min, max: xaxis.max });
          }, 500),
        },
        animations: { enabled: false },
        sparkline: { enabled: false }, // Ensure sparkline is disabled for full candlestick display
        brush: { enabled: false }, // Disable brush for cleaner interface
      },
      subtitle: {
        text: subtitleText,
        align: "right",
        style: { color: "#D1D1D6", fontSize: "12px", fontFamily: "Inter, sans-serif" },
      },
      title: {
        text: "Price",
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
          datetimeUTC: true,
          format: "HH:mm",
          style: {
            colors: "#A1A1AA",
            fontSize: width < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          rotate: 0,
          rotateAlways: false,
        },
        tickAmount: 6,
        title: {
          text: `Time (UTC) - ${currentTime.toUTCString().split(' ')[4]}`,
          offsetY: 70,
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif", fontSize: "12px" },
        },
      },
      yaxis: {
        opposite: true, // Move to right side
        title: {
          text: "Price (USD)",
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" },
        },
        labels: {
          style: {
            colors: "#A1A1AA",
            fontSize: width < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          formatter: (val: number) => `$${val.toFixed(4)}`,
        },
        tickAmount: 4, // Fewer tick marks for cleaner look
        min: yMin,
        max: yMax,
        forceNiceScale: true, // Ensure nice scale values
        logarithmic: false, // Keep linear scale for better candlestick visibility
      },
      grid: {
        borderColor: "#2A3B5A",
        opacity: 0.02, // Extremely faint grid lines
        strokeDashArray: 0,
        xaxis: { lines: { show: true, color: "#0A0A1A", opacity: 0.01, width: 0.5 } }, // Extremely faint and thin x-axis lines
        yaxis: { lines: { show: true, color: "#0A0A1A", opacity: 0.01, width: 0.5 } }, // Extremely faint and thin y-axis lines
      },
              plotOptions: {
          candlestick: {
            colors: { upward: "#10B981", downward: "#EF4444" },
            wick: { useFillColor: true },
            columnWidth: width < 768 ? "95%" : "85%", // Much wider candles
          },
        },
              tooltip: {
          enabled: true,
          theme: "dark",
          x: { format: timeframe === "1d" ? "MMM dd, yyyy" : timeframe === "4h" ? "MMM dd, HH:mm" : "HH:mm" },
          y: {
            formatter: (val: number) => `$${val.toFixed(4)}`,
          },
          style: { fontFamily: "Inter, sans-serif" },
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
          const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
          const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
          const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
          const time = new Date(w.globals.seriesX[seriesIndex][dataPointIndex]).toUTCString();
          const formatter = (val: number) => `$${val.toFixed(4)}`;
          return `
            <div class="p-2 bg-[#1A263F] rounded-lg shadow-lg">
              <p class="text-sm text-gray-100"><span class="text-gray-400">Time:</span> ${time}</p>
              <p class="text-sm text-gray-100"><span class="text-gray-400">Open:</span> ${formatter(
                o
              )}</p>
              <p class="text-sm text-gray-100"><span class="text-gray-400">High:</span> ${formatter(
                h
              )}</p>
              <p className="text-sm text-gray-100"><span class="text-gray-400">Low:</span> ${formatter(
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
    xAxisRange,
    candleData,
    width,
    token,
    getVisibleData,
    currentTime,
    timeframe,
    zoom,
    getDefaultZoomLevel,
  ]);

  const lineOptions = useMemo<ApexCharts.ApexOptions>(() => {
    const allData = lineData;
    const visibleLineData = getVisibleData(allData);
    const yValues = visibleLineData.flatMap((d: any) => d.y);
    const yMin = yValues.length ? Math.min(...yValues) * 0.999 : 0;
    const yMax = yValues.length ? Math.max(...yValues) * 1.001 : 1;
    const defaultZoomRange = getDefaultZoomLevel(timeframe);
    const now = Date.now();
    const baseRange = defaultZoomRange / zoom;
    const xMin = xAxisRange ? xAxisRange.min : now - baseRange;
    const xMax = xAxisRange ? xAxisRange.max : now;
    const futurePadding = (xMax - xMin) * 0.1;
    const xMaxWithPadding = xMax + futurePadding;

    const subtitleText = token
      ? `$${parseFloat(token.priceUsd).toFixed(4)}`
      : "";

    return {
      chart: {
        type: "line",
        height: 600, // Increased height for more vertical display
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
        zoom: { enabled: true, type: "x", autoScaleYaxis: true },
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
        text: "Price",
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
          datetimeUTC: true,
          format: "HH:mm",
          style: {
            colors: "#A1A1AA",
            fontSize: width < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          rotate: 0,
          rotateAlways: false,
        },
        tickAmount: 6,
        title: {
          text: `Time (UTC) - ${currentTime.toUTCString().split(' ')[4]}`,
          offsetY: 70,
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif", fontSize: "12px" },
        },
      },
      yaxis: {
        opposite: true, // Move to right side
        title: {
          text: "Price (USD)",
          style: { color: "#D1D1D6", fontFamily: "Inter, sans-serif" },
        },
        labels: {
          style: {
            colors: "#A1A1AA",
            fontSize: width < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          formatter: (val: number) => `$${val.toFixed(4)}`,
        },
        tickAmount: 4, // Fewer tick marks for cleaner look
        min: yMin,
        max: yMax,
        forceNiceScale: true, // Ensure nice scale values
        logarithmic: false, // Keep linear scale for better visibility
      },
      grid: {
        borderColor: "#2A3B5A",
        opacity: 0.02, // Extremely faint grid lines
        strokeDashArray: 0,
        xaxis: { lines: { show: true, color: "#0A0A1A", opacity: 0.01, width: 0.5 } }, // Extremely faint and thin x-axis lines
        yaxis: { lines: { show: true, color: "#0A0A1A", opacity: 0.01, width: 0.5 } }, // Extremely faint and thin y-axis lines
      },
      stroke: {
        curve: "straight",
        width: 2,
        colors: ["#3B82F6"],
      },
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "HH:mm:ss" },
        y: {
          formatter: (val: number) => `$${val.toFixed(4)}`,
        },
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
  }, [
    xAxisRange,
    lineData,
    width,
    token,
    getVisibleData,
    currentTime,
    timeframe,
    zoom,
    getDefaultZoomLevel,
  ]);





  // OHLC calculation removed for simplicity

  // Utility functions for trend analysis and sparkline
  const getSparklineData = () => {
    return lineData.slice(-50).map((d) => d.y);
  };

  const getTrendAnalysis = () => {
    const insights: TrendInsight[] = [];
    
    // Price trend analysis
    if (lineData.length >= 2) {
      const currentPrice = lineData[lineData.length - 1]?.y || 0;
      const previousPrice = lineData[lineData.length - 2]?.y || 0;
      const priceChangePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
      
      if (Math.abs(priceChangePercent) > 1) {
        insights.push({
          text: `Price ${priceChangePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(priceChangePercent).toFixed(2)}% in the last period.`,
          trend: priceChangePercent > 0 ? "Bullish" : "Bearish",
        });
      }
    }

    // Volume analysis
    if (transactions.length > 0) {
      const recentTxs = transactions.slice(0, 10);
      const buyCount = recentTxs.filter(tx => {
        return tx.from?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '') && tx.tokenSymbol === token?.baseToken.symbol;
      }).length;
      
      const sellCount = recentTxs.filter(tx => {
        const isSell = tx.from?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '') && tx.tokenSymbol === token?.baseToken.symbol;
        return isSell;
      }).length;

      if (buyCount > sellCount * 1.5) {
        insights.push({
          text: `Strong buying pressure detected with ${buyCount} buy transactions vs ${sellCount} sell transactions.`,
          trend: "Bullish",
        });
      } else if (sellCount > buyCount * 1.5) {
        insights.push({
          text: `Selling pressure detected with ${sellCount} sell transactions vs ${buyCount} buy transactions.`,
          trend: "Bearish",
        });
      }
    }

    // Market sentiment
    if (token?.priceChange) {
      const h1Change = token.priceChange.h1 || 0;
      const h24Change = token.priceChange.h24 || 0;
      
      if (h1Change > 5 && h24Change > 10) {
        insights.push({
          text: "Strong positive momentum with significant gains in both 1h and 24h periods.",
          trend: "Bullish",
        });
      } else if (h1Change < -5 && h24Change < -10) {
        insights.push({
          text: "Strong negative momentum with significant losses in both 1h and 24h periods.",
          trend: "Bearish",
        });
      }
    }

    return insights;
  };



  const handleTransactionScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && !transactionLoading && hasMoreTransactions) {
      // Load more transactions when user scrolls near bottom
      loadMoreTransactions();
    }
  };

  // Format time as "X minutes ago", "X hours ago", etc.
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  // Format USD values with abbreviations (1.06k, 30k, 44.75k, etc.)
  const formatUSD = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}k`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Filtered transactions based on buy/sell
  const filteredTransactions = useMemo(() => {
    if (txFilter === "all") return transactions;
    return transactions.filter((tx) => {
      const isSell = tx.from?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '') && tx.tokenSymbol === token?.baseToken.symbol;
      return txFilter === "sell" ? isSell : !isSell;
    });
  }, [transactions, txFilter, token]);

  // Chart options memoized to prevent hooks order issues
  const chartOptions = useMemo(() => {
    const baseOptions = chartType === "candlestick" ? candlestickOptions : lineOptions;
    return {
      ...baseOptions,
      chart: {
        ...baseOptions.chart,
        zoom: {
          enabled: true,
          type: 'x' as const,
          autoScaleYaxis: true,
        },
        toolbar: {
          show: false,
        },
        animations: {
          enabled: false,
        },
        events: {
          zoomed: throttle((_: any, { xaxis }: any) => {
            if (xaxis) {
              setXAxisRange({ min: xaxis.min, max: xaxis.max });
              // Update zoom state based on the actual chart zoom
              const range = xaxis.max - xaxis.min;
              const defaultRange = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
              const newZoom = Math.max(0.1, defaultRange / range);
              setZoom(newZoom);
            }
          }, 500),
          scrolled: throttle((_: any, { xaxis }: any) => {
            if (xaxis) {
              setXAxisRange({ min: xaxis.min, max: xaxis.max });
              // Update zoom state based on the actual chart zoom
              const range = xaxis.max - xaxis.min;
              const defaultRange = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
              const newZoom = Math.max(0.1, defaultRange / range);
              setZoom(newZoom);
            }
          }, 500),
        },
      },
      xaxis: {
        ...baseOptions.xaxis,
        labels: {
          ...baseOptions.xaxis?.labels,
          format: timeframe === "1d" ? "MMM dd" : timeframe === "4h" ? "MMM dd HH:mm" : "HH:mm",
        },
      },
      noData: {
        text: "No data available",
        align: "center" as const,
        verticalAlign: "middle" as const,
        style: {
          color: "#9ca3af",
          fontSize: "14px",
        },
      },
    };
  }, [chartType, candlestickOptions, lineOptions, timeframe]);

  // JSX Return Statement
  return (
    <div className={`${width < 768 ? 'h-screen font-sans bg-gray-950 text-gray-200 w-full overflow-hidden' : 'min-h-screen font-sans bg-gray-950 text-gray-200 w-full'}`}>
      <style jsx>{`
        @keyframes flash {
          0% {
            background-color: rgba(59, 130, 246, 0.3);
          }
          50% {
            background-color: rgba(59, 130, 246, 0.1);
          }
          100% {
            background-color: transparent;
          }
        }
        .flash-animation {
          animation: flash 2s ease-out;
        }
        
        @keyframes slideIn {
          0% {
            opacity: 0;
            transform: translateY(-20px);
            max-height: 0;
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            max-height: 100px;
          }
        }
        .slide-in-animation {
          animation: slideIn 0.5s ease-out forwards;
        }
      `}</style>
      {/* Header - Always Show */}
      <Header />

      {/* Loading Screen */}
      {initialLoading && (
        <div className="h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h2 className="text-xl font-semibold text-gray-200 mb-2">Loading Chart Data</h2>
            <p className="text-gray-400">Fetching token information and market data...</p>
            </div>
          </div>
        )}

      {/* Main Content */}
      {!initialLoading && (
        <div className={`${width < 768 ? 'flex flex-col h-screen overflow-hidden pb-16' : 'flex flex-row h-screen overflow-hidden h-full'}`}>

        {/* Chart Section */}
          <div className={`${width < 768 ? 'flex-1 flex flex-col min-h-0' : 'flex-1 flex flex-col min-h-0 h-full'}`}>
            {error ? (
            <div className="text-red-400 text-center text-sm bg-gray-950 p-4 h-full flex items-center justify-center">
              {error}
            </div>
          ) : (
            <>
              {/* Chart Tab Content */}
                {(!width || width >= 768 || mobileActiveTab === "chart") && (
                <div className="bg-gray-950 h-full flex flex-col">
                    {/* Enhanced Chart Header with OHLC and Branding */}
                    <div className="bg-gray-900 border-b border-blue-500/20 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                            <span className="text-gray-400 text-sm">
                              {token?.baseToken.symbol?.charAt(0) || "T"}
                            </span>
                          </div>
                          <div>
                            <h1 className="text-sm font-bold text-gray-100">
                              {token?.baseToken.symbol}/{token?.quoteToken.symbol}
                            </h1>
                            <p className="text-xs text-gray-400">${token?.priceUsd ? parseFloat(token.priceUsd).toFixed(6) : "0.000000"}</p>
                          </div>
                        </div>

                        {/* OHLC Values - Inline Format */}
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-400">O</span>
                            <span className="text-xs font-semibold text-gray-200">
                              ${ohlcData?.open ? ohlcData.open.toFixed(6) : token?.priceUsd ? parseFloat(token.priceUsd).toFixed(6) : "0.000000"}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-400">H</span>
                            <span className="text-xs font-semibold text-green-400">
                              ${ohlcData?.high ? ohlcData.high.toFixed(6) : token?.priceUsd ? parseFloat(token.priceUsd).toFixed(6) : "0.000000"}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-400">L</span>
                            <span className="text-xs font-semibold text-red-400">
                              ${ohlcData?.low ? ohlcData.low.toFixed(6) : token?.priceUsd ? parseFloat(token.priceUsd).toFixed(6) : "0.000000"}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-400">C</span>
                            <span className="text-xs font-semibold text-blue-400">
                              ${ohlcData?.close ? ohlcData.close.toFixed(6) : token?.priceUsd ? parseFloat(token.priceUsd).toFixed(6) : "0.000000"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Compact Chart Controls */}
                    <div className="bg-gray-900 border-b border-blue-500/20 p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                          {/* Timeframe Selector */}
                        <select
                          value={timeframe}
                            onChange={(e) => setTimeframe(e.target.value)}
                            className="bg-gray-800 text-gray-300 text-xs px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors h-8 min-w-[60px]"
                        >
                          <option value="1m">1m</option>
                          <option value="5m">5m</option>
                          <option value="15m">15m</option>
                          <option value="1h">1h</option>
                          <option value="4h">4h</option>
                          <option value="1d">1d</option>
                        </select>

                          {/* Chart Type Toggle */}
                        <button
                            onClick={() => setChartType(chartType === "candlestick" ? "line" : "candlestick")}
                            className="bg-gray-800 text-gray-300 text-xs px-3 py-2 rounded border border-gray-700 hover:bg-gray-700 transition-colors h-8 min-w-[80px] flex items-center justify-center"
                        >
                            {chartType === "candlestick" ? "Candle" : "Line"}
                        </button>

                          {/* Zoom Controls */}
                          <button
                            onClick={handleZoomIn}
                            className="bg-gray-800 text-gray-300 text-xs px-3 py-2 rounded border border-gray-700 hover:bg-gray-700 transition-colors h-8 min-w-[40px] flex items-center justify-center"
                          >
                            +
                          </button>
                          <button
                            onClick={handleZoomOut}
                            className="bg-gray-800 text-gray-300 text-xs px-3 py-2 rounded border border-gray-700 hover:bg-gray-700 transition-colors h-8 min-w-[40px] flex items-center justify-center"
                          >
                            -
                          </button>
                          <button
                            onClick={handleResetZoom}
                            className="bg-gray-800 text-gray-300 text-xs px-3 py-2 rounded border border-gray-700 hover:bg-gray-700 transition-colors h-8 min-w-[60px] flex items-center justify-center"
                          >
                            Reset
                          </button>
                        </div>

                        <div className="flex items-center space-x-2">
                          <div className="text-xs text-gray-500">
                            {timeframe}
                          </div>
                          {/* 5m Mover */}
                          {token?.priceChange?.m5 !== undefined ? (
                            <div className={`bg-gray-800/90 backdrop-blur-sm rounded px-3 py-2 border border-gray-700 h-8 flex flex-col justify-center min-w-[60px] ${
                              token.priceChange.m5 >= 0 
                                ? "border-green-500/30" 
                                : "border-red-500/30"
                            }`}>
                              <div className="text-xs text-gray-400">5m</div>
                              <div className={`text-xs font-medium ${
                                token.priceChange.m5 >= 0 ? "text-green-400" : "text-red-400"
                              }`}>
                                {token.priceChange.m5 >= 0 ? "+" : ""}{token.priceChange.m5.toFixed(2)}%
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-800/90 backdrop-blur-sm rounded px-3 py-2 border border-gray-700 h-8 flex flex-col justify-center min-w-[60px]">
                              <div className="text-xs text-gray-400">5m</div>
                              <div className="text-xs text-gray-400">0.00%</div>
                            </div>
                          )}
                          {/* 1h Mover */}
                          {token?.priceChange?.h1 !== undefined ? (
                            <div className={`bg-gray-800/90 backdrop-blur-sm rounded px-3 py-2 border border-gray-700 h-8 flex flex-col justify-center min-w-[60px] ${
                              token.priceChange.h1 >= 0 
                                ? "border-green-500/30" 
                                : "border-red-500/30"
                            }`}>
                              <div className="text-xs text-gray-400">1h</div>
                              <div className={`text-xs font-medium ${
                                token.priceChange.h1 >= 0 ? "text-green-400" : "text-red-400"
                              }`}>
                                {token.priceChange.h1 >= 0 ? "+" : ""}{token.priceChange.h1.toFixed(2)}%
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-800/90 backdrop-blur-sm rounded px-3 py-2 border border-gray-700 h-8 flex flex-col justify-center min-w-[60px]">
                              <div className="text-xs text-gray-400">1h</div>
                              <div className="text-xs text-gray-400">0.00%</div>
                            </div>
                          )}
                          {/* 4h Mover */}
                          {token?.priceChange?.h6 !== undefined ? (
                            <div className={`bg-gray-800/90 backdrop-blur-sm rounded px-3 py-2 border border-gray-700 h-8 flex flex-col justify-center min-w-[60px] ${
                              token.priceChange.h6 >= 0 
                                ? "border-green-500/30" 
                                : "border-red-500/30"
                            }`}>
                              <div className="text-xs text-gray-400">4h</div>
                              <div className={`text-xs font-medium ${
                                token.priceChange.h6 >= 0 ? "text-green-400" : "text-red-400"
                              }`}>
                                {token.priceChange.h6 >= 0 ? "+" : ""}{token.priceChange.h6.toFixed(2)}%
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-800/90 backdrop-blur-sm rounded px-3 py-2 border border-gray-700 h-8 flex flex-col justify-center min-w-[60px]">
                              <div className="text-xs text-gray-400">4h</div>
                              <div className="text-xs text-gray-400">0.00%</div>
                            </div>
                          )}
                          {/* 24h Mover */}
                          {token?.priceChange?.h24 ? (
                            <div className={`bg-gray-800/90 backdrop-blur-sm rounded px-3 py-2 border border-gray-700 h-8 flex flex-col justify-center min-w-[80px] ${
                              token.priceChange.h24 >= 0 
                                ? "border-green-500/30" 
                                : "border-red-500/30"
                            }`}>
                              <div className="text-xs text-gray-400">24h</div>
                              <div className={`text-xs font-medium ${
                                token.priceChange.h24 >= 0 ? "text-green-400" : "text-red-400"
                              }`}>
                                {token.priceChange.h24 >= 0 ? "+" : ""}{token.priceChange.h24.toFixed(2)}%
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-800/90 backdrop-blur-sm rounded px-3 py-2 border border-gray-700 h-8 flex flex-col justify-center min-w-[80px]">
                              <div className="text-xs text-gray-400">24h</div>
                              <div className="text-xs text-gray-400">0.00%</div>
                            </div>
                          )}
                          {/* UTC Timer */}
                          <div className="bg-gray-800/90 backdrop-blur-sm rounded px-3 py-2 border border-gray-700 h-8 flex flex-col justify-center min-w-[60px]">
                            <div className="text-xs text-gray-400">UTC</div>
                            <div className="text-xs text-gray-200 font-mono">
                              {currentTime.toUTCString().split(' ')[4]}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chart Area */}
                    <div className="flex-1 bg-gray-950 p-2 relative min-h-0" style={{ maxHeight: width < 768 ? '75%' : '65%' }} onTouchStart={(e) => e.stopPropagation()}>
                      <div className="w-full h-full">
                        {candleData.length > 0 ? (
                          <Chart
                            key={`${chartType}-${zoom}-${timeframe}`}
                            options={chartOptions}
                            series={[
                              {
                                name: chartType === "candlestick" ? "Price" : "Price",
                                data: chartType === "candlestick" ? candleData : lineData,
                                type: chartType === "candlestick" ? "candlestick" : "line",
                              },
                            ]}
                            type={chartType === "candlestick" ? "candlestick" : "line"}
                            height="100%"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            No chart data available
                        </div>
                      )}
                    </div>
                  </div>

                    {/* Compact Transactions Section */}
                    <div className="bg-gray-900 border-t border-blue-500/20 p-2 flex-1 flex flex-col min-h-0 h-full">
                      <div className="flex items-center justify-between mb-2 flex-shrink-0">
                        <h3 className="text-sm font-semibold text-gray-200">Transactions</h3>
                        <select
                          value={txFilter}
                          onChange={(e) => setTxFilter(e.target.value as "all" | "buy" | "sell")}
                          className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
                        >
                          <option value="all">All</option>
                          <option value="buy">Buy</option>
                          <option value="sell">Sell</option>
                        </select>
                      </div>
                      <div className="overflow-y-auto flex-1 custom-scrollbar h-full" onScroll={handleTransactionScroll}>
                        <table className="w-full text-xs text-left">
                          <thead className="text-xs text-gray-400 uppercase bg-gray-900 sticky top-0">
                            <tr>
                              <th className="px-1 py-2">Time</th>
                              <th className="px-1 py-2">Type</th>
                              <th className="px-1 py-2">USD</th>
                              <th className="px-1 py-2 flex items-center justify-center">
                                <span className="mr-1">🐟</span>
                                <span>Size</span>
                              </th>
                              <th className="px-1 py-2">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTransactions.length === 0 && !transactionLoading ? (
                              <tr>
                                <td colSpan={5} className="px-1 py-2 text-center text-gray-400">No transactions available.</td>
                              </tr>
                            ) : (
                              filteredTransactions.map((tx) => {
                                // Determine if this is a buy or sell based on the transaction direction
                                // For DEX transactions:
                                // BUY: ETH sent to pool (from user to pool) - user receives tokens
                                // SELL: Tokens sent to pool (from user to pool) - user receives ETH
                                const isTokenTransaction = tx.tokenSymbol === token?.baseToken.symbol;
                                const isETHTransaction = !isTokenTransaction;
                                
                                // If it's a token transaction and going TO the pool, it's a SELL (user selling tokens)
                                // If it's an ETH transaction and going TO the pool, it's a BUY (user buying tokens)
                                const isBuy = isETHTransaction && tx.to?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '');
                                const isSell = isTokenTransaction && tx.to?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '');
                                
                                const txLabel = isBuy ? "BUY" : isSell ? "SELL" : "UNKNOWN";
                                const txColor = isBuy ? "text-green-400" : isSell ? "text-red-400" : "text-gray-400";
                                const txBgColor = isBuy ? "bg-green-500/10" : isSell ? "bg-red-500/10" : "bg-gray-500/10";
                            
                            let usdValue = 0, ethValue = 0, priceAtTime = 0;
                            
                            if (isTokenTransaction) {
                                  // For token transactions, calculate based on token amount and current price
                              const tokenAmount = tx.tokenAmount || 0;
                              priceAtTime = token?.priceUsd ? parseFloat(token.priceUsd) : 0;
                              usdValue = tokenAmount * priceAtTime;
                              ethValue = usdValue / (ethPrice || 1);
                            } else {
                                  // For ETH transactions
                              ethValue = Number(tx.value) / 1e18;
                              usdValue = ethValue * (ethPrice || 1);
                              priceAtTime = token?.priceUsd ? parseFloat(token.priceUsd) : 0;
                            }
                            let sizeIcon = "🐟";
                            if (usdValue > 10000) sizeIcon = "🐋";
                            else if (usdValue > 1000) sizeIcon = "🐬";
                            else if (usdValue > 100) sizeIcon = "🐠";
                            return (
                                  <tr key={tx.id} className={`border-b border-gray-800 text-gray-100 ${txBgColor} ${
                                    flashTransactions.has(tx.id) ? 'flash-animation slide-in-animation' : ''
                                  }`}>
                                    <td className="px-1 py-2 text-xs">{formatTimeAgo(tx.timestamp)}</td>
                                    <td className={`px-1 py-2 font-bold text-xs ${txColor}`}>{txLabel}</td>
                                    <td className="px-1 py-2 text-xs">{formatUSD(usdValue)}</td>
                                    <td className="px-1 py-2 text-center text-xs">{sizeIcon}</td>
                                    <td className="px-1 py-2 text-xs">${priceAtTime.toFixed(4)}</td>
                              </tr>
                            );
                          })
                        )}
                        {transactionLoading && (
                          <tr>
                                <td colSpan={5} className="px-1 py-2 text-center text-gray-400">
                              <div className="flex items-center justify-center">
                                <svg className="animate-spin h-4 w-4 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Loading more transactions...
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}

          {/* Info Tab Content */}
                {width < 768 && mobileActiveTab === "info" && (
                  <div className="bg-gray-950 flex-1 flex flex-col overflow-hidden">
                    <div className="bg-gray-900 border-b border-blue-500/20 p-3">
                      <h3 className="text-sm font-semibold text-gray-200">Token Information</h3>
              </div>
                    <div className="flex-1 p-3 overflow-y-auto">
                      {token && (
                <div className="space-y-4">
                          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                            <h4 className="text-lg font-semibold text-gray-100 mb-3">Token Details</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                        <span className="text-gray-400">Symbol:</span>
                                <div className="text-gray-100 font-semibold">{token.baseToken.symbol}</div>
                      </div>
                              <div>
                                <span className="text-gray-400">Name:</span>
                                <div className="text-gray-100 font-semibold">{token.baseToken.name}</div>
                              </div>
                              <div>
                        <span className="text-gray-400">Price:</span>
                                <div className="text-gray-100 font-semibold">${parseFloat(token.priceUsd).toFixed(6)}</div>
                      </div>
                              <div>
                        <span className="text-gray-400">Market Cap:</span>
                                <div className="text-gray-100 font-semibold">${token.marketCap.toLocaleString()}</div>
                      </div>
                              <div>
                        <span className="text-gray-400">Liquidity:</span>
                                <div className="text-gray-100 font-semibold">${token.liquidity.usd.toLocaleString()}</div>
                      </div>
                              <div>
                                <span className="text-gray-400">FDV:</span>
                                <div className="text-gray-100 font-semibold">${token.fdv.toLocaleString()}</div>
                    </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
                  </div>
                  
          {/* Swap Section - Desktop Only */}
          {(!width || width >= 768) && (
            <div className="w-80 flex-shrink-0 h-full flex flex-col border-l border-blue-500/20">
              <div className="bg-gray-900 h-full flex flex-col">
                <div className="flex-1 p-4 overflow-y-auto">
                  <Swap token={token} ethPrice={ethPrice} />
                      </div>
                
                {/* Enhanced Ad Banner at Bottom */}
                <div className="bg-gray-900 border-t border-blue-500/20 p-4 flex-shrink-0">
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">AD</span>
                      </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-200 mb-1">Sponsored Content</h3>
                          <p className="text-sm text-gray-400">Discover new opportunities and trending tokens</p>
                      </div>
                      </div>
                      <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm px-4 py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium">
                        Learn More
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Swap Tab Content - Mobile Only */}
          {width < 768 && mobileActiveTab === "swap" && (
            <div className="bg-gray-950 flex-1 flex flex-col overflow-hidden">
              <div className="bg-gray-900 border-b border-blue-500/20 p-3">
                <h3 className="text-sm font-semibold text-gray-200">Swap</h3>
              </div>
              <div className="flex-1 p-3 overflow-y-auto">
                <Swap token={token} ethPrice={ethPrice} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Tab Navigation - Mobile Only */}
      {width < 768 && !initialLoading && (
        <div className="bg-gray-900 border-t border-blue-500/20 flex-shrink-0 fixed bottom-0 left-0 right-0 z-50">
          <div className="flex">
            <button
              onClick={() => setMobileActiveTab("chart")}
              className={`flex-1 py-3 px-4 text-xs font-medium transition-colors ${
                mobileActiveTab === "chart"
                  ? "text-blue-400 bg-blue-500/10 border-t-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              📊 Chart
            </button>
            <button
              onClick={() => setMobileActiveTab("info")}
              className={`flex-1 py-3 px-4 text-xs font-medium transition-colors ${
                mobileActiveTab === "info"
                  ? "text-blue-400 bg-blue-500/10 border-t-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              ℹ️ Info
            </button>
            <button
              onClick={() => setMobileActiveTab("swap")}
              className={`flex-1 py-3 px-4 text-xs font-medium transition-colors ${
                mobileActiveTab === "swap"
                  ? "text-blue-400 bg-blue-500/10 border-t-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              💱 Swap
            </button>
    </div>
        </div>
      )}

      {/* Footer - Desktop Only */}
      {(!width || width >= 768) && <Footer />}

      {/* Enhanced Trend Modal */}
      {showTrendModal && (
        <div className="trend-modal">
          <div className="trend-modal-content">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">📈</span>
                </div>
                <h3 className="text-xl font-bold text-gray-100">Market Analysis</h3>
              </div>
              <button onClick={() => setShowTrendModal(false)} className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-gray-700 transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
              </div>
              
            <div className="space-y-6">
              {/* Token Info */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-100">{token?.baseToken.symbol}/{token?.quoteToken.symbol}</h4>
                  <span className="text-sm text-gray-400">Real-time Analysis</span>
                      </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                    <span className="text-gray-400">Current Price:</span>
                    <div className="text-gray-100 font-semibold">${token?.priceUsd ? parseFloat(token.priceUsd).toFixed(6) : "0.000000"}</div>
                      </div>
                  <div>
                    <span className="text-gray-400">24h Change:</span>
                    <div className={`font-semibold ${token?.priceChange?.h24 && token.priceChange.h24 >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {token?.priceChange?.h24 ? `${token.priceChange.h24 >= 0 ? "+" : ""}${token.priceChange.h24.toFixed(2)}%` : "0.00%"}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Market Cap:</span>
                    <div className="text-gray-100 font-semibold">${token?.marketCap ? token.marketCap.toLocaleString() : "0"}</div>
                </div>
                  <div>
                    <span className="text-gray-400">Liquidity:</span>
                    <div className="text-gray-100 font-semibold">${token?.liquidity?.usd ? token.liquidity.usd.toLocaleString() : "0"}</div>
              </div>
            </div>
          </div>

              {/* Trend Insights */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-lg font-semibold text-gray-100 mb-4">📊 Market Insights</h4>
                <div className="space-y-3">
                  {getTrendAnalysis().length > 0 ? (
                    getTrendAnalysis().map((insight, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg">
                        {insight.trend && (
                          <span
                            className={`px-3 py-1 text-xs font-medium rounded-full ${
                              insight.trend === "Bullish" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
                            }`}
                          >
                            {insight.trend === "Bullish" ? "📈" : "📉"} {insight.trend}
                          </span>
                        )}
                        <span className="text-gray-300 text-sm leading-relaxed">{insight.text}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 text-sm p-3 bg-gray-700 rounded-lg">
                      <span className="text-yellow-400">⚠️</span> Insufficient data for detailed analysis. More trading activity needed.
                    </div>
                  )}
                </div>
      </div>

              {/* Price Chart Mini */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-lg font-semibold text-gray-100 mb-4">📈 Price Trend</h4>
                <div className="flex items-center justify-center">
                  <Sparklines data={getSparklineData()} width={300} height={60} margin={5}>
                    <SparklinesLine
                      color={
                        getSparklineData().length > 0 && getSparklineData()[getSparklineData().length - 1] >= getSparklineData()[0] ? "#10B981" : "#EF4444"
                      }
                      style={{ strokeWidth: 2 }}
                    />
                  </Sparklines>
            </div>
                <div className="text-center mt-2">
                  <span className="text-xs text-gray-400">
                    {getSparklineData().length > 0 && getSparklineData()[getSparklineData().length - 1] >= getSparklineData()[0] ? "↗ Trending Up" : "↘ Trending Down"}
                  </span>
              </div>
            </div>

              {/* Trading Activity */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h4 className="text-lg font-semibold text-gray-100 mb-4">🔄 Trading Activity</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold text-green-400">{transactions.filter(tx => {
                      const isSell = tx.from?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '') && tx.tokenSymbol === token?.baseToken.symbol;
                      return !isSell;
                    }).length}</div>
                    <div className="text-gray-400">Buy Orders</div>
                  </div>
                  <div className="text-center p-3 bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold text-red-400">{transactions.filter(tx => {
                      const isSell = tx.from?.toLowerCase() === (token?.poolAddress?.toLowerCase() || '') && tx.tokenSymbol === token?.baseToken.symbol;
                      return isSell;
                    }).length}</div>
                    <div className="text-gray-400">Sell Orders</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1f2937;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3b82f6;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
}