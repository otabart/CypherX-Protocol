// app/TradingCompetition/Components/ScoringExplanation.tsx
"use client";
import React from "react";

function Tooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="relative group inline-block">
      <span className="underline cursor-help">{label}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity 
                      absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2
                      bg-green-700 text-white text-xs rounded px-2 py-1 z-10">
        {tooltip}
      </div>
    </div>
  );
}

export default function ScoringExplanation() {
  return (
    <div className="bg-[#111] border border-[#0052FF] p-4 rounded mt-6">
      <h4 className="text-lg font-bold mb-2">Scoring System Explanation</h4>
      <p className="text-sm mb-2">The composite score is calculated using the following formula:</p>
      <pre className="bg-black text-white p-2 mt-2 text-xs rounded">
        score = (<Tooltip label="Profit" tooltip="Net profit in USD" /> × 0.5) + 
                (<Tooltip label="ROI (%)" tooltip="Return on Investment in percentage" /> × 0.3) - 
                (<Tooltip label="Trades" tooltip="Number of trades, which are penalized" /> × 0.2)
      </pre>
      <p className="text-xs mt-2 text-gray-300">
        Profit is measured in USD, ROI is in percentage, and trades are deducted as a penalty.
      </p>
    </div>
  );
}


