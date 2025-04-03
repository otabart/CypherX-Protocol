// app/TradingCompetition/Components/Leaderboard.tsx
"use client";
import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { calculateCompositeScore } from "../lib/scoringLogic";

type Participant = {
  id: string;
  displayName: string;
  walletAddress: string;
  profit: number;
  roi: number;
  trades: number;
  score: number;
};

export default function Leaderboard() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "competitionParticipants"), orderBy("joinedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Participant[] = [];
      snapshot.forEach((doc) => {
        const p = doc.data();
        const score = calculateCompositeScore(p.profit, p.roi, p.trades);
        data.push({
          id: doc.id,
          displayName: p.displayName,
          walletAddress: p.walletAddress,
          profit: p.profit,
          roi: p.roi,
          trades: p.trades,
          score,
        });
      });
      // Sort descending by score
      data.sort((a, b) => b.score - a.score);
      setParticipants(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leaderboard:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#111] border border-[#0052FF] p-4 rounded shadow-sm mt-4 text-white">
        Loading leaderboard...
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="bg-[#111] border border-[#0052FF] p-4 rounded shadow-sm mt-4 text-white">
        No participants yet.
      </div>
    );
  }

  return (
    <div className="bg-[#111] border border-[#0052FF] p-4 rounded shadow-sm mt-4">
      <h3 className="text-lg font-bold mb-3 text-white">Leaderboard</h3>
      <table className="w-full text-sm text-white">
        <thead>
          <tr className="border-b border-[#0052FF]">
            <th className="py-2 text-left">Rank</th>
            <th className="py-2 text-left">Name</th>
            <th className="py-2 text-left">Score</th>
            <th className="py-2 text-left">Profit ($)</th>
            <th className="py-2 text-left">ROI (%)</th>
            <th className="py-2 text-left">Trades</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p, index) => (
            <tr key={p.id} className="border-b">
              <td className="py-2">{index + 1}</td>
              <td className="py-2">{p.displayName}</td>
              <td className="py-2">{p.score.toFixed(2)}</td>
              <td className="py-2">{p.profit}</td>
              <td className="py-2">{p.roi}</td>
              <td className="py-2">{p.trades}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}





