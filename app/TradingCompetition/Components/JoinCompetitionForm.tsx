// app/TradingCompetition/Components/JoinCompetitionForm.tsx
"use client";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { useCompetitionContext } from "../CompetitionContext";

type JoinCompetitionFormProps = {
  competitionId: string;
};

export default function JoinCompetitionForm({ competitionId }: JoinCompetitionFormProps) {
  const { connectedWallet, displayName } = useCompetitionContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Basic validation
    if (!connectedWallet || !displayName) {
      setError("Please connect your wallet and set a display name before joining.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/competition/${competitionId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress: connectedWallet, displayName }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Join failed");
      }
      toast.success(data.message);
    } catch (err: any) {
      console.error(err);
      setError("Failed to join competition. Please try again.");
      toast.error("Failed to join competition. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-[#0052FF] text-white px-4 py-2 rounded hover:bg-blue-500 transition disabled:opacity-50"
      >
        {loading ? "Joining..." : "Join Now"}
      </button>
    </form>
  );
}







