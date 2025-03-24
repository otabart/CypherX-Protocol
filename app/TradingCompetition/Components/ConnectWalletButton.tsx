// app/TradingCompetition/Components/ConnectWalletButton.tsx
"use client";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { useCompetitionContext } from "../CompetitionContext";

export default function ConnectWalletButton() {
  const { connectedWallet, connectWallet, disconnectWallet } = useCompetitionContext();
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    try {
      setConnecting(true);
      await connectWallet();
      toast.success("Wallet connected successfully!");
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Failed to connect wallet. Please try again.");
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    disconnectWallet();
    toast("Wallet disconnected.", { icon: "👋" });
  }

  if (connectedWallet) {
    return (
      <button
        onClick={handleDisconnect}
        className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded"
      >
        Disconnect
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="bg-[#0052FF] hover:bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}

