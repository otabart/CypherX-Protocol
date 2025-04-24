"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createChart, IChartApi } from "lightweight-charts";
import { motion } from "framer-motion";

type Candle = {
  time: number;
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
  const { pairAddress } = useParams(); // This is actually a token address from TokenScanner
  const [chartData, setChartData] = useState<Candle[]>([]);
  const [token, setToken] = useState<DexToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

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
      // Return poolAddress for chart data fetching
      return poolAddress;
    } catch (err) {
      console.error("fetchTokenMetadata error:", err);
      setError("Failed to load token metadata. Check console for details.");
      return null;
    }
  };

  const fetchChartData = async (poolAddress: string) => {
    try {
      console.log(`Fetching chart data for poolAddress: ${poolAddress}`);
      const response = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddress}/ohlcv/hour?aggregate=1`
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch chart data: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log("Chart data response:", data);
      const candles = data.data.attributes.ohlcv_list.map(
        ([time, open, high, low, close]: number[]) => ({
          time,
          open,
          high,
          low,
          close,
        })
      );
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
      layout: { background: { color: "#1a1a1a" }, textColor: "#ffffff" },
      grid: { vertLines: { color: "#333" }, horzLines: { color: "#333" } },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    console.log("Chart object created:", chart);

    // Explicitly check for addCandlestickSeries
    if (typeof chart.addCandlestickSeries !== "function") {
      console.error("addCandlestickSeries is not a function on chart object");
      setError("Chart library error: addCandlestickSeries unavailable.");
      return;
    }

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    console.log("Setting chart data:", chartData);
    candlestickSeries.setData(chartData);
    chart.timeScale().fitContent();

    chartRef.current = chart;
  }, [chartData]);

  useEffect(() => {
    async function loadData() {
      if (!pairAddress) return;

      console.log(`Loading data for pairAddress (tokenAddress): ${pairAddress}`);
      const poolAddress = await fetchTokenMetadata(pairAddress as string);
      if (poolAddress) {
        await fetchChartData(poolAddress);
      }
    }
    loadData();
  }, [pairAddress]);

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
        <h1 className="text-xl font-bold">
          {token ? `${token.baseToken.name} / ${token.quoteToken.symbol} Chart` : "Loading Chart..."}
        </h1>
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



