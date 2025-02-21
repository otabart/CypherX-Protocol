'use client';

import { motion } from 'framer-motion';

interface CoinPredictionProps {
  prediction: {
    coin: string;
    prediction: string;
    target: string;
    timeframe: string;
  };
}

export default function CoinPredictionCard({ prediction }: CoinPredictionProps) {
  return (
    <motion.div
      className="p-6 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition"
      whileHover={{ scale: 1.05 }}
    >
      <h3 className="text-xl font-bold">{prediction.coin}</h3>
      <p className="text-sm text-gray-600">
        Prediction: {prediction.prediction} – Expected to reach {prediction.target} within {prediction.timeframe}.
      </p>
    </motion.div>
  );
}
