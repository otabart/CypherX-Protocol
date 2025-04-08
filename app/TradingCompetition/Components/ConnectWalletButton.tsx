"use client";
import React from "react";
import { useCompetitionContext } from "../CompetitionContext";

export default function ConnectWalletButton() {
  const { connectedWallet, connectWallet, disconnectWallet, isAppKitLoading, isConnecting } = useCompetitionContext();

  console.log("Connected wallet in button:", connectedWallet);
  console.log("isAppKitLoading:", isAppKitLoading);
  console.log("isConnecting:", isConnecting);

  async function handleConnect() {
    await connectWallet();
  }

  function handleDisconnect() {
    disconnectWallet();
  }

  if (connectedWallet) {
    const shortenedAddress = `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-3)}`;
    return (
      <button
        onClick={handleDisconnect}
        className="bg-[#0052FF] hover:bg-blue-600 text-white px-4 py-2 rounded shadow-lg transition-all duration-200"
      >
        {shortenedAddress}
      </button>
    );
  }

  if (isConnecting) {
    return (
      <button
        disabled
        className="bg-gray-500 text-white px-4 py-2 rounded shadow-lg flex items-center justify-center"
      >
        <svg
          className="animate-spin h-5 w-5 mr-2 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Connecting...
      </button>
    );
  }

  if (isAppKitLoading) {
    return (
      <button
        disabled
        className="bg-gray-500 text-white px-4 py-2 rounded shadow-lg flex items-center justify-center"
      >
        <svg
          className="animate-spin h-5 w-5 mr-2 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Loading...
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="bg-[#0052FF] hover:bg-blue-600 text-white px-4 py-2 rounded shadow-lg transition-all duration-200"
    >
      Connect Wallet
    </button>
  );
}