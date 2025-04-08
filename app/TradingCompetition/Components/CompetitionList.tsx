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

  if (isLoading) return <div className="text-white text-center py-4">Loading competitions...</div>;
  if (error) return <div className="text-white text-center py-4">Error loading competitions.</div>;

  return (
    <motion.div
      className="w-full px-4 py-6 bg-black"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <TournamentNotifications />
      <h2 className="text-3xl font-bold mb-6 text-white">Available Competitions</h2>
      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search competitions..."
          value={filterKeyword}
          onChange={(e) => setFilterKeyword(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-[#0052FF]"
        />
        <select
          value={filterFundingType}
          onChange={(e) => setFilterFundingType(e.target.value)}
          className="w-[180px] px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-[#0052FF]"
        >
          <option value="all">All Funding Types</option>
          <option value="self">Self Funded</option>
          <option value="community">Community Funded</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as keyof Competition)}
          className="w-[180px] px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-[#0052FF]"
        >
          <option value="startDate">Start Date</option>
          <option value="entryFee">Entry Fee</option>
          <option value="title">Title</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompetitions.length ? (
          filteredCompetitions.map((comp) => (
            <motion.div
              key={comp.id}
              className="bg-gray-900 border border-[#0052FF] rounded-lg p-4 shadow-lg hover:shadow-xl transition-shadow"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <h3 className="text-xl font-bold text-white">{comp.title}</h3>
              <p className="mt-2 text-gray-300 text-sm">{comp.description}</p>
              <div className="text-sm text-gray-400 mt-3 space-y-1">
                <p>Entry Fee: {comp.entryFee} ETH</p>
                <p>Funding: {comp.prizeFundingType}</p>
                <p>Starts: {new Date(comp.startDate).toLocaleString()}</p>
              </div>
              <div className="mt-4 flex justify-end">
                <a
                  href={`/TradingCompetition/${comp.id}`}
                  className="bg-[#0052FF] hover:bg-blue-500 text-white px-4 py-2 rounded transition"
                >
                  View Details
                </a>
              </div>
            </motion.div>
          ))
        ) : (
          <p className="text-white text-center col-span-full">No competitions found.</p>
        )}
      </div>
    </motion.div>
  );
}