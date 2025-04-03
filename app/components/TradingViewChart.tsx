"use client";

import { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  width?: string | number;
  height?: string | number;
}

export default function TradingViewChart({
  symbol = "BINANCE:BTCUSDT",
  interval = "D",
  width = "100%",
  height = 500,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Clear previous widget (if any) before reloading the script
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if ((window as any).TradingView) {
        new (window as any).TradingView.widget({
          width,
          height,
          symbol,
          interval,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          hide_side_toolbar: false,
          container_id: "tradingview_chart",
        });
      }
    };

    containerRef.current.appendChild(script);
  }, [symbol, interval, width, height]);

  return <div id="tradingview_chart" ref={containerRef} />;
}



