'use client';

import Link from 'next/link';

export default function AnalystHeader() {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center space-x-6">
        {/* Branding or Title */}
        <div className="text-xl font-bold text-primaryBlue">Analysts Portal</div>

        {/* Navigation Links */}
        <nav className="flex space-x-4">
          {/* Landing (analysts/page.tsx) */}
          <Link href="/analysts">
            <span className="text-gray-700 hover:text-primaryBlue cursor-pointer">
              Home
            </span>
          </Link>
          {/* Dashboard (analysts/dashboard/page.tsx) */}
          <Link href="/analysts/dashboard">
            <span className="text-gray-700 hover:text-primaryBlue cursor-pointer">
              Dashboard
            </span>
          </Link>
          {/* Calls (analysts/calls/page.tsx) */}
          <Link href="/analysts/calls">
            <span className="text-gray-700 hover:text-primaryBlue cursor-pointer">
              Calls
            </span>
          </Link>
          {/* Predictions (analysts/predictions/page.tsx) */}
          <Link href="/analysts/predictions">
            <span className="text-gray-700 hover:text-primaryBlue cursor-pointer">
              Predictions
            </span>
          </Link>
          {/* Submit (analysts/submit/page.tsx) */}
          <Link href="/analysts/submit">
            <span className="text-gray-700 hover:text-primaryBlue cursor-pointer">
              Submit
            </span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
