"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ClipboardIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";
import { Sparklines, SparklinesLine } from "react-sparklines";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { FaExchangeAlt, FaWallet } from "react-icons/fa";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { db } from "@/lib/firebase";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Constants for Base network (Uniswap V3 addresses)
const SWAP_ROUTER_ADDRESS = "0x2626664c2603E5475e998cB8976B0dF48E8b8A94"; // Uniswap V3 SwapRouter on Base
const QUOTER_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"; // Uniswap V3 Quoter on Base
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base
const ETH_ADDRESS = ethers.ZeroAddress; // ETH represented as zero address

// ABI for Uniswap V3 Quoter
const QUOTER_ABI = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)",
];

// WETH ABI for wrapping/unwrapping
const WETH_ABI = [
  "function deposit() external payable",
  "function withdraw(uint256 wad) external",
  "function balanceOf(address owner) public view returns (uint256)",
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
];

// ERC20 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function decimals() public view returns (uint8)",
];

// Swap Router ABI
const SWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) external payable",
];

type SwapToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
};

type TrendingToken = {
  symbol: string;
  name: string;
  priceUsd: string;
  priceChange24h: number;
  imageUrl: string;
  pairAddress: string;
};

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
  priceChange?: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
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
  const transactionLimit = 10;
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  // Swap form state
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("");
  const [tokenIn, setTokenIn] = useState<SwapToken | null>(null);
  const [tokenOut, setTokenOut] = useState<SwapToken | null>(null);
  const [isSwapLoading, setIsSwapLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [slippage] = useState<number>(0.5);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [gasEstimate, setGasEstimate] = useState<string>("0");
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [walletBalance, setWalletBalance] = useState<string>("0.0");
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);

  // Fetch ETH/WETH balance using wagmi
  const { data: ethBalance } = useBalance({
    address: address as `0x${string}`,
  });

  const { data: wethBalance } = useBalance({
    address: address as `0x${string}`,
    token: WETH_ADDRESS as `0x${string}`,
  });

  const observer = useRef<IntersectionObserver | null>(null);
  const lastTransactionRef = useRef<HTMLTableRowElement | null>(null);
  const availableIndicators = ["Volume", "SMA", "RSI", "MACD", "VWAP", "Supertrend"];
  const provider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN");

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

  const fromWei = (value: string, decimals: number = 18): number => {
    try {
      const numValue = BigInt(value);
      const divisor = BigInt(10) ** BigInt(decimals);
      const integerPart = numValue / divisor;
      const fractionalPart = (numValue % divisor) * BigInt(10 ** 9) / divisor;
      return parseFloat(`${integerPart.toString()}.${fractionalPart.toString().padStart(9, "0")}`);
    } catch (err) {
      console.error("fromWei error:", err);
      return 0;
    }
  };

  const decodeERC20Transfer = (input: string, tokenDecimals: number = 18): { amount: number } => {
    try {
      if (!input.startsWith("0xa9059cbb")) return { amount: 0 };
      const amountHex = "0x" + input.slice(74);
      const amount = fromWei(amountHex, tokenDecimals);
      return { amount };
    } catch (err) {
      console.error("Error decoding ERC-20 transfer:", err);
      return { amount: 0 };
    }
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
        supertrend = trend === "Bullish" && d.close < supertrend ? upperBand : trend === "Bearish" && d.close > supertrend ? lowerBand : supertrend;
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

  // Setup tokens for swapping
  useEffect(() => {
    if (token && token.baseToken && token.quoteToken) {
      const baseToken: SwapToken = {
        address: token.baseToken.address || ETH_ADDRESS,
        symbol: token.baseToken.symbol === "ETH" ? "ETH" : token.baseToken.symbol,
        name: token.baseToken.name,
        decimals: 18,
      };
      const quoteToken: SwapToken = {
        address: token.quoteToken.address || WETH_ADDRESS,
        symbol: token.quoteToken.symbol === "WETH" ? "WETH" : token.quoteToken.symbol,
        name: token.quoteToken.name,
        decimals: 18,
      };
      setTokenIn(baseToken);
      setTokenOut(quoteToken);
    }
  }, [token]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!isConnected || !address || !tokenIn) {
        setWalletBalance("0.0");
        return;
      }

      try {
        if (tokenIn.address === ETH_ADDRESS) {
          const balance = ethBalance ? ethers.formatEther(ethBalance.value) : "0";
          setWalletBalance(parseFloat(balance).toFixed(4));
        } else {
          const balance = wethBalance ? ethers.formatUnits(wethBalance.value, tokenIn.decimals) : "0";
          setWalletBalance(parseFloat(balance).toFixed(4));
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
        setWalletBalance("0.0");
        toast.error("Failed to fetch wallet balance");
      }
    };

    fetchBalance();
  }, [isConnected, address, tokenIn, ethBalance, wethBalance]);

  // Check allowance for tokenIn
  useEffect(() => {
    const checkAllowance = async () => {
      if (!isConnected || !address || !tokenIn || tokenIn.address === ETH_ADDRESS || !amountIn || parseFloat(amountIn) <= 0) {
        setIsApproved(false);
        return;
      }

      try {
        const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, provider);
        const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
        const allowance = await tokenContract.allowance(address, SWAP_ROUTER_ADDRESS);
        setIsApproved(allowance >= amountInWei);
      } catch (error) {
        console.error("Error checking allowance:", error);
        setIsApproved(false);
      }
    };

    checkAllowance();
  }, [isConnected, address, tokenIn, amountIn]);

  // Fetch live quote and gas estimate
  useEffect(() => {
    if (!amountIn || parseFloat(amountIn) <= 0 || !tokenIn || !tokenOut) {
      setAmountOut("");
      setPriceImpact(0);
      setGasEstimate("0");
      return;
    }

    const fetchQuote = async () => {
      try {
        const quoterContract = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);

        let tokenInAddress = tokenIn.address;
        let tokenOutAddress = tokenOut.address;

        // Handle ETH/WETH conversion for quoting
        if (tokenIn.address === ETH_ADDRESS) tokenInAddress = WETH_ADDRESS;
        if (tokenOut.address === ETH_ADDRESS) tokenOutAddress = WETH_ADDRESS;

        const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
        const fee = 3000; // 0.3% fee tier
        const quotedAmountOut = await quoterContract.quoteExactInputSingle.staticCall(
          tokenInAddress,
          tokenOutAddress,
          fee,
          amountInWei,
          0
        );

        const amountOutFormatted = ethers.formatUnits(quotedAmountOut, tokenOut.decimals);
        setAmountOut(parseFloat(amountOutFormatted).toFixed(4));

        // Calculate price impact
        const inputPrice = parseFloat(amountIn) * parseFloat(token?.priceUsd || "0");
        const outputPrice = parseFloat(amountOutFormatted) * (tokenOut.symbol === "WETH" || tokenOut.symbol === "ETH" ? ethPrice : parseFloat(token?.priceUsd || "0"));
        const impact = inputPrice && outputPrice ? ((inputPrice - outputPrice) / inputPrice) * 100 : 0;
        setPriceImpact(Math.abs(impact));

        // Estimate gas
        if (isConnected && address) {
          const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
          const swapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, signer);
          const params = {
            tokenIn: tokenInAddress,
            tokenOut: tokenOutAddress,
            fee: 3000,
            recipient: tokenOut.address === ETH_ADDRESS ? SWAP_ROUTER_ADDRESS : address,
            deadline: Math.floor(Date.now() / 1000) + 60 * 20,
            amountIn: amountInWei,
            amountOutMinimum: BigInt(quotedAmountOut) * BigInt(Math.floor((100 - slippage) * 100)) / BigInt(10000),
            sqrtPriceLimitX96: 0,
          };
          const gas = await swapRouter.exactInputSingle.estimateGas(params, {
            value: tokenIn.address === ETH_ADDRESS ? amountInWei : 0,
          });
          setGasEstimate(ethers.formatUnits(gas, "gwei"));
        }
      } catch (error) {
        console.error("Error fetching swap quote:", error);
        setAmountOut("");
        setPriceImpact(0);
        setGasEstimate("0");
        toast.error("Failed to fetch swap quote");
      }
    };

    fetchQuote();
  }, [amountIn, tokenIn, tokenOut, ethPrice, token, isConnected, address, slippage]);

  // Handle wallet connection
  const handleConnectWallet = (connector: any) => {
    if (!isConnected) {
      try {
        connect({ connector });
        setShowWalletModal(false);
        toast.success("Wallet connected successfully");
      } catch (error) {
        console.error("Wallet connection failed:", error);
        toast.error("Failed to connect wallet. Please try again.");
      }
    }
  };

  // Handle combined approve and swap
  const handleSwapWithApproval = async () => {
    if (!isConnected || !address || !tokenIn || !tokenOut) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSwapLoading(true);
    try {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      const amountOutMin = ethers.parseUnits(amountOut || "0", tokenOut.decimals) * BigInt(Math.floor((100 - slippage) * 100)) / BigInt(10000);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      // Step 1: Handle ETH to WETH conversion if necessary
      let tokenInAddress = tokenIn.address;
      if (tokenIn.address === ETH_ADDRESS) {
        const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
        const depositTx = await wethContract.deposit({ value: amountInWei });
        await depositTx.wait();
        tokenInAddress = WETH_ADDRESS;
      }

      // Step 2: Approve token if necessary
      if (tokenIn.address !== ETH_ADDRESS && !isApproved) {
        const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(address, SWAP_ROUTER_ADDRESS);
        if (allowance < amountInWei) {
          const approveTx = await tokenContract.approve(SWAP_ROUTER_ADDRESS, amountInWei);
          await approveTx.wait();
          setIsApproved(true);
          toast.success(`${tokenIn.symbol} approved for swapping`);
        }
      }

      // Step 3: Execute the swap
      const swapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, signer);
      const params = {
        tokenIn: tokenInAddress,
        tokenOut: tokenOut.address === ETH_ADDRESS ? WETH_ADDRESS : tokenOut.address,
        fee: 3000,
        recipient: tokenOut.address === ETH_ADDRESS ? SWAP_ROUTER_ADDRESS : address,
        deadline,
        amountIn: amountInWei,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0,
      };

      const swapTx = await swapRouter.exactInputSingle(params, {
        value: tokenIn.address === ETH_ADDRESS ? amountInWei : 0,
        gasLimit: 300000,
      });
      await swapTx.wait();

      // Step 4: Unwrap WETH to ETH if necessary
      if (tokenOut.address === ETH_ADDRESS) {
        const unwrapTx = await swapRouter.unwrapWETH9(amountOutMin, address);
        await unwrapTx.wait();
      }

      toast.success(`Successfully swapped ${amountIn} ${tokenIn.symbol} for ${amountOut} ${tokenOut.symbol}`);
      setAmountIn("");
      setAmountOut("");
      setIsApproved(false);
    } catch (error) {
      console.error("Swap failed:", error);
      toast.error("Swap failed");
    } finally {
      setIsSwapLoading(false);
    }
  };

  // Handle token swap
  const handleSwapTokens = () => {
    if (tokenIn && tokenOut) {
      setTokenIn(tokenOut);
      setTokenOut(tokenIn);
      setAmountIn("");
      setAmountOut("");
      setIsApproved(false);
    }
  };

  // Existing Effects
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

  const fetchTransactionsFromAlchemy = useCallback(async (pairAddress: string, pageKey: string | null = null) => {
    try {
      const ALCHEMY_API_URL = process.env.NEXT_PUBLIC_ALCHEMY_API_URL || "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
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
      const filteredTransfers = transfers.filter((transfer: any) => transfer.from.toLowerCase() !== transfer.to.toLowerCase());
      const transactions: Transaction[] = filteredTransfers.map((transfer: any) => {
        const isErc20 = transfer.category === "erc20";
        let tokenAmount: number;
        let value: string;
        let decimals = 18;
        if (isErc20) {
          tokenAmount = transfer.value ? parseFloat(transfer.value) : 0;
          value = ethers.parseUnits(tokenAmount.toString(), 18).toString();
          decimals = transfer.rawContract?.decimal ? parseInt(transfer.rawContract.decimal, 16) : 18;
        } else {
          value = transfer.value ? ethers.parseUnits(transfer.value.toString(), 18).toString() : "0";
          tokenAmount = fromWei(value, 18);
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
  }, []);

  const loadMoreTransactions = useCallback(async () => {
    if (transactionLoading || !hasMoreTransactions || !token) return;
    setTransactionLoading(true);
    try {
      const { transactions: newTransactions, newPageKey } = await fetchTransactionsFromAlchemy(token.pairAddress, pageKey);
      if (newTransactions.length > 0) {
        setTransactions((prev) => [...prev, ...newTransactions]);
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
  }, [transactionLoading, hasMoreTransactions, token, pageKey, fetchTransactionsFromAlchemy]);

  useEffect(() => {
    if (!token || !poolAddress || initialLoading) return;
    const loadInitialTransactions = async () => {
      setTransactionLoading(true);
      try {
        const { transactions: alchemyTransactions, newPageKey } = await fetchTransactionsFromAlchemy(token.pairAddress);
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
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreTransactions) {
        loadMoreTransactions();
      }
    });
    if (lastTransactionRef.current) {
      observer.current.observe(lastTransactionRef.current);
    }
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [hasMoreTransactions, loadMoreTransactions]);

  useEffect(() => {
    if (!token?.pairAddress || initialLoading || !ethPrice) return;
    const wsUrl = "wss://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN";
    const ws = new WebSocket(wsUrl);
    let transactionBuffer: Transaction[] = [];
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
        const response = await fetch("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        if (data.result) {
          const tx = data.result;
          const isErc20 = tx.to?.toLowerCase() === token.pairAddress.toLowerCase() && tx.input && tx.input.startsWith("0xa9059cbb");
          let tokenAmount: number;
          let value: string;
          let decimals = 18;
          if (isErc20) {
            const decoded = decodeERC20Transfer(tx.input);
            tokenAmount = decoded.amount;
            value = ethers.parseUnits(tokenAmount.toString(), 18).toString();
            decimals = token.baseToken.symbol === "ETH" ? 18 : 18;
          } else {
            value = tx.value || "0";
            tokenAmount = fromWei(value, 18);
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
        }
      } catch (err) {
        console.error("Error fetching transaction details:", err);
      }
    };

    const processTransactionBuffer = () => {
      if (transactionBuffer.length === 0) return;
      transactionBuffer = transactionBuffer.filter((tx) => tx.from.toLowerCase() !== tx.to.toLowerCase());
      if (transactionBuffer.length === 0) return;
      setTransactions((prev) => {
        const updated = [...transactionBuffer, ...prev].slice(0, 50);
        return updated;
      });
      const latestTx = transactionBuffer[transactionBuffer.length - 1];
      const tokenPriceInUsd = token?.priceUsd ? parseFloat(token.priceUsd) : 0;
      const timestamp = latestTx.timestamp;
      const newLinePoint = { x: timestamp, y: tokenPriceInUsd };
      const newCandle = {
        x: new Date(timestamp),
        y: [tokenPriceInUsd, tokenPriceInUsd, tokenPriceInUsd, tokenPriceInUsd],
      };
      setLineData((prev) => [...prev, newLinePoint].slice(-300));
      setCandleData((prev) => {
        const updated = [...prev, newCandle].slice(-300);
        const newOhlcvList = updated.map((d) => ({
          timestamp: d.x.getTime(),
          open: d.y[0],
          high: d.y[1],
          low: d.y[2],
          close: d.y[3],
          volume: 0,
        }));
        const supertrendValues = calculateSupertrend(newOhlcvList);
        setSupertrendData(supertrendValues);
        return updated;
      });
      setLastUpdated(new Date().toLocaleString());
      transactionBuffer = [];
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
      const data = JSON.parse(event.data);
      if (data.method === "eth_subscription" && data.params?.result) {
        const blockHash = data.params.result.hash;
        const blockRequest = {
          id: 2,
          jsonrpc: "2.0",
          method: "eth_getBlockByHash",
          params: [blockHash, true],
        };
        const response = await fetch("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(blockRequest),
        });
        const blockData = await response.json();
        if (blockData.result && blockData.result.transactions) {
          const { transactions: txs } = blockData.result;
          const relevantTxs = txs.filter(
            (tx: any) => tx.from.toLowerCase() === token?.pairAddress.toLowerCase() || tx.to?.toLowerCase() === token?.pairAddress.toLowerCase()
          );
          for (const tx of relevantTxs) {
            await fetchTransactionDetails(tx.hash);
          }
          if (bufferTimer) clearTimeout(bufferTimer);
          bufferTimer = setTimeout(processTransactionBuffer, bufferTimeout);
        }
      }
    };

    ws.onerror = (err) => {
      console.error("Alchemy WebSocket error:", err);
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
      const dexScreenerRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${poolAddress}`, {
        cache: "no-store",
      });
      if (!dexScreenerRes.ok) throw new Error("Failed to fetch token data from DexScreener");
      const dexScreenerData = await dexScreenerRes.json();
      if (!dexScreenerData.pairs || dexScreenerData.pairs.length === 0) throw new Error("No token data found");

      const pair = dexScreenerData.pairs[0];
      let logoUrl = pair.baseToken?.image || pair.info?.image || "https://i.imgur.com/QICJsOC.jpeg";
      let bannerUrl = pair.info?.image || pair.baseToken?.image || "https://i.imgur.com/suFIyxm.png";
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
          address: pair.quoteToken.address || WETH_ADDRESS,
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
        if (!data.data || !data.data.attributes || !data.data.attributes.ohlcv_list) throw new Error("No chart data returned");
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
        const newPriceData = downsampledOhlcvList.map((d: OHLCVData) => ({
          x: new Date(d.timestamp),
          y: [d.open, d.high, d.low, d.close],
        }));
        setCandleData(newPriceData);
        const newLineData = downsampledOhlcvList.map((d: OHLCVData) => ({
          x: d.timestamp,
          y: d.close,
        }));
        setLineData(newLineData);
        const newMarketCapData = downsampledOhlcvList.map((d: OHLCVData) => {
          const pricePerToken = parseFloat(tokenData.priceUsd || "0");
          const totalSupply = pricePerToken ? (tokenData.marketCap || 0) / pricePerToken : 0;
          return {
            x: new Date(d.timestamp),
            y: [d.open * totalSupply, d.high * totalSupply, d.low * totalSupply, d.close * totalSupply],
          };
        });
        setMarketCapData(newMarketCapData);
        const newVolumeData = downsampledOhlcvList.map((d: OHLCVData) => ({
          x: d.timestamp,
          y: d.volume,
        }));
        setVolumeData(newVolumeData);
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
        const rsiPeriod = 14;
        const rsiValues: IndicatorData[] = [];
        const changes: number[] = downsampledOhlcvList.slice(1).map((d, i) => d.close - downsampledOhlcvList[i].close);
        for (let i = rsiPeriod; i < changes.length; i++) {
          const rsiSlice: number[] = changes.slice(i - rsiPeriod, i);
          const gains: number = rsiSlice.filter((c: number) => c > 0).reduce((sum: number, c: number) => sum + c, 0) / rsiPeriod;
          const losses: number = Math.abs(rsiSlice.filter((c: number) => c < 0).reduce((sum: number, c: number) => sum + c, 0)) / rsiPeriod;
          const rs: number = gains / (losses || 1);
          const rsi: number = 100 - 100 / (1 + rs);
          rsiValues.push({ x: downsampledOhlcvList[i + 1].timestamp, y: rsi });
        }
        setRsiData(rsiValues);
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
        const supertrendValues = calculateSupertrend(downsampledOhlcvList);
        setSupertrendData(supertrendValues);
        const supertrendSignals = calculateSupertrendSignals(downsampledOhlcvList, supertrendValues, rsiValues);
        setSupertrendSignals(supertrendSignals);
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
        const data = JSON.parse(event.data);
        const parsedData = {
          ...data,
          price_usd: parseFloat(data.price_usd || "0"),
          market_cap_usd: parseFloat(data.market_cap_usd || "0"),
          liquidity_usd: parseFloat(data.liquidity_usd || "0"),
        };
        setToken((prev) =>
          prev
            ? {
                ...prev,
                priceUsd: parsedData.price_usd.toString(),
                marketCap: parsedData.market_cap_usd,
                liquidity: { usd: parsedData.liquidity_usd },
              }
            : prev
        );
        setLastUpdated(new Date().toLocaleString());
      };
      ws.onerror = (err) => {
        console.error("Geckoterminal WebSocket error:", err);
        setError("Geckoterminal WebSocket connection failed. Real-time updates may be unavailable.");
      };
      ws.onclose = () => {
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts++;
            connectWebSocket();
          }, reconnectInterval * Math.pow(2, reconnectAttempts));
        } else {
          setError("Failed to reconnect Geckoterminal WebSocket after multiple attempts.");
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
    return {
      chart: {
        type: "candlestick",
        height: isMounted && window.innerWidth < 768 ? 300 : 700,
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: {
          show: true,
          tools: { download: false, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true },
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
      title: { text: chartView, align: "left", style: { color: "#E4E4E7", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" } },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: {
          datetimeUTC: false,
          format: timeframe.includes("m") ? "HH:mm:ss" : "MMM d HH:mm",
          style: { colors: "#A1A1AA", fontSize: isMounted && window.innerWidth < 768 ? "8px" : "10px", fontFamily: "Inter, sans-serif" },
          rotate: -45,
          rotateAlways: true,
        },
        tickAmount: 6,
        title: { text: "Time", offsetY: 70, style: { color: "#E4E4E7", fontFamily: "Inter, sans-serif" } },
      },
      yaxis: {
        title: { text: chartView === "Price" ? "Price (USD)" : "Market Cap (USD)", style: { color: "#E4E4E7", fontFamily: "Inter, sans-serif" } },
        labels: {
          style: { colors: "#A1A1AA", fontSize: isMounted && window.innerWidth < 768 ? "8px" : "10px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => (chartView === "Price" ? `$${val.toFixed(4)}` : `$${formatLargeNumber(val)}`),
        },
        tickAmount: 5,
        min: yMin,
        max: yMax,
      },
      grid: { borderColor: "#27272A", strokeDashArray: 3 },
      plotOptions: {
        candlestick: {
          colors: { upward: "#22C55E", downward: "#EF4444" },
          wick: { useFillColor: true },
          columnWidth: "60%",
        },
      },
      annotations: {
        points: supertrendSignals.map((signal) => ({
          x: signal.x,
          y: signal.y,
          marker: { size: 6, fillColor: signal.type === "Buy" ? "#22C55E" : "#EF4444" },
          label: { text: signal.type, style: { color: "#000000", background: signal.type === "Buy" ? "#22C55E" : "#EF4444", fontSize: "10px", fontFamily: "Inter, sans-serif" } },
        })),
      },
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "dd MMM HH:mm:ss" },
        y: { formatter: (val: number) => (chartView === "Price" ? `$${val.toFixed(4)}` : `$${formatLargeNumber(val)}`) },
        style: { fontFamily: "Inter, sans-serif" },
      },
      markers: { size: 0 },
      crosshair: {
        enabled: true,
        x: { show: true, stroke: { color: "#0052FF", width: 1, dashArray: 3 } },
        y: { show: true, stroke: { color: "#0052FF", width: 1, dashArray: 3 } },
      },
    };
  }, [chartView, timeframe, xAxisRange, supertrendSignals, candleData, marketCapData, isMounted]);

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
    return {
      chart: {
        type: "line",
        height: isMounted && window.innerWidth < 768 ? 300 : 700,
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: {
          show: true,
          tools: { download: false, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true },
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
      title: { text: "Price (Line)", align: "left", style: { color: "#E4E4E7", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" } },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: {
          datetimeUTC: false,
          format: timeframe.includes("m") ? "HH:mm:ss" : "MMM d HH:mm",
          style: { colors: "#A1A1AA", fontSize: isMounted && window.innerWidth < 768 ? "8px" : "10px", fontFamily: "Inter, sans-serif" },
          rotate: -45,
          rotateAlways: true,
        },
        tickAmount: 6,
        title: { text: "Time", offsetY: 70, style: { color: "#E4E4E7", fontFamily: "Inter, sans-serif" } },
      },
      yaxis: {
        title: { text: "Price (USD)", style: { color: "#E4E4E7", fontFamily: "Inter, sans-serif" } },
        labels: {
          style: { colors: "#A1A1AA", fontSize: isMounted && window.innerWidth < 768 ? "8px" : "10px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => `$${val.toFixed(4)}`,
        },
        tickAmount: 5,
        min: yMin,
        max: yMax,
      },
      grid: { borderColor: "#27272A", strokeDashArray: 3 },
      stroke: { curve: "smooth", width: 2 },
      colors: ["#0052FF"],
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "dd MMM HH:mm:ss" },
        y: { formatter: (val: number) => `$${val.toFixed(4)}` },
        style: { fontFamily: "Inter, sans-serif" },
      },
      markers: { size: 0 },
      crosshair: {
        enabled: true,
        x: { show: true, stroke: { color: "#0052FF", width: 1, dashArray: 3 } },
        y: { show: true, stroke: { color: "#0052FF", width: 1, dashArray: 3 } },
      },
    };
  }, [timeframe, xAxisRange, lineData, isMounted]);

  const volumeOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: { type: "bar", height: isMounted && window.innerWidth < 768 ? 100 : 200, background: "transparent", foreColor: "#A1A1AA", toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: false } },
    title: { text: "Volume", align: "left", style: { color: "#E4E4E7", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" } },
    xaxis: { 
      type: "datetime", 
      min: xAxisRange ? xAxisRange.min : undefined, 
      max: xAxisRange ? xAxisRange.max : undefined, 
      labels: { show: false }, 
      tickAmount: isMounted && window.innerWidth < 768 ? 6 : 8 
    },
    yaxis: {
      title: { text: "Volume", style: { color: "#E4E4E7", fontFamily: "Inter, sans-serif" } },
      labels: { 
        show: true, 
        style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" }, 
        formatter: (val: number) => formatLargeNumber(val) 
      },
      tickAmount: 3,
    },
    dataLabels: { enabled: false },
    colors: ["#A855F7"],
    plotOptions: { bar: { columnWidth: isMounted && window.innerWidth < 768 ? "20%" : "40%" } },
    fill: { type: "solid", opacity: 0.8 },
    tooltip: {
      enabled: true,
      theme: "dark",
      x: { format: "dd MMM HH:mm:ss" },
      y: {
        formatter: (val: number) => {
          const pricePerToken = parseFloat(token?.priceUsd || "0");
          const volumeUsd = val * pricePerToken;
          return `$${formatLargeNumber(volumeUsd)}`;
        },
      },
      style: { fontFamily: "Inter, sans-serif" },
    },
  }), [xAxisRange, token, isMounted]);

  const smaOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: { type: "line", height: isMounted && window.innerWidth < 768 ? 100 : 200, background: "transparent", foreColor: "#A1A1AA", toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: false } },
    title: { text: "SMA (20 & 50)", align: "left", style: { color: "#E4E4E7", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" } },
    xaxis: { type: "datetime", min: xAxisRange ? xAxisRange.min : undefined, max: xAxisRange ? xAxisRange.max : undefined, labels: { show: false } },
    yaxis: {
      title: { text: "SMA", style: { color: "#E4E4E7", fontFamily: "Inter, sans-serif" } },
      labels: { show: true, offsetX: -15, style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" }, formatter: (val: number) => val.toFixed(2) },
      tickAmount: 6,
    },
    stroke: { curve: "smooth", width: 2 },
    colors: ["#FBBF24", "#F87171"],
    tooltip: { enabled: true, theme: "dark", x: { format: "dd MMM HH:mm:ss" }, y: { formatter: (val: number) => val.toFixed(2) }, style: { fontFamily: "Inter, sans-serif" } },
    annotations: {
      points: smaCrossovers.map((crossover) => ({
        x: crossover.x,
        y: crossover.y,
        marker: { size: 6, fillColor: crossover.type === "Golden Cross" ? "#22C55E" : "#EF4444" },
        label: { text: crossover.type, style: { color: "#000000", background: crossover.type === "Golden Cross" ? "#22C55E" : "#EF4444", fontSize: "10px", fontFamily: "Inter, sans-serif" } },
      })),
    },
  }), [xAxisRange, smaCrossovers, isMounted]);

  const rsiOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      id: "rsi-chart",
      height: isMounted && window.innerWidth < 768 ? 100 : 200,
      type: "line",
      background: "transparent",
      foreColor: "#A1A1AA",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: false },
    },
    title: { text: "RSI", align: "left", style: { color: "#E4E4E7", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" } },
    xaxis: {
      type: "datetime",
      min: xAxisRange ? xAxisRange.min : undefined,
      max: xAxisRange ? xAxisRange.max : undefined,
      labels: { show: false },
    },
    yaxis: {
      min: 0,
      max: 100,
      title: { text: "RSI", style: { color: "#E4E4E7", fontFamily: "Inter, sans-serif" } },
      labels: {
        show: true,
        offsetX: -15,
        style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" },
        formatter: (val: number) => val.toFixed(0),
      },
      tickAmount: 5,
    },
    stroke: { curve: "smooth", width: 2 },
    colors: ["#0052FF"],
    grid: { borderColor: "#27272A" },
    tooltip: {
      enabled: true,
      theme: "dark",
      x: { format: "dd MMM HH:mm:ss" },
      y: { formatter: (val: number) => val.toFixed(2) },
      style: { fontFamily: "Inter, sans-serif" },
    },
  }), [xAxisRange, isMounted]);

  const macdOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      id: "macd-chart",
      height: isMounted && window.innerWidth < 768 ? 100 : 200,
      type: "line",
      background: "transparent",
      foreColor: "#A1A1AA",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: false },
    },
    title: { text: "MACD", align: "left", style: { color: "#E4E4E7", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" } },
    xaxis: {
      type: "datetime",
      min: xAxisRange ? xAxisRange.min : undefined,
      max: xAxisRange ? xAxisRange.max : undefined,
      labels: { show: false },
    },
    yaxis: {
      title: { text: "MACD", style: { color: "#E4E4E7", fontFamily: "Inter, sans-serif" } },
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
    grid: { borderColor: "#27272A" },
    plotOptions: {
      bar: { columnWidth: "80%" },
    },
    tooltip: {
      enabled: true,
      theme: "dark",
      x: { format: "dd MMM HH:mm:ss" },
      y: { formatter: (val: number) => val.toFixed(2) },
      style: { fontFamily: "Inter, sans-serif" },
    },
  }), [xAxisRange, isMounted]);

  const vwapOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: { 
      type: "line", 
      height: isMounted && window.innerWidth < 768 ? 100 : 200, 
      background: "transparent", 
      foreColor: "#A1A1AA", 
      toolbar: { show: false }, 
            zoom: { enabled: false }, 
      animations: { enabled: false } 
    },
    title: { 
      text: "VWAP", 
      align: "left", 
      style: { color: "#E4E4E7", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" } 
    },
    xaxis: { 
      type: "datetime", 
      min: xAxisRange ? xAxisRange.min : undefined, 
      max: xAxisRange ? xAxisRange.max : undefined, 
      labels: { show: false } 
    },
    yaxis: {
      title: { text: "VWAP", style: { color: "#E4E4E7", fontFamily: "Inter, sans-serif" } },
      labels: { 
        show: true, 
        offsetX: -15, 
        style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" }, 
        formatter: (val: number) => val.toFixed(2)
      },
      tickAmount: 6,
    },
    stroke: { curve: "smooth", width: 2 },
    colors: ["#F97316"],
    tooltip: { 
      enabled: true, 
      theme: "dark", 
      x: { format: "dd MMM HH:mm:ss" }, 
      y: { formatter: (val: number) => val.toFixed(2) }, 
      style: { fontFamily: "Inter, sans-serif" } 
    },
    annotations: {
      points: vwapSignals.map((signal) => ({
        x: signal.x,
        y: signal.y,
        marker: { size: 6, fillColor: signal.type === "Buy" ? "#22C55E" : "#EF4444" },
        label: { 
          text: signal.type, 
          style: { 
            color: "#000000", 
            background: signal.type === "Buy" ? "#22C55E" : "#EF4444", 
            fontSize: "10px", 
            fontFamily: "Inter, sans-serif" 
          } 
        },
      })),
    },
  }), [xAxisRange, vwapSignals, isMounted]);

  const supertrendOptions = useMemo<ApexCharts.ApexOptions>(() => {
    const bullishData: IndicatorData[] = [];
    const bearishData: IndicatorData[] = [];
    let currentBullish: IndicatorData[] = [];
    let currentBearish: IndicatorData[] = [];
    supertrendData.forEach((point, index) => {
      const dataPoint = { x: point.x, y: point.y };
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
        height: isMounted && window.innerWidth < 768 ? 100 : 200,
        background: "transparent",
        foreColor: "#A1A1AA",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: false },
      },
      title: { text: "Supertrend", align: "left", style: { color: "#E4E4E7", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" } },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : undefined,
        max: xAxisRange ? xAxisRange.max : undefined,
        labels: { show: false },
      },
      yaxis: {
        title: { text: "Price", style: { color: "#E4E4E7", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          offsetX: -15,
          style: { colors: "#A1A1AA", fontSize: "10px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => val.toFixed(2),
        },
        tickAmount: 6,
      },
      stroke: { curve: "smooth", width: 2 },
      colors: ["#22C55E", "#EF4444"],
      tooltip: {
        enabled: true,
        theme: "dark",
        x: { format: "dd MMM HH:mm:ss" },
        custom: ({ dataPointIndex }: any) => {
          const supertrend = supertrendData[dataPointIndex];
          return `
            <div class="p-2 bg-[#18181B] rounded-lg shadow-lg">
              <p class="text-sm font-semibold text-[#E4E4E7]"><span class="text-[#A1A1AA]">Price:</span> $${supertrend.y.toFixed(2)}</p>
              <p class="text-sm text-[#E4E4E7]"><span class="text-[#A1A1AA]">Trend:</span> <span class="${supertrend.trend === "Bullish" ? "text-[#22C55E]" : "text-[#EF4444]"}">${supertrend.trend}</span></p>
              <p class="text-sm text-[#E4E4E7]"><span class="text-[#A1A1AA]">Signal Strength:</span> ${supertrend.signalStrength.toFixed(2)}</p>
              <p class="text-sm text-[#E4E4E7]"><span class="text-[#A1A1AA]">Action:</span> ${supertrend.action}</p>
            </div>
          `;
        },
        style: { fontFamily: "Inter, sans-serif" },
      },
      series: [
        { name: "Supertrend (Bullish)", data: bullishData },
        { name: "Supertrend (Bearish)", data: bearishData },
      ],
    };
  }, [xAxisRange, supertrendData, isMounted]);

  // Ensure the component only renders after mounting to avoid SSR issues
  if (!isMounted) {
    return null;
  }

  // Calculate OHLC for the latest candle
  const latestCandle = candleData[candleData.length - 1];
  const ohlc = latestCandle
    ? `O: $${latestCandle.y[0].toFixed(4)} H: $${latestCandle.y[1].toFixed(4)} L: $${latestCandle.y[2].toFixed(4)} C: $${latestCandle.y[3].toFixed(4)}`
    : "O: - H: - L: - C: -";

  // Construct SYMBOL for branding overlay
  const symbol = token ? `${token.baseToken.symbol}/${token.quoteToken.symbol}` : "Loading...";
  const brandingOverlay = token
    ? `${symbol} • ${timeframe.toUpperCase()} • cypher.io ${ohlc}`
    : "Loading... • - • cypher.io O: - H: - L: - C: -";

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
        text: `Supertrend indicates a ${latestSupertrend.trend} trend with a signal strength of ${latestSupertrend.signalStrength.toFixed(2)}. Suggested action: ${latestSupertrend.action}.`,
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
        text: `Latest SMA Crossover: ${latestSmaCrossover.type} at ${new Date(latestSmaCrossover.x).toLocaleString()}.`,
        crossoverType: latestSmaCrossover.type,
      });
    }
    return insights.length > 0 ? insights : [{ text: "No trend analysis available." }];
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard!");
    }).catch((err) => {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy to clipboard.");
    });
  };

  // JSX Return Statement
  return (
    <div className="min-h-screen font-sans bg-[#0A0A0B] text-white w-full font-['Inter',_sans-serif]">
      <style jsx>{`
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
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
          background-color: #27272A;
          color: #E4E4E7;
          text-align: center;
          border-radius: 0;
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
        .no-scrollbar {
          overflow: hidden; /* Remove all scrollbars */
        }
        .trending-banner {
          background-color: #0F0F11;
          border-bottom: 1px solid #27272A;
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
          background-color: #18181B;
          border: 1px solid #27272A;
          border-radius: 0;
          min-width: 220px;
          white-space: nowrap;
        }
        .trending-token-card img {
          width: 24px;
          height: 24px;
          object-fit: cover;
          aspect-ratio: 1/1;
          background-color: #27272A;
          border: 1px solid #27272A;
          border-radius: 0;
          overflow: hidden;
          margin-right: 8px;
        }
        .rank-badge {
          background-color: #27272A;
          color: #E4E4E7;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 0;
          border: 1px solid #A1A1AA;
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
          background-color: #18181B;
          border: 1px solid #27272A;
          border-radius: 0;
          padding: 16px;
        }
        .swap-input {
          background-color: #27272A;
          border: 1px solid #27272A;
          border-radius: 0;
          padding: 8px;
          color: #E4E4E7;
          width: 100%;
          font-size: 14px;
          outline: none;
        }
        .swap-input:disabled {
          background-color: #1F1F23;
          color: #A1A1AA;
        }
        .swap-button {
          background-color: #0052FF;
          color: #FFFFFF;
          padding: 8px;
          border-radius: 0;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s ease-in-out;
          width: 100%;
        }
        .swap-button:hover {
          background-color: #003ECB;
        }
        .swap-button:disabled {
          background-color: #003ECB;
          opacity: 0.5;
          cursor: not-allowed;
        }
        .swap-arrow {
          background-color: #27272A;
          border-radius: 0;
          padding: 8px;
          cursor: pointer;
          transition: transform 0.2s ease-in-out;
        }
        .swap-arrow:hover {
          transform: scale(1.1);
        }
        .swap-info {
          font-size: 12px;
          color: #A1A1AA;
        }
        .wallet-button {
          background-color: #0052FF;
          color: #FFFFFF;
          padding: 8px;
          border-radius: 0;
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
          background-color: #003ECB;
        }
        .wallet-address {
          background-color: #27272A;
          border: 1px solid #27272A;
          border-radius: 0;
          padding: 8px;
          color: #E4E4E7;
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
          background-color: #18181B;
          border: 1px solid #27272A;
          border-radius: 8px;
          padding: 16px;
          width: 300px;
          max-width: 90%;
        }
        .wallet-option {
          background-color: #27272A;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .wallet-option:hover {
          background-color: #3F3F46;
        }
        .main-layout {
          display: flex;
          flex-direction: row;
          height: calc(100vh - 80px);
          width: 100%;
          overflow: hidden; /* Prevent horizontal overflow */
        }
        .chart-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #27272A;
        }
        .sidebar {
          width: 320px;
          background-color: #0F0F11;
          border-left: none; /* Remove border-left to avoid double line */
          overflow: hidden; /* Remove scrollbars */
        }
        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid #27272A;
        }
        .branding-overlay {
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: #E4E4E7;
        }
        .branding-overlay .symbol {
          color: #E4E4E7;
          font-weight: 600;
        }
        .branding-overlay .timeframe {
          color: #A1A1AA;
        }
        .branding-overlay .cypher {
          color: #0052FF;
        }
        .branding-overlay .ohlc {
          color: #A1A1AA;
          font-family: 'Courier New', monospace;
        }
        @media (max-width: 768px) {
          .main-layout {
            flex-direction: column;
            height: auto; /* Allow content to expand vertically on mobile */
          }
          .chart-section {
            border-right: none;
            border-bottom: 1px solid #27272A;
          }
          .sidebar {
            width: 100%;
            border-left: none;
            border-top: none; /* Remove border-top to avoid double line */
          }
          .chart-container {
            padding: 0;
          }
          .header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .timeframe-buttons {
            flex-wrap: wrap;
            gap: 4px;
          }
          .transactions-table th,
          .transactions-table td {
            padding: 4px;
            font-size: 9px;
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
          .swap-form-container {
            padding: 12px;
          }
          .swap-input {
            font-size: 12px;
            padding: 6px;
          }
          .swap-button,
          .wallet-button {
            font-size: 12px;
            padding: 6px;
          }
          .swap-info {
            font-size: 10px;
          }
          .wallet-address {
            font-size: 10px;
            padding: 6px;
          }
          .sidebar-header {
            padding: 12px;
          }
        }
      `}</style>

      {/* Wallet Connection Modal */}
      {showWalletModal && (
        <div className="wallet-modal">
          <div className="wallet-modal-content">
            <h3 className="text-lg font-semibold mb-4">Connect a Wallet</h3>
            {connectors.map((connector) => (
              <div
                key={connector.id}
                className="wallet-option"
                onClick={() => handleConnectWallet(connector)}
              >
                <FaWallet className="w-5 h-5 text-[#0052FF]" />
                <span>{connector.name}</span>
              </div>
            ))}
            <button
              onClick={() => setShowWalletModal(false)}
              className="mt-4 text-[#A1A1AA] hover:text-[#EF4444] text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Trending Tokens Banner */}
      <div className="trending-banner">
        {trendingError ? (
          <div className="text-[#EF4444] text-sm px-4 py-2">Error: {trendingError}</div>
        ) : trendingLoading ? (
          <div className="text-[#A1A1AA] text-sm px-4 py-2 flex items-center">
            <svg
              className="animate-spin h-5 w-5 text-[#0052FF] mr-2"
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
          <div className="text-[#A1A1AA] text-sm px-4 py-2">No trending tokens available.</div>
        ) : (
          <div className="trending-tokens-container">
            {[...trendingTokens, ...trendingTokens].map((token, index) => (
              <Link
                href={`/token-screener/${token.pairAddress}/chart`}
                key={`${token.pairAddress}-${index}`}
                passHref
              >
                <div className="trending-token-card">
                  <span className="rank-badge">#{(index % trendingTokens.length) + 1}</span>
                  <img
                    src={token.imageUrl}
                    alt={`${token.symbol} logo`}
                    onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/24/27272A/FFFFFF?text=T")}
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-[#E4E4E7] text-sm">{token.symbol}</span>
                    <span className="block text-xs text-[#A1A1AA] truncate max-w-[60px]">{token.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[#E4E4E7] text-sm">${parseFloat(token.priceUsd).toFixed(4)}</span>
                    <span
                      className={`text-xs ${token.priceChange24h >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}
                    >
                      {token.priceChange24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-2 border-b border-[#27272A] flex flex-wrap justify-between items-center w-full bg-[#0F0F11] shadow-sm header">
        <div className="flex items-center gap-2">
          {token?.logoUrl && (
            <img
              src={token.logoUrl}
              alt={`${token.baseToken.name} logo`}
              className="w-6 h-6 rounded-full border border-[#27272A]"
              onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/48")}
            />
          )}
          <h1 className="text-base font-semibold tracking-tight">
            {token ? `${token.baseToken.symbol}/${token.quoteToken.symbol}` : "Loading..."}
            <span className="ml-2 text-xs text-[#A1A1AA] font-normal">on Base Chain</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-[#A1A1AA]">Last Updated: {lastUpdated}</div>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-layout">
        {/* Chart Section */}
        <div className="chart-section">
          {initialLoading ? (
            <div className="text-center text-sm flex items-center justify-center h-full bg-[#0F0F11]">
              <svg className="animate-spin h-6 w-6 text-[#0052FF] mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </div>
          ) : error ? (
            <div className="text-[#EF4444] text-center text-sm bg-[#0F0F11] p-4 h-full flex items-center justify-center">{error}</div>
          ) : (
            <div className="bg-[#0F0F11] border border-[#27272A] w-full h-full flex flex-col shadow-sm" style={{ borderRadius: 0 }}>
              <div className="flex flex-wrap justify-between items-center px-4 py-3 border-b border-[#27272A]">
                <div className="flex space-x-2 mb-2 lg:mb-0">
                  <button
                    onClick={() => setChartView("Price")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${chartView === "Price" ? "bg-[#0052FF] text-white shadow-sm" : "bg-[#18181B] text-[#A1A1AA] hover:bg-[#27272A]"}`}
                  >
                    Price
                  </button>
                  <button
                    onClick={() => setChartView("MarketCap")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${chartView === "MarketCap" ? "bg-[#0052FF] text-white shadow-sm" : "bg-[#18181B] text-[#A1A1AA] hover:bg-[#27272A]"}`}
                  >
                    Market Cap
                  </button>
                  {chartView === "Price" && (
                    <>
                      <button
                        onClick={() => setChartType("Candlestick")}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${chartType === "Candlestick" ? "bg-[#0052FF] text-white shadow-sm" : "bg-[#18181B] text-[#A1A1AA] hover:bg-[#27272A]"}`}
                      >
                        Candlestick
                      </button>
                      <button
                        onClick={() => setChartType("Line")}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${chartType === "Line" ? "bg-[#0052FF] text-white shadow-sm" : "bg-[#18181B] text-[#A1A1AA] hover:bg-[#27272A]"}`}
                      >
                        Line
                      </button>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 timeframe-buttons">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex gap-1 items-center">
                      <span className="text-xs text-[#A1A1AA] px-2 py-1">Timeframe:</span>
                      {["1m", "5m", "15m", "1h", "4h", "12h", "1d"].map((tf) => (
                        <button
                          key={tf}
                          onClick={() => {
                            setTimeframe(tf);
                            if (token) fetchChartData(poolAddress as string, token);
                          }}
                          disabled={initialLoading}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                            timeframe === tf ? "bg-[#0052FF] text-white shadow-sm" : "bg-[#18181B] text-[#A1A1AA] hover:bg-[#27272A]"
                          } ${initialLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {initialLoading && timeframe === tf ? (
                            <svg className="animate-spin h-4 w-4 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            tf
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative px-4 py-3 flex-1">
                <div className="absolute top-4 left-4 z-10 branding-overlay">
                  <span className="symbol">{symbol}</span>
                  <span className="mx-1">•</span>
                  <span className="timeframe">{timeframe.toUpperCase()}</span>
                  <span className="mx-1">•</span>
                  <span className="cypher">cypher.io</span>
                  <span className="ml-1 ohlc">{ohlc}</span>
                </div>

                {chartView === "Price" ? (
                  chartType === "Candlestick" ? (
                    candleData.length > 0 ? (
                      <Chart
                        options={candlestickOptions}
                        series={[{ data: candleData }]}
                        type="candlestick"
                        height={isMounted && window.innerWidth < 768 ? 300 : "100%"}
                        width="100%"
                      />
                    ) : (
                      <div className="text-center text-sm text-[#A1A1AA] h-full flex items-center justify-center">No chart data available.</div>
                    )
                  ) : (
                    lineData.length > 0 ? (
                      <Chart
                        options={lineOptions}
                        series={[{ name: "Price", data: lineData }]}
                        type="line"
                        height={isMounted && window.innerWidth < 768 ? 300 : "100%"}
                        width="100%"
                      />
                    ) : (
                      <div className="text-center text-sm text-[#A1A1AA] h-full flex items-center justify-center">No chart data available.</div>
                    )
                  )
                ) : (
                  marketCapData.length > 0 ? (
                    <Chart
                      options={candlestickOptions}
                      series={[{ data: marketCapData }]}
                      type="candlestick"
                      height={isMounted && window.innerWidth < 768 ? 300 : "100%"}
                      width="100%"
                    />
                  ) : (
                    <div className="text-center text-sm text-[#A1A1AA] h-full flex items-center justify-center">No chart data available.</div>
                  )
                )}
              </div>

              <div className="px-4 flex-1 no-scrollbar">
                <h3 className="text-sm font-semibold mb-2 text-[#E4E4E7] pl-1">Transactions</h3>
                <div className="max-h-60 no-scrollbar w-full">
                  <table className="w-full text-[11px] text-left font-mono transactions-table">
                    <thead className="text-[10px] text-[#A1A1AA] uppercase bg-[#0F0F11] sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-2 py-2">Time</th>
                        <th scope="col" className="px-2 py-2">Type</th>
                        <th scope="col" className="px-2 py-2">Price (USD)</th>
                        <th scope="col" className="px-2 py-2">Price (ETH)</th>
                        <th scope="col" className="px-2 py-2 text-right">Token Amount</th>
                        <th scope="col" className="px-2 py-2 text-right">Token Price</th>
                        <th scope="col" className="px-2 py-2 text-right">From</th>
                        <th scope="col" className="px-2 py-2 text-right">To</th>
                        <th scope="col" className="px-2 py-2 text-right">Maker</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 && !transactionLoading ? (
                        <tr>
                          <td colSpan={9} className="px-2 py-3 text-center text-[#A1A1AA]">
                            No transactions available.
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx, index) => {
                          const tokenAmount = tx.tokenAmount || 0;
                          const tokenPriceInUsd = token?.priceUsd ? parseFloat(token.priceUsd) : 0;
                          const usdValue = Number.isFinite(tokenAmount * tokenPriceInUsd)
                            ? (tokenAmount * tokenPriceInUsd).toFixed(2)
                            : "0.00";
                          const ethValue = ethPrice && Number.isFinite((tokenAmount * tokenPriceInUsd) / ethPrice)
                            ? ((tokenAmount * tokenPriceInUsd) / ethPrice).toFixed(4)
                            : "0.0000";
                          const isBuy = token && tx.to.toLowerCase() === token.pairAddress.toLowerCase();
                          const maker = isBuy ? tx.from : tx.to;
                          const shortFrom = `${tx.from.slice(0, 4)}...${tx.from.slice(-4)}`;
                          const shortTo = `${tx.to.slice(0, 4)}...${tx.to.slice(-4)}`;
                          const shortMaker = `${maker.slice(0, 4)}...${maker.slice(-4)}`;

                          return (
                            <tr
                              key={tx.id}
                              className={`border-b border-[#27272A] text-[#E4E4E7] fade-in ${
                                index % 2 === 0 ? "bg-[#18181B]" : "bg-[#0F0F11]"
                              }`}
                              ref={index === transactions.length - 1 ? lastTransactionRef : null}
                            >
                              <td className="px-2 py-3">
                                {new Date(tx.timestamp).toLocaleString("en-US", {
                                  month: "short",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                  hour12: true,
                                }).replace(",", "")}
                              </td>
                              <td className={`px-2 py-3 ${isBuy ? "text-[#22C55E]" : "text-[#EF4444]"} font-bold`}>
                                {isBuy ? "BUY" : "SELL"}
                              </td>
                              <td className="px-2 py-3 text-[#E4E4E7]">${usdValue}</td>
                              <td className="px-2 py-3 text-[#E4E4E7]">{ethValue}</td>
                              <td className="px-2 py-3 text-right">{Number.isFinite(tokenAmount) ? tokenAmount.toFixed(4) : "0.0000"}</td>
                              <td className="px-2 py-3 text-right text-[#E4E4E7]">${Number.isFinite(tokenPriceInUsd) ? tokenPriceInUsd.toFixed(6) : "0.000000"}</td>
                              <td className="px-2 py-3 text-right">
                                <div className="tooltip">
                                  <a
                                    href={`https://basescan.org/address/${tx.from}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#0052FF] hover:underline"
                                  >
                                    {shortFrom}
                                  </a>
                                  <span className="tooltiptext">{tx.from}</span>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-right">
                                <div className="tooltip">
                                  <a
                                    href={`https://basescan.org/address/${tx.to}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#0052FF] hover:underline"
                                  >
                                    {shortTo}
                                  </a>
                                  <span className="tooltiptext">{tx.to}</span>
                                </div>
                              </td>
                              <td className="px-2 py-3 text-right">
                                <div className="tooltip">
                                  <a
                                    href={`https://basescan.org/address/${maker}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#0052FF] hover:underline"
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
                    <div className="text-center text-sm text-[#A1A1AA] py-2">
                      <svg
                        className="animate-spin h-5 w-5 text-[#0052FF] mx-auto pulse"
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

              <div className="flex overflow-x-auto border-t border-[#27272A] bg-[#0F0F11] mt-4 w-full">
                {availableIndicators.map((indicator) => (
                  <button
                    key={indicator}
                    onClick={() => setActiveIndicatorTab(indicator)}
                    className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      activeIndicatorTab === indicator ? "bg-[#0052FF] text-white" : "text-[#A1A1AA] hover:bg-[#27272A]"
                    }`}
                  >
                    {indicator}
                  </button>
                ))}
              </div>

              <div className="px-4 py-3 w-full flex-1">
                {activeIndicatorTab === "Volume" && (
                  <Chart
                    options={volumeOptions}
                    series={[{ name: "Volume", data: volumeData }]}
                    type="bar"
                    height={isMounted && window.innerWidth < 768 ? 100 : "100%"}
                    width="100%"
                  />
                )}
                {activeIndicatorTab === "SMA" && (
                  <Chart
                    options={smaOptions}
                    series={[{ name: "SMA 20", data: sma20Data }, { name: "SMA 50", data: sma50Data }]}
                    type="line"
                    height={isMounted && window.innerWidth < 768 ? 100 : "100%"}
                    width="100%"
                  />
                )}
                {activeIndicatorTab === "RSI" && (
                  <Chart
                    options={rsiOptions}
                    series={[{ name: "RSI", data: rsiData }]}
                    type="line"
                    height={isMounted && window.innerWidth < 768 ? 100 : "100%"}
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
                    height={isMounted && window.innerWidth < 768 ? 100 : "100%"}
                    width="100%"
                  />
                )}
                {activeIndicatorTab === "VWAP" && (
                  <Chart
                    options={vwapOptions}
                    series={[{ name: "VWAP", data: vwapData }]}
                    type="line"
                    height={isMounted && window.innerWidth < 768 ? 100 : "100%"}
                    width="100%"
                  />
                )}
                {activeIndicatorTab === "Supertrend" && (
                  <Chart
                    options={supertrendOptions}
                    series={supertrendOptions.series as any}
                    type="line"
                    height={isMounted && window.innerWidth < 768 ? 100 : "100%"}
                    width="100%"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            <h2 className="text-lg font-semibold text-[#E4E4E7]">
              {token ? `${token.baseToken.symbol}/${token.quoteToken.symbol}` : "Details"}
            </h2>
          </div>
          <div className="p-4 h-full no-scrollbar">
            {initialLoading ? (
              <div className="text-center text-sm text-[#A1A1AA] bg-[#18181B] rounded-lg p-4">Loading token data...</div>
            ) : error ? (
              <div className="text-[#EF4444] text-center text-sm bg-[#18181B] rounded-lg p-4">{error}</div>
            ) : token ? (
              <div className="space-y-4">
                {/* Token Info Card */}
                <div className="bg-[#18181B] rounded-lg p-4 border border-[#27272A]">
                  <div className="relative mb-4">
                    <img
                      src={token.bannerUrl}
                      alt={`${token.baseToken.name} banner`}
                      className="w-full h-20 object-cover rounded-lg border border-[#27272A]"
                      onError={(e) => (e.currentTarget.src = "https://i.imgur.com/Fo2D7cK.png")}
                    />
                    <img
                      src={token.logoUrl}
                      alt={`${token.baseToken.name} logo`}
                      className="absolute -bottom-4 left-2 w-10 h-10 rounded-full border-2 border-[#18181B]"
                      onError={(e) => (e.currentTarget.src = "https://firebasestorage.googleapis.com/v0/b/homebase-dapp.firebasestorage.app/o/0x73cb479f2ccf77bad90bcda91e3987358437240a(2).png?alt=media&token=1cd408cf-c6a9-4264-8d30-0e1c5a544397")}
                    />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight mt-4">
                    {token.baseToken.name} ({token.baseToken.symbol})
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-[#A1A1AA] mt-1">
                    <span>Pool:</span>
                    <span className="truncate">{token.poolAddress}</span>
                    <button onClick={() => copyToClipboard(token.poolAddress)} className="hover:text-[#0052FF]">
                      <ClipboardIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#A1A1AA] mt-1">
                    <span>Pair:</span>
                    <span className="truncate">{token.pairAddress}</span>
                    <button onClick={() => copyToClipboard(token.pairAddress)} className="hover:text-[#0052FF]">
                      <ClipboardIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Swap Form Card */}
                <div className="swap-form-container">
                  <h3 className="text-sm font-semibold mb-3 text-[#E4E4E7]">Swap Tokens</h3>
                  {/* Wallet Connection */}
                  <div className="mb-4">
                    {isConnected ? (
                      <div className="wallet-address">
                        <div className="flex items-center gap-2">
                          <FaWallet className="text-[#0052FF] w-4 h-4" />
                          <span className="truncate">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                        </div>
                        <button
                          onClick={() => disconnect()}
                          className="text-[#A1A1AA] hover:text-[#EF4444] text-xs"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowWalletModal(true)}
                        className="wallet-button"
                      >
                        <FaWallet className="w-4 h-4" />
                        Connect Wallet
                      </button>
                    )}
                  </div>

                  {/* Token In */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#A1A1AA]">You Pay</span>
                      <span className="text-xs text-[#A1A1AA]">
                        Balance: {walletBalance} {tokenIn?.symbol || ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#27272A] text-[#E4E4E7] rounded p-2 font-mono text-sm">
                        {tokenIn ? tokenIn.symbol : "Select"}
                      </span>
                      <input
                        type="number"
                        placeholder="0.0"
                        value={amountIn}
                        onChange={(e) => setAmountIn(e.target.value)}
                        className="swap-input"
                        disabled={!tokenIn || !isConnected}
                      />
                    </div>
                  </div>

                  {/* Swap Arrow */}
                  <div className="flex justify-center mb-4">
                    <button
                      onClick={handleSwapTokens}
                      className="swap-arrow"
                      disabled={!tokenIn || !tokenOut}
                    >
                      <FaExchangeAlt className="w-5 h-5 text-[#0052FF]" />
                    </button>
                  </div>

                  {/* Token Out */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#A1A1AA]">You Receive</span>
                      <span className="text-xs text-[#A1A1AA]">
                        Est. {amountOut || "0.0"} {tokenOut?.symbol || ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#27272A] text-[#E4E4E7] rounded p-2 font-mono text-sm">
                        {tokenOut ? tokenOut.symbol : "Select"}
                      </span>
                      <input
                        type="number"
                        placeholder="0.0"
                        value={amountOut}
                        disabled
                        className="swap-input"
                      />
                    </div>
                  </div>

                  {/* Swap Info */}
                  <div className="swap-info mb-4">
                    <div className="flex justify-between">
                      <span>Price Impact:</span>
                      <span className={priceImpact > 5 ? "text-[#EF4444]" : "text-[#E4E4E7]"}>
                        {priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Slippage Tolerance:</span>
                      <span>{slippage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gas Estimate:</span>
                      <span>{gasEstimate} Gwei</span>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <button
                    onClick={handleSwapWithApproval}
                    disabled={isSwapLoading || !isConnected || !amountIn || !tokenIn || !tokenOut}
                    className="swap-button"
                  >
                    {isSwapLoading ? "Processing..." : "Swap"}
                  </button>
                </div>

                {/* Market Stats Card */}
                <div className="bg-[#18181B] rounded-lg p-4 border border-[#27272A]">
                  <h3 className="text-sm font-semibold mb-3">Market Stats</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-[#A1A1AA]">Price (USD)</span>
                      <span className="font-medium">${parseFloat(token.priceUsd).toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#A1A1AA]">Market Cap</span>
                      <span className="font-medium">{formatLargeNumber(token.marketCap)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#A1A1AA]">Liquidity</span>
                      <span className="font-medium">{formatLargeNumber(token.liquidity.usd)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#A1A1AA]">FDV</span>
                      <span className="font-medium">{formatLargeNumber(token.fdv)}</span>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics Card */}
                {performanceMetrics && (
                  <div className="bg-[#18181B] rounded-lg p-4 border border-[#27272A]">
                    <h3 className="text-sm font-semibold mb-3">Performance</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          performanceMetrics.change_5m >= 0 ? "bg-[#22C55E]/10" : "bg-[#EF4444]/10"
                        }`}
                      >
                        <span className="text-[#A1A1AA]">5m</span>
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            performanceMetrics.change_5m >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                          }`}
                        >
                          {performanceMetrics.change_5m >= 0 ? (
                            <ArrowUpIcon className="w-4 h-4" />
                          ) : (
                            <ArrowDownIcon className="w-4 h-4" />
                          )}
                          {performanceMetrics.change_5m.toFixed(2)}%
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          performanceMetrics.change_1h >= 0 ? "bg-[#22C55E]/10" : "bg-[#EF4444]/10"
                        }`}
                      >
                        <span className="text-[#A1A1AA]">1h</span>
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            performanceMetrics.change_1h >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                          }`}
                        >
                          {performanceMetrics.change_1h >= 0 ? (
                            <ArrowUpIcon className="w-4 h-4" />
                          ) : (
                            <ArrowDownIcon className="w-4 h-4" />
                          )}
                          {performanceMetrics.change_1h.toFixed(2)}%
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          performanceMetrics.change_4h >= 0 ? "bg-[#22C55E]/10" : "bg-[#EF4444]/10"
                        }`}
                      >
                        <span className="text-[#A1A1AA]">4h</span>
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            performanceMetrics.change_4h >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                          }`}
                        >
                          {performanceMetrics.change_4h >= 0 ? (
                            <ArrowUpIcon className="w-4 h-4" />
                          ) : (
                            <ArrowDownIcon className="w-4 h-4" />
                          )}
                          {performanceMetrics.change_4h.toFixed(2)}%
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          performanceMetrics.change_24h >= 0 ? "bg-[#22C55E]/10" : "bg-[#EF4444]/10"
                        }`}
                      >
                        <span className="text-[#A1A1AA]">24h</span>
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            performanceMetrics.change_24h >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                          }`}
                        >
                          {performanceMetrics.change_24h >= 0 ? (
                            <ArrowUpIcon className="w-4 h-4" />
                          ) : (
                            <ArrowDownIcon className="w-4 h-4" />
                          )}
                          {performanceMetrics.change_24h.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Trend Analysis Card */}
                <div className="bg-[#18181B] rounded-lg p-4 border border-[#27272A]">
                  <h3 className="text-sm font-semibold mb-3">Trend Analysis</h3>
                  <div className="text-sm text-[#A1A1AA] space-y-2">
                    {getTrendAnalysis().map((insight, index) => (
                      <div key={index} className="flex items-start gap-2">
                        {insight.trend && (
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              insight.trend === "Bullish" ? "bg-[#22C55E] text-[#E4E4E7]" : "bg-[#EF4444] text-[#E4E4E7]"
                            }`}
                          >
                            {insight.trend}
                          </span>
                        )}
                        {insight.rsiStatus && (
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              insight.rsiStatus === "Overbought"
                                ? "bg-[#EF4444] text-[#E4E4E7]"
                                : insight.rsiStatus === "Oversold"
                                ? "bg-[#22C55E] text-[#E4E4E7]"
                                : "bg-[#27272A] text-[#E4E4E7]"
                            }`}
                          >
                            {insight.rsiStatus}
                          </span>
                        )}
                        {insight.crossoverType && (
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              insight.crossoverType === "Golden Cross"
                                ? "bg-[#22C55E] text-[#E4E4E7]"
                                : "bg-[#EF4444] text-[#E4E4E7]"
                            }`}
                          >
                            {insight.crossoverType}
                          </span>
                        )}
                        <span>{insight.text}</span>
                      </div>
                    ))}
                    <div className="mt-2">
                      <Sparklines data={getSparklineData()} width={200} height={30}>
                        <SparklinesLine
                          color={
                            getSparklineData()[getSparklineData().length - 1] >= getSparklineData()[0]
                              ? "#22C55E"
                              : "#EF4444"
                          }
                        />
                      </Sparklines>
                    </div>
                  </div>
                </div>

                {/* Ads Card */}
                <div className="bg-[#18181B] rounded-lg p-4 border border-[#27272A]">
                  <h3 className="text-sm font-semibold mb-3">Advertisement</h3>
                  {token.adImageUrl ? (
                    <img
                      src={token.adImageUrl}
                      alt="Project Ad"
                      className="w-full h-20 object-cover rounded-lg border border-[#27272A]"
                      onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/300x100?text=Ad+Space")}
                    />
                  ) : (
                    <div className="text-sm text-[#A1A1AA] text-center bg-[#27272A] rounded-lg p-4">
                      Advertise Here
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-[#A1A1AA] bg-[#18181B] rounded-lg p-4">
                No token data available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
     