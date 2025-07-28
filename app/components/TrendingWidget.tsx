"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";

// Define the type for the token data returned by the API
type TrendingToken = {
  symbol: string;
  name: string;
  priceUsd: string;
  priceChange24h: number;
  imageUrl: string;
  trendingScore: number;
  pairAddress: string;
  baseToken?: { address: string };
};

export default function TrendingWidget() {
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingTokens = async () => {
      try {
        setTrendingLoading(true);
        const res = await fetch("/api/trending-widget", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch trending tokens");
        const data = await res.json();
        setTrendingTokens(data.slice(0, 10));
        setTrendingError(null);
      } catch (err) {
        console.error("Error fetching trending tokens:", err);
        const errMsg = "Failed to load trending tokens";
        setTrendingError(errMsg);
        toast.error(errMsg);
      } finally {
        setTrendingLoading(false);
      }
    };
    fetchTrendingTokens();
    const interval = setInterval(fetchTrendingTokens, 300_000);
    return () => clearInterval(interval);
  }, []);

  // Function to fetch the pool address from Firebase
  const getPoolAddress = async (tokenAddress: string): Promise<string> => {
    try {
      const q = query(
        collection(db, "tokens"),
        where("address", "==", tokenAddress.toLowerCase())
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const tokenDoc = querySnapshot.docs[0];
        const poolAddress = tokenDoc.data().pool;
        if (poolAddress) return poolAddress;
      }
      throw new Error("Pool address not found");
    } catch (err) {
      console.error("Error fetching pool address from Firebase:", err);
      return tokenAddress; // Fallback to pairAddress if Firebase query fails
    }
  };

  if (trendingLoading) {
    return (
      <div className="bg-gray-950 py-4 text-center text-center h-16 flex items-center justify-center">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-200 animate-pulse text-sm sm:text-base">Loading Trending Tokens...</span>
        </div>
      </div>
    );
  }

  if (trendingError || trendingTokens.length === 0) {
    return (
      <div className="bg-gray-950 py-4 text-center text-red-400 h-16 flex items-center justify-center">
        <span className="text-sm sm:text-base">{trendingError || "No trending tokens available"}</span>
      </div>
    );
  }

  // Duplicate tokens for seamless infinite scrolling
  const duplicatedTokens = [...trendingTokens, ...trendingTokens];

  return (
    <div className="bg-gradient-to-br from-gray-950 to-gray-900 border-b border-blue-500/20 overflow-hidden h-16">
      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .scroll-container {
          display: flex;
          animation: scroll 30s linear infinite;
          width: fit-content;
          height: 100%;
        }
        .scroll-container:hover {
          animation-play-state: paused;
        }
        .card:not(:last-child) {
          border-right: 1px solid rgba(59, 130, 246, 0.3);
        }
      `}</style>
      <div className="w-full h-full">
        <div className="scroll-container">
          {duplicatedTokens.map((token, index) => {
            // Compute the rank (1-10) based on the original list index
            const rank = (index % trendingTokens.length) + 1;

            return (
              <Link
                key={`${token.pairAddress}-${index}`}
                href={`/token-scanner/${token.pairAddress}/chart`}
                onClick={async (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
                  e.preventDefault();
                  const tokenAddress = token.baseToken?.address || token.pairAddress;
                  const poolAddress = await getPoolAddress(tokenAddress);
                  window.location.href = `/token-scanner/${poolAddress}/chart`;
                }}
                className="flex-shrink-0 card h-full"
                aria-label={`View ${token.symbol} chart`} // Added ARIA
              >
                <motion.div
                  className="bg-gradient-to-br from-[#2A3555] to-[#1F2937] p-2 w-40 border border-blue-500/30 hover:bg-[#2A3555]/80 transition-all duration-300 flex items-center space-x-2 h-full shadow-md hover:shadow-xl"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: (index % trendingTokens.length) * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                >
                  {/* Ranking Spot */}
                  <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-500/20 rounded-full text-blue-400 font-semibold text-xs">
                    #{rank}
                  </div>
                  {/* Token Image */}
                  <Image
                    src={token.imageUrl}
                    alt={`${token.symbol} logo`}
                    width={20}
                    height={20}
                    className="rounded-full border border-blue-500/30"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      e.currentTarget.src = "/fallback.png";
                    }}
                    placeholder="blur"
                    blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" // Base64 placeholder
                  />
                  {/* Token Details */}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white">{token.symbol}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-200">
                        ${parseFloat(token.priceUsd).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          token.priceChange24h >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {token.priceChange24h >= 0 ? "+" : ""}
                        {token.priceChange24h.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}