'use client';

import { useState } from 'react';
import Header from '../components/Header';
import Sidebar from './components/Sidebar';
import Feed from './components/Feed';
import CategoryMenu from './components/CategoryMenu';

export default function Forum() {
  const [activeCategory, setActiveCategory] = useState('General');

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Header />

      {/* Main Forum Layout */}
      <div className="flex flex-grow container mx-auto py-6 px-4">
        {/* Sidebar */}
        <aside className="hidden md:block w-1/4 bg-white p-4 shadow-md rounded-lg">
          <Sidebar setActiveCategory={setActiveCategory} />
        </aside>

        {/* Main Feed */}
        <section className="w-full md:w-3/4 bg-white p-6 shadow-md rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">💬 Homebase Forum</h1>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
              onClick={() => document.getElementById('create-post')?.scrollIntoView({ behavior: 'smooth' })}
            >
              + Add Topic
            </button>
          </div>
          <Feed activeCategory={activeCategory} />
        </section>
      </div>
    </div>
  );
}

