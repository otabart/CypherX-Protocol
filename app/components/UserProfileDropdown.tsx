"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, type Auth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth as firebaseAuth, db } from "@/lib/firebase";
import { useAuth, useWalletSystem, useVotingModal } from "@/app/providers";
import { motion, AnimatePresence } from "framer-motion";
import { FiAward, FiTrendingUp, FiUser, FiLogOut, FiCopy, FiGift, FiInfo, FiClock } from "react-icons/fi";
import { HiOutlineSparkles, HiOutlineCog } from "react-icons/hi";
import { FaShoppingBag } from "react-icons/fa";
import Link from "next/link";
import { createPortal } from "react-dom";
import TierProgressionModal from "./TierProgressionModal";
import PointsHistoryModal from "./PointsHistoryModal";

const auth: Auth = firebaseAuth as Auth;

const UserProfileDropdown: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
  const { setShowVotingModal, setSelectedIndexForVoting } = useVotingModal();
  const walletAddress = selfCustodialWallet?.address;
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string>('normie');
  const [badges, setBadges] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [nextTier, setNextTier] = useState<string | null>(null);
  const [pointsToNextTier, setPointsToNextTier] = useState<number>(0);
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralEarnings, setReferralEarnings] = useState<number>(0);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [showPointsHistory, setShowPointsHistory] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [alias, setAlias] = useState<string>("");
  const [isUpdatingAlias, setIsUpdatingAlias] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Debug logging for Points History
  useEffect(() => {
    if (showPointsHistory) {
      console.log('Points History opened with walletAddress:', walletAddress);
    }
  }, [showPointsHistory, walletAddress]);

  // Fetch user stats from API
  useEffect(() => {
    const fetchUserStats = async () => {
      if (!user || !walletAddress) {
        setPoints(null);
        setTier('normie');
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
          setTier(statsData.tier || 'normie');
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
            setTier(userData.tier ?? 'normie');
            setBadges(userData.badges ?? []);
            setReferralCode(userData.referralCode ?? "");
            setReferralEarnings(userData.referralEarnings ?? 0);
            setReferralCount(userData.referralCount ?? 0);
          } else {
            setPoints(0);
            setTier('normie');
            setBadges([]);
            setReferralCode("");
            setReferralEarnings(0);
            setReferralCount(0);
          }
        }

        // Check author status
        const authorResponse = await fetch(`/api/author/status?walletAddress=${walletAddress}`);
        if (authorResponse.ok) {
          const authorData = await authorResponse.json();
          setIsAuthor(authorData.isAuthor);
          setAlias(authorData.authorData?.alias || "");
        }
      } catch (error) {
        console.error("Error fetching user stats:", error);
        setPoints(0);
        setTier('normie');
        setBadges([]);
      }
    };

    fetchUserStats();
  }, [user, walletAddress]);

  // Handle click outside to close modal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showAccountModal && modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowAccountModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAccountModal]);

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
    setShowAccountModal(false);
  }

  const handleUpdateAlias = async () => {
    if (!user || !walletAddress || !alias.trim()) return;
    
    setIsUpdatingAlias(true);
    try {
      const response = await fetch('/api/user/update-alias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          alias: alias.trim(),
        }),
      });

      if (response.ok) {
        setShowAliasModal(false);
        // Refresh user data by re-fetching
        const statsResponse = await fetch(`/api/tiers?walletAddress=${walletAddress}`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setPoints(statsData.points || 0);
          setTier(statsData.tier || 'normie');
        }
      } else {
        console.error('Failed to update alias');
      }
    } catch (error) {
      console.error('Error updating alias:', error);
    } finally {
      setIsUpdatingAlias(false);
    }
  };

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

  const getTierGradient = (tier: string) => {
    const gradients = {
      normie: 'from-gray-500 to-gray-600',
      degen: 'from-red-500 to-red-600',
      alpha: 'from-green-500 to-green-600',
      mogul: 'from-yellow-500 to-yellow-600',
      titan: 'from-purple-500 to-purple-600'
    };
    return gradients[tier as keyof typeof gradients] || 'from-gray-500 to-gray-600';
  };

  const copyReferralCode = async () => {
    if (referralCode) {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVoteAndEarn = () => {
    setShowAccountModal(false); // Close the profile dropdown
    setSelectedIndexForVoting('CDEX'); // Default to CDEX index
    setShowVotingModal(true);
  };

  const [buttonRef, setButtonRef] = useState<HTMLButtonElement | null>(null);

  return (
    <div className="relative">
      <motion.button
        ref={setButtonRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowAccountModal((prev) => !prev)}
        className="flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-full hover:scale-105 transform transition-all duration-200"
        aria-label={user ? "Account" : "Sign In"}
      >
        <div className="relative w-9 h-9 rounded-full bg-gray-800/50 backdrop-blur-sm flex items-center justify-center transition-all duration-300 hover:bg-gray-700/50 shadow-lg border border-gray-600/50 hover:border-gray-500">
          <FiUser className="w-4 h-4 icon-blue-gradient" />
          {user && (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900"></div>
          )}
        </div>
      </motion.button>

      {showAccountModal && buttonRef && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            ref={modalRef}
            className="fixed w-96 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden z-[9999]"
            style={{
              top: buttonRef.getBoundingClientRect().bottom + 12,
              right: window.innerWidth - buttonRef.getBoundingClientRect().right,
            }}
          >
            {/* Header with gradient background */}
            <div className={`bg-gradient-to-r ${getTierGradient(tier)} p-6 relative overflow-hidden`}>
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-blue-400/20 backdrop-blur-sm flex items-center justify-center">
                      <FiUser className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg">
                        {user ? 'My Profile' : 'Welcome'}
                      </h3>
                      <p className="text-white/80 text-sm capitalize">
                        {tier} • {points !== null ? `${points.toLocaleString()} pts` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full shadow-lg"
                      style={{ backgroundColor: getTierColor(tier) }}
                    ></div>
                  </div>
                </div>

                {/* Progress to next tier */}
                {nextTier && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/90 text-sm font-medium">Progress to {nextTier}</span>
                      <span className="text-white/90 text-sm font-semibold">{progress}%</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="bg-white h-2 rounded-full shadow-sm"
                      ></motion.div>
                    </div>
                    <p className="text-white/70 text-xs mt-2">
                      {pointsToNextTier} points to next tier
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <FiTrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                                         <div>
                       <div className="flex items-center gap-2">
                         <p className="text-gray-400 text-xs">Total Points</p>
                         <button
                           onClick={() => setShowTierModal(true)}
                           className="p-1 hover:bg-blue-500/20 rounded transition-colors"
                           title="View Tier Progression"
                         >
                           <FiInfo className="w-3 h-3 text-blue-400" />
                         </button>
                       </div>
                       <p className="text-white font-semibold text-lg">
                         {points !== null ? points.toLocaleString() : "—"}
                       </p>
                     </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <FiAward className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Badges</p>
                      <p className="text-white font-semibold text-lg">{badges.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Badges Section */}
              {badges.length > 0 && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center space-x-2 mb-3">
                    <HiOutlineSparkles className="w-5 h-5 text-yellow-400" />
                    <h4 className="text-white font-medium">Recent Badges</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {badges.slice(0, 4).map((badge, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="px-3 py-1.5 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30 font-medium"
                      >
                        {badge.replace(/_/g, ' ')}
                      </motion.div>
                    ))}
                    {badges.length > 4 && (
                      <div className="px-3 py-1.5 bg-gray-600/50 text-gray-300 text-xs rounded-full font-medium">
                        +{badges.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Referral Section */}
              {referralCode && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center space-x-2 mb-3">
                    <FiGift className="w-5 h-5 text-green-400" />
                    <h4 className="text-white font-medium">Referral Program</h4>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Your Code</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-mono text-sm bg-gray-700/50 px-2 py-1 rounded">
                          {referralCode}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={copyReferralCode}
                          className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/40 transition-colors"
                        >
                          <FiCopy className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>
                    
                    {copied && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-green-400 text-xs text-center"
                      >
                        Copied to clipboard!
                      </motion.div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="text-center">
                        <p className="text-gray-400 text-xs">Referrals</p>
                        <p className="text-white font-semibold">{referralCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-400 text-xs">Earnings</p>
                        <p className="text-green-400 font-semibold">{referralEarnings} pts</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowPointsHistory(true);
                    setShowAccountModal(false); // Close profile dropdown
                  }}
                  className="flex items-center space-x-3 w-full p-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-xl transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                    <FiClock className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="font-medium">Points History</span>
                </button>

                {isAuthor && (
                  <Link
                    href="/author/dashboard"
                    className="flex items-center space-x-3 w-full p-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-xl transition-all duration-200 group"
                    onClick={() => setShowAccountModal(false)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="font-medium">Author Dashboard</span>
                  </Link>
                )}

                <button
                  onClick={handleVoteAndEarn}
                  className="flex items-center space-x-3 w-full p-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-xl transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                    <FiTrendingUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="font-medium">Vote & Earn</span>
                </button>

                <Link
                  href="/marketplace"
                  className="flex items-center space-x-3 w-full p-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-xl transition-all duration-200 group"
                  onClick={() => setShowAccountModal(false)}
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                    <FaShoppingBag className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="font-medium">Marketplace</span>
                </Link>

                <button
                  onClick={() => setShowAliasModal(true)}
                  className="flex items-center space-x-3 w-full p-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-xl transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                    <FiUser className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="font-medium">Set Alias</span>
                </button>

                <Link
                  href="/account"
                  className="flex items-center space-x-3 w-full p-3 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-xl transition-all duration-200 group"
                  onClick={() => setShowAccountModal(false)}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-500/20 flex items-center justify-center group-hover:bg-gray-500/30 transition-colors">
                    <HiOutlineCog className="w-4 h-4 text-gray-400" />
                  </div>
                  <span className="font-medium">Account Settings</span>
                </Link>
              </div>

              {/* Logout Section */}
              <div className="pt-4 border-t border-gray-700/50">
                {user ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSignOut}
                    className="flex items-center space-x-3 w-full p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-200 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                      <FiLogOut className="w-4 h-4 text-red-400" />
                    </div>
                    <span className="font-medium">Sign Out</span>
                  </motion.button>
                ) : (
                  <Link
                    href="/login"
                    className="flex items-center space-x-3 w-full p-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-all duration-200 group"
                    onClick={() => setShowAccountModal(false)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                      <FiUser className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="font-medium">Sign In</span>
                  </Link>
                )}
              </div>

                             {/* Footer */}
               <div className="text-center pt-4">
                 <p className="text-gray-500 text-xs">Powered by Base</p>
               </div>
             </div>
           </motion.div>
         </AnimatePresence>
               , document.body
        )}
      
      {/* Tier Progression Modal */}
      {showTierModal && createPortal(
        <TierProgressionModal 
          isOpen={showTierModal}
          onClose={() => setShowTierModal(false)}
          currentTier={tier}
          currentPoints={points || 0}
        />
      , document.body
      )}

      {/* Points History Modal */}
      {showPointsHistory && walletAddress && createPortal(
        <PointsHistoryModal
          isOpen={showPointsHistory}
          onClose={() => setShowPointsHistory(false)}
          walletAddress={walletAddress}
        />
      , document.body
      )}

      {/* Alias Modal */}
      {showAliasModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gray-900 rounded-xl p-6 w-96 border border-gray-700"
          >
            <h3 className="text-white text-lg font-semibold mb-4">Set Your Alias</h3>
            <p className="text-gray-400 text-sm mb-4">
              Choose a display name that will appear on leaderboards and in the community.
            </p>
            
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Display Name (Alias)
              </label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Enter your preferred display name"
                maxLength={20}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAliasModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateAlias}
                disabled={!alias.trim() || isUpdatingAlias}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUpdatingAlias ? 'Updating...' : 'Update Alias'}
              </button>
            </div>
          </motion.div>
        </div>
      , document.body
      )}
    </div>
  );
};

export default UserProfileDropdown;