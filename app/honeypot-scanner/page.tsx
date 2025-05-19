'use client';

import { useState, useEffect } from 'react';
import {
  FiSearch,
  FiShield,
  FiAlertTriangle,
  FiInfo,
  FiCopy,
  FiTrash2,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Footer from '../components/Footer';
import Header from '../components/Header';

// Dynamically import Tooltip
const Tooltip = dynamic(() => import('react-tooltip').then((mod) => mod.Tooltip), {
  ssr: false,
});

// Define TypeScript interface for audit result
interface AuditResult {
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

// Scan Input Component
const ScanInput = ({
  contractAddress,
  setContractAddress,
  handleAudit,
  loading,
  isValidAddress,
}: {
  contractAddress: string;
  setContractAddress: (value: string) => void;
  handleAudit: () => void;
  loading: boolean;
  isValidAddress: boolean;
}) => (
  <div className="flex items-center gap-3 p-4 bg-[#2A3555] rounded-lg">
    <div className="relative flex-grow">
      <input
        type="text"
        placeholder="Enter contract address (0x...)"
        value={contractAddress}
        onChange={(e) => setContractAddress(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && isValidAddress && !loading) {
            handleAudit();
          }
        }}
        className={`w-full px-4 py-3 bg-transparent text-gray-200 border border-blue-500/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-base ${
          contractAddress && !isValidAddress ? 'border-red-500' : ''
        }`}
        aria-label="Smart contract address input"
      />
      {contractAddress && (
        <button
          onClick={() => setContractAddress('')}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-400"
          aria-label="Clear contract address"
        >
          ✕
        </button>
      )}
    </div>
    <button
      onClick={handleAudit}
      disabled={loading || !isValidAddress}
      className={`px-4 py-3 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-500/80 transition text-base disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label={loading ? 'Auditing contract, please wait' : 'Audit contract address'}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin h-5 w-5 text-white"
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
          Auditing
        </>
      ) : (
        <>
          <FiSearch size={18} />
          Audit
        </>
      )}
    </button>
  </div>
);

// Main Page Component
export default function SmartContractAuditPage() {
  const [contractAddress, setContractAddress] = useState('');
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | { message: string } | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditResult[]>([]);

  // Load audit history from local storage
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('auditHistory') || '[]');
    setAuditHistory(history);
  }, []);

  // Validate Ethereum address
  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Trigger the audit
  const handleAudit = async () => {
    if (!contractAddress || !isValidAddress(contractAddress)) {
      setError('Please enter a valid Ethereum address.');
      return;
    }
    console.log('Scanning address:', contractAddress);
    setLoading(true);
    setError(null);
    setAuditResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`/api/honeypot/scan?address=${contractAddress}`, {
        signal: controller.signal,
      });
      console.log('API response status:', response.status);
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');

      if (!response.ok) {
        let errorMessage = '';
        if (contentType && contentType.indexOf('application/json') !== -1) {
          const data = await response.json();
          console.log('API error data:', data);
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
        console.log('API response data:', data);
        setAuditResult(data);
        const newHistory = [data, ...auditHistory].slice(0, 5);
        setAuditHistory(newHistory);
        localStorage.setItem('auditHistory', JSON.stringify(newHistory));
      } else {
        setError('Unexpected response format.');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Fetch error:', err);
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err?.message || 'Error fetching audit data.');
      }
    }
    setLoading(false);
  };

  // Clear recent audits
  const handleClearAudits = () => {
    setAuditHistory([]);
    localStorage.setItem('auditHistory', JSON.stringify([]));
  };

  // Copy audit results
  const handleCopyResults = () => {
    if (!auditResult) return;
    const resultText = `
      Contract: ${auditResult.token?.name || 'Unknown'} (${auditResult.token?.symbol || 'N/A'})
      Status: ${auditResult.honeypotResult?.isHoneypot ? 'Vulnerabilities Detected' : 'No Vulnerabilities Detected'}
      Risk: ${auditResult.summary?.risk || 'N/A'}
      Risk Level: ${auditResult.summary?.riskLevel || 'N/A'}
      Buy Tax: ${auditResult.simulationResult?.buyTax !== undefined ? `${auditResult.simulationResult.buyTax}%` : 'N/A'}
      Sell Tax: ${auditResult.simulationResult?.sellTax !== undefined ? `${auditResult.simulationResult.sellTax}%` : 'N/A'}
      Reason: ${auditResult.honeypotResult?.honeypotReason || 'N/A'}
    `.trim();
    navigator.clipboard.writeText(resultText);
    alert('Audit results copied to clipboard!');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-200 font-sans">
      <Header />
      <div className="border-t border-blue-500/30"></div> {/* Full-width separator */}

      <main className="flex-grow container mx-auto px-4 py-8 space-y-12">
        {/* Audit Section */}
        <section id="audit" className="max-w-lg mx-auto">
          <h2 className="text-2xl font-semibold text-center text-white mb-6 uppercase">
            Audit a Contract
          </h2>
          <div className="w-24 mx-auto border-t border-blue-500/30 mb-6"></div>
          <ScanInput
            contractAddress={contractAddress}
            setContractAddress={setContractAddress}
            handleAudit={handleAudit}
            loading={loading}
            isValidAddress={isValidAddress(contractAddress)}
          />

          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-6 p-4 bg-[#2A3555] rounded-lg text-center"
              >
                <p className="text-base">Scanning contract...</p>
              </motion.div>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-6 text-center text-red-400 text-base bg-red-500/20 py-3 rounded-lg"
              >
                {typeof error === 'string' ? error : error?.message || 'An error occurred'}
              </motion.p>
            )}

            {auditResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 p-4 bg-[#2A3555] rounded-lg"
              >
                <div className="flex justify-between items-center mb-3">
                  <p className="text-base font-semibold break-all text-white">
                    {auditResult.token?.name
                      ? `${auditResult.token.name} (${auditResult.token?.symbol || 'N/A'})`
                      : 'Unknown Contract'}
                  </p>
                  <button
                    onClick={handleCopyResults}
                    className="text-blue-400 hover:text-blue-300 transition flex items-center gap-1 text-base"
                    aria-label="Copy audit results"
                  >
                    <FiCopy size={18} />
                    Copy
                  </button>
                </div>
                <div className="text-center mb-3">
                  {auditResult.honeypotResult?.isHoneypot ? (
                    <p className="flex items-center justify-center text-lg font-semibold text-red-400">
                      <FiAlertTriangle className="w-6 h-6 mr-2" />
                      Vulnerabilities Detected
                    </p>
                  ) : (
                    <p className="flex items-center justify-center text-lg font-semibold text-blue-400">
                      <FiShield className="w-6 h-6 mr-2" />
                      No Vulnerabilities Detected
                    </p>
                  )}
                </div>
                <div className="text-base text-gray-200 space-y-3">
                  {auditResult?.summary && (
                    <>
                      <div className="flex items-center">
                        <span className="font-semibold w-24">Risk:</span>
                        <span className="flex-1 flex items-center">
                          {auditResult.summary.risk || 'N/A'}
                          <span
                            data-tooltip-id="tooltip-risk"
                            data-tooltip-content="Overall risk rating"
                            className="ml-2 inline-block cursor-help"
                          >
                            <FiInfo className="w-4 h-4 text-blue-400" aria-hidden="true" />
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-semibold w-24">Risk Level:</span>
                        <span className="flex-1">{auditResult.summary.riskLevel || 'N/A'}</span>
                      </div>
                      {auditResult.summary.flags && auditResult.summary.flags.length > 0 && (
                        <div>
                          <span className="font-semibold">Flags:</span>
                          <ul className="list-disc list-inside ml-2 text-sm">
                            {auditResult.summary.flags.map((flag, index) => (
                              <li key={index}>
                                {flag.flag || 'Unknown'}: {flag.description || 'N/A'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  {auditResult?.simulationResult && (
                    <>
                      <div className="flex items-center">
                        <span className="font-semibold w-24">Buy Tax:</span>
                        <span className="flex-1">
                          {auditResult.simulationResult.buyTax !== undefined
                            ? `${auditResult.simulationResult.buyTax}%`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-semibold w-24">Sell Tax:</span>
                        <span className="flex-1">
                          {auditResult.simulationResult.sellTax !== undefined
                            ? `${auditResult.simulationResult.sellTax}%`
                            : 'N/A'}
                        </span>
                      </div>
                    </>
                  )}
                  {auditResult?.honeypotResult?.honeypotReason && (
                    <div>
                      <span className="font-semibold">Reason:</span>{' '}
                      <span className="text-sm">{auditResult.honeypotResult.honeypotReason}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Recent Audits */}
        <section className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white uppercase">Recent Audits</h3>
            {auditHistory.length > 0 && (
              <button
                onClick={handleClearAudits}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 transition text-base"
                aria-label="Clear recent audits"
              >
                <FiTrash2 size={18} />
                Clear
              </button>
            )}
          </div>
          {auditHistory.length > 0 ? (
            <ul className="space-y-2">
              {auditHistory.map((result, index) => (
                <li
                  key={index}
                  className="p-3 bg-[#2A3555] rounded-lg cursor-pointer hover:bg-[#2A3555]/80 transition"
                  onClick={() => setAuditResult(result)}
                >
                  <p className="text-base font-semibold text-white">
                    {result.token?.name || 'Unknown Contract'} ({result.token?.symbol || 'N/A'})
                  </p>
                  <p className="text-sm">
                    {result.honeypotResult?.isHoneypot ? (
                      <span className="text-red-400">Vulnerable</span>
                    ) : (
                      <span className="text-blue-400">Safe</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-base text-center">No recent audits.</p>
          )}
        </section>

        {/* Why Choose Us */}
        <section className="max-w-lg mx-auto">
          <h3 className="text-xl font-semibold text-center text-white mb-4 uppercase">
            Why Audit with Us?
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: 'Comprehensive',
                description: 'Analyzes risks and taxes.',
                icon: <FiInfo className="w-6 h-6 text-blue-400" />,
              },
              {
                title: 'Simulation',
                description: 'Tests for vulnerabilities.',
                icon: <FiSearch className="w-6 h-6 text-blue-400" />,
              },
              {
                title: 'Reports',
                description: 'Clear risk insights.',
                icon: <FiShield className="w-6 h-6 text-blue-400" />,
              },
            ].map((feature, index) => (
              <div key={index} className="p-4 bg-[#2A3555] rounded-lg text-center">
                <div className="flex justify-center mb-2">{feature.icon}</div>
                <h4 className="text-base font-semibold text-white">{feature.title}</h4>
                <p className="text-sm text-gray-400 mt-1">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Tooltip id="tooltip" place="top" />
      <Tooltip id="tooltip-risk" place="top" />
      <Tooltip id="tooltip-whale-watchers" place="bottom" offset={8} />
      <Tooltip id="tooltip-token-screener" place="bottom" offset={8} />
      <Tooltip id="tooltip-honeypot-scanner" place="bottom" offset={8} />
      <Tooltip id="tooltip-community-calendar" place="bottom" offset={8} />
      <Tooltip id="tooltip-cypherscan" place="bottom" offset={8} />
      <Tooltip id="tooltip-tournaments" place="bottom" offset={8} />
      <Tooltip id="tooltip-account" place="bottom" offset={8} />

      <Footer />
    </div>
  );
}