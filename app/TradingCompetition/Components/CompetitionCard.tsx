"use client";
import React, { useState } from "react";
import JoinCompetitionForm from "./JoinCompetitionForm";

type CompetitionCardProps = {
  id: string;
  title: string;
  description: string;
  entryFee: string;
  prizePool: string;
};

export default function CompetitionCard({
  id,
  title,
  description,
  entryFee,
  prizePool,
}: CompetitionCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // When user clicks "View / Join"
  function openModal() {
    setIsModalOpen(true);
  }

  // Close the modal
  function closeModal() {
    setIsModalOpen(false);
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm hover:shadow-md transition relative">
      <h3 className="text-xl font-bold text-black">{title}</h3>
      <p className="text-gray-700 mt-1">{description}</p>

      <div className="text-sm text-gray-600 mt-3 space-y-1">
        <p>Entry Fee: {entryFee}</p>
        <p>Prize Pool: {prizePool}</p>
      </div>

      {/* BUTTON - triggers modal */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={openModal}
          className="bg-[#0052FF] text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          View / Join
        </button>
      </div>

      {/* MODAL Overaly & Content */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closeModal}
        >
          {/* Stop click from closing the modal if user clicks the panel itself */}
          <div
            className="bg-white p-6 rounded shadow-md max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button (Top-Right) */}
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
              onClick={closeModal}
            >
              X
            </button>

            <h2 className="text-xl font-bold mb-4 text-black">
              Join {title}
            </h2>

            {/* Our JoinCompetitionForm, referencing competition ID */}
            <JoinCompetitionForm competitionId={id} />

          </div>
        </div>
      )}
    </div>
  );
}




