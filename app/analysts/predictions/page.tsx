'use client';

import { motion } from 'framer-motion';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import CoinPredictionCard from '../../components/CoinPredictionCard';

export default function PredictionsPage() {
  // Example predictions array (replace with real data if available)
  const predictions = [
    { coin: '$TOSHI', prediction: 'Bullish', target: '$0.02', timeframe: '3 months' },
    { coin: '$SKIDOG', prediction: 'Bearish', target: '$0.001', timeframe: '2 months' },
    // Add more predictions as needed...
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 text-black">
      <Header />
      <div className="text-center py-6 bg-primaryBlue text-white shadow-md">
        <h1 className="text-4xl font-extrabold">Coin Predictions</h1>
        <p className="text-lg opacity-90">See our analysts' latest predictions on trending coins.</p>
      </div>

      <motion.main
        className="container mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {predictions.map((p, i) => (
          <CoinPredictionCard key={i} prediction={p} />
        ))}
      </motion.main>

      <Footer />
    </div>
  );
}


