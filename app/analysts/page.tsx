'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';

// Sample data for sections
const predictions = [
  {
    coin: '$TOSHI',
    prediction: 'Bullish',
    target: '$0.02',
    timeframe: '3 months',
    analyst: { name: 'Analyst John', avatar: '/avatars/john.png' },
  },
  {
    coin: '$SKIDOG',
    prediction: 'Bearish',
    target: '$0.001',
    timeframe: '2 months',
    analyst: { name: 'Analyst Jane', avatar: '/avatars/jane.png' },
  },
  {
    coin: '$TOSHI',
    prediction: 'Neutral',
    target: '$0.015',
    timeframe: '1 month',
    analyst: { name: 'Analyst John', avatar: '/avatars/john.png' },
  },
];

const toolsOverview = [
  {
    title: 'Advanced Analytics',
    description:
      'Gain detailed insights into market trends with our state-of-the-art analytics tools.',
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primaryBlue mx-auto mb-2"
      >
        <polyline points="3 17 9 11 13 15 21 7" />
      </svg>
    ),
  },
  {
    title: 'Real-Time Data',
    description:
      'Stay updated with live market data and real-time transaction insights.',
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primaryBlue mx-auto mb-2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    title: 'Trusted Analysts',
    description:
      'Our analysts are industry veterans providing reliable market predictions.',
    icon: (
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primaryBlue mx-auto mb-2"
      >
        <circle cx="12" cy="7" r="4" />
        <path d="M5.5 21a8.38 8.38 0 0113 0" />
      </svg>
    ),
  },
];

// Group predictions by analyst name
const groupPredictionsByAnalyst = (preds) => {
  const groups: { [key: string]: any[] } = {};
  preds.forEach((p) => {
    const key = p.analyst.name;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  return groups;
};
const groupedPredictions = groupPredictionsByAnalyst(predictions);

// Sample trusted analysts data
const trustedAnalysts = [
  { name: 'Analyst John', avatar: '/avatars/john.png', bio: 'Expert in meme coins and market trends.' },
  { name: 'Analyst Jane', avatar: '/avatars/jane.png', bio: 'Focus on DeFi and blockchain innovation.' },
  { name: 'Analyst Mike', avatar: '/avatars/mike.png', bio: 'Veteran analyst with over 10 years in finance.' },
];

/* --------------------------------------------------------------------------
   Analysts Dashboard Page Component
   -------------------------------------------------------------------------- */
export default function AnalystsDashboard() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 text-black">
      <Header />

      {/* Hero Section */}
      <motion.section
        className="text-center py-12 bg-primaryBlue text-white"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl font-extrabold">Analyst Insights & Dashboard</h1>
        <p className="mt-4 text-lg max-w-2xl mx-auto">
          Our trusted analysts deliver real-time market predictions and in-depth analysis.
        </p>
      </motion.section>

      {/* Navigation Bar for Dashboard Sections */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-center space-x-8">
          <a href="#tools" className="text-lg font-semibold text-gray-700 hover:text-primaryBlue cursor-pointer">
            Tools & Analysts
          </a>
          <a href="#predictions" className="text-lg font-semibold text-gray-700 hover:text-primaryBlue cursor-pointer">
            Predictions
          </a>
          <a href="#trusted" className="text-lg font-semibold text-gray-700 hover:text-primaryBlue cursor-pointer">
            Trusted Analysts
          </a>
          <a href="#why" className="text-lg font-semibold text-gray-700 hover:text-primaryBlue cursor-pointer">
            Why Choose Us
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow">
        {/* Tools Overview Section */}
        <motion.section
          id="tools"
          className="container mx-auto px-4 py-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-primaryBlue text-center mb-6">
            Our Tools & Analysts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {toolsOverview.map((tool, index) => (
              <motion.div key={index} whileHover={{ scale: 1.05 }} className="bg-white p-6 rounded-lg shadow-md text-center">
                {tool.icon}
                <h3 className="text-xl font-bold text-primaryBlue mb-2">{tool.title}</h3>
                <p className="text-gray-600">{tool.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Analyst Predictions Section */}
        <motion.section
          id="predictions"
          className="container mx-auto px-4 py-8 bg-white"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-primaryBlue text-center mb-6">Analyst Predictions</h2>
          <div className="space-y-8">
            {Object.entries(groupedPredictions).map(([analystName, preds]) => (
              <motion.div key={analystName} className="p-4 border rounded-lg shadow-md" whileHover={{ scale: 1.02 }}>
                <div className="flex items-center mb-4">
                  <img src={preds[0].analyst.avatar} alt={analystName} className="w-12 h-12 rounded-full object-cover mr-4" />
                  <h3 className="text-2xl font-bold text-primaryBlue">{analystName}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {preds.map((p, index) => (
                    <motion.div key={index} className="p-4 bg-gray-50 rounded shadow-sm">
                      <p className="font-bold">{p.coin}</p>
                      <p className="text-sm text-gray-600">
                        Prediction: {p.prediction} – Target: {p.target} in {p.timeframe}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Trusted Analysts Section */}
        <motion.section
          id="trusted"
          className="container mx-auto px-4 py-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-primaryBlue text-center mb-6">Trusted Analysts</h2>
          <div className="flex flex-wrap justify-center gap-6">
            {trustedAnalysts.map((analyst, i) => (
              <motion.div key={i} whileHover={{ scale: 1.05 }} className="bg-white p-4 rounded-lg shadow-md text-center max-w-xs">
                <img src={analyst.avatar} alt={analyst.name} className="w-20 h-20 rounded-full object-cover mx-auto mb-4" />
                <h3 className="text-xl font-bold text-primaryBlue">{analyst.name}</h3>
                <p className="text-gray-600 text-sm">{analyst.bio}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Additional Information Section */}
        <motion.section
          id="why"
          className="container mx-auto px-4 py-8 bg-gray-50 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-primaryBlue mb-4">Why Choose Our Platform?</h2>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
            We combine state-of-the-art analytics tools, live market data, and a team of trusted analysts to provide you with actionable insights and reliable predictions.
            Whether you're a trader, investor, or developer, our platform offers the clarity and tools you need to succeed in the fast-moving crypto market.
          </p>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}

