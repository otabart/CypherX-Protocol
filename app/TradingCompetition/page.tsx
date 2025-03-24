"use client";
import React from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Leaderboard from "./Components/Leaderboard";
import ScoringExplanation from "./Components/ScoringExplanation";

async function fetchCompetitions() {
  const res = await fetch("/api/competitions");
  if (!res.ok) throw new Error("Failed to fetch competitions");
  return res.json();
}

export default function CompetitionListingPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["competitions"],
    queryFn: fetchCompetitions,
  });

  if (isLoading) {
    return <div className="text-white">Loading competitions...</div>;
  }

  if (error) {
    return <div className="text-white">Error: {(error as Error).message}</div>;
  }

  const competitions = data?.competitions;
  if (!competitions || !Array.isArray(competitions)) {
    return <div className="text-white">No competitions found.</div>;
  }

  return (
    <motion.div
      className="w-full px-4 py-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4">Available Competitions</h2>

      {/* 1 col on mobile, 2 cols on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {competitions.map((comp: any) => (
          <motion.div
            key={comp.id}
            className="bg-[#111] border border-[#0052FF] rounded-lg p-3 shadow-sm w-full"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <h3 className="text-lg font-bold">{comp.title}</h3>
            <p className="mt-1 text-gray-300 text-sm">{comp.description}</p>
            <div className="text-xs text-gray-400 mt-1 space-y-1">
              <p>Entry Fee: {comp.entryFee}</p>
              <p>Prize Pool: {comp.prizePool}</p>
            </div>
            <div className="mt-3 flex justify-end">
              <a
                href={`/TradingCompetition/${comp.id}`}
                className="bg-[#0052FF] hover:bg-blue-500 text-white px-3 py-1 rounded transition text-xs"
              >
                View Details
              </a>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8">
        <Leaderboard />
        <ScoringExplanation />
      </div>
    </motion.div>
  );
}

