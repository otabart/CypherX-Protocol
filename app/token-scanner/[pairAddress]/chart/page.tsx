"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Chart from "react-apexcharts";
import { ClipboardIcon, SunIcon, MoonIcon, ShareIcon } from "@heroicons/react/24/outline";
import { FaGlobe, FaTelegram, FaTwitter, FaDiscord } from "react-icons/fa";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface TokenMetadata {
  pairAddress: string;
  baseToken: { name: string; symbol: string };
  quoteToken: { name: string; symbol: string };
  priceUsd: string;
  liquidity: { usd: number };
  marketCap: number;
  fdv: number;
  bannerUrl?: string;
  logoUrl?: string;
  socials?: { website?: string; telegram?: string; twitter?: string; warpcast?: string };
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

interface Pattern {
  type: string;
  start: number;
  end: number;
  points: number[];
}

export default function ChartPage() {
  const { pairAddress } = useParams();
  const [token, setToken] = useState<TokenMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<string>("1h");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== "undefined" && window.innerWidth < 1024 ? false : true
  );
  const [candleData, setCandleData] = useState<any[]>([]);
  const [allCandleData, setAllCandleData] = useState<any[]>([]); // Store all historical data
  const [marketCapData, setMarketCapData] = useState<any[]>([]);
  const [allMarketCapData, setAllMarketCapData] = useState<any[]>([]); // Store all market cap data
  const [volumeData, setVolumeData] = useState<IndicatorData[]>([]);
  const [sma20Data, setSma20Data] = useState<IndicatorData[]>([]); // SMA 20
  const [sma50Data, setSma50Data] = useState<IndicatorData[]>([]); // SMA 50
  const [rsiData, setRsiData] = useState<IndicatorData[]>([]);
  const [macdData, setMacdData] = useState<MACDData[]>([]);
  const [vwapData, setVwapData] = useState<IndicatorData[]>([]);
  const [activeIndicatorTab, setActiveIndicatorTab] = useState<string>("Volume");
  const [chartView, setChartView] = useState<"Price" | "MarketCap">("Price");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [xAxisRange, setXAxisRange] = useState<{ min: number; max: number } | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    change1h: number;
    change1d: number;
    change7d: number;
    change30d: number;
    volumeChange1h: number;
    volumeChange1d: number;
    volumeChange7d: number;
    volumeChange30d: number;
  }>({
    change1h: 0,
    change1d: 0,
    change7d: 0,
    change30d: 0,
    volumeChange1h: 0,
    volumeChange1d: 0,
    volumeChange7d: 0,
    volumeChange30d: 0,
  });
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [vwapSignals, setVwapSignals] = useState<{ x: number; y: number; type: "Buy" | "Sell" }[]>([]);
  const [smaCrossovers, setSmaCrossovers] = useState<{ x: number; y: number; type: "Golden Cross" | "Death Cross" }[]>([]);

  const debounce = <F extends (...args: any[]) => void>(func: F, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<F>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const downsampleData = (data: OHLCVData[], factor: number): OHLCVData[] => {
    if (data.length <= factor) return data;
    return data.filter((_, index) => index % factor === 0);
  };

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

      let socials = {};
      try {
        setSocialLoading(true);
        const tokenDocRef = doc(db, "tokens", poolAddress);
        const tokenDoc = await getDoc(tokenDocRef);
        if (tokenDoc.exists()) {
          socials = tokenDoc.data().socials || {};
        } else {
          setSocialError("Social links not found for this token.");
        }
      } catch (err: any) {
        console.error("Error fetching social links:", err);
        setSocialError("Failed to load social links.");
      } finally {
        setSocialLoading(false);
      }

      const newMetadata: TokenMetadata = {
        pairAddress: poolAddress,
        baseToken: { name: pair.baseToken.name, symbol: pair.baseToken.symbol },
        quoteToken: { name: pair.quoteToken.name, symbol: pair.quoteToken.symbol },
        priceUsd: pair.priceUsd,
        liquidity: { usd: pair.liquidity?.usd || 0 },
        marketCap: pair.marketCap || 0,
        fdv: pair.fdv || 0,
        bannerUrl: pair.info?.image || "https://via.placeholder.com/300x100",
        logoUrl: pair.baseToken.logo || "https://via.placeholder.com/48",
        socials,
      };

      setToken((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(newMetadata)) {
          return newMetadata;
        }
        return prev;
      });
      setLastUpdated(new Date().toLocaleString());
      setError(null);
    } catch (err: any) {
      setError(`Failed to load token data: ${err.message}`);
    }
  }, []);

  const calculatePerformanceMetrics = (data: OHLCVData[], selectedTimeframe: string) => {
    if (data.length < 2) return {
      change1h: 0, change1d: 0, change7d: 0, change30d: 0,
      volumeChange1h: 0, volumeChange1d: 0, volumeChange7d: 0, volumeChange30d: 0
    };

    const now = Date.now();
    const latestClose = data[data.length - 1].close;
    const latestVolume = data[data.length - 1].volume;

    const timeframeToMs: { [key: string]: number } = {
      "1m": 1 * 60 * 1000,
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "30m": 30 * 60 * 1000,
      "1h": 1 * 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "1w": 7 * 24 * 60 * 60 * 1000,
      "1mo": 30 * 24 * 60 * 60 * 1000,
    };

    const timeframeInterval = timeframeToMs[selectedTimeframe] || timeframeToMs["1h"];
    const adjustedData = data.filter(d => now - d.timestamp <= 30 * 24 * 60 * 60 * 1000); // Limit to last 30 days

    const findClosestData = (timeAgo: number) => {
      const targetTime = now - timeAgo;
      const closest = adjustedData.reduce((prev: OHLCVData, curr: OHLCVData) =>
        Math.abs(curr.timestamp - targetTime) < Math.abs(prev.timestamp - targetTime) ? curr : prev,
        adjustedData[0]
      );
      return { close: closest.close, volume: closest.volume };
    };

    const { close: price1hAgo, volume: volume1hAgo } = findClosestData(1 * 60 * 60 * 1000);
    const { close: price1dAgo, volume: volume1dAgo } = findClosestData(24 * 60 * 60 * 1000);
    const { close: price7dAgo, volume: volume7dAgo } = findClosestData(7 * 24 * 60 * 60 * 1000);
    const { close: price30dAgo, volume: volume30dAgo } = findClosestData(30 * 24 * 60 * 60 * 1000);

    const change1h = ((latestClose - price1hAgo) / price1hAgo) * 100;
    const change1d = ((latestClose - price1dAgo) / price1dAgo) * 100;
    const change7d = ((latestClose - price7dAgo) / price7dAgo) * 100;
    const change30d = ((latestClose - price30dAgo) / price30dAgo) * 100;

    const volumeChange1h = ((latestVolume - volume1hAgo) / volume1hAgo) * 100;
    const volumeChange1d = ((latestVolume - volume1dAgo) / volume1dAgo) * 100;
    const volumeChange7d = ((latestVolume - volume7dAgo) / volume7dAgo) * 100;
    const volumeChange30d = ((latestVolume - volume30dAgo) / volume30dAgo) * 100;

    return {
      change1h: isNaN(change1h) ? 0 : change1h,
      change1d: isNaN(change1d) ? 0 : change1d,
      change7d: isNaN(change7d) ? 0 : change7d,
      change30d: isNaN(change30d) ? 0 : change30d,
      volumeChange1h: isNaN(volumeChange1h) ? 0 : volumeChange1h,
      volumeChange1d: isNaN(volumeChange1d) ? 0 : volumeChange1d,
      volumeChange7d: isNaN(volumeChange7d) ? 0 : volumeChange7d,
      volumeChange30d: isNaN(volumeChange30d) ? 0 : volumeChange30d,
    };
  };

  const detectPatterns = (data: OHLCVData[]) => {
    const detectedPatterns: Pattern[] = [];
    const closes = data.map((d) => d.close);

    for (let i = 20; i < closes.length - 20; i++) {
      const window = closes.slice(i - 20, i + 20);
      const max1Index = window.indexOf(Math.max(...window.slice(0, 20)));
      const max2Index = window.slice(20).indexOf(Math.max(...window.slice(20))) + 20;
      const minBetween = Math.min(...window.slice(max1Index, max2Index));
      if (
        Math.abs(window[max1Index] - window[max2Index]) < window[max1Index] * 0.02 &&
        window[max1Index] - minBetween > window[max1Index] * 0.05
      ) {
        detectedPatterns.push({
          type: "Double Top",
          start: data[i - 20 + max1Index].timestamp,
          end: data[i - 20 + max2Index].timestamp,
          points: [window[max1Index], minBetween, window[max2Index]],
        });
      }
    }

    for (let i = 30; i < closes.length - 30; i++) {
      const window = closes.slice(i - 30, i + 30);
      const highs = window.map((_, idx) => Math.max(...window.slice(0, idx + 1)));
      const lows = window.map((_, idx) => Math.min(...window.slice(0, idx + 1)));
      const highTrend = highs[highs.length - 1] - highs[0];
      const lowTrend = lows[lows.length - 1] - lows[0];
      if (Math.abs(highTrend) < highs[0] * 0.03 && Math.abs(lowTrend) < lows[0] * 0.03) {
        detectedPatterns.push({
          type: "Symmetrical Triangle",
          start: data[i - 30].timestamp,
          end: data[i + 30].timestamp,
          points: [highs[0], lows[0], highs[highs.length - 1], lows[lows.length - 1]],
        });
      }
    }

    return detectedPatterns;
  };

  const fetchChartData = useCallback(async (poolAddress: string, append: boolean = false) => {
    try {
      const timeframeMap: { [key: string]: { timeframe: string; aggregate: string } } = {
        "1m": { timeframe: "minute", aggregate: "1" },
        "5m": { timeframe: "minute", aggregate: "5" },
        "15m": { timeframe: "minute", aggregate: "15" },
        "30m": { timeframe: "minute", aggregate: "30" },
        "1h": { timeframe: "hour", aggregate: "1" },
        "4h": { timeframe: "hour", aggregate: "4" },
        "6h": { timeframe: "hour", aggregate: "6" },
        "1d": { timeframe: "day", aggregate: "1" },
        "1w": { timeframe: "day", aggregate: "7" },
        "1mo": { timeframe: "day", aggregate: "30" },
      };

      const { timeframe: timeframeParam, aggregate } =
        timeframeMap[timeframe] || timeframeMap["1h"];
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddress}/ohlcv/${timeframeParam}?aggregate=${aggregate}`,
        {
          cache: "no-store",
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; HomebaseBot/1.0)",
          },
        }
      );
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch chart data: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      if (!data.data || !data.data.attributes || !data.data.attributes.ohlcv_list) {
        throw new Error("No chart data returned");
      }

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

      const downsampleFactor = 2;
      const downsampledOhlcvList: OHLCVData[] = downsampleData(ohlcvList, downsampleFactor);

      const newPriceData = downsampledOhlcvList.map((d: OHLCVData) => ({
        x: new Date(d.timestamp),
        y: [d.open, d.high, d.low, d.close],
      }));

      setAllCandleData((prev) => {
        if (append && prev.length > 0) {
          const lastTimestamp = prev[prev.length - 1].x.getTime();
          const newEntries = newPriceData.filter((d) => d.x.getTime() > lastTimestamp);
          return [...prev, ...newEntries];
        }
        return newPriceData;
      });

      setCandleData((prev) => {
        if (append && prev.length > 0) {
          const lastTimestamp = prev[prev.length - 1].x.getTime();
          const newEntries = newPriceData.filter((d) => d.x.getTime() > lastTimestamp);
          return [...prev, ...newEntries].slice(-300);
        }
        return newPriceData.slice(-300);
      });

      const newMarketCapData = downsampledOhlcvList.map((d: OHLCVData) => {
        const pricePerToken = parseFloat(token?.priceUsd || "0");
        const totalSupply = pricePerToken ? (token?.marketCap || 0) / pricePerToken : 0;
        return {
          x: new Date(d.timestamp),
          y: [
            d.open * totalSupply,
            d.high * totalSupply,
            d.low * totalSupply,
            d.close * totalSupply,
          ],
        };
      });

      setAllMarketCapData((prev) => {
        if (append && prev.length > 0) {
          const lastTimestamp = prev[prev.length - 1].x.getTime();
          const newEntries = newMarketCapData.filter((d) => d.x.getTime() > lastTimestamp);
          return [...prev, ...newEntries];
        }
        return newMarketCapData;
      });

      setMarketCapData((prev) => {
        if (append && prev.length > 0) {
          const lastTimestamp = prev[prev.length - 1].x.getTime();
          const newEntries = newMarketCapData.filter((d) => d.x.getTime() > lastTimestamp);
          return [...prev, ...newEntries].slice(-300);
        }
        return newMarketCapData.slice(-300);
      });

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
        if (prevSma20 < prevSma50 && currSma20 > currSma50) {
          crossovers.push({ x: sma20Values[i].x, y: currSma20, type: "Golden Cross" });
        } else if (prevSma20 > prevSma50 && currSma20 < currSma50) {
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
        const losses: number =
          Math.abs(rsiSlice.filter((c: number) => c < 0).reduce((sum: number, c: number) => sum + c, 0)) /
          rsiPeriod;
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
      const macdLine: number[] = ema12
        .map((v, i) => v - (ema26[i] || 0))
        .slice(macdSlow - macdFast);
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
      const signals: { x: number; y: number; type: "Buy" | "Sell" }[] = [];
      downsampledOhlcvList.forEach((d, index) => {
        const typicalPrice = (d.high + d.low + d.close) / 3;
        cumulativePV += typicalPrice * d.volume;
        cumulativeVolume += d.volume;
        const vwap = cumulativePV / (cumulativeVolume || 1);
        vwapValues.push({ x: d.timestamp, y: vwap });

        if (index > 0) {
          const prevClose = downsampledOhlcvList[index - 1].close;
          const prevVwap = vwapValues[index - 1].y;
          if (prevClose < prevVwap && d.close > vwap) {
            signals.push({ x: d.timestamp, y: d.close, type: "Buy" });
          } else if (prevClose > prevVwap && d.close < vwap) {
            signals.push({ x: d.timestamp, y: d.close, type: "Sell" });
          }
        }
      });
      setVwapData(vwapValues);
      setVwapSignals(signals);

      const metrics = calculatePerformanceMetrics(downsampledOhlcvList, timeframe);
      setPerformanceMetrics(metrics);

      const detectedPatterns = detectPatterns(downsampledOhlcvList);
      setPatterns(detectedPatterns);
    } catch (err: any) {
      console.error("Chart data fetch error:", err);
      setError(`Failed to load chart data: ${err.message}`);
    }
  }, [timeframe, token]);

  const debouncedFetchTokenData = useMemo(
    () => debounce(fetchTokenData, 1000),
    [fetchTokenData]
  );
  const debouncedFetchChartData = useMemo(
    () => debounce(fetchChartData, 1000),
    [fetchChartData]
  );

  useEffect(() => {
    if (!pairAddress || typeof pairAddress !== "string") {
      setError("Invalid or missing pool address.");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      await fetchTokenData(pairAddress);
      await fetchChartData(pairAddress);
      setLoading(false);
    };

    loadData();

    const interval = setInterval(() => {
      debouncedFetchTokenData(pairAddress);
      debouncedFetchChartData(pairAddress, true);
    }, 10000);

    return () => clearInterval(interval);
  }, [pairAddress, timeframe, debouncedFetchTokenData, debouncedFetchChartData]);

  const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`;
    } else if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(2)}K`;
    }
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const getVisibleData = (data: any[]) => {
    if (!xAxisRange) return data;
    return data.filter((d: any) => {
      const timestamp = d.x.getTime ? d.x.getTime() : d.x;
      return timestamp >= xAxisRange.min && timestamp <= xAxisRange.max;
    });
  };

  const allData = chartView === "Price" ? allCandleData : allMarketCapData;
  const visibleCandleData = getVisibleData(chartView === "Price" ? candleData : marketCapData);
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

  const candlestickOptions = useMemo<ApexCharts.ApexOptions>(
    () => ({
      chart: {
        type: "candlestick",
        height: typeof window !== "undefined" && window.innerWidth < 768 ? 250 : 400,
        background: "transparent",
        foreColor: isDarkMode ? "#D1D5DB" : "#666",
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
        },
        zoom: {
          enabled: true,
          type: "x",
          autoScaleYaxis: true,
          zoomedArea: {
            fill: { color: "#90CAF9", opacity: 0.4 },
            stroke: { color: "#0D47A1", opacity: 0.4, width: 1 },
          },
        },
        events: {
          zoomed: (_: any, { xaxis }: any) => {
            if (xaxis) {
              setXAxisRange({ min: xaxis.min, max: xaxis.max });
            }
          },
          scrolled: (_: any, { xaxis }: any) => {
            if (xaxis) {
              setXAxisRange({ min: xaxis.min, max: xaxis.max });
            }
          },
          touchstart: (_: any) => {
            // Allow default touch behavior
          },
          touchmove: (_: any) => {
            // Allow default touch behavior
          },
        },
        animations: { enabled: false },
      },
      title: {
        text: chartView,
        align: "left",
        style: { color: isDarkMode ? "#FFFFFF" : "#000", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: {
          datetimeUTC: false,
          format: timeframe.includes("m") ? "HH:mm" : timeframe.includes("h") ? "MMM d" : "MMM d",
          style: {
            colors: isDarkMode ? "#D1D5DB" : "#666",
            fontSize: typeof window !== "undefined" && window.innerWidth < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          rotate: -45,
          rotateAlways: true,
        },
        tickAmount: 8,
        title: {
          text: "Time",
          offsetY: 70,
          style: { color: isDarkMode ? "#FFFFFF" : "#000", fontFamily: "Inter, sans-serif" },
        },
      },
      yaxis: {
        title: { text: chartView === "Price" ? "Price (USD)" : "Market Cap (USD)", style: { color: isDarkMode ? "#FFFFFF" : "#000", fontFamily: "Inter, sans-serif" } },
        labels: {
          style: {
            colors: isDarkMode ? "#D1D5DB" : "#666",
            fontSize: typeof window !== "undefined" && window.innerWidth < 768 ? "8px" : "10px",
            fontFamily: "Inter, sans-serif",
          },
          formatter: (val: number) =>
            chartView === "Price" ? `$${val.toFixed(4)}` : `$${formatLargeNumber(val)}`,
        },
        tickAmount: 5,
        min: yMin,
        max: yMax,
      },
      grid: { borderColor: isDarkMode ? "#4B5563" : "#e5e7eb", strokeDashArray: 3 },
      plotOptions: {
        candlestick: {
          colors: {
            upward: "#34C759",
            downward: "#FF3B30",
          },
          wick: { useFillColor: true },
        },
      },
      candlestick: {
        width: 4, // Fixed width for consistency
        columnWidth: "40%", // Consistent column width
      },
      annotations: {
        points: patterns.map((pattern) => ({
          x: pattern.start,
          y: pattern.points[0],
          marker: { size: 0 },
          label: {
            text: pattern.type,
            style: { color: "#FFFFFF", background: "#2196F3", fontSize: "12px" },
          },
        })),
      },
      tooltip: {
        enabled: true,
        theme: isDarkMode ? "dark" : "light",
        x: { format: "dd MMM HH:mm" },
        y: {
          formatter: (val: number) =>
            chartView === "Price" ? `$${val.toFixed(4)}` : `$${formatLargeNumber(val)}`,
        },
        style: { fontSize: "10px", fontFamily: "Inter, sans-serif" },
      },
    }),
    [chartView, timeframe, xMin, xMaxWithPadding, yMin, yMax, isDarkMode, xAxisRange, patterns]
  );

  const volumeOptions = useMemo<ApexCharts.ApexOptions>(
    () => ({
      chart: {
        type: "bar",
        height: typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 200,
        background: "transparent",
        foreColor: isDarkMode ? "#D1D5DB" : "#666",
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      title: {
        text: "Volume (Over Time)",
        align: "left",
        style: { color: isDarkMode ? "#FFFFFF" : "#000", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: { show: false },
        tickAmount: typeof window !== "undefined" && window.innerWidth < 768 ? 10 : 8,
      },
      yaxis: {
        title: { text: "Volume", style: { color: isDarkMode ? "#FFFFFF" : "#000", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          style: { colors: isDarkMode ? "#D1D5DB" : "text-[#666]", fontSize: "12px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => formatLargeNumber(val),
        },
        tickAmount: 3,
      },
      dataLabels: { enabled: false },
      colors: ["#A855F7"],
      plotOptions: {
        bar: { columnWidth: typeof window !== "undefined" && window.innerWidth < 768 ? "20%" : "40%" },
      },
      fill: {
        type: "solid",
        opacity: 0.8,
      },
      tooltip: {
        enabled: true,
        theme: isDarkMode ? "dark" : "light",
        x: { format: "dd MMM HH:mm" },
        y: {
          formatter: (val: number) => {
            const pricePerToken = parseFloat(token?.priceUsd || "0");
            const volumeUsd = val * pricePerToken;
            return `$${formatLargeNumber(volumeUsd)}`;
          },
        },
        style: { fontSize: "12px", fontFamily: "Inter, sans-serif" },
        custom: ({ series, seriesIndex, dataPointIndex }: any) => {
          const volume = series[seriesIndex][dataPointIndex];
          const pricePerToken = parseFloat(token?.priceUsd || "0");
          const volumeUsd = volume * pricePerToken;
          return `
            <div class="p-2">
              <p>Volume: $${formatLargeNumber(volumeUsd)}</p>
              <p>Volume over time: Shows trading activity at each time interval.</p>
            </div>
          `;
        },
      },
    }),
    [xMin, xMaxWithPadding, isDarkMode, xAxisRange, token]
  );

  const smaOptions = useMemo<ApexCharts.ApexOptions>(
    () => ({
      chart: {
        type: "line",
        height: typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 200,
        background: "transparent",
        foreColor: isDarkMode ? "#D1D5DB" : "#666",
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      title: {
        text: "SMA (20 & 50)",
        align: "left",
        style: { color: isDarkMode ? "#FFFFFF" : "#000", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: { show: false },
      },
      yaxis: {
        title: { text: "SMA", style: { color: isDarkMode ? "#FFFFFF" : "#000", fontSize: "14px", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          offsetX: -15,
          style: { colors: isDarkMode ? "#D1D5DB" : "#666", fontSize: "12px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => val.toFixed(2),
        },
        tickAmount: 6,
      },
      stroke: { curve: "smooth", width: 3 },
      colors: ["#FBBF24", "#FF6B6B"],
      tooltip: {
        enabled: true,
        theme: isDarkMode ? "dark" : "light",
        x: { format: "dd MMM HH:mm" },
        y: { formatter: (val: number) => val.toFixed(2) },
        style: { fontSize: "12px", fontFamily: "Inter, sans-serif" },
        custom: () => `
          <div class="p-2">
            <p>SMA 20 & 50: Simple Moving Averages. Golden Cross (bullish) when SMA 20 crosses above SMA 50; Death Cross (bearish) when SMA 20 crosses below SMA 50.</p>
          </div>
        `,
      },
      annotations: {
        points: smaCrossovers.map((crossover) => ({
          x: crossover.x,
          y: crossover.y,
          marker: { size: 6, fillColor: crossover.type === "Golden Cross" ? "#34C759" : "#FF3B30" },
          label: {
            text: crossover.type,
            style: { color: "#FFFFFF", background: crossover.type === "Golden Cross" ? "#34C759" : "#FF3B30", fontSize: "12px" },
          },
        })),
      },
    }),
    [xMin, xMaxWithPadding, isDarkMode, xAxisRange, smaCrossovers]
  );

  const rsiOptions = useMemo<ApexCharts.ApexOptions>(
    () => ({
      chart: {
        type: "line",
        height: typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 200,
        background: "transparent",
        foreColor: isDarkMode ? "#D1D5DB" : "#666",
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      title: {
        text: "RSI (14)",
        align: "left",
        style: { color: isDarkMode ? "#FFFFFF" : "#000", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: { show: false },
      },
      yaxis: {
        title: { text: "RSI", style: { color: isDarkMode ? "#FFFFFF" : "#000", fontSize: "14px", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          offsetX: -15,
          style: { colors: isDarkMode ? "#D1D5DB" : "#666", fontSize: "12px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => val.toFixed(2),
        },
        min: 0,
        max: 100,
        tickAmount: 8,
      },
      stroke: { curve: "smooth", width: 3 },
      colors: ["#A78BFA"],
      tooltip: {
        enabled: true,
        theme: isDarkMode ? "dark" : "light",
        x: { format: "dd MMM HH:mm" },
        y: { formatter: (val: number) => val.toFixed(2) },
        style: { fontSize: "12px", fontFamily: "Inter, sans-serif" },
        custom: () => `
          <div class="p-2">
            <p>RSI (14): Relative Strength Index. Above 70 indicates overbought; below 30 indicates oversold.</p>
          </div>
        `,
      },
      annotations: {
        yaxis: [
          { y: 70, borderColor: "#FF3B30", label: { text: "Overbought", style: { color: "#FFFFFF", background: "#FF3B30", fontSize: "12px" } } },
          { y: 30, borderColor: "#34C759", label: { text: "Oversold", style: { color: "#FFFFFF", background: "#34C759", fontSize: "12px" } } },
        ],
      },
    }),
    [xMin, xMaxWithPadding, isDarkMode, xAxisRange]
  );

  const macdOptions = useMemo<ApexCharts.ApexOptions>(
    () => ({
      chart: {
        type: "line",
        height: typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 200,
        background: "transparent",
        foreColor: isDarkMode ? "#D1D5DB" : "#666",
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      title: {
        text: "MACD (12,26,9)",
        align: "left",
        style: { color: isDarkMode ? "#FFFFFF" : "#000", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: { show: false },
      },
      yaxis: {
        title: { text: "MACD", style: { color: isDarkMode ? "#FFFFFF" : "#000", fontSize: "14px", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          offsetX: -15,
          style: { colors: isDarkMode ? "#D1D5DB" : "#666", fontSize: "12px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => val.toFixed(2),
        },
        tickAmount: 6,
      },
      stroke: { curve: "smooth", width: 3 },
      colors: ["#3B82F6", "#34D399", "#9CA3AF"],
      tooltip: {
        enabled: true,
        theme: isDarkMode ? "dark" : "light",
        x: { format: "dd MMM HH:mm" },
        y: { formatter: (val: number) => val.toFixed(2) },
        style: { fontSize: "12px", fontFamily: "Inter, sans-serif" },
        custom: () => `
          <div class="p-2">
            <p>MACD (12,26,9): Moving Average Convergence Divergence. Signals trend changes and momentum.</p>
          </div>
        `,
      },
    }),
    [xMin, xMaxWithPadding, isDarkMode, xAxisRange]
  );

  const vwapOptions = useMemo<ApexCharts.ApexOptions>(
    () => ({
      chart: {
        type: "line",
        height: typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 200,
        background: "transparent",
        foreColor: isDarkMode ? "#D1D5DB" : "#666",
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      title: {
        text: "VWAP",
        align: "left",
        style: { color: isDarkMode ? "#FFFFFF" : "#000", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif" },
      },
      xaxis: {
        type: "datetime",
        min: xAxisRange ? xAxisRange.min : xMin,
        max: xAxisRange ? xAxisRange.max : xMaxWithPadding,
        labels: { show: false },
      },
      yaxis: {
        title: { text: "VWAP", style: { color: isDarkMode ? "#FFFFFF" : "#000", fontSize: "14px", fontFamily: "Inter, sans-serif" } },
        labels: {
          show: true,
          offsetX: -15,
          style: { colors: isDarkMode ? "#D1D5DB" : "#666", fontSize: "12px", fontFamily: "Inter, sans-serif" },
          formatter: (val: number) => val.toFixed(2),
        },
        tickAmount: 6,
      },
      stroke: { curve: "smooth", width: 3 },
      colors: ["#FF5722"],
      tooltip: {
        enabled: true,
        theme: isDarkMode ? "dark" : "light",
        x: { format: "dd MMM HH:mm" },
        y: { formatter: (val: number) => val.toFixed(2) },
        style: { fontSize: "12px", fontFamily: "Inter, sans-serif" },
        custom: () => `
          <div class="p-2">
            <p>VWAP: Volume Weighted Average Price. Price crossing above VWAP may indicate a buy signal; crossing below may indicate a sell signal.</p>
          </div>
        `,
      },
      annotations: {
        points: vwapSignals.map((signal) => ({
          x: signal.x,
          y: signal.y,
          marker: { size: 6, fillColor: signal.type === "Buy" ? "#34C759" : "#FF3B30" },
          label: {
            text: signal.type,
            style: { color: "#FFFFFF", background: signal.type === "Buy" ? "#34C759" : "#FF3B30", fontSize: "12px" },
          },
        })),
      },
    }),
    [xMin, xMaxWithPadding, isDarkMode, xAxisRange, vwapSignals]
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const shareChart = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("Chart URL copied to clipboard!");
  };

  return (
    <div className={`min-h-screen font-sans font-['Inter',sans-serif] overflow-hidden ${isDarkMode ? "bg-[#121212] text-white" : "bg-[#ffffff] text-black"}`}>
      <header className={`sticky top-0 z-50 p-3 md:p-4 shadow-lg w-full ${isDarkMode ? "bg-[#121212] border-b border-[#2D3748]" : "bg-[#ffffff] border-b border-[#e5e7eb]"} flex flex-row justify-between items-center gap-2`}>
        <div className="flex flex-col items-start">
          <h1 className="text-base md:text-lg font-bold">
            {token
              ? `${token.baseToken.name || token.baseToken.symbol} / ${
                  token.quoteToken.symbol || "WETH"
                }`
              : "horse / WETH"}
          </h1>
          <span className="text-[10px] text-[#0052FF] md:text-xs">Powered by Homebase</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={shareChart}
            className={`p-1.5 rounded-lg border ${isDarkMode ? "border-[#0052FF] hover:bg-[#0052FF] hover:bg-opacity-10" : "border-[#0052FF] hover:bg-[#0052FF] hover:bg-opacity-10"} transition-all duration-300`}
            aria-label="Share chart"
          >
            <ShareIcon className="h-4 w-4 text-[#0052FF]" />
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-1.5 rounded-lg border ${isDarkMode ? "border-[#0052FF] hover:bg-[#0052FF] hover:bg-opacity-10" : "border-[#0052FF] hover:bg-[#0052FF] hover:bg-opacity-10"} transition-all duration-300`}
          >
            {isDarkMode ? (
              <SunIcon className="h-4 w-4 text-[#0052FF]" />
            ) : (
              <MoonIcon className="h-4 w-4 text-[#0052FF]" />
            )}
          </button>
        </div>
      </header>
  
      <div className="flex flex-col lg:flex-row gap-4 p-4 md:p-6 w-full max-w-full overflow-x-hidden overflow-y-auto">
        <div className="w-full lg:flex-1">
          {loading ? (
            <div className="text-center text-sm md:text-base">Loading...</div>
          ) : error ? (
            <div className="text-red-500 text-center text-sm md:text-base">{error}</div>
          ) : (chartView === "Price" ? candleData : marketCapData).length > 0 ? (
            <div className={`rounded-xl shadow-lg w-full ${isDarkMode ? "bg-[#1F2937] border border-[#2D3748]" : "bg-[#fafafa] border border-[#e5e7eb]"}`}>
              <div className={`flex flex-wrap justify-between items-center p-3 md:p-4 gap-2 ${isDarkMode ? "border-b border-[#2D3748] bg-[#1F2937]" : "border-b border-[#e5e7eb] bg-[#fafafa]"}`}>
                <div className="flex flex-wrap space-x-2">
                  <button
                    onClick={() => setChartView("Price")}
                    className={`py-2 px-4 rounded-lg text-xs md:text-sm font-semibold ${
                      chartView === "Price"
                        ? "bg-[#0052FF] text-white"
                        : isDarkMode
                        ? "bg-[#2D3748] text-[#D1D5DB] hover:bg-[#4B5563]"
                        : "bg-[#e5e7eb] text-[#666] hover:bg-[#d1d5db]"
                    } transition-all duration-300 touch-manipulation min-w-[80px]`}
                  >
                    Price
                  </button>
                  <button
                    onClick={() => setChartView("MarketCap")}
                    className={`py-2 px-4 rounded-lg text-xs md:text-sm font-semibold ${
                      chartView === "MarketCap"
                        ? "bg-[#0052FF] text-white"
                        : isDarkMode
                        ? "bg-[#2D3748] text-[#D1D5DB] hover:bg-[#4B5563]"
                        : "bg-[#e5e7eb] text-[#666] hover:bg-[#d1d5db]"
                    } transition-all duration-300 touch-manipulation min-w-[80px]`}
                  >
                    Market Cap
                  </button>
                </div>
                <div className="flex flex-wrap items-center space-x-2">
                  <div className="relative w-24 md:w-28">
                    <select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      className={`w-full py-2 pl-4 pr-8 rounded-lg text-xs md:text-sm font-medium ${
                        isDarkMode
                          ? "bg-[#2D3748] text-[#D1D5DB] border-[#2D3748] hover:bg-[#4B5563]"
                          : "bg-[#e5e7eb] text-black border-[#e5e7eb] hover:bg-[#d1d5db]"
                      } focus:outline-none focus:ring-2 focus:ring-[#0052FF] transition-all duration-300 touch-manipulation appearance-none`}
                    >
                      {["1m", "5m", "15m", "1h", "4h", "12h", "1d"].map((tf) => (
                        <option key={tf} value={tf}>
                          {tf}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                      <svg
                        className={`h-4 w-4 ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
  
              <div className={`p-3 md:p-4 ${isDarkMode ? "bg-[#1F2937] border border-[#2D3748] rounded-lg" : "bg-[#fafafa] border border-[#e5e7eb] rounded-lg"}`}>
                <h3 className="text-sm md:text-base font-semibold mb-3">Performance Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className={`p-2 rounded-lg ${isDarkMode ? "bg-[#2D3748]" : "bg-[#e5e7eb]"} shadow-sm hover:shadow-md transition-shadow`}>
                    <p className={`text-[10px] ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>1h Price Change</p>
                    <p className={`text-sm font-semibold ${performanceMetrics.change1h >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {performanceMetrics.change1h.toFixed(2)}%
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${isDarkMode ? "bg-[#2D3748]" : "bg-[#e5e7eb]"} shadow-sm hover:shadow-md transition-shadow`}>
                    <p className={`text-[10px] ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>1d Price Change</p>
                    <p className={`text-sm font-semibold ${performanceMetrics.change1d >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {performanceMetrics.change1d.toFixed(2)}%
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${isDarkMode ? "bg-[#2D3748]" : "bg-[#e5e7eb]"} shadow-sm hover:shadow-md transition-shadow`}>
                    <p className={`text-[10px] ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>7d Price Change</p>
                    <p className={`text-sm font-semibold ${performanceMetrics.change7d >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {performanceMetrics.change7d.toFixed(2)}%
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${isDarkMode ? "bg-[#2D3748]" : "bg-[#e5e7eb]"} shadow-sm hover:shadow-md transition-shadow`}>
                    <p className={`text-[10px] ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>30d Price Change</p>
                    <p className={`text-sm font-semibold ${performanceMetrics.change30d >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {performanceMetrics.change30d.toFixed(2)}%
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${isDarkMode ? "bg-[#2D3748]" : "bg-[#e5e7eb]"} shadow-sm hover:shadow-md transition-shadow`}>
                    <p className={`text-[10px] ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>1h Volume Change</p>
                    <p className={`text-sm font-semibold ${performanceMetrics.volumeChange1h >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {performanceMetrics.volumeChange1h.toFixed(2)}%
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${isDarkMode ? "bg-[#2D3748]" : "bg-[#e5e7eb]"} shadow-sm hover:shadow-md transition-shadow`}>
                    <p className={`text-[10px] ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>1d Volume Change</p>
                    <p className={`text-sm font-semibold ${performanceMetrics.volumeChange1d >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {performanceMetrics.volumeChange1d.toFixed(2)}%
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${isDarkMode ? "bg-[#2D3748]" : "bg-[#e5e7eb]"} shadow-sm hover:shadow-md transition-shadow`}>
                    <p className={`text-[10px] ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>7d Volume Change</p>
                    <p className={`text-sm font-semibold ${performanceMetrics.volumeChange7d >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {performanceMetrics.volumeChange7d.toFixed(2)}%
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${isDarkMode ? "bg-[#2D3748]" : "bg-[#e5e7eb]"} shadow-sm hover:shadow-md transition-shadow`}>
                    <p className={`text-[10px] ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>30d Volume Change</p>
                    <p className={`text-sm font-semibold ${performanceMetrics.volumeChange30d >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {performanceMetrics.volumeChange30d.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
  
              <div className="w-full max-w-full overflow-hidden">
                <Chart
                  options={candlestickOptions}
                  series={[{ name: chartView, data: allData }]}
                  type={chartView === "Price" ? "candlestick" : "line"}
                  height={typeof window !== "undefined" && window.innerWidth < 768 ? 250 : 400}
                  width="100%"
                />
              </div>
  
              <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"} p-3 md:p-4`}>Last Updated: {lastUpdated}</p>
  
              <div className="p-3 md:p-4">
                <h3 className="text-sm md:text-base font-semibold mb-3">Indicators</h3>
                <div className={`flex flex-wrap space-x-2 ${isDarkMode ? "border-b border-[#2D3748] bg-[#1F2937]" : "border-b border-[#e5e7eb] bg-[#fafafa]"} mb-3`}>
                  {["Volume", "SMA", "RSI", "MACD", "VWAP"].map((indicator) => (
                    <button
                      key={indicator}
                      onClick={() => setActiveIndicatorTab(indicator)}
                      className={`pb-2 px-3 text-xs md:text-sm font-medium relative whitespace-nowrap ${
                        activeIndicatorTab === indicator
                          ? "text-[#0052FF]"
                          : isDarkMode
                          ? "text-[#D1D5DB] hover:text-white"
                          : "text-[#666] hover:text-black"
                      } transition-colors duration-300 touch-manipulation min-w-[60px]`}
                    >
                      {indicator}
                      {activeIndicatorTab === indicator && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0052FF]" />
                      )}
                    </button>
                  ))}
                </div>
                <div>
                  {activeIndicatorTab === "Volume" && (
                    <Chart
                      options={volumeOptions}
                      series={[{ name: "Volume", data: volumeData }]}
                      type="bar"
                      height={typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 200}
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
                      height={typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 200}
                      width="100%"
                    />
                  )}
                  {activeIndicatorTab === "RSI" && (
                    <Chart
                      options={rsiOptions}
                      series={[{ name: "RSI", data: rsiData }]}
                      type="line"
                      height={typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 200}
                      width="100%"
                    />
                  )}
                  {activeIndicatorTab === "MACD" && (
                    <Chart
                      options={macdOptions}
                      series={[
                        { name: "MACD", data: macdData.map((d) => ({ x: d.x, y: d.macd })) },
                        { name: "Signal", data: macdData.map((d) => ({ x: d.x, y: d.signal })) },
                        {
                          name: "Histogram",
                          type: "bar",
                          data: macdData.map((d) => ({ x: d.x, y: d.histogram })),
                        },
                      ]}
                      type="line"
                      height={typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 200}
                      width="100%"
                    />
                  )}
                  {activeIndicatorTab === "VWAP" && (
                    <Chart
                      options={vwapOptions}
                      series={[{ name: "VWAP", data: vwapData }]}
                      type="line"
                      height={typeof window !== "undefined" && window.innerWidth < 768 ? 150 : 200}
                      width="100%"
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm md:text-base">No chart data available.</div>
          )}
        </div>
  
        {token && (
          <div className="w-full lg:w-72">
            <div className={`rounded-xl shadow-lg w-full ${isDarkMode ? "bg-[#1F2937] border border-[#2D3748]" : "bg-[#fafafa] border border-[#e5e7eb]"}`}>
              <div className="flex justify-between items-center p-3 md:p-4">
                <h2 className="text-sm md:text-base font-semibold">Token Details</h2>
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`text-xs ${isDarkMode ? "text-[#D1D5DB] hover:text-white hover:bg-[#2D3748]" : "text-[#666] hover:text-black hover:bg-[#e5e7eb]"} px-3 py-1 rounded-lg transition-all duration-300 touch-manipulation min-w-[80px]`}
                >
                  {isSidebarOpen ? "Collapse" : "Expand"}
                </button>
              </div>
              {isSidebarOpen && (
                <div className="space-y-3 p-3 md:p-4">
                  <div className="h-14 md:h-20 rounded-lg overflow-hidden aspect-[3/1]">
                    <img
                      src={token.bannerUrl}
                      alt="Project Banner"
                      className="w-full h-full object-cover"
                      onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/300x100")}
                    />
                  </div>
                  <div className={`flex items-center space-x-3 ${isDarkMode ? "border-b border-[#2D3748]" : "border-b border-[#e5e7eb]"} pb-2`}>
                    <img
                      src={token.logoUrl}
                      alt="Token Logo"
                      className="h-8 w-8 md:h-10 md:w-10 rounded-full border-2 border-[#2D3748]"
                      onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/48")}
                    />
                    <div>
                      <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>Name</p>
                      <p className="text-sm md:text-base font-medium">{token.baseToken.name || "N/A"}</p>
                    </div>
                  </div>
                  <div className={`border-b ${isDarkMode ? "border-[#2D3748]" : "border-[#e5e7eb]"} pb-2`}>
                    <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>Symbol</p>
                    <p className="text-sm md:text-base font-medium">{token.baseToken.symbol || "N/A"}</p>
                  </div>
                  <div className={`border-b ${isDarkMode ? "border-[#2D3748]" : "border-[#e5e7eb]"} pb-2`}>
                    <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>Price (USD)</p>
                    <p className="text-sm md:text-base font-medium">${Number(token.priceUsd || 0).toFixed(5)}</p>
                  </div>
                  <div className={`border-b ${isDarkMode ? "border-[#2D3748]" : "border-[#e5e7eb]"} pb-2`}>
                    <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>Liquidity (USD)</p>
                    <p className="text-sm md:text-base font-medium">${formatLargeNumber(token.liquidity.usd || 0)}</p>
                  </div>
                  <div className={`border-b ${isDarkMode ? "border-[#2D3748]" : "border-[#e5e7eb]"} pb-2`}>
                    <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>Market Cap</p>
                    <p className="text-sm md:text-base font-medium">${formatLargeNumber(token.marketCap || 0)}</p>
                  </div>
                  <div className={`border-b ${isDarkMode ? "border-[#2D3748]" : "border-[#e5e7eb]"} pb-2`}>
                    <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>FDV</p>
                    <p className="text-sm md:text-base font-medium">${formatLargeNumber(token.fdv || 0)}</p>
                  </div>
                  <div className={`border-b ${isDarkMode ? "border-[#2D3748]" : "border-[#e5e7eb]"} pb-2`}>
                    <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>Pool Address</p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs md:text-sm font-medium truncate">{token.pairAddress}</p>
                      <button
                        onClick={() => copyToClipboard(token.pairAddress)}
                        className={`p-1 rounded ${isDarkMode ? "hover:bg-[#2D3748]" : "hover:bg-[#e5e7eb]"} relative group transition-all duration-300 touch-manipulation`}
                      >
                        <ClipboardIcon className={`h-4 w-4 ${isDarkMode ? "text-[#D1D5DB] hover:text-[#0052FF]" : "text-[#666] hover:text-[#0052FF]"}`} />
                        <span className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 ${isDarkMode ? "bg-[#2D3748] text-white" : "bg-[#e5e7eb] text-black"} text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                          Copy
                        </span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"}`}>Socials</p>
                    {socialLoading ? (
                      <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"} mt-1`}>Loading...</p>
                    ) : socialError ? (
                      <p className="text-xs text-red-500 mt-1">{socialError}</p>
                    ) : Object.keys(token.socials || {}).length > 0 ? (
                      <div className="flex space-x-3 mt-1">
                        {token.socials?.website && (
                          <a
                            href={token.socials.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-1 rounded ${isDarkMode ? "hover:bg-[#2D3748]" : "hover:bg-[#e5e7eb]"} transition-all duration-300 touch-manipulation`}
                          >
                            <FaGlobe className={`h-5 w-5 ${isDarkMode ? "text-[#D1D5DB] hover:text-[#0052FF]" : "text-[#666] hover:text-[#0052FF]"}`} />
                          </a>
                        )}
                        {token.socials?.telegram && (
                          <a
                            href={token.socials.telegram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-1 rounded ${isDarkMode ? "hover:bg-[#2D3748]" : "hover:bg-[#e5e7eb]"} transition-all duration-300 touch-manipulation`}
                          >
                            <FaTelegram className={`h-5 w-5 ${isDarkMode ? "text-[#D1D5DB] hover:text-[#0052FF]" : "text-[#666] hover:text-[#0052FF]"}`} />
                          </a>
                        )}
                        {token.socials?.twitter && (
                          <a
                            href={token.socials.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-1 rounded ${isDarkMode ? "hover:bg-[#2D3748]" : "hover:bg-[#e5e7eb]"} transition-all duration-300 touch-manipulation`}
                          >
                            <FaTwitter className={`h-5 w-5 ${isDarkMode ? "text-[#D1D5DB] hover:text-[#0052FF]" : "text-[#666] hover:text-[#0052FF]"}`} />
                          </a>
                        )}
                        {token.socials?.warpcast && (
                          <a
                            href={token.socials.warpcast}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-1 rounded ${isDarkMode ? "hover:bg-[#2D3748]" : "hover:bg-[#e5e7eb]"} transition-all duration-300 touch-manipulation`}
                          >
                            <FaDiscord className={`h-5 w-5 ${isDarkMode ? "text-[#D1D5DB] hover:text-[#0052FF]" : "text-[#666] hover:text-[#0052FF]"}`} />
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className={`text-xs ${isDarkMode ? "text-[#D1D5DB]" : "text-[#666]"} mt-1`}>No social links available.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}