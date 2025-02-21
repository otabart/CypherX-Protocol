'use client';

import { motion } from 'framer-motion';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import AnalystsCallTracker from '../components/AnalystsCallTracker';

export default function CallsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 text-black">
      <Header />
      <div className="text-center py-6 bg-primaryBlue text-white shadow-md">
        <h1 className="text-4xl font-extrabold">Analyst Calls</h1>
        <p className="text-lg opacity-90">Review and track your analyst calls.</p>
      </div>

      <motion.main
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <AnalystsCallTracker />
      </motion.main>

      <Footer />
    </div>
  );
}
