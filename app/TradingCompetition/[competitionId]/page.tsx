"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCompetitionContext } from "../CompetitionContext";

export default function CompetitionDetailPage() {
  const { competitionId } = useParams() as { competitionId: string };
  const { connectedWallet, joinedCompetitions, joinCompetition } = useCompetitionContext();

  const [competition, setCompetition] = useState<{
    id: string;
    title: string;
    description: string;
    entryFee: string;
    prizePool: string;
  } | null>(null);

  const isJoined = joinedCompetitions.includes(competitionId);

  useEffect(() => {
    // We'll mimic an API fetch with local data:
    const allComps = [
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

    const found = allComps.find((c) => c.id === competitionId);
    setCompetition(found || null);
  }, [competitionId]);

  if (!competition) {
    return (
      <div className="p-4 text-red-500">
        <p>Competition not found.</p>
        <Link
          href="/TradingCompetition"
          className="text-[#0052FF] underline hover:text-blue-700 mt-4 inline-block"
        >
          ← Back
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <Link
        href="/TradingCompetition"
        className="text-[#0052FF] underline hover:text-blue-700"
      >
        ← Back to Competitions
      </Link>

      <h1 className="text-3xl font-bold text-black mt-4">{competition.title}</h1>
      <p className="text-gray-700 mt-2">{competition.description}</p>
      <div className="text-sm text-gray-600 mt-4 space-y-1">
        <p>Entry Fee: {competition.entryFee}</p>
        <p>Prize Pool: {competition.prizePool}</p>
      </div>

      {/* Join or Already Joined */}
      <div className="mt-6">
        {!connectedWallet ? (
          <p className="text-red-500">
            Please connect your wallet in the top right to join.
          </p>
        ) : isJoined ? (
          <p className="text-green-600 font-semibold">
            You have already joined this competition!
          </p>
        ) : (
          <button
            onClick={() => joinCompetition(competitionId)}
            className="bg-[#0052FF] text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Join This Competition
          </button>
        )}
      </div>

      {/* A simple mini-leaderboard */}
      <div className="mt-8 bg-white border border-gray-300 p-4 rounded shadow-sm">
        <h2 className="text-xl font-bold text-black mb-4">Leaderboard</h2>
        <table className="w-full text-sm text-gray-700">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 text-left">Rank</th>
              <th className="py-2 text-left">Trader</th>
              <th className="py-2 text-left">ROI (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2">1</td>
              <td className="py-2">BlockMaster</td>
              <td className="py-2">42.1%</td>
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2">2</td>
              <td className="py-2">MoonShot</td>
              <td className="py-2">38.7%</td>
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2">3</td>
              <td className="py-2">DeFiDegen</td>
              <td className="py-2">29.5%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}



