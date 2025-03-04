"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type OrderBookDataPoint = {
  price: number;
  cumulativeVolume: number;
  timestamp?: number;
};

type ApiData = {
  liveData: OrderBookDataPoint[];
  snapshots?: OrderBookDataPoint[];
};

export default function AdvancedOrderBookTracker() {
  // View mode: "live" or "historical"
  const [viewMode, setViewMode] = useState<"live" | "historical">("live");
  // Time frame for filtering data (e.g., last 15 minutes, 1 hour, 24 hours)
  const [timeFrame, setTimeFrame] = useState("1h");

  const { data, error } = useSWR<ApiData>("/api/orderbook", fetcher, {
    refreshInterval: 5000,
  });

  if (error) return <div className="text-white p-4">Error loading data</div>;
  if (!data) return <div className="text-white p-4">Loading...</div>;

  // Choose data source based on view mode
  const allData = viewMode === "live" ? data.liveData : data.snapshots || data.liveData;

  // Filter data by time frame if timestamps are provided
  const now = Date.now();
  const timeFrameMs =
    timeFrame === "15m" ? 15 * 60 * 1000 :
    timeFrame === "1h" ? 60 * 60 * 1000 :
    timeFrame === "24h" ? 24 * 60 * 60 * 1000 : 0;
    
  const filteredData = timeFrameMs
    ? allData.filter((point) => (point.timestamp ? now - point.timestamp <= timeFrameMs : true))
    : allData;

  // Sort data by price ascending
  const sortedData = [...filteredData].sort((a, b) => a.price - b.price);

  // Compute summary metrics
  const minPrice = sortedData[0]?.price ?? 0;
  const maxPrice = sortedData[sortedData.length - 1]?.price ?? 0;
  const spread = maxPrice - minPrice;
  const currentPrice = sortedData[sortedData.length - 1]?.price ?? 0;
  const totalVolume = sortedData[sortedData.length - 1]?.cumulativeVolume ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 p-6 rounded-lg shadow-lg m-4"
    >
      {/* Header with Controls */}
      <div className="mb-4 flex flex-col sm:flex-row items-center justify-between">
        <h2 className="text-2xl font-bold text-white mb-2 sm:mb-0">
          Order Book Depth
        </h2>
        <div className="flex space-x-4">
          {/* View Mode Toggle */}
          <div>
            <button
              onClick={() => setViewMode("live")}
              className={`px-3 py-1 rounded-md text-sm ${
                viewMode === "live"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              Live
            </button>
            <button
              onClick={() => setViewMode("historical")}
              className={`ml-2 px-3 py-1 rounded-md text-sm ${
                viewMode === "historical"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              Historical
            </button>
          </div>
          {/* Time Frame Selector */}
          <div>
            <select
              value={timeFrame}
              onChange={(e) => setTimeFrame(e.target.value)}
              className="px-2 py-1 rounded-md bg-gray-700 text-white text-sm"
            >
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="24h">24h</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={sortedData} margin={{ top: 20, right: 30, left: 0, bottom: 30 }}>
          <defs>
            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0060FF" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#0060FF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis 
            dataKey="price" 
            stroke="#fff" 
            tick={{ fontSize: 12 }} 
            label={{ value: "Price", position: "insideBottomRight", offset: -10, fill: "#fff", fontSize: 12 }}
          />
          <YAxis 
            stroke="#fff" 
            tick={{ fontSize: 12 }}
            label={{ value: "Volume", angle: -90, position: "insideLeft", fill: "#fff", fontSize: 12 }}
          />
          <Tooltip contentStyle={{ backgroundColor: "#333", border: "none", color: "#fff", fontSize: 12 }} />
          <Area 
            type="monotone" 
            dataKey="cumulativeVolume" 
            stroke="#0060FF" 
            strokeWidth={2} 
            dot={{ r: 2, stroke: "#0060FF", strokeWidth: 1, fill: "#0060FF" }}
            activeDot={{ r: 4 }} 
            fillOpacity={1} 
            fill="url(#colorVolume)" 
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Summary Panel */}
      <div className="mt-6 bg-gray-800 p-4 rounded-md">
        <h3 className="text-xl font-semibold text-white mb-2">Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-200">
          <div>
            <div className="font-medium">Current Price</div>
            <div>${currentPrice.toFixed(5)}</div>
          </div>
          <div>
            <div className="font-medium">Total Volume</div>
            <div>${totalVolume.toLocaleString()}</div>
          </div>
          <div>
            <div className="font-medium">Min Price</div>
            <div>${minPrice.toFixed(5)}</div>
          </div>
          <div>
            <div className="font-medium">Max Price</div>
            <div>${maxPrice.toFixed(5)}</div>
          </div>
          <div className="col-span-2">
            <div className="font-medium">Spread</div>
            <div>${spread.toFixed(5)}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
