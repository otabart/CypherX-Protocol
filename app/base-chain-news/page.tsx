"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

// Define the NewsArticle interface
interface NewsArticle {
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
}

// Animation variants for the cards
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// Utility function to truncate text at a word boundary
const truncateAtWord = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace === -1) return truncated;
  return truncated.slice(0, lastSpace);
};

// Utility function to highlight keywords
const highlightKeywords = (text: string) => {
  const keywords = ["Base", "DeFi", "TVL"];
  let highlightedText = text;
  keywords.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    highlightedText = highlightedText.replace(
      regex,
      `<span class="text-blue-100 [text-shadow:0_0_3px_rgba(37,99,235,0.3)]">${keyword}</span>`
    );
  });
  return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
};

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    async function fetchArticles() {
      try {
        const res = await fetch("/api/news");
        if (!res.ok) {
          setError("Failed to fetch articles");
          setLoading(false);
          return;
        }
        const data: NewsArticle[] = await res.json();
        const sortedArticles = data.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        setArticles(sortedArticles);
        setLastUpdated(new Date().toLocaleString());
        setLoading(false);
      } catch (err) {
        console.error("Error fetching articles:", err);
        setError("Error fetching articles");
        setLoading(false);
      }
    }
    fetchArticles();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-blue-300 text-lg sm:text-xl font-mono">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-red-500 text-lg sm:text-xl font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-blue-300 font-mono relative overflow-hidden">
      {/* Scanline effect (disabled on mobile for performance) */}
      <div className="absolute inset-0 pointer-events-none hidden sm:block">
        <div className="w-full h-full bg-gradient-to-b from-transparent via-black/10 to-transparent animate-scanline" />
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t-2 border-primaryBlue p-3 text-base sm:text-sm text-blue-300 flex sm:space-x-4 sm:space-y-0 overflow-x-auto z-10">
        <span className="block whitespace-nowrap">SYS: homebaseOS v1.0.0</span>
        <span className="hidden sm:inline mx-2">|</span>
        <span className="block whitespace-nowrap">UPTIME: {Math.floor(Date.now() / 1000)}s</span>
        <span className="hidden sm:inline mx-2">|</span>
        <span className="block whitespace-nowrap">ARTICLES: {articles.length}</span>
        <span className="hidden sm:inline mx-2">|</span>
        <span className="block whitespace-nowrap">LAST UPDATED: {lastUpdated}</span>
      </div>

      {/* Main container with padding */}
      <div className="container mx-auto px-6 sm:px-4 py-8 sm:py-16 pb-32 sm:pb-20">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 sm:mb-6 pl-2"
        >
          <button
            onClick={() => router.push("/terminal")}
            className="text-blue-300 hover:text-blue-400 transition-colors duration-300 flex items-center [text-shadow:0_0_3px_rgba(37,99,235,0.3)] text-base sm:text-sm p-2"
          >
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            [Terminal]
          </button>
        </motion.div>

        {/* Header */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="text-4xl sm:text-4xl font-bold text-blue-300 mb-10 sm:mb-8 text-center [text-shadow:0_0_3px_rgba(37,99,235,0.3)]"
        >
          Base Chain News
        </motion.h1>

        {/* Articles Grid (Terminal Windows) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-6">
          {articles.map((article) => (
            <motion.div
              key={article.slug}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.02 }}
              className="bg-gray-900 border-2 border-primaryBlue rounded-lg shadow-[0_0_10px_rgba(37,99,235,0.5)] mx-auto w-full max-w-lg sm:max-w-none"
            >
              {/* Terminal Window Bar */}
              <div className="flex items-center space-x-2 p-4 sm:p-2 bg-gray-800 border-b-2 border-primaryBlue rounded-t-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-blue-300 text-base sm:text-sm flex-1 text-center [text-shadow:0_0_3px_rgba(37,99,235,0.3)]">
                  Article Preview
                </span>
              </div>

              {/* Article Content */}
              <div className="p-6 sm:p-4">
                <h2 className="text-xl sm:text-xl font-bold text-blue-300 mb-3 sm:mb-2 [text-shadow:0_0_3px_rgba(37,99,235,0.3)] break-words">
                  {article.title}
                </h2>
                <div className="text-base sm:text-sm text-blue-300 mb-3 sm:mb-2 [text-shadow:0_0_3px_rgba(37,99,235,0.3)]">
                  <span>DATE: {new Date(article.publishedAt).toLocaleString()}</span>
                </div>
                <p className="text-base sm:text-sm text-blue-300 mb-4 sm:mb-4 [text-shadow:0_0_3px_rgba(37,99,235,0.3)] leading-loose sm:leading-relaxed">
                  {highlightKeywords(truncateAtWord(article.content, 150))}...
                </p>
                <div className="p-2">
                  <Link
                    href={`/base-chain-news/${article.slug}`}
                    onClick={() => console.log(`Navigating to /base-chain-news/${article.slug}`)}
                    className="text-blue-300 hover:text-blue-400 transition-colors [text-shadow:0_0_3px_rgba(37,99,235,0.3)] text-base sm:text-sm"
                  >
                    [Read more]
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}