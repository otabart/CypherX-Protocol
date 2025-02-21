'use client';

import { useState } from 'react';

const TokenSubmissionForm = ({ setSubmittedTokens }: { setSubmittedTokens: Function }) => {
  const [formData, setFormData] = useState({ name: '', description: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmittedTokens((prev: any) => [...prev, { ...formData, status: 'Pending' }]);
    setFormData({ name: '', description: '' });
  };

  return (
    <div className="mt-6 p-6 border rounded-lg shadow-md bg-gray-50">
      <h3 className="text-xl font-bold text-primaryBlue mb-4">Submit a Token for Review</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Token Name (e.g. $COIN)"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-primaryBlue"
        />
        <textarea
          placeholder="Brief Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-primaryBlue"
        />
        <button type="submit" className="px-6 py-2 bg-primaryBlue text-white rounded-md hover:bg-blue-700">
          Submit Token
        </button>
      </form>
    </div>
  );
};

export default TokenSubmissionForm;
