// app/components/Header.tsx
'use client';

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  EyeIcon,
  CalendarIcon,
  CommandLineIcon,
  TrophyIcon,
  DocumentTextIcon,
  UserIcon,
  UsersIcon,
  CodeBracketSquareIcon,
  ChevronDownIcon,
  ClipboardIcon,
} from "@heroicons/react/24/solid";

// Firebase
import { signOut, type Auth } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/app/providers";

// RainbowKit / Wagmi for wallet connection
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

const auth: Auth = firebaseAuth as Auth;

const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const { address, isConnected } = useAccount();
  const modalRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation
  useEffect(() => {
    setIsMenuOpen(false);
    setShowAccountModal(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu or account modal is open
  useEffect(() => {
    if (isMenuOpen || showAccountModal) {
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
  }, [isMenuOpen, showAccountModal]);

  // Close account modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        showAccountModal &&
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setShowAccountModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAccountModal]);

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  // Truncate Ethereum address (e.g. 0x1234…abcd)
  function truncateAddress(addr: string | undefined) {
    if (!addr) return "";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  }

  // Referral code: first 6 chars of the UID
  const referralCode = user?.uid ? user.uid.slice(0, 6) : "";

  return (
    <>
      {/* Desktop Header */}
      <header
        className={`sticky top-0 z-40 bg-gray-950 ${
          isMenuOpen ? "hidden" : ""
        }`}
      >
        <div className="container mx-auto flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center">
            <Image
              src="https://i.imgur.com/mlPQazY.png"
              alt="Cypher Logo"
              width={48}
              height={48}
              className="w-12 h-12 object-contain"
            />
            <span className="ml-2 text-xs font-bold text-blue-400 bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-0.5 flex items-center relative top-[1px]">
              v1 BETA
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
            <IconLink
              href="/whale-watcher"
              label="Whale Watchers"
              IconComponent={UsersIcon}
            />
            <IconLink
              href="/token-scanner"
              label="Screener"
              IconComponent={EyeIcon}
            />
            <IconLink
              href="/honeypot-scanner"
              label="Audit"
              IconComponent={MagnifyingGlassIcon}
            />
            <IconLink
              href="/calendar"
              label="Calendar"
              IconComponent={CalendarIcon}
            />
            <IconLink
              href="/explorer"
              label="Explorer"
              IconComponent={CubeIcon}
            />
            <IconLink
              href="/smart-money"
              label="Smart Money"
              IconComponent={TrophyIcon}
            />
            <IconLink
              href="/marketplace"
              label="Marketplace"
              IconComponent={ShoppingBagIcon}
            />
            <IconLink
              href="/explorer/latest/block"
              label="Cypher Scan"
              IconComponent={CommandLineIcon}
            />
            <IconLink
              href="/base-chain-news"
              label="News"
              IconComponent={DocumentTextIcon}
            />
            <IconLink
              href="/terminal"
              label="Terminal"
              IconComponent={CodeBracketSquareIcon}
            />

            {/* Account / User Icon */}
            {!loading && (
              <div className="relative">
                <button
                  onClick={() => setShowAccountModal((prev) => !prev)}
                  className="flex items-center focus:outline-none"
                  aria-label={user ? "Account" : "Sign In"}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-gray-200 hover:text-blue-400 transition-colors" />
                  </div>
                </button>

                {/* Account Modal */}
                {showAccountModal && (
                  <div
                    ref={modalRef}
                    className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50"
                  >
                    <div className="p-4">
                      {/* Wallet Address / Connect */}
                      <div className="flex items-center justify-between mb-3">
                        {isConnected && address ? (
                          <>
                            <span className="text-gray-200 font-mono text-sm">
                              {truncateAddress(address)}
                            </span>
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(address)
                              }
                              className="p-1 rounded hover:bg-gray-700"
                              aria-label="Copy Address"
                            >
                              <ClipboardIcon className="w-4 h-4 text-gray-400 hover:text-gray-200" />
                            </button>
                          </>
                        ) : (
                          <ConnectButton
                            showBalance={false}
                            accountStatus="address"
                            chainStatus="icon"
                            label="Connect"
                          />
                        )}
                      </div>

                      {/* Referral Section */}
                      <div className="bg-gray-800 p-2 rounded-lg mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs uppercase font-bold text-blue-400">
                            Referral{" "}
                            <span className="text-green-400 text-xs">NEW</span>
                          </span>
                          <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-200 font-mono">
                            {referralCode || "—"}
                          </span>
                          <button
                            onClick={() =>
                              referralCode &&
                              navigator.clipboard.writeText(referralCode)
                            }
                            className="px-2 py-0.5 bg-blue-500/30 text-blue-400 text-xs rounded hover:bg-blue-500/50 transition-colors"
                          >
                            Copy Link
                          </button>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-gray-400 text-xs">
                          <span>Rewards</span>
                          <span>0 ⬢</span>
                        </div>
                      </div>

                      <hr className="border-gray-700 mb-3" />

                      {/* Vote Link */}
                      <ul className="space-y-2 mb-3 px-2">
                        <li>
                          <Link
                            href="/vote"
                            onClick={() => setShowAccountModal(false)}
                            className="block px-2 py-1 text-sm text-gray-200 hover:text-blue-400 transition-colors rounded"
                          >
                            Vote
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/account"
                            onClick={() => setShowAccountModal(false)}
                            className="block px-2 py-1 text-sm text-gray-200 hover:text-blue-400 transition-colors rounded"
                          >
                            Account Settings
                          </Link>
                        </li>
                      </ul>

                      <hr className="border-gray-700 mb-3" />

                      {/* Powered by Base */}
                      <div className="text-center text-xs text-gray-500 mb-3">
                        Powered by Base
                      </div>

                      <hr className="border-gray-700 mb-3" />

                      {/* Logout / Sign In */}
                      {!loading && (
                        <div className="px-2">
                          {user ? (
                            <button
                              onClick={handleSignOut}
                              className="w-full text-left px-2 py-2 text-sm text-gray-200 hover:text-red-500 transition-colors rounded"
                            >
                              Logout
                            </button>
                          ) : (
                            <Link
                              href="/login"
                              onClick={() => setShowAccountModal(false)}
                              className="block px-2 py-2 text-sm text-gray-200 hover:text-blue-400 transition-colors rounded"
                            >
                              Login / Sign Up
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="md:hidden text-gray-200 p-2"
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
                <line
                  x1="6"
                  y1="6"
                  x2="18"
                  y2="18"
                  strokeLinecap="round"
                  strokeWidth={2}
                />
                <line
                  x1="6"
                  y1="18"
                  x2="18"
                  y2="6"
                  strokeLinecap="round"
                  strokeWidth={2}
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <line
                  x1="4"
                  y1="8"
                  x2="20"
                  y2="8"
                  strokeLinecap="round"
                  strokeWidth={2}
                />
                <line
                  x1="4"
                  y1="14"
                  x2="16"
                  y2="14"
                  strokeLinecap="round"
                  strokeWidth={2}
                />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 z-50 bg-gray-950 overflow-x-hidden md:hidden transform ${
          isMenuOpen ? "translate-y-0" : "-translate-y-full"
        } transition-transform duration-300 ease-out`}
      >
        <nav className="pt-10 pb-10 px-6 h-full overflow-y-auto flex flex-col relative">
          <button
            onClick={() => setIsMenuOpen(false)}
            className="absolute top-4 right-4 text-gray-200 p-2"
            aria-label="Close Menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
                strokeLinecap="round"
                strokeWidth={2}
              />
              <line
                x1="6"
                y1="18"
                x2="18"
                y2="6"
                strokeLinecap="round"
                strokeWidth={2}
              />
            </svg>
          </button>

          <ul className="space-y-3">
            <li>
              <Link
                href="/whale-watcher"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <UsersIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Whale Watchers</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>

            <li>
              <Link
                href="/token-scanner"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <EyeIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Screener</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>

            <li>
              <Link
                href="/honeypot-scanner"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Audit</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>

            <li>
              <Link
                href="/calendar"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <CalendarIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Calendar</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>

            <li>
              <Link
                href="/explorer"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <CubeIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Explorer</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>

            <li>
              <Link
                href="/smart-money"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <TrophyIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Smart Money</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>

            <li>
              <Link
                href="/marketplace"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <ShoppingBagIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Marketplace</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>

            <li>
              <Link
                href="/explorer/latest/block"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <CommandLineIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Cypher Scan</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>

            <li>
              <Link
                href="/base-chain-news"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <DocumentTextIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">News</span>
              </Link>
            </li>
            <li className="border-t border-blue-500/20 mx-[-1.5rem]"></li>

            <li>
              <Link
                href="/terminal"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
              >
                <CodeBracketSquareIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                <span className="text-base leading-none">Terminal</span>
              </Link>
            </li>
          </ul>

          <div className="border-t border-blue-500/20 my-4 mx-[-1.5rem]" />

          <ul className="space-y-3 px-2">
            <li>
              {!loading ? (
                user ? (
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-red-500 transition-colors rounded-md w-full text-left"
                  >
                    <UserIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                    <span className="text-base leading-none">Sign Out</span>
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2 py-3 px-4 text-gray-200 hover:text-blue-400 transition-colors rounded-md"
                  >
                    <UserIcon className="w-5 h-5 text-gray-200 flex-shrink-0" />
                    <span className="text-base leading-none">Sign In</span>
                  </Link>
                )
              ) : null}
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
};

export default Header;

// ----------------------------------------------------------------------------
// Reusable IconLink Component
// ----------------------------------------------------------------------------

interface IconLinkProps {
  href: string;
  label: string;
  IconComponent: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

function IconLink({ href, label, IconComponent }: IconLinkProps) {
  return (
    <div className="relative group">
      <Link href={href} className="flex items-center">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <IconComponent className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
        </div>
        <span className="sr-only">{label}</span>
      </Link>
      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-gray-200 bg-gray-900 rounded pointer-events-none whitespace-nowrap hidden group-hover:block">
        {label}
      </span>
    </div>
  );
}

