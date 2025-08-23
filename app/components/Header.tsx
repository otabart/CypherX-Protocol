"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/providers";



import WalletDropdown from "./WalletDropdown";
import WalletDisplay from "./WalletDisplay";
import TierProgressionModal from "./TierProgressionModal";
import GlobalSearch from "./GlobalSearch";
import UserProfileDropdown from "./UserProfileDropdown";

import { motion, AnimatePresence } from "framer-motion";
import { FiTrendingUp, FiBarChart, FiZap } from "react-icons/fi";
import { FaSearch, FaChartLine, FaUsers, FaBolt, FaCalendarAlt, FaNewspaper } from "react-icons/fa";







const Header: React.FC = () => {

  const pathname = usePathname();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [showExplorerDropdown, setShowExplorerDropdown] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);

  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('normie');
  const [showTierModal, setShowTierModal] = useState(false);
  

  
  // Wallet dropdown state
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  

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
          }
        } catch (error) {
          console.error("Error fetching user stats:", error);
        }
      }
    };

    fetchUserStats();
  }, [user]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (explorerDropdownRef.current && !explorerDropdownRef.current.contains(event.target as Node)) {
        setShowExplorerDropdown(false);
      }
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node)) {
        setShowToolsDropdown(false);
      }


      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    const handleRouteChange = () => {
      setIsMenuOpen(false);
      setShowExplorerDropdown(false);
      setShowToolsDropdown(false);

      setShowWalletDropdown(false);
    };

    // Close menus when pathname changes
    handleRouteChange();
  }, [pathname]);





  return (
    <>
      <header className="bg-gray-950 backdrop-blur-xl border-b border-gray-950 sticky top-0 z-[999999]" style={{ isolation: 'isolate' }}>
      <div className="w-full">
        <div className="flex items-center justify-between px-4 py-2 lg:px-6 lg:py-3">
          {/* Enhanced Logo / Brand - Far Left */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center group">
              <motion.div>
                <span className="text-lg sm:text-xl font-cypherx-gradient">
                  CYPHERX
                </span>
              </motion.div>
            </Link>
          </div>

          {/* Enhanced Global Search Bar - Center */}
          <div className="hidden lg:flex items-center flex-1 max-w-2xl mx-8 relative z-[99999]">
            <GlobalSearch 
              placeholder="Search for tokens, symbols, addresses, transactions, blocks..."
              variant="header"
            />
          </div>

                      {/* Enhanced Desktop Navigation - Center */}
            <nav className="hidden xl:flex items-center justify-center space-x-10 -mr-8">
              {/* Enhanced Navigation Links */}
              <motion.div className="flex items-center space-x-10">
              <Link
                href="/trade"
                className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                prefetch={true}
              >
                <span className="relative">
                  Trade
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                </span>
              </Link>

              <Link
                href="/radar"
                className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                prefetch={true}
              >
                <span className="relative">
                  Radar
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                </span>
              </Link>

              <Link
                href="/calendar"
                className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                prefetch={true}
              >
                <span className="relative">
                  Calendar
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                </span>
              </Link>

              <Link
                href="/insights"
                className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                prefetch={true}
              >
                <span className="relative">
                  Insights
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-400 group-hover:w-full transition-all duration-300"></span>
                </span>
              </Link>




            </motion.div>

            {/* Enhanced Explorer Dropdown */}
            <div className="relative" ref={explorerDropdownRef}>
              <motion.button
                onClick={() => setShowExplorerDropdown(!showExplorerDropdown)}
                className="flex items-center space-x-1 text-gray-100 text-sm font-medium hover:text-blue-300 transition-colors duration-200 group"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <span>Developers</span>
                <motion.div
                  animate={{ rotate: showExplorerDropdown ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDownIcon className="w-4 h-4" />
                </motion.div>
              </motion.button>
              
                            {/* Explorer Dropdown Content */}
              <AnimatePresence>
                {showExplorerDropdown && (
                  <motion.div
                    className="absolute top-full left-0 mt-4 w-64 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl"
                    style={{ zIndex: 9999999 }}
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-2">

                      <Link href="/explorer/latest/block" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-all duration-200 group">
                        <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors duration-200">
                          <FiBarChart className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-200 group-hover:text-purple-300 transition-colors duration-200">Blocks</div>
                          <div className="text-xs text-gray-400">Latest blocks & mining info</div>
                        </div>
                      </Link>
                      <div className="flex items-center space-x-3 p-3 opacity-50 cursor-not-allowed">
                        <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-400">API</div>
                          <div className="text-xs text-gray-500">Coming Soon</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
              
              {/* Tools Dropdown Content */}
              <AnimatePresence>
                {showToolsDropdown && (
                  <motion.div
                    className="absolute top-full left-0 mt-4 w-64 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl"
                    style={{ zIndex: 9999999 }}
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-2">
                      <Link href="/audit" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-all duration-200 group">
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

                                {/* Enhanced Right Side - Wallet & Profile - Far Right */}
          <div className="flex items-center space-x-3 flex-shrink-0">
              {/* Enhanced Wallet Display & Dropdown */}
              <div className="relative">
                <WalletDisplay
                  onToggleDropdown={() => setShowWalletDropdown(!showWalletDropdown)}
                  isDropdownOpen={showWalletDropdown}
                />
              </div>
              
                            {/* Enhanced Profile Button - Hidden on Mobile */}
              <div className="relative hidden lg:block">
                <UserProfileDropdown />
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
              className="xl:hidden border-t border-gray-950 bg-gray-950 backdrop-blur-xl"
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
                  {/* Trade Link */}
                  <Link href="/trade" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-colors" prefetch={true}>
                    <FiTrendingUp className="w-5 h-5 text-green-400" />
                    <span className="text-gray-200">Trade</span>
                  </Link>
                  
                  {/* Radar Link */}
                  <Link href="/radar" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-colors" prefetch={true}>
                    <FiBarChart className="w-5 h-5 text-purple-400" />
                    <span className="text-gray-200">Radar</span>
                  </Link>
                  
                  {/* Calendar Link */}
                  <Link href="/calendar" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-colors" prefetch={true}>
                    <FaCalendarAlt className="w-5 h-5 text-blue-400" />
                    <span className="text-gray-200">Calendar</span>
                  </Link>
                  
                  {/* Insights Link */}
                  <Link href="/insights" className="flex items-center space-x-3 p-3 hover:bg-blue-500/20 rounded-lg transition-colors" prefetch={true}>
                    <FaNewspaper className="w-5 h-5 text-green-400" />
                    <span className="text-gray-200">Insights</span>
                  </Link>
                  

                  

                  


                  {/* Explorer Section */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between p-3 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer" onClick={() => setShowExplorerDropdown(!showExplorerDropdown)}>
                      <div className="flex items-center space-x-3">
                        <FaSearch className="w-5 h-5 text-blue-400" />
                        <span className="text-gray-200">Developers</span>
                      </div>
                      <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${showExplorerDropdown ? 'rotate-180' : ''}`} />
                    </div>
                    {showExplorerDropdown && (
                      <div className="ml-4 space-y-1">

                        <Link href="/explorer/latest/block" className="block p-2 text-sm text-gray-300 hover:text-blue-400 transition-colors" prefetch={true}>Blocks</Link>
                        <div className="block p-2 text-sm text-gray-500 opacity-50 cursor-not-allowed">API (Soon)</div>
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
                        <Link href="/audit" className="block p-2 text-sm text-gray-300 hover:text-blue-400 transition-colors" prefetch={true}>Smart Audit</Link>
                        <Link href="/whale-watcher" className="block p-2 text-sm text-gray-300 hover:text-blue-400 transition-colors" prefetch={true}>Whale Watcher</Link>
                        <Link href="/smart-money" className="block p-2 text-sm text-gray-300 hover:text-blue-400 transition-colors opacity-50" prefetch={true}>Smart Money (Coming Soon)</Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </header>
    
    {/* Tier Progression Modal rendered at root level */}
    <TierProgressionModal
      isOpen={showTierModal}
      onClose={() => setShowTierModal(false)}
      currentTier={tier}
      currentPoints={points || 0}
    />
    

    
    {/* Wallet Dropdown rendered at root level */}
    <WalletDropdown
      isOpen={showWalletDropdown}
      onClose={() => setShowWalletDropdown(false)}
      walletSystem="self-custodial"
    />
    

            </>
  );
};

export default Header;