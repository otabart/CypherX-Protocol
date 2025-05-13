'use client';

import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import ScrollingTokenBanner from './components/ScrollingTokenBanner.tsx';
import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import PartnersScroller from './components/PartnersScroller.tsx';
import BaseAiIndex from './components/Indexes.tsx';

// Type definitions
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

// Custom hook for mobile detection
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
}

function getScrollAnimationProps(isMobile: boolean) {
  return {
    initial: { opacity: 0, y: isMobile ? 50 : 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: isMobile ? 0.8 : 0.6, ease: 'circOut' },
  };
}

// Icon components
function CoinIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 256 417"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto mb-2"
    >
      <path fill="#3B82F6" d="M127.9,0L124.7,11.2V274.6l3.2,3.3l127.9-68.8L127.9,0z" />
      <path fill="#60A5FA" d="M127.9,0L0,209.1l127.9,68.8V0z" />
      <path fill="#93C5FD" d="M127.9,311.3l-2.3,2.3V414.8l2.3,2.2l128.1-76.1L127.9,311.3z" />
      <path fill="#60A5FA" d="M127.9,414.8V311.3L256,239.7L127.9,414.8z" />
      <path fill="#2563EB" d="M127.9,277.9l127.9-68.8l-127.9-59.6V277.9z" />
      <path fill="#3B82F6" d="M0,209.1l127.9,68.8V218.3L0,209.1z" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3B82F6"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto mb-2"
    >
      <rect x="4" y="10" width="4" height="8" />
      <rect x="10" y="6" width="4" height="12" />
      <rect x="16" y="2" width="4" height="16" />
    </svg>
  );
}

function BlockIcon({ className }: IconProps) {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3B82F6"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2 L2 7 L12 12 L22 7 Z" />
      <path d="M2 7 L2 17 L12 22 L22 17 L22 7" />
      <path d="M12 12 L12 22" />
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
      stroke="#3B82F6"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto mb-3"
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
      stroke="#3B82F6"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto mb-3"
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
      stroke="#3B82F6"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto mb-3"
    >
      <path d="M12 2l7 4v6c0 5.25-3.48 10-7 10s-7-4.75-7-10V6l7-4z" />
      <path d="M9.5 12l1.5 1.5L14.5 10" />
    </svg>
  );
}

interface IconProps {
  className?: string;
}

const ChartIcon: FC<IconProps> = ({ className }) => {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3B82F6"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="4 16 8 12 12 16 16 10 20 14" />
      <polyline points="4 20 20 20" />
    </svg>
  );
};

const InsightIcon: FC<IconProps> = ({ className }) => {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3B82F6"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
};

const ToolIcon: FC<IconProps> = ({ className }) => {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3B82F6"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l-.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.09a1.65 1.65 0 001 1.51V3a2 2 0 014 0v-.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l-.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.09a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
};

function LatestBlocks({ blocks }: { blocks: Block[] }) {
  const cardVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
  };

  const blockVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  };

  return (
    <motion.div
      className="w-full font-mono bg-gray-950 rounded-xl shadow-lg p-4 sm:p-6 md:p-8 border border-blue-500/20"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-200 mb-4 sm:mb-6 md:mb-8">
        [ LATEST BLOCKS ]
      </h2>
      <div className="space-y-4 sm:space-y-6">
        <AnimatePresence>
          {blocks.slice(0, 3).map((block: Block, index) => (
            <motion.div
              key={block.number}
              className="rounded-lg bg-gray-950 shadow-md p-3 sm:p-4 md:p-6 border border-blue-500/20 transition-all duration-300 hover:shadow-xl"
              variants={blockVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4, delay: index * 0.2 }}
            >
              <div className="flex flex-col gap-2 sm:gap-0 sm:flex-row sm:justify-between sm:items-center mb-2 sm:mb-4">
                <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap">
                  <BlockIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-200" />
                  <span className="text-sm sm:text-base md:text-lg font-bold text-gray-200">
                    {block.number}
                  </span>
                  <span className="px-2 py-1 sm:px-2 sm:py-1 bg-blue-500/20 text-blue-400 text-xs sm:text-sm font-semibold rounded-full whitespace-nowrap">
                    [ {block.status} ]
                  </span>
                </div>
                <span className="text-xs sm:text-sm text-gray-400">{block.timestamp}</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs sm:text-sm text-gray-400 break-words">
                  <span className="font-semibold text-gray-200">BLOCK HASH:</span>{' '}
                  {block.hash}
                </p>
                <p className="text-xs sm:text-sm text-gray-400 flex flex-wrap items-center gap-1">
                  <span className="font-semibold text-gray-200">TXNS:</span>{' '}
                  {block.transactions}
                  <Link
                    href={`/explorer/latest/block/${block.number}`}
                    className="text-blue-400 hover:text-blue-300 whitespace-nowrap"
                  >
                    View on Cypherscsan
                  </Link>
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="text-center mt-6">
        <Link
          href="/explorer/latest/block"
          className="text-blue-400 font-semibold text-sm md:text-base hover:text-blue-300"
        >
          View Latest Blocks →
        </Link>
      </div>
    </motion.div>
  );
}

function NetworkInsights({
  stats,
}: {
  stats: { price: number; volume: number; latestBlock: number } | null;
}) {
  useEffect(() => {
    console.log('NetworkInsights received stats:', stats);
  }, [stats]);

  if (!stats) {
    return (
      <div className="text-center text-gray-400 py-12">
        Loading network stats...
      </div>
    );
  }

  const { price = 0, volume = 0, latestBlock = 0 } = stats;

  return (
    <section className="px-4 py-12 md:py-16 flex flex-col items-center bg-gray-950 relative">
      <div className="relative z-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-200 mb-4 md:mb-6 text-center">
          Base Chain Stats
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-gray-400 max-w-md md:max-w-2xl mx-auto mb-8 md:mb-10 text-center">
          Real-time insights into Ethereum and Base chain performance.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-md sm:max-w-5xl">
          {[
            {
              title: 'ETH Price (USD)',
              value: price,
              suffix: '$',
              icon: <CoinIcon />,
              decimals: 2,
              change: '+2.5%', // Example price change
            },
            {
              title: '24h Volume',
              value: volume,
              suffix: '$',
              icon: <VolumeIcon />,
              decimals: 0,
              change: '-1.2%', // Example volume change
            },
            {
              title: 'Latest Block',
              value: latestBlock,
              suffix: '',
              icon: <BlockIcon className="" />,
              decimals: 0,
              change: null,
            },
          ].map((stat, index) => (
            <motion.div
              key={index}
              className="bg-gray-950 border border-blue-500/20 rounded-xl shadow-lg flex flex-col items-center p-4 sm:p-6 min-h-[140px] transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="mb-3 flex items-center justify-center h-10">
                {stat.icon}
              </div>
              <h2 className="text-xs sm:text-sm font-semibold text-gray-400 text-center uppercase tracking-wide">
                {stat.title}
              </h2>
              <p className="text-lg sm:text-xl font-bold text-gray-200 mt-1">
                {stat.value === 0
                  ? 'N/A'
                  : `${stat.value.toLocaleString(undefined, {
                      minimumFractionDigits: stat.decimals,
                    })}${stat.suffix}`}
              </p>
              {stat.change && (
                <p
                  className={`text-xs sm:text-sm mt-1 ${
                    stat.change.includes('+') ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {stat.change}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Main HomePage component
function HomePage() {
  const [stats, setStats] = useState<{
    price: number;
    volume: number;
    latestBlock: number;
  } | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [latestArticles, setLatestArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isMobile = useIsMobile();
  const scrollProps = getScrollAnimationProps(isMobile);

  // Fetch live ETH data and block info
  useEffect(() => {
    async function fetchData() {
      try {
        console.log('Starting fetchData...');
        const coingeckoUrl = process.env.NEXT_PUBLIC_COINGECKO_API_URL;
        const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

        if (!coingeckoUrl || !alchemyUrl) {
          console.error('Missing environment variables:', {
            coingeckoUrl,
            alchemyUrl,
          });
          setError('API configuration missing. Please try again later.');
          return;
        }

        // Fetch Alchemy block number
        console.log('Fetching Alchemy block number...');
        const alchemyBlockRes = await fetch(alchemyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
        });

        if (!alchemyBlockRes.ok) {
          throw new Error(`Alchemy API error: ${alchemyBlockRes.statusText}`);
        }

        const alchemyBlockData = await alchemyBlockRes.json();
        console.log('Alchemy block response:', alchemyBlockData);

        if (!alchemyBlockData?.result) {
          throw new Error('Invalid Alchemy block number response');
        }

        const latestBlock = parseInt(alchemyBlockData.result, 16) || 0;

        // Fetch blocks
        const fetchedBlocks: Block[] = [];
        console.log('Fetching latest 10 blocks...');
        for (let i = 0; i < 10; i++) {
          const blockNumber = latestBlock - i;
          const blockRes = await fetch(alchemyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getBlockByNumber',
              params: [`0x${blockNumber.toString(16)}`, false],
              id: 1,
            }),
          });

          if (!blockRes.ok) {
            console.warn(`Failed to fetch block ${blockNumber}: ${blockRes.statusText}`);
            continue;
          }

          const blockData = await blockRes.json();
          const block = blockData?.result;

          if (block) {
            const timestamp = new Date(parseInt(block.timestamp, 16) * 1000);
            const timeAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);
            fetchedBlocks.push({
              number: blockNumber,
              status: 'Finalized',
              timestamp: `${timeAgo} SEC${timeAgo === 1 ? '' : 'S'} AGO`,
              hash: block.hash,
              transactions: block.transactions?.length || 0,
            });
          }
        }
        console.log('Fetched blocks:', fetchedBlocks);

        // Fetch CoinGecko data
        console.log('Fetching CoinGecko data...');
        const coingeckoRes = await fetch(`${coingeckoUrl}/coins/ethereum`, {
          headers: { Accept: 'application/json' },
        });

        if (!coingeckoRes.ok) {
          throw new Error(`CoinGecko API error: ${coingeckoRes.statusText}`);
        }

        const coingeckoData = await coingeckoRes.json();
        console.log('CoinGecko response:', coingeckoData);

        const price = coingeckoData?.market_data?.current_price?.usd || 0;
        const volume = coingeckoData?.market_data?.total_volume?.usd || 0;

        // Ensure stats are set
        const newStats = { price, volume, latestBlock };
        console.log('Setting stats:', newStats);
        setStats(newStats);
        setBlocks(fetchedBlocks);
        setError('');
      } catch (error) {
        console.error('Error in fetchData:', error);
        setError('Failed to fetch data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch latest news articles
  useEffect(() => {
    async function fetchArticles() {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) {
          setError('Failed to fetch articles');
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
        console.error('Error fetching articles:', err);
        setError('Error fetching articles');
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-200">
      {/* Scrolling Token Banner */}
      <motion.div className="relative overflow-hidden">
        <ScrollingTokenBanner />
      </motion.div>

      {/* Header */}
      <Header />

      {/* Hero Section */}
      <motion.section
        className="text-center py-12 sm:py-16 md:py-24 text-gray-200 relative overflow-hidden"
        {...scrollProps}
        style={{
          backgroundImage: 'url(https://i.imgur.com/YVycXUz.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Text and Buttons */}
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold mb-6 leading-tight relative z-10 px-4 text-gray-200">
          Navigate the Trenches with CypherX
        </h1>
        <p className="text-sm sm:text-base md:text-xl mb-8 md:mb-10 max-w-md sm:max-w-lg md:max-w-2xl mx-auto leading-relaxed relative z-10 px-4 text-gray-400">
          The Intelligence Layer for Base Chain - Trading tools, real-time insights, and on-chain analytics—all in one place.
        </p>
        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4 relative z-10 px-4">
          <Link href="/docs">
            <motion.button
              className={`${
                isMobile ? 'px-4 py-2 text-sm max-w-[160px]' : 'px-6 py-3 text-base'
              } border border-blue-500/30 text-blue-400 bg-blue-500/20 font-semibold rounded-xl hover:bg-blue-500/40 transition-all duration-300 w-full sm:w-auto mx-auto sm:mx-0`}
              whileHover={isMobile ? {} : { scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              Read Docs
            </motion.button>
          </Link>
          <Link href="/terminal">
            <motion.button
              className={`${
                isMobile ? 'px-4 py-2 text-sm max-w-[160px]' : 'px-6 py-3 text-base'
              } bg-blue-500/20 text-blue-400 font-semibold rounded-xl hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300 w-full sm:w-auto mx-auto sm:mx-0`}
              whileHover={isMobile ? {} : { scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              Launch Terminal
            </motion.button>
          </Link>
        </div>
      </motion.section>

      {/* Partners Scrolling Logos */}
      <motion.div className="relative overflow-hidden">
        <PartnersScroller />
      </motion.div>

      {/* Base Chain Stats Section */}
      <NetworkInsights stats={stats} />

      {/* Latest Blocks Section */}
      <motion.section
        className="px-4 py-12 md:py-16 flex flex-col items-center bg-gray-950"
        {...scrollProps}
      >
        <div className="w-full max-w-md sm:max-w-5xl">
          <LatestBlocks blocks={blocks} />
        </div>
      </motion.section>

      {/* What is Base? Section */}
      <motion.section
        className="w-full py-12 md:py-16 text-center bg-gray-950 relative"
        {...scrollProps}
        style={{ perspective: '1000px' }}
      >
        <div className="max-w-md sm:max-w-5xl mx-auto px-4 relative z-10">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
            <span className="text-gray-200">What is</span>{' '}
            <span className="text-blue-400">Base</span>?
          </h2>
          <p className="text-gray-400 max-w-md sm:max-w-2xl mx-auto mb-8 md:mb-10 text-base sm:text-lg leading-relaxed">
            Base is an Ethereum Layer 2 solution designed to make transactions faster, cheaper, and more scalable while leveraging Ethereum’s security.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <motion.div
              className="p-4 sm:p-6 bg-gray-950 rounded-xl shadow-lg border border-blue-500/20"
              style={{ transform: 'translateZ(20px)' }}
              whileHover={
                isMobile
                  ? {}
                  : {
                      transform: 'translateZ(40px)',
                      boxShadow: '0 10px 20px rgba(255,255,255,0.1)',
                    }
              }
              whileTap={isMobile ? { scale: 0.95 } : {}}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <LightningIcon />
              <h3 className="text-lg sm:text-xl font-bold text-blue-400 mb-2 sm:mb-3">
                Faster Transactions
              </h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Base reduces Ethereum’s congestion, offering near-instant confirmations and lower fees.
              </p>
            </motion.div>
            <motion.div
              className="p-4 sm:p-6 bg-gray-950 rounded-xl shadow-lg border border-blue-500/20"
              style={{ transform: 'translateZ(20px)' }}
              whileHover={
                isMobile
                  ? {}
                  : {
                      transform: 'translateZ(40px)',
                      boxShadow: '0 10px 20px rgba(255,255,255,0.1)',
                    }
              }
              whileTap={isMobile ? { scale: 0.95 } : {}}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <CodeIcon />
              <h3 className="text-lg sm:text-xl font-bold text-blue-400 mb-2 sm:mb-3">
                EVM-Compatible
              </h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Seamlessly deploy your dApps with full Ethereum compatibility, leveraging Base’s efficiency.
              </p>
            </motion.div>
            <motion.div
              className="p-4 sm:p-6 bg-gray-950 rounded-xl shadow-lg border border-blue-500/20"
              style={{ transform: 'translateZ(20px)' }}
              whileHover={
                isMobile
                  ? {}
                  : {
                      transform: 'translateZ(40px)',
                      boxShadow: '0 10px 20px rgba(255,255,255,0.1)',
                    }
              }
              whileTap={isMobile ? { scale: 0.95 } : {}}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <ShieldIcon />
              <h3 className="text-lg sm:text-xl font-bold text-blue-400 mb-2 sm:mb-3">
                Secure & Scalable
              </h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Inherits Ethereum’s robust security while scaling to handle more transactions.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Base AI Index Section */}
      {isMobile ? (
        <section className="py-8 w-full px-4 bg-gray-950">
          <BaseAiIndex />
        </section>
      ) : (
        <section className="py-12 container mx-auto px-4 bg-gray-950">
          <BaseAiIndex />
        </section>
      )}

      {/* How Homebase Powers Base Section */}
      <motion.section
        className="w-full py-12 md:py-16 text-center bg-gray-950 relative"
        {...scrollProps}
      >
        <div className="max-w-md sm:max-w-5xl mx-auto px-4 relative z-10">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold mb-6 sm:mb-8 leading-tight">
            How <span className="text-blue-400">Cypher</span> Powers{' '}
            <span className="text-blue-400">Base</span>
          </h2>
          <p className="text-gray-400 max-w-md sm:max-w-3xl mx-auto mb-6 sm:mb-8 text-base sm:text-lg leading-relaxed">
            Cypher provides cutting-edge tools to track on-chain data, monitor whale movements, and stay ahead of token launches on Base.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <motion.div
              className="p-4 sm:p-6 bg-gray-950 border border-blue-500/20 rounded-xl shadow-md transition-all duration-300 group flex flex-col items-center"
              whileHover={
                isMobile
                  ? {}
                  : { translateY: -5, boxShadow: '0 10px 20px rgba(255,255,255,0.1)' }
              }
              whileTap={isMobile ? { scale: 0.95 } : {}}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <ChartIcon className="w-10 h-10 mx-auto mb-4 text-gray-200 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-lg sm:text-xl font-bold text-gray-200 mb-2">
                Token Screener
              </h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed mb-4 flex-grow">
                Get real-time coin prices and find the hottest base pairs.
              </p>
              <Link href="/token-scanner">
                <motion.button
                  className="px-6 py-3 bg-blue-500/20 text-blue-400 font-semibold rounded-lg hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300 shadow-md w-full sm:w-auto"
                  whileHover={isMobile ? {} : { scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Screener
                </motion.button>
              </Link>
            </motion.div>
            <motion.div
              className="p-4 sm:p-6 bg-gray-950 border border-blue-500/20 rounded-xl shadow-md transition-all duration-300 group flex flex-col items-center"
              whileHover={
                isMobile
                  ? {}
                  : { translateY: -5, boxShadow: '0 10px 20px rgba(255,255,255,0.1)' }
              }
              whileTap={isMobile ? { scale: 0.95 } : {}}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <InsightIcon className="w-10 h-10 mx-auto mb-4 text-gray-200 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-lg sm:text-xl font-bold text-gray-200 mb-2">
                Whale Watchers
              </h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed mb-4 flex-grow">
                Track large wallet movements and detect potential market shifts.
              </p>
              <Link href="/whale-watcher">
                <motion.button
                  className="px-6 py-3 bg-blue-500/20 text-blue-400 font-semibold rounded-lg hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300 shadow-md w-full sm:w-auto"
                  whileHover={isMobile ? {} : { scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Track Whales
                </motion.button>
              </Link>
            </motion.div>
            <motion.div
              className="p-4 sm:p-6 bg-gray-950 border border-blue-500/20 rounded-xl shadow-md transition-all duration-300 group flex flex-col items-center"
              whileHover={
                isMobile
                  ? {}
                  : { translateY: -5, boxShadow: '0 10px 20px rgba(255,255,255,0.1)' }
              }
              whileTap={isMobile ? { scale: 0.95 } : {}}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <ToolIcon className="w-10 h-10 mx-auto mb-4 text-gray-200 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-lg sm:text-xl font-bold text-gray-200 mb-2">
                Token Launch Calendar
              </h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed mb-4 flex-grow">
                Stay ahead with upcoming token launches and market trends.
              </p>
              <Link href="/launch-calendar">
                <motion.button
                  className="px-6 py-3 bg-blue-500/20 text-blue-400 font-semibold rounded-lg hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300 shadow-md w-full sm:w-auto"
                  whileHover={isMobile ? {} : { scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  View Calendar
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Latest News Section */}
      {loading ? (
        <motion.section
          className="py-8 sm:py-12 container mx-auto px-4 bg-gray-950"
          {...scrollProps}
        >
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold mb-6 text-center text-gray-200">
            Latest News
          </h2>
          <p className="text-center text-gray-400">Loading latest news...</p>
        </motion.section>
      ) : error ? (
        <motion.section
          className="py-8 sm:py-12 container mx-auto px-4 bg-gray-950"
          {...scrollProps}
        >
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold mb-6 text-center text-gray-200">
            Latest News
          </h2>
          <p className="text-center text-red-400">{error}</p>
        </motion.section>
      ) : (
        <motion.section
          className="py-8 sm:py-12 container mx-auto px-4 bg-gray-950"
          {...scrollProps}
        >
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold mb-6 text-center text-gray-200">
            Latest News
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {latestArticles.map((article) => (
              <motion.div
                key={article.slug}
                className="p-4 shadow-md border border-blue-500/20 rounded-xl bg-gray-950"
                whileHover={
                  isMobile
                    ? {}
                    : {
                        boxShadow: '0 8px 16px rgba(255,255,255,0.1)',
                        translateY: -2,
                      }
                }
                whileTap={isMobile ? { scale: 0.95 } : {}}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <h3 className="text-lg sm:text-xl font-bold text-blue-400">{article.title}</h3>
                <p className="text-sm sm:text-base mt-2 text-gray-400">
                  {article.content.slice(0, 100)}...
                </p>
                <Link
                  href={`/base-chain-news/${article.slug}`}
                  className="text-blue-400 mt-3 sm:mt-4 inline-block text-sm sm:text-base font-semibold hover:text-blue-300"
                >
                  Read more
                </Link>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-6 sm:mt-8">
            <Link
              href="/base-chain-news"
              className="text-blue-400 font-semibold text-sm sm:text-base px-4 py-2 rounded-full hover:bg-blue-500/20 transition-all"
            >
              View All News →
            </Link>
          </div>
        </motion.section>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}

// Export Page component
export default function Page() {
  return <HomePage />;
}