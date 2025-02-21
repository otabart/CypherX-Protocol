'use client';

import { motion } from 'framer-motion';

export default function AnalystCallTracker() {
  // Placeholder call data
  const calls = [
    { id: 1, coin: '$TOSHI', call: 'Bullish', details: 'Expected to reach target within 3 months.' },
    { id: 2, coin: '$SKIDOG', call: 'Bearish', details: 'Liquidity issues may persist.' },
  ];

  return (
    <motion.div
      className="p-6 bg-white rounded-lg shadow-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-3xl font-bold text-primaryBlue mb-4">My Calls</h2>
      {calls.map(call => (
        <div key={call.id} className="mb-4 p-4 border rounded hover:shadow-md transition">
          <h3 className="text-xl font-bold">{call.coin} - {call.call}</h3>
          <p className="text-gray-700">{call.details}</p>
        </div>
      ))}
    </motion.div>
  );
}
