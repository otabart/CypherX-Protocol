'use client';

import { useState } from 'react';
import Link from 'next/link';

// Sections data
const sections = [
  { id: 'launch', title: 'When Do We Launch?' },
  { id: 'past-news', title: 'Past News' },
  { id: 'company-updates', title: 'Company Updates' },
];

// Content data for sections and quick links
const contentData = {
  launch: {
    title: 'When Do We Launch?',
    content: `
      We are officially launching on February 14th on Clank.fun. This platform was chosen for two key reasons: 
      the vibrant culture it has fostered within the Base community and the transaction rewards it offers. 
      These rewards enable us to reinvest directly into the project through ads, Dex boosts, and various 
      Telegram trending channels.

      More details about the official launch will be shared in the coming weeks. Stay tuned, and don’t forget 
      to join our Telegram community to stay updated and connect with fellow supporters!
    `,
  },
  'past-news': {
    title: 'Past News',
    content: 'Here you can find past articles and news about Homebase’s journey.',
  },
  'company-updates': {
    title: 'Company Updates',
    content:
      'Get the latest updates about Homebase, including team announcements, feature releases, and partnerships.',
  },
  'getting-started': {
    title: 'Getting Started',
    content: `
      Welcome to Homebase! Here's how to get started:
      1. Sign up for an account.
      2. Explore our analytics dashboard.
      3. Join our Telegram for updates and support.

      Need help? Contact our support team at support@homebase.com.
    `,
  },
  'api-docs': {
    title: 'API Documentation',
    content: `
      Our API provides access to transaction data, analytics, and more. 
      Endpoints include:
      - /api/transactions: Get transaction history.
      - /api/wallets: Fetch wallet statistics.

      For detailed API usage, refer to the developer documentation.
    `,
  },
  faqs: {
    title: 'Frequently Asked Questions',
    content: `
      **Q: What is Homebase?**
      A: Homebase is a platform for Base chain analytics and insights.

      **Q: How do I get started?**
      A: Create an account, and start exploring our tools.

      **Q: Is there a mobile app?**
      A: Not yet, but it's coming soon!
    `,
  },
};

export default function Docs() {
  const [activeSection, setActiveSection] = useState('launch');

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header Section */}
      <header className="bg-primaryBlue text-white px-6 py-4">
        <h1 className="text-2xl font-bold">Homebase Documentation</h1>
        <p className="mt-1 text-sm">
          Find all the information, updates, and guides about the Homebase platform here.
        </p>
      </header>

      <div className="flex flex-grow">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-100 border-r p-4 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold mb-4">Docs</h2>
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-primaryBlue mb-6"
            />
            <ul className="space-y-4">
              {sections.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-4 py-2 rounded-md ${
                      activeSection === section.id
                        ? 'bg-primaryBlue text-white'
                        : 'hover:bg-gray-200 text-black'
                    }`}
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ul>

            {/* Quick Links */}
            <div className="mt-8 border-t pt-4">
              <h3 className="text-lg font-bold mb-2">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => setActiveSection('getting-started')}
                    className={`w-full text-left px-4 py-2 rounded-md ${
                      activeSection === 'getting-started'
                        ? 'bg-primaryBlue text-white'
                        : 'hover:bg-gray-200 text-black'
                    }`}
                  >
                    Getting Started
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveSection('api-docs')}
                    className={`w-full text-left px-4 py-2 rounded-md ${
                      activeSection === 'api-docs'
                        ? 'bg-primaryBlue text-white'
                        : 'hover:bg-gray-200 text-black'
                    }`}
                  >
                    API Documentation
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveSection('faqs')}
                    className={`w-full text-left px-4 py-2 rounded-md ${
                      activeSection === 'faqs'
                        ? 'bg-primaryBlue text-white'
                        : 'hover:bg-gray-200 text-black'
                    }`}
                  >
                    Frequently Asked Questions
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Back to Home Button */}
          <Link
            href="/"
            className="mt-6 block text-center px-4 py-2 bg-primaryBlue text-white rounded-md hover:bg-blue-700 transition-all"
          >
            Back to Home
          </Link>
        </aside>

        {/* Main Content */}
        <div className="flex-grow p-6">
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500 mb-4">
            <span className="hover:text-primaryBlue cursor-pointer">Docs Home</span> /{' '}
            <span className="font-semibold text-black">{contentData[activeSection].title}</span>
          </nav>

          {/* Main Section */}
          <div className="p-6 border rounded-lg shadow-md bg-gray-50">
            <h2 className="text-2xl font-bold text-primaryBlue mb-4">
              {contentData[activeSection].title}
            </h2>
            <p className="text-lg text-gray-700 whitespace-pre-line">
              {contentData[activeSection].content}
            </p>
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="w-64 bg-gray-50 border-l p-4 hidden lg:block">
          <h3 className="text-lg font-bold mb-4">Docs Info</h3>
          <p className="text-sm text-gray-700 mb-4">
            <span className="font-bold">Last Edit:</span> January 27, 2025
          </p>
          <a
            href="#"
            className="text-primaryBlue text-sm hover:underline"
            target="_blank"
          >
            Submit an Issue
          </a>
        </aside>
      </div>
    </div>
  );
}







