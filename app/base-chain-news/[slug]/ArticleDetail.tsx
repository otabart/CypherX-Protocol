'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftIcon, 
  ClipboardIcon, 
  HandThumbUpIcon, 
  HandThumbDownIcon,
  EyeIcon,
  UserIcon,
  ClockIcon,
  PaperAirplaneIcon,
  HeartIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  doc, 
  updateDoc, 
  arrayUnion, 
  increment,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { useAuth } from '@/app/providers';
import { useAccount } from 'wagmi';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

interface ArticleProps {
  article: {
    id: string;
    title: string;
    content: string;
    author: string;
    source: string;
    slug: string;
    thumbnailUrl: string;
    publishedAt: string;
    views?: number;
    upvotes?: number;
    downvotes?: number;
    updatedAt?: string;
    category?: string;
    comments?: string[];
  };
}

interface Comment {
  id: string;
  articleSlug: string;
  userId: string;
  userAddress?: string;
  content: string;
  createdAt: string;
  likes: string[];
  dislikes: string[];
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function ArticleDetail({ article }: ArticleProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { address: walletAddress } = useAccount();
  
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [errorComments, setErrorComments] = useState<string | null>(null);
  const [articleStats, setArticleStats] = useState({
    views: article.views || 0,
    upvotes: article.upvotes || 0,
    downvotes: article.downvotes || 0,
  });
  const [userLiked, setUserLiked] = useState(false);
  const [userDisliked, setUserDisliked] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<Array<{
    id: string;
    title: string;
    content: string;
    author: string;
    source: string;
    slug: string;
    thumbnailUrl?: string;
    publishedAt: unknown;
    views?: number;
    upvotes?: number;
    downvotes?: number;
    updatedAt?: string;
    category?: string;
    comments?: string[];
  }>>([]);

  // ─── Utility Functions ───
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  const formatDate = (dateString: string | unknown): string => {
    const date = new Date(String(dateString));
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ─── Increment views on mount ───
  useEffect(() => {
    async function incrementViews() {
      try {
        const articleRef = doc(db, 'articles', article.id);
        await updateDoc(articleRef, { 
          views: increment(1), 
          updatedAt: new Date().toISOString() 
        });
        setArticleStats(prev => ({ ...prev, views: prev.views + 1 }));

        // Track user activity if logged in
        if (user && walletAddress) {
          await addDoc(collection(db, 'user_activities'), {
            userId: user.uid,
            walletAddress,
            action: 'read_article',
            points: 10,
            articleSlug: article.slug,
            createdAt: serverTimestamp()
          });

          // Update user points
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            points: increment(10)
          });
        }
      } catch (error) {
        console.error('Error incrementing views:', error);
      }
    }
    
    if (article.id) {
      incrementViews();
    }
  }, [article.id, user, walletAddress, article.slug]);

  // ─── Fetch comments ───
  useEffect(() => {
    async function fetchComments() {
      try {
        const q = query(
          collection(db, 'comments'), 
          where('articleSlug', '==', article.slug),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Comment));
        setComments(data);
      } catch (err) {
        console.error('Error fetching comments:', err);
        setErrorComments('Failed to load comments');
      } finally {
        setLoadingComments(false);
      }
    }
    fetchComments();
  }, [article.slug]);

  // ─── Fetch related articles ───
  useEffect(() => {
    async function fetchRelatedArticles() {
      try {
        const q = query(
          collection(db, 'articles'),
          where('category', '==', article.category),
          orderBy('publishedAt', 'desc'),
          limit(3)
        );
        const snap = await getDocs(q);
        const data = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as {
            id: string;
            title: string;
            content: string;
            author: string;
            source: string;
            slug: string;
            thumbnailUrl?: string;
            publishedAt: unknown;
            views?: number;
            upvotes?: number;
            downvotes?: number;
            updatedAt?: string;
            category?: string;
            comments?: string[];
          }))
          .filter(item => item.slug !== article.slug)
          .slice(0, 3);
        setRelatedArticles(data);
      } catch (error) {
        console.error('Error fetching related articles:', error);
      }
    }
    
    if (article.category) {
      fetchRelatedArticles();
    }
  }, [article.category, article.slug]);

  // ─── Check user's previous interactions ───
  useEffect(() => {
    async function checkUserInteractions() {
      if (!user || !walletAddress) return;
      
      try {
        const userDoc = await getDocs(query(collection(db, 'users'), where('walletAddress', '==', walletAddress)));
        
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          const likedArticles = userData.likedArticles || [];
          const dislikedArticles = userData.dislikedArticles || [];
          
          setUserLiked(likedArticles.includes(article.slug));
          setUserDisliked(dislikedArticles.includes(article.slug));
        }
      } catch (error) {
        console.error('Error checking user interactions:', error);
      }
    }
    
    checkUserInteractions();
  }, [user, walletAddress, article.slug]);

  // ─── Event Handlers ───
  const handleSubmitComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !walletAddress) {
      addToast('Please connect your wallet to comment.', 'error');
      return;
    }
    if (!newComment.trim()) {
      addToast('Comment cannot be empty.', 'error');
      return;
    }
    
    try {
      const commentData = {
        articleSlug: article.slug,
        userId: user.uid,
        userAddress: walletAddress,
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
        likes: [],
        dislikes: []
      };

      const docRef = await addDoc(collection(db, 'comments'), commentData);
      const newCommentObj = { id: docRef.id, ...commentData };
      setComments(prev => [newCommentObj, ...prev]);
      setNewComment('');

      // Track activity
      await addDoc(collection(db, 'user_activities'), {
        userId: user.uid,
        walletAddress,
        action: 'comment_article',
        points: 15,
        articleSlug: article.slug,
        createdAt: serverTimestamp()
      });

      // Update user points
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        points: increment(15)
      });

      addToast('Comment posted! +15 points', 'success');
    } catch (error) {
      console.error('Error posting comment:', error);
      addToast('Failed to post comment.', 'error');
    }
  };

  const toggleArticleVote = async (isUpvote: boolean) => {
    if (!user || !walletAddress) {
      addToast('Please connect your wallet to vote.', 'error');
      return;
    }

    try {
      const articleRef = doc(db, 'articles', article.id);
      const userRef = doc(db, 'users', user.uid);

      if (isUpvote) {
        if (userLiked) {
          // Unlike
          await updateDoc(articleRef, { upvotes: increment(-1) });
          setArticleStats(prev => ({ ...prev, upvotes: prev.upvotes - 1 }));
          setUserLiked(false);
        } else {
          // Like
          await updateDoc(articleRef, { upvotes: increment(1) });
          setArticleStats(prev => ({ ...prev, upvotes: prev.upvotes + 1 }));
          setUserLiked(true);
          
          // Remove dislike if exists
          if (userDisliked) {
            await updateDoc(articleRef, { downvotes: increment(-1) });
            setArticleStats(prev => ({ ...prev, downvotes: prev.downvotes - 1 }));
            setUserDisliked(false);
          }

          // Track activity
          await addDoc(collection(db, 'user_activities'), {
            userId: user.uid,
            walletAddress,
            action: 'like_article',
            points: 5,
            articleSlug: article.slug,
            createdAt: serverTimestamp()
          });

          // Update user points
          await updateDoc(userRef, {
            points: increment(5),
            likedArticles: arrayUnion(article.slug)
          });

          addToast('Article liked! +5 points', 'success');
        }
      } else {
        if (userDisliked) {
          // Remove dislike
          await updateDoc(articleRef, { downvotes: increment(-1) });
          setArticleStats(prev => ({ ...prev, downvotes: prev.downvotes - 1 }));
          setUserDisliked(false);
        } else {
          // Dislike
          await updateDoc(articleRef, { downvotes: increment(1) });
          setArticleStats(prev => ({ ...prev, downvotes: prev.downvotes + 1 }));
          setUserDisliked(true);
          
          // Remove like if exists
          if (userLiked) {
            await updateDoc(articleRef, { upvotes: increment(-1) });
            setArticleStats(prev => ({ ...prev, upvotes: prev.upvotes - 1 }));
            setUserLiked(false);
          }

          // Update user disliked articles
          await updateDoc(userRef, {
            dislikedArticles: arrayUnion(article.slug)
          });
        }
      }
    } catch (error: unknown) {
      console.error('Error toggling vote:', error);
      addToast('Failed to update vote.', 'error');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/base-chain-news/${article.slug}`);
      addToast('Link copied to clipboard!', 'success');
    } catch {
      addToast('Failed to copy link.', 'error');
    }
  };

  const shareToX = () => {
    const url = `${window.location.origin}/base-chain-news/${article.slug}`;
    const text = `Check out this article: ${article.title}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
    
    if (user && walletAddress) {
      // Track sharing activity
      addDoc(collection(db, 'user_activities'), {
        userId: user.uid,
        walletAddress,
        action: 'share_x',
        points: 10,
        articleSlug: article.slug,
        createdAt: serverTimestamp()
      }).then(() => {
        // Update user points
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { points: increment(10) });
        addToast('Shared to X! +10 points', 'success');
      }).catch(error => {
        console.error('Error tracking share:', error);
      });
    }
  };

  const shareToTelegram = () => {
    const url = `${window.location.origin}/base-chain-news/${article.slug}`;
    const text = `Check out this article: ${article.title}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    
    if (user && walletAddress) {
      // Track sharing activity
      addDoc(collection(db, 'user_activities'), {
        userId: user.uid,
        walletAddress,
        action: 'share_telegram',
        points: 10,
        articleSlug: article.slug,
        createdAt: serverTimestamp()
      }).then(() => {
        // Update user points
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { points: increment(10) });
        addToast('Shared to Telegram! +10 points', 'success');
      }).catch(error => {
        console.error('Error tracking share:', error);
      });
    }
  };

  const handleThumbnailError = () => {
    setFailedThumbnail('https://via.placeholder.com/800x400/1f2937/ffffff?text=Article+Image');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <Header />
      
      {/* Toast Notifications */}
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-2xl max-w-sm backdrop-blur-sm border ${
              toast.type === 'success' ? 'bg-green-500/90 text-white border-green-400/30' :
              toast.type === 'error' ? 'bg-red-500/90 text-white border-red-400/30' :
              'bg-blue-500/90 text-white border-blue-400/30'
            }`}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Hero Section with Back Button */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.back()}
            className="group flex items-center gap-3 text-blue-400 hover:text-blue-300 transition-all duration-300 hover:scale-105"
          >
            <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
              <ArrowLeftIcon className="w-5 h-5" />
            </div>
            <span className="font-medium">Back to News</span>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Article Content */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl overflow-hidden border border-gray-700/50 backdrop-blur-sm shadow-2xl"
            >
              {/* Article Header with Enhanced Design */}
              <div className="p-8 bg-gradient-to-r from-gray-800/30 to-gray-700/30">
                <div className="flex items-center gap-3 mb-6">
                  {article.category && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 text-sm rounded-full border border-blue-500/30 font-medium"
                    >
                      {article.category}
                    </motion.span>
                  )}
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-gray-400 text-sm flex items-center gap-2"
                  >
                    <ClockIcon className="w-4 h-4" />
                    {formatDate(article.publishedAt)}
                  </motion.span>
                </div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text"
                >
                  {article.title}
                </motion.h1>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-6 text-gray-300"
                >
                  <div className="flex items-center gap-2 p-3 bg-gray-700/30 rounded-lg">
                    <UserIcon className="w-5 h-5 text-blue-400" />
                    <span className="font-medium">{article.author}</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-700/30 rounded-lg">
                    <EyeIcon className="w-5 h-5 text-green-400" />
                    <span className="font-medium">{articleStats.views.toLocaleString()} views</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-700/30 rounded-lg">
                    <ClockIcon className="w-5 h-5 text-purple-400" />
                    <span className="font-medium">{article.source}</span>
                  </div>
                </motion.div>
              </div>

              {/* Enhanced Article Image */}
              {article.thumbnailUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="relative h-80 sm:h-96 lg:h-[500px] overflow-hidden"
                >
                  <Image
                    src={failedThumbnail || article.thumbnailUrl}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-700 hover:scale-105"
                    onError={handleThumbnailError}
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-4 text-white">
                      <div className="flex items-center gap-2">
                        <HeartIcon className="w-5 h-5 text-red-400" />
                        <span className="font-bold">{articleStats.upvotes}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <HandThumbDownIcon className="w-5 h-5 text-blue-400" />
                        <span className="font-bold">{articleStats.downvotes}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Enhanced Article Content */}
              <div className="p-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="prose prose-invert max-w-none"
                >
                  <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-lg sm:text-xl font-light">
                    {article.content}
                  </div>
                </motion.div>

                {/* Enhanced Article Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-12 pt-8 border-t border-gray-700/50"
                >
                  <div className="flex items-center gap-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleArticleVote(true)}
                      className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300 ${
                        userLiked
                          ? 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-400 border border-red-500/30 shadow-lg'
                          : 'bg-gradient-to-r from-gray-700/50 to-gray-600/50 text-gray-300 hover:from-gray-600/50 hover:to-gray-500/50 border border-gray-600/30'
                      }`}
                    >
                      <HeartIcon className="w-6 h-6" />
                      <span className="font-bold">{articleStats.upvotes}</span>
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleArticleVote(false)}
                      className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300 ${
                        userDisliked
                          ? 'bg-gradient-to-r from-red-500/20 to-pink-500/20 text-red-400 border border-red-500/30 shadow-lg'
                          : 'bg-gradient-to-r from-gray-700/50 to-gray-600/50 text-gray-300 hover:from-gray-600/50 hover:to-gray-500/50 border border-gray-600/30'
                      }`}
                    >
                      <HandThumbDownIcon className="w-6 h-6" />
                      <span className="font-bold">{articleStats.downvotes}</span>
                    </motion.button>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={copyLink}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 rounded-xl hover:from-blue-500/30 hover:to-purple-500/30 transition-all duration-300 border border-blue-500/30"
                    >
                      <ClipboardIcon className="w-5 h-5" />
                      Copy Link
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={shareToX}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 rounded-xl hover:from-blue-500/30 hover:to-purple-500/30 transition-all duration-300 border border-blue-500/30"
                    >
                      <ShareIcon className="w-5 h-5" />
                      Share X
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={shareToTelegram}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 rounded-xl hover:from-blue-500/30 hover:to-purple-500/30 transition-all duration-300 border border-blue-500/30"
                    >
                      <ShareIcon className="w-5 h-5" />
                      Share TG
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Enhanced Comments Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-8 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-700/50 backdrop-blur-sm shadow-2xl"
            >
              <div className="p-8">
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-3xl font-bold text-white mb-8 bg-gradient-to-r from-white to-gray-300 bg-clip-text"
                >
                  💬 Comments & Discussion
                </motion.h2>

                {/* Enhanced Comment Form */}
                {user && walletAddress && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 p-6 bg-gradient-to-r from-gray-700/30 to-gray-600/30 rounded-xl border border-gray-600/30"
                  >
                    <form onSubmit={handleSubmitComment} className="space-y-4">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Share your thoughts on this article... 💭"
                        className="w-full px-6 py-4 bg-gray-800/50 border border-gray-600/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-lg"
                        rows={4}
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">
                          {newComment.length}/500 characters
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          type="submit"
                          className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 font-medium shadow-lg"
                        >
                          <PaperAirplaneIcon className="w-5 h-5" />
                          Post Comment
                        </motion.button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {!user && !walletAddress && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20"
                  >
                    <p className="text-gray-300 text-center text-lg">
                      🔗 Connect your wallet to comment and earn points! 💰
                    </p>
                  </motion.div>
                )}

                {/* Enhanced Comments List */}
                {loadingComments ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="text-gray-400 mt-4 text-lg">Loading comments...</p>
                  </div>
                ) : errorComments ? (
                  <div className="text-center py-12">
                    <p className="text-red-400 text-lg">{errorComments}</p>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-lg">No comments yet. Be the first to share your thoughts! 🚀</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {comments.map((comment, index) => (
                      <motion.div
                        key={comment.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-6 bg-gradient-to-r from-gray-700/30 to-gray-600/30 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-all duration-300"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                              <UserIcon className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-300">
                                {comment.userAddress ? 
                                  `${comment.userAddress.slice(0, 6)}...${comment.userAddress.slice(-4)}` : 
                                  'Anonymous'
                                }
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDate(comment.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-200 mb-4 text-lg leading-relaxed">{comment.content}</p>
                        <div className="flex items-center gap-6">
                          <button className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors">
                            <HandThumbUpIcon className="w-5 h-5" />
                            <span className="text-sm font-medium">{comment.likes.length}</span>
                          </button>
                          <button className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors">
                            <HandThumbDownIcon className="w-5 h-5" />
                            <span className="text-sm font-medium">{comment.dislikes.length}</span>
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Enhanced Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Enhanced Related Articles */}
              {relatedArticles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl p-6 border border-gray-700/50 backdrop-blur-sm shadow-2xl"
                >
                  <h3 className="text-xl font-bold text-white mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text">
                    📚 Related Articles
                  </h3>
                  <div className="space-y-4">
                    {relatedArticles.map((relatedArticle, index) => (
                      <motion.div
                        key={relatedArticle.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.9 + index * 0.1 }}
                        className="cursor-pointer group p-4 bg-gray-700/20 rounded-xl border border-gray-600/30 hover:border-gray-500/50 transition-all duration-300"
                        onClick={() => router.push(`/base-chain-news/${relatedArticle.slug}`)}
                      >
                        <h4 className="text-sm font-medium text-gray-300 group-hover:text-blue-400 transition-colors line-clamp-2 mb-2">
                          {relatedArticle.title}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {formatDate(relatedArticle.publishedAt)}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Enhanced Article Stats */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 }}
                className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl p-6 border border-gray-700/50 backdrop-blur-sm shadow-2xl"
              >
                <h3 className="text-xl font-bold text-white mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text">
                  📊 Article Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-700/20 rounded-lg">
                    <span className="text-gray-300">👁️ Views</span>
                    <span className="text-white font-bold text-lg">{articleStats.views.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-700/20 rounded-lg">
                    <span className="text-gray-300">👍 Upvotes</span>
                    <span className="text-green-400 font-bold text-lg">{articleStats.upvotes}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-700/20 rounded-lg">
                    <span className="text-gray-300">👎 Downvotes</span>
                    <span className="text-red-400 font-bold text-lg">{articleStats.downvotes}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-700/20 rounded-lg">
                    <span className="text-gray-300">💬 Comments</span>
                    <span className="text-blue-400 font-bold text-lg">{comments.length}</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
