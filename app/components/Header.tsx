"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserCircleIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import { signOut, type Auth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth as firebaseAuth, db } from "@/lib/firebase";
import { useAuth } from "@/app/providers";


import WalletDropdown from "./WalletDropdown";
import WalletDisplay from "./WalletDisplay";
import TierProgressionModal from "./TierProgressionModal";
import GlobalSearch from "./GlobalSearch";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { FiAward, FiTrendingUp, FiSearch, FiBarChart, FiZap, FiInfo, FiUsers, FiShield } from "react-icons/fi";
import { FaCrown } from "react-icons/fa";
import { FaSearch, FaChartLine, FaUsers, FaBolt, FaCalendarAlt, FaNewspaper, FaShoppingBag } from "react-icons/fa";

const auth: Auth = firebaseAuth as Auth;

// Custom CypherX text component with styled X
const CypherXText: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <span className={className}>
      <span className="text-gray-100">Cypher</span>
      <span className="text-blue-400 font-bold">X</span>
    </span>
  );
};



const Header: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showExplorerDropdown, setShowExplorerDropdown] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('normie');
  const [badges, setBadges] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [nextTier, setNextTier] = useState<string | null>(null);
  const [pointsToNextTier, setPointsToNextTier] = useState<number>(0);
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralEarnings, setReferralEarnings] = useState<number>(0);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [showTierModal, setShowTierModal] = useState(false);
  

  
  // Wallet dropdown state
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const explorerDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Fetch user stats from API
  useEffect(() => {
    const fetchUserStats = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setPoints(userData.points || 0);
            setTier(userData.tier || 'normie');
            setBadges(userData.badges || []);
            setReferralCode(userData.referralCode || "");
            setReferralEarnings(userData.referralEarnings || 0);
            setReferralCount(userData.referralCount || 0);
            
            // Calculate progress to next tier
            const tierThresholds = {
              normie: 0,
              degen: 2000,
              alpha: 8000,
              mogul: 20000,
              titan: 50000
            };
            
            const currentTierPoints = tierThresholds[tier as keyof typeof tierThresholds] || 0;
            const nextTierName = tier === 'normie' ? 'degen' : tier === 'degen' ? 'alpha' : tier === 'alpha' ? 'mogul' : tier === 'mogul' ? 'titan' : null;
            const nextTierPoints = nextTierName ? tierThresholds[nextTierName as keyof typeof tierThresholds] : 0;
            
            setNextTier(nextTierName);
            setPointsToNextTier(nextTierPoints - (userData.points || 0));
            setProgress(nextTierName ? Math.min(100, ((userData.points || 0) - currentTierPoints) / (nextTierPoints - currentTierPoints) * 100) : 100);
          }
        } catch (error) {
          console.error("Error fetching user stats:", error);
        }
      }
    };

    fetchUserStats();
  }, [user, tier]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (explorerDropdownRef.current && !explorerDropdownRef.current.contains(event.target as Node)) {
        setShowExplorerDropdown(false);
      }
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node)) {
        setShowToolsDropdown(false);
      }
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowAccountModal(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    try {
      await signOut(auth);
      toast.success("Signed out successfully");
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out");
    }
  }

  const getTierColor = (tier: string) => {
    const colors = {
      normie: '#6B7280',
      degen: '#EF4444',
      alpha: '#10B981',
      mogul: '#F59E0B',
      titan: '#8B5CF6'
    };
    return colors[tier as keyof typeof colors] || '#6B7280';
  };

  return (
    <>
      <header className="bg-gray-900/95 backdrop-blur-xl border-b border-gray-800/50 sticky top-0 z-40 overflow-x-hidden" style={{ isolation: 'isolate' }}>
      <div className="w-full">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
          {/* Enhanced Logo / Brand - Far Left */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center group">
              <motion.span 
                className="text-lg sm:text-xl font-semibold tracking-tight italic leading-none flex items-center h-10 sm:h-12"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <CypherXText />
              </motion.span>
              <motion.span 
                className="ml-2 text-xs text-blue-400 font-medium bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-3 py-1 rounded-full border border-blue-500/30"
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                v1 BETA
              </motion.span>
            </Link>
          </div>

          {/* Enhanced Global Search Bar - Center */}
          <div className="hidden lg:flex items-center flex-1 max-w-2xl mx-8">
            <GlobalSearch 
              placeholder="Search for tokens, symbols, addresses, transactions, blocks..."
              variant="header"
            />
          </div>

          {/* Enhanced Desktop Navigation - Center */}
          <nav className="hidden xl:flex items-center justify-center space-x-12">
            {/* Enhanced Explorer Dropdown */}
            <div className="relative" ref={explorerDropdownRef}>
              <motion.button
                onClick={() => setShowExplorerDropdown(!showExplorerDropdown)}
                className="flex items-center space-x-1 text-gray-100 text-sm font-medium hover:text-blue-300 transition-colors duration-200 group"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <span>Explorer</span>
                <motion.div
                  animate={{ rotate: showExplorerDropdown ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDownIcon className="w-4 h-4" />
                </motion.div>
              </motion.button>
              

            </div>

            {/* Enhanced Tools Dropdown */}
            <div className="relative" ref={toolsDropdownRef}>
              <motion.button
                onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                className="flex items-center space-x-1 text-gray-100 text-sm font-medium hover:text-blue-300 transition-colors duration-200 group"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <span>Tools</span>
                <motion.div
                  animate={{ rotate: showToolsDropdown ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDownIcon className="w-4 h-4" />
                </motion.div>
              </motion.button>
              

            </div>

            {/* Enhanced Navigation Links */}
            <motion.div className="flex items-center space-x-8">
              <Link
                href="/token-scanner"
                className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
              >
                <span className="relative">
                  Trade
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                </span>
              </Link>

              <Link
                href="/calendar"
                className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
              >
                <span className="relative">
                  Calendar
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                </span>
              </Link>

              <Link
                href="/base-chain-news"
                className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
              >
                <span className="relative">
                  News
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                </span>
              </Link>

              <Link
                href="/marketplace"
                className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
              >
                <span className="relative">
                  Marketplace
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                </span>
              </Link>
            </motion.div>
          </nav>

                                {/* Enhanced Right Side - Wallet & Profile - Far Right */}
          <div className="flex items-center space-x-4 flex-shrink-0">
              {/* Enhanced Wallet Display & Dropdown */}
              <div className="relative">
                <WalletDisplay
                  onToggleDropdown={() => setShowWalletDropdown(!showWalletDropdown)}
                  isDropdownOpen={showWalletDropdown}
                />
              </div>
              
                            {/* Enhanced Profile Button - Hidden on Mobile */}
              <div className="relative hidden lg:block">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowAccountModal((prev) => !prev)}
                  className="flex items-center group"
                  aria-label={user ? "Account" : "Sign In"}
                >
                  <div className="relative w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center transition-all duration-300 hover:from-blue-600 hover:to-purple-600 shadow-lg border border-blue-500/30 group-hover:border-blue-400/50">
                    {user ? (
                      <span className="text-white font-semibold text-sm">
                        {user.email?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    ) : (
                      <UserCircleIcon className="w-6 h-6 text-white" />
                    )}
                  </div>
                </motion.button>
              </div>

            {/* Enhanced Mobile Menu Button */}
            <motion.button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="xl:hidden flex items-center p-2 text-gray-400 hover:text-gray-300 transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </motion.button>
          </div>
        </div>

        {/* Enhanced Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              ref={mobileMenuRef}
              className="xl:hidden border-t border-gray-800/50 bg-gray-900/95 backdrop-blur-xl"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="px-4 py-4 space-y-4">
                                 {/* Enhanced Mobile Search */}
                 <GlobalSearch 
                   placeholder="Search tokens, addresses, transactions..."
                   variant="header"
                 />

                {/* Enhanced Mobile Navigation Links with Dropdowns */}
                <div className="space-y-2">
                  {/* Explorer Section */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between p-3 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer" onClick={() => setShowExplorerDropdown(!showExplorerDropdown)}>
                      <div className="flex items-center space-x-3">
                        <FaSearch className="w-5 h-5 text-blue-400" />
                        <span className="text-gray-200">Explorer</span>
                      </div>
                      <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${showExplorerDropdown ? 'rotate-180' : ''}`} />
                    </div>
                    {showExplorerDropdown && (
                      <div className="ml-4 space-y-1">
                        <Link href="/explorer/search" className="block p-2 text-sm text-gray-300 hover:text-blue-400 transition-colors">Search</Link>
                        <Link href="/explorer/blocks" className="block p-2 text-sm text-gray-300 hover:text-blue-400 transition-colors">Blocks</Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Tools Section */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between p-3 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer" onClick={() => setShowToolsDropdown(!showToolsDropdown)}>
                      <div className="flex items-center space-x-3">
                        <FaChartLine className="w-5 h-5 text-yellow-400" />
                        <span className="text-gray-200">Tools</span>
                      </div>
                      <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${showToolsDropdown ? 'rotate-180' : ''}`} />
                    </div>
                    {showToolsDropdown && (
                      <div className="ml-4 space-y-1">
                        <Link href="/smart-audit" className="block p-2 text-sm text-gray-300 hover:text-blue-400 transition-colors">Smart Audit</Link>
                        <Link href="/whale-watcher" className="block p-2 text-sm text-gray-300 hover:text-blue-400 transition-colors">Whale Watcher</Link>
                        <Link href="/smart-money" className="block p-2 text-sm text-gray-300 hover:text-blue-400 transition-colors opacity-50">Smart Money (Coming Soon)</Link>
                        <Link href="/cypherscope" className="block p-2 text-sm text-gray-300 hover:text-blue-400 transition-colors">Memescope</Link>
                      </div>
                    )}
                  </div>
                  
                  {/* Trade Link */}
                  <Link href="/token-scanner" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-colors">
                    <FiTrendingUp className="w-5 h-5 text-green-400" />
                    <span className="text-gray-200">Trade</span>
                  </Link>
                  
                  {/* Calendar Link */}
                  <Link href="/calendar" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-colors">
                    <FaCalendarAlt className="w-5 h-5 text-blue-400" />
                    <span className="text-gray-200">Calendar</span>
                  </Link>
                  
                  {/* News Link */}
                  <Link href="/base-chain-news" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-colors">
                    <FaNewspaper className="w-5 h-5 text-green-400" />
                    <span className="text-gray-200">News</span>
                  </Link>
                  
                  {/* Marketplace Link */}
                  <Link href="/marketplace" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-colors">
                    <FaShoppingBag className="w-5 h-5 text-purple-400" />
                    <span className="text-gray-200">Marketplace</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tier Progression Modal */}
        <TierProgressionModal
          isOpen={showTierModal}
          onClose={() => setShowTierModal(false)}
          currentTier={tier}
          currentPoints={points || 0}
        />
      </div>
    </header>
    
    {/* Desktop Dropdowns rendered at root level */}
    <AnimatePresence>
      {showExplorerDropdown && (
        <motion.div
          className="fixed top-20 left-1/2 transform -translate-x-1/2 w-64 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl"
          style={{ zIndex: 999999 }}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <div className="p-2">
            <Link href="/explorer/search" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-all duration-200 group">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors duration-200">
                <FiSearch className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-200 group-hover:text-green-300 transition-colors duration-200">Search</div>
                <div className="text-xs text-gray-400">Find addresses & transactions</div>
              </div>
            </Link>
            <Link href="/explorer/blocks" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-all duration-200 group">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors duration-200">
                <FiBarChart className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-200 group-hover:text-purple-300 transition-colors duration-200">Blocks</div>
                <div className="text-xs text-gray-400">Latest blocks & mining info</div>
              </div>
            </Link>
          </div>
        </motion.div>
      )}
      
      {showToolsDropdown && (
        <motion.div
          className="fixed top-20 left-1/2 transform -translate-x-1/2 w-64 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl"
          style={{ zIndex: 999999 }}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <div className="p-2">
            <Link href="/smart-audit" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-all duration-200 group">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors duration-200">
                <FiZap className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-200 group-hover:text-yellow-300 transition-colors duration-200">Smart Audit</div>
                <div className="text-xs text-gray-400">Contract security analysis</div>
              </div>
            </Link>
            <Link href="/whale-watcher" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-all duration-200 group">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors duration-200">
                <FaUsers className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-200 group-hover:text-blue-300 transition-colors duration-200">Whale Watcher</div>
                <div className="text-xs text-gray-400">Track large transactions</div>
              </div>
            </Link>
            <Link href="/smart-money" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-all duration-200 group opacity-50">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors duration-200">
                <FaBolt className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-200 group-hover:text-green-300 transition-colors duration-200">Smart Money</div>
                <div className="text-xs text-gray-400">Coming soon</div>
              </div>
            </Link>
            <Link href="/cypherscope" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-all duration-200 group">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors duration-200">
                <FiBarChart className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-200 group-hover:text-purple-300 transition-colors duration-200">Memescope</div>
                <div className="text-xs text-gray-400">Token analytics & insights</div>
              </div>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    
    {/* Wallet Dropdown rendered at root level */}
    <WalletDropdown
      isOpen={showWalletDropdown}
      onClose={() => setShowWalletDropdown(false)}
      walletSystem="self-custodial"
    />
    
    {/* Profile Dropdown rendered at root level */}
    <AnimatePresence>
      {showAccountModal && (
        <motion.div
          ref={modalRef}
          className="fixed top-20 right-4 w-80 bg-gray-800/95 backdrop-blur-xl rounded-xl p-4 shadow-2xl border border-blue-500/30"
          style={{ zIndex: 999999 }}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="space-y-4">
            {/* Enhanced Profile Section */}
            <div className="bg-gray-700/50 p-4 rounded-lg border border-blue-500/50">
              {/* Tier Display */}
              <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-lg border border-gray-600">
                <div className="flex items-center gap-3">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tier === 'degen' ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 animate-pulse' :
                      tier === 'alpha' ? 'bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 animate-pulse' :
                      tier === 'mogul' ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 animate-pulse' :
                      tier === 'titan' ? 'bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 animate-pulse' :
                      ''
                    }`}
                    style={{ 
                      backgroundColor: tier === 'normie' ? getTierColor(tier) : undefined
                    }}
                  >
                    {tier === 'normie' && <FiUsers className="w-5 h-5 text-white" />}
                    {tier === 'degen' && <FiTrendingUp className="w-5 h-5 text-white" />}
                    {tier === 'alpha' && <FiShield className="w-5 h-5 text-white" />}
                    {tier === 'mogul' && <FaCrown className="w-5 h-5 text-white" />}
                    {tier === 'titan' && <FiAward className="w-5 h-5 text-white" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white capitalize flex items-center gap-2">
                      {tier} Tier
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                        {tier === 'normie' ? 'Basic' :
                         tier === 'degen' ? 'Bronze' :
                         tier === 'alpha' ? 'Silver' :
                         tier === 'mogul' ? 'Gold' :
                         tier === 'titan' ? 'Legendary' : 'Member'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {tier === 'normie' ? 'Just getting started in crypto' :
                       tier === 'degen' ? 'Degenerate trader, living on the edge' :
                       tier === 'alpha' ? 'Got the alpha, making moves' :
                       tier === 'mogul' ? 'Crypto mogul, building empire' :
                       tier === 'titan' ? 'Crypto titan, legendary status' : 'Member'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Points Display */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FiAward className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">Points</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-yellow-400">
                    {points?.toLocaleString() || "0"}
                  </span>
                  <button
                    onClick={() => setShowTierModal(true)}
                    className="p-1 hover:bg-blue-500/20 rounded transition-colors"
                    title="View Tier Progression"
                  >
                    <FiInfo className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
              </div>
              
              {/* Progress Bar */}
              {nextTier && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Progress to {nextTier}</span>
                    <span>{pointsToNextTier} points needed</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* Badges */}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {badges.map((badge, index) => (
                    <span
                      key={index}
                      className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Referral Section */}
            {referralCode && (
              <div className="bg-gray-700/50 p-4 rounded-lg border border-green-500/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-medium text-green-300">
                    Referral
                  </span>
                  <span className="text-xs text-gray-400">
                    {referralCount} referrals
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Code: {referralCode}</span>
                  <span className="text-sm font-bold text-green-400">
                    ${referralEarnings.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="space-y-2">
              {user ? (
                <>
                  <button
                    onClick={handleSignOut}
                    className="w-full py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm font-medium"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="w-full py-2 px-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors text-sm font-medium text-center block"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default Header;