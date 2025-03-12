"use client";
import React, { useEffect, useState } from "react";

type Participant = {
  username: string;
  wallet: string;
  roi: number;
  rank: number;
};

type LeaderboardProps = {
  competitionId?: string;
};

export default function Leaderboard({ competitionId }: LeaderboardProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    // In real scenario, fetch from your API
    setParticipants([
      { username: "TraderOne", wallet: "0x123", roi: 45.2, rank: 1 },
      { username: "BlockMaster", wallet: "0x456", roi: 31.7, rank: 2 },
    ]);
  }, [competitionId]);

  return (
    <div className="bg-white border border-gray-300 p-4 rounded shadow-sm mt-4">
      <h3 className="text-lg font-bold text-black mb-3">Leaderboard</h3>
      <table className="w-full text-sm text-gray-700">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 text-left">Rank</th>
            <th className="py-2 text-left">Username</th>
            <th className="py-2 text-left">ROI (%)</th>
            <th className="py-2 text-left">Wallet</th>
          </tr>
        </thead>
        <tbody>
          {partic



