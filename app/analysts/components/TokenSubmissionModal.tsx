'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function TokenSubmissionModal({ onClose }: { onClose: () => void }) {
  const [tokenName, setTokenName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Replace with API call to submit token
    console.log('Submitted token:', tokenName, description);
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md mx-4"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
      >
        <h2 className="text-xl font-bold mb-4">Submit Your Token</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Token Name"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
            required
          />
          <textarea
            placeholder="Token Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
            required
          />
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="mr-4 p-2 text-gray-600 hover:bg-gray-200 rounded">
              Cancel
            </button>
            <button type="submit" className="p-2 bg-primaryBlue text-white rounded hover:bg-blue-700">
              Submit
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
