// app/TradingCompetition/Components/CompetitionCard.tsx
"use client";
import React, { useState } from "react";
import Link from "next/link";
import JoinCompetitionForm from "./JoinCompetitionForm";
import { calculateDynamicPrizePool } from "../lib/competitionLogic";
import { Competition } from "../CompetitionList/page";

export default function CompetitionCard(props: Competition) {
  const {
    id,
    title,
    description,
    entryFee,
    prizePoolType,
    fixedPrizePool,
    basePrizePool,
    contributionPerParticipant,
    participantCount,
  } = props;

  const [isModalOpen, setIsModalOpen] = useState(false);

  function openModal() {
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  const dynamicPrizePool =
    prizePoolType === "community" &&
    basePrizePool !== undefined &&
    contributionPerParticipant !== undefined &&
    participantCount !== undefined
      ? `${calculateDynamicPrizePool(
          basePrizePool,
          contributionPerParticipant,
          participantCount
        )} USDC`
      : fixedPrizePool;

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm hover:shadow-md transition relative">
      <h3 className="text-xl font-bold text-black">{title}</h3>
      <p className="text-gray-700 mt-1">{description}</p>

      <div className="text-sm text-gray-600 mt-3 space-y-1">
        <p>Entry Fee: {entryFee}</p>
        <p>Prize Pool: {dynamicPrizePool}</p>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={openModal}
          className="bg-[#0052FF] text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          View / Join
        </button>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closeModal}
        >
          <div
            className="bg-white p-6 rounded shadow-md max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
              onClick={closeModal}
            >
              X
            </button>
            <h2 className="text-xl font-bold mb-4 text-black">
              Join {title}
            </h2>
            <JoinCompetitionForm competitionId={id} />
          </div>
        </div>
      )}
    </div>
  );
}






