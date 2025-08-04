"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBagIcon, MagnifyingGlassIcon, CubeIcon, EyeIcon, CommandLineIcon } from "@heroicons/react/24/solid";

const Footer = () => {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"Connected" | "Disconnected">("Connected");
  const [uptime, setUptime] = useState<string>("0h 0m 0s");

  // Fetch ETH price
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
          cache: "no-store",
        });
        const data = await res.json();
        setEthPrice(data.ethereum.usd);
      } catch (err) {
        console.error("Error fetching ETH price:", err);
        setEthPrice(null);
      }
    };
    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Simulate connection status (replace with real WebSocket/API check if available)
  useEffect(() => {
    const simulateConnection = () => {
      setConnectionStatus(Math.random() > 0.1 ? "Connected" : "Disconnected"); // 90% chance of being connected
    };
    simulateConnection();
    const interval = setInterval(simulateConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Calculate real-time uptime starting from page load (h m s)
  useEffect(() => {
    const startTime = Date.now();
    const calculateUptime = () => {
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setUptime(`${hours}h ${minutes}m ${seconds}s`);
    };
    calculateUptime();
    const interval = setInterval(calculateUptime, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="bg-gradient-to-br from-gray-950 to-gray-900 text-gray-100 py-4 sm:py-6 border-t border-blue-500/30 w-full backdrop-blur-sm relative z-20">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Main Footer Content */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 lg:gap-8">
          {/* Status Section */}
          <motion.div 
            className="flex flex-wrap items-center gap-4 sm:gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-gray-400 text-xs sm:text-sm">Uptime:</span>
              <span className="text-gray-100 text-xs sm:text-sm font-medium">{uptime}</span>
            </motion.div>
            
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-gray-400 text-xs sm:text-sm">Status:</span>
              <span className={`flex items-center gap-1 text-xs sm:text-sm font-medium ${connectionStatus === "Connected" ? "text-green-400" : "text-red-400"}`}>
                <motion.span 
                  className={`w-2 h-2 rounded-full ${connectionStatus === "Connected" ? "bg-green-400" : "bg-red-400"}`}
                  animate={{ scale: connectionStatus === "Connected" ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 2, repeat: connectionStatus === "Connected" ? Infinity : 0 }}
                />
                {connectionStatus}
              </span>
            </motion.div>
            
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-gray-400 text-xs sm:text-sm">ETH Price:</span>
              <span className="text-gray-100 text-xs sm:text-sm font-medium">
                {ethPrice ? `$${ethPrice.toLocaleString()}` : "Loading..."}
              </span>
            </motion.div>
          </motion.div>

          {/* Navigation Links */}
          <motion.div 
            className="flex flex-wrap items-center justify-center gap-3 sm:gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
              <Link href="/token-scanner" className="flex items-center gap-2 group">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-all duration-200">
                  <EyeIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
                </div>
                <span className="text-xs sm:text-sm text-gray-100 group-hover:text-blue-400 transition-colors font-medium">Screener</span>
              </Link>
            </motion.div>
            
            <div className="w-px h-4 sm:h-5 bg-blue-500/30"></div>
            
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
              <Link href="/honeypot-scanner" className="flex items-center gap-2 group">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-all duration-200">
                  <MagnifyingGlassIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
                </div>
                <span className="text-xs sm:text-sm text-gray-100 group-hover:text-blue-400 transition-colors font-medium">Smart Audit</span>
              </Link>
            </motion.div>
            
            <div className="w-px h-4 sm:h-5 bg-blue-500/30"></div>
            
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
              <Link href="/explorer/latest/block" className="flex items-center gap-2 group">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-all duration-200">
                  <CommandLineIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
                </div>
                <span className="text-xs sm:text-sm text-gray-100 group-hover:text-blue-400 transition-colors font-medium">Block Scan</span>
              </Link>
            </motion.div>
            
            <div className="w-px h-4 sm:h-5 bg-blue-500/30"></div>
            
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
              <Link href="/marketplace" className="flex items-center gap-2 group">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-all duration-200">
                  <ShoppingBagIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
                </div>
                <span className="text-xs sm:text-sm text-gray-100 group-hover:text-blue-400 transition-colors font-medium">Marketplace</span>
              </Link>
            </motion.div>
            
            <div className="w-px h-4 sm:h-5 bg-blue-500/30"></div>
            
            <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
              <Link href="/explorer" className="flex items-center gap-2 group">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-all duration-200">
                  <CubeIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
                </div>
                <span className="text-xs sm:text-sm text-gray-100 group-hover:text-blue-400 transition-colors font-medium">Explorer</span>
              </Link>
            </motion.div>
          </motion.div>

          {/* Social Media Links */}
          <motion.div 
            className="flex items-center gap-3 sm:gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <motion.a
              href="https://twitter.com/HomebaseMarkets"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-500/20 flex items-center justify-center hover:bg-blue-500/30 transition-all duration-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-100 hover:text-blue-400 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M22.162 5.656c-.806.358-1.675.599-2.582.709a4.515 4.515 0 001.981-2.481 8.94 8.94 0 01-2.859 1.098 4.515 4.515 0 00-7.692 4.119A12.828 12.828 0 013.437 4.4a4.515 4.515 0 001.401 6.032 4.515 4.515 0 01-2.043-.566v.056a4.515 4.515 0 003.623 4.426 4.515 4.515 0 01-2.037.078 4.515 4.515 0 004.217 3.141 9.03 9.03 0 01-5.607 1.932c-.365 0-.729-.021-1.088-.064a12.794 12.794 0 006.92 2.028c8.302 0 12.838-6.877 12.838-12.837 0-.196-.004-.393-.013-.589a9.14 9.14 0 002.25-2.33z"
                />
              </svg>
            </motion.a>
            
            <motion.a
              href="https://t.me/HomebaseMarkets"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-500/20 flex items-center justify-center hover:bg-blue-500/30 transition-all duration-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-100 hover:text-blue-400 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 3.75L2.25 10.5l7.5 3 2.25 7.5 4.5-6.75 6-4.5-1.5-5.25z"
                />
              </svg>
            </motion.a>
            
            <motion.a
              href="https://discord.gg/homebase"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-500/20 flex items-center justify-center hover:bg-blue-500/30 transition-all duration-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-100 hover:text-blue-400 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                />
              </svg>
            </motion.a>
          </motion.div>
        </div>

        {/* Bottom Section */}
        <motion.div 
          className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-blue-500/20 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-400">Powered by</span>
            <span className="text-xs sm:text-sm text-blue-400">Base</span>
          </div>
          
          {/* Center Section - Version & Links */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">•</span>
              <span>v1.0.0 Beta</span>
              <span className="text-gray-500">•</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Live on</span>
              <span className="text-blue-400">Base</span>
              <span>Network</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-400">
            <Link href="/privacy" className="hover:text-blue-400 transition-colors duration-200">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-blue-400 transition-colors duration-200">
              Terms of Service
            </Link>
            <span>© 2025 CypherX. All rights reserved.</span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;