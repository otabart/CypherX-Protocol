// app/TradingCompetition/Components/JoinCompetitionForm.tsx
"use client";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { useCompetitionContext } from "../CompetitionContext";

type JoinCompetitionFormProps = {
  competitionId: string;
  competitionTitle?: string; // Added for context
};

export default function JoinCompetitionForm({ competitionId, competitionTitle }: JoinCompetitionFormProps) {
  const { connectedWallet, displayName, joinCompetition } = useCompetitionContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!connectedWallet || !displayName) {
      setError("Please connect your wallet and set a display name before joining.");
      return;
    }

    setLoading(true);
    try {
      await joinCompetition(competitionId);
      toast.success(`Successfully joined ${competitionTitle || "competition"}!`);
    } catch (err: any) {
      console.error("Error joining competition:", err);
      setError("Failed to join competition. Please try again.");
      toast.error("Failed to join competition.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg border border-[#0052FF]">
      <h3 className="text-xl font-bold text-white mb-4">
        Join {competitionTitle || "Competition"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-red-400 bg-red-900/20 p-2 rounded text-sm">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#0052FF] text-white px-4 py-2 rounded hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Joining..." : "Join Now"}
        </button>
      </form>
    </div>
  );
}







