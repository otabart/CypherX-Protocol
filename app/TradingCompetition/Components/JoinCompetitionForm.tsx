"use client";
import React, { useState } from "react";

type JoinCompetitionFormProps = {
  competitionId: string;
};

export default function JoinCompetitionForm({ competitionId }: JoinCompetitionFormProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Simulate some join logic
      alert(`Joining comp ${competitionId} with wallet ${walletAddress}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-800">
          Wallet Address
        </label>
        <input
          type="text"
          className="w-full mt-1 border border-gray-300 rounded px-3 py-2 text-black"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="0xabc123..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-[#0052FF] text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? "Joining..." : "Join Now"}
      </button>
    </form>
  );
}



