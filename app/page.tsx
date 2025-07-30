"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import { motion } from "framer-motion";
import Link from "next/link";
import Header from "./components/Header";
import Footer from "./components/Footer";
import TrendingWidget from "./components/TrendingWidget";
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

type NewsArticle = {
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
};

type Block = {
  number: number;
  status: string;
  timestamp: string;
  hash: string;
  transactions: number;
};

export default function Page() {
  const [stats, setStats] = useState<{ price: number; volume: number; latestBlock: number } | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [latestArticles, setLatestArticles] = useState<NewsArticle[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [errorBlocks, setErrorBlocks] = useState("");
  const [errorNews, setErrorNews] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    async function fetchBlockData() {
      try {
        const coingeckoUrl = process.env.NEXT_PUBLIC_COINGECKO_API_URL;
        const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

        if (!coingeckoUrl || !alchemyUrl) {
          throw new Error("API configuration missing.");
        }

        const alchemyBlockRes = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
        });
        const alchemyBlockData = await alchemyBlockRes.json();
        const latestBlock = parseInt(alchemyBlockData.result, 16) || 0;

        const fetchedBlocks: Block[] = [];
        for (let i = 0; i < 10; i++) {
          const blockNumber = latestBlock - i;
          const blockRes = await fetch(alchemyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getBlockByNumber",
              params: [`0x${blockNumber.toString(16)}`, false],
              id: 1,
            }),
          });
          const blockData = await blockRes.json();
          const block = blockData?.result;
          if (block) {
            const timestamp = new Date(parseInt(block.timestamp, 16) * 1000);
            const timeAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);
            fetchedBlocks.push({
              number: blockNumber,
              status: "Finalized",
              timestamp: `${timeAgo} SEC${timeAgo === 1 ? "" : "S"} AGO`,
              hash: block.hash,
              transactions: block.transactions?.length || 0,
            });
          }
        }

        const coingeckoRes = await fetch(`${coingeckoUrl}/coins/ethereum`);
        const coingeckoData = await coingeckoRes.json();
        const price = coingeckoData?.market_data?.current_price?.usd || 0;
        const volume = coingeckoData?.market_data?.total_volume?.usd || 0;

        setStats({ price, volume, latestBlock });
        setBlocks(fetchedBlocks);
        setErrorBlocks("");
      } catch {
        const errMsg = "Failed to fetch block data.";
        setErrorBlocks(errMsg);
        toast.error(errMsg);
      } finally {
        setLoadingBlocks(false);
      }
    }

    fetchBlockData();
    const interval = setInterval(fetchBlockData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchArticles() {
      try {
        const res = await fetch("/api/news");
        const articles: NewsArticle[] = await res.json();
        const sortedArticles = articles.sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        setLatestArticles(sortedArticles.slice(0, 3));
        setErrorNews("");
      } catch {
        const errMsg = "Error fetching articles";
        setErrorNews(errMsg);
        toast.error(errMsg);
      } finally {
        setLoadingNews(false);
      }
    }
    fetchArticles();
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
          .fog {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(27, 33, 45, 0.2) 0%, rgba(15, 23, 42, 0.4) 70%);
            animation: fogFlow 10s infinite linear alternate;
            pointer-events: none;
          }
          @keyframes fogFlow {
            0% { transform: translate(0, 0) scale(1); opacity: 0.3; }
            50% { transform: translate(-5%, -5%) scale(1.1); opacity: 0.5; }
            100% { transform: translate(5%, 5%) scale(1); opacity: 0.3; }
          }
        `}</style>
      </Head>

      <TrendingWidget />
      <Header />

      <main className="flex flex-col min-h-screen bg-gray-950 text-gray-200 p-4 sm:p-6 lg:p-8">
        {/* Top Row - Equal Height Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8">
          <motion.div className="flex flex-col h-full" {...fadeInUp(0)}>
            <div className="flex-1">
              <TopPerformingCoins />
            </div>
          </motion.div>

          <motion.div className="flex flex-col h-full" {...fadeInUp(0.1)}>
            <div className="flex-1">
              <LatestBlocks blocks={blocks} stats={stats} isMobile={isMobile} loading={loadingBlocks} error={errorBlocks} />
            </div>
          </motion.div>
        </div>

        {/* Indexes Section */}
        <motion.div className="mb-8" {...fadeInUp(0.2)}>
          <BaseAiIndex />
        </motion.div>

        {/* Latest News Section */}
        <motion.div {...fadeInUp(0.3)}>
          <LatestNews articles={latestArticles} isMobile={isMobile} loading={loadingNews} error={errorNews} />
        </motion.div>
      </main>

      <Footer />
    </>
  );
}

// Updated LatestNews Component with enhancements
function LatestNews({ articles, isMobile, loading, error }: { articles: NewsArticle[]; isMobile: boolean; loading: boolean; error: string }) {
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

  return (
    <motion.div
      className="w-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-lg p-4 sm:p-6 border border-blue-500/30 flex flex-col"
      {...fadeInUp(0)}
    >
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-200">[ LATEST NEWS ]</h2>
      </div>
      <div className="space-y-4 flex-grow">
        {articles.slice(0, 3).map((article) => (
          <motion.div
            key={article.slug}
            className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg shadow-md p-4 border border-blue-500/30 hover:shadow-xl transition-all duration-300"
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
      <div className="text-center mt-6">
        <Link
          href="/base-chain-news"
          className="inline-flex items-center gap-2 text-blue-400 font-semibold text-sm px-4 py-2 rounded-full hover:bg-blue-500/20 transition-all duration-200 hover:scale-105"
        >
          View All Articles
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </motion.div>
  );
}

// Updated LatestBlocks Component with consistent height and enhanced styling
function LatestBlocks({
  blocks,
  stats,
  isMobile,
  loading,
  error,
}: {
  blocks: Block[];
  stats: { price: number; volume: number; latestBlock: number } | null;
  isMobile: boolean;
  loading: boolean;
  error: string;
}) {
  const abbreviateNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <motion.div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 shadow-lg border border-blue-500/30 flex flex-col h-full min-h-[400px]">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-200">[ LATEST BLOCKS ]</h2>
          <div className={`${isMobile ? "flex flex-col items-start space-y-1 ml-auto text-right" : "flex flex-wrap items-center space-x-3"} text-sm sm:text-base`}>
            <div className="h-5 w-24 bg-gray-800 rounded animate-pulse" />
            <div className="h-5 w-24 bg-gray-800 rounded animate-pulse" />
            <div className="h-5 w-24 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-4 flex-grow">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 shadow-lg border border-blue-500/30 flex flex-col h-full min-h-[400px]">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-200 mb-4 sm:mb-6">[ LATEST BLOCKS ]</h2>
        <p className="text-center text-red-400 flex-grow flex items-center justify-center">{error}</p>
      </div>
    );
  }

  return (
          <motion.div
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 sm:p-6 shadow-lg border border-blue-500/30 flex flex-col h-full min-h-[400px]"
        {...fadeInUp(0.1)}
      >
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-200">[ LATEST BLOCKS ]</h2>
        {stats ? (
          <div className={`${isMobile ? "flex flex-col items-start space-y-1 ml-auto text-right" : "flex flex-wrap items-center space-x-3"} text-sm sm:text-base`}>
            <span className="bg-blue-500/20 px-2 py-1 rounded-md border border-blue-500/30">Price: <span className="text-blue-400">${stats.price.toFixed(2)}</span></span>
            <span className="bg-teal-500/20 px-2 py-1 rounded-md border border-teal-500/30">Volume: <span className="text-teal-400">${abbreviateNumber(stats.volume)}</span></span>
            <span className="bg-purple-500/20 px-2 py-1 rounded-md border border-purple-500/30">Block: <span className="text-purple-400">{abbreviateNumber(stats.latestBlock)}</span></span>
          </div>
        ) : (
          <div className={`${isMobile ? "flex flex-col items-start space-y-1 ml-auto text-right" : "flex flex-wrap items-center space-x-3"} text-sm sm:text-base`}>
            <div className="h-5 w-24 bg-gray-800 rounded animate-pulse" />
            <div className="h-5 w-24 bg-gray-800 rounded animate-pulse" />
            <div className="h-5 w-24 bg-gray-800 rounded animate-pulse" />
          </div>
        )}
      </div>
      <div className="space-y-4 flex-grow">
        {blocks.length ? (
          blocks.slice(0, 3).map((block) => (
            <motion.div
              key={block.number}
              className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-4 border border-blue-500/20 hover:shadow-xl transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className={`flex ${isMobile ? "flex-col gap-2" : "gap-3 items-center"} mb-3`}>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <span className="text-base sm:text-lg font-bold text-gray-200">#{block.number}</span>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full">
                    [ {block.status} ]
                  </span>
                </div>
                <span className="text-sm sm:text-base text-gray-500">{block.timestamp}</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm sm:text-base text-gray-600">
                  <span className="font-semibold text-gray-200">HASH:</span> {block.hash.slice(0, 10)}...
                </p>
                <p className="text-sm sm:text-base text-gray-600">
                  <span className="font-semibold text-gray-200">TXNS:</span> {block.transactions}
                </p>
                <div className="flex justify-end">
                  <Link
                    href={`/explorer/latest/block/${block.number}`}
                    className="text-blue-400 hover:text-blue-300 text-sm transition-colors inline-flex items-center gap-1"
                  >
                    View Details
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse" />
          ))
        )}
      </div>
      <div className="text-center mt-6">
        <Link
          href="/explorer/latest/block"
          className="inline-flex items-center gap-2 text-blue-400 font-semibold text-sm px-4 py-2 rounded-full hover:bg-blue-500/20 transition-all duration-200 hover:scale-105"
        >
          View All Blocks
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </motion.div>
  );
}