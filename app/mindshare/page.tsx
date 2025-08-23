"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { fetchLeaderboard } from "@/lib/news-api";

interface MindshareUser {
  walletAddress: string;
  points: number;
  rank: number;
  lastUpdated?: string;
  createdAt?: string;
  alias?: string;
  avatar?: string;
  contributions?: number;
  articles?: number;
  followers?: number;
}

// Mindshare user card component
const MindshareUserCard = ({ user, index, totalPoints }: { user: MindshareUser, index: number, totalPoints: number }) => {
  const router = useRouter();
  // Generate random daily change for demo (in real app, this would come from API)
  const dailyChange = Math.random() > 0.5 ? Math.random() * 10 : -Math.random() * 10;
  const isPositive = dailyChange > 0;
  // Calculate mindshare percentage to add up to 100% total
  const mindsharePercentage = ((user.points / totalPoints) * 100).toFixed(2);

  const handleCardClick = () => {
    // Navigate to user profile or wallet explorer
    router.push(`/explorer/address/${user.walletAddress}`);
  };

  return (
    <motion.div
      className={`relative p-4 rounded-lg border transition-all duration-200 hover:scale-105 cursor-pointer ${
        isPositive 
          ? 'bg-green-900/30 border-green-500/30 hover:bg-green-900/40' 
          : 'bg-red-900/30 border-red-500/30 hover:bg-red-900/40'
      }`}
      whileHover={{ scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onClick={handleCardClick}
    >
      {/* Rank Badge */}
      <div className="absolute top-2 right-2">
        {index === 0 && <span className="text-yellow-400 text-lg">👑</span>}
        {index === 1 && <span className="text-gray-400 text-lg">🥈</span>}
        {index === 2 && <span className="text-orange-400 text-lg">🥉</span>}
      </div>
      
      {/* User Info */}
      <div className="mb-2">
        <div className="text-white font-bold text-lg">
          {user.alias || `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`}
        </div>
      </div>
      
      {/* Mindshare Percentage */}
      <div className="text-2xl font-bold text-white mb-2">
        {mindsharePercentage}%
      </div>
      
      {/* Daily Change */}
      <div className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{dailyChange.toFixed(2)}%
      </div>
      
      {/* Mini Sparkline */}
      <div className="mt-3 h-8 bg-gray-800/50 rounded overflow-hidden">
        <svg width="100%" height="100%" viewBox="0 0 100 32" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke={isPositive ? "#10B981" : "#EF4444"}
            strokeWidth="2"
            points={Array.from({ length: 10 }, (_, i) => {
              const x = (i / 9) * 100;
              const baseY = 16;
              const variance = Math.sin(i * 0.8) * 8;
              const trend = isPositive ? -i * 0.5 : i * 0.5;
              const y = baseY + variance + trend;
              return `${x},${y}`;
            }).join(' ')}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </motion.div>
  );
};

export default function MindsharePage() {
  const [mindshareUsers, setMindshareUsers] = useState<MindshareUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTimeframe, setActiveTimeframe] = useState('24H');

  useEffect(() => {
    async function fetchMindshareData() {
      try {
        setLoading(true);
        const response = await fetchLeaderboard(50); // Fetch top 50 users
        const users = response.leaderboard || [];
        
        // Transform leaderboard data into mindshare format
        const mindshareData: MindshareUser[] = users.map((user: any, index: number) => ({
          walletAddress: user.walletAddress,
          points: user.points,
          rank: user.rank || index + 1,
          lastUpdated: user.lastUpdated,
          createdAt: user.createdAt,
          alias: user.alias,
          avatar: user.avatar,
          contributions: Math.floor(user.points / 100), // Estimate contributions based on points
          articles: Math.floor(user.points / 200), // Estimate articles based on points
          followers: Math.floor(user.points / 50), // Estimate followers based on points
        }));

        setMindshareUsers(mindshareData);
        setError(null);
      } catch (err) {
        console.error('Error fetching mindshare data:', err);
        setError('Failed to load mindshare data');
      } finally {
        setLoading(false);
      }
    }

    fetchMindshareData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        <Header />
        <div className="border-b border-gray-800/50"></div>
        <main className="container mx-auto px-4 py-8 flex-1">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <span className="text-gray-400 text-sm ml-2">Loading mindshare data...</span>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        <Header />
        <div className="border-b border-gray-800/50"></div>
        <main className="container mx-auto px-4 py-8 flex-1">
          <div className="text-center">
            <p className="text-red-400">{error}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Header />
      
      {/* Separator line */}
      <div className="border-b border-gray-800/50"></div>

      <main className="container mx-auto px-4 py-8 flex-1">
        {/* Page Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center">
            <div className="w-1 h-8 bg-blue-500 rounded-full mr-4"></div>
            <h1 className="text-3xl font-bold text-white">
              User Mindshare
            </h1>
          </div>
        </motion.div>

        {/* Header with Navigation and Time Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          {/* Navigation Tabs */}
          <div className="flex bg-gray-800/50 rounded-lg p-1">
            <button className="px-4 py-2 text-sm font-medium rounded-md bg-purple-500/20 text-purple-300">
              Top20
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-md text-gray-400 hover:text-gray-300">
              Top21-Top50
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-md text-gray-400 hover:text-gray-300">
              Top51-Top100
            </button>
          </div>
          
          {/* Time Filters */}
          <div className="flex bg-gray-800/50 rounded-lg p-1">
            {['24H', '48H', '7D', '30D', '3M', '6M', '12M'].map((period) => (
              <button
                key={period}
                onClick={() => setActiveTimeframe(period)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  period === activeTimeframe
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {mindshareUsers.slice(0, 20).map((user, index) => {
            const totalPoints = mindshareUsers.reduce((sum, u) => sum + u.points, 0);
            return (
              <MindshareUserCard 
                key={user.walletAddress} 
                user={user} 
                index={index} 
                totalPoints={totalPoints}
              />
            );
          })}
        </div>

        {/* Footer Summary */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <div className="flex justify-center">
            <button className="px-6 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors text-sm font-medium">
              Others
            </button>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
