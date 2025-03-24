// app/TradingCompetition/Components/TooltipExample.tsx
"use client";
import React from "react";

export default function TooltipExample() {
  return (
    <div className="relative group inline-block">
      <span className="underline cursor-help">ROI (%)</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity 
                      absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2
                      bg-green-700 text-white text-xs rounded px-2 py-1 z-10">
        Return on Investment in percentage
      </div>
    </div>
  );
}
