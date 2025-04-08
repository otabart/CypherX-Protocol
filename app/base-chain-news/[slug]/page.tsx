"use client";

import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
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

interface NewsPageProps {
  params: { slug: string };
}

// Animation variants for the card
const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
};

// Typewriter animation for the title (character-by-character)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05, // Delay between each character
    },
  },
};

const letterVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
    },
  },
};

// Loading dots animation
const dotsVariants = {
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3,
      repeat: Infinity,
      repeatType: "loop",
    },
  },
};

const dotVariants = {
  animate: {
    opacity: [0, 1, 0],
    transition: {
      duration: 0.9,
    },
  },
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

export default function NewsPage({ params }: NewsPageProps) {
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    async function fetchArticle() {
      console.log("Fetching article for slug:", params.slug);
      try {
        const res = await fetch(`/api/news/${params.slug}`);
        console.log("API response status:", res.status);
        if (!res.ok) {
          console.log("Article not found for slug:", params.slug);
          setError("Article not found");
          setLoading(false);
          return;
        }
        const data: NewsArticle = await res.json();
        console.log("Fetched article:", data);
        setArticle(data);
        setLastUpdated(new Date().toLocaleString());
        setLoading(false);
      } catch (err) {
        console.error("Error fetching article:", err);
        setError("Error fetching article");
        setLoading(false);
      }
    }
    fetchArticle();
  }, [params.slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-blue-300 text-lg sm:text-xl font-mono">
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

  // Split the title into individual characters for the typewriter effect
  const titleCharacters = article.title.split("");

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
        <span className="block whitespace-nowrap">LAST UPDATED: {lastUpdated}</span>
      </div>

      {/* Main container with padding */}
      <div className="container mx-auto px-6 sm:px-4 py-8 sm:py-16 pb-32 sm:pb-20">
        {/* Back to News Link */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 sm:mb-6 pl-2"
        >
          <Link
            href="/base-chain-news"
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
            [Back to News]
          </Link>
        </motion.div>

        {/* Article Card (Terminal Window) */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="bg-gray-900 border-2 border-primaryBlue rounded-lg shadow-[0_0_10px_rgba(37,99,235,0.5)] w-full max-w-lg sm:max-w-3xl mx-auto"
        >
          {/* Terminal Window Bar */}
          <div className="flex items-center space-x-2 p-4 sm:p-2 bg-gray-800 border-b-2 border-primaryBlue rounded-t-lg">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span className="text-blue-300 text-base sm:text-sm flex-1 text-center [text-shadow:0_0_3px_rgba(37,99,235,0.3)]">
              Terminal: Article Viewer
            </span>
          </div>

          {/* Article Content */}
          <div className="p-6 sm:p-6">
            {/* Article Title with Typewriter Effect */}
            <div className="mb-6 sm:mb-4">
              <motion.h1
                className="text-4xl sm:text-3xl font-bold text-blue-300 break-words [text-shadow:0_0_3px_rgba(37,99,235,0.3)] inline-block"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{ direction: "ltr", textAlign: "left" }}
              >
                {titleCharacters.map((char, index) => (
                  <motion.span key={index} variants={letterVariants}>
                    {char}
                  </motion.span>
                ))}
              </motion.h1>
            </div>

            {/* Meta Information */}
            <div className="text-base sm:text-sm text-blue-300 mb-6 [text-shadow:0_0_3px_rgba(37,99,235,0.3)]">
              <span>USER: {article.author}</span>
              <span className="mx-2">|</span>
              <span>DATE: {new Date(article.publishedAt).toLocaleString()}</span>
            </div>

            {/* Article Content */}
            <p className="text-base sm:text-base text-blue-300 leading-loose sm:leading-relaxed mb-6 [text-shadow:0_0_3px_rgba(37,99,235,0.3)]">
              {highlightKeywords(article.content)}
            </p>

            {/* Source */}
            <div className="text-base sm:text-sm text-blue-300 [text-shadow:0_0_3px_rgba(37,99,235,0.3)]">
              SOURCE: {article.source}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}