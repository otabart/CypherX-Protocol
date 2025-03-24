"use client";

import { useState } from "react";
import {
  FiSearch,
  FiShield,
  FiAlertTriangle,
  FiInfo,
  FiArrowRight,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import Footer from "../components/Footer";

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
            typeof data.error === "object" && data.error !== null
              ? data.error.message || JSON.stringify(data.error)
              : data.error;
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
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Error fetching honeypot data. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white font-mono">
      {/* Banner */}
      <div className="bg-[#0052FF] text-white py-4 text-center">
        <h1 className="text-3xl font-bold">Honeypot Scanner</h1>
        <p className="text-sm">Analyze token contracts for potential honeypot traps</p>
      </div>

      <main className="flex-grow container mx-auto px-4 py-8 md:py-12 space-y-12">
        {/* Callout: How It Works */}
        <section>
          <div className="flex items-start gap-3 bg-black border border-[#0052FF] p-4 rounded-md shadow">
            <FiInfo className="w-10 h-10 mt-1 text-[#0052FF]" />
            <div className="leading-relaxed">
              <h3 className="text-lg font-bold mb-1">How It Works</h3>
              <p>
                Our Honeypot Checker simulates token transactions to detect honeypot traps.
                It evaluates risk levels, tax rates, and other factors to provide you with a
                detailed risk analysis.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Scan a Token */}
        <section className="max-w-lg mx-auto bg-black border border-[#0052FF] p-8 rounded-md shadow-xl text-center">
          <h2 className="text-3xl font-bold mb-6 text-[#0052FF]">Scan a Token</h2>
          <div className="flex items-center justify-center border border-[#0052FF] rounded-md p-3 mb-4">
            <input
              type="text"
              placeholder="Enter token address..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className="w-full px-3 py-2 bg-black text-white border-none focus:outline-none text-center"
            />
            <button
              onClick={handleScan}
              className="ml-2 bg-[#0052FF] text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition"
            >
              <FiSearch size={18} />
              <span className="hidden sm:inline">Scan</span>
            </button>
          </div>

          {loading && (
            <div className="mt-6 p-6 border border-[#0052FF] rounded-md shadow-sm bg-black animate-pulse">
              <div className="h-6 w-3/4 bg-[#0052FF] rounded mb-4 mx-auto"></div>
              <div className="h-4 w-1/2 bg-[#0052FF] rounded mb-2 mx-auto"></div>
              <div className="h-4 w-2/3 bg-[#0052FF] rounded mb-2 mx-auto"></div>
              <div className="h-4 w-full bg-[#0052FF] rounded mx-auto"></div>
            </div>
          )}

          {error && (
            <p className="text-center mt-4 text-red-500">
              {typeof error === "object" && error !== null ? error.message : error}
            </p>
          )}

          {scanResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mt-6 p-6 border border-[#0052FF] rounded-md shadow-sm bg-black"
            >
              <p className="font-semibold break-all mb-4">
                {scanResult.token?.name
                  ? `${scanResult.token.name} (${scanResult.token.symbol})`
                  : scanResult.token}
              </p>
              <div className="my-3">
                {scanResult?.honeypotResult?.isHoneypot ? (
                  <p className="flex items-center justify-center text-xl font-bold text-red-500">
                    <FiAlertTriangle className="w-10 h-10 mr-2" />
                    Honeypot Detected
                  </p>
                ) : (
                  <p className="flex items-center justify-center text-xl font-bold text-[#0052FF]">
                    <FiShield className="w-10 h-10 mr-2" />
                    No Honeypot Detected
                  </p>
                )}
              </div>
              <div className="text-sm text-white space-y-2">
                {scanResult?.summary && (
                  <>
                    <p>
                      <span className="font-semibold">Risk:</span> {scanResult.summary.risk}{" "}
                      <span
                        data-tooltip-id="tooltip"
                        data-tooltip-content="Overall risk rating based on simulation results"
                        className="ml-1 inline-block cursor-help"
                      >
                        <FiInfo className="w-6 h-6 md:w-8 md:h-8 inline text-[#0052FF]" />
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold">Risk Level:</span> {scanResult.summary.riskLevel}
                    </p>
                    {scanResult.summary.flags &&
                      scanResult.summary.flags.length > 0 && (
                        <ul className="list-disc list-inside text-left max-w-sm mx-auto">
                          {scanResult.summary.flags.map((flag, index) => (
                            <li key={index}>
                              <span className="font-semibold">{flag.flag}</span>: {flag.description}
                            </li>
                          ))}
                        </ul>
                      )}
                  </>
                )}
                {scanResult?.simulationResult && (
                  <>
                    <p>
                      <span className="font-semibold">Buy Tax:</span> {scanResult.simulationResult.buyTax}%
                    </p>
                    <p>
                      <span className="font-semibold">Sell Tax:</span> {scanResult.simulationResult.sellTax}%
                    </p>
                  </>
                )}
                {scanResult?.honeypotResult?.honeypotReason && (
                  <p className="text-sm">
                    <span className="font-semibold">Reason:</span> {scanResult.honeypotResult.honeypotReason}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </section>

        {/* Additional Details with Arrow Icons */}
        <section className="max-w-3xl mx-auto text-center">
          <h3 className="text-2xl font-bold mb-4 text-[#0052FF]">Additional Details</h3>
          <div className="flex flex-col gap-3 items-start max-w-md mx-auto text-left">
            <div className="flex items-start gap-2">
              <FiArrowRight className="w-8 h-8 text-[#0052FF] mt-1" />
              <span>
                <strong>Risk Analysis:</strong> Evaluates overall risk based on simulation data.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <FiArrowRight className="w-8 h-8 text-[#0052FF] mt-1" />
              <span>
                <strong>Transaction Simulation:</strong> Checks if transactions trigger honeypot behavior.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <FiArrowRight className="w-8 h-8 text-[#0052FF] mt-1" />
              <span>
                <strong>Detailed Reporting:</strong> Displays tax rates, risk levels, and potential red flags.
              </span>
            </div>
          </div>
          <p className="leading-relaxed mt-4">
            Use this tool as part of your due diligence. Always conduct further research and cross-reference with other sources before making any investment decisions.
          </p>
        </section>
      </main>

      <Tooltip id="tooltip" place="top" effect="solid" />

      <Footer />
    </div>
  );
}









