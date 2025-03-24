// app/TradingCompetition/Components/Header.tsx
"use client";
import React, { useState } from "react";
import { useCompetitionContext } from "../CompetitionContext";

export default function Header() {
  const { connectedWallet, connectWallet, disconnectWallet } = useCompetitionContext();
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    await connectWallet();
    setConnecting(false);
  }

  return (
    <header className="w-full bg-white border-b border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">
      <h1 className="text-xl font-bold text-[#0052FF]">Trading Competitions</h1>
      <div>
        {connectedWallet ? (
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">
              {connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}
            </span>
            <button
              onClick={disconnectWallet}
              className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700 transition"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-[#0052FF] text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}




