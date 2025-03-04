"use client";

import { useState } from "react";
import { FiSearch, FiShield, FiAlertTriangle, FiInfo } from "react-icons/fi";
import { motion } from "framer-motion";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import Link from "next/link";
import Footer from "../../../components/Footer";

export default function HoneypotPage() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Trigger the scan on button click
  const handleScan = async () => {
    if (!tokenAddress) {
      setError("Please enter a token address.");
      return;
    }
    setLoading(true);
    setError("");
    setScanResult(null);

    try {
      const response = await fetch(`/api/honeypot/scan?address=${tokenAddress}`);
      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        let errorMessage = "";
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          errorMessage =
            typeof data.error === "object" ? JSON.stringify(data.error) : data.error;
        } else {
          errorMessage = await response.text();
        }
        setError(errorMessage || "Failed to analyze the contract.");
        setLoading(false);
        return;
      }

      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        setScanResult(data);
      } else {
        const text = await response.text();
        setError("Unexpected response format: " + text);
      }
    } catch (err) {
      console.error(err);
      setError("Error fetching honeypot data. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      {/* Header remains as before */}
      <header className="w-full bg-[#0052FF] text-white py-4 px-4 shadow-lg">
        <div className="container mx-auto flex flex-col items-center">
          <Link href="/tools" className="text-white underline text-sm mb-2 block">
            Return to Tools
          </Link>
          <h1 className="text-xl md:text-2xl font-bold">Honeypot Checker</h1>
          <p className="text-xs md:text-base">
            Safeguard your token investments by scanning for honeypot traps.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8 md:py-12">
        {/* Section 1: How It Works (centered) */}
        <section className="max-w-3xl mx-auto text-center mb-12">
          <h3 className="text-2xl font-bold mb-4" style={{ color: "#0052FF" }}>
            How It Works
          </h3>
          <p className="mb-4">
            Our Honeypot Checker simulates token transactions to detect honeypot traps.
            It evaluates risk levels, tax rates, and other factors to provide you with a detailed risk analysis.
          </p>
        </section>

        {/* Section 2: Scan a Token (centered) */}
        <section className="max-w-lg mx-auto bg-white p-8 rounded-md shadow-xl mb-12 text-center">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "#0052FF" }}>
            Scan a Token
          </h2>
          <div className="flex items-center justify-center border border-gray-300 rounded-md p-3 mb-4">
            <input
              type="text"
              placeholder="Enter token address..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className="w-full px-3 py-2 border-none focus:outline-none text-center"
            />
            <button
              onClick={handleScan}
              className="ml-2 bg-[#0052FF] text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition"
            >
              <FiSearch size={18} />
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>

          {/* Loader */}
          {loading && (
            <div className="mt-6 p-6 border rounded-md shadow-sm bg-gray-50 animate-pulse">
              <div className="h-6 w-3/4 bg-gray-300 rounded mb-4 mx-auto"></div>
              <div className="h-4 w-1/2 bg-gray-300 rounded mb-2 mx-auto"></div>
              <div className="h-4 w-2/3 bg-gray-300 rounded mb-2 mx-auto"></div>
              <div className="h-4 w-full bg-gray-300 rounded mx-auto"></div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-center mt-4 text-red-600">
              {typeof error === "object" ? JSON.stringify(error) : error}
            </p>
          )}

          {/* Scan Result */}
          {scanResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-6 border rounded-md shadow-sm bg-gray-50"
            >
              <p className="font-semibold break-all mb-4">
                {scanResult.token?.name
                  ? `${scanResult.token.name} (${scanResult.token.symbol})`
                  : scanResult.token}
              </p>
              <div className="my-3">
                {scanResult?.honeypotResult?.isHoneypot ? (
                  <p className="flex items-center justify-center text-xl font-bold text-red-600">
                    <FiAlertTriangle size={24} className="mr-2" />
                    Honeypot Detected
                  </p>
                ) : (
                  <p className="flex items-center justify-center text-xl font-bold text-green-600">
                    <FiShield size={24} className="mr-2" />
                    No Honeypot Detected
                  </p>
                )}
              </div>
              <div className="text-sm text-gray-700 space-y-2">
                {scanResult?.summary && (
                  <>
                    <p>
                      <span className="font-semibold">Risk:</span>{" "}
                      {scanResult.summary.risk}{" "}
                      <span
                        data-tooltip-id="tooltip"
                        data-tooltip-content="Overall risk rating based on simulation results"
                        className="ml-1 inline-block cursor-help"
                      >
                        <FiInfo size={14} className="text-gray-500" />
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold">Risk Level:</span>{" "}
                      {scanResult.summary.riskLevel}
                    </p>
                    {scanResult.summary.flags &&
                      scanResult.summary.flags.length > 0 && (
                        <ul className="list-disc list-inside">
                          {scanResult.summary.flags.map((flag, index) => (
                            <li key={index}>
                              <span className="font-semibold">{flag.flag}</span>:{" "}
                              {flag.description}
                            </li>
                          ))}
                        </ul>
                      )}
                  </>
                )}
                {scanResult?.simulationResult && (
                  <>
                    <p>
                      <span className="font-semibold">Buy Tax:</span>{" "}
                      {scanResult.simulationResult.buyTax}%
                    </p>
                    <p>
                      <span className="font-semibold">Sell Tax:</span>{" "}
                      {scanResult.simulationResult.sellTax}%
                    </p>
                  </>
                )}
                {scanResult?.honeypotResult?.honeypotReason && (
                  <p className="text-sm">
                    <span className="font-semibold">Reason:</span>{" "}
                    {scanResult.honeypotResult.honeypotReason}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </section>

        {/* Section 3: Additional Details (centered) */}
        <section className="max-w-3xl mx-auto text-center">
          <h3 className="text-2xl font-bold mb-4" style={{ color: "#0052FF" }}>
            Additional Details
          </h3>
          <ul className="list-disc list-inside mb-4">
            <li>
              <strong>Risk Analysis:</strong> Evaluates overall risk based on simulation data.
            </li>
            <li>
              <strong>Transaction Simulation:</strong> Checks if transactions trigger honeypot behavior.
            </li>
            <li>
              <strong>Detailed Reporting:</strong> Displays tax rates, risk levels, and potential red flags.
            </li>
          </ul>
          <p>
            Use this tool as part of your due diligence. Always conduct further research and cross-reference with other sources before making any investment decisions.
          </p>
        </section>
      </main>

      {/* React Tooltip */}
      <Tooltip id="tooltip" place="top" effect="solid" />

      {/* Footer remains as is */}
      <Footer />
    </div>
  );
}
















