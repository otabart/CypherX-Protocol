'use client';

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler, // Import the Filler plugin
} from 'chart.js';
import Header from '../components/Header'; // Ensure the path is correct
import Footer from '../components/Footer'; // Import the Footer component

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler // Register the Filler plugin
);

export default function Analytics() {
  const [chartData, setChartData] = useState({
    transactionTrends: { labels: [], datasets: [] },
    gasFees: { labels: [], datasets: [] },
  });
  const [stats, setStats] = useState({
    activeWallets: 0,
    transactionsPerSecond: 0,
    averageBlockTime: '0s',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('7 days');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics?filter=${filter}&query=${searchQuery}`, {
          method: 'GET', // Ensure the request method is GET
        });

        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }

        const data = await response.json();

        // Update state with API response
        setChartData({
          transactionTrends: data.transactionTrends,
          gasFees: data.gasFees,
        });
        setStats({
          activeWallets: data.activeWallets,
          transactionsPerSecond: data.transactionsPerSecond,
          averageBlockTime: data.averageBlockTime,
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filter, searchQuery]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-grow container mx-auto py-12 px-4">
        <h1 className="text-4xl font-extrabold text-primaryBlue text-center mb-8">
          Base Chain Analytics
        </h1>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <input
            type="text"
            placeholder="Search metrics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-1/2 px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:border-primaryBlue"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring focus:border-primaryBlue"
          >
            <option value="7 days">Last 7 Days</option>
            <option value="30 days">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Charts Section */}
        {loading ? (
          <p className="text-center">Loading data...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 shadow-md border rounded-lg">
              <h3 className="text-xl font-bold text-primaryBlue text-center mb-4">
                Transaction Trends
              </h3>
              <Line data={chartData.transactionTrends} options={chartOptions} />
            </div>
            <div className="p-4 shadow-md border rounded-lg">
              <h3 className="text-xl font-bold text-orange-600 text-center mb-4">
                Gas Fees
              </h3>
              <Line data={chartData.gasFees} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Additional Stats Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="p-4 shadow-md border rounded-lg">
            <h3 className="text-xl font-bold text-primaryBlue">Active Wallets</h3>
            <p className="text-2xl font-semibold">{stats.activeWallets}</p>
          </div>
          <div className="p-4 shadow-md border rounded-lg">
            <h3 className="text-xl font-bold text-primaryBlue">
              Transactions per Second
            </h3>
            <p className="text-2xl font-semibold">{stats.transactionsPerSecond}</p>
          </div>
          <div className="p-4 shadow-md border rounded-lg">
            <h3 className="text-xl font-bold text-primaryBlue">
              Average Block Time
            </h3>
            <p className="text-2xl font-semibold">{stats.averageBlockTime}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}



