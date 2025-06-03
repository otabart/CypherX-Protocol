'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ClipboardIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/app/providers';
import { useAccount } from 'wagmi';

// ────────── Types ──────────

interface NewsArticle {
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
  thumbnailUrl?: string;
}

interface ArticleStats {
  slug: string;
  views: number;
  likes: number;
  dislikes: number;
  comments: number;
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

interface AuthorApplication {
  name: string;
  email: string;
  walletAddress: string;
  sampleWork: string;
  status: 'pending' | 'approved' | 'rejected';
}

// ────────── Animation variants ──────────

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const titleVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const letterVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

// ────────── Utility functions ──────────

const truncateAtWord = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace === -1) return truncated + '...';
  return truncated.slice(0, lastSpace) + '...';
};

const highlightMentions = (text: string) => {
  const mentionRegex = /@([a-zA-Z0-9_]{1,15})/g;
  const highlighted = text.replace(
    mentionRegex,
    `<a href="https://x.com/$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 transition-colors duration-300">@$1</a>`
  );
  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
};

const fallbackAd: Ad = {
  id: '',
  imageUrl: 'https://via.placeholder.com/728x90?text=Your+Ad+Here',
  destinationUrl: '#',
  altText: 'Advertise with Us',
  type: 'banner',
  createdAt: '',
  endAt: '',
};

const FALLBACK_THUMBNAIL =
  'https://firebasestorage.googleapis.com/v0/b/homebase-dapp.firebasestorage.app/o/default-thumbnail.jpg?alt=media';

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [bannerAds, setBannerAds] = useState<Ad[]>([]);
  const [sidebarAds, setSidebarAds] = useState<Ad[]>([]);
  const [inlineAds, setInlineAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [uptime, setUptime] = useState(0);
  const [applicationForm, setApplicationForm] = useState<AuthorApplication>({
    name: '',
    email: '',
    walletAddress: '',
    sampleWork: '',
    status: 'pending',
  });
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [authorStats, setAuthorStats] = useState<ArticleStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const { user, walletAddress: authWalletAddress, loading: authLoading } =
    useAuth() as { user: any; walletAddress: string | null; loading: boolean };
  const { address: wagmiAddress } = useAccount();
  const router = useRouter();

  // Fallback to Wagmi if context doesn’t supply walletAddress
  const walletAddress = authWalletAddress || wagmiAddress || null;

  // ─── Fetch articles + ads on mount ───
  useEffect(() => {
    async function fetchArticles() {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) throw new Error('Failed to fetch articles');
        const data: NewsArticle[] = await res.json();
        const sorted = data.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        setArticles(sorted);
        setLastUpdated(new Date().toLocaleString());
      } catch (err) {
        console.error('Error fetching articles:', err);
        setError('Error fetching articles');
      }
    }

    async function fetchAds() {
      try {
        const adsSnap = await getDocs(collection(db, 'adImageUrl'));
        const now = new Date();
        const ads = adsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Ad))
          .filter((ad) => {
            const endDate = new Date(ad.endAt);
            return !ad.endAt || endDate >= now;
          });
        setBannerAds(ads.filter((ad) => ad.type === 'banner'));
        setSidebarAds(ads.filter((ad) => ad.type === 'sidebar'));
        setInlineAds(ads.filter((ad) => ad.type === 'inline').slice(0, 3));
      } catch (err) {
        console.error('Error fetching ads:', err);
      }
    }

    Promise.all([fetchArticles(), fetchAds()]).finally(() => setLoading(false));
  }, []);

  // ─── Live uptime counter ───
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ─── Rotate ads every 30s ───
  const [bannerIndex, setBannerIndex] = useState(0);
  const [sidebarIndex, setSidebarIndex] = useState(0);
  const [inlineIndex, setInlineIndex] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % (bannerAds.length || 1));
      setSidebarIndex((prev) => (prev + 1) % (sidebarAds.length || 1));
      setInlineIndex((prev) => (prev + 1) % (inlineAds.length || 1));
    }, 30000);
    return () => clearInterval(iv);
  }, [bannerAds.length, sidebarAds.length, inlineAds.length]);

  const currentBannerAd =
    bannerAds.length > 0 ? bannerAds[bannerIndex] : fallbackAd;
  const currentSidebarAd =
    sidebarAds.length > 0
      ? sidebarAds[sidebarIndex]
      : {
          ...fallbackAd,
          type: 'sidebar',
          imageUrl: 'https://via.placeholder.com/400x300?text=Your+Ad+Here',
        };
  const getCurrentInlineAd = (idx: number) =>
    inlineAds.length > 0
      ? inlineAds[(inlineIndex + idx) % inlineAds.length]
      : { ...fallbackAd, type: 'inline' };

  // ─── Fetch author stats ───
  const fetchAuthorStats = async () => {
    if (!user || !walletAddress) return;
    setStatsLoading(true);
    try {
      const statsQ = query(
        collection(db, 'article_stats'),
        where('authorId', '==', user.uid)
      );
      const snap = await getDocs(statsQ);
      const statsList: ArticleStats[] = snap.docs.map((d) => ({
        slug: d.data().slug,
        views: d.data().views || 0,
        likes: d.data().likes || 0,
        dislikes: d.data().dislikes || 0,
        comments: d.data().comments || 0,
      }));
      setAuthorStats(statsList);
    } catch (err) {
      console.error('Error fetching author stats:', err);
      alert('Error loading article stats.');
    } finally {
      setStatsLoading(false);
    }
  };

  // ─── Social share / copy link ───
  const shareToX = (article: NewsArticle) => {
    const url = encodeURIComponent(
      `${window.location.origin}/base-chain-news/${article.slug}`
    );
    const text = encodeURIComponent(
      `Check out this article on CypherScan: ${article.title}`
    );
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${url}`,
      'Share to X',
      'width=600,height=400'
    );
  };

  const shareToTelegram = (article: NewsArticle) => {
    const url = encodeURIComponent(
      `${window.location.origin}/base-chain-news/${article.slug}`
    );
    const text = encodeURIComponent(
      `Check out this article on CypherScan: ${article.title}`
    );
    window.open(
      `https://t.me/share/url?url=${url}&text=${text}`,
      'Share to Telegram',
      'width=600,height=400'
    );
  };

  const shareToReddit = (article: NewsArticle) => {
    const url = encodeURIComponent(
      `${window.location.origin}/base-chain-news/${article.slug}`
    );
    const title = encodeURIComponent(article.title || 'Article on CypherScan');
    window.open(
      `https://www.reddit.com/submit?url=${url}&title=${title}`,
      'Share to Reddit',
      'width=600,height=400'
    );
  };

  const copyLink = (article: NewsArticle) => {
    const url = `${window.location.origin}/base-chain-news/${article.slug}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  // ─── Handle “Become an author” submission ───
  const handleAuthorApplication = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!user || !walletAddress) {
      alert('Please connect your wallet to apply.');
      return;
    }
    if (
      !applicationForm.name ||
      !applicationForm.email ||
      !applicationForm.sampleWork
    ) {
      alert('Please fill out all required fields.');
      return;
    }
    try {
      await addDoc(collection(db, 'author_applications'), {
        ...applicationForm,
        walletAddress,
        createdAt: serverTimestamp(),
      });
      setApplicationSubmitted(true);
      // Award initial points
      await addDoc(collection(db, 'user_activities'), {
        userId: user.uid,
        walletAddress,
        action: 'author_application',
        points: 5,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error submitting author application:', err);
      alert('Error submitting application.');
    }
  };

  const handleAdImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
    adType: string
  ) => {
    console.warn(`Ad image failed to load (${adType}):`, e.currentTarget.src);
    if (adType === 'banner') {
      e.currentTarget.src = 'https://via.placeholder.com/728x90?text=Your+Ad+Here';
    } else if (adType === 'sidebar') {
      e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Your+Ad+Here';
    } else if (adType === 'inline') {
      e.currentTarget.src = 'https://via.placeholder.com/728x90?text=Your+Ad+Here';
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-blue-400 text-lg font-sans">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-red-500 text-lg font-sans">{error}</p>
      </div>
    );
  }

  const filteredArticles = articles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const featuredArticle = filteredArticles[0];
  const regularArticles = filteredArticles.slice(1);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans relative">
      {/* ────── Bottom Stats Bar ────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-blue-500/30 p-2 text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1 overflow-x-auto z-10">
        <span className="whitespace-nowrap">SYS: Cypher News AI</span>
        <span className="whitespace-nowrap">UPTIME: {uptime}s</span>
        <span className="whitespace-nowrap">ARTICLES: {filteredArticles.length}</span>
        <span className="whitespace-nowrap">LAST UPDATED: {lastUpdated}</span>
      </div>

      <div className="py-6 sm:py-10 pb-24 sm:pb-20">
        {/* ────── Header + Search ────── */}
        <div className="w-full bg-gray-950 sticky top-0 z-20 shadow-md">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="sm:static z-20"
                >
                  <button
                    onClick={() => router.push('/terminal')}
                    className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors duration-300 px-3 py-1.5 sm:p-0 rounded-md sm:rounded-none text-sm"
                    aria-label="Return to terminal"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Return
                  </button>
                </motion.div>
                <motion.h1
                  variants={titleVariants}
                  initial="hidden"
                  animate="visible"
                  className="text-2xl sm:text-3xl font-bold text-white sm:ml-4"
                >
                  {'Base Chain News'.split('').map((char, index) => (
                    <motion.span key={index} variants={letterVariants}>
                      {char}
                    </motion.span>
                  ))}
                </motion.h1>
                <div className="sm:hidden w-12" />
              </div>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-md py-2.5 px-4 pl-10 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Search articles"
                />
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>
          </div>
        </div>

        <div className="container max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* ───────── Main column (articles + banner + author form) ───────── */}
          <div className="lg:col-span-2">
            {/* Banner Ad */}
            <div className="my-8 sm:my-10">
              <div className="text-center text-xs text-gray-400 mb-3">Advertisement</div>
              <a href={currentBannerAd.destinationUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={currentBannerAd.imageUrl}
                  alt={currentBannerAd.altText}
                  className="w-full h-[60px] sm:h-[80px] lg:h-[90px] mx-auto rounded-lg border border-blue-500/20 object-cover"
                  onError={(e) => handleAdImageError(e, 'banner')}
                  loading="lazy"
                  aria-label="Banner advertisement"
                />
              </a>
            </div>

            {/* Become an Author Section */}
            <div className="bg-gray-900 border border-blue-500/20 rounded-lg p-4 sm:p-6 mb-8 sm:mb-10">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
                Become a CypherScan Author
              </h2>
              <p className="text-sm sm:text-base text-gray-200 mb-4">
                Share your insights on Base chain and earn 50 USDC per approved
                article, paid monthly to your connected wallet. Approved authors
                gain access to exclusive tools and community recognition.
              </p>
              <p className="text-sm text-gray-400 mb-4">
                Payment Formula:{' '}
                <code>Payment = Number of Approved Articles * 50 USDC</code>, paid monthly.
              </p>

              {applicationSubmitted ? (
                <p className="text-green-400 text-sm">
                  Application submitted! We’ll review and get back to you soon.
                </p>
              ) : (
                <form onSubmit={handleAuthorApplication}>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={applicationForm.name}
                      onChange={(e) =>
                        setApplicationForm({ ...applicationForm, name: e.target.value })
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={applicationForm.email}
                      onChange={(e) =>
                        setApplicationForm({ ...applicationForm, email: e.target.value })
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-1">
                      Sample Work (URL or Text)
                    </label>
                    <textarea
                      value={applicationForm.sampleWork}
                      onChange={(e) =>
                        setApplicationForm({ ...applicationForm, sampleWork: e.target.value })
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      required
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-all duration-300"
                      disabled={!user || !walletAddress}
                    >
                      {user && walletAddress ? 'Submit Application' : 'Connect Wallet to Apply'}
                    </button>
                    {user && walletAddress && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowStatsModal(true);
                          fetchAuthorStats();
                        }}
                        className="px-4 py-2 bg-gray-500/20 hover:bg-gray-500/40 border border-gray-500/30 rounded-md text-sm text-gray-400 hover:text-gray-300 transition-all duration-300"
                      >
                        View My Article Stats
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Stats Modal */}
            {showStatsModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Your Article Stats</h3>
                    <button
                      onClick={() => setShowStatsModal(false)}
                      className="text-gray-400 hover:text-gray-300"
                      aria-label="Close modal"
                    >
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>
                  {statsLoading ? (
                    <p className="text-gray-400">Loading stats...</p>
                  ) : authorStats.length > 0 ? (
                    <div className="space-y-4">
                      {authorStats.map((stat) => {
                        const art = articles.find((a) => a.slug === stat.slug);
                        return (
                          <div key={stat.slug} className="bg-gray-800 p-4 rounded-md">
                            <h4 className="text-sm font-semibold text-white">
                              {art?.title || 'Untitled'}
                            </h4>
                            <p className="text-xs text-gray-400">Views: {stat.views}</p>
                            <p className="text-xs text-gray-400">Likes: {stat.likes}</p>
                            <p className="text-xs text-gray-400">Dislikes: {stat.dislikes}</p>
                            <p className="text-xs text-gray-400">Comments: {stat.comments}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-400">No articles found.</p>
                  )}
                </div>
              </div>
            )}

            {filteredArticles.length === 0 && (
              <div className="text-center text-gray-400 text-sm my-8">No articles found</div>
            )}

            {/* Featured Article */}
            {featuredArticle && (
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.02 }}
                className="bg-gray-900 border border-blue-500/20 rounded-lg p-4 sm:p-6 mb-8 sm:mb-10"
              >
                <div className="relative">
                  <div className="w-full h-48 sm:h-52 lg:h-56 bg-gray-800 rounded-lg mb-4 relative overflow-hidden">
                    <img
                      src={featuredArticle.thumbnailUrl || FALLBACK_THUMBNAIL}
                      alt={`${featuredArticle.title} thumbnail`}
                      className="w-full h-full object-cover rounded-lg transition-transform duration-300 hover:scale-105 hover:brightness-110"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_THUMBNAIL;
                      }}
                      loading="lazy"
                      aria-label="Featured article thumbnail"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/70 to-transparent rounded-lg" />
                    <span className="absolute bottom-3 left-3 inline-block text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded-md">
                      Featured
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 sm:mb-3 break-words">
                    {featuredArticle.title}
                  </h2>
                  <div className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                    <span>By {featuredArticle.author}</span>
                    <span className="mx-2 hidden sm:inline">|</span>
                    <span className="block sm:inline">
                      {new Date(featuredArticle.publishedAt).toLocaleString()}
                    </span>
                    <span className="mx-2 hidden sm:inline">|</span>
                    <span className="block sm:inline">
                      Source: {featuredArticle.source}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-gray-200 leading-relaxed mb-4">
                    {highlightMentions(truncateAtWord(featuredArticle.content, 150))}...
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Link
                      href={`/base-chain-news/${featuredArticle.slug}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors text-sm sm:text-base"
                    >
                      Read more
                    </Link>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => shareToX(featuredArticle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') shareToX(featuredArticle);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Share to X"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        Share on X
                      </button>
                      <button
                        onClick={() => shareToTelegram(featuredArticle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') shareToTelegram(featuredArticle);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Share to Telegram"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c.1.564 1.725.267 2.02-.421L23.99 4.477c.392-1.178-.484-1.71-1.297-1.34L2.705 12.162c-1.178.392-.803 1.586.098 1.965l5.508 1.717 12.785-8.03c.392-.244.814-.098.491.392z" />
                        </svg>
                        Telegram
                      </button>
                      <button
                        onClick={() => shareToReddit(featuredArticle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') shareToReddit(featuredArticle);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Share to Reddit"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547l-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.548 3.548 0 0 1 .1 1.575c0 3.135-3.622 5.686-8.086 5.686-4.465 0-8.086-2.551-8.086-5.686 0-.548.043-1.085.135-1.605-.582-.282-1.02-.9-1.02-1.617a1.755 1.755 0 0 1 1.754-1.754c.474 0 .897.181 1.206.49 1.207-.87 2.89-1.416 4.678-1.488l.8-3.747-2.59.547a1.25 1.25 0 0 1-2.498-.056 1.25 1.25 0 0 1 1.248-1.248c.467 0 .87.244 1.088.616l3.144-.664c.536-.11 1.094.287 1.094.84zm-4.16 10.865c-.956 0-1.732.775-1.732 1.732s.776 1.732 1.732 1.732c.957 0 1.732-.775 1.732-1.732s-.775-1.732-1.732-1.732zm3.847 0c-.957 0-1.732.775-1.732 1.732s.775 1.732 1.732 1.732c.956 0 1.732-.775 1.732-1.732s-.776-1.732-1.732-1.732z" />
                        </svg>
                        Reddit
                      </button>
                      <button
                        onClick={() => copyLink(featuredArticle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') copyLink(featuredArticle);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Copy article link"
                      >
                        <ClipboardIcon className="w-4 h-4" />
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* More News */}
            {regularArticles.length > 0 && (
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 sm:mb-8">
                More News
              </h2>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {regularArticles.map((article, index) => (
                <div key={article.slug}>
                  <motion.div
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover={{
                      scale: 1.02,
                      y: -2,
                      transition: { duration: 0.2 },
                    }}
                    className="bg-gray-900 border border-blue-500/20 rounded-lg p-4 sm:p-5 hover:shadow-[0_0_8px_rgba(37,99,235,0.2)] hover:border-blue-500/40 transition-all duration-300"
                  >
                    <div className="w-full aspect-[16/9] sm:aspect-[4/3] lg:aspect-[16/9] bg-gray-800 rounded-lg mb-3 relative overflow-hidden">
                      <img
                        src={article.thumbnailUrl || FALLBACK_THUMBNAIL}
                        alt={`${article.title} thumbnail`}
                        className="w-full h-full object-cover rounded-lg transition-transform duration-300 hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_THUMBNAIL;
                        }}
                        loading="lazy"
                        aria-label="Article thumbnail"
                      />
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold text-white mb-2 break-words line-clamp-2">
                      {article.title}
                    </h2>
                    <div className="text-xs sm:text-sm text-gray-400 mb-3">
                      <span>By {article.author}</span>
                      <span className="mx-2 hidden sm:inline">|</span>
                      <span className="block sm:inline">
                        {new Date(article.publishedAt).toLocaleDateString()}
                      </span>
                      <span className="mx-2 hidden sm:inline">|</span>
                      <span className="block sm:inline">
                        Source: {article.source}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base text-gray-200 leading-tight sm:leading-relaxed mb-3 line-clamp-3">
                      {highlightMentions(truncateAtWord(article.content, 100))}...
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <Link
                        href={`/base-chain-news/${article.slug}`}
                        className="text-blue-400 hover:text-blue-300 transition-colors sm:text-sm sm:text-base text-sm"
                      >
                        Read more
                      </Link>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => shareToX(article)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') shareToX(article);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label="Share to X"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6舤17L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => shareToTelegram(article)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') shareToTelegram(article);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label="Share to Telegram"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c.1.564 1.725  .267 2.02-.421L23.99 4.477c.392-1.178-.484-1.71-1.297-1.34L2.705 12.162c-1.178.392-.803 1.586.098 1.965l5.508 1.717 12.785-8.03c.392-.244.814-.098.491.392z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => shareToReddit(article)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') shareToReddit(article);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label="Share to Reddit"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547l-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.548 3.548 0 0 1 .1 1.575c0 3.135-3.622 5.686-8.086 5.686-4.465 0-8.086-2.551-8.086-5.686 0-.548.043-1.085.135-1.605-.582-.282-1.02-.9-1.02-1.617a1.755 1.755 0 0 1 1.754-1.754c.474 0 .897.181 1.206.49 1.207-.87 2.89-1.416 4.678-1.488l.8-3.747-2.59.547a1.25 1.25 0 0 1-2.498-.056 1.25 1.25 0 0 1 1.248-1.248c.467 0 .87.244 1.088.616l3.144-.664c.536-.11 1.094.287 1.094.84zm-4.16 10.865c-.956 0-1.732.775-1.732 1.732s.776 1.732 1.732 1.732c.957 0 1.732-.775 1.732-1.732s-.775-1.732-1.732-1.732zm3.847 0c-.957 0-1.732.775-1.732 1.732s.775 1.732 1.732 1.732c.956 0 1.732-.775 1.732-1.732s-.776-1.732-1.732-1.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => copyLink(article)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') copyLink(article);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs sm:text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label="Copy article link"
                        >
                          <ClipboardIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  {(index + 1) % 3 === 0 && (
                    <div className="col-span-1 sm:col-span-2 lg:col-span-3 my-8 sm:my-10">
                      <div className="text-center text-xs text-gray-400 mb-3">
                        Advertisement
                      </div>
                      <a
                        href={getCurrentInlineAd(index).destinationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={getCurrentInlineAd(index).imageUrl}
                          alt={getCurrentInlineAd(index).altText}
                          className="w-full max-w-[728px] h-auto mx-auto rounded-lg border border-blue-500/20 object-cover"
                          onError={(e) => handleAdImageError(e, 'inline')}
                          loading="lazy"
                          aria-label="Inline advertisement"
                        />
                      </a>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mt-6 sm:mt-8 mb-6 sm:mb-8">
                        Articles You May Like
                      </h2>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ───────── Sidebar (ads + community links) ───────── */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 space-y-8">
              <div>
                <div className="text-center text-xs text-gray-400 mb-3">
                  Advertisement
                </div>
                <a
                  href={currentSidebarAd.destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
                <h3 className="text-sm font-semibold text-white mb-3">
                  Join Our Community
                </h3>
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
