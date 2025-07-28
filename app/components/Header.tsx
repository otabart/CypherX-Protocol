"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronDownIcon, UserCircleIcon } from "@heroicons/react/24/solid";
import { signOut, type Auth } from "firebase/auth";
import { doc, getDoc, query, collection, where, getDocs } from "firebase/firestore";
import { auth as firebaseAuth, db } from "@/lib/firebase";
import { useAuth } from "@/app/providers";
import CustomConnectWallet from "./CustomConnectWallet";
import toast from "react-hot-toast"; // Added for copy and logout feedback

const auth: Auth = firebaseAuth as Auth;

const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [showExplorerDropdown, setShowExplorerDropdown] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const explorerDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch user points from Firestore
  useEffect(() => {
    const fetchPoints = async () => {
      if (!user) {
        setPoints(null);
        return;
      }

      try {
        // Primary: Fetch by UID
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("Points fetched by UID:", userData.points);
          setPoints(userData.points ?? 0);
          return;
        }

        // Fallback: Fetch by email if UID-based document doesn't exist
        if (user.email) {
          const q = query(collection(db, "users"), where("email", "==", user.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            console.log("Points fetched by email:", userData.points);
            setPoints(userData.points ?? 0);
          } else {
            console.log("No user document found for UID or email, setting points to 0");
            setPoints(0);
          }
        } else {
          console.log("No email available for fallback, setting points to 0");
          setPoints(0);
        }
      } catch (error) {
        console.error("Error fetching user points:", error);
        setPoints(0);
      }
    };

    fetchPoints();
  }, [user]);

  // Reset modals and menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setShowAccountModal(false);
    setShowToolsDropdown(false);
    setShowExplorerDropdown(false);
  }, [pathname]);

  // Handle body overflow for mobile menu and account modal
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
  }, [isMenuOpen, showAccountModal]);

  // Handle click outside to close modals and dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        showAccountModal &&
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setShowAccountModal(false);
      }
      if (
        showToolsDropdown &&
        toolsDropdownRef.current &&
        !toolsDropdownRef.current.contains(event.target as Node)
      ) {
        setShowToolsDropdown(false);
      }
      if (
        showExplorerDropdown &&
        explorerDropdownRef.current &&
        !explorerDropdownRef.current.contains(event.target as Node)
      ) {
        setShowExplorerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAccountModal, showToolsDropdown, showExplorerDropdown]);

  async function handleSignOut() {
    try {
      await signOut(auth);
      toast.success("Signed out successfully");
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out");
    }
  }

  const referralCode = user?.uid ? user.uid.slice(0, 6) : "";

  const handleCopyReferral = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied!");
    }
  };

  return (
    <>
      {/* Desktop Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-br from-gray-950 to-gray-900 text-gray-200 border-b border-blue-500/20">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center group">
            <Image
              src="https://i.imgur.com/mlPQazY.png"
              alt="Cypher Logo"
              width={48}
              height={48}
              className="w-12 h-12 object-contain transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3"
            />
            <span className="ml-2 text-xs font-medium text-blue-300 bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-0.5 flex items-center relative top-[1px]">
              v1 BETA
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/token-scanner"
              className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 hover:scale-105 transform ${
                pathname === "/token-scanner" ? "text-blue-300" : ""
              }`}
            >
              Trade
            </Link>
            <div className="relative" ref={explorerDropdownRef}>
              <button
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setShowExplorerDropdown(!showExplorerDropdown);
                  setShowToolsDropdown(false);
                }}
                className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-md hover:scale-105 transform ${
                  pathname === "/explorer" || pathname === "/explorer/latest/block"
                    ? "text-blue-300"
                    : ""
                }`}
              >
                Explorer
                <ChevronDownIcon
                  className={`w-4 h-4 ml-1 transition-transform duration-300 ease-out ${
                    showExplorerDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showExplorerDropdown && (
                <div
                  ref={explorerDropdownRef}
                  className="absolute left-0 mt-3 w-64 bg-gradient-to-br from-gray-900 to-gray-800 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-500/30 transition-all duration-300 ease-out"
                  style={{
                    opacity: showExplorerDropdown ? 1 : 0,
                    transform: showExplorerDropdown
                      ? "translateY(0)"
                      : "translateY(-10px)",
                  }}
                >
                  <div className="text-sm text-gray-100 font-sans font-medium mb-2">
                    Explorer
                  </div>
                  <hr className="border-blue-500/30 mb-3" />
                  <Link
                    href="/explorer"
                    className="flex items-center px-3 py-2 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    onClick={() => setShowExplorerDropdown(false)}
                  >
                    <svg
                      className="w-4 h-4 mr-2 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <div>
                      Search
                      <div className="text-xs text-gray-400">
                        Find transactions and addresses
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/explorer/latest/block"
                    className="flex items-center px-3 py-2 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    onClick={() => setShowExplorerDropdown(false)}
                  >
                    <svg
                      className="w-4 h-4 mr-2 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <div>
                      Block Scan
                      <div className="text-xs text-gray-400">
                        View latest blockchain blocks
                      </div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
            <div className="relative" ref={toolsDropdownRef}>
              <button
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setShowToolsDropdown(!showToolsDropdown);
                  setShowExplorerDropdown(false);
                }}
                className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-md hover:scale-105 transform ${
                  pathname.startsWith("/whale-watcher") ||
                  pathname.startsWith("/honeypot-scanner")
                    ? "text-blue-300"
                    : ""
                }`}
              >
                Tools
                <ChevronDownIcon
                  className={`w-4 h-4 ml-1 transition-transform duration-300 ease-out ${
                    showToolsDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showToolsDropdown && (
                <div
                  ref={toolsDropdownRef}
                  className="absolute left-0 mt-3 w-64 bg-gradient-to-br from-gray-900 to-gray-800 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-500/30 transition-all duration-300 ease-out"
                  style={{
                    opacity: showToolsDropdown ? 1 : 0,
                    transform: showToolsDropdown
                      ? "translateY(0)"
                      : "translateY(-10px)",
                  }}
                >
                  <div className="text-sm text-gray-100 font-sans font-medium mb-2">
                    Tools
                  </div>
                  <hr className="border-blue-500/30 mb-3" />
                  <Link
                    href="/whale-watcher"
                    className="flex items-center px-3 py-2 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    onClick={() => setShowToolsDropdown(false)}
                  >
                    <svg
                      className="w-4 h-4 mr-2 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      Whales
                      <div className="text-xs text-gray-400">
                        Track large transactions
                      </div>
                    </div>
                  </Link>
                  <div className="relative group">
                    <span className="flex items-center px-3 py-2 text-sm text-gray-400 font-sans font-normal cursor-not-allowed">
                      <svg
                        className="w-4 h-4 mr-2 text-yellow-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 3h18v6H3V3zm0 8h18v10H3V11zm2 2h14v6H5v-6z"
                        />
                      </svg>
                      <div>
                        Smart Money
                        <span className="ml-2 text-xs font-medium text-yellow-400 bg-yellow-500/20 border border-yellow-500/30 rounded-full px-2 py-0.5">
                          Soon
                        </span>
                        <div className="text-xs text-gray-400">
                          Monitor strategic trades
                        </div>
                      </div>
                    </span>
                    <div className="absolute left-0 top-full mt-1 w-48 bg-gray-900 text-gray-100 text-xs font-sans font-normal p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      Coming in v2
                    </div>
                  </div>
                  <Link
                    href="/honeypot-scanner"
                    className="flex items-center px-3 py-2 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    onClick={() => setShowToolsDropdown(false)}
                  >
                    <svg
                      className="w-4 h-4 mr-2 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                    <div>
                      Contract Audit
                      <div className="text-xs text-gray-400">
                        Detect scam contracts
                      </div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
            <Link
              href="/marketplace"
              className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 hover:scale-105 transform ${
                pathname === "/marketplace" ? "text-blue-300" : ""
              }`}
            >
              Marketplace
            </Link>
            <Link
              href="/calendar"
              className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 hover:scale-105 transform ${
                pathname === "/calendar" ? "text-blue-300" : ""
              }`}
            >
              Calendar
            </Link>
            <Link
              href="/base-chain-news"
              className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 hover:scale-105 transform ${
                pathname === "/base-chain-news" ? "text-blue-300" : ""
              }`}
            >
              News
            </Link>
            <CustomConnectWallet />
            <div className="relative">
              <button
                onClick={() => setShowAccountModal((prev) => !prev)}
                className="flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-md hover:scale-105 transform"
                aria-label={user ? "Account" : "Sign In"}
              >
                <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center transition-transform duration-300">
                  <UserCircleIcon className="w-5 h-5 text-gray-100 hover:text-blue-300 transition-colors" />
                </div>
              </button>
              {showAccountModal && (
                <div
                  ref={modalRef}
                  className="absolute right-0 mt-3 w-64 bg-gradient-to-br from-gray-900 to-gray-800 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-500/30 transition-all duration-300 ease-out"
                  style={{
                    opacity: showAccountModal ? 1 : 0,
                    transform: showAccountModal
                      ? "translateY(0)"
                      : "translateY(-10px)",
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <CustomConnectWallet />
                    </div>
                    <div className="bg-gradient-to-br from-gray-800 to-gray-700 p-3 rounded-lg border border-blue-500/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase font-medium text-blue-300">
                          Profile
                        </span>
                        <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-100">Points</span>
                        <span className="text-sm font-semibold text-blue-300">
                          {points !== null ? `${points} pts` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold text-gray-100">
                          Referral Code
                        </span>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold text-gray-100 mr-2">
                            {referralCode || "—"}
                          </span>
                          {referralCode && (
                            <button
                              onClick={handleCopyReferral}
                              className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded hover:bg-blue-500/40 transition-colors duration-150"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-gray-400 text-xs">
                        <span>Rewards</span>
                        <span>0 ⬢</span>
                      </div>
                    </div>
                    <hr className="border-blue-500/30" />
                    <ul className="space-y-2">
                      <li>
                        <Link
                          href="/vote"
                          className="block px-2 py-1 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          onClick={() => setShowAccountModal(false)}
                        >
                          Vote
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/account"
                          className="block px-2 py-1 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          onClick={() => setShowAccountModal(false)}
                        >
                          Account Settings
                        </Link>
                      </li>
                    </ul>
                    <hr className="border-blue-500/30" />
                    <div className="text-center text-xs text-gray-400">
                      Powered by Base
                    </div>
                    <hr className="border-blue-500/30" />
                    <div>
                      {user ? (
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-2 py-2 text-sm text-gray-100 font-sans font-normal hover:text-red-400 hover:bg-red-500/20 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        >
                          Logout
                        </button>
                      ) : (
                        <Link
                          href="/login"
                          className="block px-2 py-2 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          onClick={() => setShowAccountModal(false)}
                        >
                          Login / Sign Up
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="md:hidden text-gray-200 p-2"
            aria-label="Toggle Menu"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center transition-transform duration-300 hover:scale-105">
              {isMenuOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
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
                  <path
                    strokeLinecap="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16m-7 6h7"
                  />
                </svg>
              )}
            </div>
          </button>
        </div>
        <hr className="border-blue-500/20" />
      </header>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div
            className={`fixed top-0 left-0 z-50 h-full w-64 bg-gradient-to-br from-gray-900 to-gray-800 p-6 flex flex-col transform transition-transform duration-300 ease-in-out md:hidden overflow-y-auto shadow-lg border-r border-blue-500/30 ${
              isMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <button
              onClick={() => setIsMenuOpen(false)}
              className="text-gray-100 p-2 self-end"
              aria-label="Close Menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <nav className="mt-6 flex-1 space-y-3">
              <div>
                <Link
                  href="/token-scanner"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center py-2 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 hover:scale-105 transform"
                >
                  Trade
                </Link>
              </div>
              <div>
                <button
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    setShowExplorerDropdown(!showExplorerDropdown);
                  }}
                  className="w-full text-left flex items-center py-2 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:scale-105 transform"
                >
                  Explorer
                  <ChevronDownIcon
                    className={`w-4 h-4 ml-auto transition-transform duration-300 ease-out ${
                      showExplorerDropdown ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showExplorerDropdown && (
                  <div className="mt-2 space-y-2 pl-4 transition-all duration-300 ease-out">
                    <div className="text-sm text-gray-100 font-sans font-medium mb-2">
                      Explorer
                    </div>
                    <hr className="border-blue-500/30 mb-3" />
                    <Link
                      href="/explorer"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setShowExplorerDropdown(false);
                      }}
                      className="flex items-center px-3 py-2 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <svg
                        className="w-4 h-4 mr-2 text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      <div>
                        Search
                        <div className="text-xs text-gray-400">
                          Find transactions and addresses
                        </div>
                      </div>
                    </Link>
                    <Link
                      href="/explorer/latest/block"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setShowExplorerDropdown(false);
                      }}
                      className="flex items-center px-3 py-2 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <svg
                        className="w-4 h-4 mr-2 text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <div>
                        Block Scan
                        <div className="text-xs text-gray-400">
                          View latest blockchain blocks
                        </div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
              <div>
                <button
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    setShowToolsDropdown(!showToolsDropdown);
                  }}
                  className="w-full text-left flex items-center py-2 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:scale-105 transform"
                >
                  Tools
                  <ChevronDownIcon
                    className={`w-4 h-4 ml-auto transition-transform duration-300 ease-out ${
                      showToolsDropdown ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showToolsDropdown && (
                  <div className="mt-2 space-y-2 pl-4 transition-all duration-300 ease-out">
                    <div className="text-sm text-gray-100 font-sans font-medium mb-2">
                      Tools
                    </div>
                    <hr className="border-blue-500/30 mb-3" />
                    <Link
                      href="/whale-watcher"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setShowToolsDropdown(false);
                      }}
                      className="flex items-center px-3 py-2 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <svg
                        className="w-4 h-4 mr-2 text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div>
                        Whales
                        <div className="text-xs text-gray-400">
                          Track large transactions
                        </div>
                      </div>
                    </Link>
                    <div className="relative group">
                      <span className="flex items-center px-3 py-2 text-sm text-gray-400 font-sans font-normal cursor-not-allowed">
                        <svg
                          className="w-4 h-4 mr-2 text-yellow-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 3h18v6H3V3zm0 8h18v10H3V11zm2 2h14v6H5v-6z"
                          />
                        </svg>
                        <div>
                          Smart Money
                          <span className="ml-2 text-xs font-medium text-yellow-400 bg-yellow-500/20 border border-yellow-500/30 rounded-full px-2 py-0.5">
                            Soon
                          </span>
                          <div className="text-xs text-gray-400">
                            Monitor strategic trades
                          </div>
                        </div>
                      </span>
                      <div className="absolute left-0 top-full mt-1 w-48 bg-gray-900 text-gray-100 text-xs font-sans font-normal p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        Coming in v2
                      </div>
                    </div>
                    <Link
                      href="/honeypot-scanner"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setShowToolsDropdown(false);
                      }}
                      className="flex items-center px-3 py-2 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <svg
                        className="w-4 h-4 mr-2 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      <div>
                        Contract Audit
                        <div className="text-xs text-gray-400">
                          Detect scam contracts
                        </div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
              <Link
                href="/marketplace"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center py-2 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 hover:scale-105 transform"
              >
                Marketplace
              </Link>
              <Link
                href="/calendar"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center py-2 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 hover:scale-105 transform"
              >
                Calendar
              </Link>
              <Link
                href="/base-chain-news"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center py-2 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 hover:scale-105 transform"
              >
                News
              </Link>
              <div>
                <CustomConnectWallet />
              </div>
              <div className="bg-gradient-to-br from-gray-800 to-gray-700 p-3 rounded-lg border border-blue-500/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-medium text-blue-300">
                    Profile
                  </span>
                  <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-100">Points</span>
                  <span className="text-sm font-semibold text-blue-300">
                    {points !== null ? `${points} pts` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold text-gray-100">
                    Referral Code
                  </span>
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-gray-100 mr-2">
                      {referralCode || "—"}
                    </span>
                    {referralCode && (
                      <button
                        onClick={handleCopyReferral}
                        className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded hover:bg-blue-500/40 transition-colors duration-150"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-gray-400 text-xs">
                  <span>Rewards</span>
                  <span>0 ⬢</span>
                </div>
              </div>
              <div>
                <Link
                  href="/vote"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center py-2 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 hover:scale-105 transform"
                >
                  Vote
                </Link>
              </div>
              <div>
                <Link
                  href="/account"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center py-2 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 hover:scale-105 transform"
                >
                  Account Settings
                </Link>
              </div>
              <div>
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="flex items-center py-2 px-4 text-gray-100 text-base font-sans font-normal hover:bg-red-500/20 hover:text-red-400 rounded-md transition-colors duration-150 w-full text-left focus:outline-none focus:ring-2 focus:ring-red-500/50 hover:scale-105 transform"
                  >
                    Sign Out
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center py-2 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 hover:scale-105 transform"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
};

export default Header;