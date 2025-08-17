"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCheck, FiLock, FiStar, FiTrendingUp, FiAward, FiZap, FiUsers, FiGift, FiShield, FiDollarSign } from "react-icons/fi";
import { FaDiscord, FaCrown } from "react-icons/fa";

interface TierProgressionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: string;
  currentPoints: number;
}

const TierProgressionModal: React.FC<TierProgressionModalProps> = ({
  isOpen,
  onClose,
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

  const getCurrentTierIndex = () => {
    return tiers.findIndex(tier => tier.id === currentTier);
  };

  const getProgressToNextTier = () => {
    const currentTierData = tiers.find(tier => tier.id === currentTier);
    if (!currentTierData || currentTierData.id === 'titan') return 100;
    
    const nextTier = tiers[tiers.indexOf(currentTierData) + 1];
    if (!nextTier) return 100;
    
    const pointsInCurrentTier = currentPoints - currentTierData.minPoints;
    const pointsNeededForNextTier = nextTier.minPoints - currentTierData.minPoints;
    return Math.min(100, (pointsInCurrentTier / pointsNeededForNextTier) * 100);
  };

  const isTierUnlocked = (tierIndex: number) => {
    return currentPoints >= tiers[tierIndex].minPoints;
  };

  const isCurrentTier = (tierId: string) => {
    return tierId === currentTier;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm z-[9999]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900/95 backdrop-blur-sm rounded-2xl border border-gray-700 max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <FiStar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Tier Progression Path</h2>
                  <p className="text-gray-400 text-sm">Your journey to legendary status</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
              >
                <FiX className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] scrollbar-hide">
              {/* Current Status */}
              <div className="mb-8 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-500/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className={`relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${
                        tiers.find(t => t.id === currentTier)?.gradient && currentTier !== 'normie'
                          ? `bg-gradient-to-br ${tiers.find(t => t.id === currentTier)?.gradient} animate-pulse`
                          : ''
                      }`}
                      style={{ 
                        backgroundColor: tiers.find(t => t.id === currentTier)?.gradient ? undefined : tiers.find(t => t.id === currentTier)?.color
                      }}
                    >
                      {/* Shine Animation for Current Tier */}
                      {tiers.find(t => t.id === currentTier)?.gradient && currentTier !== 'normie' && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                          animate={{
                            x: ['-100%', '200%']
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            repeatDelay: 2,
                            ease: "easeInOut"
                          }}
                        />
                      )}
                      {tiers.find(t => t.id === currentTier)?.icon && React.createElement(tiers.find(t => t.id === currentTier)!.icon, { className: "w-6 h-6 text-white relative z-10" })}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white capitalize">
                        {currentTier} Status
                      </h3>
                      <p className="text-gray-400">
                        {currentPoints.toLocaleString()} / {tiers.find(t => t.id === currentTier)?.maxPoints.toLocaleString()} points
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{currentPoints.toLocaleString()}</div>
                    <div className="text-gray-400 text-sm">Total Points</div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Progress to next tier</span>
                    <span>{getProgressToNextTier().toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getProgressToNextTier()}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Tier Progression Path */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white mb-4">Your Progression Path</h3>
                
                {tiers.map((tier, index) => {
                  const isUnlocked = isTierUnlocked(index);
                  const isCurrent = isCurrentTier(tier.id);
                  const isCompleted = index < getCurrentTierIndex();
                  const IconComponent = tier.icon;
                  
                  return (
                    <motion.div
                      key={tier.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative p-6 rounded-xl border transition-all duration-300 ${
                        isCurrent
                          ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/50'
                          : isUnlocked
                          ? 'bg-green-900/20 border-green-500/30'
                          : 'bg-gray-800/50 border-gray-600'
                      }`}
                    >
                      {/* Connection Line */}
                      {index < tiers.length - 1 && (
                        <div className="absolute left-8 top-16 w-0.5 h-8 bg-gray-600"></div>
                      )}
                      
                      <div className="flex items-start gap-4">
                        {/* Tier Icon with Circle */}
                        <div className="relative">
                          {/* Outer Circle */}
                          <div className={`absolute inset-0 rounded-full ${
                            isCurrent ? 'ring-4 ring-blue-500/50 animate-pulse' : ''
                          } ${
                            isUnlocked && tier.id !== 'normie' ? 'ring-2 ring-white/20' : ''
                          }`}></div>
                          
                          {/* Shiny Animated Circle */}
                          {isUnlocked && tier.id !== 'normie' && (
                            <motion.div
                              animate={{ 
                                rotate: 360,
                                scale: [1, 1.05, 1]
                              }}
                              transition={{ 
                                rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                              }}
                              className={`absolute inset-0 rounded-full bg-gradient-to-br ${tier.shinyGradient} opacity-30 blur-sm`}
                            />
                          )}
                          
                          {/* Main Icon Circle */}
                          <div 
                            className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden ${
                              tier.gradient && isUnlocked 
                                ? `bg-gradient-to-br ${tier.gradient}` 
                                : ''
                            } ${
                              isUnlocked && tier.id !== 'normie' ? 'animate-pulse' : ''
                            }`}
                            style={{ 
                              backgroundColor: tier.gradient && isUnlocked ? undefined : tier.color,
                              opacity: isUnlocked ? 1 : 0.6
                            }}
                          >
                            {/* Shine Animation */}
                            {isUnlocked && tier.id !== 'normie' && (
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                animate={{
                                  x: ['-100%', '200%']
                                }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  repeatDelay: 3,
                                  ease: "easeInOut"
                                }}
                              />
                            )}
                            <IconComponent className="w-8 h-8 text-white relative z-10" />
                          </div>
                          
                          {/* Inner Glow Circle */}
                          {isUnlocked && tier.id !== 'normie' && (
                            <motion.div
                              animate={{ 
                                scale: [1, 1.1, 1],
                                opacity: [0.5, 0.8, 0.5]
                              }}
                              transition={{ 
                                duration: 2, 
                                repeat: Infinity, 
                                ease: "easeInOut" 
                              }}
                              className={`absolute inset-2 rounded-full bg-gradient-to-br ${tier.shinyGradient} opacity-20`}
                            />
                          )}
                          
                          {/* Status Indicator */}
                          <div className="absolute -top-1 -right-1">
                            {isCompleted ? (
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <FiCheck className="w-3 h-3 text-white" />
                              </div>
                            ) : isCurrent ? (
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                <FiTrendingUp className="w-3 h-3 text-white" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                                <FiLock className="w-3 h-3 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tier Content */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className={`text-lg font-bold capitalize ${
                                isCurrent ? 'text-blue-400' : isUnlocked ? 'text-green-400' : 'text-gray-400'
                              }`}>
                                {tier.name} Tier
                              </h4>
                              <p className="text-sm text-gray-500">{tier.description}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-300">
                                {tier.minPoints.toLocaleString()} - {tier.maxPoints === Infinity ? '∞' : tier.maxPoints.toLocaleString()} pts
                              </div>
                              {isCurrent && (
                                <div className="text-xs text-blue-400">Current</div>
                              )}
                              {isCompleted && (
                                <div className="text-xs text-green-400">Completed</div>
                              )}
                            </div>
                          </div>

                          {/* Key Benefits */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            {/* Discord Role */}
                            <div className="flex flex-col items-center gap-2 p-2 bg-gray-800/50 rounded-lg">
                              <div className="text-xs text-gray-400">Discord Role</div>
                              <div className="flex items-center gap-2">
                                <FaDiscord className="w-4 h-4 text-[#5865F2]" />
                                <span className="text-sm font-medium text-white">{tier.discordRole}</span>
                              </div>
                            </div>

                            {/* Swap Fee */}
                            <div className="flex flex-col items-center gap-2 p-2 bg-gray-800/50 rounded-lg">
                              <div className="text-xs text-gray-400">Swap Fee</div>
                              <div className="flex items-center gap-2">
                                <FiDollarSign className="w-4 h-4 text-green-400" />
                                <span className="text-sm font-medium text-white">{tier.swapFee}</span>
                              </div>
                            </div>

                            {/* Airdrop Allocation */}
                            {tier.airdropAllocation && (
                              <div className="flex flex-col items-center gap-2 p-2 bg-gray-800/50 rounded-lg">
                                <div className="text-xs text-gray-400">Airdrop Allocation</div>
                                <div className="flex items-center gap-2">
                                  <FiGift className="w-4 h-4 text-purple-400" />
                                  <span className="text-sm font-medium text-white">{tier.airdropAllocation}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* All Benefits */}
                          <div className="mt-4">
                            <h5 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                              <FiAward className="w-4 h-4" />
                              All Benefits
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {tier.benefits.map((benefit, benefitIndex) => (
                                <div key={benefitIndex} className="flex items-center gap-2 text-sm">
                                  <div className={`w-2 h-2 rounded-full ${
                                    isUnlocked ? 'bg-green-400' : 'bg-gray-600'
                                  }`} />
                                  <span className={isUnlocked ? 'text-gray-300' : 'text-gray-500'}>
                                    {benefit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Progress to this tier */}
                          {!isUnlocked && index > getCurrentTierIndex() && (
                            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                              <div className="flex justify-between text-sm text-gray-400 mb-1">
                                <span>Progress to {tier.name}</span>
                                <span>{Math.max(0, ((currentPoints - tiers[index - 1]?.minPoints || 0) / (tier.minPoints - (tiers[index - 1]?.minPoints || 0))) * 100).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${Math.max(0, ((currentPoints - (tiers[index - 1]?.minPoints || 0)) / (tier.minPoints - (tiers[index - 1]?.minPoints || 0))) * 100)}%` 
                                  }}
                                />
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {tier.minPoints - currentPoints} points needed
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Quick Stats */}
              <div className="mt-8 p-6 bg-gray-800/50 rounded-xl border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FiZap className="w-5 h-5 text-yellow-400" />
                  Progression Stats
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {tiers.filter((_, index) => isTierUnlocked(index)).length}
                    </div>
                    <div className="text-gray-400 text-sm">Tiers Unlocked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {tiers.length - getCurrentTierIndex() - 1}
                    </div>
                    <div className="text-gray-400 text-sm">Tiers Remaining</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {tiers.length}
                    </div>
                    <div className="text-gray-400 text-sm">Total Tiers</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TierProgressionModal;
