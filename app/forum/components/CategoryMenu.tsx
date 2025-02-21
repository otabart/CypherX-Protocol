'use client';

import { useState } from 'react';
import { FiMenu } from 'react-icons/fi';

export default function CategoryMenu({ setActiveCategory }: { setActiveCategory: (category: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const categories = ['General', 'Coins', 'Launch Updates', 'Community'];

  return (
    <div className="bg-primaryBlue text-white p-4 flex justify-between items-center">
      <h2 className="text-lg font-bold">Categories</h2>
      <button onClick={() => setIsOpen(!isOpen)} className="text-white">
        <FiMenu size={24} />
      </button>
      {isOpen && (
        <div className="absolute top-16 left-0 w-full bg-white shadow-lg p-4 z-50">
          <ul className="space-y-2">
            {categories.map((category) => (
              <li key={category}>
                <button
                  onClick={() => {
                    setActiveCategory(category);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 rounded-md hover:bg-gray-200 transition-all"
                >
                  {category}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
