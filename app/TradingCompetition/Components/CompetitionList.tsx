"use client";
import React from "react";
import CompetitionCard from "./CompetitionCard";

export default function CompetitionList() {
  const competitions = [
    {
      id: "weekly1",
      title: "Weekly Challenge",
      description: "A full 7-day test. Highest ROI wins!",
      entryFee: "Free",
      prizePool: "1,000 USDC",
    },
    {
      id: "weekend1",
      title: "Weekend Blitz",
      description: "Short Fri–Sun burst. Show your best trades!",
      entryFee: "0.01 ETH",
      prizePool: "500 USDC",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {competitions.map((comp) => (
        <CompetitionCard key={comp.id} {...comp} />
      ))}
    </div>
  );
}



