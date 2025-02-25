"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const Header = () => {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo & Brand */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <Image
              src="https://i.imgur.com/7L1Xsfa.png"
              alt="Homebase Logo"
              width={40}
              height={40}
            />
            <span className="ml-2 text-xl font-bold text-[#0052FF] relative top-1 md:top-0">
              homebase.
            </span>
          </Link>
        </div>

        {/* Enhanced Search Bar (Desktop Only) */}
        <div className="hidden md:block flex-1 mx-8">
          <div className="relative max-w-xl mx-auto">
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-gray-100 text-gray-800 placeholder-gray-500 border border-gray-300 rounded-full pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-[#0052FF] transition"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.15z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link
            href="/"
            className="text-gray-800 hover:text-[#0052FF] transition-colors"
          >
            Home
          </Link>
          <Link
            href="/tools"
            className="text-gray-800 hover:text-[#0052FF] transition-colors"
          >
            Tools
          </Link>
          <Link
            href="/forum"
            className="text-gray-800 hover:text-[#0052FF] transition-colors"
          >
            Forum
          </Link>
          <Link
            href="/analysts"
            className="text-gray-800 hover:text-[#0052FF] transition-colors"
          >
            Analysts
          </Link>
          <Link
            href="/docs"
            className="text-gray-800 hover:text-[#0052FF] transition-colors"
          >
            Docs
          </Link>
          {session ? (
            <Link
              href="/account"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0052FF] text-white hover:bg-blue-600 transition-colors"
            >
              <span>Account</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0052FF] text-white hover:bg-blue-600 transition-colors"
            >
              <span>Sign in</span>
            </Link>
          )}
        </nav>

        {/* Mobile Menu Toggle Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden text-gray-800 text-3xl"
          aria-label="Toggle Menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Navigation Menu (Sliding Sidebar) */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 shadow-lg transform transition-transform duration-300 ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Updated Close Button */}
        <button
          onClick={() => setIsMenuOpen(false)}
          className="absolute top-4 right-4 text-gray-800 bg-gray-100 rounded-full p-1 hover:bg-gray-200 transition"
          aria-label="Close Menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <nav className="flex flex-col gap-4 p-4 mt-12">
          <Link
            href="/"
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-800 hover:text-[#0052FF] transition-colors"
          >
            Home
          </Link>
          <Link
            href="/tools"
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-800 hover:text-[#0052FF] transition-colors"
          >
            Tools
          </Link>
          <Link
            href="/forum"
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-800 hover:text-[#0052FF] transition-colors"
          >
            Forum
          </Link>
          <Link
            href="/analysts"
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-800 hover:text-[#0052FF] transition-colors"
          >
            Analysts
          </Link>
          <Link
            href="/docs"
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-800 hover:text-[#0052FF] transition-colors"
          >
            Docs
          </Link>
          {session ? (
            <Link
              href="/account"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0052FF] text-white hover:bg-blue-600 transition-colors"
            >
              <span>Account</span>
            </Link>
          ) : (
            <Link
              href="/login"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0052FF] text-white hover:bg-blue-600 transition-colors"
            >
              <span>Sign in</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;













