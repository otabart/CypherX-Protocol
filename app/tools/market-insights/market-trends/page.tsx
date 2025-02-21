'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
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
} from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function MarketTrends() {
  const [coins, setCoins] = useState([]);
  const [filteredCoins, setFilteredCoins] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch CoinGecko Data
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await axios.get(
          'https://api.coingecko.com/api/v3/coins/markets',
          {
            params: {
              vs_currency: 'usd',
              order: 'market_cap_desc',
              per_page: 50,
              page: 1,
              sparkline: true,
            },
          }
        );
        setCoins(response.data);
        setFilteredCoins(response.data);
        updateChartData(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching market data:', error);
        setLoading(false);
      }
    };

    fetchMarketData();
  }, []);

  // Update Chart Data
  const updateChartData = (data) => {
    setChartData({
      labels: data.map((coin) => coin.name),
      datasets: [
        {
          label: 'Market Cap (in billions)',
          data: data.map((coin) => coin.market_cap / 1e9),
          backgroundColor: 'rgba(0, 82, 255, 0.2)',
          borderColor: '#0052FF',
          borderWidth: 2,
        },
      ],
    });
  };

  // Handle Search
  useEffect(() => {
    const results = coins.filter(
      (coin) =>
        coin.name.toLowerCase().includes(search.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredCoins(results);
    updateChartData(results);
  }, [search]);

  // Handle Category Filter
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredCoins(coins);
    } else {
      const filtered = coins.filter((coin) =>
        coin.categories?.includes(selectedCategory)
      );
      setFilteredCoins(filtered);
    }
    updateChartData(filteredCoins);
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Title & Filters */}
      <div className="w-full px-6 py-6 bg-primaryBlue text-white text-center shadow-md">
        <h1 className="text-4xl font-extrabold">Market Trends</h1>
        <p className="text-lg opacity-90">Live insights into crypto markets</p>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <input
            type="text"
            placeholder="Search for a coin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-1/3 px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-primaryBlue"
          />
          <select
            className="mt-4 md:mt-0 px-4 py-2 border rounded-md bg-gray-100 focus:outline-none"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="defi">DeFi</option>
            <option value="layer1">Layer 1</option>
            <option value="meme">Meme Coins</option>
            <option value="ai">AI Coins</option>
          </select>
        </div>

        {/* Loading Indicator */}
        {loading && <p className="text-center text-lg text-gray-600">Loading market data...</p>}

        {/* Market Trends Table */}
        {!loading && (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse shadow-md">
              <thead className="bg-gray-100">
                <tr className="text-left">
                  <th className="p-3">#</th>
                  <th className="p-3">Coin</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">24h %</th>
                  <th className="p-3">Market Cap</th>
                  <th className="p-3">Volume</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoins.map((coin, index) => (
                  <tr key={coin.id} className="border-b hover:bg-gray-100 transition">
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3 flex items-center">
                      <img src={coin.image} alt={coin.name} className="w-6 h-6 mr-2" />
                      {coin.name} ({coin.symbol.toUpperCase()})
                    </td>
                    <td className="p-3">${coin.current_price.toLocaleString()}</td>
                    <td
                      className={`p-3 font-semibold ${
                        coin.price_change_percentage_24h > 0 ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {coin.price_change_percentage_24h.toFixed(2)}%
                    </td>
                    <td className="p-3">${(coin.market_cap / 1e9).toFixed(2)}B</td>
                    <td className="p-3">${(coin.total_volume / 1e9).toFixed(2)}B</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Market Cap Chart */}
        <div className="mt-8 bg-gray-50 p-6 rounded-md shadow-md">
          <h2 className="text-2xl font-bold text-primaryBlue text-center mb-4">
            Market Capitalization Trends
          </h2>
          {chartData && <Line data={chartData} />}
        </div>
      </div>
    </div>
  );
}

