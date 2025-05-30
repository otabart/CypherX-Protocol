'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DApp {
  name: string;
  url: string;
  image: string;
  isSpotlight?: boolean;
}

const dApps: DApp[] = [
  {
    name: 'Noice',
    url: 'https://noice.so',
    image: 'https://i.imgur.com/t8CQlRJ.png',
  },
  {
    name: 'BANKR',
    url: 'https://bankr.bot',
    image: 'https://i.imgur.com/4x3mlpZ.png', // Placeholder, as no image was provided
  },
  {
    name: 'Checkr',
    url: 'https://checkr.social',
    image: 'https://i.imgur.com/placeholder.png', // Placeholder for inaccessible blob URL
    isSpotlight: true,
  },
];

const TrendingDApps: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % dApps.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + dApps.length) % dApps.length);
  };

  return (
    <section className="py-12 px-4 bg-gray-950">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-200 mb-6 text-center">
          Trending dApps
        </h2>
        <p className="text-sm sm:text-base md:text-lg text-gray-400 max-w-2xl mx-auto mb-8 text-center">
          Discover the hottest decentralized applications on the Base chain.
        </p>
        <div className="relative">
          <div className="overflow-hidden">
            <motion.div
              className="flex"
              animate={{ x: `-${currentIndex * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              {dApps.map((dApp, index) => (
                <div
                  key={dApp.name}
                  className="w-full flex-shrink-0 px-4"
                >
                  <motion.div
                    className={`bg-gray-900 rounded-xl shadow-lg border ${
                      dApp.isSpotlight
                        ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                        : 'border-blue-500/20'
                    } p-6 flex flex-col items-center transition-all duration-300 hover:shadow-xl`}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <img
                      src={dApp.image}
                      alt={`${dApp.name} logo`}
                      className="w-32 h-32 sm:w-48 sm:h-48 object-contain mb-4 rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = 'https://i.imgur.com/placeholder.png'; // Fallback image
                      }}
                    />
                    <h3 className="text-lg sm:text-xl font-bold text-gray-200 mb-2">
                      {dApp.name}
                    </h3>
                    {dApp.isSpotlight && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 font-semibold rounded-full px-3 py-1 mb-4">
                        dApp Spotlight
                      </span>
                    )}
                    <Link
                      href={dApp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 font-semibold hover:text-blue-300"
                    >
                      Visit {dApp.name} →
                    </Link>
                  </motion.div>
                </div>
              ))}
            </motion.div>
          </div>
          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-gray-900/50 text-gray-200 p-2 rounded-full hover:bg-gray-900/80 transition-all"
            aria-label="Previous dApp"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-gray-900/50 text-gray-200 p-2 rounded-full hover:bg-gray-900/80 transition-all"
            aria-label="Next dApp"
          >
            <ChevronRight size={24} />
          </button>
          <div className="flex justify-center mt-4 space-x-2">
            {dApps.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentIndex ? 'bg-blue-400' : 'bg-gray-600'
                }`}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrendingDApps;