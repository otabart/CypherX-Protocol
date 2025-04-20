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

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [isMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Sign out logic
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

          {/* Desktop Navigation (Unchanged) */}
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

            {/* Tournaments */}
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

            {/* Account Icon (Login or Account) */}
            {!loading && (
              <div className="relative group">
                <Link
                  href={user ? "/account" : "/login"}
                  className="flex items-center"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 -ACCOUNT24"
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
                  <span className="sr-only">{user ? "Account" : "Sign in"}</span>
                </Link>
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
        className={`md:hidden fixed inset-0 z-40 bg-white transition-transform duration-300 overscroll-none ${
          isMenuOpen ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{ overscrollBehavior: "none" }}
      >
        <nav className="pt-16 pb-10 px-6 h-full overflow-y-auto flex flex-col">
          {/* Toolbase Section */}
          <div className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <svg
                className="w-5 h-5 text-gray-800"
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
              <span className="font-semibold text-gray-800">Toolbase</span>
            </div>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/token-scanner"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-gray-800 hover:text-[#0052FF] transition-colors"
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
                      d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.15z"
                    />
                  </svg>
                  <span>Token Screener</span>
                </Link>
              </li>
              <li className="border-t border-gray-300 mx-[-1.5rem]"></li>
              <li>
                <Link
                  href="/whale-watcher"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-gray-800 hover:text-[#0052FF] transition-colors"
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
                      d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>Whale Watchers</span>
                </Link>
              </li>
              <li className="border-t border-gray-300 mx-[-1.5rem]"></li>
              <li>
                <Link
                  href="/launch-calendar"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-gray-800 hover:text-[#0052FF] transition-colors"
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Launch Calendar</span>
                </Link>
              </li>
              <li className="border-t border-gray-300 mx-[-1.5rem]"></li>
              <li>
                <Link
                  href="/terminal"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-gray-800 hover:text-[#0052FF] transition-colors"
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
                      d="M9 12h6m-3-3v6m-9 3h18a2 2 0 002-2V6a2 2 0 00-2-2H3a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>News Terminal</span>
                </Link>
              </li>
              <li className="border-t border-gray-300 mx-[-1.5rem]"></li>
              <li>
                <Link
                  href="/honeypot-scanner"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-gray-800 hover:text-[#0052FF] transition-colors"
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
                      d="M12 8v4m0 4h.01M20.205 7.697l-7.2-3.6a1.3 1.3 0 00-1.01 0l-7.2 3.6A1.3 1.3 0 004 8.848v6.304a1.3 1.3 0 00.795 1.151l7.2 3.6c.315.158.694.158 1.01 0l7.2-3.6A1.3 1.3 0 0020 15.152V8.848a1.3 1.3 0 00-.795-1.151z"
                    />
                  </svg>
                  <span>Honeypot Scanner</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Full-width Divider Between Sections */}
          <div className="border-t border-gray-300 my-4 mx-[-1.5rem]"></div>

          {/* Additional Section */}
          <div className="py-4">
            <ul className="space-y-3">
              <li>
                <Link
                  href="/TradingCompetition"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-gray-800 hover:text-[#0052FF] transition-colors"
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
                  <span>Tournaments</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/docs"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-gray-800 hover:text-[#0052FF] transition-colors"
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
                  <span>Docs</span>
                </Link>
              </li>
              <li>
                {!loading && (
                  <Link
                    href={user ? "/account" : "/login"}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-gray-800 hover:text-[#0052FF] transition-colors"
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
                        d="M12 12c2.28 0 4-1.72 4-4s-1.72-4-4-4-4 1.72-4 4 1.72 4 4 4z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18v-.42A2.58 2.58 0 018.58 15h6.84A2.58 2.58 0 0118 17.58V18"
                      />
                    </svg>
                    <span>{user ? "Account" : "Sign in"}</span>
                  </Link>
                )}
              </li>
            </ul>
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






