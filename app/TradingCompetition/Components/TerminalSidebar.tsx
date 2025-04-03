// app/TradingCompetition/Components/TerminalSidebar.tsx
"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCompetitionContext } from "../CompetitionContext";

export default function TerminalSidebar() {
  const { connectedWallet, displayName } = useCompetitionContext();
  const router = useRouter();

  const handleProfileConnect = () => {
    router.push("/login");
  };

  return (
    <aside className="w-64 h-screen border-r border-[#0052FF] p-4 flex flex-col">
      <div className="mb-4 border-b border-[#0052FF] pb-2">
        <span className="text-[#0052FF] mr-2">user@homebase:</span>
        <span>/TradingCompetition</span>
      </div>
      <div className="mb-6 border-b border-[#0052FF] pb-3">
        <h2 className="font-bold mb-2">Profile</h2>
        {connectedWallet ? (
          <p>{displayName ? displayName : shortAddress(connectedWallet)}</p>
        ) : (
          <button
            onClick={handleProfileConnect}
            className="text-gray-400 hover:text-[#0052FF] focus:outline-none"
          >
            Not connected (click to connect)
          </button>
        )}
      </div>
      <nav className="flex flex-col space-y-2">
        <Link href="/TradingCompetition" className="hover:text-[#0052FF]">
          Competitions
        </Link>
        <Link href="/TradingCompetition/dashboard" className="hover:text-[#0052FF]">
          Dashboard
        </Link>
        <Link href="/TradingCompetition/admin" className="hover:text-[#0052FF]">
          Admin Panel
        </Link>
      </nav>
    </aside>
  );
}

function shortAddress(address: string) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}





