'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

// Define partner interface
interface Partner {
  src: string;
  alt: string;
  link: string;
}

// Partner data
const partners: Partner[] = [
  {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Uniswap_Logo_and_Wordmark.svg/2560px-Uniswap_Logo_and_Wordmark.svg.png',
    alt: 'Uniswap',
    link: 'https://uniswap.org/',
  },
  {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Coinbase.svg/2560px-Coinbase.svg.png',
    alt: 'Coinbase',
    link: 'https://www.coinbase.com/',
  },
  {
    src: 'https://www.datocms-assets.com/105223/1701819587-logo.svg',
    alt: 'Alchemy',
    link: 'https://www.alchemy.com/',
  },
  {
    src: 'https://landing.coingecko.com/wp-content/uploads/2020/03/CoinGecko.png',
    alt: 'CoinGecko',
    link: 'https://www.coingecko.com/',
  },
];

// Memoized Partner Item
const PartnerItem = React.memo(({ partner }: { partner: Partner }) => (
  <div className="flex-shrink-0">
    <a href={partner.link} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${partner.alt}`}>
      <Image
        src={partner.src}
        alt={partner.alt}
        className="h-8 w-14 sm:h-10 sm:w-18 md:h-12 md:w-20 lg:h-14 lg:w-24 object-contain shadow-md hover:shadow-[0_0_8px_rgba(37,99,235,0.2)] transition-shadow duration-300"
        width={80} // Reduced for mobile performance
        height={48} // Reduced for mobile performance
        loading="lazy"
        priority={false} // Avoid high-priority loading to reduce initial load
      />
    </a>
  </div>
));

// Ensure displayName for better debugging
PartnerItem.displayName = 'PartnerItem';

export default function PartnersScroller() {
  // Responsive animation duration
  const animationDuration = useMemo(() => {
    const totalPartners = partners.length * 2; // Duplicated for seamless scroll
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const baseDurationPerPartner = isMobile ? 0.6 : 1; // 0.6s per partner on mobile, 1s on desktop
    const minDuration = isMobile ? 3 : 4; // 3s minimum on mobile, 4s on desktop
    return Math.max(minDuration, totalPartners * baseDurationPerPartner);
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden bg-gray-950 py-4"
      role="marquee"
      aria-label="Scrolling partners banner"
    >
      {/* Gradient fade edges */}
      <div className="absolute inset-y-0 left-0 w-6 sm:w-10 bg-gradient-to-r from-gray-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-6 sm:w-10 bg-gradient-to-l from-gray-950 to-transparent z-10 pointer-events-none" />

      <motion.div
        className="flex space-x-3 sm:space-x-6 md:space-x-8 lg:space-x-12 whitespace-nowrap w-max will-change-transform"
        initial={{ x: 0 }}
        animate={{ x: '-50%' }}
        transition={{
          repeat: Infinity,
          duration: animationDuration,
          ease: 'linear',
        }}
        whileHover={{ animationPlayState: 'paused' }} // Pause on hover
      >
        {/* First set of partners */}
        {partners.map((partner, idx) => (
          <PartnerItem key={`p1-${idx}`} partner={partner} />
        ))}
        {/* Second set for seamless scroll */}
        {partners.map((partner, idx) => (
          <PartnerItem key={`p2-${idx}`} partner={partner} />
        ))}
      </motion.div>
    </div>
  );
}