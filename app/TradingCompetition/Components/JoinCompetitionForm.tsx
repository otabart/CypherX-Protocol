// app/TradingCompetition/Components/JoinCompetitionForm.tsx
"use client";
import React, { useState } from "react";
import { toast } from "react-hot-toast";

type JoinCompetitionFormProps = {
  competitionId: string;
};

export default function JoinCompetitionForm({ competitionId }: JoinCompetitionFormProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!walletAddress || walletAddress.length < 10) {
      setError("Please enter a valid wallet address.");
      return;
    }

    setLoading(true);

    try {
      // POST to the join endpoint (simulate entry fee payment and join process)
      const res = await fetch(`/api/competitions/${competitionId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress }),
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
      <div>
        <label className="block text-sm font-semibold text-white">
          Wallet Address
        </label>
        <input
          type="text"
          className="w-full mt-1 border border-gray-700 rounded px-3 py-2 bg-[#111] text-white"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="0xabc123..."
          disabled={loading}
        />
      </div>
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





