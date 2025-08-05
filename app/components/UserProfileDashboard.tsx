"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiAward,
  FiTrendingUp,
  FiActivity,
  FiStar,
  FiUser,
  FiCalendar,
  FiFileText,
  FiZap,
  FiBarChart,
  FiCheckCircle,
} from "react-icons/fi";
import { useAuth } from "@/app/providers";
import { useAccount } from "wagmi";

interface UserStats {
  tier: string;
  points: number;
  badges: string[];
  progress: number;
  nextTier: string | null;
  pointsToNextTier: number;
  tierSystem: any;
  badgeSystem: any;
  currentTierBenefits: string[];
}

interface Activity {
  id: string;
  action: string;
  points: number;
  metadata: any;
  createdAt: string;
}

export default function UserProfileDashboard() {
  const { user } = useAuth();
  const { address: walletAddress } = useAccount();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'badges' | 'tiers'>('overview');

  useEffect(() => {
    if (user && walletAddress) {
      fetchUserData();
    }
  }, [user, walletAddress]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Fetch user stats
      const statsResponse = await fetch(`/api/tiers?walletAddress=${walletAddress}`);
      const statsData = await statsResponse.json();
      setUserStats(statsData);

      // Fetch recent activities
      const activitiesResponse = await fetch(`/api/user-activities?walletAddress=${walletAddress}&limit=10`);
      const activitiesData = await activitiesResponse.json();
      setRecentActivities(activitiesData.activities || []);

    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
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

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getActionIcon = (action: string) => {
    if (action.includes('swap')) return <FiZap className="w-4 h-4" />;
    if (action.includes('article')) return <FiFileText className="w-4 h-4" />;
    if (action.includes('event')) return <FiCalendar className="w-4 h-4" />;
    if (action.includes('badge')) return <FiAward className="w-4 h-4" />;
    return <FiActivity className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-400">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!userStats) {
    return (
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
        <div className="text-center py-8">
          <FiUser className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Connect your wallet to view your profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: getTierColor(userStats.tier) }}
            >
              <FiUser className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {userStats.tier.charAt(0).toUpperCase() + userStats.tier.slice(1)} Member
              </h2>
              <p className="text-gray-400">
                {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{userStats.points.toLocaleString()}</div>
            <div className="text-gray-400">Total Points</div>
          </div>
        </div>

        {/* Progress Bar */}
        {userStats.nextTier && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Progress to {userStats.nextTier}</span>
              <span>{userStats.progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${userStats.progress}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {userStats.pointsToNextTier} points to next tier
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-800/30 rounded-lg p-1">
        {[
          { id: 'overview', label: 'Overview', icon: FiBarChart },
          { id: 'activities', label: 'Activities', icon: FiActivity },
          { id: 'badges', label: 'Badges', icon: FiAward },
          { id: 'tiers', label: 'Tiers', icon: FiAward },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Current Tier Benefits */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FiStar className="w-5 h-5 text-yellow-400" />
                  Current Benefits
                </h3>
                <ul className="space-y-2">
                  {userStats.currentTierBenefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-2 text-gray-300">
                      <FiCheckCircle className="w-4 h-4 text-green-400" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Quick Stats */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FiTrendingUp className="w-5 h-5 text-blue-400" />
                  Quick Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Badges Earned</span>
                    <span className="text-white font-medium">{userStats.badges.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current Tier</span>
                    <span className="text-white font-medium capitalize">{userStats.tier}</span>
                  </div>
                  {userStats.nextTier && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Next Tier</span>
                      <span className="text-white font-medium capitalize">{userStats.nextTier}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activities' && (
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FiActivity className="w-5 h-5 text-green-400" />
                Recent Activities
              </h3>
              <div className="space-y-3">
                {recentActivities.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No recent activities</p>
                ) : (
                  recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getActionIcon(activity.action)}
                        <div>
                          <p className="text-white font-medium">{formatAction(activity.action)}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-medium">+{activity.points}</p>
                        <p className="text-xs text-gray-400">points</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'badges' && (
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FiAward className="w-5 h-5 text-yellow-400" />
                Badges
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(userStats.badgeSystem).map(([badgeId, badgeData]: [string, any]) => {
                  const isEarned = userStats.badges.includes(badgeId);
                  return (
                    <div
                      key={badgeId}
                      className={`p-4 rounded-lg border transition-all ${
                        isEarned
                          ? 'bg-yellow-900/20 border-yellow-500/30'
                          : 'bg-gray-700/50 border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isEarned ? 'bg-yellow-500' : 'bg-gray-600'
                        }`}>
                          {isEarned ? (
                            <FiCheckCircle className="w-5 h-5 text-white" />
                          ) : (
                            <FiAward className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-medium ${isEarned ? 'text-white' : 'text-gray-400'}`}>
                            {badgeData.name}
                          </h4>
                          <p className="text-sm text-gray-500">{badgeData.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {badgeData.points} points
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'tiers' && (
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                               <FiAward className="w-5 h-5 text-yellow-400" />
               Tier System
              </h3>
              <div className="space-y-4">
                {Object.entries(userStats.tierSystem).map(([tier, tierData]: [string, any]) => {
                  const isCurrentTier = userStats.tier === tier;
                  const isUnlocked = userStats.points >= tierData.minPoints;
                  
                  return (
                    <div
                      key={tier}
                      className={`p-4 rounded-lg border transition-all ${
                        isCurrentTier
                          ? 'bg-blue-900/20 border-blue-500/30'
                          : isUnlocked
                          ? 'bg-green-900/20 border-green-500/30'
                          : 'bg-gray-700/50 border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: tierData.color }}
                          >
                            <FiAward className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className={`font-medium capitalize ${
                              isCurrentTier ? 'text-blue-400' : isUnlocked ? 'text-green-400' : 'text-gray-400'
                            }`}>
                              {tier} Tier
                            </h4>
                            <p className="text-sm text-gray-500">
                              {tierData.minPoints.toLocaleString()} points required
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {isCurrentTier && (
                            <span className="text-blue-400 text-sm font-medium">Current</span>
                          )}
                          {isUnlocked && !isCurrentTier && (
                            <span className="text-green-400 text-sm font-medium">Unlocked</span>
                          )}
                          {!isUnlocked && (
                            <span className="text-gray-500 text-sm">Locked</span>
                          )}
                        </div>
                      </div>
                      
                      {isCurrentTier && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <h5 className="text-sm font-medium text-white mb-2">Current Benefits:</h5>
                          <ul className="space-y-1">
                            {tierData.benefits.map((benefit: string, index: number) => (
                              <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                                <FiCheckCircle className="w-3 h-3 text-green-400" />
                                {benefit}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
} 