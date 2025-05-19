'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import domToImage from 'dom-to-image';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ====== TYPES ======
export type TokenData = {
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceChange?: {
    h24?: number;
  };
  volume?: {
    h24: number;
  };
  marketCap?: number;
  info?: {
    imageUrl?: string;
  };
};

export type BaseAiToken = {
  symbol: string;
  address: string;
  weight: string;
};

// ====== STATIC LIST ======
const baseAiTokens: BaseAiToken[] = [
  { symbol: 'GAME', address: '0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3', weight: '4.86%' },
  { symbol: 'BANKR', address: '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b', weight: '5.24%' },
  { symbol: 'FAI', address: '0xb33Ff54b9F7242EF1593d2C9Bcd8f9df46c77935', weight: '12.57%' },
  { symbol: 'VIRTUAL', address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', weight: '26.8%' },
  { symbol: 'CLANKER', address: '0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb', weight: '15.89%' },
  { symbol: 'KAITO', address: '0x98d0baa52b2D063E780DE12F615f963Fe8537553', weight: '16.22%' },
  { symbol: 'COOKIE', address: '0xC0041EF357B183448B235a8Ea73Ce4E4eC8c265F', weight: '5.12%' },
  { symbol: 'VVV', address: '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf', weight: '5.08%' },
  { symbol: 'DRB', address: '0x3ec2156D4c0A9CBdAB4a016633b7BcF6a8d68Ea2', weight: '3.8%' },
  { symbol: 'AIXBT', address: '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825', weight: '10.5%' },
];

// ====== ANIMATION VARIANTS ======
const containerVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' },
  },
};

const imageVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
};

// ====== DOWNLOAD ICON (Heroicons Style) ======
function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-blue-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

// ====== CUSTOM HOOK FOR MOBILE VIEW ======
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const checkMobile = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsMobile(window.innerWidth < 768), 100);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// ====== SKELETON ROW FOR LOADING STATE ======
const SkeletonRow = () => (
  <tr className="border-t border-blue-500/20">
    <td className="p-2 md:p-4 flex items-center space-x-2">
      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gray-900 animate-pulse" />
      <div className="w-16 h-4 bg-gray-900 rounded animate-pulse" />
    </td>
    <td className="p-2 md:p-4">
      <div className="w-12 h-4 bg-gray-900 rounded animate-pulse" />
    </td>
    <td className="p-2 md:p-4">
      <div className="w-16 h-4 bg-gray-900 rounded animate-pulse" />
    </td>
    <td className="p-2 md:p-4">
      <div className="w-16 h-4 bg-gray-900 rounded animate-pulse" />
    </td>
    <td className="p-2 md:p-4">
      <div className="w-16 h-4 bg-gray-900 rounded animate-pulse" />
    </td>
    <td className="p-2 md:p-4">
      <div className="w-16 h-4 bg-gray-900 rounded animate-pulse" />
    </td>
  </tr>
);

export default function BaseAiIndex() {
  const isMobile = useIsMobile();

  // Merge static list with fetched token data
  const [tokensData, setTokensData] = useState<
    { symbol: string; weight: string; address: string; data?: TokenData }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Control truncation during screenshot
  const [disableTruncation, setDisableTruncation] = useState(false);

  // Ref for unified container (blue banner + table)
  const indexRef = useRef<HTMLDivElement>(null);

  // ====== FETCH TOKEN DATA FUNCTION ======
  const fetchTokenData = async () => {
    try {
      setLoading(true);
      setError(null);

      const addresses = baseAiTokens.map((t) => t.address).join(',');
      const res = await fetch(`/api/indexes?chainId=base&tokenAddresses=${addresses}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`API request failed with status ${res.status}: ${res.statusText}`);
      }

      const data: TokenData[] = await res.json();
      console.log('API Response from /api/indexes:', data); // Log for debugging

      if (!Array.isArray(data)) {
        throw new Error('API response is not an array');
      }

      // Merge fetched data with baseAiTokens
      const mergedData = baseAiTokens.map((token) => {
        const fetched = data.find(
          (d) =>
            d.baseToken?.address?.toLowerCase() === token.address.toLowerCase()
        );
        if (!fetched) {
          console.warn(`No data found for token: ${token.symbol} (${token.address})`);
        }
        return { ...token, data: fetched };
      });

      setTokensData(mergedData);
    } catch (error) {
      console.error('Error fetching token data:', error);
      setError('Failed to load token data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // ====== FETCH TOKEN DATA ON MOUNT AND PERIODICALLY ======
  useEffect(() => {
    fetchTokenData();
    const interval = setInterval(fetchTokenData, 30_000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // ====== CALCULATE AGGREGATED STATS ======
  const aggStats = useMemo(() => {
    let weightedPriceChangeSum = 0;
    let totalWeight = 0;
    let totalVolume = 0;
    let totalMarketCap = 0;

    tokensData.forEach((token) => {
      const weightNum = parseFloat(token.weight.replace('%', ''));
      if (token.data) {
        if (token.data.priceChange?.h24 !== undefined) {
          weightedPriceChangeSum += weightNum * token.data.priceChange.h24;
          totalWeight += weightNum;
        }
        if (token.data.volume?.h24) {
          totalVolume += token.data.volume.h24;
        }
        if (token.data.marketCap) {
          totalMarketCap += token.data.marketCap;
        }
      }
    });

    const overallPriceChange =
      totalWeight > 0 ? weightedPriceChangeSum / totalWeight : undefined;
    return {
      overallPriceChange,
      totalVolume,
      totalMarketCap,
    };
  }, [tokensData]);

  // ====== FUNCTION TO FETCH POOL ADDRESS FROM FIREBASE ======
  const getPoolAddress = async (tokenAddress: string): Promise<string> => {
    try {
      const q = query(
        collection(db, 'tokens'),
        where('address', '==', tokenAddress.toLowerCase())
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const tokenDoc = querySnapshot.docs[0];
        const poolAddress = tokenDoc.data().pool;
        if (poolAddress) return poolAddress;
      }
      throw new Error('Pool address not found');
    } catch (err) {
      console.error('Error fetching pool address from Firebase:', err);
      return tokenAddress; // Fallback to tokenAddress if Firebase query fails
    }
  };

  // ====== DOWNLOAD IMAGE FUNCTION ======
  async function handleDownloadImage() {
    try {
      setDisableTruncation(true);
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (!indexRef.current) return;
      const dataUrl = await domToImage.toPng(indexRef.current, {
        quality: 1,
        style: { backgroundColor: '#1F2937' }, // Use gray-950 for screenshot
      });
      const link = document.createElement('a');
      link.download = 'base-ai-index.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Screenshot failed:', err);
    } finally {
      setDisableTruncation(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 bg-gray-950">
        <div className="relative bg-gray-950 rounded-xl shadow-lg overflow-hidden w-full max-w-md md:max-w-5xl mx-auto border border-blue-500/20">
          <div className="bg-blue-500/20 text-gray-200 p-4 md:p-6 w-full">
            <h2 className="text-2xl md:text-3xl font-extrabold mb-3 md:mb-4 text-center">
              Base AI Index
            </h2>
            <div className="flex flex-col md:flex-row justify-around text-sm md:text-base space-y-2 md:space-y-0 md:space-x-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-24 h-4 bg-gray-900 rounded animate-pulse" />
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-24 h-4 bg-gray-900 rounded animate-pulse" />
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-24 h-4 bg-gray-900 rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="bg-gray-950 p-4 md:p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-gray-950 border-b border-blue-500/20">
                  <tr>
                    <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                      Token
                    </th>
                    <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                      Weight
                    </th>
                    <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                      Price (USD)
                    </th>
                    <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                      24h Change
                    </th>
                    <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                      Volume (24h)
                    </th>
                    <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                      Market Cap
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array(5).fill(null).map((_, idx) => (
                    <SkeletonRow key={idx} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-400">
        {error}
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchTokenData();
          }}
          className="ml-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-md hover:bg-blue-500/40 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className={`p-4 ${isMobile ? 'p-2' : 'md:p-6'} bg-gray-950`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
      variants={containerVariants}
    >
      {/* Unified container (banner + table) */}
      <motion.div
        ref={indexRef}
        className="relative bg-gray-950 rounded-xl shadow-lg overflow-hidden w-full max-w-md md:max-w-5xl mx-auto border border-blue-500/20"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, amount: 0.5 }}
        style={{ perspective: '1000px' }}
      >
        {/* Download Button */}
        <motion.button
          onClick={handleDownloadImage}
          className={
            'absolute top-3 right-3 p-2 rounded-full bg-gray-900 border border-blue-500/20 shadow-md hover:bg-blue-500/40 hover:border-blue-500/30 transition-all'
          }
          title="Download Image"
          aria-label="Download Base AI Index as image"
          whileHover={{ scale: 1.1, boxShadow: '0 8px 16px rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <DownloadIcon />
        </motion.button>

        {/* Blue Stats Banner */}
        <div className="bg-blue-500/20 text-gray-200 p-4 md:p-6 w-full">
          <h2 className={`font-extrabold mb-3 md:mb-4 text-center ${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
            Base AI Index
          </h2>
          <div className={`flex ${isMobile ? 'flex-col text-xs space-y-2' : 'md:flex-row justify-around text-sm md:text-base space-y-0 md:space-x-4'}`}>
            <div
              className="flex items-center justify-center space-x-2"
              title="Weighted Average 24h Price Change"
            >
              <span className="font-semibold">24h Change:</span>
              <span
                className={
                  aggStats.overallPriceChange !== undefined
                    ? aggStats.overallPriceChange >= 0
                      ? 'text-green-400'
                      : 'text-red-400'
                    : ''
                }
              >
                {aggStats.overallPriceChange !== undefined
                  ? `${aggStats.overallPriceChange.toFixed(2)}%`
                  : 'N/A'}
              </span>
            </div>
            <div
              className="flex items-center justify-center space-x-2"
              title="Total 24h Trading Volume"
            >
              <span className="font-semibold">24h Volume:</span>
              <span>
                {aggStats.totalVolume
                  ? `$${Math.round(aggStats.totalVolume).toLocaleString()}`
                  : 'N/A'}
              </span>
            </div>
            <div
              className="flex items-center justify-center space-x-2"
              title="Total Market Capitalization"
            >
              <span className="font-semibold">Market Cap:</span>
              <span>
                {aggStats.totalMarketCap
                  ? `$${Math.round(aggStats.totalMarketCap).toLocaleString()}`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-gray-950 p-4 md:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-gray-950 border-b border-blue-500/20">
                <tr>
                  <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                    Token
                  </th>
                  <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                    Weight
                  </th>
                  <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                    Price (USD)
                  </th>
                  <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                    24h Change
                  </th>
                  <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                    Volume (24h)
                  </th>
                  <th scope="col" className="p-2 md:p-4 text-blue-400 font-semibold uppercase tracking-wide">
                    Market Cap
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokensData.map((token, idx) => {
                  const d = token.data;
                  return (
                    <motion.tr
                      key={token.address}
                      className="border-t border-blue-500/20 hover:bg-blue-500/20 transition-all duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.1 }}
                      viewport={{ once: false, amount: 0.1 }}
                    >
                      <td className="p-2 md:p-4 flex items-center space-x-2">
                        {d?.info?.imageUrl ? (
                          <motion.div
                            variants={imageVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                          >
                            <Image
                              src={d.info.imageUrl}
                              alt={token.symbol}
                              width={isMobile ? 24 : 32}
                              height={isMobile ? 24 : 32}
                              className="rounded-full border border-blue-500/20 shadow-sm"
                              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                console.warn(`Failed to load image for ${token.symbol}: ${d.info?.imageUrl ?? 'undefined'}`);
                                e.currentTarget.src = '/fallback.png';
                              }}
                            />
                          </motion.div>
                        ) : (
                          <div className={`rounded-full bg-gray-900 shadow-sm ${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
                        )}
                        <Link
                          href={`/token-scanner/${token.address}/chart`}
                          onClick={async (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
                            e.preventDefault();
                            const poolAddress = await getPoolAddress(token.address);
                            window.location.href = `/token-scanner/${poolAddress}/chart`;
                          }}
                          className={
                            disableTruncation
                              ? 'text-gray-200 font-medium hover:text-blue-400'
                              : 'text-gray-200 font-medium truncate max-w-[60px] md:max-w-[100px] hover:text-blue-400'
                          }
                          title={token.symbol}
                        >
                          {token.symbol}
                        </Link>
                      </td>
                      <td className="p-2 md:p-4 text-gray-400 font-medium" title="Pre-defined weight">
                        {token.weight}
                      </td>
                      <td className="p-2 md:p-4 text-gray-400 font-medium">
                        {d?.priceUsd ? `$${Number(d.priceUsd).toFixed(4)}` : 'N/A'}
                      </td>
                      <td className="p-2 md:p-4 font-medium">
                        {d?.priceChange?.h24 !== undefined ? (
                          <span
                            className={
                              d.priceChange.h24 >= 0 ? 'text-green-400' : 'text-red-400'
                            }
                          >
                            {`${d.priceChange.h24.toFixed(2)}%`}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="p-2 md:p-4 text-gray-400 font-medium">
                        {d?.volume?.h24 ? `$${Math.round(d.volume.h24).toLocaleString()}` : 'N/A'}
                      </td>
                      <td className="p-2 md:p-4 text-gray-400 font-medium">
                        {d?.marketCap ? `$${Math.round(d.marketCap).toLocaleString()}` : 'N/A'}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}




