"use client";
import React from "react";
import { useCompetitionContext } from "../../CompetitionContext";

export default function DashboardPage() {
  const { connectedWallet } = useCompetitionContext();

  return (
    <div className="bg-black text-green-400 p-4 border border-green-500 rounded">
      <h2 className="text-xl font-bold mb-4">Dashboard</h2>
      {connectedWallet ? (
        <div>
          <p>Your connected wallet: {connectedWallet}</p>
          <p>Here you can display stats, joined competitions, etc.</p>
        </div>
      ) : (
        <p className="text-red-400">Please connect your wallet to view dashboard details.</p>
      )}
    </div>
  );
}
