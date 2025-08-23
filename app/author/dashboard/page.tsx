"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSystem } from "@/hooks/useWalletSystem";
import { 
  FiPlus, 
  FiEdit, 
  FiEye, 
  FiTrendingUp, 
  FiUsers, 
  FiMessageSquare,
  FiCalendar,
  FiBarChart3,
  FiSettings,
  FiFileText,
  FiDollarSign
} from "react-icons/fi";
import { HiOutlineSparkles } from "react-icons/hi";

interface AuthorStats {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalEarnings: number;
  monthlyViews: number;
  monthlyLikes: number;
  monthlyComments: number;
  monthlyEarnings: number;
}

interface AuthorPost {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  views: number;
  likes: number;
  comments: number;
  earnings: number;
  publishedAt?: string;
  updatedAt: string;
}

const AuthorDashboard = () => {
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
  const walletAddress = selfCustodialWallet?.address;

  const [isAuthor, setIsAuthor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AuthorStats>({
    totalPosts: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalEarnings: 0,
    monthlyViews: 0,
    monthlyLikes: 0,
    monthlyComments: 0,
    monthlyEarnings: 0
  });
  const [posts, setPosts] = useState<AuthorPost[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check if user is an author
  useEffect(() => {
    const checkAuthorStatus = async () => {
      if (!walletAddress) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/author/status?walletAddress=${walletAddress}`);
        if (response.ok) {
          const data = await response.json();
          setIsAuthor(data.isAuthor);
          if (data.isAuthor) {
            fetchAuthorData();
          }
        }
      } catch (error) {
        console.error('Error checking author status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthorStatus();
  }, [walletAddress]);

  const fetchAuthorData = async () => {
    if (!walletAddress) return;

    try {
      // Fetch author stats
      const statsResponse = await fetch(`/api/author/stats?walletAddress=${walletAddress}`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch author posts
      const postsResponse = await fetch(`/api/author/posts?walletAddress=${walletAddress}`);
      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        setPosts(postsData.posts || []);
      }
    } catch (error) {
      console.error('Error fetching author data:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-gray-400 mt-4 text-lg">Loading author dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthor) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiFileText className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Author Access Required</h1>
          <p className="text-gray-400 mb-6">
            You need to be approved as an author to access the dashboard. 
            Apply to become an author to start creating content.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/insights'}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium"
          >
            Apply to Become an Author
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Author Dashboard</h1>
              <p className="text-gray-400 mt-1">Create, manage, and track your content performance</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium"
            >
              <FiPlus className="w-5 h-5" />
              Create Post
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-6 border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-sm font-medium">Total Posts</p>
                <p className="text-white text-2xl font-bold">{stats.totalPosts}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <FiFileText className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl p-6 border border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm font-medium">Total Views</p>
                <p className="text-white text-2xl font-bold">{formatNumber(stats.totalViews)}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <FiEye className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-6 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-400 text-sm font-medium">Total Earnings</p>
                <p className="text-white text-2xl font-bold">{formatNumber(stats.totalEarnings)} pts</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <FiDollarSign className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl p-6 border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-400 text-sm font-medium">Monthly Views</p>
                <p className="text-white text-2xl font-bold">{formatNumber(stats.monthlyViews)}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <FiTrendingUp className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Posts Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Your Posts</h2>
          </div>
          
          {posts.length === 0 ? (
            <div className="p-8 text-center">
              <FiFileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">No posts yet</p>
              <p className="text-gray-500">Create your first post to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {posts.map((post) => (
                <div key={post.id} className="p-6 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-white">{post.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          post.status === 'published' ? 'bg-green-500/20 text-green-400' :
                          post.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <FiEye className="w-4 h-4" />
                          <span>{formatNumber(post.views)} views</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FiTrendingUp className="w-4 h-4" />
                          <span>{formatNumber(post.likes)} likes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FiMessageSquare className="w-4 h-4" />
                          <span>{formatNumber(post.comments)} comments</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FiDollarSign className="w-4 h-4" />
                          <span>{formatNumber(post.earnings)} pts</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FiCalendar className="w-4 h-4" />
                          <span>{formatDate(post.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.open(`/insights/${post.slug}`, '_blank')}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <FiEye className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.open(`/author/edit/${post.id}`, '_blank')}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <FiEdit className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Create Post Modal would go here */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">Create New Post</h3>
            <p className="text-gray-400 mb-6">Post creation interface coming soon...</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthorDashboard;
