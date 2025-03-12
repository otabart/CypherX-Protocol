"use client";
import React, { createContext, useContext, useState } from "react";

type CompetitionContextType = {
  connectedWallet: string;
  joinedCompetitions: string[];
  connectWallet: () => void;
  joinCompetition: (competitionId: string) => void;
};

const CompetitionContext = createContext<CompetitionContextType | null>(null);

export function CompetitionProvider({ children }: { children: React.ReactNode }) {
  const [connectedWallet, setConnectedWallet] = useState("");
  const [joinedCompetitions, setJoinedCompetitions] = useState<string[]>([]);

  function connectWallet() {
    // Fake wallet address; replace with real wagmi or Web3Modal logic if needed
    setConnectedWallet("0xFAKEC0INBASE1234");
  }

  function joinCompetition(competitionId: string) {
    // If user not already joined
    if (!joinedCompetitions.includes(competitionId)) {
      setJoinedCompetitions([...joinedCompetitions, competitionId]);
    }
  }

  return (
    <CompetitionContext.Provider
      value={{ connectedWallet, joinedCompetitions, connectWallet, joinCompetition }}
    >
      {children}
    </CompetitionContext.Provider>
  );
}

export function useCompetitionContext() {
  const ctx = useContext(CompetitionContext);
  if (!ctx) {
    throw new Error("useCompetitionContext must be used within CompetitionProvider");
  }
  return ctx;
}
