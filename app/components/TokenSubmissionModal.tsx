'use client';

import { useState } from 'react';

const TokenSubmissionModal = ({ onClose }: { onClose: () => void }) => {
  const [tokenName, setTokenName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500">✖</button>
        <h2 className="text-xl font-bold mb-4">Submit a Token</h2>
        <input type="text" placeholder="Token Name" value={tokenName} className="w-full mb-3 p-2 border rounded-md" />
        <input type="text" placeholder="Ticker" value={ticker} className="w-full mb-3 p-2 border rounded-md" />
        <textarea placeholder="Description" value={description} className="w-full mb-3 p-2 border rounded-md" />
        <button className="w-full bg-primaryBlue text-white py-2 rounded-md">Submit</button>
      </div>
    </div>
  );
};

export default TokenSubmissionModal;



