// File: app/(your-folder)/GenesisLaunchesPage.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase'; // ← Make sure this path is correct
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ShoppingBagIcon } from '@heroicons/react/24/solid';

// --------------------
// NavBar (same as your MarketplacePage)
// --------------------
const NavBar = () => (
  <nav className="bg-gray-950 p-4 flex justify-between items-center sticky top-0 z-10 border-b border-blue-500/30">
    <div className="flex items-center space-x-2">
      <ShoppingBagIcon className="h-6 w-6 text-blue-400" />
      <h1 className="text-xl font-bold text-blue-400 uppercase">CypherX Screener</h1>
    </div>
    <div className="flex items-center space-x-4">
      <a
        href="#"
        className="text-gray-400 hover:text-blue-400 text-sm uppercase tracking-wide transition-colors duration-300"
      >
        Home
      </a>
      <a
        href="#"
        className="text-gray-400 hover:text-blue-400 text-sm uppercase tracking-wide transition-colors duration-300"
      >
        Docs
      </a>
      <ConnectButton.Custom>
        {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
          const connected = mounted && account && chain;
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
        }}
      </ConnectButton.Custom>
    </div>
  </nav>
);

// --------------------
// Types & Interfaces
// --------------------
interface GenesisLaunch {
  id: string;
  name: string;
  symbol: string;
  imageUrl: string;
  createdAt: { toDate: () => Date };
  initialPrice: number; // adjust field name if yours is different
  // add any other fields you need (e.g. marketCap, volume, etc.)
}

// Data point used only for computing “index” stats
interface IndexStats {
  totalLaunches: number;
  averageInitialPrice: number;
}

// --------------------
// Main Page Component
// --------------------
const GenesisLaunchesPage: React.FC = () => {
  const [launches, setLaunches] = useState<GenesisLaunch[]>([]);
  const [indexStats, setIndexStats] = useState<IndexStats>({
    totalLaunches: 0,
    averageInitialPrice: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all documents from "genesisLaunches"
  useEffect(() => {
    setLoading(true);
    const launchesQuery = query(
      collection(db, 'genesisLaunches'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      launchesQuery,
      (snapshot) => {
        const items: GenesisLaunch[] = snapshot.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            name: data.name,
            symbol: data.symbol,
            imageUrl: data.imageUrl,
            createdAt: data.createdAt,
            initialPrice: data.initialPrice,
          };
        });

        setLaunches(items);
        setLoading(false);
      },
      (err) => {
        setError('Failed to fetch genesis launches: ' + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Compute index stats whenever launches change
  useEffect(() => {
    if (launches.length === 0) {
      setIndexStats({ totalLaunches: 0, averageInitialPrice: 0 });
      return;
    }
    const total = launches.length;
    const sumPrices = launches.reduce((acc, l) => acc + (l.initialPrice || 0), 0);
    const avgPrice = sumPrices / total;
    setIndexStats({ totalLaunches: total, averageInitialPrice: parseFloat(avgPrice.toFixed(4)) });
  }, [launches]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans">
      {/* Navigation */}
      <NavBar />

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-3xl font-bold mb-6 text-white uppercase">Genesis Launches Index</h2>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && <div className="text-center text-gray-400">Loading...</div>}

        {/* Index Stats Table */}
        {!loading && !error && (
          <div className="mb-12">
            <table className="w-full table-auto border-collapse mb-6">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left bg-gray-900 text-blue-400 uppercase text-sm">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left bg-gray-900 text-blue-400 uppercase text-sm">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-800">
                  <td className="px-4 py-2 border-b border-gray-700">Total Launches</td>
                  <td className="px-4 py-2 border-b border-gray-700">
                    {indexStats.totalLaunches}
                  </td>
                </tr>
                <tr className="bg-gray-800">
                  <td className="px-4 py-2 border-b border-gray-700">Average Initial Price (USD)</td>
                  <td className="px-4 py-2 border-b border-gray-700">
                    ${indexStats.averageInitialPrice.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>

            <h2 className="text-3xl font-bold mb-6 text-white uppercase">
              All Genesis Launches Screener
            </h2>

            {/* Full-Width Screener Table */}
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr>
                    <th className="w-1/12 px-4 py-2 text-left bg-gray-900 text-blue-400 uppercase text-sm">
                      Logo
                    </th>
                    <th className="w-3/12 px-4 py-2 text-left bg-gray-900 text-blue-400 uppercase text-sm">
                      Name
                    </th>
                    <th className="w-2/12 px-4 py-2 text-left bg-gray-900 text-blue-400 uppercase text-sm">
                      Symbol
                    </th>
                    <th className="w-2/12 px-4 py-2 text-left bg-gray-900 text-blue-400 uppercase text-sm">
                      Launch Date
                    </th>
                    <th className="w-2/12 px-4 py-2 text-left bg-gray-900 text-blue-400 uppercase text-sm">
                      Initial Price (USD)
                    </th>
                    {/* Add more columns here if needed */}
                  </tr>
                </thead>
                <tbody>
                  {launches.map((launch) => (
                    <tr key={launch.id} className="bg-gray-800 hover:bg-gray-700">
                      <td className="px-4 py-3 border-b border-gray-700">
                        <img
                          src={launch.imageUrl}
                          alt={`${launch.symbol} logo`}
                          className="h-8 w-8 rounded-full"
                        />
                      </td>
                      <td className="px-4 py-3 border-b border-gray-700">{launch.name}</td>
                      <td className="px-4 py-3 border-b border-gray-700">{launch.symbol}</td>
                      <td className="px-4 py-3 border-b border-gray-700">
                        {new Date(launch.createdAt.toDate()).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 border-b border-gray-700">
                        ${launch.initialPrice.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-400 text-sm border-t border-blue-500/30 bg-gray-950">
        <p>© 2025 Cypher Systems. Powered by <span className="text-blue-400">Base</span>.</p>
      </footer>
    </div>
  );
};

export default GenesisLaunchesPage;
