"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { calculateDynamicPrizePool } from "../lib/competitionLogic";

export type Competition = {
  id: string;
  title: string;
  description: string;
  entryFee: string;
  prizePoolType: "fixed" | "community";
  fixedPrizePool?: string;
  basePrizePool?: number;
  contributionPerParticipant?: number;
  participantCount?: number;
};

export default function CompetitionDetailPage() {
  const { competitionId } = useParams() as { competitionId: string };
  const router = useRouter();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCompetition() {
      try {
        const res = await fetch("/api/competitions");
        if (!res.ok) throw new Error("Failed to fetch competition data");
        const data = await res.json();
        const found = data.competitions.find((c: Competition) => c.id === competitionId);
        setCompetition(found || null);
      } catch (error) {
        console.error("Error fetching competition:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCompetition();
  }, [competitionId]);

  if (loading) return <div className="text-white">Loading competition...</div>;
  if (!competition) return <div className="text-white">Competition not found</div>;

  const dynamicPrizePool =
    competition.prizePoolType === "community" &&
    competition.basePrizePool !== undefined &&
    competition.contributionPerParticipant !== undefined &&
    competition.participantCount !== undefined
      ? `${calculateDynamicPrizePool(
          competition.basePrizePool,
          competition.contributionPerParticipant,
          competition.participantCount
        )} USDC`
      : competition.fixedPrizePool;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <button
        onClick={() => router.back()}
        className="bg-[#0052FF] hover:bg-blue-500 text-white px-3 py-1 rounded mb-4"
      >
        Return
      </button>

      <h1 className="text-3xl font-bold text-white mt-4">{competition.title}</h1>
      <p className="text-gray-300 mt-2">{competition.description}</p>
      <div className="text-sm text-gray-400 mt-4 space-y-1">
        <p>Entry Fee: {competition.entryFee}</p>
        <p>Prize Pool: {dynamicPrizePool}</p>
      </div>
    </div>
  );
}

