"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import Header from "./components/Header";
import Footer from "./components/Footer";
import GlobalSearch from "./components/GlobalSearch";

import toast from "react-hot-toast"; // Added for error toasts

// Dynamically import components
const BaseAiIndex = dynamic(() => import("./components/Indexes"), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-900 rounded-xl animate-pulse" />,
});
const TopPerformingCoins = dynamic(() => import("./components/TopPerformingCoins"), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-900 rounded-xl animate-pulse" />,
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

type TrendingToken = {
  id: string;
  name: string;
  symbol: string;
  address: string;
  marketCap?: string;
  volume24h?: string;
  uniqueHolders?: string;
  liquidity?: { usd?: string };
  createdAt?: string;
  tags: string[];
  mediaContent?: { previewImage?: { small?: string } };
  tokenPrice?: { priceInUsdc: string };
  marketCapDelta24h?: string;
  totalVolume?: string;
  totalSupply?: string;
  creatorAddress?: string;
  poolCurrencyToken?: { name: string; decimals: number };
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

function truncateName(name: string, isMobile: boolean) {
  if (!name) return "";
  if (isMobile && name.length > 12) {
    return name.substring(0, 12) + "...";
  }
  if (!isMobile && name.length > 20) {
    return name.substring(0, 20) + "...";
  }
  return name;
}

function getTokenTags(token: TrendingToken) {
  const tags: string[] = [];
  
  const marketCap = parseFloat(token.marketCap || "0");
  const volume = parseFloat(token.volume24h || "0");
  const holders = parseInt(token.uniqueHolders || "0");
  const liquidity = parseFloat(token.liquidity?.usd || "0");
  const totalVolume = parseFloat(token.totalVolume || "0");
  const marketCapDelta = parseFloat(token.marketCapDelta24h || "0");
  
  // Enhanced tagging system
  if (marketCap > 100000) tags.push("DEXPAID");
  if (volume > 50000) tags.push("RUNNER");
  if (marketCap > 1000000) tags.push("HIGH_CAP");
  if (holders > 1000) tags.push("TRENDING");
  if (liquidity > 100000) tags.push("LIQUIDITY");
  if (marketCap < 100000 && volume > 10000) tags.push("MOONSHOT");
  if (marketCap > 10000000) tags.push("ESTABLISHED");
  if (volume > 100000) tags.push("VOLUME_SPIKE");
  if (totalVolume > 1000000) tags.push("HIGH_VOLUME");
  if (marketCapDelta > 20) tags.push("PUMPING");
  if (marketCapDelta < -20) tags.push("DUMPING");
  if (holders > 5000) tags.push("COMMUNITY");
  if (marketCap < 50000) tags.push("MICRO_CAP");
  if (volume > 200000) tags.push("HOT");
  
  return tags;
}

const TagBadge = ({ tag }: { tag: string }) => {
  const getTagColor = (tag: string) => {
    switch (tag) {
      case "DEXPAID": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "RUNNER": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "HIGH_CAP": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "TRENDING": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "LIQUIDITY": return "bg-teal-500/20 text-teal-400 border-teal-500/30";
      case "MOONSHOT": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "ESTABLISHED": return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
      case "VOLUME_SPIKE": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "HIGH_VOLUME": return "bg-pink-500/20 text-pink-400 border-pink-500/30";
      case "PUMPING": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "DUMPING": return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "COMMUNITY": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      case "MICRO_CAP": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "HOT": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <span className={`px-1.5 py-0.5 text-xs rounded-full border ${getTagColor(tag)} whitespace-nowrap overflow-hidden text-ellipsis max-w-[60px] sm:max-w-[80px]`}>
      {tag}
    </span>
  );
};

export default function Page() {
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [latestArticles, setLatestArticles] = useState<NewsArticle[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [errorTokens, setErrorTokens] = useState("");
  const [errorNews, setErrorNews] = useState("");
  const [showTopMovers, setShowTopMovers] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function fetchTrendingTokens() {
      try {
        setLoadingTokens(true);
        const response = await fetch('/api/cypherscope-tokens');
        if (!response.ok) throw new Error('Failed to fetch trending tokens');
        const data = await response.json();
        
        // Process tokens and add tags
        let processedTokens = data.tokens.map((token: TrendingToken) => ({
          ...token,
          tags: getTokenTags(token)
        }));
        
        // If we have tokens, try to enhance with DexScreener data
        if (processedTokens.length > 0) {
          try {
            // Fetch DexScreener data for the first few tokens
            const dexScreenerPromises = processedTokens.slice(0, 3).map(async (token: TrendingToken) => {
              try {
                const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.address}`);
                if (dexResponse.ok) {
                  const dexData = await dexResponse.json();
                  const pair = dexData.pairs?.[0];
                  if (pair) {
                    return {
                      ...token,
                      marketCap: pair.marketCap || token.marketCap,
                      volume24h: pair.volume?.h24 || token.volume24h,
                      uniqueHolders: pair.holders || token.uniqueHolders,
                      tokenPrice: { priceInUsdc: pair.priceUsd || "0" },
                      marketCapDelta24h: pair.priceChange?.h24 || token.marketCapDelta24h,
                      tags: getTokenTags({
                        ...token,
                        marketCap: pair.marketCap || token.marketCap,
                        volume24h: pair.volume?.h24 || token.volume24h,
                        uniqueHolders: pair.holders || token.uniqueHolders
                      })
                    };
                  }
                }
              } catch (error) {
                console.log(`DexScreener fetch failed for ${token.address}:`, error);
              }
              return token;
            });
            
            const enhancedTokens = await Promise.all(dexScreenerPromises);
            processedTokens = enhancedTokens;
          } catch (error) {
            console.log('DexScreener enhancement failed:', error);
          }
        }
        
        setTrendingTokens(processedTokens.slice(0, 7)); // Show top 7
        setErrorTokens("");
      } catch (err) {
        console.error('Error fetching trending tokens:', err);
        setErrorTokens("Failed to load trending tokens");
      } finally {
        setLoadingTokens(false);
      }
    }

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

    fetchTrendingTokens();
    fetchArticles();
    
    // Show top movers after a delay for better UX
    const timer = setTimeout(() => {
      setShowTopMovers(true);
    }, 2000); // 2 second delay
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Head>
        <title>CypherX – Intelligence Layer for Base Chain</title>
        <meta
          name="description"
          content="CypherX provides trading tools, real-time insights, and on-chain analytics for Base Chain."
        />
        <meta
          property="og:title"
          content="CypherX – Intelligence Layer for Base Chain"
        />
        <meta
          property="og:description"
          content="Discover trading tools, network insights, and on-chain analytics all in one place."
        />
        <meta property="og:image" content="https://i.imgur.com/mlPQazY.png" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap');
        `}</style>
      </Head>

      <div className="min-h-screen flex flex-col bg-gray-950 overflow-x-hidden">
        <Header />

        <main className="flex-1 text-gray-200 relative overflow-x-hidden">
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
            className="relative w-full min-h-[60vh] sm:min-h-[60vh] flex items-center justify-center overflow-hidden pt-8 sm:pt-0"
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
              
              {/* Floating Orbs */}
              <motion.div
                className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"
                animate={{
                  x: [0, 20, 0],
                  y: [0, -20, 0],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div
                className="absolute top-1/3 right-1/4 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl"
                animate={{
                  x: [0, -15, 0],
                  y: [0, 15, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 2
                }}
              />
              <motion.div
                className="absolute bottom-1/4 left-1/3 w-20 h-20 bg-cyan-500/10 rounded-full blur-3xl"
                animate={{
                  x: [0, 25, 0],
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 4
                }}
              />
              
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
                  className="text-xl sm:text-2xl lg:text-3xl text-gray-300 max-w-3xl mx-auto leading-relaxed font-light mb-8 sm:mb-6"
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
                className="mb-8 sm:mb-6 max-w-2xl mx-auto"
              >
                <GlobalSearch 
                  placeholder="Search for tokens, symbols, addresses, transactions, blocks..."
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
                  onClick={() => window.location.href = '/token-scanner'}
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
                  onClick={() => window.location.href = '/docs'}
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
            <div className={`grid gap-6 lg:gap-8 mb-8 ${showTopMovers ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {showTopMovers && (
                <motion.div 
                  className="flex flex-col h-full" 
                  {...fadeInUp(0)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex-1">
                    <TopPerformingCoins />
                  </div>
                </motion.div>
              )}

              <motion.div className={`flex flex-col h-full ${!showTopMovers ? 'lg:col-span-1' : ''}`} {...fadeInUp(0.1)}>
                <div className="flex-1">
                  <CypherscopeTrendingTokens
                    tokens={trendingTokens}
                    loading={loadingTokens}
                    error={errorTokens}
                  />
                </div>
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
    </>
  );
}

function CypherscopeTrendingTokens({
  tokens,
  loading,
  error,
}: {
  tokens: TrendingToken[];
  loading: boolean;
  error: string;
}) {
  const isMobile = useIsMobile();
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
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-200">Memescope</h2>
              <p className="text-xs sm:text-sm text-gray-400">Discover trending tokens</p>
            </div>
          </div>
          <div className="flex space-x-1 sm:space-x-2">
            <div className="h-5 sm:h-6 w-12 sm:w-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-5 sm:h-6 w-12 sm:w-16 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-3 flex-grow">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
          ))}
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
              <h2 className="text-xl sm:text-2xl font-bold text-gray-200">Memescope</h2>
              <p className="text-sm text-gray-400">Discover trending tokens</p>
            </div>
          </div>
        </div>
        <p className="text-center text-red-400 flex-grow flex items-center justify-center">{error}</p>
      </div>
    );
  }

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
          href="/cypherscope" 
          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95"
        >
          {isMobile ? "View All" : "View All →"}
        </Link>
      </div>
      <div className="space-y-3 flex-grow">
        {tokens.length ? (
          tokens.slice(0, isMobile ? 5 : 7).map((token) => (
            <motion.div
              key={token.id}
              className="bg-gray-800 rounded-xl p-3 sm:p-4 border border-blue-500/20 group cursor-pointer relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Trending Badge */}
              {token.tags.includes('TRENDING') && (
                <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full border border-orange-400/50">
                  🔥 TRENDING
                </div>
              )}
              
              {/* Mobile Layout */}
              {isMobile ? (
                <div className="space-y-3">
                  {/* Header with token info */}
                  <div className="flex items-center space-x-3">
                    <div className="relative flex-shrink-0">
                      <Image 
                        src={token.mediaContent?.previewImage?.small || `https://dexscreener.com/base/${token.address || ''}/logo.png`}
                        alt={token.name || "Token"}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover border border-purple-500/30"
                      />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800"></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-bold text-gray-200 truncate">{truncateName(token.name, isMobile)}</span>
                        <span className="text-sm text-gray-400">({token.symbol})</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        {token.tags.slice(0, 2).map((tag) => (
                          <TagBadge key={tag} tag={tag} />
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Key metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Market Cap</div>
                      <div className="text-sm font-bold text-gray-200 truncate">{formatNumber(token.marketCap)}</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">24h Volume</div>
                      <div className="text-sm font-bold text-gray-200 truncate">{formatNumber(token.volume24h)}</div>
                    </div>
                  </div>
                  
                  {/* Price and holders */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">Price:</span>
                      <span className="text-gray-200 font-semibold">
                        {token.tokenPrice?.priceInUsdc && parseFloat(token.tokenPrice.priceInUsdc) > 0 
                          ? `$${parseFloat(token.tokenPrice.priceInUsdc).toFixed(6)}` 
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">Holders:</span>
                      <span className="text-gray-200 font-semibold">{token.uniqueHolders || "N/A"}</span>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex space-x-2">
                    <Link
                      href={`https://dexscreener.com/base/${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Chart</span>
                    </Link>
                    <Link
                      href={`https://baseswap.fi/swap?inputCurrency=0x4200000000000000000000000000000000000006&outputCurrency=${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Buy</span>
                    </Link>
                  </div>
                  
                  {/* Market cap change indicator */}
                  {token.marketCapDelta24h && parseFloat(token.marketCapDelta24h) !== 0 && Math.abs(parseFloat(token.marketCapDelta24h)) < 100 && (
                    <div className={`text-center text-sm font-semibold ${
                      parseFloat(token.marketCapDelta24h) > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {parseFloat(token.marketCapDelta24h) > 0 ? '+' : ''}{parseFloat(token.marketCapDelta24h).toFixed(1)}% MC change
                    </div>
                  )}
                </div>
              ) : (
                // Desktop Layout (unchanged)
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                      <div className="relative flex-shrink-0">
                        <Image 
                          src={token.mediaContent?.previewImage?.small || `https://dexscreener.com/base/${token.address || ''}/logo.png`}
                          alt={token.name || "Token"}
                          width={32}
                          height={32}
                          className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border border-purple-500/30 transition-colors"
                        />
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full border-2 border-gray-800"></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <span className="text-xs sm:text-sm font-bold text-gray-200 truncate">{truncateName(token.name, isMobile)}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">({token.symbol})</span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono truncate">
                          {token.address?.slice(0, 6)}...{token.address?.slice(-4)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 flex-shrink-0 ml-2">
                      {token.tags.slice(0, isMobile ? 1 : 2).map((tag) => (
                        <TagBadge key={tag} tag={tag} />
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="bg-gray-800/50 rounded-lg p-1.5 sm:p-2">
                      <div className="text-xs text-gray-400 mb-1">Market Cap</div>
                      <div className="text-xs sm:text-sm font-bold text-gray-200 truncate">{formatNumber(token.marketCap)}</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-1.5 sm:p-2">
                      <div className="text-xs text-gray-400 mb-1">24h Volume</div>
                      <div className="text-xs sm:text-sm font-bold text-gray-200 truncate">{formatNumber(token.volume24h)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="text-gray-400">Holders:</span>
                      <span className="text-gray-200 font-semibold truncate">{token.uniqueHolders || "N/A"}</span>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="text-gray-400">Price:</span>
                      <span className="text-gray-200 font-semibold truncate">
                        {token.tokenPrice?.priceInUsdc && parseFloat(token.tokenPrice.priceInUsdc) > 0 
                          ? `$${parseFloat(token.tokenPrice.priceInUsdc).toFixed(6)}` 
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-1">
                      <Link
                        href={`https://dexscreener.com/base/${token.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs transition-colors inline-flex items-center gap-1 bg-blue-500/10 px-1.5 sm:px-2 py-1 rounded"
                      >
                        {isMobile ? "Chart" : "Chart"}
                        <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                      <Link
                        href={`https://baseswap.fi/swap?inputCurrency=0x4200000000000000000000000000000000000006&outputCurrency=${token.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:text-green-300 text-xs transition-colors inline-flex items-center gap-1 bg-green-500/10 px-1.5 sm:px-2 py-1 rounded"
                      >
                        {isMobile ? "Buy" : "Quick Buy"}
                        <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </Link>
                    </div>
                    {token.marketCapDelta24h && parseFloat(token.marketCapDelta24h) !== 0 && Math.abs(parseFloat(token.marketCapDelta24h)) < 100 && (
                      <div className={`text-xs font-semibold ${
                        parseFloat(token.marketCapDelta24h) > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {parseFloat(token.marketCapDelta24h) > 0 ? '+' : ''}{parseFloat(token.marketCapDelta24h).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          ))
        ) : (
          [1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
          ))
        )}
      </div>
      <div className="text-center mt-4">
        <Link
          href="/cypherscope"
          className="inline-flex items-center gap-2 text-blue-400 font-semibold text-sm px-4 py-2 rounded-full hover:bg-blue-500/20 transition-all duration-200 hover:scale-105"
        >
          Explore Cypherscope
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </motion.div>
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
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 sm:h-32 bg-gray-900 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-400">{error}</p>;
  }

  if (!articles.length) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 sm:h-32 bg-gray-900 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className="w-full bg-gray-900 rounded-xl shadow-lg p-4 sm:p-6 border border-blue-500/30 flex flex-col"
      {...fadeInUp(0)}
    >
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-200">[ LATEST NEWS ]</h2>
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
              </div>
              <div className={`flex ${isMobile ? "flex-row gap-2" : "items-center gap-3"}`}>
                <Link
                  href={`/base-chain-news/${article.slug}`}
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