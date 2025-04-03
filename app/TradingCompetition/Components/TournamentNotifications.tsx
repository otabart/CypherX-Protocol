// app/TradingCompetition/Components/TournamentNotifications.tsx
"use client";
import React, { useEffect } from "react";
import { toast } from "react-hot-toast";

type Tournament = {
  id: string;
  title: string;
  startDate: string; // ISO string
};

async function fetchTournaments(): Promise<Tournament[]> {
  const res = await fetch("/api/competitions");
  const data = await res.json();
  return data.competitions || [];
}

export default function TournamentNotifications() {
  useEffect(() => {
    const interval = setInterval(async () => {
      const tournaments = await fetchTournaments();
      const now = new Date();
      tournaments.forEach((t) => {
        const start = new Date(t.startDate);
        const diff = start.getTime() - now.getTime();
        // Notify if tournament starts within the next hour
        if (diff > 0 && diff <= 60 * 60 * 1000) {
          toast(`Tournament "${t.title}" starts in less than 1 hour!`);
        }
        // You can add additional thresholds as needed.
      });
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return null;
}
