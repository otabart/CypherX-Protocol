// app/TradingCompetition/Components/Leaderboard.tsx
"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";

type Participant = {
  username: string;
  wallet: string;
  profit: number;
  roi: number;
  trades: number;
};

async function fetchLeaderboardData() {
  // Return empty data for now
  return { participants: [] };
}

export default function Leaderboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboardData,
  });

  if (isLoading) {
    return (
      <div className="bg-[#111] border border-[#0052FF] p-4 rounded shadow-sm mt-4">
        <p className="text-white">Loading leaderboard...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-white">Error: {(error as Error).message}</div>;
  }

  const participants = data?.participants;

  return (
    <div className="bg-[#111] border border-[#0052FF] p-4 rounded shadow-sm mt-4">
      <h3 className="text-lg font-bold mb-3">Leaderboard</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#0052FF]">
            <th className="py-2 text-left">Rank</th>
            <th className="py-2 text-left">Username</th>
            <th className="py-2 text-left">Score</th>
            <th className="py-2 text-left">Profit ($)</th>
            <th className="py-2 text-left">ROI (%)</th>
            <th className="py-2 text-left">Trades</th>
          </tr>
        </thead>
        <tbody>
          {participants && participants.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-4 text-center text-white">
                No participants yet.
              </td>
            </tr>
          ) : (
            // Future implementation: Render participant rows when data is available.
            null
          )}
        </tbody>
      </table>
    </div>
  );
}

