"use client";

import React from "react";
import { motion } from "framer-motion";
import { FiUsers, FiTrendingUp, FiShield, FiStar, FiAward, FiDollarSign, FiGift } from "react-icons/fi";
import { FaDiscord, FaCrown } from "react-icons/fa";

interface TierDisplayProps {
  currentTier: string;
  currentPoints: number;
}

const TierDisplay: React.FC<TierDisplayProps> = ({
  currentTier,
  currentPoints
}) => {
  const tiers = [
    {
      id: 'normie',
      name: 'Normie',
      icon: FiUsers,
      color: '#6B7280',
      minPoints: 0,
      maxPoints: 1999,
      description: 'Just getting started in crypto',
      discordRole: 'Normie',
      swapFee: '0.06%',
      benefits: [
        'Basic access to all features',
        'Standard support',
        'Community access',
        'Basic trading tools',
        'Profile customization',
        'Basic notifications',
        'Discord: Normie role'
      ]
    },
    {
      id: 'degen',
      name: 'Degen',
      icon: FiTrendingUp,
      color: '#CD7F32', // Bronze
      gradient: 'from-amber-600 via-orange-500 to-yellow-600',
      shinyGradient: 'from-amber-400 via-orange-300 to-yellow-400',
      minPoints: 2000,
      maxPoints: 7999,
      description: 'Degenerate trader, living on the edge',
      discordRole: 'Degen',
      swapFee: '0.05%',
      airdropAllocation: '1x',
      benefits: [
        'All Normie benefits',
        'Priority support',
        'Early access to new features',
        'Custom profile badge',
        'Discord: Degen role',
        'Reduced swap fees (0.05%)',
        'Airdrop eligibility (1x allocation)',
        'Exclusive Discord channels',
        'Advanced trading tools'
      ]
    },
    {
      id: 'alpha',
      name: 'Alpha',
      icon: FiShield,
      color: '#C0C0C0', // Silver
      gradient: 'from-gray-300 via-gray-400 to-gray-500',
      shinyGradient: 'from-gray-200 via-gray-300 to-gray-400',
      minPoints: 8000,
      maxPoints: 19999,
      description: 'Got the alpha, making moves',
      discordRole: 'Alpha',
      swapFee: '0.04%',
      airdropAllocation: '2x',
      benefits: [
        'All Degen benefits',
        'Exclusive content access',
        'VIP community access',
        'Governance voting rights',
        'Whitelist priority',
        'Discord: Alpha role + Alpha chat access',
        'Premium swap fees (0.04%)',
        'Airdrop eligibility (2x allocation)',
        'Premium trading features',
        'Custom NFT rewards',
        'Direct team access',
        'Revenue sharing opportunities'
      ]
    },
    {
      id: 'mogul',
      name: 'Mogul',
      icon: FaCrown,
      color: '#FFD700', // Gold
      gradient: 'from-yellow-400 via-yellow-500 to-yellow-600',
      shinyGradient: 'from-yellow-300 via-yellow-400 to-yellow-500',
      minPoints: 20000,
      maxPoints: 49999,
      description: 'Crypto mogul, building empire',
      discordRole: 'Mogul',
      swapFee: '0.03%',
      airdropAllocation: '3x',
      benefits: [
        'All Alpha benefits',
        'Exclusive events access',
        'Custom NFT rewards',
        'Direct team access',
        'Discord: Mogul role + exclusive channels',
        'Elite swap fees (0.03%)',
        'Airdrop eligibility (3x allocation)',
        'Early access to new tools',
        'Revenue sharing opportunities',
        'Platform partnership opportunities',
        'VIP customer service',
        'Custom platform features',
        'Immortal status in community'
      ]
    },
    {
      id: 'titan',
      name: 'Titan',
      icon: FiStar,
      color: '#8B5CF6', // Purple
      gradient: 'from-purple-400 via-purple-500 to-purple-600',
      shinyGradient: 'from-purple-300 via-purple-400 to-purple-500',
      minPoints: 50000,
      maxPoints: Infinity,
      description: 'Crypto titan, legendary status',
      discordRole: 'Titan',
      swapFee: '0.02%',
      airdropAllocation: '5x',
      benefits: [
        'ALL PREVIOUS BENEFITS',
        'Legendary status',
        'Discord: Titan role + all channels',
        'Legendary swap fees (0.02%)',
        'Airdrop eligibility (5x allocation)',
        'Platform partnership opportunities',
        'Immortal status in community',
        'Custom platform features',
        'Exclusive Titan-only events',
        'Direct CEO access',
        'Revenue sharing at highest tier',
        'Platform governance rights',
        'Custom integrations',
        'Priority tool access'
      ]
    }
  ];

  const getCurrentTierData = () => {
    return tiers.find(tier => tier.id === currentTier) || tiers[0];
  };

  const getNextTierData = () => {
    const currentIndex = tiers.findIndex(tier => tier.id === currentTier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  };

  const calculateProgress = () => {
    const currentTierData = getCurrentTierData();
    const nextTierData = getNextTierData();
    
    if (!nextTierData) return 100;
    
    const pointsInCurrentTier = currentPoints - currentTierData.minPoints;
    const pointsNeededForNextTier = nextTierData.minPoints - currentTierData.minPoints;
    return Math.min(100, (pointsInCurrentTier / pointsNeededForNextTier) * 100);
  };

  const currentTierData = getCurrentTierData();
  const nextTierData = getNextTierData();
  const progress = calculateProgress();
  const IconComponent = currentTierData.icon;

  return (
    <div className="space-y-6">
      {/* Current Tier Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-500/30"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div 
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                currentTierData.gradient && currentTierData.id !== 'normie'
                  ? `bg-gradient-to-br ${currentTierData.gradient} animate-pulse`
                  : ''
              }`}
              style={{ 
                backgroundColor: currentTierData.gradient ? undefined : currentTierData.color
              }}
            >
              <IconComponent className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white capitalize">
                {currentTierData.name} Tier
              </h3>
              <p className="text-gray-400">{currentTierData.description}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{currentPoints.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">Total Points</div>
          </div>
        </div>

        {/* Key Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Discord Role */}
          <div className="flex flex-col items-center gap-2 p-3 bg-gray-800/50 rounded-lg">
            <div className="text-xs text-gray-400">Discord Role</div>
            <div className="flex items-center gap-2">
              <FaDiscord className="w-5 h-5 text-[#5865F2]" />
              <span className="text-sm font-medium text-white">{currentTierData.discordRole}</span>
            </div>
          </div>

          {/* Swap Fee */}
          <div className="flex flex-col items-center gap-2 p-3 bg-gray-800/50 rounded-lg">
            <div className="text-xs text-gray-400">Swap Fee</div>
            <div className="flex items-center gap-2">
              <FiDollarSign className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium text-white">{currentTierData.swapFee}</span>
            </div>
          </div>

          {/* Airdrop Allocation */}
          {currentTierData.airdropAllocation && (
            <div className="flex flex-col items-center gap-2 p-3 bg-gray-800/50 rounded-lg">
              <div className="text-xs text-gray-400">Airdrop Allocation</div>
              <div className="flex items-center gap-2">
                <FiGift className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium text-white">{currentTierData.airdropAllocation}</span>
              </div>
            </div>
          )}
        </div>

        {/* Progress to Next Tier */}
        {nextTierData && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Progress to {nextTierData.name}</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full"
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {nextTierData.minPoints - currentPoints} points to {nextTierData.name}
            </div>
          </div>
        )}
      </motion.div>

      {/* All Tiers Overview */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-white flex items-center gap-2">
          <FiAward className="w-5 h-5 text-yellow-400" />
          All Tiers Overview
        </h4>
        
        {tiers.map((tier, index) => {
          const isUnlocked = currentPoints >= tier.minPoints;
          const isCurrent = tier.id === currentTier;
          const TierIcon = tier.icon;
          
          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border transition-all duration-300 ${
                isCurrent
                  ? 'bg-blue-900/20 border-blue-500/50'
                  : isUnlocked
                  ? 'bg-green-900/20 border-green-500/30'
                  : 'bg-gray-800/50 border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCurrent ? 'ring-2 ring-blue-500' : ''
                    } ${
                      tier.gradient && isUnlocked 
                        ? `bg-gradient-to-br ${tier.gradient} animate-pulse` 
                        : ''
                    }`}
                    style={{ 
                      backgroundColor: tier.gradient ? undefined : tier.color,
                      opacity: isUnlocked ? 1 : 0.5
                    }}
                  >
                    <TierIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h5 className={`font-medium capitalize ${
                      isCurrent ? 'text-blue-400' : isUnlocked ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      {tier.name}
                    </h5>
                    <p className="text-xs text-gray-500">{tier.minPoints.toLocaleString()} - {tier.maxPoints === Infinity ? '∞' : tier.maxPoints.toLocaleString()} pts</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-300">{tier.discordRole}</div>
                  <div className="text-xs text-green-400">{tier.swapFee}</div>
                  {isCurrent && (
                    <div className="text-xs text-blue-400">Current</div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default TierDisplay;
