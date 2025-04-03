// app/TradingCompetition/admin/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

export default function AdminPanel() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    entryFee: 0,
    prizeFundingType: "self", // "self" or "community"
    fixedPrizePool: 0,
    basePrizePool: 0,
    contributionPerParticipant: 0,
    startDate: "", // ISO date-time string
    maxParticipants: 0,
  });
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    fetchTournaments();
  }, []);

  async function fetchTournaments() {
    try {
      const res = await fetch("/api/competitions");
      const data = await res.json();
      if (data.competitions) {
        setTournaments(data.competitions);
      }
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

    try {
      const res = await fetch("/api/admin/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
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
      } else {
        toast.error(data.message || "Error creating tournament");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to create tournament");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 font-mono">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
      <form onSubmit={handleCreate} className="bg-gray-900 p-4 rounded shadow-md max-w-md">
        {/* Tournament Title */}
        <div className="mb-3">
          <label className="block mb-1" htmlFor="title">
            Tournament Title
          </label>
          <input
            id="title"
            type="text"
            placeholder="Enter tournament title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full p-2 border border-gray-700 rounded bg-black text-white"
          />
        </div>
        {/* Tournament Description */}
        <div className="mb-3">
          <label className="block mb-1" htmlFor="description">
            Tournament Description
          </label>
          <textarea
            id="description"
            placeholder="Enter tournament description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full p-2 border border-gray-700 rounded bg-black text-white resize-none"
          />
        </div>
        {/* Entry Fee */}
        <div className="mb-3">
          <label className="block mb-1" htmlFor="entryFee">
            Entry Fee (USDC)
          </label>
          <input
            id="entryFee"
            type="number"
            placeholder="Enter entry fee"
            value={form.entryFee}
            onChange={(e) => setForm({ ...form, entryFee: Number(e.target.value) })}
            className="w-full p-2 border border-gray-700 rounded bg-black text-white"
          />
        </div>
        {/* Prize Funding Type */}
        <div className="mb-3">
          <label className="block mb-1">Prize Funding Type</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="self"
                checked={form.prizeFundingType === "self"}
                onChange={(e) => setForm({ ...form, prizeFundingType: e.target.value })}
                className="mr-2"
              />
              Self Funded (Prize upfront)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="community"
                checked={form.prizeFundingType === "community"}
                onChange={(e) => setForm({ ...form, prizeFundingType: e.target.value })}
                className="mr-2"
              />
              Community Funded (Prize from entry fees)
            </label>
          </div>
        </div>
        {form.prizeFundingType === "self" ? (
          <div className="mb-3">
            <label className="block mb-1" htmlFor="fixedPrizePool">
              Fixed Prize Pool (USDC)
            </label>
            <input
              id="fixedPrizePool"
              type="number"
              placeholder="Enter fixed prize pool"
              value={form.fixedPrizePool}
              onChange={(e) => setForm({ ...form, fixedPrizePool: Number(e.target.value) })}
              className="w-full p-2 border border-gray-700 rounded bg-black text-white"
            />
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="block mb-1" htmlFor="basePrizePool">
                Base Prize Pool (USDC)
              </label>
              <input
                id="basePrizePool"
                type="number"
                placeholder="Enter base prize pool"
                value={form.basePrizePool}
                onChange={(e) => setForm({ ...form, basePrizePool: Number(e.target.value) })}
                className="w-full p-2 border border-gray-700 rounded bg-black text-white"
              />
            </div>
            <div className="mb-3">
              <label className="block mb-1" htmlFor="contributionPerParticipant">
                Contribution Per Participant (USDC)
              </label>
              <input
                id="contributionPerParticipant"
                type="number"
                placeholder="Enter contribution amount"
                value={form.contributionPerParticipant}
                onChange={(e) => setForm({ ...form, contributionPerParticipant: Number(e.target.value) })}
                className="w-full p-2 border border-gray-700 rounded bg-black text-white"
              />
            </div>
          </>
        )}
        {/* Tournament Start Date/Time */}
        <div className="mb-3">
          <label className="block mb-1" htmlFor="startDate">
            Tournament Start Date/Time
          </label>
          <input
            id="startDate"
            type="datetime-local"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full p-2 border border-gray-700 rounded bg-black text-white"
          />
        </div>
        {/* Maximum Participants */}
        <div className="mb-3">
          <label className="block mb-1" htmlFor="maxParticipants">
            Maximum Participants (Trader Cap)
          </label>
          <input
            id="maxParticipants"
            type="number"
            placeholder="Enter maximum number of traders"
            value={form.maxParticipants}
            onChange={(e) => setForm({ ...form, maxParticipants: Number(e.target.value) })}
            className="w-full p-2 border border-gray-700 rounded bg-black text-white"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-[#0052FF] text-white rounded hover:bg-blue-500">
          Create Tournament
        </button>
      </form>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Existing Tournaments</h2>
        {tournaments.length ? (
          <ul className="bg-gray-900 p-4 rounded shadow-md">
            {tournaments.map((t) => (
              <li key={t.id} className="border-b border-gray-700 py-2">
                <strong>{t.title}</strong> – Entry Fee: {t.entryFee} – Type: {t.prizeFundingType} – Starts: {t.startDate} – Max: {t.maxParticipants}
              </li>
            ))}
          </ul>
        ) : (
          <p>No tournaments found.</p>
        )}
      </div>
    </div>
  );
}








