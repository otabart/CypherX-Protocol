"use client";

import { useState, useEffect } from "react";
import { useVotingModal } from "./providers";

import dynamic from "next/dynamic";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import Header from "./components/Header";
import Footer from "./components/Footer";
import GlobalSearch from "./components/GlobalSearch";
import IndexVotingModal from "./components/IndexVotingModal";

import toast from "react-hot-toast"; // Added for error toasts

// Dynamically import components
const BaseAiIndex = dynamic(() => import("./components/Indexes"), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-900 rounded-xl flex items-center justify-center">
      <div className="flex items-center space-x-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
        <span className="text-gray-400 text-sm ml-2">Loading...</span>
      </div>
    </div>
  ),
});
const TopPerformingCoins = dynamic(() => import("./components/TopPerformingCoins"), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-900 rounded-xl flex items-center justify-center">
      <div className="flex items-center space-x-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
        <span className="text-gray-400 text-sm ml-2">Loading...</span>
      </div>
    </div>
  ),
});

// Custom hook for mobile detection
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return isMobile;
}

function fadeInUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5, delay, ease: "easeOut" },
  };
}

// Enhanced animation variants
const heroVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.8,
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};



type NewsArticle = {
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
};



// Utility functions for token display
function formatNumber(num: string | number | undefined) {
  if (!num) return "-";
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n)) return "-";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}



// Tag logic functions for memescope widget
function getTokenTags(token: {
  marketCap?: string | number;
  volume24h?: string | number;
  uniqueHolders?: string | number;
  liquidity?: { usd?: string | number };
  marketCapDelta24h?: string | number;
  createdAt?: string;
  tags?: string[];
  priceChange?: { h24?: number };
}) {
  const tags: string[] = [];
  
  // If token already has tags from API, use them
  if (token.tags && token.tags.length > 0) {
    return token.tags;
  }
  
  const marketCap = typeof token.marketCap === 'string' ? parseFloat(token.marketCap) : (token.marketCap || 0);
  const volume = typeof token.volume24h === 'string' ? parseFloat(token.volume24h) : (token.volume24h || 0);
  
  // NEW tag - if created in last 10 days
  if (token.createdAt) {
    const created = new Date(token.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 10) {
      tags.push("NEW");
    }
  }
  
  // SURGING tag - complex scoring system based on market cap, price changes, and volume
  if (token.priceChange?.h24 !== undefined && token.priceChange.h24 > 0) {
    let surgeScore = 0;
    
    // Market cap tier scoring
    if (marketCap < 100000) surgeScore += 3; // Micro cap
    else if (marketCap < 1000000) surgeScore += 2; // Small cap
    else if (marketCap < 10000000) surgeScore += 1; // Mid cap
    
    // Price movement scoring
    if (token.priceChange.h24 > 50) surgeScore += 3;
    else if (token.priceChange.h24 > 20) surgeScore += 2;
    else if (token.priceChange.h24 > 10) surgeScore += 1;
    
    // Volume scoring
    if (volume > 100000) surgeScore += 2;
    else if (volume > 50000) surgeScore += 1;
    
    // Volume to market cap ratio
    if (marketCap > 0) {
      const volumeToMcRatio = volume / marketCap;
      if (volumeToMcRatio > 0.5) surgeScore += 2;
      else if (volumeToMcRatio > 0.2) surgeScore += 1;
    }
    
    if (surgeScore >= 4) {
      tags.push("SURGING");
    }
  }
  
  // GAINER tag - if 24h price change > 20%
  if (token.priceChange?.h24 !== undefined && token.priceChange.h24 > 20) {
    tags.push("GAINER");
  }
  
  return tags;
}

function getAgeFromTimestamp(timestamp: string) {
  const now = new Date();
  const created = new Date(timestamp);
  const diffInHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 24) {
    return `${diffInHours}h`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d`;
  }
}



export default function Page() {
  const [latestArticles, setLatestArticles] = useState<NewsArticle[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [errorNews, setErrorNews] = useState("");
  const isMobile = useIsMobile();
  const { showVotingModal, setShowVotingModal, selectedIndexForVoting } = useVotingModal();

  useEffect(() => {
    async function fetchArticles() {
      try {
        setLoadingNews(true);
        const response = await fetch("/api/articles");
        if (!response.ok) throw new Error("Failed to fetch articles");
        const data = await response.json();
        setLatestArticles(data.articles || []);
        setErrorNews("");
      } catch (err) {
        console.error("Error fetching articles:", err);
        setErrorNews("Failed to load latest news");
      } finally {
        setLoadingNews(false);
      }
    }

    fetchArticles();
  }, []);

  return (
    <>


      <div className="min-h-screen flex flex-col bg-gray-950 overflow-x-hidden">
        <Header />

        {/* Separator line between header and content */}
        <div className="border-b border-gray-800/50"></div>

        <main className="flex-1 text-gray-200 relative overflow-x-hidden" style={{ overflowY: 'visible' }}>
          {/* Enhanced Background with Multiple Layers */}
          <div className="fixed inset-0 bg-gray-950 -z-10"></div>
          
          {/* Simple Background */}
          <div className="fixed inset-0 -z-10 overflow-hidden">
            {/* Primary Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-gray-900/10 to-cyan-900/10"></div>
            
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}></div>
          </div>
          
          {/* Enhanced Hero Section */}
          <motion.div 
            className="relative w-full min-h-[60vh] sm:min-h-[60vh] flex items-center justify-center overflow-visible pt-8 sm:pt-0"
            variants={heroVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
              {/* Animated Grid Pattern */}
              <div className="absolute inset-0 opacity-[0.02]">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.3) 1px, transparent 0)`,
                  backgroundSize: '40px 40px'
                }}></div>
              </div>
              
              {/* Floating Orbs - Desktop Only */}
              {!isMobile && (
                <>
                  <motion.div
                    className="absolute top-1/4 left-1/4 w-40 h-40 bg-blue-500/25 rounded-full blur-2xl"
                    animate={{
                      x: [0, 80, -60, 0],
                      y: [0, -60, 40, 0],
                    }}
                    transition={{
                      duration: 12,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  <motion.div
                    className="absolute top-1/3 right-1/4 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl"
                    animate={{
                      x: [0, -70, 50, 0],
                      y: [0, 50, -30, 0],
                    }}
                    transition={{
                      duration: 10,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 2
                    }}
                  />
                  <motion.div
                    className="absolute bottom-1/4 left-1/3 w-28 h-28 bg-cyan-500/20 rounded-full blur-2xl"
                    animate={{
                      x: [0, 90, -40, 0],
                      y: [0, -40, 60, 0],
                    }}
                    transition={{
                      duration: 14,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 4
                    }}
                  />
                  
                  {/* Additional Floating Orbs */}
                  <motion.div
                    className="absolute top-1/6 right-1/6 w-24 h-24 bg-green-500/15 rounded-full blur-xl"
                    animate={{
                      x: [0, -100, 60, 0],
                      y: [0, 70, -50, 0],
                    }}
                    transition={{
                      duration: 16,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1
                    }}
                  />
                  <motion.div
                    className="absolute bottom-1/3 right-1/3 w-36 h-36 bg-pink-500/15 rounded-full blur-2xl"
                    animate={{
                      x: [0, 120, -80, 0],
                      y: [0, -60, 80, 0],
                    }}
                    transition={{
                      duration: 13,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 3
                    }}
                  />
                  <motion.div
                    className="absolute top-1/2 left-1/6 w-20 h-20 bg-yellow-500/12 rounded-full blur-lg"
                    animate={{
                      x: [0, 110, -70, 0],
                      y: [0, 50, -80, 0],
                    }}
                    transition={{
                      duration: 11,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 5
                    }}
                  />
                  <motion.div
                    className="absolute bottom-1/6 left-1/2 w-28 h-28 bg-indigo-500/15 rounded-full blur-xl"
                    animate={{
                      x: [0, -90, 70, 0],
                      y: [0, -80, 50, 0],
                    }}
                    transition={{
                      duration: 15,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 2.5
                    }}
                  />
                  <motion.div
                    className="absolute top-2/3 right-1/8 w-22 h-22 bg-teal-500/12 rounded-full blur-lg"
                    animate={{
                      x: [0, 60, -100, 0],
                      y: [0, -70, 90, 0],
                    }}
                    transition={{
                      duration: 12.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 4.5
                    }}
                  />
                </>
              )}
              
              {/* Subtle Gradient Overlays */}
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-cyan-500/5 via-transparent to-blue-500/5"></div>
            </div>
            
            {/* Gradient Fade to Content */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent z-10"></div>
            
            <div className="relative z-20 text-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              {/* Enhanced Main Heading */}
              <motion.div
                variants={itemVariants}
                className="mb-8 sm:mb-6 pt-8 sm:pt-6 lg:pt-2"
              >
                {/* Small Badge */}
                <motion.div
                  variants={itemVariants}
                  className="flex justify-center mb-4"
                >
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                    LIGHTNING FAST SWAP-EXECUTIONS
                  </span>
                </motion.div>
                

                
                {/* Enhanced Subtitle */}
                <motion.p 
                  className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl text-gray-300 max-w-4xl mx-auto leading-relaxed font-light mb-8 sm:mb-6"
                  variants={itemVariants}
                >
                  Advanced analytics, real-time insights, and{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-semibold">
                    AI-powered intelligence
                  </span>{" "}
                  for the next generation of decentralized trading
                </motion.p>
              </motion.div>

              {/* Enhanced Global Search Bar */}
              <motion.div
                variants={itemVariants}
                className="mb-8 sm:mb-6 max-w-2xl mx-auto relative"
                style={{ overflow: 'visible' }}
              >
                <GlobalSearch 
                  placeholder="Search for tokens, addresses, txs, insights, events, or blocks..."
                  variant="homepage"
                />
                {/* Small status text */}
                <div className="flex justify-center mt-2">
                  <span className="text-xs text-gray-500 flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
                    Real-time data • 1,247 tokens indexed
                  </span>
                </div>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                variants={itemVariants}
                className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mb-8 sm:mb-6 max-w-2xl mx-auto"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => window.location.href = '/trade'}
                  className="group relative px-6 sm:px-8 py-3 sm:py-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-blue-500/30 hover:border-blue-400/50 w-full sm:w-auto min-w-[160px]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-blue-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <span className="relative flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Explore Tokens
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => window.open('https://cypherx.gitbook.io', '_blank')}
                  className="group relative px-6 sm:px-8 py-3 sm:py-4 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-purple-500/30 hover:border-purple-400/50 w-full sm:w-auto min-w-[160px]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-purple-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <span className="relative flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Documentation
                  </span>
                </motion.button>

              </motion.div>

              {/* Enhanced Stats Section */}
              <motion.div
                variants={itemVariants}
                className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-8 sm:mb-0"
              >
                <motion.div 
                  className="text-center group"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-400 mb-1 sm:mb-2 group-hover:text-blue-300 transition-colors">0</div>
                  <div className="text-xs sm:text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Active Users</div>
                </motion.div>
                <motion.div 
                  className="text-center group"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-purple-400 mb-1 sm:mb-2 group-hover:text-purple-300 transition-colors">$2B+</div>
                  <div className="text-xs sm:text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Volume Tracked</div>
                </motion.div>
                <motion.div 
                  className="text-center group"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-cyan-400 mb-1 sm:mb-2 group-hover:text-cyan-300 transition-colors">99.9%</div>
                  <div className="text-xs sm:text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Uptime</div>
                </motion.div>
              </motion.div>


            </div>
          </motion.div>

          {/* Content Section with Enhanced Padding */}
          <div className="relative z-10 p-4 sm:p-6 lg:p-8 pt-8 sm:pt-6 lg:pt-8">
            {/* Top Row - Equal Height Cards */}
            <div className="grid gap-6 lg:gap-8 mb-8 grid-cols-1 lg:grid-cols-2">
              <motion.div 
                className="flex flex-col h-full" 
                {...fadeInUp(0)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <TopPerformingCoins />
              </motion.div>

              <motion.div className="flex flex-col h-full" {...fadeInUp(0.1)}>
                <MemescopeWidget />
              </motion.div>
            </div>

            {/* Indexes Section */}
            <motion.div className="mb-8" {...fadeInUp(0.2)}>
              <BaseAiIndex />
            </motion.div>

            {/* Latest News Section */}
            <motion.div className="mb-8" {...fadeInUp(0.4)}>
              <LatestNews articles={latestArticles} isMobile={isMobile} loading={loadingNews} error={errorNews} />
            </motion.div>
          </div>
        </main>

        <Footer />
      </div>

      {/* Global Voting Modal */}
      {showVotingModal && selectedIndexForVoting && (
        <IndexVotingModal
          isOpen={showVotingModal}
          onClose={() => setShowVotingModal(false)}
          indexName={selectedIndexForVoting}
          currentTokens={[]} // This will be populated by the IndexVotingModal itself
        />
      )}
    </>
  );
}



// Updated LatestNews Component with enhancements
function LatestNews({ articles, isMobile, loading, error }: { articles: NewsArticle[]; isMobile: boolean; loading: boolean; error: string }) {
  const shareToX = (article: NewsArticle) => {
    const url = encodeURIComponent(`${window.location.origin}/base-chain-news/${article.slug}`);
    const text = encodeURIComponent(`Check out this article on CypherX: ${article.title}`);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const shareToTelegram = (article: NewsArticle) => {
    const url = encodeURIComponent(`${window.location.origin}/base-chain-news/${article.slug}`);
    const text = encodeURIComponent(`Check out this article on CypherX: ${article.title}`);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
  };

  const copyLink = (article: NewsArticle) => {
    const url = `${window.location.origin}/base-chain-news/${article.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          <span className="text-gray-400 text-sm ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-400">{error}</p>;
  }

  if (!articles.length) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          <span className="text-gray-400 text-sm ml-2">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="w-full bg-gray-900 rounded-xl shadow-lg p-4 sm:p-6 border border-blue-500/30 flex flex-col"
      {...fadeInUp(0)}
    >
              <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-600/50 rounded-xl flex items-center justify-center border border-gray-500/30">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-200">Insights</h2>
              <p className="text-xs sm:text-sm text-gray-400">Stay updated with the latest Base Chain developments</p>
            </div>
          </div>
          
          {/* CTA Button */}
          <Link
            href="/insights"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 border border-gray-600/50"
          >
            <span className="text-sm">View All</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      <div className="space-y-4">
        {articles.slice(0, 3).map((article) => (
          <motion.div
            key={article.slug}
            className="bg-gray-800 rounded-lg shadow-md p-4 border border-blue-500/30 hover:shadow-xl transition-all duration-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
                        <div className={`flex ${isMobile ? "flex-col gap-3" : "gap-4 items-center"} mb-3`}>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-blue-400 line-clamp-1 hover:text-blue-300 transition-colors">
                  {article.title}
                </h3>
                <p className="text-sm sm:text-base mt-2 text-gray-400 line-clamp-2">{article.content}</p>
                
                {/* Author, Views, and Reading Time */}
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{article.author || 'GL1TCHXBT'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>0</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>5 min read</span>
                  </div>
                </div>
              </div>
              <div className={`flex ${isMobile ? "flex-row gap-2" : "items-center gap-3"}`}>
                <Link
                  href={`/insights/${article.slug}`}
                  className="flex items-center gap-1 p-2 bg-green-500/20 hover:bg-green-500/40 border border-green-500/30 rounded-md text-green-400 transition-all duration-200 hover:scale-105"
                  aria-label="Read article"
                >
                  <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </Link>
                <button
                  onClick={() => shareToX(article)}
                  className="flex items-center gap-1 p-2 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-blue-400 transition-all duration-200 hover:scale-105"
                  aria-label="Share on X"
                >
                  <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
                <button
                  onClick={() => shareToTelegram(article)}
                  className="flex items-center gap-1 p-2 bg-teal-500/20 hover:bg-teal-500/40 border border-teal-500/30 rounded-md text-teal-400 transition-all duration-200 hover:scale-105"
                  aria-label="Share on Telegram"
                >
                  <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c.1.564 1.725.267 2.02-.421L23.99 4.477c.392-1.178-.484-1.71-1.297-1.34L2.705 12.441c-1.178.392-.803 1.586 .098 1.965l5.51.717 12.785-8.01c.392-.244.814-.098 .491.392z" />
                  </svg>
                </button>
                <button
                  onClick={() => copyLink(article)}
                  className="flex items-center gap-1 p-2 bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 rounded-md text-purple-400 transition-all duration-200 hover:scale-105"
                  aria-label="Copy link"
                >
                  <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {new Date(article.publishedAt).toLocaleDateString()}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

const MemescopeWidget = () => {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const isMobile = useIsMobile();

  // Load watchlist from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("radar-watchlist");
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse watchlist:", e);
      }
    }
  }, []);

  const toggleWatchlist = (address: string) => {
    const newWatchlist = watchlist.includes(address)
      ? watchlist.filter(addr => addr !== address)
      : [...watchlist, address];
    setWatchlist(newWatchlist);
          localStorage.setItem("radar-watchlist", JSON.stringify(newWatchlist));
  };

  useEffect(() => {
    async function fetchTokens() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/cypherscope-tokens");
        const data = await res.json();
        
        const tokensWithTags = (data.tokens || []).map((token: any) => {
          const tags = getTokenTags(token);
          return {
            ...token,
            tags: tags
          };
        });
        
        setTokens(tokensWithTags);
      } catch (error) {
        console.error("Fetch error:", error);
        setError("Failed to fetch tokens.");
      } finally {
        setLoading(false);
      }
    }
    fetchTokens();
  }, []);

  // Categorize tokens for widget display
  const newTokens = tokens.filter(token => token.tags?.includes("NEW")).slice(0, 3);
  const surgingTokens = tokens.filter(token => token.tags?.includes("SURGING")).slice(0, 3);
  const gainerTokens = tokens
    .filter(token => token.priceChange?.h24 !== undefined && token.priceChange.h24 > 0)
    .sort((a, b) => (b.priceChange?.h24 || 0) - (a.priceChange?.h24 || 0))
    .slice(0, 3);

  // Combine all tokens for widget display, prioritizing categorized ones
  const displayTokens = [...newTokens, ...surgingTokens, ...gainerTokens];
  const uniqueTokens = displayTokens.filter((token, index, self) => 
    index === self.findIndex(t => t.address === token.address)
  ).slice(0, isMobile ? 3 : 5);

  if (loading) {
    return (
      <motion.div
        className="w-full bg-gray-900 rounded-xl shadow-lg p-4 sm:p-6 border border-blue-500/30 flex flex-col h-full min-h-[400px]"
        {...fadeInUp(0.1)}
      >
        <div className="flex justify-between items-center mb-3 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/30 rounded-xl flex items-center justify-center border border-blue-500/30">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-200">Radar</h2>
              <p className="text-xs sm:text-sm text-gray-400">Discover trending tokens</p>
            </div>
          </div>
          <div className="flex space-x-1 sm:space-x-2">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <span className="text-gray-400 text-xs">Loading...</span>
            </div>
          </div>
        </div>
        <div className="space-y-3 flex-grow flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-gray-400 text-sm ml-2">Loading...</span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-gray-900 rounded-xl shadow-lg p-4 sm:p-6 border border-blue-500/30 flex flex-col h-full min-h-[400px]">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500/30 rounded-xl flex items-center justify-center border border-blue-500/30">
              <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-200">Radar</h2>
              <p className="text-sm text-gray-400">Discover trending tokens</p>
            </div>
          </div>
        </div>
        <p className="text-center text-red-400 flex-grow flex items-center justify-center">{error}</p>
      </div>
    );
  }

  const TokenCard = ({ token }: { token: any }) => {
    // Helper function to format price change with color
    const formatPriceChange = (change: number | undefined) => {
      if (change === undefined || change === null) return { text: "-", color: "text-gray-400" };
      const isPositive = change >= 0;
      const color = isPositive ? "text-green-400" : "text-red-400";
      const sign = isPositive ? "+" : "";
      return { text: `${sign}${change.toFixed(1)}%`, color };
    };

    // Helper function to calculate buy percentage
    const getBuyPercentage = () => {
      if (!token.txns?.h24) return { text: "-", color: "text-gray-400" };
      const { buys, sells } = token.txns.h24;
      const total = buys + sells;
      if (total === 0) return { text: "-", color: "text-gray-400" };
      const buyPercentage = (buys / total) * 100;
      const color = buyPercentage > 60 ? "text-green-400" : buyPercentage < 40 ? "text-red-400" : "text-yellow-400";
      return { text: `${buyPercentage.toFixed(0)}%`, color };
    };

    const priceChange24h = formatPriceChange(token.priceChange?.h24);
    const buyPercentage = getBuyPercentage();

    // Handle card click to navigate to token chart
    const handleCardClick = () => {
      const poolAddress = token.poolAddress || token.address;
      if (poolAddress) {
        window.location.href = `/trade/${poolAddress}/chart`;
      }
    };

    return (
      <motion.div
        className="bg-gray-800/30 border-b border-gray-700/50 p-2.5 hover:bg-gray-700/30 transition-all duration-200 cursor-pointer group"
        style={{ minHeight: '80px' }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={handleCardClick}
      >
        <div className="flex items-center gap-3 mb-2">
          <Image
            src={token.info?.imageUrl || token.mediaContent?.previewImage?.small || `https://dexscreener.com/base/${token.address}/logo.png`}
            alt={token.symbol || "Token"}
            width={32}
            height={32}
            className="rounded-full bg-blue-900"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              e.currentTarget.src = `https://dexscreener.com/base/${token.address}/logo.png`;
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-200 group-hover:text-blue-200 transition truncate text-sm">
              {token.name || "Unknown"}
            </div>
            <div className="text-xs text-gray-400 truncate">{token.symbol}</div>
            {/* Price and 24h change */}
            {token.priceUsd && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-300">${parseFloat(token.priceUsd).toFixed(6)}</span>
                <span className={priceChange24h.color}>{priceChange24h.text}</span>
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleWatchlist(token.address);
            }}
            className={`p-1 rounded transition ${
              watchlist.includes(token.address)
                ? "text-yellow-400 hover:text-yellow-300"
                : "text-gray-400 hover:text-yellow-400"
            }`}
          >
                         <svg className="w-4 h-4" fill={watchlist.includes(token.address) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
             </svg>
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div>
            <span className="text-gray-400">MC:</span>
            <span className="text-gray-200 ml-1">{formatNumber(token.marketCap)}</span>
          </div>
          <div>
            <span className="text-gray-400">Vol:</span>
            <span className="text-gray-200 ml-1">{formatNumber(token.volume24h)}</span>
          </div>
          <div>
            <span className="text-gray-400">Buy:</span>
            <span className={`ml-1 ${buyPercentage.color}`}>{buyPercentage.text}</span>
          </div>
          <div>
            <span className="text-gray-400">Age:</span>
            <span className="text-gray-200 ml-1">{token.createdAt ? getAgeFromTimestamp(token.createdAt) : "-"}</span>
          </div>
        </div>
        
        {token.tags && token.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {token.tags.slice(0, 2).map((tag: string) => (
              <span
                key={tag}
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  tag === "NEW" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                  tag === "SURGING" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                  tag === "GAINER" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                  "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div
      className="w-full bg-gray-900 rounded-xl shadow-lg p-4 sm:p-6 border border-blue-500/30 flex flex-col h-full min-h-[400px]"
      {...fadeInUp(0.1)}
    >
      <div className="flex justify-between items-center mb-3 sm:mb-6">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/30 rounded-xl flex items-center justify-center border border-blue-500/30">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-200">Memescope</h2>
            <p className="text-xs sm:text-sm text-gray-400">Discover trending tokens</p>
          </div>
        </div>
        <Link 
          href="/radar" 
          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95"
        >
          {isMobile ? "View All" : "View All →"}
        </Link>
      </div>
      <div className="space-y-3 flex-grow">
        {uniqueTokens.length ? (
          uniqueTokens.map((token) => (
            <TokenCard key={token.address} token={token} />
          ))
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <span className="text-gray-400 text-sm ml-2">Loading...</span>
            </div>
          </div>
        )}
      </div>
      <div className="text-center mt-4">
        <Link
          href="/radar"
          className="inline-flex items-center gap-2 text-blue-400 font-semibold text-sm px-4 py-2 rounded-full hover:bg-blue-500/20 transition-all duration-200 hover:scale-105"
        >
          Explore Radar
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </motion.div>
  );
};