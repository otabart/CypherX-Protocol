import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase'; // ← Updated to the correct path
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
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
import axios from 'axios';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Define token type for better type safety
interface Token {
  id: string;
  address: string;
  createdAt: { toDate: () => Date };
  pool: string;
  symbol: string;
}

// Define chart data point type
interface ChartDataPoint {
  x: string;
  y: number;
}

const VirtualsTracker: React.FC = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [priceData, setPriceData] = useState<ChartDataPoint[]>([]);
  const [volumeData, setVolumeData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tokens from Firestore
  useEffect(() => {
    const tokensQuery = query(
      collection(db, 'tokens'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      tokensQuery,
      (snapshot) => {
        const tokenList: Token[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          address: (doc.data() as any).address,
          createdAt: (doc.data() as any).createdAt,
          pool: (doc.data() as any).pool,
          symbol: (doc.data() as any).symbol,
        }));
        setTokens(tokenList);
        setLoading(false);
      },
      (err) => {
        setError('Failed to fetch tokens: ' + err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch price and volume data for selected token
  useEffect(() => {
    if (!selectedToken) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch OHLCV data from CoinGecko for chart
        const chartResponse = await axios.get(
          `https://api.coingecko.com/api/v3/coins/${selectedToken.symbol.toLowerCase()}/market_chart?vs_currency=usd&days=7`
        );
        const prices: ChartDataPoint[] = chartResponse.data.prices.map(
          (p: [number, number]) => ({
            x: new Date(p[0]).toLocaleDateString(),
            y: p[1],
          })
        );
        const volumes: ChartDataPoint[] = chartResponse.data.total_volumes.map(
          (v: [number, number]) => ({
            x: new Date(v[0]).toLocaleDateString(),
            y: v[1],
          })
        );

        // Fetch pool data from DexScreener (not used directly in the charts here)
        await axios.get(
          `https://api.dexscreener.com/latest/dex/pairs/base/${selectedToken.pool}`
        );

        setPriceData(prices);
        setVolumeData(volumes);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch market data: ' + (err as Error).message);
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedToken]);

  // Chart configurations
  const priceChartConfig = {
    labels: priceData.map((d) => d.x),
    datasets: [
      {
        label: 'Price (USD)',
        data: priceData.map((d) => d.y),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  };

  const volumeChartConfig = {
    labels: volumeData.map((d) => d.x),
    datasets: [
      {
        label: 'Volume (USD)',
        data: volumeData.map((d) => d.y),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: {
        display: true,
        text: selectedToken
          ? `${selectedToken.symbol} Price Chart (7d)`
          : 'Price Chart',
      },
    },
  };

  const volumeChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        display: true,
        text: selectedToken
          ? `${selectedToken.symbol} Volume Chart (7d)`
          : 'Volume Chart',
      },
    },
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-100 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Virtuals Ecosystem Genesis Launches
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading && <div className="text-center">Loading...</div>}

      {!loading && (
        <div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Token
            </label>
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              onChange={(e) => {
                const token =
                  tokens.find((t) => t.id === e.target.value) || null;
                setSelectedToken(token);
              }}
              value={selectedToken?.id ?? ''}
            >
              <option value="">Select a token</option>
              {tokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.symbol} ({token.address})
                </option>
              ))}
            </select>
          </div>

          {selectedToken && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-2">Token Details</h3>
                <p>
                  <strong>Symbol:</strong> {selectedToken.symbol}
                </p>
                <p>
                  <strong>Address:</strong> {selectedToken.address}
                </p>
                <p>
                  <strong>Pool:</strong> {selectedToken.pool}
                </p>
                <p>
                  <strong>Launch Date:</strong>{' '}
                  {new Date(
                    selectedToken.createdAt.toDate()
                  ).toLocaleString()}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-2">Market Stats</h3>
                <p>
                  <strong>Current Price:</strong> $
                  {priceData[priceData.length - 1]?.y.toFixed(4) ?? 'N/A'}
                </p>
                <p>
                  <strong>24h Volume:</strong> $
                  {volumeData[volumeData.length - 1]?.y.toFixed(2) ?? 'N/A'}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow md:col-span-2">
                <Line data={priceChartConfig} options={chartOptions} />
              </div>
              <div className="bg-white p-4 rounded-lg shadow md:col-span-2">
                <Line data={volumeChartConfig} options={volumeChartOptions} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VirtualsTracker;
