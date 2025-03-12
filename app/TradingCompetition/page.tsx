"use client";
import React from "react";
import Link from "next/link";

/**
 * The main listing of two "real" competitions:
 * "Weekly Grand Challenge" & "Weekend Blitz"
 */
export default function CompetitionListingPage() {
  const competitions = [
    {
      id: "weekly-grand",
      title: "Weekly Grand Challenge",
      description: "A 7-day epic competition on Base, top ROI wins big!",
      entryFee: "0.01 ETH",
      prizePool: "2000 USDC",
    },
    {
      id: "weekend-blitz",
      title: "Weekend Blitz",
      description: "Short Fri–Sun burst. Show your best trades for a big pot!",
      entryFee: "Free Entry",
      prizePool: "1000 USDC",
    },
  ];

  return (
    <div className="py-8 px-4 max-w-5xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Available Competitions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {competitions.map((comp) => (
          <div
            key={comp.id}
            className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm hover:shadow-md transition"
          >
            <h3 className="text-xl font-bold text-black">{comp.title}</h3>
            <p className="text-gray-700 mt-1">{comp.description}</p>
            <div className="text-sm text-gray-600 mt-2 space-y-1">
              <p>Entry Fee: {comp.entryFee}</p>
              <p>Prize Pool: {comp.prizePool}</p>
            </div>
            <div className="mt-4 flex justify-end">
              <Link
                href={`/TradingCompetition/${comp.id}`}
                className="bg-[#0052FF] text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



