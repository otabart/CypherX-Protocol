"use client";

import { useEffect } from "react";

interface TradingViewWidgetProps {
  symbol: string; // e.g. "TOKEN:0x1234..." or any symbol format required
}

export default function TradingViewWidget({ symbol }: TradingViewWidgetProps) {
  useEffect(() => {
    // Create and append the TradingView script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      new TradingView.widget({
        width: "100%",
        height: 500,
        symbol: symbol, // Pass the symbol prop here
        interval: "D",
        timezone: "Etc/UTC",
        theme: "light",
        style: "1",
        locale: "en",
        toolbar_bg: "#f1f3f6",
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: "tradingview_widget",
      });
    };

    const container = document.getElementById("tradingview_widget_container");
    container?.appendChild(script);
  }, [symbol]);

  return (
    <div id="tradingview_widget_container">
      <div id="tradingview_widget" />
    </div>
  );
}



