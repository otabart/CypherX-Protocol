'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { ClipboardIcon, HeartIcon, HandThumbDownIcon } from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, getDocs, limit, getDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/app/providers';

// Define interfaces
interface NewsArticle {
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
}

interface RelatedArticle {
  title: string;
  slug: string;
  publishedAt: string;
}

interface Comment {
  id: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  likes: string[];
  dislikes: string[];
  replies: Comment[];
}

interface Ad {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  altText: string;
  type: 'banner' | 'sidebar' | 'inline';
  createdAt: string;
  endAt: string;
}

interface NewsPageProps {
  params: { slug: string };
}

// Animation variants
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const letterVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
    },
  },
};

const dotsVariants: Variants = {
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3,
      repeat: Infinity,
      repeatType: 'loop' as const,
    },
  },
};

const dotVariants: Variants = {
  animate: {
    opacity: [0, 1, 0],
    transition: {
      duration: 0.9,
    },
  },
};

// Utility function to highlight @mentions and link to X
const highlightMentions = (text: string) => {
  const mentionRegex = /@([a-zA-Z0-9_]{1,15})/g;
  const highlightedText = text.replace(
    mentionRegex,
    `<a href="https://x.com/$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 transition-colors duration-300">@$1</a>`
  );
  return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
};

// Fallback ad
const fallbackAd: Ad = {
  id: '',
  imageUrl: 'https://via.placeholder.com/728x90?text=Your+Ad+Here',
  destinationUrl: '#',
  altText: 'Advertise with Us',
  type: 'banner',
  createdAt: '',
  endAt: '',
};

// Mock data for testing Articles You May Like
const mockArticlesYouMayLike: RelatedArticle[] = [
  {
    title: 'Base Chain Surpasses $1B in TVL: What’s Next?',
    slug: 'base-chain-surpasses-1b-tvl',
    publishedAt: '2025-05-03T10:00:00Z',
  },
  {
    title: 'DeFi on Base: Top Projects to Watch in 2025',
    slug: 'defi-on-base-top-projects-2025',
    publishedAt: '2025-05-02T12:00:00Z',
  },
  {
    title: 'Clanker on Base: A New Era for Blockchain Analytics',
    slug: 'clanker-on-base-new-era',
    publishedAt: '2025-05-01T09:00:00Z',
  },
];

export default function NewsPage({ params }: NewsPageProps) {
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [articlesYouMayLike, setArticlesYouMayLike] = useState<RelatedArticle[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyComment, setReplyComment] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [bannerAds, setBannerAds] = useState<Ad[]>([]);
  const [sidebarAds, setSidebarAds] = useState<Ad[]>([]);
  const [inlineAds, setInlineAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [copied, setCopied] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [isFeatured, setIsFeatured] = useState(false);
  const { user, walletAddress, loading: authLoading } = useAuth();

  // Fetch article, ads, and related articles
  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/news/${params.slug}`);
        if (!res.ok) {
          setError('Article not found');
          return;
        }
        const data: NewsArticle = await res.json();
        setArticle(data);
        setLastUpdated(new Date().toLocaleString());
      } catch (err) {
        console.error('Error fetching article:', err);
        setError('Error fetching article');
      }
    }

    async function fetchAds() {
      try {
        const adsSnapshot = await getDocs(collection(db, 'adImageUrl'));
        const currentDate = new Date();
        const ads = adsSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as Ad))
          .filter((ad) => {
            const endDate = new Date(ad.endAt);
            return !ad.endAt || endDate >= currentDate;
          });

        setBannerAds(ads.filter((ad) => ad.type === 'banner'));
        setSidebarAds(ads.filter((ad) => ad.type === 'sidebar'));
        setInlineAds(ads.filter((ad) => ad.type === 'inline').slice(0, 1));
      } catch (err) {
        console.error('Error fetching ads:', err);
      }
    }

    async function fetchArticlesYouMayLike() {
      try {
        const articlesSnapshot = await getDocs(
          query(collection(db, 'news'), orderBy('publishedAt', 'desc'))
        );
        const articles: RelatedArticle[] = articlesSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              title: data.title ?? 'Untitled Article',
              slug: data.slug ?? '',
              publishedAt: data.publishedAt ?? new Date().toISOString(),
            };
          })
          .filter((article) => article.slug !== params.slug && article.slug && article.title)
          .slice(0, 3);

        if (articles.length === 0) {
          setArticlesYouMayLike(mockArticlesYouMayLike);
        } else {
          setArticlesYouMayLike(articles);
        }
      } catch (err) {
        console.error('Error fetching articles you may like:', err);
        setArticlesYouMayLike(mockArticlesYouMayLike);
      }
    }

    async function checkIfFeatured() {
      try {
        const latestArticleSnapshot = await getDocs(
          query(collection(db, 'news'), orderBy('publishedAt', 'desc'), limit(1))
        );
        if (!latestArticleSnapshot.empty) {
          const latestArticle = latestArticleSnapshot.docs[0].data();
          if (latestArticle.slug === params.slug) {
            setIsFeatured(true);
          }
        }
      } catch (err) {
        console.error('Error checking featured status:', err);
      }
    }

    Promise.all([fetchArticle(), fetchAds(), fetchArticlesYouMayLike(), checkIfFeatured()]).finally(() => setLoading(false));
  }, [params.slug]);

  // Live uptime counter
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setUptime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Ad rotation
  const [bannerIndex, setBannerIndex] = useState(0);
  const [sidebarIndex, setSidebarIndex] = useState(0);
  const [inlineIndex, setInlineIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % (bannerAds.length || 1));
      setSidebarIndex((prev) => (prev + 1) % (sidebarAds.length || 1));
      setInlineIndex((prev) => (prev + 1) % (inlineAds.length || 1));
    }, 30000);
    return () => clearInterval(interval);
  }, [bannerAds.length, sidebarAds.length, inlineAds.length]);

  const currentBannerAd = bannerAds.length > 0 ? bannerAds[bannerIndex] : fallbackAd;
  const currentSidebarAd = sidebarAds.length > 0 ? sidebarAds[sidebarIndex] : { ...fallbackAd, type: 'sidebar', imageUrl: 'https://via.placeholder.com/400x300?text=Your+Ad+Here' };
  const currentInlineAd = inlineAds.length > 0 ? inlineAds[inlineIndex] : { ...fallbackAd, type: 'inline' };

  // Fetch comments
  useEffect(() => {
    if (!article) return;

    const q = query(
      collection(db, 'comments'),
      where('articleSlug', '==', params.slug),
      where('parentId', '==', null),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const commentsData: Comment[] = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const userDoc = await getUserData(data.userId);
        const replies = await fetchReplies(doc.id);
        commentsData.push({
          id: doc.id,
          userId: data.userId,
          username: userDoc?.username || 'Anonymous',
          content: data.content,
          createdAt: data.createdAt?.toDate().toLocaleString() || new Date().toLocaleString(),
          likes: data.likes || [],
          dislikes: data.dislikes || [],
          replies,
        });
      }
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [article, params.slug]);

  const fetchReplies = async (parentId: string): Promise<Comment[]> => {
    const repliesQuery = query(
      collection(db, 'comments'),
      where('parentId', '==', parentId),
      orderBy('createdAt', 'asc')
    );
    const repliesSnapshot = await getDocs(repliesQuery);
    const replies: Comment[] = [];
    for (const doc of repliesSnapshot.docs) {
      const data = doc.data();
      const userDoc = await getUserData(data.userId);
      replies.push({
        id: doc.id,
        userId: data.userId,
        username: userDoc?.username || 'Anonymous',
        content: data.content,
        createdAt: data.createdAt?.toDate().toLocaleString() || new Date().toLocaleString(),
        likes: data.likes || [],
        dislikes: data.dislikes || [],
        replies: [],
      });
    }
    return replies;
  };

  const getUserData = async (userId: string) => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    return userDoc.exists() ? userDoc.data() : null;
  };

  const postComment = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault();
    if (!user || !walletAddress) {
      alert('Please connect your wallet to post a comment.');
      return;
    }
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) {
      alert('Comment cannot be empty.');
      return;
    }

    try {
      const commentData = {
        articleSlug: params.slug,
        userId: user.uid,
        content,
        createdAt: new Date(),
        likes: [],
        dislikes: [],
        parentId,
      };
      await addDoc(collection(db, 'comments'), commentData);
      await addDoc(collection(db, 'user_activities'), {
        userId: user.uid,
        walletAddress,
        action: parentId ? 'comment_reply' : 'comment',
        points: 1,
        articleSlug: params.slug,
        createdAt: serverTimestamp(),
      });
      if (parentId) {
        setReplyContent('');
        setReplyComment(null);
      } else {
        setNewComment('');
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      alert('Error posting comment.');
    }
  };

  const handleLikeDislike = async (commentId: string, action: 'like' | 'dislike') => {
    if (!user || !walletAddress) {
      alert('Please connect your wallet to like or dislike a comment.');
      return;
    }

    try {
      const commentRef = doc(db, 'comments', commentId);
      const commentDoc = await getDoc(commentRef);
      if (!commentDoc.exists()) return;

      const data = commentDoc.data();
      let updatedLikes = data.likes || [];
      let updatedDislikes = data.dislikes || [];

      if (action === 'like') {
        if (updatedLikes.includes(walletAddress)) {
          updatedLikes = updatedLikes.filter((addr: string) => addr !== walletAddress);
        } else {
          updatedLikes.push(walletAddress);
          updatedDislikes = updatedDislikes.filter((addr: string) => addr !== walletAddress);
          await addDoc(collection(db, 'user_activities'), {
            userId: user.uid,
            walletAddress,
            action: 'comment_like',
            points: 0.5,
            articleSlug: params.slug,
            commentId,
            createdAt: serverTimestamp(),
          });
        }
      } else {
        if (updatedDislikes.includes(walletAddress)) {
          updatedDislikes = updatedDislikes.filter((addr: string) => addr !== walletAddress);
        } else {
          updatedDislikes.push(walletAddress);
          updatedLikes = updatedLikes.filter((addr: string) => addr !== walletAddress);
          await addDoc(collection(db, 'user_activities'), {
            userId: user.uid,
            walletAddress,
            action: 'comment_dislike',
            points: 0.5,
            articleSlug: params.slug,
            commentId,
            createdAt: serverTimestamp(),
          });
        }
      }

      await updateDoc(commentRef, { likes: updatedLikes, dislikes: updatedDislikes });
    } catch (err) {
      console.error(`Error updating ${action}:`, err);
      alert(`Error updating ${action}.`);
    }
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToX = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out this article on CypherScan: ${article?.title || ''}`);
    const shareUrl = `https://x.com/intent/tweet?text=${text}&url=${url}`;
    window.open(shareUrl, 'Share to X', 'width=600,height=400');
  };

  const shareToTelegram = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out this article on CypherScan: ${article?.title || ''}`);
    const shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
    window.open(shareUrl, 'Share to Telegram', 'width=600,height=400');
  };

  const shareToReddit = () => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(article?.title || 'Article on CypherScan');
    const shareUrl = `https://www.reddit.com/submit?url=${url}&title=${title}`;
    window.open(shareUrl, 'Share to Reddit', 'width=600,height=400');
  };

  const handleAdImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, adType: string) => {
    console.warn(`Ad image failed to load (${adType}):`, e.currentTarget.src);
    if (adType === 'banner') {
      e.currentTarget.src = 'https://via.placeholder.com/728x90?text=Your+Ad+Here';
    } else if (adType === 'sidebar') {
      e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Your+Ad+Here';
    } else if (adType === 'inline') {
      e.currentTarget.src = 'https://via.placeholder.com/300x250?text=Your+Ad+Here';
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-blue-400 text-lg font-sans">
          Loading
          <motion.span variants={dotsVariants} animate="animate" className="inline-flex">
            <motion.span variants={dotVariants}>.</motion.span>
            <motion.span variants={dotVariants}>.</motion.span>
            <motion.span variants={dotVariants}>.</motion.span>
          </motion.span>
        </p>
      </div>
    );
  }

  if (error || !article) {
    return notFound();
  }

  const titleCharacters = article.title.split('');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans relative">
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-blue-500/30 p-2 text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1 overflow-x-auto z-10">
        <span className="whitespace-nowrap">SYS: Cypher News on CypherScan v1.0.0</span>
        <span className="whitespace-nowrap">UPTIME: {uptime}s</span>
        <span className="whitespace-nowrap">LAST UPDATED: {lastUpdated}</span>
      </div>

      <div className="py-6 sm:py-12 pb-24 sm:pb-16">
        <div className="w-full bg-gray-950">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-4 sm:mb-6 fixed top-4 sm:static z-20"
            >
              <Link
                href="/base-chain-news"
                className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors duration-300 px-3 py-1.5 sm:p-0 rounded-md sm:rounded-none text-sm"
                aria-label="Back to news"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back to News
              </Link>
            </motion.div>

            <div className="relative">
              <motion.h1
                className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 break-words"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{ direction: 'ltr', textAlign: 'left' }}
              >
                {titleCharacters.map((char, index) => (
                  <motion.span key={index} variants={letterVariants}>
                    {char}
                  </motion.span>
                ))}
              </motion.h1>
              {isFeatured && (
                <span className="absolute top-0 right-0 inline-block text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded-md">
                  Featured
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
              <div className="text-sm text-gray-400">
                <span>By {article.author}</span>
                <span className="mx-2 hidden sm:inline">|</span>
                <span className="block sm:inline">
                  {new Date(article.publishedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={shareToX}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Share to X"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Share on X
                </button>
                <button
                  onClick={shareToTelegram}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Share to Telegram"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c.1.564 1.725.24l23.99 4.477c.392-1.178-.484-1.71-1.297-1.34L2.705 12.162c-1.178.392-.803 1.586.098 1.965l5.508 1.717l12.785-8.03c.392-.244.814-.098.491.392z" />
                  </svg>
                  Telegram
                </button>
                <button
                  onClick={shareToReddit}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Share to Reddit"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547l-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.548 3.548 0 0 1 .1 1.575c0 3.135-3.622 5.686-8.086 5.686-4.465 0-8.086-2.551-8.086-5.686 0-.548.043-1.085.135-1.605-.582-.282-1.02-.9-1.02-1.617a1.755 1.755 0 0 1 1.754-1.754c.474 0 .897.181 1.206.49 1.207-.87 2.89-1.416 4.678-1.488l.8-3.747-2.59.547a1.25 1.25 0 0 1-2.498-.056 1.25 1.25 0 0 1 1.248-1.248c.467 0 .87.244 1.088.616l3.144-.664c.536-.11 1.094.287 1.094.84zm-4.16 10.865c-.956 0-1.732.775-1.732 1.732s.776 1.732 1.732 1.732c.957 0 1.732-.775 1.732-1.732s-.775-1.732-1.732-1.732zm3.847 0c-.957 0-1.732.775-1.732 1.732s.775 1.732 1.732 1.732c.956 0 1.732-.775 1.732-1.732s-.776-1.732-1.732-1.732z" />
                  </svg>
                  Reddit
                </button>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Copy article link"
                >
                  <ClipboardIcon className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2">
            <div className="my-6 sm:my-8">
              <div className="text-center text-xs text-gray-400 mb-3">Advertisement</div>
              <a href={currentBannerAd.destinationUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={currentBannerAd.imageUrl}
                  alt={currentBannerAd.altText}
                  className="w-full h-[60px] sm:h-[80px] lg:h-[90px] rounded-lg border border-blue-500/20 object-cover"
                  onError={(e) => handleAdImageError(e, 'banner')}
                  loading="lazy"
                  aria-label="Banner advertisement"
                />
              </a>
            </div>

            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="mb-6 sm:mb-8"
            >
              <p className="text-base sm:text-lg text-gray-200 leading-relaxed mb-4">
                {highlightMentions(article.content)}
              </p>
              <div className="text-sm text-gray-400">
                Source: {article.source}
              </div>
            </motion.div>

            <div className="my-6 sm:my-8 flex justify-center">
              <div>
                <div className="text-center text-xs text-gray-400 mb-3">Advertisement</div>
                <a href={currentInlineAd.destinationUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={currentInlineAd.imageUrl}
                    alt={currentInlineAd.altText}
                    className="w-full max-w-[300px] h-auto rounded-lg border border-blue-500/20 object-cover"
                    onError={(e) => handleAdImageError(e, 'inline')}
                    loading="lazy"
                    aria-label="Inline advertisement"
                  />
                </a>
              </div>
            </div>

            <div className="mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">
                Articles You May Like
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {articlesYouMayLike.map((relatedArticle, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    className="bg-gray-900 border border-blue-500/20 rounded-lg p-3 sm:p-4 hover:shadow-[0_0_8px_rgba(37,99,235,0.2)] transition-shadow duration-300"
                  >
                    <Link href={`/base-chain-news/${relatedArticle.slug}`} className="block">
                      <h3 className="text-base sm:text-lg font-medium text-white mb-1 line-clamp-2">
                        {relatedArticle.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-400">
                        {new Date(relatedArticle.publishedAt).toLocaleDateString()}
                      </p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6">
                Comments
              </h2>
              <div className="bg-gray-900 border border-blue-500/20 rounded-lg p-4 sm:p-6">
                {user && walletAddress ? (
                  <form onSubmit={(e) => postComment(e)} className="mb-4 sm:mb-6">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="w-full p-3 bg-gray-800 border border-gray-700 rounded-md text-gray-200 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                      rows={3}
                      aria-label="Comment input"
                    />
                    <button
                      type="submit"
                      className="mt-2 px-4 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm sm:text-base text-blue-400 hover:text-blue-300 transition-all duration-300"
                      aria-label="Post comment"
                    >
                      Post Comment
                    </button>
                  </form>
                ) : (
                  <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6">
                    <Link href="/login" className="text-blue-400 hover:text-blue-300">
                      Connect wallet
                    </Link>{' '}
                    to post a comment.
                  </p>
                )}

                {comments.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="bg-gray-800 border border-gray-700 rounded-md p-3 sm:p-4"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm sm:text-base font-medium text-white">
                            {comment.username}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-400">{comment.createdAt}</span>
                        </div>
                        <p className="text-sm sm:text-base text-gray-200 mb-2">{comment.content}</p>
                        <div className="flex items-center gap-3 mb-2">
                          <button
                            onClick={() => handleLikeDislike(comment.id, 'like')}
                            className={`flex items-center gap-1 text-xs sm:text-sm text-${
                              comment.likes.includes(walletAddress || '') ? 'blue-400' : 'gray-400'
                            }`}
                            disabled={!user || !walletAddress}
                            aria-label="Like comment"
                          >
                            <HeartIcon className="w-4 h-4" />
                            {comment.likes.length}
                          </button>
                          <button
                            onClick={() => handleLikeDislike(comment.id, 'dislike')}
                            className={`flex items-center gap-1 text-xs sm:text-sm text-${
                              comment.dislikes.includes(walletAddress || '') ? 'red-400' : 'gray-400'
                            }`}
                            disabled={!user || !walletAddress}
                            aria-label="Dislike comment"
                          >
                            <HandThumbDownIcon className="w-4 h-4" />
                            {comment.dislikes.length}
                          </button>
                          <button
                            onClick={() => setReplyComment(comment.id)}
                            className="text-xs sm:text-sm text-blue-400 hover:text-blue-300"
                            aria-label="Reply to comment"
                          >
                            Reply
                          </button>
                        </div>
                        {replyComment === comment.id && (
                          <form
                            onSubmit={(e) => postComment(e, comment.id)}
                            className="mt-2"
                          >
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Add a reply..."
                              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                              rows={2}
                              aria-label="Reply input"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                type="submit"
                                className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-all duration-300"
                                aria-label="Post reply"
                              >
                                Post Reply
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyComment(null);
                                  setReplyContent('');
                                }}
                                className="px-3 py-1 bg-gray-500/20 hover:bg-gray-500/40 border border-gray-500/30 rounded-md text-sm text-gray-400 hover:text-gray-300 transition-all duration-300"
                                aria-label="Cancel reply"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                        {comment.replies.length > 0 && (
                          <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-700 pl-3">
                            {comment.replies.map((reply) => (
                              <div
                                key={reply.id}
                                className="bg-gray-700 border border-gray-600 rounded-md p-2"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-white">
                                    {reply.username}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {reply.createdAt}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-200 mb-1">{reply.content}</p>
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => handleLikeDislike(reply.id, 'like')}
                                    className={`flex items-center gap-1 text-xs text-${
                                      reply.likes.includes(walletAddress || '')
                                        ? 'blue-400'
                                        : 'gray-400'
                                    }`}
                                    disabled={!user || !walletAddress}
                                    aria-label="Like reply"
                                  >
                                    <HeartIcon className="w-4 h-4" />
                                    {reply.likes.length}
                                  </button>
                                  <button
                                    onClick={() => handleLikeDislike(reply.id, 'dislike')}
                                    className={`flex items-center gap-1 text-xs text-${
                                      reply.dislikes.includes(walletAddress || '')
                                        ? 'red-400'
                                        : 'gray-400'
                                    }`}
                                    disabled={!user || !walletAddress}
                                    aria-label="Dislike reply"
                                  >
                                    <HandThumbDownIcon className="w-4 h-4" />
                                    {reply.dislikes.length}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm sm:text-base text-gray-400">
                    No comments yet. Be the first to comment!
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 space-y-8">
              <div>
                <div className="text-center text-xs text-gray-400 mb-3">Advertisement</div>
                <a href={currentSidebarAd.destinationUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={currentSidebarAd.imageUrl}
                    alt={currentSidebarAd.altText}
                    className="w-full max-w-[400px] max-h-[300px] mx-auto rounded-lg border border-blue-500/20 object-cover"
                    onError={(e) => handleAdImageError(e, 'sidebar')}
                    loading="lazy"
                    aria-label="Sidebar advertisement"
                  />
                </a>
              </div>
              <div className="bg-gray-900 border border-blue-500/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Join Our Community</h3>
                <div className="space-y-3">
                  <a
                    href="https://x.com/CypherXProtocol"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Follow us on X
                  </a>
                  <a
                    href="https://t.me/CypherXCommunity"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c.1.564 1.725.267 2.02-.421L23.99 4.477c.392-1.178-.484-1.71-1.297-1.34L2.705 12.162c-1.178.392-.803 1.586.098 1.965l5.508 1.717 12.785-8.03c.392-.244.814-.098.491.392z" />
                    </svg>
                    Join our Telegram
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}