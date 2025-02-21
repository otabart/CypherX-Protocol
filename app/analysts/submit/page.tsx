'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function SubmitTokenPage() {
  const [tokenName, setTokenName] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Replace with an API call to submit the token for analysis
    console.log('Submitted token:', tokenName, description);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 text-black">
      <Header />
      <div className="text-center py-6 bg-primaryBlue text-white shadow-md">
        <h1 className="text-4xl font-extrabold">Submit Your Token</h1>
        <p className="text-lg opacity-90">Get your project reviewed by our analysts.</p>
      </div>

      <motion.main
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {!submitted ? (
          <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-white p-6 rounded shadow-md">
            <label className="block mb-2 font-bold">Token Name</label>
            <input
              type="text"
              className="w-full p-2 mb-4 border rounded"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              required
            />

            <label className="block mb-2 font-bold">Description</label>
            <textarea
              className="w-full p-2 mb-4 border rounded"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />

            <button
              type="submit"
              className="px-4 py-2 bg-primaryBlue text-white rounded hover:bg-blue-700"
            >
              Submit
            </button>
          </form>
        ) : (
          <div className="max-w-md mx-auto bg-white p-6 rounded shadow-md text-center">
            <h2 className="text-2xl font-bold text-primaryBlue mb-4">Thank You!</h2>
            <p>Your token has been submitted for analysis. Our team will review it shortly.</p>
          </div>
        )}
      </motion.main>

      <Footer />
    </div>
  );
}

