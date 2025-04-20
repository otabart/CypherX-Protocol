'use client';

import { useState, useEffect } from 'react';
import {
  FiSearch,
  FiShield,
  FiAlertTriangle,
  FiInfo,
  FiArrowRight,
  FiTrash2,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Footer from '../components/Footer';

// Dynamically import Tooltip to reduce bundle size
const Tooltip = dynamic(() => import('react-tooltip').then((mod) => mod.Tooltip), {
  ssr: false,
});

// Define TypeScript interface for scan result
interface ScanResult {
  token?: {
    name?: string;
    symbol?: string;
  };
  honeypotResult?: {
    isHoneypot?: boolean;
    honeypotReason?: string;
  };
  summary?: {
    risk?: string;
    riskLevel?: string;
    flags?: { flag: string; description: string }[];
  };
  simulationResult?: {
    buyTax?: number;
    sellTax?: number;
  };
}

const ScanInput = ({
  tokenAddress,
  setTokenAddress,
  handleScan,
  loading,
}: {
  tokenAddress: string;
  setTokenAddress: (value: string) => void;
  handleScan: () => void;
  loading: boolean;
}) => (
  <div className="flex items-center justify-center border border-[#0052FF] rounded-md p-2 sm:p-3">
    <div className="relative flex-grow">
      <input
        type="text"
        placeholder="Enter token address..."
        value={tokenAddress}
        onChange={(e) => setTokenAddress(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleScan();
          }
        }}
        className="w-full px-3 py-2 bg-black text-white border-none focus:outline-none focus:ring-2 focus:ring-[#0052FF] text-center text-sm sm:text-base pr-8"
        aria-label="Token address input"
      />
      {tokenAddress && (
        <button
          onClick={() => setTokenAddress('')}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          aria-label="Clear token address"
        >
          ✕
        </button>
      )}
    </div>
    <button
      onClick={handleScan}
      disabled={loading}
      className={`ml-2 bg-[#0052FF] text-white px-3 sm:px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition text-sm sm:text-base ${
        loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      aria-label={loading ? 'Scanning token, please wait' : 'Scan token address'}
    >
      {loading ? (
        <svg
          className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white"
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
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : (
        <>
          <FiSearch size={16} className="sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Scan</span>
        </>
      )}
    </button>
  </div>
);

export default function HoneypotPage() {
  const [tokenAddress, setTokenAddress] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);

  // Load scan history from local storage
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
    setScanHistory(history);
  }, []);

  // Validate Ethereum address
  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Trigger the scan on button click
  const handleScan = async () => {
    if (!tokenAddress) {
      setError('Please enter a token address.');
      return;
    }
    if (!isValidAddress(tokenAddress)) {
      setError('Please enter a valid Ethereum address (e.g., 0x...).');
      return;
    }
    setLoading(true);
    setError('');
    setScanResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    try {
      const response = await fetch(`/api/honeypot/scan?address=${tokenAddress}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');

      if (!response.ok) {
        let errorMessage = '';
        if (contentType && contentType.indexOf('application/json') !== -1) {
          const data = await response.json();
          errorMessage =
            typeof data.error === 'object' && data.error !== null
              ? data.error.message || JSON.stringify(data.error)
              : data.error;
        } else {
          errorMessage = await response.text();
        }
        setError(errorMessage || 'Failed to analyze the contract.');
        setLoading(false);
        return;
      }

      if (contentType && contentType.indexOf('application/json') !== -1) {
        const data = await response.json();
        setScanResult(data);
        // Add to scan history
        const newHistory = [data, ...scanHistory].slice(0, 5); // Keep last 5 scans
        setScanHistory(newHistory);
        localStorage.setItem('scanHistory', JSON.stringify(newHistory));
      } else {
        const text = await response.text();
        setError('Unexpected response format: ' + text);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        console.error(err);
        setError(err?.message || 'Error fetching honeypot data. Please try again.');
      }
    }
    setLoading(false);
  };

  // Clear recent scans
  const handleClearScans = () => {
    setScanHistory([]);
    localStorage.setItem('scanHistory', JSON.stringify([]));
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white font-mono">
      {/* Banner */}
      <div className="bg-[#0052FF] text-white py-4 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold">Honeypot Scanner</h1>
        <p className="text-xs sm:text-sm mt-1">
          Analyze token contracts for potential honeypot traps
        </p>
      </div>

      <main className="flex-grow container mx-auto px-4 py-6 sm:py-8 md:py-12 space-y-8 sm:space-y-12">
        {/* Callout: How It Works */}
        <section>
          <div className="flex items-start gap-2 sm:gap-3 bg-black border border-[#0052FF] p-3 sm:p-4 rounded-md shadow">
            <FiInfo
              className="w-5 h-5 sm:w-6 sm:h-6 mt-0.5 text-[#0052FF] flex-shrink-0"
              aria-hidden="true"
            />
            <div className="leading-relaxed text-sm sm:text-base">
              <h3 className="text-base sm:text-lg font-bold mb-1">How It Works</h3>
              <p>
                Our Honeypot Checker simulates token transactions to detect
                honeypot traps. It evaluates risk levels, tax rates, and other
                factors to provide you with a detailed risk analysis.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Scan a Token */}
        <section className="max-w-lg mx-auto bg-black border border-[#0052FF] p-4 sm:p-8 rounded-md shadow-xl text-center space-y-4 sm:space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-[#0052FF]">
            Scan a Token
          </h2>
          <ScanInput
            tokenAddress={tokenAddress}
            setTokenAddress={setTokenAddress}
            handleScan={handleScan}
            loading={loading}
          />

          {loading && (
            <div className="mt-4 sm:mt-6 p-4 sm:p-6 border border-[#0052FF] rounded-md shadow-sm bg-black animate-pulse">
              <div className="h-5 sm:h-6 w-3/4 bg-[#0052FF] rounded mb-4 mx-auto"></div>
              <div className="h-4 w-1/2 bg-[#0052FF] rounded mb-2 mx-auto"></div>
              <div className="h-4 w-2/3 bg-[#0052FF] rounded mb-2 mx-auto"></div>
              <div className="h-4 w-full bg-[#0052FF] rounded mx-auto"></div>
            </div>
          )}

          {error && (
            <p className="text-center mt-3 sm:mt-4 text-red-500 text-sm sm:text-base bg-gray-900/50 py-2 rounded-md">
              {typeof error === 'object' && error !== null ? error.message : error}
            </p>
          )}

          {scanResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mt-4 sm:mt-6 p-4 sm:p-6 border border-[#0052FF] rounded-md shadow-sm bg-black"
            >
              <p className="font-semibold break-all mb-4 text-sm sm:text-base">
                {scanResult.token?.name
                  ? `${scanResult.token.name} (${scanResult.token?.symbol || 'N/A'})`
                  : 'Unknown Token'}
              </p>
              <div className="my-3">
                {scanResult?.honeypotResult?.isHoneypot ? (
                  <p className="flex items-center justify-center text-lg sm:text-xl font-bold text-red-500">
                    <FiAlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 mr-2" />
                    Honeypot Detected
                  </p>
                ) : (
                  <p className="flex items-center justify-center text-lg sm:text-xl font-bold text-[#0052FF]">
                    <FiShield className="w-8 h-8 sm:w-10 sm:h-10 mr-2" />
                    No Honeypot Detected
                  </p>
                )}
              </div>
              <div className="text-sm sm:text-base text-white space-y-2">
                {scanResult?.summary && (
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="font-semibold w-20 sm:w-24">Risk:</span>
                      <span className="flex-1 flex items-center">
                        {scanResult.summary.risk || 'N/A'}
                        <span
                          data-tooltip-id="tooltip"
                          data-tooltip-content="Overall risk rating based on simulation results"
                          className="ml-2 inline-block cursor-help"
                        >
                          <FiInfo
                            className="w-4 h-4 sm:w-5 sm:h-5 text-[#0052FF]"
                            aria-hidden="true"
                          />
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-semibold w-20 sm:w-24">Risk Level:</span>
                      <span className="flex-1">{scanResult.summary.riskLevel || 'N/A'}</span>
                    </div>
                    {scanResult.summary.flags && scanResult.summary.flags.length > 0 && (
                      <ul className="list-disc list-inside text-left max-w-sm mx-auto">
                        {scanResult.summary.flags.map((flag, index) => (
                          <li key={index} className="text-sm sm:text-base">
                            <span className="font-semibold">{flag.flag || 'Unknown Flag'}</span>:{' '}
                            {flag.description || 'No description available'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {scanResult?.simulationResult && (
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="font-semibold w-20 sm:w-24">Buy Tax:</span>
                      <span className="flex-1">
                        {scanResult.simulationResult.buyTax !== undefined
                          ? `${scanResult.simulationResult.buyTax}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-semibold w-20 sm:w-24">Sell Tax:</span>
                      <span className="flex-1">
                        {scanResult.simulationResult.sellTax !== undefined
                          ? `${scanResult.simulationResult.sellTax}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                )}
                {scanResult?.honeypotResult?.honeypotReason && (
                  <p className="text-sm sm:text-base">
                    <span className="font-semibold">Reason:</span>{' '}
                    {scanResult.honeypotResult.honeypotReason}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Recent Scans */}
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl sm:text-2xl font-bold text-[#0052FF]">
                Recent Scans
              </h3>
              {scanHistory.length > 0 && (
                <button
                  onClick={handleClearScans}
                  className="flex items-center gap-1 text-red-500 hover:text-red-400 text-sm sm:text-base transition"
                  aria-label="Clear recent scans"
                >
                  <FiTrash2 size={16} className="sm:w-5 sm:h-5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
            {scanHistory.length > 0 ? (
              <ul className="space-y-2">
                {scanHistory.map((result, index) => (
                  <li
                    key={index}
                    className="p-2 sm:p-3 bg-gray-900 rounded-md cursor-pointer hover:bg-gray-800 text-sm sm:text-base"
                    onClick={() => setScanResult(result)}
                  >
                    {result.token?.name || 'Unknown Token'} (
                    {result.token?.symbol || 'N/A'})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm sm:text-base">No recent scans.</p>
            )}
          </div>
        </section>

        {/* Additional Details with Arrow Icons */}
        <section className="max-w-3xl mx-auto text-center">
          <h3 className="text-xl sm:text-2xl font-bold mb-4 text-[#0052FF]">
            Additional Details
          </h3>
          <div className="flex flex-col gap-3 items-start max-w-md mx-auto text-left">
            <div className="flex items-start gap-2 hover:bg-gray-900 p-2 rounded-md transition">
              <FiArrowRight
                className="w-5 h-5 sm:w-6 sm:h-6 text-[#0052FF] mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-sm sm:text-base">
                <strong>Risk Analysis:</strong> Evaluates overall risk based on
                simulation data.
              </span>
            </div>
            <div className="flex items-start gap-2 hover:bg-gray-900 p-2 rounded-md transition">
              <FiArrowRight
                className="w-5 h-5 sm:w-6 sm:h-6 text-[#0052FF] mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-sm sm:text-base">
                <strong>Transaction Simulation:</strong> Checks if transactions
                trigger honeypot behavior.
              </span>
            </div>
            <div className="flex items-start gap-2 hover:bg-gray-900 p-2 rounded-md transition">
              <FiArrowRight
                className="w-5 h-5 sm:w-6 sm:h-6 text-[#0052FF] mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-sm sm:text-base">
                <strong>Detailed Reporting:</strong> Displays tax rates, risk
                levels, and potential red flags.
              </span>
            </div>
          </div>
          <p className="leading-relaxed mt-4 text-sm sm:text-base">
            Use this tool as part of your due diligence. Always conduct further
            research and cross-reference with other sources before making any
            investment decisions.
          </p>
        </section>
      </main>

      <Tooltip id="tooltip" place="top" effect="solid" />

      <Footer />
    </div>
  );
}