"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, type Auth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth as firebaseAuth, db } from "@/lib/firebase";
import { useAuth } from "@/app/providers";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { FiAward, FiTrendingUp } from "react-icons/fi";
import CustomConnectWallet from "./CustomConnectWallet";
import Link from "next/link";
import { useAccount } from "wagmi";

const auth: Auth = firebaseAuth as Auth;

const UserProfileDropdown: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { address: walletAddress } = useAccount();
  const [showAccountModal, setShowAccountModal] = useState(false);
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
          className="absolute right-0 mt-3 w-80 bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 ease-out"
          style={{
            opacity: showAccountModal ? 1 : 0,
            transform: showAccountModal ? "translateY(0)" : "translateY(-10px)",
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <CustomConnectWallet />
            </div>
            
            {/* Enhanced Profile Section */}
            <div className="bg-gray-800 p-4 rounded-lg border border-blue-500/50">
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
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
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
                   {referralCode && (
                     <button
                       onClick={() => navigator.clipboard.writeText(referralCode)}
                       className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded hover:bg-blue-500/40 transition-colors duration-150"
                     >
                       Copy
                     </button>
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
  );
};

export default UserProfileDropdown;