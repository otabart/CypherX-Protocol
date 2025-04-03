// app/TradingCompetition/Components/CompetitionListingPage.tsx
"use client";
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import TournamentNotifications from "./TournamentNotifications";

export type Competition = {
  id: string;
  title: string;
  description: string;
  entryFee: number;
  prizeFundingType: string;
  startDate: string;
};

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

  const competitions: Competition[] = data?.competitions || [];

  const [sortKey, setSortKey] = useState<keyof Competition>("startDate");
  const [filterFundingType, setFilterFundingType] = useState<string>("all");
  const [filterKeyword, setFilterKeyword] = useState("");

  const filteredCompetitions = useMemo(() => {
    let filtered = competitions.filter((comp) =>
      comp.title.toLowerCase().includes(filterKeyword.toLowerCase())
    );
    if (filterFundingType !== "all") {
      filtered = filtered.filter((comp) => comp.prizeFundingType === filterFundingType);
    }
    return filtered.sort((a, b) => {
      if (sortKey === "startDate") {
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      }
      if (a[sortKey] < b[sortKey]) return -1;
      if (a[sortKey] > b[sortKey]) return 1;
      return 0;
    });
  }, [competitions, filterKeyword, filterFundingType, sortKey]);

  if (isLoading) return <div className="text-white">Loading competitions...</div>;
  if (error) return <div className="text-white">Error loading competitions.</div>;

  return (
    <motion.div
      className="w-full px-4 py-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <TournamentNotifications />
      <h2 className="text-2xl font-bold mb-4 text-white">Available Competitions</h2>
      <div className="mb-4 flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
        <input
          type="text"
          placeholder="Search competitions..."
          value={filterKeyword}
          onChange={(e) => setFilterKeyword(e.target.value)}
          className="px-3 py-2 border rounded"
        />
        <select
          value={filterFundingType}
          onChange={(e) => setFilterFundingType(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">All Funding Types</option>
          <option value="self">Self Funded</option>
          <option value="community">Community Funded</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as keyof Competition)}
          className="px-3 py-2 border rounded"
        >
          <option value="startDate">Start Date</option>
          <option value="entryFee">Entry Fee</option>
          <option value="title">Title</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCompetitions.length ? (
          filteredCompetitions.map((comp) => (
            <motion.div
              key={comp.id}
              className="bg-[#111] border border-[#0052FF] rounded-lg p-3 shadow-sm text-white"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <h3 className="text-lg font-bold">{comp.title}</h3>
              <p className="mt-1 text-gray-300 text-sm">{comp.description}</p>
              <div className="text-xs text-gray-400 mt-1">
                <p>Entry Fee: {comp.entryFee}</p>
                <p>Funding: {comp.prizeFundingType}</p>
                <p>Starts: {new Date(comp.startDate).toLocaleString()}</p>
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
          ))
        ) : (
          <p className="text-white">No competitions found.</p>
        )}
      </div>
    </motion.div>
  );
}









