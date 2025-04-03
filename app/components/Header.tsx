"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

// Firebase
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase"; // your path
import { useAuth } from "@/app/providers"; // your AuthProvider

const Header = () => {
  const router = useRouter();
  const pathname = usePathname();

  // From Firebase Auth context
  const { user, loading } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isToolsMobileOpen, setIsToolsMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsToolsMobileOpen(false);
  }, [pathname]);

  // Sign out logic (if you still need it):
  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          {/* Logo & BETA badge */}
          <Link href="/" className="flex items-center">
            <div className="coinContainer">
              <div className="coinInner">
                <Image
                  src="https://i.imgur.com/OML2njS.png"
                  alt="Homebase Logo"
                  width={40}
                  height={40}
                  className="coinFace"
                />
              </div>
            </div>
            <span className="ml-2 text-xs font-bold text-green-700 bg-green-100 border border-green-500 rounded-full px-3 py-0.5 flex items-center relative top-[1px]">
              v1 BETA
            </span>
          </Link>

          {/* Desktop Navigation (no dropdowns) */}
          <nav className="hidden md:flex items-center space-x-6">
            {/* Whale Watchers */}
            <IconLink
              href="/whale-watcher"
              label="Whale Watchers"
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

            {/* Token Screener */}
            <IconLink
              href="/token-scanner"
              label="Token Screener"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.15z"
                />
              }
            />

            {/* Honeypot Scanner */}
            <IconLink
              href="/honeypot-scanner"
              label="Honeypot Scanner"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4m0 4h.01M20.205 7.697l-7.2-3.6a1.3 1.3 0 00-1.01 0l-7.2 3.6A1.3 1.3 0 004 8.848v6.304a1.3 1.3 0 00.795 1.151l7.2 3.6c.315.158.694.158 1.01 0l7.2-3.6A1.3 1.3 0 0020 15.152V8.848a1.3 1.3 0 00-.795-1.151z"
                />
              }
            />

            {/* Launch Calendar */}
            <IconLink
              href="/launch-calendar"
              label="Launch Calendar"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              }
            />

            {/* News Terminal */}
            <IconLink
              href="/terminal"
              label="News Terminal"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 20H5a2 2 0 01-2-2V5.4C3 5.179 3.179 5 3.4 5H5c.265 0 .52.105.707.293l.293.293h13a2 2 0 012 2V18a2 2 0 01-2 2z"
                />
              }
              extraPath={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 8h10M7 12h6m-6 4h10"
                />
              }
            />

            {/* Whitepaper */}
            <IconLink
              href="/whitepaper"
              label="Whitepaper"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 2h6l5 5v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z"
                />
              }
              extraPath={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 2v6h6"
                />
              }
            />

            {/* Competition (new trophy icon) */}
            <IconLink
              href="/TradingCompetition"
              label="Competition"
              svg={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 21h8M12 17v4M6 3h12l1 5a5 5 0 01-4 5v1a4 4 0 01-4 4 4 4 0 01-4-4v-1a5 5 0 01-4-5l1-5z"
                />
              }
            />

            {/* Account Icon (Login or Account) */}
            {!loading && (
              <div className="relative group">
                <Link
                  href={user ? "/account" : "/login"}
                  className="flex items-center"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    {/* Simple user icon */}
                    <svg
                      className="w-4 h-4"
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
                  {/* Screen-reader text */}
                  <span className="sr-only">{user ? "Account" : "Sign in"}</span>
                </Link>
                {/* Tooltip */}
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded pointer-events-none whitespace-nowrap hidden group-hover:block">
                  {user ? "Account" : "Sign in"}
                </span>
              </div>
            )}
          </nav>

          {/* Mobile Nav Toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-gray-800"
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

      {/* Mobile Navigation */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-white transition-transform duration-300 ${
          isMenuOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <nav className="pt-20 pb-10 px-6 h-full overflow-y-auto flex flex-col">
          {/* If you still want a collapsible "Tool Library" on mobile, keep the code below.
              Otherwise, replicate the "IconLink" approach on mobile as well. */}
          <div className="border-b border-gray-300 py-4">
            <button
              onClick={() => setIsToolsMobileOpen(!isToolsMobileOpen)}
              className="flex items-center justify-between w-full text-left font-semibold text-gray-800 hover:text-[#0052FF] transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 6H5a2 2 0 00-2 2v10a2 2 0 002 2h3V6zM8 6h3a2 2 0 012 2v10a2 2 0 01-2 2H8M8 6v14m5-14h3a2 2 0 012 2v10a2 2 0 01-2 2h-3V6z"
                  />
                </svg>
                <span>Tool Library</span>
              </div>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                {isToolsMobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                )}
              </svg>
            </button>
            {isToolsMobileOpen && (
              <ul className="mt-2 ml-4 space-y-2">
                <li>
                  <Link
                    href="/whale-watcher"
                    onClick={() => setIsMenuOpen(false)}
                    className="block py-2 border-b border-gray-200 text-gray-800 hover:text-[#0052FF]"
                  >
                    Whale Watchers
                  </Link>
                </li>
                <li>
                  <Link
                    href="/token-scanner"
                    onClick={() => setIsMenuOpen(false)}
                    className="block py-2 border-b border-gray-200 text-gray-800 hover:text-[#0052FF]"
                  >
                    Token Screener
                  </Link>
                </li>
                <li>
                  <Link
                    href="/honeypot-scanner"
                    onClick={() => setIsMenuOpen(false)}
                    className="block py-2 border-b border-gray-200 text-gray-800 hover:text-[#0052FF]"
                  >
                    Honeypot Scanner
                  </Link>
                </li>
                <li>
                  <Link
                    href="/launch-calendar"
                    onClick={() => setIsMenuOpen(false)}
                    className="block py-2 border-b border-gray-200 text-gray-800 hover:text-[#0052FF]"
                  >
                    Launch Calendar
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terminal"
                    onClick={() => setIsMenuOpen(false)}
                    className="block py-2 text-gray-800 hover:text-[#0052FF]"
                  >
                    News Terminal
                  </Link>
                </li>
              </ul>
            )}
          </div>

          {/* Other Mobile Nav Links */}
          <div className="border-b border-gray-300 py-4">
            <Link
              href="/analysts"
              onClick={() => setIsMenuOpen(false)}
              className="block py-2 text-gray-800 hover:text-[#0052FF]"
            >
              Analysts
            </Link>

            {/* Whitepaper */}
            <Link
              href="/whitepaper"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-2 py-2 text-gray-800 hover:text-[#0052FF]"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 2h6l5 5v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 2v6h6"
                />
              </svg>
              <span>Whitepaper</span>
            </Link>

            {/* Competition */}
            <Link
              href="/TradingCompetition"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-2 py-2 text-gray-800 hover:text-[#0052FF]"
            >
              <svg
                className="w-5 h-5"
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
              <span>Competition</span>
            </Link>
          </div>

          {/* Mobile Account Icon */}
          <div className="mt-4">
            {!loading && (
              <Link
                href={user ? "/account" : "/login"}
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0052FF] text-white hover:bg-blue-600 transition-colors"
              >
                {user ? "Account" : "Sign in"}
              </Link>
            )}
          </div>
        </nav>
      </div>

      {/* Custom CSS for Coin Animation, etc. */}
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

export default Header;

/**
 * A reusable component for a single icon link + tooltip.
 * 
 * Props:
 * - href: URL path
 * - label: string (shown in tooltip)
 * - svg: main <path> or <svg> children
 * - extraPath?: an optional second path for more complex icons
 */
function IconLink({
  href,
  label,
  svg,
  extraPath
}: {
  href: string;
  label: string;
  svg: React.ReactNode;
  extraPath?: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <Link href={href} className="flex items-center">
        {/* Gray circle with icon */}
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-gray-800"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            {svg}
            {extraPath ? extraPath : null}
          </svg>
        </div>
        {/* Screen-reader text */}
        <span className="sr-only">{label}</span>
      </Link>

      {/* Tooltip on hover */}
      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded pointer-events-none whitespace-nowrap hidden group-hover:block">
        {label}
      </span>
    </div>
  );
}






