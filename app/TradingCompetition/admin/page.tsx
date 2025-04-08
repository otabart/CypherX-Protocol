// app/TradingCompetition/admin/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useCompetitionContext } from "../CompetitionContext";
import { ethers } from "ethers";

export default function AdminPanel() {
  const { provider, signer } = useCompetitionContext();
  const [form, setForm] = useState({
    title: "",
    description: "",
    entryFee: 0,
    prizeFundingType: "self",
    fixedPrizePool: 0,
    basePrizePool: 0,
    contributionPerParticipant: 0,
    startDate: "",
    maxParticipants: 0,
  });
  const [tournaments, setTournaments] = useState<any[]>([]);

  const TRADING_COMPETITION_ADDRESS = "0xYourContractAddressHere";
  const TRADING_COMPETITION_ABI = [
    "function createCompetition(string title, string description, uint256 entryFee, string prizeFundingType, uint256 fixedPrizePool, uint256 basePrizePool, uint256 contributionPerParticipant, uint256 startTimestamp, uint256 maxParticipants) public",
    "function getCompetitionCount() public view returns (uint256)",
    "function competitions(uint256 id) public view returns (uint256, string memory, string memory, uint256, string memory, uint256, uint256, uint256, uint256)",
  ];

  useEffect(() => {
    fetchTournaments();
  }, [provider]);

  async function fetchTournaments() {
    if (!provider) return;
    try {
      const contract = new ethers.Contract(TRADING_COMPETITION_ADDRESS, TRADING_COMPETITION_ABI, provider);
      const count = Number(await contract.getCompetitionCount());
      const tournamentPromises = [];
      for (let i = 0; i < count; i++) {
        tournamentPromises.push(contract.competitions(i));
      }
      const tournamentsData = await Promise.all(tournamentPromises);
      const formattedTournaments = tournamentsData.map((t, index) => ({
        id: index.toString(),
        title: t[1],
        description: t[2],
        entryFee: Number(ethers.formatEther(t[3])),
        prizeFundingType: t[4],
        fixedPrizePool: Number(ethers.formatEther(t[5])),
        basePrizePool: Number(ethers.formatEther(t[6])),
        contributionPerParticipant: Number(ethers.formatEther(t[7])),
        startDate: new Date(Number(t[8]) * 1000).toISOString(),
        maxParticipants: Number(t[9]),
      }));
      setTournaments(formattedTournaments);
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch tournaments");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { title, description, entryFee, startDate, maxParticipants } = form;
    if (!title || !description || entryFee <= 0 || !startDate || maxParticipants <= 0) {
      toast.error("Invalid form data");
      return;
    }
    if (!signer) {
      toast.error("Please connect your wallet to create a tournament");
      return;
    }

    try {
      const contract = new ethers.Contract(TRADING_COMPETITION_ADDRESS, TRADING_COMPETITION_ABI, signer);
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      const tx = await contract.createCompetition(
        title,
        description,
        ethers.parseEther(entryFee.toString()),
        form.prizeFundingType,
        ethers.parseEther(form.fixedPrizePool.toString()),
        ethers.parseEther(form.basePrizePool.toString()),
        ethers.parseEther(form.contributionPerParticipant.toString()),
        startTimestamp,
        maxParticipants
      );
      toast.success("Transaction sent! Waiting for confirmation...");
      await tx.wait();
      toast.success("Tournament created!");
      setForm({
        title: "",
        description: "",
        entryFee: 0,
        prizeFundingType: "self",
        fixedPrizePool: 0,
        basePrizePool: 0,
        contributionPerParticipant: 0,
        startDate: "",
        maxParticipants: 0,
      });
      fetchTournaments();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create tournament");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-mono">
      <h1 className="text-4xl font-bold mb-8 text-center">Admin Panel</h1>
      <form onSubmit={handleCreate} className="bg-gray-900 p-6 rounded-lg shadow-lg max-w-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-full">
            <label className="block mb-1 text-sm" htmlFor="title">
              Tournament Title
            </label>
            <input
              id="title"
              type="text"
              placeholder="Enter tournament title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full p-3 border border-gray-700 rounded bg-black text-white focus:outline-none focus:border-[#0052FF]"
            />
          </div>
          <div className="col-span-full">
            <label className="block mb-1 text-sm" htmlFor="description">
              Tournament Description
            </label>
            <textarea
              id="description"
              placeholder="Enter tournament description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full p-3 border border-gray-700 rounded bg-black text-white resize-none focus:outline-none focus:border-[#0052FF]"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm" htmlFor="entryFee">
              Entry Fee (ETH)
            </label>
            <input
              id="entryFee"
              type="number"
              step="0.01"
              placeholder="Enter entry fee"
              value={form.entryFee}
              onChange={(e) => setForm({ ...form, entryFee: Number(e.target.value) })}
              className="w-full p-3 border border-gray-700 rounded bg-black text-white focus:outline-none focus:border-[#0052FF]"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm" htmlFor="startDate">
              Start Date/Time
            </label>
            <input
              id="startDate"
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full p-3 border border-gray-700 rounded bg-black text-white focus:outline-none focus:border-[#0052FF]"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm" htmlFor="maxParticipants">
              Max Participants
            </label>
            <input
              id="maxParticipants"
              type="number"
              placeholder="Enter max traders"
              value={form.maxParticipants}
              onChange={(e) => setForm({ ...form, maxParticipants: Number(e.target.value) })}
              className="w-full p-3 border border-gray-700 rounded bg-black text-white focus:outline-none focus:border-[#0052FF]"
            />
          </div>
          <div className="col-span-full">
            <label className="block mb-1 text-sm">Prize Funding Type</label>
            <div className="flex space-x-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="self"
                  checked={form.prizeFundingType === "self"}
                  onChange={(e) => setForm({ ...form, prizeFundingType: e.target.value })}
                  className="mr-2"
                />
                Self Funded
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="community"
                  checked={form.prizeFundingType === "community"}
                  onChange={(e) => setForm({ ...form, prizeFundingType: e.target.value })}
                  className="mr-2"
                />
                Community Funded
              </label>
            </div>
          </div>
          {form.prizeFundingType === "self" ? (
            <div className="col-span-full">
              <label className="block mb-1 text-sm" htmlFor="fixedPrizePool">
                Fixed Prize Pool (ETH)
              </label>
              <input
                id="fixedPrizePool"
                type="number"
                step="0.01"
                placeholder="Enter fixed prize pool"
                value={form.fixedPrizePool}
                onChange={(e) => setForm({ ...form, fixedPrizePool: Number(e.target.value) })}
                className="w-full p-3 border border-gray-700 rounded bg-black text-white focus:outline-none focus:border-[#0052FF]"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block mb-1 text-sm" htmlFor="basePrizePool">
                  Base Prize Pool (ETH)
                </label>
                <input
                  id="basePrizePool"
                  type="number"
                  step="0.01"
                  placeholder="Enter base prize pool"
                  value={form.basePrizePool}
                  onChange={(e) => setForm({ ...form, basePrizePool: Number(e.target.value) })}
                  className="w-full p-3 border border-gray-700 rounded bg-black text-white focus:outline-none focus:border-[#0052FF]"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm" htmlFor="contributionPerParticipant">
                  Contribution Per Participant (ETH)
                </label>
                <input
                  id="contributionPerParticipant"
                  type="number"
                  step="0.01"
                  placeholder="Enter contribution"
                  value={form.contributionPerParticipant}
                  onChange={(e) => setForm({ ...form, contributionPerParticipant: Number(e.target.value) })}
                  className="w-full p-3 border border-gray-700 rounded bg-black text-white focus:outline-none focus:border-[#0052FF]"
                />
              </div>
            </>
          )}
        </div>
        <button
          type="submit"
          className="mt-6 w-full px-4 py-3 bg-[#0052FF] text-white rounded hover:bg-blue-500 transition"
        >
          Create Tournament
        </button>
      </form>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Existing Tournaments</h2>
        {tournaments.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="bg-gray-900 p-4 rounded-lg shadow-md border border-gray-800"
              >
                <strong className="text-lg text-white">{t.title}</strong>
                <p className="text-gray-400 mt-1">Entry Fee: {t.entryFee} ETH</p>
                <p className="text-gray-400">Type: {t.prizeFundingType}</p>
                <p className="text-gray-400">Starts: {new Date(t.startDate).toLocaleString()}</p>
                <p className="text-gray-400">Max: {t.maxParticipants}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">No tournaments found.</p>
        )}
      </div>
    </div>
  );
}