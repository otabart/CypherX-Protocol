"use client";

import React, { useState, useEffect } from 'react';
import SmartMoneyTable from './components/SmartMoneyTable';
import { getTopHolders, getWalletTransactions, getTotalSupply, getHolderCount, getTokenMetadata } from './services/api';
import type { TokenHolder, Transaction, TokenMetadata, TokenTransferTrend } from './types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip as ChartTooltip, Legend, ArcElement } from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import { ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/20/solid';
import { formatAddress, formatTransactionValue, formatTimestamp } from './utils/format';
import { Network } from 'vis-network/standalone';
import { useEffect as useEffectVis } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Tooltip } from 'react-tooltip';

// Placeholder Header Component
const Header: React.FC = () => (
  <header className="p-4 bg-gray-900">
    <h1 className="text-2xl font-bold text-blue-400">Smart Money Dashboard</h1>
  </header>
);

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend, ArcElement);

// Animation variants for sections
const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

interface Token {
  name: string;
  address: string;
  logoUrl?: string;
}

const isValidAddress = (address: string): boolean => {
  const isValid = /^0x[a-fA-F0-9]{40}$/.test(address);
  if (!isValid) console.warn(`Invalid address format: ${address}`);
  return isValid;
};

const SmartMoneyPage: React.FC = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [holders, setHolders] = useState<TokenHolder[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [totalSupply, setTotalSupply] = useState<string>('0');
  const [holderCount, setHolderCount] = useState<number>(0);
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualizationMode, setVisualizationMode] = useState<'holders' | 'transactions' | 'network' | 'timeline'>('holders');
  const [visibleHolders, setVisibleHolders] = useState<number>(10);
  const [timeoutReached, setTimeoutReached] = useState(false);

  // Fetch tokens from Firebase
  useEffect(() => {
    const fetchTokens = async () => {
      setLoading(true);
      setError(null);
      setTimeoutReached(false);

      const timeout = setTimeout(() => {
        setLoading(false);
        setTimeoutReached(true);
        setError('Request timed out while fetching tokens. Please try again.');
      }, 60000);

      try {
        const tokensCollection = collection(db, 'tokens');
        const tokensSnapshot = await getDocs(tokensCollection);
        if (tokensSnapshot.empty) {
          setError('No tokens found in Firebase. Please add tokens to the "tokens" collection.');
          setLoading(false);
          clearTimeout(timeout);
          return;
        }

        const tokensList = tokensSnapshot.docs
          .map(doc => {
            const data = doc.data();
            const symbol = data.symbol?.trim();
            const address = data.address?.trim();
            if (!symbol || !address || !isValidAddress(address)) {
              console.warn(`Invalid token data: symbol=${symbol}, address=${address}`);
              return null;
            }
            return { name: symbol, address, logoUrl: data.logoUrl?.trim() || undefined } as Token;
          })
          .filter((token): token is Token => token !== null);

        if (tokensList.length > 0) {
          console.log('Fetched tokens:', tokensList);
          setTokens(tokensList);
          setSelectedToken(tokensList[0]);
        } else {
          setError('No valid tokens found in Firebase. All token addresses were invalid or malformed.');
        }
      } catch (err: any) {
        setError(`Failed to fetch tokens from Firebase: ${err.message}. Please check your Firebase configuration.`);
        console.error('Firebase fetch error:', err);
      } finally {
        setLoading(false);
        clearTimeout(timeout);
      }
    };
    fetchTokens();
  }, []);

  // Fetch holders, total supply, holder count, token metadata, and transactions
  const fetchHoldersData = async (token: Token) => {
    setLoading(true);
    setError(null);
    setTimeoutReached(false);
    setHolders([]);
    setTransactions([]);
    setAllTransactions([]);
    setVisibleHolders(10);
    setTotalSupply('0');
    setHolderCount(0);
    setTokenMetadata(null);

    const timeout = setTimeout(() => {
      setLoading(false);
      setTimeoutReached(true);
      setError(`Data fetch timed out for token ${token.name} (${token.address}). This token may not exist on the Base chain, or there may be a network issue. Please try refreshing or selecting a different token.`);
    }, 60000);

    try {
      console.log(`Fetching data for token: ${token.name} (${token.address})`);
      
      // Fetch token metadata to validate the token
      let metadata: TokenMetadata;
      try {
        metadata = await getTokenMetadata(token.address);
        if (!metadata.totalSupply || parseInt(metadata.totalSupply, 16) === 0) {
          console.warn(`Token ${token.address} has no total supply. It may not be a valid ERC-20 token on Base. Proceeding with transfer data fetch.`);
          setError(`Warning: Token ${token.name} (${token.address}) has no total supply. It may not be a valid ERC-20 token on Base, but we'll attempt to fetch transfer data.`);
          metadata = { decimals: 18, totalSupply: '0' }; // Fallback metadata
        }
      } catch (err: any) {
        console.error(`Failed to fetch token metadata for ${token.address}:`, err.message);
        setError(`Warning: Could not fetch metadata for ${token.name} (${token.address}): ${err.message}. Proceeding with transfer data fetch.`);
        metadata = { decimals: 18, totalSupply: '0' }; // Fallback metadata
      }

      const [holdersData, supply, count] = await Promise.all([
        getTopHolders(token.address).catch(err => {
          console.error(`Failed to fetch top holders for ${token.address}:`, err);
          throw err;
        }),
        getTotalSupply(token.address).catch(err => {
          console.error(`Failed to fetch total supply for ${token.address}:`, err);
          return '0'; // Fallback to '0' instead of throwing
        }),
        getHolderCount(token.address).catch(err => {
          console.error(`Failed to fetch holder count for ${token.address}:`, err);
          return 0; // Fallback to 0 instead of throwing
        }),
      ]);

      setHolders(holdersData);
      setTotalSupply(supply);
      setHolderCount(count);
      setTokenMetadata(metadata);

      // Fetch transactions for top holders
      if (holdersData.length > 0) {
        const topHolders = holdersData.slice(0, 10);
        console.log(`Fetching transactions for top holders:`, topHolders.map(h => h.address));
        const txPromises = topHolders.map(holder =>
          getWalletTransactions(holder.address).catch(err => {
            console.error(`Failed to fetch transactions for wallet ${holder.address}:`, err);
            return [];
          })
        );
        const txResults = await Promise.all(txPromises);
        const allTxs = txResults.flat().filter(tx => tx && tx.hash);
        setAllTransactions(allTxs);

        if (holdersData.length > 0) {
          console.log(`Fetching transactions for first holder: ${holdersData[0].address}`);
          const firstHolderTxs = await getWalletTransactions(holdersData[0].address).catch(err => {
            console.error(`Failed to fetch transactions for first holder ${holdersData[0].address}:`, err);
            return [];
          });
          setTransactions(firstHolderTxs);
        }
      } else {
        console.warn(`No holders found for token ${token.address}. This token may have no activity on Base.`);
        setError(`No holders found for token ${token.name} (${token.address}). This token may have no activity on the Base chain.`);
      }
    } catch (err: any) {
      setError(`Failed to fetch data for ${token.name} (${token.address}): ${err.message}. Ensure this token exists on the Base chain and try again.`);
      console.error(`Error fetching data for token ${token.address}:`, err);
    } finally {
      setLoading(false);
      clearTimeout(timeout);
    }
  };

  useEffect(() => {
    if (!selectedToken) return;
    fetchHoldersData(selectedToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToken]);

  const handleWalletClick = async (walletAddress: string) => {
    setLoading(true);
    setError(null);
    setTimeoutReached(false);

    const timeout = setTimeout(() => {
      setLoading(false);
      setTimeoutReached(true);
      setError(`Transaction fetch timed out for wallet ${walletAddress}. Please try again.`);
    }, 60000);

    try {
      console.log(`Fetching transactions for wallet: ${walletAddress}`);
      const txs = await getWalletTransactions(walletAddress);
      setTransactions(txs);
      if (txs.length === 0) {
        setError(`No transactions found for wallet ${walletAddress} on the Base chain.`);
      }
    } catch (err: any) {
      setError(`Failed to fetch transactions for wallet ${walletAddress}: ${err.message}. Ensure this wallet has activity on the Base chain.`);
      console.error(`Error fetching transactions for wallet ${walletAddress}:`, err);
    } finally {
      setLoading(false);
      clearTimeout(timeout);
    }
  };

  // Calculate whale activity metrics
  const whaleActivityMetrics = {
    totalTxValue: allTransactions.reduce((sum, tx) => sum + parseFloat(tx.value), 0),
    totalTxCount: allTransactions.length,
    uniqueWallets: new Set(allTransactions.flatMap(tx => [tx.from, tx.to])).size,
    netFlow: allTransactions.reduce((acc, tx) => {
      if (tx.asset !== 'ETH') {
        const value = parseFloat(tx.value);
        if (holders.some(h => h.address === tx.to)) return acc + value;
        if (holders.some(h => h.address === tx.from)) return acc - value;
      }
      return acc;
    }, 0),
  };

  // Smart Money Trends (top tokens being accumulated)
  const calculateSmartMoneyTrends = (): TokenTransferTrend[] => {
    const tokenMap: { [key: string]: { totalValue: number; transactionCount: number } } = {};
    allTransactions.forEach(tx => {
      if (tx.asset !== 'ETH' && holders.some(h => h.address === tx.to)) {
        if (!tokenMap[tx.asset]) tokenMap[tx.asset] = { totalValue: 0, transactionCount: 0 };
        tokenMap[tx.asset].totalValue += parseFloat(tx.value);
        tokenMap[tx.asset].transactionCount += 1;
      }
    });

    return Object.entries(tokenMap)
      .map(([token, data]) => ({
        token,
        totalValue: data.totalValue,
        transactionCount: data.transactionCount,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5);
  };

  const smartMoneyTrends = calculateSmartMoneyTrends();

  // Holder Distribution Pie Chart
  const holderDistributionData = {
    labels: holders.slice(0, 5).map((holder, index) => `Holder ${index + 1} (${formatAddress(holder.address)})`).concat('Others'),
    datasets: [
      {
        label: 'Token Distribution',
        data: holders.slice(0, 5).map(holder => parseFloat(holder.percentage)).concat(
          holders.length > 5 ? holders.slice(5).reduce((sum, holder) => sum + parseFloat(holder.percentage), 0) : 0
        ),
        backgroundColor: ['#3B82F6', '#1E3A8A', '#4B5563', '#6B7280', '#9CA3AF', '#D1D5DB'],
        borderColor: '#FFFFFF',
        borderWidth: 1,
      },
    ],
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: '#D1D5DB', font: { size: 12 } } },
      title: { display: true, text: 'Smart Holders Distribution', color: '#FFFFFF', font: { size: 14 } },
    },
  };

  // Transaction Line Chart
  const lineChartData = {
    labels: transactions.map((tx, idx) => `Tx ${idx + 1}`),
    datasets: [
      {
        label: 'Transaction Value',
        data: transactions.map(tx => parseFloat(tx.value)),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: '#D1D5DB', font: { size: 12 } } },
      title: { display: true, text: 'Transaction Value Trend', color: '#FFFFFF', font: { size: 14 } },
    },
    scales: {
      x: { ticks: { color: '#D1D5DB', font: { size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
      y: { ticks: { color: '#D1D5DB', font: { size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
    },
  };

  // Network Graph for Whale Transfers
  const NetworkGraph = ({ transactions }: { transactions: Transaction[] }) => {
    const networkRef = React.useRef<HTMLDivElement>(null);

    useEffectVis(() => {
      if (!networkRef.current || transactions.length === 0) return;

      const nodes = new Set<string>();
      const edges: any[] = [];

      transactions.forEach(tx => {
        nodes.add(tx.from);
        nodes.add(tx.to);
        edges.push({
          from: tx.from,
          to: tx.to,
          value: parseFloat(tx.value),
          label: `${formatTransactionValue(tx.value)} ${tx.asset}`,
          color: tx.isBuy ? '#34D399' : '#EF4444',
        });
      });

      const nodeData = Array.from(nodes).map((address, index) => ({
        id: address,
        label: formatAddress(address),
        color: holders.some(holder => holder.address === address) ? '#3B82F6' : '#D1D5DB',
      }));

      const data = { nodes: nodeData, edges };
      const options = {
        nodes: {
          shape: 'dot',
          size: 20,
          font: { size: 12, color: '#FFFFFF' },
          scaling: { min: 10, max: 30 },
        },
        edges: {
          width: 2,
          font: { size: 10, color: '#FFFFFF' },
          arrows: { to: { enabled: true, scaleFactor: 1 } },
        },
        physics: {
          forceAtlas2Based: {
            gravitationalConstant: -50,
            centralGravity: 0.01,
            springLength: 100,
            springConstant: 0.08,
          },
          maxVelocity: 50,
          solver: 'forceAtlas2Based',
          timestep: 0.35,
          stabilization: { iterations: 150 },
        },
        interaction: {
          hover: true,
          zoomView: true,
          dragView: true,
        },
        height: '300px',
      };

      const network = new Network(networkRef.current, data, options);

      network.on('click', (params: { nodes: string[] }) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          handleWalletClick(nodeId);
        }
      });

      network.on('hoverNode', () => {
        if (networkRef.current) networkRef.current.style.cursor = 'pointer';
      });

      network.on('blurNode', () => {
        if (networkRef.current) networkRef.current.style.cursor = 'default';
      });

      return () => {
        network.destroy();
      };
    }, [transactions]);

    return (
      <div className="w-full h-[300px] bg-gray-900 p-4 rounded-lg border border-blue-500/30">
        <h3 className="text-lg font-semibold text-blue-400 mb-2 uppercase">Transfer Network</h3>
        <div ref={networkRef} className="w-full h-[250px]" />
      </div>
    );
  };

  // Timeline Chart for Recent Transactions
  const timelineChartData = {
    labels: allTransactions.slice(0, 20).map((_, idx) => `Tx ${idx + 1}`),
    datasets: [
      {
        label: 'Transaction Value',
        data: allTransactions.slice(0, 20).map(tx => parseFloat(tx.value)),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const timelineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: '#D1D5DB', font: { size: 12 } } },
      title: { display: true, text: 'Recent Whale Transactions', color: '#FFFFFF', font: { size: 14 } },
    },
    scales: {
      x: { ticks: { color: '#D1D5DB', font: { size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
      y: { ticks: { color: '#D1D5DB', font: { size: 10 } }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
    },
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans flex flex-col">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1F2937;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3B82F6;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #60A5FA;
        }
        .animate-pulse-slow {
          animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>

      <div className="relative">
        <Header />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-blue-500/30" />
      </div>

      <main className="container max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16 flex-1">
        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight uppercase text-blue-400">
            Smart Money
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mt-4"
          >
            Track whale activity and token analytics on the Base chain.
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
        </motion.header>

        {/* Token Selection and Refresh */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-900 p-4 rounded-lg border border-blue-500/30 mb-8"
        >
          <div className="w-full sm:w-auto">
            <label className="block text-gray-400 text-sm font-semibold uppercase mb-2">
              Select Token
            </label>
            <div className="relative">
              <select
                className="bg-gray-900 text-gray-200 p-3 rounded-lg w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-300 appearance-none border border-blue-500/30"
                value={selectedToken?.address || ''}
                onChange={(_) => {
                  const token = tokens.find(t => t.address === _.target.value);
                  if (token) setSelectedToken(token);
                }}
                disabled={tokens.length === 0 || loading}
              >
                {tokens.length === 0 ? (
                  <option value="">No tokens available</option>
                ) : (
                  tokens.map(token => (
                    <option key={token.address} value={token.address}>
                      {token.name}
                    </option>
                  ))
                )}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {selectedToken && !loading && (
            <button
              onClick={() => setSelectedToken({ ...selectedToken })}
              className="flex items-center bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300 text-sm uppercase"
            >
              <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin-slow" />
              Refresh Data
            </button>
          )}
        </motion.div>

        {/* Token Summary Cards */}
        {selectedToken && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8"
          >
            <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 flex items-center transform hover:scale-105 transition-transform duration-300">
              {selectedToken.logoUrl && (
                <img
                  src={selectedToken.logoUrl}
                  alt={selectedToken.name}
                  className="w-8 h-8 mr-3 rounded-full border-2 border-blue-400"
                />
              )}
              <div>
                <h3 className="text-gray-400 text-sm font-semibold uppercase">Token</h3>
                <p className="text-xl font-bold text-blue-400">{selectedToken.name}</p>
              </div>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-gray-400 text-sm font-semibold uppercase">Total Smart Holders</h3>
              <p className="text-xl font-bold text-blue-400">{holderCount.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-gray-400 text-sm font-semibold uppercase">Total Supply</h3>
              <p className="text-xl font-bold text-blue-400">{parseFloat(totalSupply).toLocaleString()}</p>
            </div>
            {tokenMetadata && (
              <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 transform hover:scale-105 transition-transform duration-300">
                <h3 className="text-gray-400 text-sm font-semibold uppercase flex items-center">
                  Contract Address
                  <InformationCircleIcon
                    className="w-4 h-4 ml-1 text-gray-400 cursor-pointer"
                    data-tooltip-id="contract-tooltip-smart-money"
                    data-tooltip-content={`Decimals: ${tokenMetadata.decimals}`}
                  />
                </h3>
                <a
                  href={`https://basescan.org/address/${selectedToken.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-sm"
                >
                  {formatAddress(selectedToken.address, 8)}
                </a>
              </div>
            )}
          </motion.div>
        )}

        {/* Whale Activity Summary */}
        {allTransactions.length > 0 && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-gray-400 text-sm font-semibold uppercase flex items-center">
                Total Tx Value
                <InformationCircleIcon
                  className="w-4 h-4 ml-1 text-gray-400 cursor-pointer"
                  data-tooltip-id="tx-value-tooltip-smart-money"
                  data-tooltip-content="Sum of all transaction values by top holders"
                />
              </h3>
              <p className="text-xl font-bold text-blue-400">{whaleActivityMetrics.totalTxValue.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-gray-400 text-sm font-semibold uppercase flex items-center">
                Total Transactions
                <InformationCircleIcon
                  className="w-4 h-4 ml-1 text-gray-400 cursor-pointer"
                  data-tooltip-id="tx-count-tooltip-smart-money"
                  data-tooltip-content="Number of transactions by top holders"
                />
              </h3>
              <p className="text-xl font-bold text-blue-400">{whaleActivityMetrics.totalTxCount}</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-gray-400 text-sm font-semibold uppercase flex items-center">
                Unique Wallets
                <InformationCircleIcon
                  className="w-4 h-4 ml-1 text-gray-400 cursor-pointer"
                  data-tooltip-id="wallets-tooltip-smart-money"
                  data-tooltip-content="Number of unique wallets involved in transactions"
                />
              </h3>
              <p className="text-xl font-bold text-blue-400">{whaleActivityMetrics.uniqueWallets}</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-gray-400 text-sm font-semibold uppercase flex items-center">
                Net Flow
                <InformationCircleIcon
                  className="w-4 h-4 ml-1 text-gray-400 cursor-pointer"
                  data-tooltip-id="net-flow-tooltip-smart-money"
                  data-tooltip-content="Net token flow (inflow - outflow) for top holders"
                />
              </h3>
              <p className={`text-xl font-bold flex items-center gap-1 ${whaleActivityMetrics.netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {whaleActivityMetrics.netFlow >= 0 ? '▲' : '▼'} {Math.abs(whaleActivityMetrics.netFlow).toLocaleString()} Tokens
              </p>
            </div>
          </motion.div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center items-center my-6"
          >
            <svg className="animate-spin h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="ml-3 text-gray-400 text-lg">Loading data for {selectedToken?.name || 'tokens'}...</span>
          </motion.div>
        )}

        {/* Error Message */}
        {(error || timeoutReached) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-lg mb-6"
          >
            <strong className="uppercase">Error:</strong> {error || 'An unexpected error occurred.'}
            <button
              className="ml-4 bg-blue-500/20 text-blue-400 px-4 py-1 rounded hover:bg-blue-500/40 border border-blue-500/30 uppercase"
              onClick={() => {
                setError(null);
                setTimeoutReached(false);
                setSelectedToken(tokens[0] || null);
              }}
            >
              Retry
            </button>
          </motion.div>
        )}

        {/* Visualization Toggle */}
        {(holders.length > 0 || transactions.length > 0 || allTransactions.length > 0) && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-wrap gap-4 mb-6"
          >
            <button
              onClick={() => setVisualizationMode('holders')}
              className={`px-4 py-2 rounded-lg text-sm uppercase ${visualizationMode === 'holders' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-900 text-gray-400 border-gray-700'} border hover:bg-blue-500/40 transition-colors duration-200`}
            >
              Holders
            </button>
            <button
              onClick={() => setVisualizationMode('transactions')}
              className={`px-4 py-2 rounded-lg text-sm uppercase ${visualizationMode === 'transactions' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-900 text-gray-400 border-gray-700'} border hover:bg-blue-500/40 transition-colors duration-200`}
            >
              Transactions
            </button>
            <button
              onClick={() => setVisualizationMode('network')}
              className={`px-4 py-2 rounded-lg text-sm uppercase ${visualizationMode === 'network' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-900 text-gray-400 border-gray-700'} border hover:bg-blue-500/40 transition-colors duration-200`}
            >
              Network
            </button>
            <button
              onClick={() => setVisualizationMode('timeline')}
              className={`px-4 py-2 rounded-lg text-sm uppercase ${visualizationMode === 'timeline' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-900 text-gray-400 border-gray-700'} border hover:bg-blue-500/40 transition-colors duration-200`}
            >
              Timeline
            </button>
          </motion.div>
        )}

        {/* Smart Holders Section */}
        {visualizationMode === 'holders' && (
          <motion.section variants={sectionVariants} initial="hidden" animate="visible" className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-8 uppercase">Smart Holders (Top 100)</h2>
            {holders.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 h-[300px]">
                  <Pie data={holderDistributionData} options={pieChartOptions} />
                </div>
                <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30">
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    <SmartMoneyTable holders={holders.slice(0, visibleHolders)} onWalletClick={handleWalletClick} />
                  </div>
                  {visibleHolders < holders.length && (
                    <button
                      onClick={() => setVisibleHolders(prev => Math.min(prev + 10, holders.length))}
                      className="mt-4 bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300 text-sm uppercase w-full"
                    >
                      Load More ({holders.length - visibleHolders} remaining)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-center py-4">No holder data available. Try refreshing or selecting a different token.</div>
            )}
          </motion.section>
        )}

        {/* Transaction Visualizations */}
        {visualizationMode === 'transactions' && (
          <motion.section variants={sectionVariants} initial="hidden" animate="visible" className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-8 uppercase">Money Flow Analysis</h2>
            {transactions.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 h-[250px]">
                  <Line data={lineChartData} options={lineChartOptions} />
                </div>
                <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 overflow-x-auto">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2 uppercase">Transaction History</h3>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-900">
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Hash</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Time</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Type</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">From</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">To</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Asset</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => (
                        <tr key={tx.hash} className="border-b border-gray-800 hover:bg-blue-500/10 transition-colors duration-150">
                          <td className="p-3 text-gray-200 text-sm">
                            <a
                              href={`https://basescan.org/tx/${tx.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              {formatAddress(tx.hash)}
                            </a>
                          </td>
                          <td className="p-3 text-gray-200 text-sm">{tx.timestamp ? formatTimestamp(tx.timestamp) : 'N/A'}</td>
                          <td className={`p-3 text-sm ${tx.isBuy ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.isBuy !== undefined ? (tx.isBuy ? 'BUY' : 'SELL') : 'N/A'}
                          </td>
                          <td className="p-3 text-gray-200 text-sm">{formatAddress(tx.from)}</td>
                          <td className="p-3 text-gray-200 text-sm">{formatAddress(tx.to)}</td>
                          <td className="p-3 text-gray-200 text-sm">{tx.asset}</td>
                          <td className="p-3 text-gray-200 text-sm">{formatTransactionValue(tx.value)} {tx.asset}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-center py-4">
                No transaction data available. Click "View Transactions" on a holder to load data.
              </div>
            )}
          </motion.section>
        )}

        {/* Network Visualization */}
        {visualizationMode === 'network' && (
          <motion.section variants={sectionVariants} initial="hidden" animate="visible" className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-8 uppercase">Whale Transfer Network</h2>
            {transactions.length > 0 ? (
              <NetworkGraph transactions={transactions} />
            ) : (
              <div className="text-gray-400 text-center py-4">
                No network data available. Click "View Transactions" on a holder to load data.
              </div>
            )}
          </motion.section>
        )}

        {/* Timeline Visualization */}
        {visualizationMode === 'timeline' && (
          <motion.section variants={sectionVariants} initial="hidden" animate="visible" className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-8 uppercase">Recent Whale Transactions</h2>
            {allTransactions.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 h-[250px]">
                  <Line data={timelineChartData} options={timelineChartOptions} />
                </div>
                <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30 overflow-x-auto">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2 uppercase">Transaction Timeline</h3>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-900">
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Hash</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Time</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Type</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">From</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">To</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Asset</th>
                        <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTransactions.slice(0, 20).map(tx => (
                        <tr key={tx.hash} className="border-b border-gray-800 hover:bg-blue-500/10 transition-colors duration-150">
                          <td className="p-3 text-gray-200 text-sm">
                            <a
                              href={`https://basescan.org/tx/${tx.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              {formatAddress(tx.hash)}
                            </a>
                          </td>
                          <td className="p-3 text-gray-200 text-sm">{tx.timestamp ? formatTimestamp(tx.timestamp) : 'N/A'}</td>
                          <td className={`p-3 text-sm ${tx.isBuy ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.isBuy !== undefined ? (tx.isBuy ? 'BUY' : 'SELL') : 'N/A'}
                          </td>
                          <td className="p-3 text-gray-200 text-sm">{formatAddress(tx.from)}</td>
                          <td className="p-3 text-gray-200 text-sm">{formatAddress(tx.to)}</td>
                          <td className="p-3 text-gray-200 text-sm">{tx.asset}</td>
                          <td className="p-3 text-gray-200 text-sm">{formatTransactionValue(tx.value)} {tx.asset}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-center py-4">No recent transactions available.</div>
            )}
          </motion.section>
        )}

        {/* Smart Money Trends */}
        {smartMoneyTrends.length > 0 && (
          <motion.section variants={sectionVariants} initial="hidden" animate="visible" className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-8 uppercase">Smart Money Trends</h2>
            <div className="bg-gray-900 p-4 rounded-lg border border-blue-500/30">
              <h3 className="text-lg font-semibold text-blue-400 mb-2 uppercase">Top Tokens Being Accumulated</h3>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-900">
                    <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Token</th>
                    <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Total Value</th>
                    <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Transaction Count</th>
                  </tr>
                </thead>
                <tbody>
                  {smartMoneyTrends.map(trend => (
                    <tr key={trend.token} className="border-b border-gray-800 hover:bg-blue-500/10 transition-colors duration-150">
                      <td className="p-3 text-gray-200 text-sm">{trend.token}</td>
                      <td className="p-3 text-gray-200 text-sm">{trend.totalValue.toLocaleString()}</td>
                      <td className="p-3 text-gray-200 text-sm">{trend.transactionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>
        )}
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-400 text-sm border-t border-blue-500/30 bg-gray-950">
        <p>
          © 2025 Cypher Systems. Powered by <span className="text-blue-400">Base</span>.
        </p>
      </footer>

      {/* Tooltip Components */}
      <Tooltip id="contract-tooltip-smart-money" />
      <Tooltip id="tx-value-tooltip-smart-money" />
      <Tooltip id="tx-count-tooltip-smart-money" />
      <Tooltip id="wallets-tooltip-smart-money" />
      <Tooltip id="net-flow-tooltip-smart-money" />
    </div>
  );
};

export default SmartMoneyPage;