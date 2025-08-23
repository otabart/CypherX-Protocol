"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

interface Author {
  id: string;
  walletAddress: string;
  twitterHandle?: string;
  alias?: string;
  bio?: string;
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalEarnings: number;
  monthlyViews: number;
  monthlyLikes: number;
  monthlyComments: number;
  monthlyEarnings: number;
  engagementRate: number;
}

// Author card component
const AuthorCard = ({ author, index, totalViews }: { author: Author, index: number, totalViews: number }) => {
  // Generate random daily change for demo (in real app, this would come from API)
  const dailyChange = Math.random() > 0.5 ? Math.random() * 15 : -Math.random() * 15;
  const isPositive = dailyChange > 0;
  // Calculate mindshare percentage to add up to 100% total
  const mindsharePercentage = ((author.totalViews / totalViews) * 100).toFixed(2);

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
    >
      {/* Rank Badge */}
      <div className="absolute top-2 right-2">
        {index === 0 && <span className="text-yellow-400 text-lg">👑</span>}
        {index === 1 && <span className="text-gray-400 text-lg">🥈</span>}
        {index === 2 && <span className="text-orange-400 text-lg">🥉</span>}
      </div>
      
      {/* Author Info */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="text-white font-bold text-lg">
            {author.alias || author.twitterHandle || `${author.walletAddress.slice(0, 6)}...${author.walletAddress.slice(-4)}`}
          </div>
        </div>
        <div className="text-gray-400 text-sm">
          {author.totalPosts} posts • {author.totalViews.toLocaleString()} views
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

const AuthorLeaderboard = () => {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState('24H');

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/author/leaderboard?sortBy=totalViews&timeframe=all');
      if (response.ok) {
        const data = await response.json();
        setAuthors(data.authors || []);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedAuthors = [...authors].sort((a, b) => b.totalViews - a.totalViews);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-gray-400 mt-4 text-lg">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Header />
      
      {/* Separator line */}
      <div className="border-b border-gray-800/50"></div>

      <main className="container mx-auto px-4 py-8 flex-1">
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
          {sortedAuthors.slice(0, 20).map((author, index) => {
            const totalViews = sortedAuthors.reduce((sum, a) => sum + a.totalViews, 0);
            return (
              <AuthorCard 
                key={author.id} 
                author={author} 
                index={index} 
                totalViews={totalViews}
              />
            );
          })}
        </div>

        {/* Footer Summary */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <div className="text-center mb-4">
            <span className="text-gray-400 text-sm">
              Total Authors: {authors.length}
            </span>
          </div>
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
};

export default AuthorLeaderboard;
