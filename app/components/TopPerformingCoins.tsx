"use client";

// Ensure framer-motion is installed and imported correctly
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image"; // Added import for next/image
import { useState, useEffect } from "react";
import { fetchAllTokenData, getTopPerformingCoins, type TokenData } from "@/lib/fetchTokenData";
import toast from "react-hot-toast"; // Added for error toasts
import { Tooltip } from "react-tooltip"; // Added for tooltips if needed

// ====== HELPER FUNCTION ======
const abbreviateNumber = (number: number | undefined) => {
  if (number === undefined || isNaN(number) || number === 0) return "$0";
  const absNumber = Math.abs(number);
  if (absNumber >= 1e12) return `${(absNumber / 1e12).toFixed(2)}T`;
  if (absNumber >= 1e9) return `${(absNumber / 1e9).toFixed(2)}B`;
  if (absNumber >= 1e6) return `${(absNumber / 1e6).toFixed(2)}M`;
  if (absNumber >= 1e3) return `${(absNumber / 1e3).toFixed(2)}K`;
  return `${number.toFixed(2)}`; // No extra $ here, added in JSX
};

const TopPerformingCoins = () => {
  const [topCoins, setTopCoins] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTokens = async () => {
      try {
        const tokens = await fetchAllTokenData();
        const logDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
        console.log(`[${logDate}] Fetched tokens:`, tokens);
        if (tokens.length === 0) {
          throw new Error("No tokens found or data incomplete.");
        }
        const top = getTopPerformingCoins(tokens);
        console.log(`[${logDate}] Top performing coins:`, top);
        setTopCoins(top);
        setError(null);
      } catch (err) {
        const logDate = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
        console.error(`[${logDate}] Error loading tokens:`, err);
        const errMsg = "Failed to load top coins.";
        setError(errMsg);
        toast.error(errMsg);
      } finally {
        setLoading(false);
      }
    };
    loadTokens();
  }, []);

  if (loading) {
    return (
      <div className="w-full bg-gray-900 rounded-xl shadow-lg p-3 sm:p-5 border border-blue-500/20 min-h-[400px] flex flex-col">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-200 mb-3 sm:mb-5 flex items-center">
          [ TOP MOVERS ]
          <span className="ml-2 text-green-500 text-sm bg-green-500/20 px-2 py-1 rounded-full animate-pulse-live">
            Live
          </span>
        </h2>
        <div className="space-y-3 sm:space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 sm:h-20 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || topCoins.length === 0) {
    return (
      <div className="w-full bg-gray-900 rounded-xl shadow-lg p-3 sm:p-5 border border-blue-500/20 min-h-[400px] flex flex-col">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-200 mb-3 sm:mb-5 flex items-center">
          [ TOP MOVERS ]
          <span className="ml-2 text-green-500 text-sm bg-green-500/20 px-2 py-1 rounded-full animate-pulse-live">
            Live
          </span>
        </h2>
        <p className="text-center text-red-400 text-sm sm:text-base flex-grow flex items-center justify-center">{error || "No top movers available."}</p>
      </div>
    );
  }

  return (
    <motion.div
      className="w-full bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-lg p-3 sm:p-5 border border-blue-500/30 flex flex-col min-h-[400px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <h2 className="text-xl sm:text-2xl font-bold text-gray-200 mb-3 sm:mb-5 flex items-center">
        [ TOP MOVERS ]
        <span className="ml-2 text-green-500 text-sm bg-green-500/20 px-2 py-1 rounded-full animate-pulse-live">
          Live
        </span>
      </h2>
      <div className="space-y-3 sm:space-y-4">
        <div className="bg-gray-800 p-2 rounded-t-lg mb-2 hidden sm:grid grid-cols-[3rem_1fr_8rem_6rem_6rem_4rem] items-center text-sm font-medium text-gray-400">
          <span className="text-center">#</span>
          <span className="text-center">Token</span>
          <span className="text-center">Market Cap</span>
          <span className="text-center">Price</span>
          <span className="text-center">Change (24h)</span>
          <span className="text-center">Action</span>
        </div>
        {topCoins.slice(0, 5).map((coin, index) => (
          <motion.div
            key={coin.poolAddress}
            className="grid grid-cols-[3rem_1fr_8rem_6rem_6rem_4rem] sm:grid items-center justify-between bg-gradient-to-br from-gray-800 to-gray-700 p-2 rounded-lg border-l-4 border-blue-400 transition-all duration-300 hover:bg-gray-700 hover:border-blue-300 hover:shadow-xl"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            role="row" // Added ARIA
          >
            {/* Ranking */}
            <span className="text-sm sm:text-base font-bold text-gray-200 text-center mr-2 sm:mr-3">
              {index + 1}
            </span>
            {/* Token Info */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {coin.info?.imageUrl && (
                <Image
                  src={coin.info.imageUrl}
                  alt={`${coin.symbol} logo`} // Improved alt text
                  width={24}
                  height={24}
                  className="w-5 sm:w-7 h-5 sm:h-7 rounded-full border border-blue-500/30"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => (e.currentTarget.src = "/fallback-token-icon.png")}
                  placeholder="blur"
                  blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" // Base64 placeholder
                />
              )}
              <span className="text-sm sm:text-base font-semibold text-gray-200">{coin.symbol}</span>
              <span className="hidden sm:inline text-sm text-gray-400">({coin.name})</span> {/* Show name on desktop */}
            </div>
            {/* Market Cap */}
            <span className="text-sm text-gray-200 text-center">
              ${abbreviateNumber(coin.marketCap) ?? "N/A"} {/* Null check */}
            </span>
            {/* Price */}
            <span className="text-sm text-gray-200 text-center">
              ${parseFloat(coin.priceUsd ?? "0").toFixed(2)} {/* Null check */}
            </span>
            {/* Change */}
            <span
              className={`text-sm ${
                (coin.priceChange?.h24 ?? 0) >= 0 ? "text-green-500" : "text-red-500"
              } font-medium text-center`}
            >
              {(coin.priceChange?.h24 ?? 0).toFixed(2)}% {/* Null check */}
            </span>
            {/* Action */}
            <Link
              href={`/token-scanner/${coin.poolAddress}/chart`}
              className="text-sm text-blue-400 hover:text-blue-300 underline text-center"
              aria-label={`Trade ${coin.symbol}`}
            >
              Trade
            </Link>
          </motion.div>
        ))}
      </div>
      {topCoins.length > 0 && (
        <div className="text-center mt-3 sm:mt-5">
          <Link href="/token-scanner" className="text-blue-400 font-semibold text-sm px-3 py-1 rounded-full hover:bg-blue-500/20">
            Explore All Tokens →
          </Link>
        </div>
      )}
    </motion.div>
  );
};

export default TopPerformingCoins;

// Add CSS for pulsing animation
const styles = `
  @keyframes pulse-live {
    0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
    100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  }
  .animate-pulse-live {
    animation: pulse-live 1.5s infinite;
  }
`;

// Inject the styles into the document
if (typeof window !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}