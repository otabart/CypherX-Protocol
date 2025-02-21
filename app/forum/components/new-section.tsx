'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewSection() {
  const [sectionName, setSectionName] = useState('');
  const router = useRouter();

  const handleCreateSection = async () => {
    if (!sectionName.trim()) return;

    const res = await fetch('/api/forum/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sectionName }),
    });

    if (res.ok) {
      router.push('/forum'); // Redirect to the forum page after creation
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Create a New Section</h1>
      <input
        type="text"
        placeholder="Enter section name"
        value={sectionName}
        onChange={(e) => setSectionName(e.target.value)}
        className="border p-2 rounded-md w-full max-w-md"
      />
      <button
        onClick={handleCreateSection}
        className="bg-blue-600 text-white px-4 py-2 mt-4 rounded-md hover:bg-blue-700"
      >
        Create Section
      </button>
    </div>
  );
}
