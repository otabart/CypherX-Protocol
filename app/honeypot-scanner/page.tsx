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
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/app/providers';

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

// Header Component
const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await signOut(auth);
    router.push('/login');
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-gray-950 border-b border-gray-800 shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center">
            <div className="coinContainer">
              <div className="coinInner">
                <Image
                  src="https://i.imgur.com/Tc53TQO.png"
                  alt="Homebase Logo"
                  width={40}
                  height={40}
                  className="coinFace"
                />
              </div>
            </div>
            <span className="ml-2 text-xs font-bold text-[#0052FF] bg-[#0052FF]/10 border border-[#0052FF] rounded-full px-3 py-0.5 flex items-center">
              v1 BETA
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <IconLink
              href="/whale-watcher"
              label="Whale Watchers"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 15c2-2 5-3 7-3s5 1 7 3c1 1 2 3 2 5s-1 3-3 3H7c-2 0-3-1-3-3s1-3 1-5zm9-3v-3m3 6v3"
                />
              }
            />
            <IconLink
              href="/token-scanner"
              label="Token Screener"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z"
                />
              }
              extraPath={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              }
            />
            <IconLink
              href="/honeypot-scanner"
              label="Honeypot Scanner"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.15z"
                />
              }
            />
            <IconLink
              href="/calendar"
              label="Community Calendar"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              }
            />
            <IconLink
              href="/explorer/latest/block"
              label="Cypherscan"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h7"
                />
              }
            />
            <IconLink
              href="/TradingCompetition"
              label="Tournaments"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 21h8M12 17v4M6 3h12l1 5a5 5 0 01-4 5v1a4 4 0 01-4 4 4 4 0 01-4-4v-1a5 5 0 01-4-5l1-5z"
                />
              }
            />
            {!loading && (
              <div className="relative group">
                <Link href={user ? '/account' : '/login'} className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 12c2.28 0 4-1.72 4-4s-1.72-4-4-4-4 1.72-4 4 1.72 4 4 4z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18v-.42A2.58 2.58 0 018.58 15h6.84A2.58 2.58 0 0118 17.58V18"
                      />
                    </svg>
                  </div>
                  <span className="sr-only">{user ? 'Account' : 'Sign in'}</span>
                </Link>
                <span
                  data-tooltip-id={`tooltip-account`}
                  data-tooltip-content={user ? 'Account' : 'Sign in'}
                  className="cursor-help"
                >
                  <span className="sr-only">{user ? 'Account' : 'Sign in'}</span>
                </span>
              </div>
            )}
          </nav>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-white"
            aria-label="Toggle Menu"
          >
            {isMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeWidth={2} />
                <line x1="6" y1="18" x2="18" y2="6" strokeLinecap="round" strokeWidth={2} />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <line x1="4" y1="8" x2="20" y2="8" strokeLinecap="round" strokeWidth={2} />
                <line x1="4" y1="14" x2="16" y2="14" strokeLinecap="round" strokeWidth={2} />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div
        className={`md:hidden fixed inset-0 z-40 bg-gray-950 transition-transform duration-300 overscroll-none ${
          isMenuOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ overscrollBehavior: 'none' }}
      >
        <nav className="pt-16 pb-10 px-6 h-full overflow-y-auto flex flex-col">
          <div className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 4h-1a2 2 0 00-2 2v1m0 0H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2M8 7V5a2 2 0 012-2h1m0 0h1a2 2 0 012 2v2m-4 0h4m-5 4l-2-2m0 0l2-2m-2 2h6"
                />
              </svg>
              <span className="font-semibold text-white">Toolbase</span>
            </div>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/token-scanner"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-white hover:text-[#0052FF] transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>Token Screener</span>
                </Link>
              </li>
              <li className="border-t border-gray-800 mx-[-1.5rem]"></li>
              <li>
                <Link
                  href="/whale-watcher"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-white hover:text-[#0052FF] transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 15c2-2 5-3 7-3s5 1 7 3c1 1 2 3 2 5s-1 3-3 3H7c-2 0-3-1-3-3s1-3 1-5zm9-3v-3m3 6v3"
                    />
                  </svg>
                  <span>Whale Watchers</span>
                </Link>
              </li>
              <li className="border-t border-gray-800 mx-[-1.5rem]"></li>
              <li>
                <Link
                  href="/launch-calendar"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-white hover:text-[#0052FF] transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Launch Calendar</span>
                </Link>
              </li>
              <li className="border-t border-gray-800 mx-[-1.5rem]"></li>
              <li>
                <Link
                  href="/terminal"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-white hover:text-[#0052FF] transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-3-3v6m-9 3h18a2 2 0 002-2V6a2 2 0 00-2-2H3a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>News Terminal</span>
                </Link>
              </li>
              <li className="border-t border-gray-800 mx-[-1.5rem]"></li>
              <li>
                <Link
                  href="/honeypot-scanner"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-white hover:text-[#0052FF] transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.15z"
                    />
                  </svg>
                  <span>Honeypot Scanner</span>
                </Link>
              </li>
              <li className="border-t border-gray-800 mx-[-1.5rem]"></li>
              <li>
                <Link
                  href="/latest/block"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-white hover:text-[#0052FF] transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h7"
                    />
                  </svg>
                  <span>Homescan</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className="border-t border-gray-800 my-4 mx-[-1.5rem]"></div>

          <div className="py-4">
            <ul className="space-y-3">
              <li>
                <Link
                  href="/TradingCompetition"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-white hover:text-[#0052FF] transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 21h8M12 17v4M6 3h12l1 5a5 5 0 01-4 5v1a4 4 0 01-4 4 4 4 0 01-4-4v-1a5 5 0 01-4-5l1-5z"
                    />
                  </svg>
                  <span>Tournaments</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/docs"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-white hover:text-[#0052FF] transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 2h6l5 5v12a2 2 0 01-2 2H7a2 2 0 01-2 2V4a2 2 0 012-2z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 2v6h6"
                    />
                  </svg>
                  <span>Docs</span>
                </Link>
              </li>
              <li>
                {!loading && (
                  <Link
                    href={user ? '/account' : '/login'}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-white hover:text-[#0052FF] transition-colors"
                  >
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 12c2.28 0 4-1.72 4-4s-1.72-4-4-4-4 1.72-4 4 1.72 4 4 4z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18v-.42A2.58 2.58 0 018.58 15h6.84A2.58 2.58 0 0118 17.58V18"
                      />
                    </svg>
                    <span>{user ? 'Account' : 'Sign in'}</span>
                  </Link>
                )}
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <style jsx>{`
        .coinContainer {
          position: relative;
          width: 40px;
          height: 40px;
          perspective: 1000px;
        }
        .coinInner {
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          animation: spinCoin 2s linear infinite;
        }
        .coinFace {
          width: 40px;
          height: 40px;
          backface-visibility: hidden;
        }
        @keyframes spinCoin {
          from {
            transform: rotateY(0deg);
          }
          to {
            transform: rotateY(360deg);
          }
        }
      `}</style>
    </>
  );
};

function IconLink({
  href,
  label,
  svg,
  extraPath,
}: {
  href: string;
  label: string;
  svg: React.ReactNode;
  extraPath?: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <Link href={href} className="flex items-center">
        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            {svg}
            {extraPath ? extraPath : null}
          </svg>
        </div>
        <span className="sr-only">{label}</span>
      </Link>
      <span
        data-tooltip-id={`tooltip-${label.toLowerCase().replace(/\s/g, '-')}`}
        data-tooltip-content={label}
        className="cursor-help"
      >
        <span className="sr-only">{label}</span>
      </span>
    </div>
  );
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
  <div className="flex items-center gap-3 p-4 bg-gray-950 rounded-lg">
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
        className={`w-full px-4 py-3 bg-transparent text-white border border-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0052FF] text-base ${
          contractAddress && !isValidAddress ? 'border-red-500' : ''
        }`}
        aria-label="Smart contract address input"
      />
      {contractAddress && (
        <button
          onClick={() => setContractAddress('')}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          aria-label="Clear contract address"
        >
          ✕
        </button>
      )}
    </div>
    <button
      onClick={handleAudit}
      disabled={loading || !isValidAddress}
      className={`px-4 py-3 bg-[#0052FF] text-white rounded-lg flex items-center gap-2 hover:bg-blue-600 transition text-base disabled:opacity-50 disabled:cursor-not-allowed`}
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
    <div className="min-h-screen flex flex-col bg-black text-white font-sans">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-8 space-y-12">
        {/* Audit Section */}
        <section id="audit" className="max-w-lg mx-auto">
          <h2 className="text-2xl font-semibold text-center text-[#0052FF] mb-6">
            Audit a Contract
          </h2>
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
                className="mt-6 p-4 bg-gray-950 rounded-lg text-center"
              >
                <p className="text-base">Scanning contract...</p>
              </motion.div>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-6 text-center text-red-500 text-base bg-red-900/50 py-3 rounded-lg"
              >
                {typeof error === 'string' ? error : error?.message || 'An error occurred'}
              </motion.p>
            )}

            {auditResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 p-4 bg-gray-950 rounded-lg"
              >
                <div className="flex justify-between items-center mb-3">
                  <p className="text-base font-semibold break-all">
                    {auditResult.token?.name
                      ? `${auditResult.token.name} (${auditResult.token?.symbol || 'N/A'})`
                      : 'Unknown Contract'}
                  </p>
                  <button
                    onClick={handleCopyResults}
                    className="text-[#0052FF] hover:text-blue-400 transition flex items-center gap-1 text-base"
                    aria-label="Copy audit results"
                  >
                    <FiCopy size={18} />
                    Copy
                  </button>
                </div>
                <div className="text-center mb-3">
                  {auditResult.honeypotResult?.isHoneypot ? (
                    <p className="flex items-center justify-center text-lg font-semibold text-red-500">
                      <FiAlertTriangle className="w-6 h-6 mr-2" />
                      Vulnerabilities Detected
                    </p>
                  ) : (
                    <p className="flex items-center justify-center text-lg font-semibold text-[#0052FF]">
                      <FiShield className="w-6 h-6 mr-2" />
                      No Vulnerabilities Detected
                    </p>
                  )}
                </div>
                <div className="text-base text-white space-y-3">
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
                            <FiInfo className="w-4 h-4 text-[#0052FF]" aria-hidden="true" />
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
            <h3 className="text-xl font-semibold text-[#0052FF]">Recent Audits</h3>
            {auditHistory.length > 0 && (
              <button
                onClick={handleClearAudits}
                className="flex items-center gap-1 text-red-500 hover:text-red-400 transition text-base"
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
                  className="p-3 bg-gray-950 rounded-lg cursor-pointer hover:bg-gray-800 transition"
                  onClick={() => setAuditResult(result)}
                >
                  <p className="text-base font-semibold">
                    {result.token?.name || 'Unknown Contract'} ({result.token?.symbol || 'N/A'})
                  </p>
                  <p className="text-sm">
                    {result.honeypotResult?.isHoneypot ? (
                      <span className="text-red-500">Vulnerable</span>
                    ) : (
                      <span className="text-[#0052FF]">Safe</span>
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
          <h3 className="text-xl font-semibold text-center text-[#0052FF] mb-4">
            Why Audit with Us?
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: 'Comprehensive',
                description: 'Analyzes risks and taxes.',
                icon: <FiInfo className="w-6 h-6 text-[#0052FF]" />,
              },
              {
                title: 'Simulation',
                description: 'Tests for vulnerabilities.',
                icon: <FiSearch className="w-6 h-6 text-[#0052FF]" />,
              },
              {
                title: 'Reports',
                description: 'Clear risk insights.',
                icon: <FiShield className="w-6 h-6 text-[#0052FF]" />,
              },
            ].map((feature, index) => (
              <div key={index} className="p-4 bg-gray-950 rounded-lg text-center">
                <div className="flex justify-center mb-2">{feature.icon}</div>
                <h4 className="text-base font-semibold">{feature.title}</h4>
                <p className="text-sm text-gray-300 mt-1">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Tooltip id="tooltip" place="top" />
      <Tooltip id="tooltip-risk" place="top" />
      <Tooltip id="tooltip-whale-watchers" place="bottom" offset={{ top: 8 }} />
      <Tooltip id="tooltip-token-screener" place="bottom" offset={{ top: 8 }} />
      <Tooltip id="tooltip-honeypot-scanner" place="bottom" offset={{ top: 8 }} />
      <Tooltip id="tooltip-community-calendar" place="bottom" offset={{ top: 8 }} />
      <Tooltip id="tooltip-cypherscan" place="bottom" offset={{ top: 8 }} />
      <Tooltip id="tooltip-tournaments" place="bottom" offset={{ top: 8 }} />
      <Tooltip id="tooltip-account" place="bottom" offset={{ top: 8 }} />

      <Footer />
    </div>
  );
}