"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/providers";
import { useFavorites } from "@/app/hooks/useFavorites";
import { useWatchlists } from "@/app/hooks/useWatchlists";

import WalletDropdown from "./WalletDropdown";
import WalletDisplay from "./WalletDisplay";
import TierProgressionModal from "./TierProgressionModal";
import GlobalSearch from "./GlobalSearch";
import UserProfileDropdown from "./UserProfileDropdown";

import { motion, AnimatePresence } from "framer-motion";
import { FiBarChart, FiZap, FiMenu, FiX, FiStar, FiBookmark, FiTrash2 } from "react-icons/fi";
import { FaUsers, FaBolt } from "react-icons/fa";

// Favorite Token Item Component
const FavoriteTokenItem = ({ poolAddress, onRemove }: { poolAddress: string; onRemove: () => void }) => {
  const [tokenData, setTokenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${poolAddress}`);
        const data = await response.json();
        setTokenData(data.pair);
      } catch (error) {
        console.error('Error fetching token data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [poolAddress]);

  if (loading) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700/50 rounded-full animate-pulse"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-700/50 rounded w-20 animate-pulse"></div>
            <div className="h-3 bg-gray-700/50 rounded w-16 animate-pulse"></div>
            <div className="h-3 bg-gray-700/50 rounded w-12 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700/50 rounded-full"></div>
          <div className="text-gray-400 text-sm">
            {poolAddress.slice(0, 8)}...{poolAddress.slice(-6)}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const priceChange = tokenData.priceChange?.h24 || 0;
  const priceChangeColor = priceChange >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30 rounded-xl hover:bg-gray-800/70 transition-all duration-200">
      <div className="flex items-center space-x-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
          {tokenData.info?.imageUrl && (
            <img src={tokenData.info.imageUrl} alt={tokenData.baseToken?.symbol || 'Token'} className="w-full h-full object-cover" />
          )}
          {!tokenData.info?.imageUrl && tokenData.baseToken?.symbol && (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20"></div>
          )}
          {!tokenData.info?.imageUrl && tokenData.baseToken?.symbol ? (
            <span className="text-xs font-bold text-gray-100 relative z-10">
              {tokenData.baseToken.symbol.slice(0, 2)}
            </span>
          ) : !tokenData.info?.imageUrl && (
            <span className="text-xs font-bold text-gray-400">??</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-100 truncate">
            {tokenData.baseToken?.symbol || 'Unknown'}
          </div>
          <div className="text-xs text-gray-400">
            ${parseFloat(tokenData.priceUsd || '0').toFixed(6)}
          </div>
          {tokenData.marketCap && (
            <div className="text-xs text-gray-500">
              ${(tokenData.marketCap / 1000000).toFixed(2)}M
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <div className="text-right">
          <span className={`text-sm font-medium ${priceChangeColor}`}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
          </span>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Watchlist Token Item Component
const WatchlistTokenItem = ({ poolAddress, onRemove }: { poolAddress: string; onRemove: () => void }) => {
  const [tokenData, setTokenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${poolAddress}`);
        const data = await response.json();
        setTokenData(data.pair);
      } catch (error) {
        console.error('Error fetching token data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [poolAddress]);

  if (loading) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700/50 rounded-full animate-pulse"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-700/50 rounded w-20 animate-pulse"></div>
            <div className="h-3 bg-gray-700/50 rounded w-16 animate-pulse"></div>
            <div className="h-3 bg-gray-700/50 rounded w-12 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700/50 rounded-full"></div>
          <div className="text-gray-400 text-sm">
            {poolAddress.slice(0, 8)}...{poolAddress.slice(-6)}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const priceChange = tokenData.priceChange?.h24 || 0;
  const priceChangeColor = priceChange >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/30 rounded-xl hover:bg-gray-800/70 transition-all duration-200">
      <div className="flex items-center space-x-3">
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
          {tokenData.info?.imageUrl && (
            <img src={tokenData.info.imageUrl} alt={tokenData.baseToken?.symbol || 'Token'} className="w-full h-full object-cover" />
          )}
          {!tokenData.info?.imageUrl && tokenData.baseToken?.symbol && (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20"></div>
          )}
          {!tokenData.info?.imageUrl && tokenData.baseToken?.symbol ? (
            <span className="text-xs font-bold text-gray-100 relative z-10">
              {tokenData.baseToken.symbol.slice(0, 2)}
            </span>
          ) : !tokenData.info?.imageUrl && (
            <span className="text-xs font-bold text-gray-400">??</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-100 truncate">
            {tokenData.baseToken?.symbol || 'Unknown'}
          </div>
          <div className="text-xs text-gray-400">
            ${parseFloat(tokenData.priceUsd || '0').toFixed(6)}
          </div>
          {tokenData.marketCap && (
            <div className="text-xs text-gray-500">
              ${(tokenData.marketCap / 1000000).toFixed(2)}M
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <div className="text-right">
          <span className={`text-sm font-medium ${priceChangeColor}`}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
          </span>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const Header: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();
  const { watchlists, removeFromWatchlist, createWatchlist, deleteWatchlist } = useWatchlists();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showExplorerDropdown, setShowExplorerDropdown] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('normie');
  const [showTierModal, setShowTierModal] = useState(false);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>('');
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [showCreateWatchlist, setShowCreateWatchlist] = useState(false);

  const explorerDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);
  const walletDropdownRef = useRef<HTMLDivElement>(null);
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
      
      const target = event.target as Node;
      const isWalletDropdownOpen = showWalletDropdown;
      const isClickInWalletButton = walletDropdownRef.current?.contains(target);
      const isClickInWalletDropdown = document.querySelector('[data-wallet-dropdown]')?.contains(target);
      
      if (isWalletDropdownOpen && !isClickInWalletButton && !isClickInWalletDropdown) {
        setShowWalletDropdown(false);
      }

      // Check if click is outside mobile menu AND not on the mobile menu button
      const isClickInMobileMenuButton = (event.target as Element)?.closest('[data-mobile-menu-button]');
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node) && !isClickInMobileMenuButton) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showWalletDropdown]);

  // Close mobile menu on route change
  useEffect(() => {
    const handleRouteChange = () => {
      setIsMenuOpen(false);
      setShowExplorerDropdown(false);
      setShowToolsDropdown(false);
      setShowWalletDropdown(false);
    };

    handleRouteChange();
  }, [pathname]);

  // Set first watchlist as selected when watchlists load
  useEffect(() => {
    if (watchlists.length > 0 && !selectedWatchlist) {
      setSelectedWatchlist(watchlists[0].id);
    }
  }, [watchlists, selectedWatchlist]);



  return (
    <>
             <header className="bg-gray-950 border-b border-gray-800/20 sticky top-0 z-50">
        <div className="w-full">
                     <div className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
             {/* Left Side - Logo & Navigation */}
             <div className="flex items-center space-x-8">
               {/* Logo */}
               <div className="flex-shrink-0">
                 <Link href="/" className="flex items-center group">
                   <motion.div
                     whileHover={{ scale: 1.05 }}
                     transition={{ duration: 0.2 }}
                   >
                     <span className="text-lg sm:text-xl font-cypherx-gradient">
                       CYPHERX
                     </span>
                   </motion.div>
                 </Link>
               </div>

                               {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center space-x-8">
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
                    href="/events"
                    className="text-gray-100 text-sm font-medium hover:text-blue-300 transition-all duration-200 group"
                    prefetch={true}
                  >
                    <span className="relative">
                      Events
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

                 {/* Explorer Dropdown */}
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
                   
                   <AnimatePresence>
                     {showExplorerDropdown && (
                       <motion.div
                         className="absolute top-full left-0 mt-6 w-48 bg-gray-900/95 backdrop-blur-sm border border-gray-700/60 shadow-2xl"
                         style={{ zIndex: 999999 }}
                         initial={{ opacity: 0, y: -8, scale: 0.98 }}
                         animate={{ opacity: 1, y: 0, scale: 1 }}
                         exit={{ opacity: 0, y: -8, scale: 0.98 }}
                         transition={{ duration: 0.15, ease: "easeOut" }}
                       >
                         <div className="p-1.5">
                           <Link href="/explorer/latest/block" className="flex items-center space-x-2 p-2 hover:bg-gray-800/80 rounded-md transition-all duration-200 group">
                             <FiBarChart className="w-4 h-4 text-purple-400" />
                             <div>
                               <div className="text-sm font-medium text-gray-200 group-hover:text-purple-300 transition-colors duration-200">Blocks</div>
                               <div className="text-xs text-gray-400">Latest blocks</div>
                             </div>
                           </Link>
                           <div className="flex items-center space-x-2 p-2 opacity-50 cursor-not-allowed">
                             <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                             </svg>
                             <div>
                               <div className="text-sm font-medium text-gray-400">API</div>
                               <div className="text-xs text-gray-500">Coming soon</div>
                             </div>
                           </div>
                         </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>

                 {/* Tools Dropdown */}
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
                   
                   <AnimatePresence>
                     {showToolsDropdown && (
                       <motion.div
                         className="absolute top-full left-0 mt-6 w-48 bg-gray-900/95 backdrop-blur-sm border border-gray-700/60 shadow-2xl"
                         style={{ zIndex: 999999 }}
                         initial={{ opacity: 0, y: -8, scale: 0.98 }}
                         animate={{ opacity: 1, y: 0, scale: 1 }}
                         exit={{ opacity: 0, y: -8, scale: 0.98 }}
                         transition={{ duration: 0.15, ease: "easeOut" }}
                       >
                         <div className="p-1.5">
                           <Link href="/audit" className="flex items-center space-x-2 p-2 hover:bg-gray-800/80 rounded-md transition-all duration-200 group">
                             <FiZap className="w-4 h-4 text-yellow-400" />
                             <div>
                               <div className="text-sm font-medium text-gray-200 group-hover:text-yellow-300 transition-colors duration-200">Smart Audit</div>
                               <div className="text-xs text-gray-400">Contract security</div>
                             </div>
                           </Link>
                           <Link href="/whale-watcher" className="flex items-center space-x-2 p-2 hover:bg-gray-800/80 rounded-md transition-all duration-200 group">
                             <FaUsers className="w-4 h-4 text-blue-400" />
                             <div>
                               <div className="text-sm font-medium text-gray-200 group-hover:text-blue-300 transition-colors duration-200">Whale Watcher</div>
                               <div className="text-xs text-gray-400">Track large tx</div>
                             </div>
                           </Link>
                           <Link href="/smart-money" className="flex items-center space-x-2 p-2 hover:bg-gray-800/80 rounded-md transition-all duration-200 group opacity-50">
                             <FaBolt className="w-4 h-4 text-green-400" />
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
             </div>

                           {/* Right Side - Search, Button, Wallet & Profile */}
              <div className="flex items-center space-x-4">
                {/* Global Search */}
                <div className="hidden lg:flex items-center">
                  <GlobalSearch 
                    placeholder="Search by token or CA..."
                    variant="header"
                  />
                </div>

                {/* Action Buttons */}
                <div className="hidden lg:flex items-center space-x-2">
                  <motion.button
                    className="relative flex items-center justify-center w-10 h-10 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-yellow-400 rounded-lg transition-all duration-200 border border-gray-700/50 hover:border-yellow-500/50"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Favorites"
                    onClick={() => setShowFavoritesModal(true)}
                  >
                    <FiStar className="w-4 h-4" />
                    {favorites.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {favorites.length > 9 ? '9+' : favorites.length}
                      </span>
                    )}
                  </motion.button>
                  
                  <motion.button
                    className="relative flex items-center justify-center w-10 h-10 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-blue-400 rounded-lg transition-all duration-200 border border-gray-700/50 hover:border-blue-500/50"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Watchlist"
                    onClick={() => setShowWatchlistModal(true)}
                  >
                    <FiBookmark className="w-4 h-4" />
                    {watchlists.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {watchlists.length > 9 ? '9+' : watchlists.length}
                      </span>
                    )}
                  </motion.button>
                </div>

                {/* Wallet Display & Dropdown */}
                <div className="relative" ref={walletDropdownRef}>
                  <WalletDisplay
                    onToggleDropdown={() => setShowWalletDropdown(!showWalletDropdown)}
                    isDropdownOpen={showWalletDropdown}
                  />
                </div>
               
               {/* Profile Button - Hidden on mobile */}
               <div className="relative hidden lg:block">
                 <UserProfileDropdown />
               </div>

               {/* Mobile Menu Button */}
               <motion.button
                 data-mobile-menu-button
                 onClick={() => setIsMenuOpen(!isMenuOpen)}
                 className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200"
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
               >
                 <AnimatePresence mode="wait">
                   {isMenuOpen ? (
                     <motion.div
                       key="close"
                       initial={{ rotate: -90, opacity: 0 }}
                       animate={{ rotate: 0, opacity: 1 }}
                       exit={{ rotate: 90, opacity: 0 }}
                       transition={{ duration: 0.2 }}
                     >
                       <FiX className="w-5 h-5 text-gray-300" />
                     </motion.div>
                   ) : (
                     <motion.div
                       key="menu"
                       initial={{ rotate: 90, opacity: 0 }}
                       animate={{ rotate: 0, opacity: 1 }}
                       exit={{ rotate: -90, opacity: 0 }}
                       transition={{ duration: 0.2 }}
                     >
                       <FiMenu className="w-5 h-5 text-gray-300" />
                     </motion.div>
                   )}
                 </AnimatePresence>
               </motion.button>
             </div>
           </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                ref={mobileMenuRef}
                                 className="xl:hidden border-t border-gray-800/20 bg-gray-950"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div className="px-4 py-4 space-y-4">
                  {/* Mobile Search */}
                  <div className="mb-4">
                    <GlobalSearch 
                      placeholder="Search tokens, addresses, transactions..."
                      variant="header"
                    />
                  </div>

                  {/* Mobile Navigation Links */}
                  <div className="space-y-1">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Link href="/trade" className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group" prefetch={true}>
                        <span className="text-gray-200 text-sm font-medium">Trade</span>
                      </Link>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <Link href="/radar" className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group" prefetch={true}>
                        <span className="text-gray-200 text-sm font-medium">Radar</span>
                      </Link>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Link href="/events" className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group" prefetch={true}>
                        <span className="text-gray-200 text-sm font-medium">Events</span>
                      </Link>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      <Link href="/insights" className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group" prefetch={true}>
                        <span className="text-gray-200 text-sm font-medium">Insights</span>
                      </Link>
                    </motion.div>
                  </div>

                  {/* Mobile Favorites & Watchlist */}
                  <div className="space-y-1">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <button 
                        onClick={() => setShowFavoritesModal(true)}
                        className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group"
                      >
                        <div className="flex items-center space-x-2">
                          <FiStar className="w-4 h-4 text-yellow-400" />
                          <span className="text-gray-200 text-sm font-medium">Favorites</span>
                        </div>
                        {favorites.length > 0 && (
                          <span className="bg-yellow-500 text-black text-xs rounded-full px-2 py-1 font-bold">
                            {favorites.length > 9 ? '9+' : favorites.length}
                          </span>
                        )}
                      </button>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 }}
                    >
                      <button 
                        onClick={() => setShowWatchlistModal(true)}
                        className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group"
                      >
                        <div className="flex items-center space-x-2">
                          <FiBookmark className="w-4 h-4 text-blue-400" />
                          <span className="text-gray-200 text-sm font-medium">Watchlist</span>
                        </div>
                        {watchlists.length > 0 && (
                          <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 font-bold">
                            {watchlists.length > 9 ? '9+' : watchlists.length}
                          </span>
                        )}
                      </button>
                    </motion.div>
                  </div>

                  {/* Mobile Dropdowns */}
                  <div className="space-y-2">
                    {/* Developers Section */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-1"
                    >
                      <div 
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 cursor-pointer" 
                        onClick={() => setShowExplorerDropdown(!showExplorerDropdown)}
                      >
                        <span className="text-gray-200 text-sm font-medium">Developers</span>
                        <motion.div
                          animate={{ rotate: showExplorerDropdown ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                        </motion.div>
                      </div>
                      
                      <AnimatePresence>
                        {showExplorerDropdown && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="ml-3 space-y-0.5"
                          >
                            <Link href="/explorer/latest/block" className="flex items-center space-x-2 p-1.5 text-xs text-gray-300 hover:text-blue-400 transition-colors rounded" prefetch={true}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              <span>Blocks</span>
                            </Link>
                            <div className="flex items-center space-x-2 p-1.5 text-xs text-gray-500 opacity-50 cursor-not-allowed">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                              <span>API (Coming Soon)</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    
                    {/* Tools Section */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 }}
                      className="space-y-1"
                    >
                      <div 
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 cursor-pointer" 
                        onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                      >
                        <span className="text-gray-200 text-sm font-medium">Tools</span>
                        <motion.div
                          animate={{ rotate: showToolsDropdown ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                        </motion.div>
                      </div>
                      
                      <AnimatePresence>
                        {showToolsDropdown && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="ml-3 space-y-0.5"
                          >
                            <Link href="/audit" className="flex items-center space-x-2 p-1.5 text-xs text-gray-300 hover:text-yellow-400 transition-colors rounded" prefetch={true}>
                              <FiZap className="w-3 h-3" />
                              <span>Smart Audit</span>
                            </Link>
                            <Link href="/whale-watcher" className="flex items-center space-x-2 p-1.5 text-xs text-gray-300 hover:text-blue-400 transition-colors rounded" prefetch={true}>
                              <FaUsers className="w-3 h-3" />
                              <span>Whale Watcher</span>
                            </Link>
                            <Link href="/smart-money" className="flex items-center space-x-2 p-1.5 text-xs text-gray-300 hover:text-green-400 transition-colors opacity-50 rounded" prefetch={true}>
                              <FaBolt className="w-3 h-3" />
                              <span>Smart Money</span>
                            </Link>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
    
      {/* Tier Progression Modal */}
      <TierProgressionModal
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
        currentTier={tier}
        currentPoints={points || 0}
      />
    
      {/* Favorites Modal */}
      <AnimatePresence>
        {showFavoritesModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFavoritesModal(false)}
          >
            <motion.div
              className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
                  <FiStar className="w-5 h-5 text-yellow-400" />
                  <span>Favorites</span>
                </h3>
                <button
                  onClick={() => setShowFavoritesModal(false)}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                {favorites.length === 0 ? (
                  <div className="text-gray-400 text-sm">
                    No favorites yet. Click the star icon on any token to add it to your favorites.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {favorites.map((poolAddress) => (
                      <FavoriteTokenItem 
                        key={poolAddress} 
                        poolAddress={poolAddress} 
                        onRemove={() => toggleFavorite(poolAddress)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Watchlist Modal */}
      <AnimatePresence>
        {showWatchlistModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWatchlistModal(false)}
          >
            <motion.div
              className="bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
                  <FiBookmark className="w-5 h-5 text-blue-400" />
                  <span>Watchlist</span>
                </h3>
                <button
                  onClick={() => setShowWatchlistModal(false)}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                {/* Watchlist Selector */}
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedWatchlist}
                    onChange={(e) => setSelectedWatchlist(e.target.value)}
                    className="flex-1 bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                  >
                    {watchlists.map((watchlist) => (
                      <option key={watchlist.id} value={watchlist.id}>
                        {watchlist.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowCreateWatchlist(!showCreateWatchlist)}
                    className="px-3 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-200 hover:text-white rounded-lg text-sm transition-all duration-200 border border-gray-600/50"
                    title="Create new watchlist"
                  >
                    {showCreateWatchlist ? '×' : '+'}
                  </button>
                  {selectedWatchlist && watchlists.length > 1 && (
                    <button
                      onClick={async () => {
                        const watchlistName = watchlists.find(w => w.id === selectedWatchlist)?.name || 'this watchlist';
                        if (confirm(`Are you sure you want to delete "${watchlistName}"? This action cannot be undone.`)) {
                          await deleteWatchlist(selectedWatchlist);
                          setSelectedWatchlist(watchlists.find(w => w.id !== selectedWatchlist)?.id || '');
                        }
                      }}
                      className="px-3 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-200 hover:text-red-400 rounded-lg text-sm transition-all duration-200 border border-gray-600/50"
                      title="Delete watchlist"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Create New Watchlist */}
                {showCreateWatchlist && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="New watchlist name"
                      value={newWatchlistName}
                      onChange={(e) => setNewWatchlistName(e.target.value)}
                      className="flex-1 bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 transition-all duration-200"
                    />
                    <button
                      onClick={async () => {
                        if (newWatchlistName.trim()) {
                          await createWatchlist(newWatchlistName.trim());
                          setNewWatchlistName('');
                          setShowCreateWatchlist(false);
                        }
                      }}
                      className="px-3 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-200 hover:text-white rounded-lg text-sm transition-all duration-200 border border-gray-600/50"
                    >
                      Create
                    </button>
                  </div>
                )}

                {/* Watchlist Tokens */}
                {selectedWatchlist && watchlists.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">
                        {watchlists.find(w => w.id === selectedWatchlist)?.tokens.length || 0} tokens
                      </span>
                      {(watchlists.find(w => w.id === selectedWatchlist)?.tokens?.length || 0) > 0 && (
                        <button
                          onClick={async () => {
                            const watchlistName = watchlists.find(w => w.id === selectedWatchlist)?.name || 'this watchlist';
                            if (confirm(`Clear all tokens from "${watchlistName}"?`)) {
                              const watchlist = watchlists.find(w => w.id === selectedWatchlist);
                              if (watchlist && watchlist.tokens) {
                                for (const token of watchlist.tokens) {
                                  await removeFromWatchlist(selectedWatchlist, token);
                                }
                              }
                            }
                          }}
                          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(watchlists.find(w => w.id === selectedWatchlist)?.tokens || []).map((poolAddress) => (
                        <WatchlistTokenItem 
                          key={poolAddress} 
                          poolAddress={poolAddress} 
                          onRemove={() => removeFromWatchlist(selectedWatchlist, poolAddress)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm">
                    No watchlists yet. Create a watchlist to start tracking tokens.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    
      {/* Wallet Dropdown */}
      <WalletDropdown
        isOpen={showWalletDropdown}
        onClose={() => setShowWalletDropdown(false)}
        walletSystem="self-custodial"
      />
    </>
  );
};

export default Header;