'use client';

import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ShoppingBagIcon } from '@heroicons/react/24/solid';
import ClientCard from '../components/ClientCard';

// Define MarketplaceItem type directly (to avoid path issues if src/types.ts isn't used elsewhere)
interface MarketplaceItem {
  id?: number;
  name: string;
  price?: string;
  category?: 'Advertisement' | 'TokenBoost' | 'ExplorerProfile' | 'Bump Bot' | 'Telegram';
  description: string;
  available?: boolean;
  duration?: string;
}

// Animation variants for cards
const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const NavBar = () => (
  <nav className="bg-gray-950 p-4 flex justify-between items-center sticky top-0 z-10 border-b border-blue-500/30">
    <div className="flex items-center space-x-2">
      <ShoppingBagIcon className="h-6 w-6 text-blue-400" />
      <h1 className="text-xl font-bold text-blue-400 uppercase">Marketplace</h1>
    </div>
    <div className="flex items-center space-x-4">
      <a href="#" className="text-gray-400 hover:text-blue-400 text-sm uppercase tracking-wide transition-colors duration-300">
        Home
      </a>
      <a href="#" className="text-gray-400 hover:text-blue-400 text-sm uppercase tracking-wide transition-colors duration-300">
        Docs
      </a>
      <ConnectButton.Custom>
        {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
          const connected = mounted && account && chain;

          return (
            <div>
              {(() => {
                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      className="bg-blue-500/20 text-blue-400 text-sm uppercase tracking-wide px-4 py-2 rounded-lg hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300"
                    >
                      Connect Wallet
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button
                      onClick={openChainModal}
                      className="bg-red-500/20 text-red-400 text-sm uppercase tracking-wide px-4 py-2 rounded-lg hover:bg-red-500/40 border border-red-500/30 transition-all duration-300"
                    >
                      Wrong Network
                    </button>
                  );
                }

                return (
                  <button
                    onClick={openAccountModal}
                    className="bg-blue-500/20 text-blue-400 text-sm uppercase tracking-wide px-4 py-2 rounded-lg hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300"
                  >
                    {account.displayName}
                  </button>
                );
              })()}
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
  </nav>
);

export default function MarketplacePage() {
  const marketplaceItems: MarketplaceItem[] = [
    {
      id: 1,
      name: 'Banner Ad Slot',
      price: '0 USDC',
      category: 'Advertisement',
      description:
        'Claim a prime banner ad slot on Cypher Systems, powered by Base chain. Once the transaction is confirmed, your ad will be live!',
      available: true,
    },
    {
      id: 2,
      name: 'Boost (10)',
      price: '10 USDC',
      duration: '12HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 10. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 3,
      name: 'Boost (20)',
      price: '15 USDC',
      duration: '12HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 20. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 4,
      name: 'Boost (30)',
      price: '20 USDC',
      duration: '12HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 30. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 5,
      name: 'Boost (40)',
      price: '25 USDC',
      duration: '12HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 40. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 6,
      name: 'Boost (50)',
      price: '35 USDC',
      duration: '24HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 50. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 7,
      name: 'Boost (100)',
      price: '50 USDC',
      duration: '24HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 100. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 8,
      name: 'Boost (150)',
      price: '75 USDC',
      duration: '36HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 150. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 9,
      name: 'Boost (200)',
      price: '90 USDC',
      duration: '36HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 200. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 10,
      name: 'Boost (250)',
      price: '100 USDC',
      duration: '36HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 250. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 11,
      name: 'Boost (500)',
      price: '175 USDC',
      duration: '48HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 500. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 12,
      name: 'Boost (1000)',
      price: '300 USDC',
      duration: '48HR',
      category: 'TokenBoost',
      description:
        "Increase your token's visibility with a score of 1000. Once the transaction is confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: 13,
      name: 'Custom Explorer Profile',
      price: '2 CYPH',
      category: 'ExplorerProfile',
      description:
        'Design a unique blockchain explorer profile, exclusive to Base. Once the transaction is confirmed, your profile will be updated!',
      available: true,
    },
  ];

  const comingSoonItems: MarketplaceItem[] = [
    {
      name: 'Bump Bot (Micro txns)',
      description: 'Auto-bump your token with microtransactions for maximum exposure.',
    },
    {
      name: 'Telegram Trending',
      description: 'Launch your project to multiple different Telegram trending channels.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans relative">
      {/* Navigation */}
      <NavBar />

      {/* Hero Section */}
      <header className="p-8 md:p-12 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold tracking-tight mb-4 uppercase text-blue-400"
        >
          Welcome to Marketplace
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto"
        >
          Discover powerful tools and services to enhance your presence on the Base chain.
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-6"
        >
          <span className="inline-block bg-blue-500/20 text-blue-400 px-4 py-2 rounded-full text-sm font-medium uppercase">
            Powered by Base Chain
          </span>
        </motion.div>
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        {/* Featured Products Section */}
        <section className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-8 md:mb-12 uppercase">
            Featured Products
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {marketplaceItems.map((item) => (
              <ClientCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        {/* Coming Soon Section */}
        <section>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-8 md:mb-12 uppercase">
            Coming Soon
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {comingSoonItems.map((item, index) => (
              <ClientCard key={index} item={item} isComingSoon />
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-400 text-sm border-t border-blue-500/30 bg-gray-950">
        <p>
          © 2025 Cypher Systems. Powered by <span className="text-blue-400">Base</span>.
        </p>
      </footer>
    </div>
  );
}