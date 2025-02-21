'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';

// Ensure these 'id' fields match how CoinGecko identifies each token.
const BASE_TOKENS = [
  { id: 'brett', name: 'BRETT' },
  { id: 'toshi', name: 'TOSHI' },
  { id: 'aixbt', name: 'AIXBT' },
  { id: 'ski-mask-dog', name: 'SKI' },
  { id: 'virtual-protocol', name: 'VIRTUAL' },
  { id: 'aerodrome-finance', name: 'AERO' },
  { id: 'freysa-ai', name: 'FAI' },
];

export default function ScrollingTokenBanner() {
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // For simplicity, we’ll assume you’re using the public CoinGecko endpoint.
        // If you have a custom one, set NEXT_PUBLIC_COINGECKO_API_URL in .env.local.
        const coingeckoUrl =
          process.env.NEXT_PUBLIC_COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';

        // Build a comma-separated list of token IDs to fetch in one request
        const tokenIds = BASE_TOKENS.map((t) => t.id).join(',');

        // Example: /simple/price?ids=brett,toshi,aixbt&vs_currencies=usd&include_24hr_change=true
        const url = `${coingeckoUrl}/simple/price?ids=${tokenIds}&vs_currencies=usd&include_24hr_change=true`;

        const res = await fetch(url);
        const data = await res.json();

        // data will look like:
        // {
        //   brett: { usd: 0.00042, usd_24h_change: 2.3 },
        //   toshi: { usd: 0.00057, usd_24h_change: -0.9 },
        //   ...
        // }
        setPrices(data);
      } catch (error) {
        console.error('❌ Error fetching prices from CoinGecko:', error);
      }
    };

    fetchPrices();
    // Poll every 60 seconds to reduce load; adjust as needed
    const interval = setInterval(fetchPrices, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="overflow-hidden bg-primaryBlue text-white py-2">
      <motion.div
        className="flex space-x-10 whitespace-nowrap w-max"
        initial={{ x: 0 }}
        animate={{ x: '-100%' }}
        transition={{ repeat: Infinity, duration: 50, ease: 'linear' }}
      >
        {/* Duplicate the array so it scrolls continuously */}
        {[...BASE_TOKENS, ...BASE_TOKENS].map((token, index) => {
          // We expect a token object from the API like: { usd: number, usd_24h_change: number }
          const tokenData = prices[token.id] || {};
          const price = tokenData.usd || 0;
          const change = tokenData.usd_24h_change || 0;
          const isPositive = change >= 0;

          return (
            <div key={index} className="flex items-center space-x-3 px-4">
              {/* Token Name */}
              <span className="font-bold uppercase">{token.name}</span>

              {/* Price */}
              <span className="text-gray-300">
                {price ? `$${price.toFixed(4)}` : '$0.0000'}
              </span>

              {/* 24h Change with Arrow */}
              <span
                className={`flex items-center text-sm font-semibold ${
                  isPositive ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {isPositive ? <FiArrowUp className="mr-1" /> : <FiArrowDown className="mr-1" />}
                {change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}


