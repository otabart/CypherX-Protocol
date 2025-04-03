// app/TradingCompetition/Components/CompetitionCard.tsx
"use client";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import JoinCompetitionForm from "./JoinCompetitionForm";
import { calculateDynamicPrizePool } from "../lib/competitionLogic";
import { useCompetitionContext } from "../CompetitionContext";

type CompetitionCardProps = {
  id: string;
  title: string;
  description: string;
  entryFee: number;
  prizePoolType: string;
  fixedPrizePool?: string;
  basePrizePool?: number;
  contributionPerParticipant?: number;
  participantCount?: number;
};

export default function CompetitionCard(props: CompetitionCardProps) {
  const { joinedCompetitions, connectedWallet, displayName } = useCompetitionContext();
  const joined = joinedCompetitions.includes(props.id);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const dynamicPrizePool =
    props.prizePoolType === "community" &&
    props.basePrizePool !== undefined &&
    props.contributionPerParticipant !== undefined &&
    props.participantCount !== undefined
      ? `${calculateDynamicPrizePool(
          props.basePrizePool,
          props.contributionPerParticipant,
          props.participantCount
        )} USDC`
      : props.fixedPrizePool || "N/A";

  function handleJoinClick() {
    if (!connectedWallet || !displayName) {
      toast.error("Please connect your wallet and set your display name before joining.");
      return;
    }
    setIsModalOpen(true);
  }

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm transition relative text-black">
      <h3 className="text-xl font-bold">{props.title}</h3>
      <p className="mt-1">{props.description}</p>
      <div className="text-sm mt-3 space-y-1">
        <p>Entry Fee: {props.entryFee}</p>
        <p>Prize Pool: {dynamicPrizePool}</p>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleJoinClick}
          disabled={joined}
          className={`px-4 py-2 rounded transition ${
            joined ? "bg-gray-400" : "bg-[#0052FF] hover:bg-blue-700"
          } text-white`}
        >
          {joined ? "Joined" : "Join Challenge"}
        </button>
      </div>
      {isModalOpen && !joined && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white p-6 rounded shadow-md max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
              onClick={() => setIsModalOpen(false)}
            >
              X
            </button>
            <h2 className="text-xl font-bold mb-4 text-black">
              Join {props.title}
            </h2>
            <JoinCompetitionForm competitionId={props.id} />
          </div>
        </div>
      )}
    </div>
  );
}









