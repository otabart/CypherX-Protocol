// app/TradingCompetition/Components/CompetitionCard.tsx
"use client";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import JoinCompetitionForm from "./JoinCompetitionForm";
import { calculateDynamicPrizePool } from "../lib/competitionLogic";
import { useCompetitionContext } from "../CompetitionContext";
import { motion } from "framer-motion";

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
    <div className="bg-gray-900 border border-[#0052FF] rounded-lg p-4 shadow-lg transition hover:shadow-xl">
      <h3 className="text-xl font-bold text-white">{props.title}</h3>
      <p className="mt-2 text-gray-300">{props.description}</p>
      <div className="text-sm text-gray-400 mt-3 space-y-1">
        <p>Entry Fee: {props.entryFee} ETH</p>
        <p>Prize Pool: {dynamicPrizePool}</p>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleJoinClick}
          disabled={joined}
          className={`px-4 py-2 rounded transition ${
            joined ? "bg-gray-600 cursor-not-allowed" : "bg-[#0052FF] hover:bg-blue-500"
          } text-white`}
        >
          {joined ? "Joined" : "Join Challenge"}
        </button>
      </div>
      {isModalOpen && !joined && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsModalOpen(false)}
        >
          <motion.div
            className="bg-gray-900 p-6 rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
          >
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
              onClick={() => setIsModalOpen(false)}
            >
              ✕
            </button>
            <JoinCompetitionForm competitionId={props.id} competitionTitle={props.title} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}