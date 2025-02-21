"use client";

import { useState } from "react";
import Link from "next/link";
import LoginModal from "./LoginModal";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <header className="w-full bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <img
              src="https://i.imgur.com/7L1Xsfa.png" // Replace with your direct Imgur URL
              alt="Homebase Logo"
              className="w-10 h-10 sm:w-12 sm:h-12"
            />
            <span className="ml-3 text-xl sm:text-2xl font-bold text-primaryBlue">
              Homebase
            </span>
          </Link>
        </div>

        {/* Hamburger Menu for Mobile */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="text-primaryBlue text-3xl md:hidden"
          aria-label="Toggle Menu"
        >
          {isMenuOpen ? "✖" : "☰"}
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-6 items-center">
          <Link href="/" className="text-black hover:text-primaryBlue">
            Home
          </Link>
          <Link href="/tools" className="text-black hover:text-primaryBlue">
            Tools
          </Link>
          <Link href="/forum" className="text-black hover:text-primaryBlue">
            Forum
          </Link>
          <Link href="/analysts" className="text-black hover:text-primaryBlue">
            Analysts
          </Link>
          <Link href="/docs" className="text-black hover:text-primaryBlue">
            Docs
          </Link>
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="px-5 py-2 bg-primaryBlue text-white text-sm sm:text-base rounded-md hover:bg-blue-700 transition-all"
          >
            Login
          </button>
        </nav>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white shadow-lg absolute top-full left-0 w-full">
          <nav className="flex flex-col gap-4 p-4">
            <Link
              href="/"
              className="text-black hover:text-primaryBlue"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/tools"
              className="text-black hover:text-primaryBlue"
              onClick={() => setIsMenuOpen(false)}
            >
              Tools
            </Link>
            <Link
              href="/forum"
              className="text-black hover:text-primaryBlue"
              onClick={() => setIsMenuOpen(false)}
            >
              Forum
            </Link>
            <Link
              href="/analysts"
              className="text-black hover:text-primaryBlue"
              onClick={() => setIsMenuOpen(false)}
            >
              Analysts
            </Link>
            <Link
              href="/docs"
              className="text-black hover:text-primaryBlue"
              onClick={() => setIsMenuOpen(false)}
            >
              Docs
            </Link>
            <button
              onClick={() => {
                setIsLoginModalOpen(true);
                setIsMenuOpen(false);
              }}
              className="px-4 py-2 bg-primaryBlue text-white rounded-md hover:bg-blue-700 transition-all"
            >
              Login
            </button>
          </nav>
        </div>
      )}

      {/* Login Modal */}
      {isLoginModalOpen && <LoginModal onClose={() => setIsLoginModalOpen(false)} />}
    </header>
  );
};

export default Header;























