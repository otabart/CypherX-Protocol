"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  EyeIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  UserIcon,
  TrophyIcon,
  FireIcon,
  HeartIcon,
  HandThumbDownIcon,
  BoltIcon,
  BookmarkIcon,
  ClockIcon,
  PlusIcon,

} from "@heroicons/react/24/outline";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { 
  fetchUserStats, 
  fetchLeaderboard
} from "@/lib/news-api";
import { useAuth, useWalletSystem } from "@/app/providers";
import Image from 'next/image';
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import PointTransactionModal from "@/app/components/PointTransactionModal";

// ────────── Mindshare Leaderboards Component ──────────
interface LeaderboardEntry {
  walletAddress: string;
  points: number;
  rank: number;
}

interface AuthorLeaderboardEntry {
  id: string;
  walletAddress: string;
  twitterHandle?: string;
  alias?: string;
  totalPosts: number;
  totalViews: number;
  totalEarnings: number;
}

const MindshareLeaderboards = ({ leaderboard }: { leaderboard: LeaderboardEntry[] }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'authors'>('users');
  const [authorLeaderboard, setAuthorLeaderboard] = useState<AuthorLeaderboardEntry[]>([]);
  const [loadingAuthors, setLoadingAuthors] = useState(false);

  // Fetch author leaderboard when tab is switched
  useEffect(() => {
    if (activeTab === 'authors') {
      const fetchAuthorLeaderboard = async () => {
        setLoadingAuthors(true);
        try {
          const response = await fetch('/api/author/leaderboard?sortBy=totalViews&timeframe=all');
          if (response.ok) {
            const data = await response.json();
            setAuthorLeaderboard(data.authors.slice(0, 8) || []);
          }
        } catch (error) {
          console.error('Error fetching author leaderboard:', error);
        } finally {
          setLoadingAuthors(false);
        }
      };
      fetchAuthorLeaderboard();
    }
  }, [activeTab]);

  const renderUserEntry = (entry: LeaderboardEntry, index: number) => {
    
    return (
      <div key={entry.walletAddress} className="flex items-center justify-between group cursor-pointer hover:bg-gray-800/50 rounded-lg p-2 transition-colors">
        <div className="flex items-center gap-3">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            index === 0 ? 'bg-yellow-500 text-black' :
            index === 1 ? 'bg-gray-400 text-black' :
            index === 2 ? 'bg-orange-500 text-white' :
            'bg-gray-600 text-white'
          }`}>
            {index + 1}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-sm font-medium">
              {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm">{entry.points.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  const renderAuthorEntry = (entry: AuthorLeaderboardEntry, index: number) => {
    const formatNumber = (num: number) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    };

    return (
      <div key={entry.id} className="flex items-center justify-between group cursor-pointer hover:bg-gray-800/50 rounded-lg p-2 transition-colors">
        <div className="flex items-center gap-3">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            index === 0 ? 'bg-yellow-500 text-black' :
            index === 1 ? 'bg-gray-400 text-black' :
            index === 2 ? 'bg-orange-500 text-white' :
            'bg-gray-600 text-white'
          }`}>
            {index + 1}
          </span>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-gray-300 text-sm font-medium">
              {entry.alias || entry.twitterHandle || `${entry.walletAddress.slice(0, 6)}...${entry.walletAddress.slice(-4)}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{entry.totalPosts} posts</span>
          <span>•</span>
          <span className="text-white font-bold">{formatNumber(entry.totalViews)} views</span>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.55 }}
      className="bg-gray-900/30 rounded-xl p-4 sm:p-6 border border-gray-700"
    >
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Mindshare
      </h3>
      
      {/* Tab Switcher */}
      <div className="flex bg-gray-800/50 rounded-lg p-1 mb-4">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'users'
              ? 'bg-purple-500/20 text-purple-300'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('authors')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'authors'
              ? 'bg-purple-500/20 text-purple-300'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Authors
        </button>
      </div>
      
      {/* Content */}
      <div className="space-y-3">
        {activeTab === 'users' && leaderboard.slice(0, 8).map(renderUserEntry)}
        
        {activeTab === 'authors' && (
          loadingAuthors ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              <p className="text-gray-400 mt-2 text-sm">Loading authors...</p>
            </div>
          ) : authorLeaderboard.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No authors found</p>
            </div>
          ) : authorLeaderboard.slice(0, 8).map(renderAuthorEntry)
        )}
      </div>
      
      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        {activeTab === 'users' && (
          <>
            <div className="text-center">
              <span className="text-gray-400 text-xs">Total Points: {leaderboard.reduce((sum, entry) => sum + entry.points, 0).toLocaleString()}</span>
            </div>
            <div className="mt-3">
              <Link 
                href="/mindshare" 
                className="w-full px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors text-sm font-medium text-center block"
              >
                View Full Board →
              </Link>
            </div>
          </>
        )}
        
        {activeTab === 'authors' && (
          <div className="mt-3">
            <Link 
              href="/author/leaderboard" 
              className="w-full px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors text-sm font-medium text-center block"
            >
              View Full Author Board →
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
};



// News points API functions
const handleNewsPoints = async (
  action: 'read_article' | 'like_article' | 'unlike_article' | 'dislike_article' | 'share_article' | 'comment_article',
  userId: string,
  walletAddress: string,
  articleSlug: string,
  platform?: 'x' | 'telegram' | 'discord',
  comment?: string
) => {
  try {
    const response = await fetch('/api/points/news', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        userId,
        walletAddress,
        articleSlug,
        platform,
        comment,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.alreadyPerformed) {
        throw new Error('You have already performed this action today');
      } else if (data.alreadyLiked) {
        throw new Error('You have already liked this article');
      } else {
        throw new Error(data.error || 'Failed to process action');
      }
    }

    return data;
  } catch (error) {
    console.error('Error handling news points:', error);
    throw error;
  }
};

// ────────── Types ──────────
// Firebase timestamp type
interface FirebaseTimestamp {
  toDate(): Date;
  seconds: number;
  nanoseconds: number;
}

interface NewsArticle {
  id?: string;
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: FirebaseTimestamp | string | Date | unknown; // Firebase timestamp
  slug: string;
  category?: string;
  views?: number;
  upvotes?: number;
  downvotes?: number;
  comments?: string[];
  updatedAt?: string;
  thumbnail?: string;
  excerpt?: string;
  readingTime?: number; // Estimated reading time in minutes
  reactions?: {
    alpha?: number;
  };
}







interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

// ────────── Utility Functions ──────────
const truncateAtWord = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  return truncated.substring(0, truncated.lastIndexOf(' ')) + '...';
};

// Calculate reading time based on content length
const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const wordCount = content.split(' ').length;
  return Math.ceil(wordCount / wordsPerMinute);
};

const formatDate = (timestamp: unknown): string => {
  if (!timestamp) return 'Unknown date';
  
  let date: Date;
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    // Firebase timestamp
    date = timestamp.toDate();
  } else if (typeof timestamp === 'string') {
    // ISO string
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    // Already a Date object
    date = timestamp;
  } else {
    // Fallback
    date = new Date(String(timestamp));
  }
  
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return 'Yesterday';
  return date.toLocaleDateString();
};


export default function NewsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
  const walletAddress = selfCustodialWallet?.address;

  // ────────── State Management ──────────
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'upvotes'>('date');
  const [userPoints, setUserPoints] = useState(0);
  const [likedArticles, setLikedArticles] = useState<string[]>([]);
  const [dislikedArticles, setDislikedArticles] = useState<string[]>([]);
  const [bookmarkedArticles, setBookmarkedArticles] = useState<string[]>([]);
  const [userReactions, setUserReactions] = useState<{[key: string]: string}>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  
  // Gamification state
  const [dailyStreak] = useState(0);
  const [weeklyGoal] = useState(5);
  const [weeklyProgress] = useState(0);
  
  const [authorApplication, setAuthorApplication] = useState({
    twitterHandle: '',
    alias: '',
    email: '',
    bio: '',
    topics: '',
    additionalWork: '',
    disclaimer: false
  });

  // Function to get author display name
  const getAuthorDisplayName = () => {
    // For now, return a placeholder - we'll need to fetch author data
    // This will be improved when we implement proper author lookup
    return 'GL1TCHXBT'; // Since all articles are now owned by admin
  };
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [articlesPerPage] = useState(8); // Show 8 articles per page (excluding featured)

  // Transaction modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [isSubmittingAlpha, setIsSubmittingAlpha] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<NewsArticle | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);

  // ────────── Refs ──────────
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync article vote counts with user state
  const syncArticleVoteCounts = useCallback(() => {
    if (!articles.length) return;

    setArticles(prev => prev.map(article => {
      let upvotes = article.upvotes || 0;
      let downvotes = article.downvotes || 0;

      // If user has liked this article but upvotes is 0, set to 1
      // This handles the case where the database count is stale
      if (likedArticles.includes(article.slug) && upvotes === 0) {
        upvotes = 1;
      }
      // If user has disliked this article but downvotes is 0, set to 1
      if (dislikedArticles.includes(article.slug) && downvotes === 0) {
        downvotes = 1;
      }

      return {
        ...article,
        upvotes,
        downvotes
      };
    }));

    // Also sync featured article
    if (featuredArticle) {
      const isLiked = likedArticles.includes(featuredArticle.slug);
      const isDisliked = dislikedArticles.includes(featuredArticle.slug);
      
      let upvotes = featuredArticle.upvotes || 0;
      let downvotes = featuredArticle.downvotes || 0;

      if (isLiked && upvotes === 0) upvotes = 1;
      if (isDisliked && downvotes === 0) downvotes = 1;

      setFeaturedArticle(prev => prev ? { ...prev, upvotes, downvotes } : null);
    }
  }, [articles.length, likedArticles, dislikedArticles, featuredArticle]);

  // ────────── Show Onboarding for First Time Users ──────────
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('insights-onboarding-seen');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  // ────────── Fetch Articles from Firebase ──────────
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        
        // Fetch articles from Firebase
        const articlesRef = collection(db, 'articles');
        const q = query(articlesRef, orderBy('publishedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const fetchedArticles: NewsArticle[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedArticles.push({
            id: doc.id,
            title: data.title || '',
            content: data.content || '',
            author: data.author || '',
            source: data.source || '',
            publishedAt: data.publishedAt,
            slug: data.slug || '',
            category: data.category || 'General',
            views: data.views || 0,
            upvotes: data.upvotes || 0,
            downvotes: data.downvotes || 0,
            comments: data.comments || [],
            updatedAt: data.updatedAt || '',
            thumbnail: data.thumbnail || '',
            excerpt: data.excerpt || truncateAtWord(data.content || '', 200),
            readingTime: calculateReadingTime(data.content || ''),
            reactions: data.reactions || {
              alpha: 0
            }
          });
        });

        setArticles(fetchedArticles);
        
        // Set featured article (most recent or most viewed)
        if (fetchedArticles.length > 0) {
          const featured = fetchedArticles.reduce((prev, current) => 
            (current.views || 0) > (prev.views || 0) ? current : prev
          );
          setFeaturedArticle(featured);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching articles:', error);
        setLoading(false);
        addToast('Error loading articles', 'error');
      }
    };

    fetchArticles();
  }, []);

  // ────────── Fetch User Data ──────────
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user || !walletAddress) return;

      try {
        // Fetch user stats from news points API
        const response = await fetch(`/api/points/news?walletAddress=${walletAddress}`);
        if (response.ok) {
          const newsData = await response.json();
          setUserPoints(newsData.user?.points || 0);
          setLikedArticles(newsData.user?.likedArticles || [] as string[]);
          setDislikedArticles(newsData.user?.dislikedArticles || [] as string[]);
          setBookmarkedArticles(newsData.user?.bookmarkedArticles || [] as string[]);
          setUserReactions(newsData.user?.reactions || {});
        } else {
          // Fallback to old API
          const userStats = await fetchUserStats(walletAddress);
          setUserPoints(userStats.stats.points);
          setLikedArticles(userStats.user?.likedArticles || [] as string[]);
          setDislikedArticles(userStats.user?.dislikedArticles || [] as string[]);
        }

        // Fetch leaderboard
        const leaderboardData = await fetchLeaderboard(10);
        setLeaderboard(leaderboardData.leaderboard);
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [user, walletAddress]);

  // ────────── Check Author Status ──────────
  useEffect(() => {
    const checkAuthorStatus = async () => {
      if (!walletAddress) return;

      try {
        const response = await fetch(`/api/author/status?walletAddress=${walletAddress}`);
        if (response.ok) {
          const data = await response.json();
          setIsAuthor(data.isAuthor);
        }
      } catch (error) {
        console.error('Error checking author status:', error);
      }
    };

    checkAuthorStatus();
  }, [walletAddress]);



  // Sync article vote counts with user state after both are loaded
  useEffect(() => {
    if (articles.length > 0 && (likedArticles.length > 0 || dislikedArticles.length > 0)) {
      syncArticleVoteCounts();
    }
  }, [articles, likedArticles, dislikedArticles, syncArticleVoteCounts]);



  // ────────── Event Handlers ──────────
  const handleArticleClick = useCallback((slug: string) => {
    try {
      // Navigate to article page directly - removed async to prevent blocking
      router.push(`/insights/${slug}`);
    } catch (error) {
      console.error('Error navigating to article:', error);
      addToast('Error navigating to article', 'error');
    }
  }, [router]);

  const toggleLike = async (article: NewsArticle) => {
    if (!user || !walletAddress) {
              addToast('Please create or connect your wallet to like articles', 'error');
      return;
    }

    try {
      const isLiked = likedArticles.includes(article.slug);
      const isDisliked = dislikedArticles.includes(article.slug);
      
      // Call the API first to get the actual state
      const action = isLiked ? 'unlike_article' : 'like_article';
      const result = await handleNewsPoints(action, user.uid, walletAddress, article.slug);
      
      // Update local state based on the action
      if (isLiked) {
        // Was liked, now unliked
        setLikedArticles(prev => prev.filter(slug => slug !== article.slug));
        setArticles(prev => prev.map(a => 
          a.slug === article.slug 
            ? { ...a, upvotes: Math.max(0, (a.upvotes || 0) - 1) }
            : a
        ));
        if (featuredArticle && featuredArticle.slug === article.slug) {
          setFeaturedArticle(prev => prev ? { ...prev, upvotes: Math.max(0, (prev.upvotes || 0) - 1) } : null);
        }
        addToast('Article unliked', 'info');
      } else {
        // Was not liked, now liked
        // Remove dislike first if exists
        if (isDisliked) {
          setDislikedArticles(prev => prev.filter(slug => slug !== article.slug));
          setArticles(prev => prev.map(a => 
            a.slug === article.slug 
              ? { ...a, downvotes: Math.max(0, (a.downvotes || 0) - 1) }
              : a
          ));
          if (featuredArticle && featuredArticle.slug === article.slug) {
            setFeaturedArticle(prev => prev ? { ...prev, downvotes: Math.max(0, (prev.downvotes || 0) - 1) } : null);
          }
        }
        
        setLikedArticles(prev => [...prev, article.slug]);
        setArticles(prev => prev.map(a => 
          a.slug === article.slug 
            ? { ...a, upvotes: (a.upvotes || 0) + 1 }
            : a
        ));
        if (featuredArticle && featuredArticle.slug === article.slug) {
          setFeaturedArticle(prev => prev ? { ...prev, upvotes: (prev.upvotes || 0) + 1 } : null);
        }
        
        if (result.pointsEarned > 0) {
          addToast(`Article liked! +${result.pointsEarned} points`, 'success');
        } else {
          addToast('Article liked!', 'success');
        }
      }
      
      refreshUserPoints(); // Refresh points after successful interaction
    } catch (error) {
      console.error('Error toggling like:', error);
      if (error instanceof Error && error.message.includes('already performed')) {
        addToast('Already performed this action today', 'info');
      } else {
        addToast(error instanceof Error ? error.message : 'Error liking article', 'error');
      }
    }
  };

  const toggleDislike = async (article: NewsArticle) => {
    if (!user || !walletAddress) {
              addToast('Please create or connect your wallet to dislike articles', 'error');
      return;
    }

    try {
      const isDisliked = dislikedArticles.includes(article.slug);
      const isLiked = likedArticles.includes(article.slug);
      
      // Call the API first to get the actual state
      const action = 'dislike_article'; // API handles both dislike and undislike based on current state
      await handleNewsPoints(action, user.uid, walletAddress, article.slug);
      
      // Update local state based on the action
      if (isDisliked) {
        // Was disliked, now undisliked
        setDislikedArticles(prev => prev.filter(slug => slug !== article.slug));
        setArticles(prev => prev.map(a => 
          a.slug === article.slug 
            ? { ...a, downvotes: Math.max(0, (a.downvotes || 0) - 1) }
            : a
        ));
        if (featuredArticle && featuredArticle.slug === article.slug) {
          setFeaturedArticle(prev => prev ? { ...prev, downvotes: Math.max(0, (prev.downvotes || 0) - 1) } : null);
        }
        addToast('Article undisliked', 'info');
      } else {
        // Was not disliked, now disliked
        // Remove like first if exists
        if (isLiked) {
          setLikedArticles(prev => prev.filter(slug => slug !== article.slug));
          setArticles(prev => prev.map(a => 
            a.slug === article.slug 
              ? { ...a, upvotes: Math.max(0, (a.upvotes || 0) - 1) }
              : a
          ));
          if (featuredArticle && featuredArticle.slug === article.slug) {
            setFeaturedArticle(prev => prev ? { ...prev, upvotes: Math.max(0, (prev.upvotes || 0) - 1) } : null);
          }
        }
        
        setDislikedArticles(prev => [...prev, article.slug]);
        setArticles(prev => prev.map(a => 
          a.slug === article.slug 
            ? { ...a, downvotes: (a.downvotes || 0) + 1 }
            : a
        ));
        if (featuredArticle && featuredArticle.slug === article.slug) {
          setFeaturedArticle(prev => prev ? { ...prev, downvotes: (prev.downvotes || 0) + 1 } : null);
        }
        addToast('Article disliked', 'info');
      }
      
      refreshUserPoints(); // Refresh points after successful interaction
    } catch (error) {
      console.error('Error toggling dislike:', error);
      if (error instanceof Error && error.message.includes('already performed')) {
        addToast('Already performed this action today', 'info');
      } else {
        addToast(error instanceof Error ? error.message : 'Error disliking article', 'error');
      }
    }
  };

  const toggleBookmark = async (article: NewsArticle) => {
    if (!user || !walletAddress) {
      addToast('Please create or connect your wallet to bookmark articles', 'error');
      return;
    }

    try {
      const isBookmarked = bookmarkedArticles.includes(article.slug);
      
      if (isBookmarked) {
        setBookmarkedArticles(prev => prev.filter(slug => slug !== article.slug));
        addToast('Article removed from bookmarks', 'info');
      } else {
        setBookmarkedArticles(prev => [...prev, article.slug]);
        addToast('Article bookmarked!', 'success');
      }
      
      // Here you would typically save to backend
      // For now, we'll just update local state
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      addToast('Error bookmarking article', 'error');
    }
  };

  const handleReaction = async (article: NewsArticle, reactionType: string) => {
    if (!user || !walletAddress) {
      addToast('Please create or connect your wallet to react to articles', 'error');
      return;
    }

    // For alpha boost, use transaction modal
    if (reactionType === 'alpha') {
      setCurrentArticle(article);
      setShowTransactionModal(true);
      return;
    }

    try {
      const currentReaction = userReactions[article.slug];
      
      if (currentReaction === reactionType) {
        // Remove reaction
        setUserReactions(prev => {
          const newReactions = { ...prev };
          delete newReactions[article.slug];
          return newReactions;
        });
        addToast('Reaction removed', 'info');
      } else {
        // Check if user has already used their daily reaction on this article
        const hasReactedToday = Object.keys(userReactions).some(key => 
          key.startsWith(article.slug) && userReactions[key] === reactionType
        );
        
        if (hasReactedToday) {
          addToast('You can only use one reaction per article per day', 'info');
          return;
        }
        
        // Add/change reaction
        setUserReactions(prev => ({
          ...prev,
          [article.slug]: reactionType
        }));
        addToast(`Marked as ${reactionType}!`, 'success');
      }
      
      // Here you would typically save to backend
      // For now, we'll just update local state
    } catch (error) {
      console.error('Error handling reaction:', error);
      addToast('Error reacting to article', 'error');
    }
  };

  const handleConfirmAlphaTransaction = async () => {
    if (!user || !walletAddress || isSubmittingAlpha) return;

    setIsSubmittingAlpha(true);
    try {
      // This would be the actual alpha boost API call
      // For now, just update local state
      setUserReactions(prev => ({
        ...prev,
        [currentArticle?.slug || '']: 'alpha'
      }));
      addToast('Alpha boost applied!', 'success');
      setShowTransactionModal(false);
    } catch (error) {
      console.error('Error applying alpha boost:', error);
      addToast('Error applying alpha boost', 'error');
    } finally {
      setIsSubmittingAlpha(false);
    }
  };

  const shareArticle = async (article: NewsArticle, platform: 'x' | 'telegram') => {
    const url = `${window.location.origin}/insights/${article.slug}`;
    const text = `Check out this article: ${article.title}`;
    
    if (platform === 'x') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
    } else {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    }
    
    // Track sharing activity
    if (user && walletAddress) {
      try {
        const result = await handleNewsPoints('share_article', user.uid, walletAddress, article.slug, platform);
        addToast(`Shared to ${platform === 'x' ? 'X' : 'Telegram'}! +${result.pointsEarned} points`, 'success');
        refreshUserPoints(); // Refresh points after successful interaction
      } catch (error) {
        if (error instanceof Error && error.message.includes('already performed')) {
          addToast('Already shared today', 'info');
        } else {
          addToast(error instanceof Error ? error.message : 'Error tracking share', 'error');
        }
      }
    }
  };



  const addToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  // Function to refresh user points
  const refreshUserPoints = async () => {
    if (!user || !walletAddress) return;

    try {
      const response = await fetch(`/api/points/news?walletAddress=${walletAddress}`);
      if (response.ok) {
        const newsData = await response.json();
        setUserPoints(newsData.user?.points || 0);
      }
    } catch (error) {
      console.error('Error refreshing user points:', error);
    }
  };

  const handleAuthorApplication = async () => {
    if (!user) {
      addToast('Please log in to apply', 'error');
      return;
    }

    // Validate required fields
    if (!authorApplication.twitterHandle.trim() || !authorApplication.email.trim() || !authorApplication.bio.trim() || !authorApplication.disclaimer) {
      addToast('Please fill in all required fields and accept the disclaimer', 'error');
      return;
    }

    try {
      // Here you would typically send the application to your backend
      // For now, we'll just show a success message
      addToast('Application submitted successfully! We\'ll review and get back to you soon.', 'success');
      setShowAuthorModal(false);
      setAuthorApplication({
        twitterHandle: '',
        alias: '',
        email: '',
        bio: '',
        topics: '',
        additionalWork: '',
        disclaimer: false
      });
    } catch (error) {
      console.error('Error submitting application:', error);
      addToast('Failed to submit application. Please try again.', 'error');
    }
  };



  // ────────── Filtered Articles ──────────
  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           article.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !filterCategory || article.category === filterCategory;
      const matchesAuthor = !filterAuthor || article.author === filterAuthor;
      
      return matchesSearch && matchesCategory && matchesAuthor;
    });
  }, [articles, searchQuery, filterCategory, filterAuthor]);

  const sortedArticles = useMemo(() => {
    return [...filteredArticles].sort((a, b) => {
      switch (sortBy) {
        case 'views':
          return (b.views || 0) - (a.views || 0);
        case 'upvotes':
          return (b.upvotes || 0) - (a.upvotes || 0);
        default:
          // Sort by publishedAt timestamp
          const getDate = (timestamp: FirebaseTimestamp | string | Date | unknown): Date => {
            if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
              return (timestamp as FirebaseTimestamp).toDate();
            } else if (typeof timestamp === 'string') {
              return new Date(timestamp);
            } else if (timestamp instanceof Date) {
              return timestamp;
            } else {
              return new Date(0);
            }
          };
          const dateA = getDate(a.publishedAt);
          const dateB = getDate(b.publishedAt);
          return dateB.getTime() - dateA.getTime();
      }
    });
  }, [filteredArticles, sortBy]);

  const categories = useMemo(() => 
    Array.from(new Set(articles.map(article => article.category).filter(Boolean))), 
    [articles]
  );
  const authors = useMemo(() => 
    Array.from(new Set(articles.map(article => article.author))), 
    [articles]
  );

  // ────────── Pagination Logic ──────────
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, filterAuthor, sortBy]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Calculate pagination
  const totalArticles = sortedArticles.length - 1; // Exclude featured article
  const totalPages = Math.ceil(totalArticles / articlesPerPage);
  const startIndex = (currentPage - 1) * articlesPerPage;
  const endIndex = startIndex + articlesPerPage;
  const currentArticles = sortedArticles.slice(1).slice(startIndex, endIndex); // Exclude featured article and apply pagination

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      
      {/* Separator Line */}
      <div className="border-b border-gray-800"></div>
      
      {/* Toast Notifications */}
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
              toast.type === 'success' ? 'bg-green-500/90 text-white' :
              toast.type === 'error' ? 'bg-red-500/90 text-white' :
              'bg-blue-500/90 text-white'
            }`}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>

      <main className="container mx-auto px-4 py-8">


        {/* Balanced Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="max-w-4xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex items-center">
                <div className="w-1 h-12 bg-blue-500 rounded-full mr-4"></div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white">
                  Insights
                </h1>
              </div>
              <div className="relative group">
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="text-gray-400 hover:text-blue-400 transition-colors p-1 rounded-full hover:bg-blue-500/10"
                  title="How Insights works"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                
                {/* Quick Help Tooltip */}
                <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="text-xs text-gray-300">
                    <div className="font-medium text-white mb-1">Learn How It Works</div>
                    <div>Click for interactive guide</div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-base text-gray-300 max-w-2xl leading-relaxed">
              Discover the latest developments, protocols, and market intelligence from the Base ecosystem
            </p>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex flex-col sm:flex-row gap-4 items-stretch justify-between">
            {/* Search and Filters Group */}
            <div className="flex items-center gap-3 flex-1 max-w-2xl">
              {/* Compact Search Bar */}
              <div className="relative flex-1 max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search insights..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[40px]"
                  autoComplete="off"
                />
              </div>

              {/* Filter Toggle with Tooltip */}
              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white hover:bg-gray-800/50 transition-colors min-h-[40px] group"
                  title="Filter articles by category, author, or sort order"
                >
                  <FunnelIcon className="w-4 h-4" />
                  <span className="text-sm">Filters</span>
                </button>
                
                {/* Filter Tooltip */}
                <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="text-xs text-gray-300">
                    <div className="font-medium text-white mb-2">Filter Options:</div>
                    <div className="space-y-1">
                      <div>• <span className="text-blue-400">Category:</span> Filter by article type</div>
                      <div>• <span className="text-purple-400">Author:</span> Find specific writers</div>
                      <div>• <span className="text-cyan-400">Sort:</span> Date, views, or popularity</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Create Post Button (for authors) */}
              {isAuthor && (
                <div className="relative group">
                  <button
                    onClick={() => window.location.href = '/author/dashboard'}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-500 rounded-lg text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-200 min-h-[40px] font-medium"
                    title="Create a new post"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span className="text-sm">Create Post</span>
                  </button>
                  
                  {/* Create Post Tooltip */}
                  <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                    <div className="text-xs text-gray-300">
                      <div className="font-medium text-white mb-1">Create New Content</div>
                      <div>Write and publish your insights</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Become an Author Button */}
            <div className="relative group">
              <button
                onClick={() => setShowAuthorModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white hover:bg-gray-700/50 transition-all duration-200 min-h-[40px]"
                title="Become an author and share your insights"
              >
                <UserIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Become Author</span>
              </button>
              
              {/* Author Button Tooltip */}
              <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="text-xs text-gray-300">
                  <div className="font-medium text-white mb-1">Share Your Insights</div>
                  <div>Write articles and earn rewards</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-4 sm:p-6 bg-gray-900/30 rounded-lg border border-gray-700"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[48px]"
                  >
                    <option value="">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>

                  <select
                    value={filterAuthor}
                    onChange={(e) => setFilterAuthor(e.target.value)}
                    className="px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[48px]"
                  >
                    <option value="">All Authors</option>
                    {authors.map(author => (
                      <option key={author} value={author}>{author}</option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'views' | 'upvotes')}
                    className="px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[48px]"
                  >
                    <option value="date">Sort by Date</option>
                    <option value="views">Sort by Views</option>
                    <option value="upvotes">Sort by Upvotes</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-gray-400 mt-4">Loading articles...</p>
          </motion.div>
        )}

        {/* Content */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3">
              {/* Featured Article */}
              {featuredArticle && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-6 sm:mb-8"
                >
                  <div className="bg-gray-900/30 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors">
                    {featuredArticle.thumbnail && (
                      <div className="relative h-48 sm:h-64 lg:h-80">
                        <Image
                          src={featuredArticle.thumbnail}
                          alt={featuredArticle.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-4 left-4">
                          <span className="inline-block px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
                            Featured
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="p-4 sm:p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                          {featuredArticle.category}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {formatDate(featuredArticle.publishedAt)}
                        </span>
                        <div className="flex items-center gap-1 text-gray-400 text-sm">
                          <ClockIcon className="w-4 h-4" />
                          <span>{featuredArticle.readingTime || 5} min read</span>
                        </div>
                      </div>
                      
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
                        {featuredArticle.title}
                      </h2>
                      
                      <p className="text-gray-300 mb-4 text-sm sm:text-base">
                        {featuredArticle.excerpt || truncateAtWord(featuredArticle.content, 200)}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 text-sm">{getAuthorDisplayName()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <EyeIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 text-sm">{featuredArticle.views?.toLocaleString()}</span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleArticleClick(featuredArticle.slug)}
                          className="w-full sm:w-auto px-6 py-3 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 hover:border-blue-500/50 transition-all duration-200 transform hover:scale-105 font-medium text-base"
                        >
                          Read Article →
                        </button>
                      </div>

                      {/* Article Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 pt-4 border-t border-gray-700">
                        <div className="flex items-center gap-4">
                          {/* Bookmark Button */}
                          <button
                            onClick={() => toggleBookmark(featuredArticle)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                              bookmarkedArticles.includes(featuredArticle.slug)
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-transparent'
                            }`}
                            title={bookmarkedArticles.includes(featuredArticle.slug) ? 'Remove bookmark' : 'Bookmark article'}
                          >
                            <BookmarkIcon className={`w-4 h-4 transition-all duration-200 ${
                              bookmarkedArticles.includes(featuredArticle.slug) ? 'fill-current' : ''
                            }`} />
                          </button>

                          {/* Like/Dislike Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleLike(featuredArticle)}
                              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                                likedArticles.includes(featuredArticle.slug)
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-transparent'
                              }`}
                            >
                              <HeartIcon className={`w-4 h-4 transition-all duration-200 ${
                                likedArticles.includes(featuredArticle.slug) ? 'fill-current' : ''
                              }`} />
                              <span className="text-xs">{featuredArticle.upvotes || 0}</span>
                            </button>
                            
                            <button
                              onClick={() => toggleDislike(featuredArticle)}
                              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                                dislikedArticles.includes(featuredArticle.slug)
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-transparent'
                              }`}
                            >
                              <HandThumbDownIcon className={`w-4 h-4 transition-all duration-200 ${
                                dislikedArticles.includes(featuredArticle.slug) ? 'fill-current' : ''
                              }`} />
                              <span className="text-xs">{featuredArticle.downvotes || 0}</span>
                            </button>
                          </div>

                          {/* Granular Reactions */}
                          <div className="flex items-center gap-2">
                            <div className="relative group">
                              <button
                                onClick={() => handleReaction(featuredArticle, 'alpha')}
                                className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                                  userReactions[featuredArticle.slug] === 'alpha'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-transparent'
                                }`}
                                title="Alpha"
                              >
                                <BoltIcon className="w-4 h-4" />
                                <span className="text-xs">{featuredArticle.reactions?.alpha || 0}</span>
                              </button>
                              
                              {/* Alpha Tooltip */}
                              <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                <div className="text-xs text-gray-300 text-center">
                                  <div className="font-medium text-white mb-1">Alpha Boost</div>
                                  <div>You get one Alpha Boost per day</div>
                                </div>
                              </div>
                            </div>
                            

                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => shareArticle(featuredArticle, 'x')}
                            className="px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-all duration-200 transform hover:scale-105 text-sm"
                          >
                            Share X
                          </button>
                          <button
                            onClick={() => shareArticle(featuredArticle, 'telegram')}
                            className="px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-all duration-200 transform hover:scale-105 text-sm"
                          >
                            Share TG
                          </button>
                        </div>
                      </div>


                    </div>
                  </div>
                </motion.div>
              )}

              {/* Articles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {currentArticles.map((article, index) => (
                  <motion.div
                    key={article.slug}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="bg-gray-900/30 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    {article.thumbnail && (
                      <div className="relative h-40 sm:h-48">
                        <Image
                          src={article.thumbnail}
                          alt={article.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </div>
                    )}
                    
                    <div className="p-4 sm:p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                          {article.category}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {formatDate(article.publishedAt)}
                        </span>
                        <div className="flex items-center gap-1 text-gray-400 text-sm">
                          <ClockIcon className="w-4 h-4" />
                          <span>{article.readingTime || 5} min read</span>
                        </div>
                      </div>
                      
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-3 line-clamp-2">
                        {article.title}
                      </h3>
                      
                      <p className="text-gray-300 mb-4 line-clamp-3 text-sm sm:text-base">
                        {article.excerpt || truncateAtWord(article.content, 150)}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 text-sm">{getAuthorDisplayName()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <EyeIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 text-sm">{article.views?.toLocaleString()}</span>
                          </div>
                        </div>
                        
                        <div className="relative group">
                          <button
                            onClick={() => handleArticleClick(article.slug)}
                            className="w-full sm:w-auto px-6 py-3 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 hover:border-blue-500/50 transition-all duration-200 transform hover:scale-105 font-medium text-base"
                            title="Read full article"
                          >
                            Read Article →
                          </button>
                          
                          {/* Read Article Tooltip */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-32 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                            <div className="text-xs text-gray-300 text-center">
                              Read full article
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Article Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 pt-4 border-t border-gray-700">
                        <div className="flex items-center gap-4">
                          {/* Bookmark Button */}
                          <div className="relative group">
                            <button
                              onClick={() => toggleBookmark(article)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                                bookmarkedArticles.includes(article.slug)
                                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-transparent'
                              }`}
                              title={bookmarkedArticles.includes(article.slug) ? 'Remove bookmark' : 'Bookmark article'}
                            >
                              <BookmarkIcon className={`w-4 h-4 transition-all duration-200 ${
                                bookmarkedArticles.includes(article.slug) ? 'fill-current' : ''
                              }`} />
                            </button>
                            
                            {/* Bookmark Tooltip */}
                            <div className="absolute bottom-full left-0 mb-2 w-32 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                              <div className="text-xs text-gray-300 text-center">
                                {bookmarkedArticles.includes(article.slug) ? 'Bookmarked!' : 'Bookmark article'}
                              </div>
                            </div>
                          </div>

                          {/* Like/Dislike Buttons */}
                          <div className="flex items-center gap-2">
                            <div className="relative group">
                              <button
                                onClick={() => toggleLike(article)}
                                className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                                  likedArticles.includes(article.slug)
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-transparent'
                                }`}
                                title="Like this article"
                              >
                                <HeartIcon className={`w-4 h-4 transition-all duration-200 ${
                                  likedArticles.includes(article.slug) ? 'fill-current' : ''
                                }`} />
                                <span className="text-xs">{article.upvotes || 0}</span>
                              </button>
                              
                              {/* Like Tooltip */}
                              <div className="absolute bottom-full left-0 mb-2 w-32 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                <div className="text-xs text-gray-300 text-center">
                                  {likedArticles.includes(article.slug) ? 'Liked!' : 'Like article'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="relative group">
                              <button
                                onClick={() => toggleDislike(article)}
                                className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                                  dislikedArticles.includes(article.slug)
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-transparent'
                                }`}
                                title="Dislike this article"
                              >
                                <HandThumbDownIcon className={`w-4 h-4 transition-all duration-200 ${
                                  dislikedArticles.includes(article.slug) ? 'fill-current' : ''
                                }`} />
                                <span className="text-xs">{article.downvotes || 0}</span>
                              </button>
                              
                              {/* Dislike Tooltip */}
                              <div className="absolute bottom-full left-0 mb-2 w-32 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                <div className="text-xs text-gray-300 text-center">
                                  {dislikedArticles.includes(article.slug) ? 'Disliked!' : 'Dislike article'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Granular Reactions */}
                          <div className="flex items-center gap-2">
                            <div className="relative group">
                              <button
                                onClick={() => handleReaction(article, 'alpha')}
                                className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                                  userReactions[article.slug] === 'alpha'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-transparent'
                                }`}
                                title="Alpha"
                              >
                                <BoltIcon className="w-4 h-4" />
                                <span className="text-xs">{article.reactions?.alpha || 0}</span>
                              </button>
                              
                              {/* Alpha Tooltip */}
                              <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                <div className="text-xs text-gray-300 text-center">
                                  <div className="font-medium text-white mb-1">Alpha Boost</div>
                                  <div>You get one Alpha Boost per day</div>
                                </div>
                              </div>
                            </div>
                            

                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="relative group">
                            <button
                              onClick={() => shareArticle(article, 'x')}
                              className="px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-all duration-200 transform hover:scale-105 text-sm"
                              title="Share on X (Twitter)"
                            >
                              Share X
                            </button>
                            
                            {/* Share X Tooltip */}
                            <div className="absolute bottom-full left-0 mb-2 w-32 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                              <div className="text-xs text-gray-300 text-center">
                                Share on X (Twitter)
                              </div>
                            </div>
                          </div>
                          <div className="relative group">
                            <button
                              onClick={() => shareArticle(article, 'telegram')}
                              className="px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-all duration-200 transform hover:scale-105 text-sm"
                              title="Share on Telegram"
                            >
                              Share TG
                            </button>
                            
                            {/* Share TG Tooltip */}
                            <div className="absolute bottom-full left-0 mb-2 w-32 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                              <div className="text-xs text-gray-300 text-center">
                                Share on Telegram
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>


                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                  {/* Page Info */}
                  <div className="text-gray-400 text-sm">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalArticles)} of {totalArticles} articles
                  </div>

                  {/* Pagination Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Previous Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white hover:bg-gray-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {getPageNumbers().map((page, index) => (
                        <button
                          key={index}
                          onClick={() => typeof page === 'number' && setCurrentPage(page)}
                          disabled={page === '...'}
                          className={`px-3 py-2 rounded-lg transition-colors ${
                            page === currentPage
                              ? 'bg-blue-500 text-white'
                              : page === '...'
                              ? 'text-gray-500 cursor-default'
                              : 'bg-gray-900/50 border border-gray-700 text-white hover:bg-gray-800/50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    {/* Next Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white hover:bg-gray-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="space-y-6">

                {/* Ad Placement */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                  className="bg-gray-900/30 rounded-xl p-4 sm:p-6 border border-gray-700 min-h-[200px] flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-700/50 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <span className="text-gray-400 text-2xl">📢</span>
                    </div>
                    <p className="text-gray-400 text-sm">Advertisement Space</p>
                    <p className="text-gray-500 text-xs mt-1">300x250</p>
                  </div>
                </motion.div>

                {/* User Stats */}
                {user && walletAddress && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-gray-900/30 rounded-xl p-4 sm:p-6 border border-gray-700"
                  >
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <TrophyIcon className="w-5 h-5 text-yellow-400" />
                      Your Stats
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm">Points</span>
                        <span className="text-white font-bold">{userPoints.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm">Liked Articles</span>
                        <span className="text-white">{likedArticles.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm">Bookmarks</span>
                        <span className="text-white">{bookmarkedArticles.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm">Rank</span>
                        <span className="text-white">#{leaderboard.find(entry => entry.walletAddress === walletAddress)?.rank || 'N/A'}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Bookmarks */}
                {user && walletAddress && bookmarkedArticles.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 }}
                    className="bg-gray-900/30 rounded-xl p-4 sm:p-6 border border-gray-700"
                  >
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <BookmarkIcon className="w-5 h-5 text-yellow-400" />
                      Bookmarks
                    </h3>
                    
                    <div className="space-y-3">
                      {articles
                        .filter(article => bookmarkedArticles.includes(article.slug))
                        .slice(0, 3)
                        .map(article => (
                          <div key={article.slug} className="group cursor-pointer">
                            <div 
                              onClick={() => handleArticleClick(article.slug)}
                              className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
                            >
                              <h4 className="text-sm font-medium text-white mb-1 line-clamp-2 group-hover:text-blue-400 transition-colors">
                                {article.title}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>{getAuthorDisplayName()}</span>
                                <span>•</span>
                                <span>{formatDate(article.publishedAt)}</span>
                                <span>•</span>
                                <span>{article.readingTime || 5} min</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      
                      {bookmarkedArticles.length > 3 && (
                        <button className="w-full mt-3 px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors text-sm">
                          View all {bookmarkedArticles.length} bookmarks
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}



                {/* Mindshare Leaderboards */}
                <MindshareLeaderboards leaderboard={leaderboard} />



                {/* Daily Streak */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-4 sm:p-6 border border-orange-500/30"
                >
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <FireIcon className="w-5 h-5 text-orange-400" />
                    Daily Streak
                  </h3>
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-400 mb-2">{dailyStreak}</div>
                    <p className="text-gray-300 text-sm">days in a row</p>
                    <div className="mt-3 flex justify-center gap-1">
                      {[...Array(7)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full ${
                            i < Math.min(dailyStreak, 7) ? 'bg-orange-400' : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Weekly Reading Challenge */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl p-4 sm:p-6 border border-purple-500/30"
                >
                                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <BoltIcon className="w-5 h-5 text-purple-400" />
                      Weekly Goal
                    </h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300 text-sm">Progress</span>
                      <span className="text-white font-bold">{weeklyProgress}/{weeklyGoal}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((weeklyProgress / weeklyGoal) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-300 text-sm">Create {weeklyGoal} insights this week</p>
                      {weeklyProgress >= weeklyGoal && (
                        <div className="mt-2 flex items-center justify-center gap-2 text-green-400">
                          <span className="text-sm font-bold">Goal Complete!</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>


              </div>
            </div>
          </div>
        )}
      </main>



      {/* Author Application Modal */}
      <AnimatePresence>
        {showAuthorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-gray-900 rounded-xl p-4 w-full max-w-md max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Apply to be an Author</h2>
                <button
                  onClick={() => setShowAuthorModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                  <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Twitter Handle *</label>
                    <input
                      type="text"
                    value={authorApplication.twitterHandle}
                    onChange={(e) => setAuthorApplication(prev => ({ ...prev, twitterHandle: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="@yourhandle"
                    />
                  </div>
                  
                  <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Display Name (Alias)</label>
                  <input
                    type="text"
                    value={authorApplication.alias}
                    onChange={(e) => setAuthorApplication(prev => ({ ...prev, alias: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Your preferred display name"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Email *</label>
                    <input
                      type="email"
                      value={authorApplication.email}
                      onChange={(e) => setAuthorApplication(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="your.email@example.com"
                    />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Bio *</label>
                  <textarea
                    value={authorApplication.bio}
                    onChange={(e) => setAuthorApplication(prev => ({ ...prev, bio: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={2}
                    placeholder="Tell us about yourself and your background"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Topics of Interest</label>
                  <textarea
                    value={authorApplication.topics}
                    onChange={(e) => setAuthorApplication(prev => ({ ...prev, topics: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={2}
                    placeholder="What topics would you like to write about? (e.g., DeFi, NFTs, Layer 2, etc.)"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Additional Work</label>
                  <textarea
                    value={authorApplication.additionalWork}
                    onChange={(e) => setAuthorApplication(prev => ({ ...prev, additionalWork: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={2}
                    placeholder="Links to your previous articles, blog, or writing samples"
                  />
                </div>

                <div className="flex items-start gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="disclaimer"
                    checked={authorApplication.disclaimer}
                    onChange={(e) => setAuthorApplication(prev => ({ ...prev, disclaimer: e.target.checked }))}
                    className="mt-1 w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor="disclaimer" className="text-gray-300 text-sm">
                    I agree to not post low-quality content, self-promote, or shill paid promotions. I will provide valuable, authentic insights to the community. *
                  </label>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    onClick={handleAuthorApplication}
                    className="flex-1 px-4 py-2 bg-gradient-to-br from-blue-800 via-blue-500 to-blue-400 text-white rounded-lg hover:from-blue-700 hover:via-blue-600 hover:to-blue-500 transition-all duration-200 font-medium text-sm"
                  >
                    Submit Application
                  </button>
                  <button
                    onClick={() => setShowAuthorModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding Modal */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              {/* Onboarding Content */}
              <div className="text-center">
                {/* Step Indicator */}
                <div className="flex justify-center mb-6">
                  {[0, 1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`w-3 h-3 rounded-full mx-1 ${
                        step <= onboardingStep ? 'bg-blue-500' : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>

                {/* Step Content */}
                {onboardingStep === 0 && (
                  <div>
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Welcome to Insights</h2>
                    <p className="text-gray-300 mb-6 leading-relaxed">
                      Discover the latest developments, protocols, and market intelligence from the Base ecosystem. 
                      Our platform connects you with expert analysis and community-driven insights.
                    </p>
                  </div>
                )}

                {onboardingStep === 1 && (
                  <div>
                    <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Discover Content</h2>
                    <p className="text-gray-300 mb-6 leading-relaxed">
                      Use the search bar to find specific topics, authors, or keywords. 
                      Filter articles by category, author, or sort by date, views, or popularity to find exactly what you're looking for.
                    </p>
                    <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3 justify-center">
                        <div className="w-32 h-8 bg-gray-700 rounded"></div>
                        <div className="w-20 h-8 bg-gray-700 rounded"></div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Search • Filter</p>
                    </div>
                  </div>
                )}

                {onboardingStep === 2 && (
                  <div>
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Engage & Earn</h2>
                    <p className="text-gray-300 mb-6 leading-relaxed">
                      Like articles you find valuable and share insights with the community. 
                      Earn points for your engagement and climb the leaderboard. Your activity helps surface the best content.
                    </p>
                    <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-4 justify-center">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-500/20 rounded"></div>
                          <span className="text-sm text-gray-300">Like</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-500/20 rounded"></div>
                          <span className="text-sm text-gray-300">Share</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {onboardingStep === 3 && (
                  <div>
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Contribute & Grow</h2>
                    <p className="text-gray-300 mb-6 leading-relaxed">
                      Ready to share your expertise? Become an author and contribute your insights to the community. 
                      Earn rewards, build your reputation, and help others learn about Base Chain.
                    </p>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-5 h-5 bg-purple-400 rounded"></div>
                        <span className="text-sm text-purple-300 font-medium">Become Author</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-4 mt-8">
                  {onboardingStep > 0 && (
                    <button
                      onClick={() => setOnboardingStep(prev => prev - 1)}
                      className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 font-medium"
                    >
                      Previous
                    </button>
                  )}
                  
                  {onboardingStep < 3 ? (
                    <button
                      onClick={() => setOnboardingStep(prev => prev + 1)}
                      className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 font-medium"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowOnboarding(false);
                        localStorage.setItem('insights-onboarding-seen', 'true');
                      }}
                      className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 font-medium"
                    >
                      Get Started
                    </button>
                  )}
                </div>

                {/* Skip Button */}
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    localStorage.setItem('insights-onboarding-seen', 'true');
                  }}
                  className="mt-4 text-gray-400 hover:text-gray-300 transition-colors text-sm"
                >
                  Skip tutorial
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Point Transaction Modal */}
      {currentArticle && (
        <PointTransactionModal
          isOpen={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          onConfirm={handleConfirmAlphaTransaction}
          transaction={{
            action: 'alpha_boost',
            points: 25,
            description: `Apply Alpha Boost to article`,
            metadata: {
              articleId: currentArticle.id,
              articleSlug: currentArticle.slug,
              authorName: currentArticle.author
            }
          }}
          userPoints={userPoints}
          walletAddress={walletAddress}
        />
      )}

      <Footer />
    </div>
  );
}