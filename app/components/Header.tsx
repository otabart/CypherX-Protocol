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
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isToolsMobileOpen, setIsToolsMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsToolsMobileOpen(false);
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

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {/* Tool Library Dropdown */}
            <div
              className="relative group"
              onMouseEnter={() => setIsToolsOpen(true)}
              onMouseLeave={() => setIsToolsOpen(false)}
            >
              <button className="text-gray-800 hover:text-[#0052FF] transition-colors inline-flex items-center">
                <span className="relative animated-underline">Tool Library</span>
                <svg
                  className="ml-1 w-4 h-4 transform transition-transform duration-300 group-hover:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <ul
                className={`absolute z-10 left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-md w-64 py-2 transform transition-all duration-200 ease-out ${
                  isToolsOpen
                    ? "opacity-100 scale-100 pointer-events-auto"
                    : "opacity-0 scale-95 pointer-events-none"
                }`}
              >
                <li className="px-4 py-2 text-gray-700 hover:bg-gray-100">
                  <Link href="/whale-watcher" className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-[#0052FF]"
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
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Monitor large wallet transactions in real-time
                    </p>
                  </Link>
                </li>
                <li className="border-t border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-100">
                  <Link href="/token-scanner" className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-[#0052FF]"
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
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Analyze tokens for liquidity, volume, and more
                    </p>
                  </Link>
                </li>
                <li className="border-t border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-100">
                  <Link href="/honeypot-scanner" className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-[#0052FF]"
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
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Check if a token&apos;s contract can trap funds
                    </p>
                  </Link>
                </li>
                <li className="border-t border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-100">
                  <Link href="/launch-calendar" className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-[#0052FF]"
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
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Stay informed on upcoming token launches
                    </p>
                  </Link>
                </li>
                <li className="border-t border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-100">
                  <Link href="/terminal" className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-[#0052FF]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 20H5a2 2 0 01-2-2V5.4C3 5.179 3.179 5 3.4 5H5c.265 0 .52.105.707.293l.293.293h13a2 2 0 012 2V18a2 2 0 01-2 2z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7 8h10M7 12h6m-6 4h10"
                        />
                      </svg>
                      <span>News Terminal</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Get the latest DeFi updates and news
                    </p>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Additional Desktop Links */}
            <Link href="/docs" className="text-gray-800 hover:text-[#0052FF] transition-colors">
              Docs
            </Link>
            <Link
              href="/whitepaper"
              className="text-gray-800 hover:text-[#0052FF] transition-colors"
            >
              Whitepaper
            </Link>
            <Link
              href="/TradingCompetition"
              className="text-gray-800 hover:text-[#0052FF] transition-colors"
            >
              Competition
            </Link>

            {/* Conditionally show user avatar or sign in */}
            {!loading && (
              user ? (
                // If user is logged in, show avatar with dropdown
                <UserAvatar
                  photoURL={user.photoURL} // or from your Firestore doc
                  onSignOut={handleSignOut}
                />
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0052FF] text-white hover:bg-blue-600 transition-colors"
                >
                  Sign in
                </Link>
              )
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
          {/* Mobile Tool Library Collapsible */}
          <div className="border-b border-gray-300 py-4">
            <button
              onClick={() => setIsToolsMobileOpen(!isToolsMobileOpen)}
              className="flex items-center justify-between w-full text-left font-semibold text-gray-800 hover:text-[#0052FF] transition-colors"
            >
              <span>Tool Library</span>
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

          {/* Other Nav Links */}
          <div className="border-b border-gray-300 py-4">
            <Link
              href="/analysts"
              onClick={() => setIsMenuOpen(false)}
              className="block py-2 text-gray-800 hover:text-[#0052FF]"
            >
              Analysts
            </Link>
            <Link
              href="/docs"
              onClick={() => setIsMenuOpen(false)}
              className="block py-2 text-gray-800 hover:text-[#0052FF]"
            >
              <div className="flex flex-col">
                <span>Docs</span>
                <span className="text-xs text-gray-500">
                  Explore detailed documentation and guides
                </span>
              </div>
            </Link>
            <Link
              href="/whitepaper"
              onClick={() => setIsMenuOpen(false)}
              className="block py-2 text-gray-800 hover:text-[#0052FF]"
            >
              <div className="flex flex-col">
                <span>Whitepaper</span>
                <span className="text-xs text-gray-500">
                  Read our technical vision and strategy
                </span>
              </div>
            </Link>
            <Link
              href="/TradingCompetition"
              onClick={() => setIsMenuOpen(false)}
              className="block py-2 text-gray-800 hover:text-[#0052FF]"
            >
              <div className="flex flex-col">
                <span>Competitions</span>
                <span className="text-xs text-gray-500">
                  Join our trading challenges for rewards
                </span>
              </div>
            </Link>
          </div>

          {/* Mobile Account / Sign In */}
          <div className="mt-4">
            {!loading && (
              user ? (
                <>
                  <Link
                    href="/account"
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0052FF] text-white hover:bg-blue-600 transition-colors"
                  >
                    Account
                  </Link>
                  {/* (Optional) sign-out for mobile
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleSignOut();
                    }}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-300 transition-colors"
                  >
                    Sign out
                  </button>
                  */}
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0052FF] text-white hover:bg-blue-600 transition-colors"
                >
                  Sign in
                </Link>
              )
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
        .animated-underline {
          position: relative;
        }
        .animated-underline::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -2px;
          width: 0;
          height: 1px;
          background-color: #0052ff;
          transition: width 0.3s ease;
        }
        .animated-underline:hover::after {
          width: 100%;
        }
      `}</style>
    </>
  );
};

export default Header;

/**
 * Renders a user avatar with a 2px blue border.
 * On hover, a small dropdown shows "My Account" and "Sign out".
 */
function UserAvatar({
  photoURL,
  onSignOut
}: {
  photoURL?: string | null;
  onSignOut: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // If the user has no photo, show a placeholder.
  const avatarSrc = photoURL || "https://via.placeholder.com/40?text=No+Pic";

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Circle avatar with a 2px blue border */}
      <div className="w-10 h-10 rounded-full border-2 border-blue-600 overflow-hidden cursor-pointer">
        {/* Using <img> for simplicity. If you want <Image>, that can be used but note layout constraints. */}
        <img
          src={avatarSrc}
          alt="User Avatar"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Hover dropdown */}
      {isOpen && (
        <ul className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-md py-2 w-36">
          <li className="px-4 py-2 hover:bg-gray-100">
            <Link href="/account">My Account</Link>
          </li>
          <li className="px-4 py-2 hover:bg-gray-100">
            <button onClick={onSignOut}>Sign out</button>
          </li>
        </ul>
      )}
    </div>
  );
}



