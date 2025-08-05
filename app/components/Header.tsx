"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronDownIcon, UserCircleIcon } from "@heroicons/react/24/solid";
import { signOut, type Auth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth as firebaseAuth, db } from "@/lib/firebase";
import { useAuth } from "@/app/providers";
import CustomConnectWallet from "./CustomConnectWallet";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { FiAward, FiTrendingUp } from "react-icons/fi";
import { useAccount } from "wagmi";

const auth: Auth = firebaseAuth as Auth;

const Header: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { address: walletAddress } = useAccount();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [showExplorerDropdown, setShowExplorerDropdown] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('bronze');
  const [badges, setBadges] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [nextTier, setNextTier] = useState<string | null>(null);
  const [pointsToNextTier, setPointsToNextTier] = useState<number>(0);
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralEarnings, setReferralEarnings] = useState<number>(0);
  const [referralCount, setReferralCount] = useState<number>(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const explorerDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Fetch user stats from API
  useEffect(() => {
    const fetchUserStats = async () => {
      if (!user || !walletAddress) {
        setPoints(null);
        setTier('bronze');
        setBadges([]);
        setReferralCode("");
        setReferralEarnings(0);
        setReferralCount(0);
        return;
      }

      try {
        // Fetch user stats from our new API
        const statsResponse = await fetch(`/api/tiers?walletAddress=${walletAddress}`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setPoints(statsData.points || 0);
          setTier(statsData.tier || 'bronze');
          setBadges(statsData.badges || []);
          setProgress(statsData.progress || 0);
          setNextTier(statsData.nextTier);
          setPointsToNextTier(statsData.pointsToNextTier || 0);
        } else {
          // Fallback to old method
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setPoints(userData.points ?? 0);
            setTier(userData.tier ?? 'bronze');
            setBadges(userData.badges ?? []);
            setReferralCode(userData.referralCode ?? "");
            setReferralEarnings(userData.referralEarnings ?? 0);
            setReferralCount(userData.referralCount ?? 0);
          } else {
            setPoints(0);
            setTier('bronze');
            setBadges([]);
            setReferralCode("");
            setReferralEarnings(0);
            setReferralCount(0);
          }
        }
      } catch (error) {
        console.error("Error fetching user stats:", error);
        setPoints(0);
        setTier('bronze');
        setBadges([]);
      }
    };

    fetchUserStats();
  }, [user, walletAddress]);

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

  const handleCopyReferral = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode);
      toast.success("Referral code copied!");
    }
  };

  const handleGenerateReferral = async () => {
    if (!walletAddress) {
      toast.error("Please connect your wallet first!");
      return;
    }

    try {
      const response = await fetch(`/api/referral?walletAddress=${walletAddress}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setReferralCode(data.referralCode);
        toast.success("Referral code generated successfully!");
      } else {
        toast.error("Failed to generate referral code");
      }
    } catch (error) {
      console.error("Error generating referral code:", error);
      toast.error("Failed to generate referral code");
    }
  };

  const getTierColor = (tier: string) => {
    const colors = {
      bronze: '#cd7f32',
      silver: '#c0c0c0',
      gold: '#ffd700',
      platinum: '#e5e4e2',
      diamond: '#b9f2ff'
    };
    return colors[tier as keyof typeof colors] || '#cd7f32';
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-gray-900 text-gray-200 border-b border-blue-500/20 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 3 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Image
                src="https://i.imgur.com/mlPQazY.png"
                alt="Cypher Logo"
                width={48}
                height={48}
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
              />
            </motion.div>
            <span className="ml-2 text-xs font-medium text-blue-300 bg-blue-500/20 border border-blue-500/30 rounded-full px-2 sm:px-3 py-0.5 flex items-center">
              v1 BETA
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
              <Link
                href="/token-scanner"
                className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 ${
                  pathname === "/token-scanner" ? "text-blue-300" : ""
                }`}
              >
                Trade
              </Link>
            </motion.div>
            
            <div className="relative" ref={explorerDropdownRef}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setShowExplorerDropdown(!showExplorerDropdown);
                  setShowToolsDropdown(false);
                }}
                className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 flex items-center ${
                  pathname === "/explorer" || pathname === "/explorer/latest/block"
                    ? "text-blue-300"
                    : ""
                }`}
              >
                Explorer
                <motion.div
                  animate={{ rotate: showExplorerDropdown ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <ChevronDownIcon className="w-4 h-4 ml-1" />
                </motion.div>
              </motion.button>
              
              <AnimatePresence>
                {showExplorerDropdown && (
                  <motion.div
                    ref={explorerDropdownRef}
                    className="absolute left-0 mt-3 w-64 bg-gray-800 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-blue-500/30"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <div className="text-sm text-gray-100 font-sans font-medium mb-2">
                      Explorer
                    </div>
                    <hr className="border-blue-500/30 mb-3" />
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Link
                        href="/explorer"
                        className="flex items-center px-3 py-2 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
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
                    </motion.div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Link
                        href="/explorer/latest/block"
                        className="flex items-center px-3 py-2 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
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
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="relative" ref={toolsDropdownRef}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setShowToolsDropdown(!showToolsDropdown);
                  setShowExplorerDropdown(false);
                }}
                className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 flex items-center ${
                  pathname.startsWith("/whale-watcher") ||
                  pathname.startsWith("/honeypot-scanner")
                    ? "text-blue-300"
                    : ""
                }`}
              >
                Tools
                <motion.div
                  animate={{ rotate: showToolsDropdown ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <ChevronDownIcon className="w-4 h-4 ml-1" />
                </motion.div>
              </motion.button>
              
              <AnimatePresence>
                {showToolsDropdown && (
                  <motion.div
                    ref={toolsDropdownRef}
                    className="absolute left-0 mt-3 w-64 bg-gray-800 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-blue-500/30"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <div className="text-sm text-gray-100 font-sans font-medium mb-2">
                      Tools
                    </div>
                    <hr className="border-blue-500/30 mb-3" />
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Link
                        href="/whale-watcher"
                        className="flex items-center px-3 py-2 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
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
                    </motion.div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}
                    >
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
                    </motion.div>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Link
                        href="/honeypot-scanner"
                        className="flex items-center px-3 py-2 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
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
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
              <Link
                href="/marketplace"
                className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 ${
                  pathname === "/marketplace" ? "text-blue-300" : ""
                }`}
              >
                Marketplace
              </Link>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
              <Link
                href="/calendar"
                className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 ${
                  pathname === "/calendar" ? "text-blue-300" : ""
                }`}
              >
                Calendar
              </Link>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
              <Link
                href="/base-chain-news"
                className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 ${
                  pathname === "/base-chain-news" ? "text-blue-300" : ""
                }`}
              >
                News
              </Link>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
              <Link
                href="/cypherscope"
                className={`text-gray-100 text-sm font-sans font-normal hover:text-blue-300 transition-colors duration-200 ${
                  pathname === "/cypherscope" ? "text-blue-300" : ""
                }`}
              >
                Memescope
              </Link>
            </motion.div>
            
            <CustomConnectWallet />
            
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={() => setShowAccountModal((prev) => !prev)}
                className="flex items-center"
                aria-label={user ? "Account" : "Sign In"}
              >
                <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center transition-colors duration-300 hover:bg-blue-500/30">
                  <UserCircleIcon className="w-5 h-5 text-gray-100 hover:text-blue-300 transition-colors" />
                </div>
              </motion.button>
              
              <AnimatePresence>
                {showAccountModal && (
                  <motion.div
                    ref={modalRef}
                    className="absolute right-0 mt-3 w-80 bg-gray-800 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-blue-500/30"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <CustomConnectWallet />
                      </div>
                      
                      {/* Enhanced Profile Section */}
                      <div className="bg-gray-700 p-4 rounded-lg border border-blue-500/50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs uppercase font-medium text-blue-300">
                            Profile
                          </span>
                          <div className="flex items-center gap-1">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: getTierColor(tier) }}
                            ></div>
                            <span className="text-xs text-gray-400 capitalize">{tier}</span>
                          </div>
                        </div>
                        
                        {/* Points Display */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FiTrendingUp className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-semibold text-gray-100">Points</span>
                          </div>
                          <span className="text-sm font-semibold text-blue-300">
                            {points !== null ? `${points.toLocaleString()} pts` : "—"}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        {nextTier && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>Progress to {nextTier}</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-600 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {pointsToNextTier} points to next tier
                            </div>
                          </div>
                        )}

                        {/* Badges Display */}
                        {badges.length > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <FiAward className="w-4 h-4 text-yellow-400" />
                              <span className="text-sm font-semibold text-gray-100">Badges</span>
                              <span className="text-xs text-gray-400">({badges.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {badges.slice(0, 3).map((badge, index) => (
                                <div
                                  key={index}
                                  className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30"
                                >
                                  {badge.replace(/_/g, ' ')}
                                </div>
                              ))}
                              {badges.length > 3 && (
                                <div className="px-2 py-1 bg-gray-600/50 text-gray-300 text-xs rounded-full">
                                  +{badges.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Referral Code */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-100">
                            Referral Code
                          </span>
                          <div className="flex items-center">
                            <span className="text-sm font-semibold text-gray-100 mr-2">
                              {referralCode || "—"}
                            </span>
                            {referralCode ? (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleCopyReferral}
                                className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded hover:bg-blue-500/40 transition-colors duration-150"
                              >
                                Copy
                              </motion.button>
                            ) : (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleGenerateReferral}
                                className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded hover:bg-green-500/40 transition-colors duration-150"
                              >
                                Generate
                              </motion.button>
                            )}
                          </div>
                        </div>
                        
                        {/* Referral Stats */}
                        {referralCount > 0 && (
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-400">Referrals</span>
                            <span className="text-xs text-gray-400">{referralCount} users</span>
                          </div>
                        )}
                        
                        {referralEarnings > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Referral Earnings</span>
                            <span className="text-xs text-green-400">{referralEarnings} pts</span>
                          </div>
                        )}
                      </div>
                      <hr className="border-blue-500/30" />
                      <ul className="space-y-2">
                        <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                          <Link
                            href="/vote"
                            className="block px-2 py-1 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
                            onClick={() => setShowAccountModal(false)}
                          >
                            Vote
                          </Link>
                        </motion.li>
                        <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                          <Link
                            href="/account"
                            className="block px-2 py-1 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
                            onClick={() => setShowAccountModal(false)}
                          >
                            Account Settings
                          </Link>
                        </motion.li>
                      </ul>
                      <hr className="border-blue-500/30" />
                      <div className="text-center text-xs text-gray-400">
                        Powered by Base
                      </div>
                      <hr className="border-blue-500/30" />
                      <div>
                        {user ? (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSignOut}
                            className="w-full text-left px-2 py-2 text-sm text-gray-100 font-sans font-normal hover:text-red-400 hover:bg-red-500/20 rounded-md transition-colors duration-150"
                          >
                            Logout
                          </motion.button>
                        ) : (
                          <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                            <Link
                              href="/login"
                              className="block px-2 py-2 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
                              onClick={() => setShowAccountModal(false)}
                            >
                              Login / Sign Up
                            </Link>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* Mobile Menu Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="md:hidden text-gray-200 p-2"
            aria-label="Toggle Menu"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center transition-colors duration-300 hover:bg-blue-500/30">
              <motion.div
                animate={{ rotate: isMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {isMenuOpen ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
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
                    className="h-5 w-5"
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
              </motion.div>
            </div>
          </motion.button>
        </div>
        <hr className="border-blue-500/20" />
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              ref={mobileMenuRef}
              className="fixed top-0 left-0 z-50 h-full w-80 max-w-[85vw] bg-gray-800 p-6 flex flex-col shadow-2xl border-r border-blue-500/30 md:hidden overflow-y-auto"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Mobile Menu Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Image
                    src="https://i.imgur.com/mlPQazY.png"
                    alt="Cypher Logo"
                    width={32}
                    height={32}
                    className="w-8 h-8 object-contain"
                  />
                  <span className="ml-2 text-xs font-medium text-blue-300 bg-blue-500/20 border border-blue-500/30 rounded-full px-2 py-0.5">
                    v1 BETA
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-gray-100 p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 transition-colors duration-200"
                  aria-label="Close Menu"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
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
                </motion.button>
              </div>

              {/* Mobile Navigation */}
              <nav className="flex-1 space-y-2">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Link
                    href="/token-scanner"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center py-3 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Trade
                  </Link>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <button
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      setShowExplorerDropdown(!showExplorerDropdown);
                    }}
                    className="w-full text-left flex items-center py-3 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Explorer
                    <motion.div
                      animate={{ rotate: showExplorerDropdown ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="ml-auto"
                    >
                      <ChevronDownIcon className="w-4 h-4" />
                    </motion.div>
                  </button>
                  
                  <AnimatePresence>
                    {showExplorerDropdown && (
                      <motion.div
                        className="mt-2 space-y-1 pl-4"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <Link
                          href="/explorer"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setShowExplorerDropdown(false);
                          }}
                          className="flex items-center py-2 px-3 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
                        >
                          <svg className="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <div>
                            Search
                            <div className="text-xs text-gray-400">Find transactions and addresses</div>
                          </div>
                        </Link>
                        <Link
                          href="/explorer/latest/block"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setShowExplorerDropdown(false);
                          }}
                          className="flex items-center py-2 px-3 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
                        >
                          <svg className="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <div>
                            Block Scan
                            <div className="text-xs text-gray-400">View latest blockchain blocks</div>
                          </div>
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <button
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      setShowToolsDropdown(!showToolsDropdown);
                    }}
                    className="w-full text-left flex items-center py-3 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Tools
                    <motion.div
                      animate={{ rotate: showToolsDropdown ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="ml-auto"
                    >
                      <ChevronDownIcon className="w-4 h-4" />
                    </motion.div>
                  </button>
                  
                  <AnimatePresence>
                    {showToolsDropdown && (
                      <motion.div
                        className="mt-2 space-y-1 pl-4"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <Link
                          href="/whale-watcher"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setShowToolsDropdown(false);
                          }}
                          className="flex items-center py-2 px-3 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
                        >
                          <svg className="w-4 h-4 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            Whales
                            <div className="text-xs text-gray-400">Track large transactions</div>
                          </div>
                        </Link>
                        <div className="flex items-center py-2 px-3 text-gray-400 text-sm font-sans font-normal">
                          <svg className="w-4 h-4 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v6H3V3zm0 8h18v10H3V11zm2 2h14v6H5v-6z" />
                          </svg>
                          <div>
                            Smart Money
                            <span className="ml-2 text-xs font-medium text-yellow-400 bg-yellow-500/20 border border-yellow-500/30 rounded-full px-2 py-0.5">
                              Soon
                            </span>
                            <div className="text-xs text-gray-400">Monitor strategic trades</div>
                          </div>
                        </div>
                        <Link
                          href="/honeypot-scanner"
                          onClick={() => {
                            setIsMenuOpen(false);
                            setShowToolsDropdown(false);
                          }}
                          className="flex items-center py-2 px-3 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150"
                        >
                          <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <div>
                            Contract Audit
                            <div className="text-xs text-gray-400">Detect scam contracts</div>
                          </div>
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <Link
                    href="/marketplace"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center py-3 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Marketplace
                  </Link>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Link
                    href="/calendar"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center py-3 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Calendar
                  </Link>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <Link
                    href="/base-chain-news"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center py-3 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    News
                  </Link>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Link
                    href="/cypherscope"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center py-3 px-4 text-gray-100 text-base font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-all duration-200"
                  >
                    <svg className="w-5 h-5 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                    </svg>
                    Memescope
                  </Link>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 }}
                  className="pt-2"
                >
                  <CustomConnectWallet />
                </motion.div>
              </nav>

              {/* Mobile Profile Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-6"
              >
                <div className="bg-gray-700 p-4 rounded-lg border border-blue-500/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase font-medium text-blue-300">
                      Profile
                    </span>
                    <div className="flex items-center gap-1">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: getTierColor(tier) }}
                      ></div>
                      <span className="text-xs text-gray-400 capitalize">{tier}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {/* Points Display */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FiTrendingUp className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-semibold text-gray-100">Points</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-300">
                        {points !== null ? `${points.toLocaleString()} pts` : "—"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {nextTier && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Progress to {nextTier}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {pointsToNextTier} points to next tier
                        </div>
                      </div>
                    )}

                    {/* Badges Display */}
                    {badges.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FiAward className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm font-semibold text-gray-100">Badges</span>
                          <span className="text-xs text-gray-400">({badges.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {badges.slice(0, 3).map((badge, index) => (
                            <div
                              key={index}
                              className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30"
                            >
                              {badge.replace(/_/g, ' ')}
                            </div>
                          ))}
                          {badges.length > 3 && (
                            <div className="px-2 py-1 bg-gray-600/50 text-gray-300 text-xs rounded-full">
                              +{badges.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Referral Code */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-100">
                        Referral Code
                      </span>
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-gray-100 mr-2">
                          {referralCode || "—"}
                        </span>
                        {referralCode ? (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleCopyReferral}
                            className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded hover:bg-blue-500/40 transition-colors duration-150"
                          >
                            Copy
                          </motion.button>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleGenerateReferral}
                            className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded hover:bg-green-500/40 transition-colors duration-150"
                          >
                            Generate
                          </motion.button>
                        )}
                      </div>
                    </div>
                    
                    {/* Referral Stats */}
                    {referralCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Referrals</span>
                        <span className="text-xs text-gray-400">{referralCount} users</span>
                      </div>
                    )}
                    
                    {referralEarnings > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Referral Earnings</span>
                        <span className="text-xs text-green-400">{referralEarnings} pts</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                    <Link
                      href="/vote"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center py-2 px-4 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-all duration-200"
                    >
                      <svg className="w-4 h-4 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Vote
                    </Link>
                  </motion.div>
                  
                  <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                    <Link
                      href="/account"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center py-2 px-4 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-all duration-200"
                    >
                      <svg className="w-4 h-4 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Account Settings
                    </Link>
                  </motion.div>
                  
                  <motion.div whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                    {user ? (
                      <button
                        onClick={handleSignOut}
                        className="flex items-center py-2 px-4 text-gray-100 text-sm font-sans font-normal hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all duration-200 w-full text-left"
                      >
                        <svg className="w-4 h-4 mr-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center py-2 px-4 text-gray-100 text-sm font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-all duration-200"
                      >
                        <svg className="w-4 h-4 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Sign In
                      </Link>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;