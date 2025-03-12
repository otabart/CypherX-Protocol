"use client";
import React from "react";
import { CompetitionProvider } from "./CompetitionContext";
import Header from "./Components/Header";

/**
 * layout.tsx
 * Wraps all /TradingCompetition routes with CompetitionProvider and a top header
 */
export default function TradingCompetitionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CompetitionProvider>
      <div className="min-h-screen flex flex-col bg-gray-100 text-black">
        <Header />
        <main className="flex-grow">{children}</main>
      </div>
    </CompetitionProvider>
  );
}




