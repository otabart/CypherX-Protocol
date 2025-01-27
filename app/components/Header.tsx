'use client';

import { useState } from 'react';
import Link from 'next/link';
import LoginModal from './LoginModal';

const Header = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <header className="w-full bg-white shadow-md">
      <div className="container mx-auto flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            className="w-10 h-10"
          >
            <circle cx="50" cy="50" r="48" fill="#0052FF" />
            <polygon
              points="50,25 70,45 70,70 30,70 30,45"
              fill="white"
              stroke="white"
              strokeWidth="2"
            />
            <rect x="45" y="55" width="10" height="15" fill="#0052FF" />
          </svg>
          <Link href="/" className="text-2xl font-bold text-primaryBlue">
            Homebase
          </Link>
        </div>

        <nav className="flex gap-4">
          <Link href="/" className="text-black hover:text-primaryBlue">
            Home
          </Link>
          <Link href="/analytics" className="text-black hover:text-primaryBlue">
            Analytics
          </Link>
          <Link href="/forum" className="text-black hover:text-primaryBlue">
            Forum
          </Link>
          <Link href="/about" className="text-black hover:text-primaryBlue">
            About
          </Link>
          <Link href="/dashboard" className="text-black hover:text-primaryBlue">
  Dashboard
</Link>
<Link href="/docs" className="text-black hover:text-primaryBlue">
  Docs
</Link>
        </nav>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-2 bg-primaryBlue text-white rounded-md hover:bg-blue-700 transition-all"
        >
          Login
        </button>

        {isModalOpen && <LoginModal onClose={() => setIsModalOpen(false)} />}
      </div>
    </header>
  );
};

export default Header;










