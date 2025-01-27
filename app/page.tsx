'use client';

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
import { motion } from 'framer-motion';
import Header from './components/Header';
import Footer from './components/Footer';

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

export default function Home() {
  // Dummy Data for Transaction Trends Chart
  const transactionData = {
    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
    datasets: [
      {
        label: 'Transactions',
        data: [200, 250, 300, 400, 350, 500, 450],
        borderColor: '#0052FF',
        backgroundColor: 'rgba(0, 82, 255, 0.3)',
        fill: true,
      },
    ],
  };

  // Dummy Data for Gas Usage Trends Chart
  const gasUsageData = {
    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
    datasets: [
      {
        label: 'Gas Usage (Gwei)',
        data: [50, 70, 65, 80, 75, 90, 85],
        borderColor: '#FF5722',
        backgroundColor: 'rgba(255, 87, 34, 0.3)',
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
      },
    },
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-black">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <header className="text-center py-12 bg-gradient-to-r from-primaryBlue to-blue-500 text-white">
        <h1 className="text-4xl font-extrabold mb-2">Welcome to Homebase</h1>
        <p>Your one-stop platform for Base chain analytics and insights.</p>
      </header>

      {/* Stats Section */}
      <main className="flex-grow container mx-auto py-12 px-4">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="p-4 bg-white/70 backdrop-blur-md shadow-lg rounded-lg"
          >
            <h2 className="text-2xl font-bold text-primaryBlue">24-Hour Volume</h2>
            <p className="text-xl font-semibold">$12,345,678</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="p-4 bg-white/70 backdrop-blur-md shadow-lg rounded-lg"
          >
            <h2 className="text-2xl font-bold text-primaryBlue">Total Transactions</h2>
            <p className="text-xl font-semibold">1,234,567</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="p-4 bg-white/70 backdrop-blur-md shadow-lg rounded-lg"
          >
            <h2 className="text-2xl font-bold text-primaryBlue">Active Users</h2>
            <p className="text-xl font-semibold">56,789</p>
          </motion.div>
        </section>

        {/* Call-to-Action Section */}
        <section className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to explore Base chain analytics?</h2>
          <button className="px-6 py-2 bg-primaryBlue text-white rounded-md shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all transform hover:scale-105">
            Get Started Now
          </button>
        </section>

        {/* Graphs Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="container mx-auto py-12"
        >
          <h2 className="text-3xl font-extrabold mb-6 text-center">Analytics Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Transaction Trends Chart */}
            <div className="p-4 shadow-md border rounded-lg">
              <h3 className="text-xl font-bold text-primaryBlue text-center mb-4">Transaction Trends</h3>
              <Line data={transactionData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: '7-Day Transaction Trends', display: true } } }} />
            </div>

            {/* Gas Usage Trends Chart */}
            <div className="p-4 shadow-md border rounded-lg">
              <h3 className="text-xl font-bold text-orange-600 text-center mb-4">Gas Usage Trends</h3>
              <Line data={gasUsageData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { text: '7-Day Gas Usage Trends', display: true } } }} />
            </div>
          </div>
        </motion.section>

        {/* News/Updates Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="container mx-auto py-12"
        >
          <h2 className="text-3xl font-extrabold mb-6 text-center">Latest News</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* News Item 1 */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="p-4 shadow-md border rounded-lg bg-white/70 backdrop-blur-md"
            >
              <h3 className="text-xl font-bold text-primaryBlue">Base Chain Upgrade Announced</h3>
              <p className="text-sm mt-2">
                The Base chain team has announced a major upgrade to improve transaction speeds.
              </p>
              <a
                href="#"
                className="text-primaryBlue mt-4 inline-block hover:underline"
              >
                Read more
              </a>
            </motion.div>

            {/* News Item 2 */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="p-4 shadow-md border rounded-lg bg-white/70 backdrop-blur-md"
            >
              <h3 className="text-xl font-bold text-primaryBlue">New dApps Launched</h3>
              <p className="text-sm mt-2">
                Several new decentralized applications (dApps) are now live on the Base chain.
              </p>
              <a
                href="#"
                className="text-primaryBlue mt-4 inline-block hover:underline"
              >
                Read more
              </a>
            </motion.div>

            {/* News Item 3 */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="p-4 shadow-md border rounded-lg bg-white/70 backdrop-blur-md"
            >
              <h3 className="text-xl font-bold text-primaryBlue">Record Transaction Volume</h3>
              <p className="text-sm mt-2">
                The Base chain hit a record transaction volume of 1.2 million in 24 hours.
              </p>
              <a
                href="#"
                className="text-primaryBlue mt-4 inline-block hover:underline"
              >
                Read more
              </a>
            </motion.div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
















