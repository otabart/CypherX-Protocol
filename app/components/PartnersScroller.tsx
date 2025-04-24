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
    src: 'https://res.cloudinary.com/dsr37ut2z/image/upload/v1691545750/marketplace/covalent_marketing_dt84ka.png',
    alt: 'Covalent',
    link: 'https://www.covalenthq.com/',
  },
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
    <a href={partner.link} target="_blank" rel="noopener noreferrer">
      <Image
        src={partner.src}
        alt={partner.alt}
        className="h-auto w-[60px] sm:w-[80px] md:w-[100px] lg:w-[120px]"
        width={120}
        height={80}
        style={{ objectFit: 'contain' }}
      />
    </a>
  </div>
));

export default function PartnersScroller() {
  // Responsive animation duration
  const animationDuration = useMemo(() => {
    const totalPartners = partners.length * 2; // Duplicated for seamless scroll
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const speedFactor = isMobile ? 0.5 : 1; // 0.5s/partner on mobile (min 2s), 1s/partner on desktop (min 5s)
    return Math.max(isMobile ? 2 : 5, totalPartners * speedFactor);
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden bg-gray-100 py-6"
      role="marquee"
      aria-label="Scrolling partners banner"
    >
      {/* Gradient fade edges */}
      <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-gray-100 to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-gray-100 to-transparent z-10 pointer-events-none" />

      <motion.div
        className="flex space-x-6 sm:space-x-16 md:space-x-18 lg:space-x-24 whitespace-nowrap w-max"
        initial={{ x: 0 }}
        animate={{ x: '-50%' }}
        transition={{
          repeat: Infinity,
          duration: animationDuration,
          ease: 'linear',
        }}
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