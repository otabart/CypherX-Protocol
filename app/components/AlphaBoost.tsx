"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, useWalletSystem } from '@/app/providers';
import { BoltIcon, FireIcon, StarIcon } from '@heroicons/react/24/outline';
import PointTransactionModal from './PointTransactionModal';

interface AlphaBoostProps {
  articleId: string;
  articleSlug: string;
  onBoostApplied?: () => void;
  className?: string;
}

interface AlphaBoostInfo {
  activeAlphaBoosts: any[];
  canBoost: boolean;
  userBoostInfo: {
    hasBoostedToday: boolean;
    totalAlphaBoosts: number;
    maxDailyAlphaBoosts: number;
    hasEnoughPoints: boolean;
    currentPoints: number;
    tier: string;
    multiplier: number;
  } | null;
}

export default function AlphaBoost({ articleId, articleSlug, onBoostApplied, className = "" }: AlphaBoostProps) {
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
  const walletAddress = selfCustodialWallet?.address;
  const [boostInfo, setBoostInfo] = useState<AlphaBoostInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  useEffect(() => {
    if (user && articleId) {
      fetchAlphaBoostInfo();
    }
  }, [user, articleId]);

  const fetchAlphaBoostInfo = async () => {
    try {
      const response = await fetch(`/api/points/alpha-boost?articleId=${articleId}&userId=${user?.uid}`);
      if (response.ok) {
        const data = await response.json();
        setBoostInfo(data);
      }
    } catch (error) {
      console.error('Error fetching alpha boost info:', error);
    }
  };

  const handleAlphaBoost = () => {
    if (!user || !walletAddress || !boostInfo?.canBoost) return;
    setShowTransactionModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (!user || !walletAddress || !boostInfo?.canBoost) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/points/alpha-boost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          walletAddress,
          articleId,
          articleSlug,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh boost info
        await fetchAlphaBoostInfo();
        onBoostApplied?.();
        
        // Show success feedback
        console.log('Alpha boost applied successfully!', data);
      } else {
        console.error('Error applying alpha boost:', data.error);
      }
    } catch (error) {
      console.error('Error applying alpha boost:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || !boostInfo) {
    return null;
  }

  const { canBoost, userBoostInfo, activeAlphaBoosts } = boostInfo;
  const hasActiveBoost = activeAlphaBoosts.length > 0;
  const activeBoost = activeAlphaBoosts[0];

  return (
    <div className={`relative ${className}`}>
      {/* Transaction Modal */}
      <PointTransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onConfirm={handleConfirmTransaction}
        transaction={{
          action: 'alpha_boost',
          points: 25,
          description: `Apply Alpha Boost to article (${userBoostInfo?.multiplier || 1.5}x multiplier)`,
          metadata: {
            articleId,
            articleSlug,
            multiplier: userBoostInfo?.multiplier || 1.5
          }
        }}
        userPoints={userBoostInfo?.currentPoints || 0}
        walletAddress={walletAddress}
      />
      {/* Active Alpha Boost Indicator */}
      {hasActiveBoost && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-lg px-3 py-2"
        >
          <FireIcon className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-orange-300">
            Alpha Boost Active ({activeBoost.multiplier}x)
          </span>
          <div className="flex items-center gap-1">
            <StarIcon className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-yellow-300">
              {Math.floor((new Date(activeBoost.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60))}h left
            </span>
          </div>
        </motion.div>
      )}

      {/* Alpha Boost Button */}
      {!hasActiveBoost && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAlphaBoost}
          disabled={!canBoost || isLoading}
          className={`relative group flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            canBoost
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl'
              : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
          }`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <BoltIcon className="w-4 h-4" />
          <span>Alpha Boost</span>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          
          {/* Cost Badge */}
          <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
            25
          </div>
        </motion.button>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && userBoostInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl z-50"
          >
            <div className="text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Your Tier:</span>
                <span className="text-blue-400 font-medium capitalize">{userBoostInfo.tier}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Multiplier:</span>
                <span className="text-green-400 font-medium">{userBoostInfo.multiplier}x</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Your Points:</span>
                <span className={`font-medium ${userBoostInfo.hasEnoughPoints ? 'text-green-400' : 'text-red-400'}`}>
                  {userBoostInfo.currentPoints}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Daily Boosts:</span>
                <span className="text-yellow-400 font-medium">
                  {userBoostInfo.totalAlphaBoosts}/{userBoostInfo.maxDailyAlphaBoosts}
                </span>
              </div>
              
              {!userBoostInfo.hasEnoughPoints && (
                <div className="text-red-400 text-xs mt-2">
                  Need {25 - userBoostInfo.currentPoints} more points
                </div>
              )}
              
              {userBoostInfo.hasBoostedToday && (
                <div className="text-orange-400 text-xs mt-2">
                  Already boosted this article today
                </div>
              )}
              
              <div className="text-gray-400 text-xs mt-2">
                Alpha Boost increases trending score by {userBoostInfo.multiplier}x for 24 hours
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
