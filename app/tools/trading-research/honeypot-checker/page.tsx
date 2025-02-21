"use client";

import { useState } from "react";
import { FiSearch, FiShield, FiAlertTriangle } from "react-icons/fi";

export default function HoneypotChecker() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle the "Scan" button click
  const handleScan = async () => {
    if (!tokenAddress) {
      setError("Please enter a token address.");
      return;
    }
    setLoading(true);
    setError("");
    setScanResult(null);

    try {
      // Call our local /api/honeypot/scan endpoint
      // which in turn calls the external Honeypot API
      const response = await fetch(`/api/honeypot/scan?address=${tokenAddress}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to analyze the contract.");
        setLoading(false);
        return;
      }

      setScanResult(data);
    } catch (err) {
      setError("Error fetching honeypot data. Please try again.");
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Header */}
      <header className="bg-blue-600 text-white py-6 text-center shadow-md">
        <h1 className="text-3xl font-extrabold">Honeypot Checker</h1>
        <p className="text-sm mt-1">Scan a token contract for malicious features</p>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        {/* Input + Button */}
        <div className="max-w-lg mx-auto bg-gray-100 p-6 rounded-md shadow-md">
          <h2 className="text-2xl font-bold text-center mb-4 text-blue-600">Scan a Token</h2>
          <div className="flex items-center border border-gray-300 rounded-md p-3 bg-white">
            <input
              type="text"
              placeholder="Enter token address..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className="w-full px-3 py-2 border-none focus:outline-none"
            />
            <button
              onClick={handleScan}
              className="ml-2 bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition"
            >
              <FiSearch size={18} />
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>

          {/* Loading, Error, and Result */}
          {loading && (
            <p className="text-center mt-4 text-gray-600">Scanning contract...</p>
          )}
          {error && (
            <p className="text-center mt-4 text-red-600">{error}</p>
          )}
          {scanResult && (
            <div className="mt-6 p-4 border rounded-md shadow-sm bg-gray-50">
              <p className="font-semibold break-all">{scanResult.token}</p>
              <div className="my-3">
                {scanResult?.honeypotResult?.isHoneypot ? (
                  <p className="flex items-center text-xl font-bold text-red-600">
                    <FiAlertTriangle size={24} className="mr-2" />
                    Honeypot Detected
                  </p>
                ) : (
                  <p className="flex items-center text-xl font-bold text-green-600">
                    <FiShield size={24} className="mr-2" />
                    No Honeypot Detected
                  </p>
                )}
              </div>
              <div className="text-sm text-gray-700 space-y-1">
                <p>
                  <span className="font-semibold">Buy Tax:</span>{" "}
                  {scanResult?.honeypotResult?.buyTax ?? 0}%
                </p>
                <p>
                  <span className="font-semibold">Sell Tax:</span>{" "}
                  {scanResult?.honeypotResult?.sellTax ?? 0}%
                </p>
                <p>
                  <span className="font-semibold">Liquidity:</span>{" "}
                  {scanResult?.honeypotResult?.liquidity || "Unknown"}
                </p>
                <p>
                  <span className="font-semibold">Blacklist Risk:</span>{" "}
                  {scanResult?.honeypotResult?.isBlacklisted ? (
                    <span className="text-red-600">High Risk</span>
                  ) : (
                    <span className="text-green-600">No Risk</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}



