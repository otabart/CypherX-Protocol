'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';

// Define token interface
interface Token {
  id: string;
  name: string;
}

// Define price data interface from CoinGecko
interface PriceData {
  usd: number;
  usd_24h_change: number;
}

interface Prices {
  [key: string]: PriceData;
}

// Default token list
const BASE_TOKENS: Token[] = [
  { id: 'brett', name: 'BRETT' }, // Based Brett on Base chain
  { id: 'toshi', name: 'TOSHI' },
  { id: 'aixbt', name: 'AIXBT' },
  { id: 'ski-mask-dog', name: 'SKI' },
  { id: 'virtual-protocol', name: 'VIRTUAL' },
  { id: 'aerodrome-finance', name: 'AERO' },
  { id: 'freysa-ai', name: 'FAI' },
];

// Memoized Token Item
const TokenItem = React.memo(
  ({ token, price, change }: { token: Token; price: number; change: number }) => {
    const isPositive = change >= 0;
    return (
      <div className="flex items-center space-x-3 px-4 group relative">
        <span className="font-bold uppercase">{token.name}</span>
        <span className="text-gray-300 transition-all duration-300 ease-in-out">
          {price ? `$${price.toFixed(4)}` : '$0.0000'}
        </span>
        <span
          className={`flex items-center text-sm font-semibold transition-all duration-300 ease-in-out ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {isPositive ? <FiArrowUp className="mr-1" /> : <FiArrowDown className="mr-1" />}
          {change.toFixed(2)}%
        </span>
        <div className="absolute hidden group-hover:block bg-gray-800 text-white text-xs p-2 rounded -top-10 left-1/2 transform -translate-x-1/2 z-10">
          {token.name} - ${price.toFixed(4)}
        </div>
      </div>
    );
  }
);

interface ScrollingTokenBannerProps {
  tokens?: Token[];
}

export default function ScrollingTokenBanner({ tokens = BASE_TOKENS }: ScrollingTokenBannerProps) {
  const [displayPrices, setDisplayPrices] = useState<Prices>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const fetchPrices = async () => {
    setIsLoading(true);
    try {
      const coingeckoUrl = process.env.NEXT_PUBLIC_COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
      const tokenIds = tokens.map((t) => t.id).join(',');
      const url = `${coingeckoUrl}/simple/price?ids=${tokenIds}&vs_currencies=usd&include_24hr_change=true`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`API request failed with status: ${res.status} - ${res.statusText}`);
      }
      const data: Prices = await res.json();

      console.log('CoinGecko Response:', data);

      // Check for missing or invalid tokens
      const missingTokens = tokens.filter((token) => !data[token.id]);
      if (missingTokens.length > 0) {
        console.warn('Missing token data for:', missingTokens.map((t) => t.id));
        setError(`Some tokens failed to load: ${missingTokens.map((t) => t.name).join(', ')}`);
        setDisplayPrices((prev) => ({ ...prev, ...data })); // Use partial data
      } else {
        setDisplayPrices(data);
        setError(null); // Clear error if fully successful
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('lastPrices', JSON.stringify(data));
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Error fetching prices from CoinGecko:', errorMessage);
      setError(`Failed to load token prices: ${errorMessage}. Using cached data if available.`);

      const cachedPrices: Prices =
        typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('lastPrices') || '{}') : {};
      if (Object.keys(cachedPrices).length > 0) {
        setDisplayPrices((prev) => ({ ...prev, ...cachedPrices }));
      } else {
        setDisplayPrices({});
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 60_000);
    return () => clearInterval(interval);
  }, [tokens]);

  const animationDuration = useMemo(() => {
    const totalTokens = tokens.length * 2;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const speedFactor = isMobile ? 5 : 3; // Slower on mobile, faster on desktop
    return Math.max(isMobile ? 20 : 15, totalTokens * speedFactor);
  }, [tokens]);

  return (
    <div
      className="overflow-hidden bg-primaryBlue text-white py-2 relative"
      role="marquee"
      aria-label="Scrolling token price banner"
    >
      <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-primaryBlue to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-primaryBlue to-transparent z-10 pointer-events-none" />

      {error && !isLoading && Object.keys(displayPrices).length === 0 && (
        <div className="text-center text-red-300 py-1">
          {error}
          <button
            className="ml-2 text-blue-300 underline"
            onClick={fetchPrices}
          >
            Retry
          </button>
        </div>
      )}
      {isLoading ? (
        <div className="flex space-x-10 animate-pulse">
          {tokens.map((_, index) => (
            <div key={index} className="flex items-center space-x-3 px-4">
              <div className="h-4 w-12 bg-gray-600 rounded" />
              <div className="h-4 w-16 bg-gray-600 rounded" />
              <div className="h-4 w-10 bg-gray-600 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          className="flex space-x-10 whitespace-nowrap w-max"
          initial={{ x: 0 }}
          animate={isPaused ? { x: 0 } : { x: '-100%' }}
          transition={{
            repeat: Infinity,
            duration: animationDuration,
            ease: 'linear',
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          tabIndex={0}
        >
          {[...tokens, ...tokens].map((token, index) => {
            const tokenData = displayPrices[token.id] || {};
            const price = tokenData.usd || 0;
            const change = tokenData.usd_24h_change || 0;

            return (
              <TokenItem
                key={index}
                token={token}
                price={price}
                change={change}
              />
            );
          })}
        </motion.div>
      )}
    </div>
  );
}


