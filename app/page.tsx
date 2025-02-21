"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CountUp from "react-countup";
import Link from "next/link";

// Import your custom components (adjust paths as needed)
import ScrollingTokenBanner from "./components/ScrollingTokenBanner";
import Header from "./components/Header";
import Footer from "./components/Footer";

// Import the NewsArticle type from your content file
import { NewsArticle } from "./content/articles"; // adjust path as needed

/* --------------------------------------------------------------------------
   ICON COMPONENTS (All defined only once)
   -------------------------------------------------------------------------- */
function CoinIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mx-auto mb-2"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M10 8h4a2 2 0 010 4h-4a2 2 0 000 4h4" />
      <path d="M12 6v2m0 8v2" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mx-auto mb-2"
    >
      <rect x="4" y="10" width="4" height="8" />
      <rect x="10" y="6" width="4" height="12" />
      <rect x="16" y="2" width="4" height="16" />
    </svg>
  );
}

function BlockIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mx-auto mb-2"
    >
      <path d="M21 4H3v16h18V4z" />
      <path d="M3 9h18" />
      <path d="M9 9v11" />
      <path d="M15 9v11" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg
      width="42"
      height="42"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mx-auto mb-3"
    >
      <path d="M13 2L3 14h9l-1 8 9-12h-9l2-8z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      width="42"
      height="42"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mx-auto mb-3"
    >
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="42"
      height="42"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mx-auto mb-3"
    >
      <path d="M12 2l7 4v6c0 5.25-3.48 10-7 10s-7-4.75-7-10V6l7-4z" />
      <path d="M9.5 12l1.5 1.5L14.5 10" />
    </svg>
  );
}

/* New Icons for "How Homebase Powers Base" Section */
function ChartIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mx-auto mb-3"
    >
      <polyline points="4 16 8 12 12 16 16 10 20 14" />
      <polyline points="4 20 20 20" />
    </svg>
  );
}

function InsightIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mx-auto mb-3"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mx-auto mb-3"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.09a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.09a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

/* New Icons for "Market Moves Fast" Section */
function TrendIcon() {
  return (
    <svg
      width="26"
      height="26"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mr-3"
    >
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="21 7 21 17 9 17" />
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg
      width="26"
      height="26"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mr-3"
    >
      <path d="M4 12h16M4 12l6-6M4 12l6 6" />
    </svg>
  );
}

function SentimentIcon() {
  return (
    <svg
      width="26"
      height="26"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primaryBlue mr-3"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
   LATEST NEWS SECTION (Dynamic)
   -------------------------------------------------------------------------- */
function LatestNewsSection() {
  const [latestArticles, setLatestArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchArticles() {
      try {
        const res = await fetch("/api/news");
        if (!res.ok) {
          setError("Failed to fetch articles");
          setLoading(false);
          return;
        }
        const articles: NewsArticle[] = await res.json();
        const sortedArticles = articles.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        setLatestArticles(sortedArticles.slice(0, 3));
      } catch (err) {
        console.error(err);
        setError("Error fetching articles");
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, []);

  if (loading) {
    return (
      <motion.section
        className="py-12 container mx-auto px-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl font-extrabold mb-6 text-center">Latest News</h2>
        <p className="text-center">Loading latest news...</p>
      </motion.section>
    );
  }

  if (error) {
    return (
      <motion.section
        className="py-12 container mx-auto px-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl font-extrabold mb-6 text-center">Latest News</h2>
        <p className="text-center text-red-500">{error}</p>
      </motion.section>
    );
  }

  return (
    <motion.section
      className="py-12 container mx-auto px-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-3xl font-extrabold mb-6 text-center">Latest News</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {latestArticles.map((article) => (
          <motion.div
            key={article.id}
            whileHover={{ scale: 1.05 }}
            className="p-4 shadow-md border rounded-lg bg-white/70 backdrop-blur-md"
          >
            <h3 className="text-xl font-bold text-primaryBlue">{article.title}</h3>
            <p className="text-sm mt-2">{article.content.slice(0, 100)}...</p>
            <Link
              href={`/news/${article.id}`}
              className="text-primaryBlue mt-4 inline-block hover:underline"
            >
              Read more
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

/* --------------------------------------------------------------------------
   MAIN HOMEPAGE COMPONENT
   -------------------------------------------------------------------------- */
function HomePage() {
  const [stats, setStats] = useState({
    price: 0,
    volume: 0,
    latestBlock: 0,
  });

  // Fetch live ETH price, 24h volume from CoinGecko and latest block from Alchemy
  useEffect(() => {
    async function fetchData() {
      try {
        const coingeckoUrl = process.env.NEXT_PUBLIC_COINGECKO_API_URL;
        const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;
        if (!coingeckoUrl || !alchemyUrl) {
          console.error("Missing API URLs in environment variables.");
          return;
        }
        // Fetch latest block from Alchemy
        const alchemyRes = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 1,
          }),
        });
        const alchemyData = await alchemyRes.json();
        const latestBlock = parseInt(alchemyData?.result, 16) || 0;

        // Fetch ETH data from CoinGecko (using /coins/ethereum)
        const coingeckoRes = await fetch(`${coingeckoUrl}/coins/ethereum`);
        const coingeckoData = await coingeckoRes.json();
        const price = coingeckoData?.market_data?.current_price?.usd || 0;
        const volume = coingeckoData?.market_data?.total_volume?.usd || 0;

        setStats({ price, volume, latestBlock });
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      {/* Scrolling Token Banner */}
      <ScrollingTokenBanner />

      {/* Header */}
      <Header />

      {/* Hero Section */}
      <motion.section
        className="text-center py-20 bg-gradient-to-r from-primaryBlue to-blue-500 text-white"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl font-extrabold mb-6 leading-tight">
          See Forward with Homebase Analytics
        </h1>
        <p className="text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
          Discover insights that drive the crypto markets. Get live ETH pricing,
          24h volume data, and on-chain analytics—all in one place.
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/tools">
            <button className="px-6 py-3 border border-white bg-transparent text-white font-semibold rounded-full hover:bg-white hover:text-primaryBlue transition-all">
              Explore Tools →
            </button>
          </Link>
          <Link href="/tools/market-insights/terminal">
            <button className="px-6 py-3 border border-white bg-transparent text-white font-semibold rounded-full hover:bg-white hover:text-primaryBlue transition-all">
              News Terminal →
            </button>
          </Link>
        </div>
      </motion.section>

      <main className="flex-grow">
        {/* Stats Section */}
        <motion.section
          className="container mx-auto py-12 px-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-center">
            {[
              {
                title: "ETH Price (USD)",
                value: stats.price,
                suffix: "$",
                icon: <CoinIcon />,
              },
              {
                title: "24h Ethereum Volume",
                value: stats.volume,
                suffix: "$",
                icon: <VolumeIcon />,
              },
              {
                title: "Latest Block",
                value: stats.latestBlock,
                suffix: "",
                icon: <BlockIcon />,
              },
            ].map((stat, index) => (
              <motion.div
                key={index}
                className="p-6 bg-white shadow-md rounded-lg flex flex-col items-center"
                whileHover={{ scale: 1.05 }}
              >
                {stat.icon}
                <h2 className="text-xl font-bold text-primaryBlue mb-1">
                  {stat.title}
                </h2>
                <p className="text-2xl font-semibold leading-relaxed text-gray-800">
                  <CountUp
                    start={stat.value * 0.9}
                    end={stat.value}
                    duration={2}
                    separator=","
                    decimals={2}
                    suffix={` ${stat.suffix}`}
                  />
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* "What is Base?" Section */}
        <motion.section
          className="w-full py-16 bg-gray-50 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
              <span className="text-black">What is</span>{" "}
              <span className="text-primaryBlue">Base?</span>
            </h2>
            <p className="text-gray-700 max-w-2xl mx-auto mb-10 text-lg leading-relaxed">
              Base is a next-generation Layer 2 network built on Optimism's OP Stack, designed for faster and cheaper transactions while unlocking new possibilities for Web3.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <motion.div
                className="p-6 bg-white rounded-lg shadow-sm"
                whileHover={{ scale: 1.05 }}
              >
                <LightningIcon />
                <h3 className="text-xl font-bold text-primaryBlue mb-3">
                  Faster Transactions
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Enjoy near-instant confirmations and lower fees.
                </p>
              </motion.div>
              <motion.div
                className="p-6 bg-white rounded-lg shadow-sm"
                whileHover={{ scale: 1.05 }}
              >
                <CodeIcon />
                <h3 className="text-xl font-bold text-primaryBlue mb-3">
                  EVM-Compatible
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Deploy your dApps seamlessly with full Ethereum compatibility.
                </p>
              </motion.div>
              <motion.div
                className="p-6 bg-white rounded-lg shadow-sm"
                whileHover={{ scale: 1.05 }}
              >
                <ShieldIcon />
                <h3 className="text-xl font-bold text-primaryBlue mb-3">
                  Secure &amp; Scalable
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Robust security meets unrivaled scalability, backed by industry leaders.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* "How Homebase Powers Base" Section */}
        <motion.section
          className="w-full py-16 bg-white text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-primaryBlue leading-tight">
              How Homebase Powers Base
            </h2>
            <p className="text-gray-700 max-w-3xl mx-auto mb-10 text-lg leading-relaxed">
              Homebase aggregates on-chain data, market metrics, and developer tools to give you a holistic view of Base. Stay ahead with real-time insights.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <motion.div
                className="p-6 bg-gray-50 rounded-lg shadow-sm"
                whileHover={{ scale: 1.05 }}
              >
                <ChartIcon />
                <h3 className="text-xl font-bold text-primaryBlue mb-1">
                  In-Depth Analytics
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Dive into comprehensive charts and metrics.
                </p>
              </motion.div>
              <motion.div
                className="p-6 bg-gray-50 rounded-lg shadow-sm"
                whileHover={{ scale: 1.05 }}
              >
                <InsightIcon />
                <h3 className="text-xl font-bold text-primaryBlue mb-1">
                  Key Insights
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Get actionable insights and trends from blockchain data.
                </p>
              </motion.div>
              <motion.div
                className="p-6 bg-gray-50 rounded-lg shadow-sm"
                whileHover={{ scale: 1.05 }}
              >
                <ToolIcon />
                <h3 className="text-xl font-bold text-primaryBlue mb-1">
                  Developer Tools
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Access robust APIs, contract explorers, and more.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Markets Section */}
        <motion.section
          className="w-full py-16 bg-gray-100 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-extrabold mb-6 text-black leading-tight">
            Markets move fast. Homebase keeps you ahead.
          </h2>
          <p className="max-w-xl mx-auto text-gray-700 mb-10 text-lg leading-relaxed">
            Stay updated on ETH pricing, 24h trading volume, and network activity with our real-time data feeds.
          </p>
          <div className="flex flex-col items-center space-y-6">
            <motion.div whileHover={{ scale: 1.05 }} className="flex items-center">
              <TrendIcon />
              <p>Track price trends accurately</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="flex items-center">
              <FlowIcon />
              <p>Monitor capital flows effortlessly</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="flex items-center">
              <SentimentIcon />
              <p>Assess market sentiment in real time</p>
            </motion.div>
          </div>
        </motion.section>

        {/* Latest News Section (Dynamic) */}
        <LatestNewsSection />
      </main>

      <Footer />
    </div>
  );
}

/* --------------------------------------------------------------------------
   MAIN EXPORT: HomePage Component Wrapper
   -------------------------------------------------------------------------- */
export default function HomePageWrapper() {
  return <HomePage />;
}






