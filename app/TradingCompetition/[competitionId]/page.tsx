// app/TradingCompetition/[competitionId]/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCompetitionContext } from "../CompetitionContext";
import { calculateDynamicPrizePool } from "../lib/competitionLogic";
import { ethers } from "ethers";
import JoinCompetitionForm from "../Components/JoinCompetitionForm";

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

const TRADING_COMPETITION_ADDRESS = "0xYourContractAddressHere";
const TRADING_COMPETITION_ABI = [
  "function competitions(uint256 id) public view returns (uint256, string memory, string memory, uint256, string memory, uint256, uint256, uint256)",
  "function getParticipantCount(uint256 competitionId) public view returns (uint256)",
];

export default function CompetitionDetailPage() {
  const { competitionId } = useParams() as { competitionId: string };
  const router = useRouter();
  const { provider, joinedCompetitions } = useCompetitionContext();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchCompetition() {
      if (!provider) {
        setLoading(false);
        return;
      }
      try {
        const contract = new ethers.Contract(TRADING_COMPETITION_ADDRESS, TRADING_COMPETITION_ABI, provider);
        const compData = await contract.competitions(ethers.toBigInt(competitionId));
        const participantCount = Number(await contract.getParticipantCount(ethers.toBigInt(competitionId)));

        const formattedCompetition: Competition = {
          id: competitionId,
          title: compData[1],
          description: compData[2],
          entryFee: ethers.formatEther(compData[3]) + " ETH",
          prizePoolType: compData[4] === "fixed" ? "fixed" : "community",
          fixedPrizePool: compData[4] === "fixed" ? ethers.formatEther(compData[5]) + " ETH" : undefined,
          basePrizePool: compData[4] === "community" ? Number(ethers.formatEther(compData[6])) : undefined,
          contributionPerParticipant: compData[4] === "community" ? Number(ethers.formatEther(compData[7])) : undefined,
          participantCount,
        };
        setCompetition(formattedCompetition);
      } catch (error) {
        console.error("Error fetching competition:", error);
        setCompetition(null);
      } finally {
        setLoading(false);
      }
    }
    fetchCompetition();
  }, [competitionId, provider]);

  if (loading) return <div className="text-white text-center py-4">Loading competition...</div>;
  if (!competition) return <div className="text-white text-center py-4">Competition not found</div>;

  const dynamicPrizePool =
    competition.prizePoolType === "community" &&
    competition.basePrizePool !== undefined &&
    competition.contributionPerParticipant !== undefined &&
    competition.participantCount !== undefined
      ? `${calculateDynamicPrizePool(
          competition.basePrizePool,
          competition.contributionPerParticipant,
          competition.participantCount
        )} ETH`
      : competition.fixedPrizePool;

  const joined = joinedCompetitions.includes(competitionId);

  return (
    <div className="p-6 max-w-3xl mx-auto bg-black min-h-screen">
      <button
        onClick={() => router.back()}
        className="bg-[#0052FF] hover:bg-blue-500 text-white px-4 py-2 rounded mb-6 transition"
      >
        Return
      </button>

      <div className="bg-gray-900 border border-[#0052FF] rounded-lg p-6 shadow-lg">
        <h1 className="text-4xl font-bold text-white mb-4">{competition.title}</h1>
        <p className="text-gray-300 text-lg mb-6">{competition.description}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-400">
          <p>Entry Fee: <span className="text-white">{competition.entryFee}</span></p>
          <p>Prize Pool: <span className="text-white">{dynamicPrizePool}</span></p>
          <p>Participants: <span className="text-white">{competition.participantCount}</span></p>
          <p>Type: <span className="text-white">{competition.prizePoolType}</span></p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={joined}
            className={`px-6 py-3 rounded transition ${
              joined ? "bg-gray-600 cursor-not-allowed" : "bg-[#0052FF] hover:bg-blue-500"
            } text-white`}
          >
            {joined ? "Joined" : "Join Now"}
          </button>
        </div>
      </div>

      {isModalOpen && !joined && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-gray-900 p-6 rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
              onClick={() => setIsModalOpen(false)}
            >
              ✕
            </button>
            <JoinCompetitionForm competitionId={competitionId} competitionTitle={competition.title} />
          </div>
        </div>
      )}
    </div>
  );
}

