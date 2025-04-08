"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createChart, IChartApi } from "lightweight-charts";
import { motion } from "framer-motion";

type Candle = {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

interface DexToken {
  pairAddress: string;
  baseToken: { name: string; symbol: string };
  quoteToken: { name: string; symbol: string };
}

export default function ChartPage() {
  const router = useRouter();
  const { pairAddress } = useParams();
  const [chartData, setChartData] = useState<Candle[]>([]);
  const [token, setToken] = useState<DexToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [timeframe, setTimeframe] = useState<"hour" | "day" | "minute">("hour"); // Add timeframe state

  const fetchTokenMetadata = async (tokenAddress: string) => {
    try {
      console.log(`Fetching pool for tokenAddress: ${tokenAddress}`);
      const poolRes = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/tokens/${tokenAddress}/pools`
      );
      if (!poolRes.ok) {
        const errorText = await poolRes.text();
        throw new Error(`Failed to fetch pools: ${poolRes.status} - ${errorText}`);
      }
      const poolData = await poolRes.json();
      const poolAddress = poolData.data?.[0]?.attributes.address;
      if (!poolAddress) throw new Error("No pool found for this token");

      console.log(`Fetching metadata for poolAddress: ${poolAddress}`);
      const res = await fetch(`/api/tokens?chainId=base&poolAddress=${poolAddress}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch token metadata: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      console.log("Metadata response:", data);
      const tokenData = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (!tokenData) throw new Error("No token data returned");

      setToken({
        pairAddress: poolAddress,
        baseToken: {
          name: tokenData.baseToken.name,
          symbol: tokenData.baseToken.symbol,
        },
        quoteToken: {
          name: tokenData.quoteToken.name,
          symbol: tokenData.quoteToken.symbol,
        },
      });
      return poolAddress;
    } catch (err) {
      console.error("fetchTokenMetadata error:", err);
      setError("Failed to load token metadata. Check console for details.");
      return null;
    }
  };

  const fetchChartData = async (poolAddress: string, timeframe: string) => {
    try {
      console.log(`Fetching chart data for poolAddress: ${poolAddress}, timeframe: ${timeframe}`);
      const response = await fetch(
        `/api/tokens?chainId=base&poolAddress=${poolAddress}&fetchChartData=true&timeframe=${timeframe}`
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch chart data: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log("Raw chart data response:", data);

      // Validate and transform the data
      if (!data.data || !data.data.attributes || !data.data.attributes.ohlcv_list) {
        throw new Error("Invalid chart data structure");
      }

      const candles = data.data.attributes.ohlcv_list.map(
        ([time, open, high, low, close]: number[]) => {
          const candle = {
            time: Math.floor(time / 1000), // Convert milliseconds to seconds
            open,
            high,
            low,
            close,
          };
          // Validate candle data
          if (
            isNaN(candle.time) ||
            isNaN(candle.open) ||
            isNaN(candle.high) ||
            isNaN(candle.low) ||
            isNaN(candle.close)
          ) {
            console.warn("Invalid candle data:", candle);
          }
          return candle;
        }
      );

      console.log("Processed candles:", candles);
      // Log the range of timestamps and prices
      const timestamps = candles.map(c => c.time);
      const prices = candles.flatMap(c => [c.open, c.high, c.low, c.close]);
      console.log("Timestamp range:", Math.min(...timestamps), "to", Math.max(...timestamps));
      console.log("Price range:", Math.min(...prices), "to", Math.max(...prices));

      setChartData(candles);
      setError(null);
    } catch (err) {
      console.error("fetchChartData error:", err);
      setError("Failed to load chart data. Please try again.");
    }
  };

  const initializeChart = useCallback(() => {
    if (!chartContainerRef.current || chartData.length === 0) {
      console.log("Chart not initialized: container or data missing");
      return;
    }

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 600,
      layout: {
        background: { color: "#1a1a1a" },
        textColor: "#d1d4dc",
        fontFamily: "monospace",
      },
      grid: {
        vertLines: { color: "#2a2e39", style: 1 },
        horzLines: { color: "#2a2e39", style: 1 },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#2a2e39",
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")} ${date.getDate()}/${date.getMonth() + 1}`;
        },
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
        scaleMargins: { top: 0.1, bottom: 0.1 },
        autoScale: true,
      },
      crosshair: {
        mode: 0, // Normal crosshair mode
        vertLine: { color: "#758696", width: 1, labelBackgroundColor: "#4c525e" },
        horzLine: { color: "#758696", width: 1, labelBackgroundColor: "#4c525e" },
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      priceFormat: {
        type: "price",
        precision: 4,
        minMove: 0.0001,
      },
    });

    console.log("Setting chart data:", chartData);
    candlestickSeries.setData(chartData);

    // Fit the chart to the data
    chart.timeScale().fitContent();

    // Add a simple moving average (SMA) as an indicator
    const smaData = calculateSMA(chartData, 20); // 20-period SMA
    const smaSeries = chart.addLineSeries({
      color: "#2962FF",
      lineWidth: 2,
      title: "SMA 20",
    });
    smaSeries.setData(smaData);

    chartRef.current = chart;
  }, [chartData]);

  // Calculate a simple moving average
  const calculateSMA = (data: Candle[], period: number) => {
    const sma: { time: number; value: number }[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const avg = slice.reduce((sum, candle) => sum + candle.close, 0) / period;
      sma.push({ time: data[i].time, value: avg });
    }
    return sma;
  };

  useEffect(() => {
    async function loadData() {
      if (!pairAddress) return;

      console.log(`Loading data for pairAddress (tokenAddress): ${pairAddress}`);
      const poolAddress = await fetchTokenMetadata(pairAddress as string);
      if (poolAddress) {
        await fetchChartData(poolAddress, timeframe);
      }
    }
    loadData();
  }, [pairAddress, timeframe]);

  useEffect(() => {
    if (chartData.length > 0) {
      console.log("Initializing chart with data:", chartData);
      initializeChart();
    }
  }, [chartData, initializeChart]);

  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.resize(chartContainerRef.current.clientWidth, 600);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="w-screen h-screen bg-black text-white font-mono flex flex-col">
      <div className="sticky top-0 z-50 bg-[#0060FF] shadow-md w-full p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">
            {token ? `${token.baseToken.name} / ${token.quoteToken.symbol} Chart` : "Loading Chart..."}
          </h1>
          <div className="flex space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setTimeframe("minute")}
              className={`py-1 px-3 rounded ${timeframe === "minute" ? "bg-gray-600" : "bg-gray-700"} hover:bg-gray-500`}
            >
              1M
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setTimeframe("hour")}
              className={`py-1 px-3 rounded ${timeframe === "hour" ? "bg-gray-600" : "bg-gray-700"} hover:bg-gray-500`}
            >
              1H
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setTimeframe("day")}
              className={`py-1 px-3 rounded ${timeframe === "day" ? "bg-gray-600" : "bg-gray-700"} hover:bg-gray-500`}
            >
              1D
            </motion.button>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={() => router.push("/token-scanner")}
          className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded"
        >
          Back to Scanner
        </motion.button>
      </div>
      <div className="flex-1 p-4">
        {error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : chartData.length === 0 ? (
          <div className="text-white text-center">Loading chart data...</div>
        ) : (
          <div ref={chartContainerRef} className="w-full h-[600px]" />
        )}
      </div>
    </div>
  );
}