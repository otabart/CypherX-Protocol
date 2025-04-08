// app/TradingCompetition/Components/Leaderboard.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useCompetitionContext } from "../CompetitionContext";
import { calculateROI } from "../lib/competitionLogic";
import { calculateCompositeScore } from "../lib/scoringLogic";

type Participant = {
  id: string; // walletAddress serves as ID
  displayName: string;
  walletAddress: string;
  profit: number;
  roi: number;
  trades: number;
  score: number;
};

export default function Leaderboard({ competitionId }: { competitionId: string }) {
  const { provider, connectedWallet } = useCompetitionContext();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      if (!provider || !competitionId) {
        setLoading(false);
        return;
      }

      try {
        const contract = new ethers.Contract(
          "0xYourContractAddressHere", // Replace with your contract address
          [
            "function getParticipants(uint256 competitionId) public view returns (address[])",
            "function getProfit(address participant, uint256 competitionId) public view returns (uint256)",
            "function getStartingBalance(address participant, uint256 competitionId) public view returns (uint256)",
            "function getParticipantBalance(address participant, uint256 competitionId) public view returns (uint256)",
            "function getTradeCount(address participant, uint256 competitionId) public view returns (uint256)",
          ],
          provider
        );

        const participantAddresses = await contract.getParticipants(competitionId);
        const data: Participant[] = await Promise.all(
          participantAddresses.map(async (addr: string) => {
            const profit = Number(ethers.formatEther(await contract.getProfit(addr, competitionId))); // Assuming wei
            const startBalance = Number(ethers.formatEther(await contract.getStartingBalance(addr, competitionId)));
            const endBalance = Number(ethers.formatEther(await contract.getParticipantBalance(addr, competitionId)));
            const trades = Number(await contract.getTradeCount(addr, competitionId));
            const roi = calculateROI(startBalance, endBalance);
            const score = calculateCompositeScore(profit, roi, trades);

            return {
              id: addr,
              displayName: addr.slice(0, 6) + "..." + addr.slice(-4), // Placeholder; replace with real name if available
              walletAddress: addr,
              profit,
              roi,
              trades,
              score,
            };
          })
        );

        // Sort descending by score
        data.sort((a, b) => b.score - a.score);
        setParticipants(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching blockchain leaderboard:", error);
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [provider, competitionId]);

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
              <td className="py-2">{p.profit.toFixed(2)}</td>
              <td className="py-2">{p.roi.toFixed(2)}</td>
              <td className="py-2">{p.trades}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}





