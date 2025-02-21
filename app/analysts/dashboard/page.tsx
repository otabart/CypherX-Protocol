'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function AnalystDashboard() {
  // State for existing calls
  const [calls, setCalls] = useState<any[]>([]);
  // State for new call submission
  const [tokenAddress, setTokenAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Simulated current user (replace with real auth data)
  const currentUser = { name: 'Analyst John' };

  // Fetch calls when component mounts
  useEffect(() => {
    async function fetchCalls() {
      try {
        const res = await fetch('/api/analyst/calls');
        const data = await res.json();
        setCalls(data.calls);
      } catch (error) {
        console.error('Error fetching calls:', error);
      }
    }
    fetchCalls();
  }, []);

  // Handle call submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Fetch current market cap for the token
      const marketRes = await fetch(`/api/marketcap?address=${encodeURIComponent(tokenAddress)}`);
      const marketData = await marketRes.json();
      const currentMarketCap = marketData.marketCap;

      // Build new call object
      const newCall = {
        tokenAddress,
        analyst: currentUser.name,
        callMarketCap: currentMarketCap,
        createdAt: new Date().toISOString(),
      };

      // Post new call to backend
      const res = await fetch('/api/analyst/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCall),
      });
      const data = await res.json();
      if (data.success) {
        // Add new call to the list and clear input
        setCalls((prev) => [...prev, newCall]);
        setTokenAddress('');
      } else {
        alert(data.error || 'Error submitting call.');
      }
    } catch (error) {
      console.error('Error submitting call:', error);
      alert('Error submitting call.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 text-black">
      <Header />

      {/* Page Title */}
      <motion.div
        className="text-center py-6 bg-primaryBlue text-white shadow-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl font-extrabold">Analyst Dashboard</h1>
        <p className="text-lg opacity-90">Post your calls and view current market data.</p>
      </motion.div>

      {/* Call Submission Form */}
      <motion.section
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-2xl font-bold mb-4">Post a New Call</h2>
        <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-white p-6 rounded shadow-md">
          <label htmlFor="tokenAddress" className="block mb-2 font-bold">
            Token Address
          </label>
          <input
            id="tokenAddress"
            type="text"
            placeholder="0x..."
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-primaryBlue text-white rounded hover:bg-blue-700 transition"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Call'}
          </button>
        </form>
      </motion.section>

      {/* Calls List */}
      <motion.section
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-2xl font-bold mb-4">Recent Calls</h2>
        {calls.length > 0 ? (
          <div className="space-y-4">
            {calls.map((call, index) => (
              <div key={index} className="bg-white p-4 rounded shadow-md">
                <p>
                  <span className="font-bold">Token Address:</span> {call.tokenAddress}
                </p>
                <p>
                  <span className="font-bold">Analyst:</span> {call.analyst}
                </p>
                <p>
                  <span className="font-bold">Market Cap at Call:</span> ${call.callMarketCap}
                </p>
                <p className="text-sm text-gray-500">
                  Posted on: {new Date(call.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p>No calls have been posted yet.</p>
        )}
      </motion.section>

      <Footer />
    </div>
  );
}

