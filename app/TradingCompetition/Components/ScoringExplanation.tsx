// app/TradingCompetition/Components/ScoringExplanation.tsx
"use client";
import React from "react";
import TooltipExample from "./TooltipExample";

export default function ScoringExplanation() {
  return (
    <div className="bg-[#111] border border-[#0052FF] p-4 rounded mt-6">
      <h4 className="text-lg font-bold mb-2">Scoring System Explanation</h4>
      <p className="text-sm">
        The composite score is calculated using the following formula:
      </p>
      <pre className="bg-black text-white p-2 mt-2 text-xs rounded">
        score = (profit × 0.5) + (<TooltipExample /> × 0.3) - (trades × 0.2)
      </pre>
      <p className="text-xs mt-2 text-gray-300">
        Profit is measured in USD, ROI in percentage, and trades are penalized.
      </p>
    </div>
  );
}

