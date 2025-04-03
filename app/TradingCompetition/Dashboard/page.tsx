// app/TradingCompetition/dashboard/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useCompetitionContext } from "../CompetitionContext";
import { toast } from "react-hot-toast";

type Analytics = {
  totalCompetitions: number;
  totalProfit: number;
  averageROI: number;
  totalTrades: number;
};

export default function Dashboard() {
  const { connectedWallet } = useCompetitionContext();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    if (connectedWallet) {
      fetchAnalytics();
    }
  }, [connectedWallet]);

  async function fetchAnalytics() {
    try {
      const res = await fetch(`/api/user/analytics?wallet=${encodeURIComponent(connectedWallet)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setAnalytics(data.analytics);
      } else {
        toast.error(data.message || "Failed to fetch analytics");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch analytics");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 font-mono">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      {connectedWallet ? (
        <>
          <h2 className="text-2xl mb-4">Your Analytics</h2>
          {analytics ? (
            <div className="bg-gray-900 p-4 rounded shadow-md max-w-md">
              <p>Total Competitions Joined: {analytics.totalCompetitions}</p>
              <p>Total Profit: {analytics.totalProfit}</p>
              <p>Average ROI: {analytics.averageROI.toFixed(2)}%</p>
              <p>Total Trades: {analytics.totalTrades}</p>
            </div>
          ) : (
            <p>Loading analytics...</p>
          )}
        </>
      ) : (
        <p>Please connect your wallet to view your dashboard analytics.</p>
      )}
    </div>
  );
}


