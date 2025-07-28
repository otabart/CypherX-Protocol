"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { Bars3Icon, HeartIcon, HandThumbDownIcon, EyeIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  onSnapshot,
} from "firebase/firestore";
import { useAuth } from "@/app/providers";
import { useAccount, useChainId } from "wagmi";
import type { User } from "firebase/auth";
import type { Unsubscribe } from "firebase/firestore";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Image from 'next/image';
import UserProfileDropdown from "@/app/components/UserProfileDropdown";

// ────────── Types ──────────
interface NewsArticle {
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
  category?: string;
  views?: number;
  likes?: number;
  dislikes?: number;
  comments?: string[];
  lastUpdated?: string;
}

interface Ad {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  altText: string;
  type: "banner" | "inline" | "sponsored";
  createdAt: string;
  endAt: string;
  category?: string;
}

interface AuthorApplication {
  name: string;
  email: string;
  walletAddress: string;
  sampleWork: string;
  kycStatus: "pending" | "verified" | "rejected";
  status: "pending" | "approved" | "rejected";
  submittedAt?: string;
}

interface UserActivity {
  userId: string;
  walletAddress: string;
  action:
    | "read_article"
    | "share_x"
    | "share_telegram"
    | "author_application"
    | "like_article"
    | "comment_article"
    | "dislike_article"
    | "referral"
    | "nft_minted";
  points: number;
  articleSlug?: string;
  createdAt: string;
}

interface Notification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface LeaderboardEntry {
  walletAddress: string;
  points: number;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

// ────────── Animation Variants ──────────
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// ────────── Utility Functions ──────────
const truncateAtWord = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace === -1 ? truncated + "..." : truncated.slice(0, lastSpace) + "...";
};

const validateForm = (form: AuthorApplication): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const urlRegex = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/;
  if (!form.name || form.name.length < 2) return "Name is too short";
  if (!emailRegex.test(form.email)) return "Invalid email";
  if (!urlRegex.test(form.sampleWork) && form.sampleWork.length < 10) return "Invalid sample work";
  if (!form.kycStatus || form.kycStatus === "pending") return "KYC verification required";
  return null;
};

const FALLBACK_AD = "[AD CORRUPTED]";

export default function NewsPage() {
  const [page, setPage] = useState<number>(1);
  const articlesPerPage = 6;
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [bannerAds, setBannerAds] = useState<Ad[]>([]);
  const [inlineAds, setInlineAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterAuthor, setFilterAuthor] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("date");
  const [showSearchHistory, setShowSearchHistory] = useState<boolean>(false);
  const [showDashboardMenu, setShowDashboardMenu] = useState<boolean>(false);
  const [uptime, setUptime] = useState<number>(0);
  const [applicationForm, setApplicationForm] = useState<AuthorApplication>({
    name: "",
    email: "",
    walletAddress: "",
    sampleWork: "",
    kycStatus: "pending",
    status: "pending",
  });
  const [showApplicationModal, setShowApplicationModal] = useState<boolean>(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState<boolean>(false);
  const [kycVerified, setKycVerified] = useState<boolean>(false);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [recentActivities, setRecentActivities] = useState<UserActivity[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [failedBannerAd, setFailedBannerAd] = useState<string | null>(null);
  const [failedInlineAds, setFailedInlineAds] = useState<Record<number, string | null>>({});
  const [likedArticles, setLikedArticles] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("likedArticles") || "[]");
    }
    return [];
  });
  const [dislikedArticles, setDislikedArticles] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("dislikedArticles") || "[]");
    }
    return [];
  });
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("searchHistory") || "[]").slice(-5);
    }
    return [];
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [authorNotifications, setAuthorNotifications] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("authorNotifications") || "[]");
    }
    return [];
  });
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [showAuthorProfile, setShowAuthorProfile] = useState<string | null>(null);
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const articleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { user, walletAddress: authWalletAddress, loading: authLoading } = useAuth() as {
    user: User | null;
    walletAddress: string | null;
    loading: boolean;
  };
  const { address: wagmiAddress } = useAccount();
  const chainId = useChainId();
  const router = useRouter();

  const walletAddress = authWalletAddress || wagmiAddress || null;

  // ─── Fetch articles from Firestore with real-time listener ───
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "articles"), (snapshot) => {
      const fetchedArticles = snapshot.docs.map((doc) => {
        const data = doc.data() as NewsArticle;
        return {
          ...data,
          slug: doc.id,
          views: data.views || 0,
          likes: data.likes || 0,
          dislikes: data.dislikes || 0,
          comments: data.comments || [],
          lastUpdated: data.lastUpdated || new Date().toISOString(),
        };
      });
      setArticles(fetchedArticles);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Define filteredArticles and sectioned articles after articles is available
  let filteredArticles = articles.filter((article: NewsArticle) =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filterCategory) {
    filteredArticles = filteredArticles.filter((article) => article.category === filterCategory);
  }
  if (filterAuthor) {
    filteredArticles = filteredArticles.filter((article) => article.author === filterAuthor);
  }
  if (filterDate) {
    filteredArticles = filteredArticles.filter((article) => new Date(article.publishedAt).toLocaleDateString() === filterDate);
  }

  // Sorting
  filteredArticles.sort((a, b) => {
    if (sortBy === "views") return (b.views || 0) - (a.views || 0);
    if (sortBy === "likes") return (b.likes || 0) - (a.likes || 0);
    if (sortBy === "date") return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    return 0;
  });

  const featuredArticle = filteredArticles[0];
  const recommendedArticles = filteredArticles
    .filter((article: NewsArticle) => likedArticles.includes(article.slug) || article.category === "blockchain")
    .slice(0, 3);
  const latestArticles = filteredArticles.slice((page - 1) * articlesPerPage, page * articlesPerPage);

  // ─── Lazy loading with IntersectionObserver ───
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove("opacity-0");
            entry.target.classList.add("opacity-100");
          }
        });
      },
      { threshold: 0.1 }
    );

    // Capture current refs for stable cleanup
    const currentRefs = articleRefs.current;

    currentRefs.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      currentRefs.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, [latestArticles, recommendedArticles]);

  // ─── Network validation ───
  useEffect(() => {
    if (walletAddress && chainId !== 8453) {
      addToast("Please switch to Base network", 'info');
    }
  }, [chainId, walletAddress]);

  useEffect(() => {
    async function fetchAds() {
      try {
        const adsSnap = await getDocs(collection(db, "adImageUrl"));
        const now = new Date();
        const ads = adsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Ad))
          .filter((ad) => !ad.endAt || new Date(ad.endAt) >= now);
        setBannerAds(ads.filter((ad) => ad.type === "banner"));
        setInlineAds(ads.filter((ad) => ad.type === "inline").slice(0, 3));
      } catch (err) {
        console.error("[07/15/2025 09:39 AM PDT] Error fetching ads:", err);
      }
    }
    void fetchAds();
  }, []);

  // ─── Fetch user points, activities, and leaderboard ───
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    if (user && walletAddress) {
      const userDocRef = doc(db, "users", user.uid);
      unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setUserPoints(userData.points || 0);
        }
      });
    }

    async function fetchActivitiesAndLeaderboard() {
      if (!user || !walletAddress) return;
      try {
        const q = query(collection(db, "user_activities"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        const activities = snap.docs.map((doc) => doc.data() as UserActivity);
        const totalPoints = activities.reduce((sum, doc) => sum + (doc.points || 0), 0);
        setUserPoints(totalPoints);
        setRecentActivities(
          activities
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
        );

        const leaderboardSnap = await getDocs(collection(db, "user_activities"));
        const userPointsMap: Record<string, number> = {};
        leaderboardSnap.docs.forEach((doc) => {
          const data = doc.data() as UserActivity;
          userPointsMap[data.walletAddress] = (userPointsMap[data.walletAddress] || 0) + data.points;
        });
        const leaderboardData = Object.entries(userPointsMap)
          .map(([walletAddress, points]) => ({ walletAddress, points }))
          .sort((a, b) => b.points - a.points)
          .slice(0, 5);
        setLeaderboard(leaderboardData);
      } catch (err) {
        console.error("[07/15/2025 09:39 AM PDT] Error fetching user data:", err);
      }
    }
    void fetchActivitiesAndLeaderboard();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, walletAddress]);

  // ─── Generate referral code ───
  useEffect(() => {
    if (user && walletAddress && !referralCode) {
      const code = `REF-${walletAddress.slice(2, 8).toUpperCase()}-${crypto.randomUUID().slice(0, 4)}`;
      setReferralCode(code);
      localStorage.setItem("referralCode", code);
    }
  }, [user, walletAddress, referralCode]);

  // ─── Live uptime counter ───
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => setUptime(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  // ─── Track user activity ───
  const trackActivity = async (action: UserActivity["action"], points: number, articleSlug?: string) => {
    if (!user || !walletAddress) return;
    try {
      await addDoc(collection(db, "user_activities"), {
        userId: user.uid,
        walletAddress,
        action,
        points,
        articleSlug,
        createdAt: serverTimestamp(),
      });
      // Update user points in Firestore
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { points: increment(points) });

      addToast(`Earned ${points} points for ${action.replace('_', ' ')}`, 'success');
    } catch (err) {
      console.error("[07/15/2025 09:39 AM PDT] Error tracking activity:", err);
      addToast("Error tracking activity", 'error');
    }
  };

  // ─── Social share / copy link / like / dislike / comment ───
  const handleArticleClick = async (slug: string) => {
    try {
      const articleDocRef = doc(db, "articles", slug);
      await updateDoc(articleDocRef, { views: increment(1) });

      addToast("Article viewed", 'info');
      void trackActivity("read_article", 1, slug);
    } catch (err) {
      console.error("Error incrementing views:", err);
      addToast("Error viewing article", 'error');
    }
    router.push(`/base-chain-news/${slug}`);
  };

  const shareToX = (article: NewsArticle, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    void trackActivity("share_x", 2, article.slug);
    const url = encodeURIComponent(`${window.location.origin}/base-chain-news/${article.slug}?ref=${referralCode}`);
    const text = encodeURIComponent(`Check out this article on CypherScan: ${article.title}`);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, "Share to X", "width=600,height=400");
  };

  const shareToTelegram = (article: NewsArticle, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    void trackActivity("share_telegram", 2, article.slug);
    const url = encodeURIComponent(`${window.location.origin}/base-chain-news/${article.slug}?ref=${referralCode}`);
    const text = encodeURIComponent(`Check out this article on CypherScan: ${article.title}`);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "Share to Telegram", "width=600,height=400");
  };

  const copyLink = (article: NewsArticle, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    void trackActivity("read_article", 1, article.slug);
    const link = `${window.location.origin}/base-chain-news/${article.slug}?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    addToast("Referral link copied - earn points on shares!", 'success');
  };

  const toggleLike = async (article: NewsArticle, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const slug = article.slug;
    const wasLiked = likedArticles.includes(slug);
    const delta = wasLiked ? -1 : 1;
    const points = wasLiked ? -3 : 3;

    if (wasLiked) {
      setLikedArticles(likedArticles.filter((s) => s !== slug));
      addToast("Article unliked", 'info');
    } else {
      setLikedArticles([...likedArticles, slug]);
      addToast("Article liked", 'success');
    }

    const articleDocRef = doc(db, "articles", slug);
    await updateDoc(articleDocRef, { likes: increment(delta) });

    await trackActivity("like_article", points, slug);

    if (typeof window !== "undefined") {
      localStorage.setItem("likedArticles", JSON.stringify(likedArticles));
    }
    if (user && walletAddress) {
      await setDoc(doc(db, "user_likes", `${user.uid}_${slug}`), {
        userId: user.uid,
        articleSlug: slug,
        liked: !wasLiked,
        timestamp: serverTimestamp(),
      });
    }
  };

  const toggleDislike = async (article: NewsArticle, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const slug = article.slug;
    const wasDisliked = dislikedArticles.includes(slug);
    const delta = wasDisliked ? -1 : 1;
    const points = wasDisliked ? -2 : 2;

    if (wasDisliked) {
      setDislikedArticles(dislikedArticles.filter((s) => s !== slug));
      addToast("Article undisliked", 'info');
    } else {
      setDislikedArticles([...dislikedArticles, slug]);
      addToast("Article disliked", 'info');
    }

    const articleDocRef = doc(db, "articles", slug);
    await updateDoc(articleDocRef, { dislikes: increment(delta) });

    await trackActivity("dislike_article", points, slug);

    if (typeof window !== "undefined") {
      localStorage.setItem("dislikedArticles", JSON.stringify(dislikedArticles));
    }
    if (user && walletAddress) {
      await setDoc(doc(db, "user_dislikes", `${user.uid}_${slug}`), {
        userId: user.uid,
        articleSlug: slug,
        disliked: !wasDisliked,
        timestamp: serverTimestamp(),
      });
    }
  };

  const handleNewCommentChange = (slug: string, value: string) => {
    if (value.length <= 250) {
      setNewComments((prev) => ({ ...prev, [slug]: value }));
    }
  };

  const sendComment = async (slug: string) => {
    const comment = newComments[slug]?.trim();
    if (!user || !walletAddress || !comment) return;
    try {
      const articleDocRef = doc(db, "articles", slug);
      await updateDoc(articleDocRef, {
        comments: arrayUnion(comment),
      });

      void trackActivity("comment_article", 5, slug);
      addToast("Comment submitted", 'success');
    } catch (err) {
      console.error("Error posting comment:", err);
      addToast("Error posting comment", 'error');
    } finally {
      setNewComments((prev) => ({ ...prev, [slug]: "" }));
    }
  };

  const handleAuthorApplication = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !walletAddress) {
      addToast("Please connect your wallet", 'error');
      return;
    }
    const validationError = validateForm(applicationForm);
    if (validationError) {
      addToast(validationError, 'error');
      return;
    }
    try {
      await addDoc(collection(db, "author_applications"), {
        ...applicationForm,
        walletAddress,
        submittedAt: serverTimestamp(),
      });
      setApplicationSubmitted(true);
      void trackActivity("author_application", 5);
      setShowApplicationModal(false);
      addToast("Author application submitted", 'success');
    } catch (err) {
      console.error("[07/15/2025 09:39 AM PDT] Error submitting author application:", err);
      addToast("Error submitting application", 'error');
    }
  };

  const handleKycVerification = () => {
    setTimeout(() => {
      setKycVerified(true);
      setApplicationForm((prev) => ({ ...prev, kycStatus: "verified" }));
      addToast("KYC verification completed", 'success');
    }, 2000);
  };

  const handleAdImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, adType: string, index: number) => {
    console.warn("[07/15/2025 09:39 AM PDT] Ad image failed to load (" + adType + "):", e.currentTarget.src);
    if (adType === "banner") {
      setFailedBannerAd(FALLBACK_AD);
    } else if (adType === "inline") {
      setFailedInlineAds((prev) => ({ ...prev, [index]: FALLBACK_AD }));
    }
  };

  const addSearchToHistory = (query: string) => {
    if (!query) return;
    const newHistory = [query, ...searchHistory.filter((q) => q !== query)].slice(0, 5);
    setSearchHistory(newHistory);
    if (typeof window !== "undefined") {
      localStorage.setItem("searchHistory", JSON.stringify(newHistory));
    }
  };

  const toggleAuthorNotification = (author: string) => {
    const newAuthors = authorNotifications.includes(author)
      ? authorNotifications.filter((a) => a !== author)
      : [...authorNotifications, author];
    setAuthorNotifications(newAuthors);
    if (typeof window !== "undefined") {
      localStorage.setItem("authorNotifications", JSON.stringify(newAuthors));
    }
    addToast(`Subscribed to ${author}`, 'success');
  };

  const getContextualAd = (article: NewsArticle, index: number): Ad | null => {
    return inlineAds.find((ad) => ad.category === article.category) || inlineAds[index % inlineAds.length] || null;
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    addSearchToHistory(e.target.value);
    setShowSearchHistory(true);
  };

  const handlePageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPage = parseInt(e.target.value);
    if (newPage > 0) setPage(newPage);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const addToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  if (authLoading || loading) {
    return (
      <div className="bg-gray-950 text-gray-200 font-mono flex items-center justify-center min-h-screen w-full">
        <div className="w-full px-0 sm:px-4">
          <Skeleton height={40} className="mb-2" />
          <Skeleton count={3} height={200} className="mb-2" />
          <Skeleton height={40} />
        </div>
      </div>
    );
  }

  const currentBannerAd = bannerAds.length > 0 ? bannerAds[0] : null;

  // Get unique categories and authors for filters
  const uniqueCategories = [...new Set(articles.map((a) => a.category).filter(Boolean))];
  const uniqueAuthors = [...new Set(articles.map((a) => a.author))];
  const uniqueDates = [...new Set(articles.map((a) => new Date(a.publishedAt).toLocaleDateString()))];

  return (
    <div className="bg-gray-950 text-gray-200 font-mono text-sm leading-relaxed min-h-screen flex flex-col w-full">
      {/* Terminal Header */}
      <header className="sticky top-0 z-20 bg-gray-950 p-0 sm:p-2 pb-0 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 w-full px-0 sm:px-0">
          <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-0">
            <button
              onClick={() => router.push("/")}
              className="text-gray-200 hover:text-blue-400 transition-colors duration-300 text-xs sm:text-sm"
              aria-label="Go to home"
            >
              [HOME]
            </button>
            <button
              onClick={() => setShowApplicationModal(true)}
              className="text-gray-200 hover:text-blue-400 bg-blue-500/10 px-2 sm:px-3 py-1 border border-gray-200/30 transition-colors duration-300 text-xs sm:text-sm"
              aria-label="Become an author"
            >
              [BECOME AN AUTHOR]
            </button>
          </div>
          <div className="flex-1 flex justify-end items-center gap-2 px-2 sm:px-0">
            <div className="relative w-full sm:w-96 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setShowSearchHistory(true)}
                onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)}
                placeholder="SEARCH ARTICLES: _"
                className="w-full bg-blue-500/20 border border-gray-200 py-1 px-2 text-gray-200 focus:outline-none focus:animate-pulse-cursor text-xs sm:text-sm"
                aria-label="Search articles"
              />
              {showSearchHistory && (
                <div className="absolute w-full bg-gray-950 border border-gray-200 mt-1 p-1 sm:p-2 z-10">
                  {filteredArticles
                    .filter((article) =>
                      article.title.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .slice(0, 5)
                    .map((article) => (
                      <button
                        key={article.slug}
                        onClick={() => {
                          setSearchQuery(article.title);
                          setShowSearchHistory(false);
                        }}
                        className="block w-full text-left text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                        aria-label={`Search suggestion: ${article.title}`}
                      >
                        {article.title}
                      </button>
                    ))}
                  {searchHistory.length > 0 && (
                    <>
                      <hr className="my-1 border-gray-200/20" />
                      {searchHistory.map((query, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSearchQuery(query);
                            setShowSearchHistory(false);
                          }}
                          className="block w-full text-left text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                          aria-label={`Search history: ${query}`}
                        >
                          PREV: {query}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setSearchHistory([]);
                          localStorage.setItem("searchHistory", "[]");
                        }}
                        className="text-gray-200 hover:text-blue-400 mt-1 w-full text-left text-xs sm:text-sm"
                        aria-label="Clear search history"
                      >
                        CLEAR HISTORY
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowDashboardMenu(!showDashboardMenu)}
              className="text-gray-200 hover:text-blue-400 sm:hidden text-xs sm:text-sm"
              aria-label="Toggle dashboard menu"
            >
              <Bars3Icon className="h-5 sm:h-6 w-5 sm:w-6" />
            </button>
            <UserProfileDropdown />
          </div>
        </div>
        <div className="text-xs sm:text-sm text-gray-200 mt-1 px-2 sm:px-0">CONNECTED TO BASE NETWORK | CHAIN ID: 8453 | UPTIME: {uptime}s</div>
      </header>

      {/* Filter Bar */}
      <div className="bg-gray-950 p-2 flex flex-wrap gap-2 justify-center items-center w-full max-w-full overflow-x-auto">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-blue-500/20 border border-gray-200 py-1 px-2 text-gray-200 text-xs sm:text-sm min-w-[120px]"
        >
          <option value="">Filter by Category</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat as string}>{cat as string}</option>
          ))}
        </select>
        <select
          value={filterAuthor}
          onChange={(e) => setFilterAuthor(e.target.value)}
          className="bg-blue-500/20 border border-gray-200 py-1 px-2 text-gray-200 text-xs sm:text-sm min-w-[120px]"
        >
          <option value="">Filter by Author</option>
          {uniqueAuthors.map((auth) => (
            <option key={auth} value={auth}>{auth}</option>
          ))}
        </select>
        <select
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="bg-blue-500/20 border border-gray-200 py-1 px-2 text-gray-200 text-xs sm:text-sm min-w-[120px]"
        >
          <option value="">Filter by Date</option>
          {uniqueDates.map((date) => (
            <option key={date} value={date}>{date}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-blue-500/20 border border-gray-200 py-1 px-2 text-gray-200 text-xs sm:text-sm min-w-[120px]"
        >
          <option value="date">Sort by Date</option>
          <option value="views">Sort by Views</option>
          <option value="likes">Sort by Likes</option>
        </select>
      </div>

  {/* Main Content Wrapper */}
      <div className="flex flex-1 w-full">
        {/* Dashboard Menu - Sidebar on desktop, modal on mobile */}
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: showDashboardMenu ? 0 : "-100%" }}
          transition={{ duration: 0.3 }}
          className="fixed top-[60px] left-0 h-[calc(100%-60px)] w-full sm:w-64 bg-gray-950 p-1 sm:p-2 z-30 sm:static sm:top-0 sm:h-auto sm:flex sm:flex-col sm:border-r-0 sm:pl-0"
        >
          <h2 className="text-base uppercase text-gray-200 mb-1 sm:mb-2">DASHBOARD</h2>
          <nav className="space-y-1 sm:space-y-2">
            <Link href="#" className="block text-gray-200 hover:text-blue-400 text-xs sm:text-sm">
              [OVERVIEW]
            </Link>
            <Link href="#" className="block text-gray-200 hover:text-blue-400 text-xs sm:text-sm">
              [ANALYTICS]
            </Link>
            <Link href="#" className="block text-gray-200 hover:text-blue-400 text-xs sm:text-sm">
              [PROFILE]
            </Link>
            <Link href="#" className="block text-gray-200 hover:text-blue-400 text-xs sm:text-sm">
              [SETTINGS]
            </Link>
          </nav>
        </motion.div>

        {/* Main Content */}
        <main className="flex-1 p-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 mt-0 w-full max-w-full" style={{ width: '100vw', margin: 0 }}>
          {/* User Session */}
          {user && walletAddress && (
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="border-t border-gray-200 p-2 bg-blue-500/10 col-span-full shadow-md border-l-0 border-r-0 border-b-0"
            >
              <h2 className="text-base uppercase text-gray-200 mb-1 sm:mb-2">USER SESSION</h2>
              <p className="text-xs sm:text-sm">ADDRESS: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
              <p className="text-xs sm:text-sm">POINTS: {userPoints}</p>
              <p className="text-xs sm:text-sm">LIKED ARTICLES: {likedArticles.length}</p>
              {recentActivities.length > 0 && (
                <div className="mt-1 sm:mt-2">
                  <h3 className="text-xs sm:text-sm uppercase text-gray-200">RECENT LOGS</h3>
                  <ul className="text-xs sm:text-sm space-y-0.5">
                    {recentActivities.map((activity) => (
                      <li key={activity.createdAt}>
                        {activity.action.replace("_", " ").toUpperCase()}: +{activity.points} PTS @{" "}
                        {new Date(activity.createdAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs sm:text-sm">REFERRAL CODE: {referralCode || "GENERATING..."}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}?ref=${referralCode}`);
                  addToast("Referral link copied", 'success');
                }}
                className="text-gray-200 hover:text-blue-400 mt-1 sm:mt-2 text-xs sm:text-sm"
                aria-label="Copy referral link"
              >
                [COPY REFERRAL LINK]
              </button>
            </motion.div>
          )}

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="border-t border-gray-200 p-2 bg-blue-500/10 col-span-full sm:col-span-1 shadow-md border-l-0 border-r-0 border-b-0"
            >
              <h2 className="text-base uppercase text-gray-200 mb-1 sm:mb-2">LEADERBOARD</h2>
              <ul className="text-xs sm:text-sm space-y-0.5">
                {leaderboard.map((entry, idx) => (
                  <li key={entry.walletAddress}>
                    #{idx + 1} {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}: {entry.points} PTS
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Banner Ad */}
          {currentBannerAd && (
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="border-t border-gray-200 p-2 bg-blue-500/10 col-span-full sm:col-span-1 shadow-md animate-pulse-border border-l-0 border-r-0 border-b-0"
            >
              <div className="text-xs sm:text-sm uppercase text-yellow-400">INCOMING TRANSMISSION</div>
              {failedBannerAd === FALLBACK_AD ? (
                <pre className="text-gray-200 text-xs sm:text-sm">{FALLBACK_AD}</pre>
              ) : (
                <a href={currentBannerAd.destinationUrl} target="_blank" rel="noopener noreferrer">
                  <div className="relative w-full max-w-[468px] mx-auto h-[60px]">
                    <Image
                      src={failedBannerAd || currentBannerAd.imageUrl}
                      alt={currentBannerAd.altText || "Banner advertisement"}
                      fill
                      sizes="(max-width: 768px) 100vw, 468px"
                      className="object-cover"
                      onError={() => handleAdImageError({ currentTarget: { src: currentBannerAd.imageUrl } } as React.SyntheticEvent<HTMLImageElement, Event>, "banner", 0)}
                      unoptimized
                      priority
                    />
                  </div>
                </a>
              )}
            </motion.div>
          )}

          {/* Featured Articles */}
          {featuredArticle && (
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="border-t border-gray-200 p-2 bg-blue-500/10 col-span-full shadow-md border-l-0 border-r-0 border-b-0"
              ref={(el) => {
                articleRefs.current[0] = el;
              }}
            >
              <h2 className="text-base uppercase text-gray-200 mb-1 sm:mb-2">FEATURED TRANSMISSION</h2>
              <div className="relative w-full h-32 sm:h-48 mb-2 sm:mb-4">
                <div className="absolute inset-0 bg-gray-800" />
                <span className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 bg-gray-950 border border-yellow-400 text-yellow-400 text-xs sm:text-sm px-1 sm:px-2 py-0.5 sm:py-1">
                  FEATURED
                </span>
              </div>
              <h3 className="text-base uppercase text-gray-200 mb-1 sm:mb-2 break-words">TITLE: {truncateAtWord(featuredArticle.title, 50)}</h3>
              <p className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2">
                SOURCE: {featuredArticle.source} | DATE:{" "}
                {new Date(featuredArticle.publishedAt).toLocaleDateString()} | LAST UPDATED:{" "}
                {new Date(featuredArticle.lastUpdated!).toLocaleDateString()} | VIEWS: {featuredArticle.views || 0}
              </p>
              <div className="flex items-center mb-1 sm:mb-2">
                <div className="w-6 h-6 rounded-full bg-gray-500 mr-2 flex-shrink-0"></div>
                <p className="text-xs sm:text-sm text-gray-200">AUTHOR: {featuredArticle.author}</p>
              </div>
              <p className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2 break-words">CONTENT: {truncateAtWord(featuredArticle.content, 150)}</p>
              <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2 mt-1 sm:mt-2">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    onClick={() => handleArticleClick(featuredArticle.slug)}
                    className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm flex items-center"
                    aria-label="Read article"
                  >
                    <EyeIcon className="w-4 h-4 mr-1" /> READ
                  </button>
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => void toggleLike(featuredArticle, e)}
                    className={`text-gray-200 hover:text-blue-400 text-xs sm:text-sm flex items-center ${
                      likedArticles.includes(featuredArticle.slug) ? "text-blue-400" : ""
                    }`}
                    aria-label={
                      likedArticles.includes(featuredArticle.slug) ? "Unlike article" : "Like article"
                    }
                  >
                    <HeartIcon className="w-4 h-4 mr-1" /> {featuredArticle.likes || 0}
                  </button>
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => void toggleDislike(featuredArticle, e)}
                    className={`text-gray-200 hover:text-pink-400 text-xs sm:text-sm flex items-center ${
                      dislikedArticles.includes(featuredArticle.slug) ? "text-pink-400" : ""
                    }`}
                    aria-label={
                      dislikedArticles.includes(featuredArticle.slug) ? "Undislike article" : "Dislike article"
                    }
                  >
                    <HandThumbDownIcon className="w-4 h-4 mr-1" /> {featuredArticle.dislikes || 0}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => shareToX(featuredArticle, e)}
                    className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                    aria-label="Share to X"
                  >
                    [SHARE:X]
                  </button>
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => shareToTelegram(featuredArticle, e)}
                    className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                    aria-label="Share to Telegram"
                  >
                    [SHARE:TG]
                  </button>
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => copyLink(featuredArticle, e)}
                    className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                    aria-label="Copy link"
                  >
                    [COPY]
                  </button>
                </div>
              </div>
              {showAuthorProfile === featuredArticle.author && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-1 sm:mt-2 p-1 sm:p-2 bg-blue-500/20 border border-gray-200"
                >
                  <h4 className="text-sm uppercase text-gray-200 mb-1 sm:mb-2">AUTHOR PROFILE</h4>
                  <p className="text-xs sm:text-sm text-gray-200">
                    NAME: {featuredArticle.author} | STATUS: TBD
                  </p>
                  <button
                    onClick={() => setShowAuthorProfile(null)}
                    className="text-gray-200 hover:text-blue-400 mt-1 sm:mt-2 text-xs sm:text-sm"
                    aria-label="Close author profile"
                  >
                    [CLOSE]
                  </button>
                </motion.div>
              )}
              <div className="mt-1 sm:mt-2 relative">
                <textarea
                  placeholder="ADD COMMENT... (250 char max)"
                  value={newComments[featuredArticle.slug] || ""}
                  onChange={(e) => handleNewCommentChange(featuredArticle.slug, e.target.value)}
                  rows={3}
                  className="w-full bg-blue-500/20 border border-gray-200 py-1 pl-2 pr-8 text-gray-200 focus:outline-none focus:animate-pulse-cursor text-xs sm:text-sm resize-none"
                  aria-label="Add comment"
                />
                <button
                  onClick={() => sendComment(featuredArticle.slug)}
                  className="absolute right-3 bottom-3 text-gray-200 hover:text-blue-400"
                  aria-label="Send comment"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs sm:text-sm text-gray-200 mt-1 text-right">
                {(newComments[featuredArticle.slug] || "").length}/250
              </p>
              {(featuredArticle.comments || []).length > 0 && (
                <div className="mt-1 sm:mt-2">
                  <h5 className="text-xs sm:text-sm uppercase text-gray-200 mb-1 sm:mb-2">COMMENTS</h5>
                  {(featuredArticle.comments || []).map((comment, idx) => (
                    <p key={idx} className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2">
                      {comment}
                    </p>
                  ))}
                </div>
              )}
              <div className="relative w-3/4 bg-gray-800 h-2 mt-4 mr-auto">
                <div
                  className="bg-blue-400 h-full"
                  style={{ width: `${Math.min((featuredArticle.views || 0) / 100, 100)}%` }}
                />
                <span className="text-xs sm:text-sm text-gray-200 absolute left-1 top-[-20px]">READING PROGRESS</span>
              </div>
              {getContextualAd(featuredArticle, 0) && (
                <div className="mt-4 animate-pulse-border">
                  <p className="text-xs sm:text-sm uppercase text-yellow-400 mb-1 sm:mb-2">SPONSORED TRANSMISSION</p>
                  {failedInlineAds[0] === FALLBACK_AD ? (
                    <pre className="text-gray-200 text-xs sm:text-sm">{FALLBACK_AD}</pre>
                  ) : (
                    <a href={getContextualAd(featuredArticle, 0)!.destinationUrl} target="_blank" rel="noopener noreferrer">
                      <div className="relative w-full max-w-[200px] mx-auto h-[50px]">
                        <Image
                          src={failedInlineAds[0] || getContextualAd(featuredArticle, 0)!.imageUrl}
                          alt={getContextualAd(featuredArticle, 0)!.altText || "Inline advertisement"}
                          fill
                          sizes="(max-width: 768px) 100vw, 200px"
                          className="object-cover"
                          onError={() => handleAdImageError({ currentTarget: { src: getContextualAd(featuredArticle, 0)!.imageUrl } } as React.SyntheticEvent<HTMLImageElement, Event>, "inline", 0)}
                          unoptimized
                        />
                      </div>
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Latest Transmissions */}
          {latestArticles.length > 0 && (
            <div className="col-span-full">
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="border-t border-gray-200 p-2 bg-blue-500/10 shadow-md border-l-0 border-r-0 border-b-0"
              >
                <h2 className="text-base uppercase text-gray-200 mb-1 sm:mb-2">LATEST TRANSMISSIONS</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 mt-1 sm:mt-2">
                  {latestArticles.map((article: NewsArticle, index: number) => (
                    <div
                      key={article.slug}
                      ref={(el) => {
                        articleRefs.current[index + 1] = el;
                      }}
                      className="pt-1 sm:pt-2 opacity-0 transition-opacity duration-300 border-l-0 border-r-0"
                    >
                      <p className="text-xs sm:text-sm uppercase text-yellow-400 mb-1 sm:mb-2">-----[ ARTICLE {index + 1} ]-----</p>
                      <h3 className="text-base uppercase text-gray-200 mb-1 sm:mb-2 break-words">TITLE: {truncateAtWord(article.title, 50)}</h3>
                      <p className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2">
                        SOURCE: {article.source} | DATE:{" "}
                        {new Date(article.publishedAt).toLocaleDateString()} | LAST UPDATED:{" "}
                        {new Date(article.lastUpdated!).toLocaleDateString()} | VIEWS: {article.views || 0}
                      </p>
                      <div className="flex items-center mb-1 sm:mb-2">
                        <div className="w-6 h-6 rounded-full bg-gray-500 mr-2 flex-shrink-0"></div>
                        <p className="text-xs sm:text-sm text-gray-200">AUTHOR: {article.author}</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2 break-words">CONTENT: {truncateAtWord(article.content, 100)}</p>
                      <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2 mt-1 sm:mt-2">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button
                            onClick={() => handleArticleClick(article.slug)}
                            className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm flex items-center"
                            aria-label="Read article"
                          >
                            <EyeIcon className="w-4 h-4 mr-1" /> READ
                          </button>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => void toggleLike(article, e)}
                            className={`text-gray-200 hover:text-blue-400 text-xs sm:text-sm flex items-center ${
                              likedArticles.includes(article.slug) ? "text-blue-400" : ""
                            }`}
                            aria-label={
                              likedArticles.includes(article.slug) ? "Unlike article" : "Like article"
                            }
                          >
                            <HeartIcon className="w-4 h-4 mr-1" /> {article.likes || 0}
                          </button>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => void toggleDislike(article, e)}
                            className={`text-gray-200 hover:text-pink-400 text-xs sm:text-sm flex items-center ${
                              dislikedArticles.includes(article.slug) ? "text-pink-400" : ""
                            }`}
                            aria-label={
                              dislikedArticles.includes(article.slug) ? "Undislike article" : "Dislike article"
                            }
                          >
                            <HandThumbDownIcon className="w-4 h-4 mr-1" /> {article.dislikes || 0}
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => shareToX(article, e)}
                            className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                            aria-label="Share to X"
                          >
                            [SHARE:X]
                          </button>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => shareToTelegram(article, e)}
                            className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                            aria-label="Share to Telegram"
                          >
                            [SHARE:TG]
                          </button>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => copyLink(article, e)}
                            className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                            aria-label="Copy link"
                          >
                            [COPY]
                          </button>
                        </div>
                      </div>
                      {showAuthorProfile === article.author && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-1 sm:mt-2 p-1 sm:p-2 bg-blue-500/20 border border-gray-200"
                        >
                          <h4 className="text-sm uppercase text-gray-200 mb-1 sm:mb-2">AUTHOR PROFILE</h4>
                          <p className="text-xs sm:text-sm text-gray-200">
                            NAME: {article.author} | STATUS: TBD
                          </p>
                          <button
                            onClick={() => setShowAuthorProfile(null)}
                            className="text-gray-200 hover:text-blue-400 mt-1 sm:mt-2 text-xs sm:text-sm"
                            aria-label="Close author profile"
                          >
                            [CLOSE]
                          </button>
                        </motion.div>
                      )}
                      <div className="mt-1 sm:mt-2 relative">
                        <textarea
                          placeholder="ADD COMMENT... (250 char max)"
                          value={newComments[article.slug] || ""}
                          onChange={(e) => handleNewCommentChange(article.slug, e.target.value)}
                          rows={3}
                          className="w-full bg-blue-500/20 border border-gray-200 py-1 pl-2 pr-8 text-gray-200 focus:outline-none focus:animate-pulse-cursor text-xs sm:text-sm resize-none"
                          aria-label="Add comment"
                        />
                        <button
                          onClick={() => sendComment(article.slug)}
                          className="absolute right-3 bottom-3 text-gray-200 hover:text-blue-400"
                          aria-label="Send comment"
                        >
                          <PaperAirplaneIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-200 mt-1 text-right">
                        {(newComments[article.slug] || "").length}/250
                      </p>
                      {(article.comments || []).length > 0 && (
                        <div className="mt-1 sm:mt-2">
                          <h5 className="text-xs sm:text-sm uppercase text-gray-200 mb-1 sm:mb-2">COMMENTS</h5>
                          {(article.comments || []).map((comment, idx) => (
                            <p key={idx} className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2">
                              {comment}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="relative w-3/4 bg-gray-800 h-2 mt-4 mr-auto">
                        <div
                          className="bg-blue-400 h-full"
                          style={{ width: `${Math.min((article.views || 0) / 100, 100)}%` }}
                        />
                        <span className="text-xs sm:text-sm text-gray-200 absolute left-1 top-[-20px]">READING PROGRESS</span>
                      </div>
                      {getContextualAd(article, index) && (
                        <div className="mt-4 animate-pulse-border">
                          <p className="text-xs sm:text-sm uppercase text-yellow-400 mb-1 sm:mb-2">SPONSORED TRANSMISSION</p>
                          {failedInlineAds[index] === FALLBACK_AD ? (
                            <pre className="text-gray-200 text-xs sm:text-sm">{FALLBACK_AD}</pre>
                          ) : (
                            <a href={getContextualAd(article, index)!.destinationUrl} target="_blank" rel="noopener noreferrer">
                              <div className="relative w-full max-w-[200px] mx-auto h-[50px]">
                                <Image
                                  src={failedInlineAds[index] || getContextualAd(article, index)!.imageUrl}
                                  alt={getContextualAd(article, index)!.altText || "Inline advertisement"}
                                  fill
                                  sizes="(max-width: 768px) 100vw, 200px"
                                  className="object-cover"
                                  onError={() => handleAdImageError({ currentTarget: { src: getContextualAd(article, index)!.imageUrl } } as React.SyntheticEvent<HTMLImageElement, Event>, "inline", index)}
                                  unoptimized
                                />
                              </div>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

          {/* Sponsored Articles */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="border-t border-gray-200 p-2 bg-blue-500/10 col-span-full shadow-md border-l-0 border-r-0 border-b-0"
          >
            <h2 className="text-base uppercase text-gray-200 mb-1 sm:mb-2">SPONSORED TRANSMISSIONS</h2>
          </motion.div>

          {/* Pagination */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="col-span-full flex flex-col items-center gap-1 sm:gap-2 border-t border-gray-200 pt-2 border-l-0 border-r-0 border-b-0"
          >
            <p className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2">PAGE: {page} | ARTICLES: {latestArticles.length}</p>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="text-gray-200 hover:text-blue-400 disabled:text-gray-200/50 bg-gray-800/50 hover:bg-gray-800/70 rounded text-xs sm:text-sm"
                aria-label="Previous page"
              >
                [PREV]
              </button>
              <button
                onClick={() => setPage((prev) => prev + 1)}
                disabled={latestArticles.length < articlesPerPage}
                className="text-gray-200 hover:text-blue-400 disabled:text-gray-200/50 bg-gray-800/50 hover:bg-gray-800/70 rounded text-xs sm:text-sm"
                aria-label="Next page"
              >
                [NEXT]
              </button>
              <input
                type="number"
                placeholder="GOTO PAGE: _"
                onChange={handlePageChange}
                className="w-20 sm:w-24 bg-blue-500/20 border border-gray-200 py-1 px-2 text-gray-200 focus:outline-none focus:animate-pulse-cursor text-xs sm:text-sm"
                aria-label="Go to page"
              />
            </div>
          </motion.div>

          {/* Author Application Button */}
          {user && walletAddress && (
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="border-t border-gray-200 p-2 bg-blue-500/10 col-span-full text-center shadow-md border-l-0 border-r-0 border-b-0"
            >
              <button
                onClick={() => setShowApplicationModal(true)}
                className="text-gray-200 hover:text-blue-400 bg-blue-500/10 px-2 sm:px-4 py-1 border border-gray-200/30 transition-colors duration-300 text-xs sm:text-sm"
                aria-label="Become an author"
              >
                [BECOME AN AUTHOR]
              </button>
            </motion.div>
          )}

          {/* Notifications Toggle */}
          {user && walletAddress && (
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="border-t border-gray-200 p-2 bg-blue-500/10 col-span-full shadow-md border-l-0 border-r-0 border-b-0"
            >
              <p className="text-xs sm:text-sm uppercase text-gray-200 mb-1 sm:mb-2">SUBSCRIBE TO AUTHORS</p>
              {uniqueAuthors.map((author) => (
                <label key={author} className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={authorNotifications.includes(author)}
                    onChange={() => toggleAuthorNotification(author)}
                    className="text-blue-400 focus:ring-blue-400"
                    aria-label={`Subscribe to ${author}`}
                  />
                  {author}
                </label>
              ))}
            </motion.div>
          )}

          {/* You May Like */}
          {recommendedArticles.length > 0 && (
            <div className="col-span-full">
              <motion.div
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="border-t border-gray-200 p-2 bg-blue-500/10 shadow-md border-l-0 border-r-0 border-b-0"
              >
                <h2 className="text-base uppercase text-gray-200 mb-1 sm:mb-2">YOU MAY LIKE</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 mt-1 sm:mt-2">
                  {recommendedArticles.map((article: NewsArticle, index: number) => (
                    <div
                      key={article.slug}
                      ref={(el) => {
                        articleRefs.current[index + latestArticles.length + 1] = el;
                      }}
                      className="pt-1 sm:pt-2 opacity-0 transition-opacity duration-300 border-l-0 border-r-0"
                    >
                      <p className="text-xs sm:text-sm uppercase text-yellow-400 mb-1 sm:mb-2">-----[ ARTICLE {index + 1} ]-----</p>
                      <h3 className="text-base uppercase text-gray-200 mb-1 sm:mb-2 break-words">TITLE: {truncateAtWord(article.title, 50)}</h3>
                      <p className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2">
                        SOURCE: {article.source} | DATE:{" "}
                        {new Date(article.publishedAt).toLocaleDateString()} | LAST UPDATED:{" "}
                        {new Date(article.lastUpdated!).toLocaleDateString()} | VIEWS: {article.views || 0}
                      </p>
                      <div className="flex items-center mb-1 sm:mb-2">
                        <div className="w-6 h-6 rounded-full bg-gray-500 mr-2 flex-shrink-0"></div>
                        <p className="text-xs sm:text-sm text-gray-200">AUTHOR: {article.author}</p>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2 break-words">CONTENT: {truncateAtWord(article.content, 100)}</p>
                      <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2 mt-1 sm:mt-2">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button
                            onClick={() => handleArticleClick(article.slug)}
                            className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm flex items-center"
                            aria-label="Read article"
                          >
                            <EyeIcon className="w-4 h-4 mr-1" /> READ
                          </button>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => void toggleLike(article, e)}
                            className={`text-gray-200 hover:text-blue-400 text-xs sm:text-sm flex items-center ${
                              likedArticles.includes(article.slug) ? "text-blue-400" : ""
                            }`}
                            aria-label={
                              likedArticles.includes(article.slug) ? "Unlike article" : "Like article"
                            }
                          >
                            <HeartIcon className="w-4 h-4 mr-1" /> {article.likes || 0}
                          </button>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => void toggleDislike(article, e)}
                            className={`text-gray-200 hover:text-pink-400 text-xs sm:text-sm flex items-center ${
                              dislikedArticles.includes(article.slug) ? "text-pink-400" : ""
                            }`}
                            aria-label={
                              dislikedArticles.includes(article.slug) ? "Undislike article" : "Dislike article"
                            }
                          >
                            <HandThumbDownIcon className="w-4 h-4 mr-1" /> {article.dislikes || 0}
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => shareToX(article, e)}
                            className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                            aria-label="Share to X"
                          >
                            [SHARE:X]
                          </button>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => shareToTelegram(article, e)}
                            className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                            aria-label="Share to Telegram"
                          >
                            [SHARE:TG]
                          </button>
                          <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => copyLink(article, e)}
                            className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                            aria-label="Copy link"
                          >
                            [COPY]
                          </button>
                        </div>
                      </div>
                      {showAuthorProfile === article.author && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-1 sm:mt-2 p-1 sm:p-2 bg-blue-500/20 border border-gray-200"
                        >
                          <h4 className="text-sm uppercase text-gray-200 mb-1 sm:mb-2">AUTHOR PROFILE</h4>
                          <p className="text-xs sm:text-sm text-gray-200">
                            NAME: {article.author} | STATUS: TBD
                          </p>
                          <button
                            onClick={() => setShowAuthorProfile(null)}
                            className="text-gray-200 hover:text-blue-400 mt-1 sm:mt-2 text-xs sm:text-sm"
                            aria-label="Close author profile"
                          >
                            [CLOSE]
                          </button>
                        </motion.div>
                      )}
                      <div className="mt-1 sm:mt-2 relative">
                        <textarea
                          placeholder="ADD COMMENT... (250 char max)"
                          value={newComments[article.slug] || ""}
                          onChange={(e) => handleNewCommentChange(article.slug, e.target.value)}
                          rows={3}
                          className="w-full bg-blue-500/20 border border-gray-200 py-1 pl-2 pr-8 text-gray-200 focus:outline-none focus:animate-pulse-cursor resize-none text-xs sm:text-sm"
                          aria-label="Add comment"
                        />
                        <button
                          onClick={() => sendComment(article.slug)}
                          className="absolute right-3 bottom-3 text-gray-200 hover:text-blue-400"
                          aria-label="Send comment"
                        >
                          <PaperAirplaneIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-200 mt-1 text-right">
                        {(newComments[article.slug] || "").length}/250
                      </p>
                      {(article.comments || []).length > 0 && (
                        <div className="mt-1 sm:mt-2">
                          <h5 className="text-xs sm:text-sm uppercase text-gray-200 mb-1 sm:mb-2">COMMENTS</h5>
                          {(article.comments || []).map((comment, idx) => (
                            <p key={idx} className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2">
                              {comment}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="relative w-3/4 bg-gray-800 h-2 mt-4 mr-auto">
                        <div
                          className="bg-blue-400 h-full"
                          style={{ width: `${Math.min((article.views || 0) / 100, 100)}%` }}
                        />
                        <span className="text-xs sm:text-sm text-gray-200 absolute left-1 top-[-20px]">READING PROGRESS</span>
                      </div>
                      {getContextualAd(article, index) && (
                        <div className="mt-4 animate-pulse-border">
                          <p className="text-xs sm:text-sm uppercase text-yellow-400 mb-1 sm:mb-2">SPONSORED TRANSMISSION</p>
                          {failedInlineAds[index] === FALLBACK_AD ? (
                            <pre className="text-gray-200 text-xs sm:text-sm">{FALLBACK_AD}</pre>
                          ) : (
                            <a href={getContextualAd(article, index)!.destinationUrl} target="_blank" rel="noopener noreferrer">
                              <div className="relative w-full max-w-[200px] mx-auto h-[50px]">
                                <Image
                                  src={failedInlineAds[index] || getContextualAd(article, index)!.imageUrl}
                                  alt={getContextualAd(article, index)!.altText || "Inline advertisement"}
                                  fill
                                  sizes="(max-width: 768px) 100vw, 200px"
                                  className="object-cover"
                                  onError={() => handleAdImageError({ currentTarget: { src: getContextualAd(article, index)!.imageUrl } } as React.SyntheticEvent<HTMLImageElement, Event>, "inline", index)}
                                  unoptimized
                                />
                              </div>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </main>
      </div>

      {/* Application Modal */}
      {showApplicationModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-gray-950/60 flex items-center justify-center z-50 w-full h-full"
        >
          <div className="bg-gray-950 border border-gray-200 p-2 sm:p-4 w-full max-w-md mx-2">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <h3 className="text-base uppercase text-gray-200">
                AUTHOR APPLICATION [PID: {Math.floor(Math.random() * 10000)}]
              </h3>
              <button
                onClick={() => setShowApplicationModal(false)}
                className="text-gray-200 hover:text-blue-400 text-xs sm:text-sm"
                aria-label="Close modal"
              >
                [EXIT]
              </button>
            </div>
            {applicationSubmitted ? (
              <p className="text-gray-200 text-xs sm:text-sm">APPLICATION SUBMITTED. AWAITING REVIEW.</p>
            ) : (
              <form onSubmit={handleAuthorApplication}>
                <div className="mb-1 sm:mb-2">
                  <label className="block text-xs sm:text-sm uppercase text-gray-200">FULL NAME</label>
                  <input
                    type="text"
                    value={applicationForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setApplicationForm({ ...applicationForm, name: e.target.value })
                    }
                    className="w-full bg-blue-500/20 border border-gray-200 py-1 px-2 text-gray-200 focus:outline-none focus:animate-pulse-cursor text-xs sm:text-sm"
                    required
                    aria-label="Full name"
                  />
                </div>
                <div className="mb-1 sm:mb-2">
                  <label className="block text-xs sm:text-sm uppercase text-gray-200">EMAIL</label>
                  <input
                    type="email"
                    value={applicationForm.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setApplicationForm({ ...applicationForm, email: e.target.value })
                    }
                    className="w-full bg-blue-500/20 border border-gray-200 py-1 px-2 text-gray-200 focus:outline-none focus:animate-pulse-cursor text-xs sm:text-sm"
                    required
                    aria-label="Email"
                  />
                </div>
                <div className="mb-1 sm:mb-2">
                  <label className="block text-xs sm:text-sm uppercase text-gray-200">SAMPLE WORK (URL OR TEXT)</label>
                  <textarea
                    value={applicationForm.sampleWork}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setApplicationForm({ ...applicationForm, sampleWork: e.target.value })
                    }
                    className="w-full bg-blue-500/20 border border-gray-200 py-1 px-2 text-gray-200 focus:outline-none focus:animate-pulse-cursor text-xs sm:text-sm"
                    rows={3}
                    required
                    aria-label="Sample work"
                  />
                </div>
                <div className="mb-1 sm:mb-2">
                  <label className="block text-xs sm:text-sm uppercase text-gray-200">
                    KYC STATUS: <span className="text-blue-400">{applicationForm.kycStatus.toUpperCase()}</span>
                  </label>
                  {!kycVerified && (
                    <button
                      type="button"
                      onClick={handleKycVerification}
                      className="text-gray-200 hover:text-blue-400 mt-1 sm:mt-2 text-xs sm:text-sm"
                      aria-label="Verify KYC"
                    >
                      [VERIFY KYC]
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full text-gray-200 hover:text-blue-400 bg-gray-200/20 py-1 rounded border border-gray-200/50 text-xs sm:text-sm"
                  aria-label="Submit application"
                >
                  [SUBMIT]
                </button>
              </form>
            )}
          </div>
        </motion.div>
      )}

      {/* Notifications Ticker */}
      {notifications.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-2 right-4 w-56 sm:w-64 bg-pink-400/80 border border-gray-200 p-1 sm:p-2 z-50"
        >
          <h4 className="text-xs sm:text-sm uppercase text-gray-200">SYSTEM ALERTS</h4>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs sm:text-sm text-gray-200 mb-1 sm:mb-2 flex justify-between"
            >
              <span>{notif.message} @ {new Date(notif.timestamp).toLocaleTimeString()}</span>
              {!notif.read && (
                <button
                  onClick={() => markNotificationAsRead(notif.id)}
                  className="text-blue-400 hover:text-gray-200 ml-1 sm:ml-2 text-xs sm:text-sm"
                  aria-label="Mark as read"
                >
                  [READ]
                </button>
              )}
            </motion.div>
          ))}
          <button
            onClick={() => setNotifications([])}
            className="text-gray-200 hover:text-blue-400 mt-1 sm:mt-2 text-xs sm:text-sm"
            aria-label="Clear notifications"
          >
            [CLEAR ALERTS]
          </button>
        </motion.div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`px-4 py-2 rounded text-white ${
              toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }`}
          >
            {toast.message}
          </motion.div>
        ))}
      </div>

      <footer className="bg-gray-950 p-1 sm:p-2 text-center w-full border-t border-gray-200 border-l-0 border-r-0">
        <p className="text-xs sm:text-sm text-gray-200">UPTIME: {uptime}s | POWERED BY BASE NETWORK</p>
      </footer>

      <style jsx>{`
        html,
        body {
          height: 100%;
          margin: 0;
          padding: 0;
        }
        .flex-1 {
          flex: 1;
        }
        main {
          margin: 0;
          padding: 0;
          max-width: 100%;
          width: 100vw;
        }
        @media (min-width: 1024px) {
          main {
            max-width: 100%;
            padding: 0;
          }
        }
        @keyframes pulse-cursor {
          0% { border-right: 2px solid transparent; }
          50% { border-right: 2px solid #e0f7fa; }
          100% { border-right: 2px solid transparent; }
        }
        .focus\\:animate-pulse-cursor:focus {
          animation: pulse-cursor 1s infinite;
        }
        @keyframes pulse-border {
          0% { border-color: #e0f7fa; }
          50% { border-color: #1e90ff; }
          100% { border-color: #e0f7fa; }
        }
        .animate-pulse-border {
          animation: pulse-border 2s infinite;
        }
        @media (max-width: 640px) {
          h1 { font-size: clamp(1rem, 4vw, 1.25rem); }
          h2 { font-size: clamp(0.875rem, 3vw, 1rem); }
          h3 { font-size: clamp(0.75rem, 2.5vw, 0.875rem); }
          .grid-cols-1 { grid-template-columns: 1fr; }
          .grid-cols-2 { grid-template-columns: 1fr; }
          .grid-cols-3 { grid-template-columns: 1fr; }
          .gap-1 { gap: 0.25rem; }
          .gap-2 { gap: 0.5rem; }
          .gap-4 { gap: 1rem; }
          .max-w-[468px] { max-width: 100%; }
          .w-56, .w-64 { width: 100%; }
          .p-1 { padding: 0.25rem; }
          .p-2 { padding: 0.5rem; }
          .px-4 { padding-left: 1rem; padding-right: 1rem; }
          .w-20, .w-24 { width: 40%; }
        }
      `}</style>
    </div>
  );
}