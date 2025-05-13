"use client";

import React, { useState, useEffect } from 'react';
import SmartMoneyTable from './components/SmartMoneyTable';
import { getTopHolders, getWalletTransactions, getTotalSupply, getHolderCount } from './services/api';
import type { TokenHolder, Transaction } from './types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import { ArrowPathIcon } from '@heroicons/react/20/solid';
import { formatAddress, formatTransactionValue } from './utils/format';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

interface Token {
  name: string;
  address: string;
  logoUrl?: string;
}

const SmartMoneyPage: React.FC = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [holders, setHolders] = useState<TokenHolder[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalSupply, setTotalSupply] = useState<string>('0');
  const [holderCount, setHolderCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tokens from Firebase
  useEffect(() => {
    const fetchTokens = async () => {
      setLoading(true);
      setError(null);
      try {
        const tokensCollection = collection(db, 'tokens');
        const tokensSnapshot = await getDocs(tokensCollection);
        
        if (tokensSnapshot.empty) {
          setError('No tokens found in Firebase. The "tokens" collection is empty.');
          console.warn('Tokens collection is empty');
          setLoading(false);
          return;
        }

        console.log(`Fetched ${tokensSnapshot.size} documents from tokens collection`);

        const tokensList = tokensSnapshot.docs
          .map(doc => {
            const data = doc.data();
            console.log(`Token document ${doc.id}:`, data);
            
            const symbol = data.symbol;
            const address = data.address;

            if (!symbol || !address) {
              console.warn(
                `Invalid token document: ${doc.id}. Missing fields - symbol: ${symbol}, address: ${address}`,
                data
              );
              return null;
            }

            return {
              name: symbol,
              address: address,
              logoUrl: data.logoUrl,
            } as Token;
          })
          .filter((token): token is Token => token !== null);

        if (tokensList.length > 0) {
          console.log('Valid tokens:', tokensList);
          setTokens(tokensList);
          setSelectedToken(tokensList[0]);
        } else {
          setError('No valid tokens found in Firebase. Ensure documents have "symbol" and "address" fields.');
          console.warn('No valid tokens after filtering');
        }
      } catch (err: any) {
        setError(`Failed to fetch tokens from Firebase: ${err.message}`);
        console.error('Firebase fetch error:', err);
      }
      setLoading(false);
    };
    fetchTokens();
  }, []);

  // Fetch holders, total supply, and holder count
  useEffect(() => {
    if (!selectedToken) return;

    const fetchHoldersData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [holderData, supply, count] = await Promise.all([
          getTopHolders(selectedToken.address),
          getTotalSupply(selectedToken.address),
          getHolderCount(selectedToken.address),
        ]);
        console.log('Holder data:', holderData);
        setHolders(holderData);
        setTotalSupply(supply);
        setHolderCount(count);
      } catch (err: any) {
        setError(`Failed to fetch data for ${selectedToken.name}: ${err.message}`);
        console.error('Holder fetch error:', err);
      }
      setLoading(false);
    };
    fetchHoldersData();
  }, [selectedToken]);

  const handleWalletClick = async (walletAddress: string) => {
    setLoading(true);
    setError(null);
    try {
      const txs = await getWalletTransactions(walletAddress);
      console.log('Transactions:', txs);
      setTransactions(txs);
    } catch (err: any) {
      setError(`Failed to fetch transactions: ${err.message}`);
      console.error('Transaction fetch error:', err);
    }
    setLoading(false);
  };

  // Visualizations
  const lineChartData = {
    labels: transactions.map((_, index) => `Tx ${index + 1}`),
    datasets: [
      {
        label: 'Transaction Value',
        data: transactions.map(tx => parseFloat(tx.value)),
        borderColor: '#3B82F6', // Coinbase blue
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: '#D1D5DB' }, // Gray-300
      },
      title: {
        display: true,
        text: 'Transaction Value Over Time',
        color: '#FFFFFF', // White
        font: { size: 16 },
      },
    },
    scales: {
      x: {
        ticks: { color: '#D1D5DB' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        ticks: { color: '#D1D5DB' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
    },
  };

  const moneyFlowData = transactions.reduce((acc, tx) => {
    acc[tx.to] = (acc[tx.to] || 0) + parseFloat(tx.value);
    return acc;
  }, {} as { [key: string]: number });

  const pieChartData = {
    labels: Object.keys(moneyFlowData).map(address => formatAddress(address)),
    datasets: [
      {
        label: 'Money Flow',
        data: Object.values(moneyFlowData),
        backgroundColor: [
          '#3B82F6', // Coinbase blue
          '#1E3A8A', // Dark dark blue
          '#4B5563', // Gray-600
          '#6B7280', // Gray-500
          '#9CA3AF', // Gray-400
          '#D1D5DB', // Gray-300
        ],
        borderColor: '#FFFFFF', // White
        borderWidth: 1,
      },
    ],
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: '#D1D5DB' },
      },
      title: {
        display: true,
        text: 'Money Flow Distribution (Destinations)',
        color: '#FFFFFF',
        font: { size: 16 },
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col">
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-extrabold text-blue-500 tracking-wider animate-pulse">
          Cypher Systems - Smart Money
        </h1>
        <p className="text-gray-400 mt-3 text-xl">
          Powered by Cypher.io | Base Chain Analytics
        </p>
      </header>

      <div className="max-w-7xl mx-auto w-full flex-1 space-y-8">
        {/* Token Selection and Refresh */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 bg-gray-800 p-6 rounded-xl shadow-lg">
          <div className="w-full sm:w-auto">
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Select Token
            </label>
            <div className="relative">
              <select
                className="bg-gray-700 text-white p-4 rounded-lg w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 appearance-none"
                value={selectedToken?.address || ''}
                onChange={(e) => {
                  const token = tokens.find(t => t.address === e.target.value);
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
              onClick={() => {
                setHolders([]);
                setTransactions([]);
                setSelectedToken({ ...selectedToken });
              }}
              className="flex items-center bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors duration-300 shadow-md"
            >
              <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin-slow" />
              Refresh Data
            </button>
          )}
        </div>

        {/* Token Summary Card */}
        {selectedToken && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex items-center transform hover:scale-105 transition-transform duration-300">
              {selectedToken.logoUrl && (
                <img
                  src={selectedToken.logoUrl}
                  alt={selectedToken.name}
                  className="w-10 h-10 mr-4 rounded-full border-2 border-blue-500"
                />
              )}
              <div>
                <h3 className="text-gray-400 text-sm font-semibold">Token</h3>
                <p className="text-2xl font-bold text-blue-500">{selectedToken.name}</p>
              </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-gray-400 text-sm font-semibold">Total Holders</h3>
              <p className="text-2xl font-bold text-blue-500">{holderCount.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-gray-400 text-sm font-semibold">Total Supply</h3>
              <p className="text-2xl font-bold text-blue-500">{parseFloat(totalSupply).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center items-center my-8">
            <svg
              className="animate-spin h-8 w-8 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="ml-3 text-gray-300 text-lg">Loading...</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-lg mb-6 animate-fade-in">
            {error}
          </div>
        )}

        {/* Holders Table */}
        {holders.length > 0 && (
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-3xl font-semibold text-blue-500 mb-6">Top 100 Holders (Whales)</h2>
            <SmartMoneyTable holders={holders} onWalletClick={handleWalletClick} />
          </div>
        )}

        {/* Transaction Visualizations */}
        {transactions.length > 0 && (
          <div className="mt-8 space-y-8">
            <h2 className="text-3xl font-semibold text-blue-500">Money Flow Analysis</h2>
            
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>

            <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
              <Pie data={pieChartData} options={pieChartOptions} />
            </div>

            <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
              <h3 className="text-2xl font-semibold text-blue-500 mb-4">Detailed Transaction History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-700">
                      <th className="p-4 text-gray-300 font-semibold">Hash</th>
                      <th className="p-4 text-gray-300 font-semibold">From</th>
                      <th className="p-4 text-gray-300 font-semibold">To</th>
                      <th className="p-4 text-gray-300 font-semibold">Asset</th>
                      <th className="p-4 text-gray-300 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr
                        key={tx.hash}
                        className="border-b border-gray-700 hover:bg-gray-600 transition-colors duration-150"
                      >
                        <td className="p-4 text-gray-300">
                          <a
                            href={`https://basescan.org/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            {formatAddress(tx.hash)}
                          </a>
                        </td>
                        <td className="p-4 text-gray-300">{formatAddress(tx.from)}</td>
                        <td className="p-4 text-gray-300">{formatAddress(tx.to)}</td>
                        <td className="p-4 text-gray-300">{tx.asset}</td>
                        <td className="p-4 text-gray-300">{formatTransactionValue(tx.value)} {tx.asset}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartMoneyPage;