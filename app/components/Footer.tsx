"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBagIcon, MagnifyingGlassIcon, CubeIcon, EyeIcon, CommandLineIcon, UsersIcon } from "@heroicons/react/24/solid";

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
    <footer className="bg-gray-950 text-gray-100 py-3 border-t border-blue-500/30 w-full">
      <div className="container mx-auto flex flex-wrap justify-between items-center px-4 gap-4">
        {/* Status Section */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-xs">Uptime:</span>
            <span className="text-gray-100 text-xs">{uptime}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-xs">Status:</span>
            <span className={`flex items-center gap-1 text-xs ${connectionStatus === "Connected" ? "text-green-500" : "text-red-500"}`}>
              <span className={`w-2 h-2 rounded-full ${connectionStatus === "Connected" ? "bg-green-500" : "bg-red-500"}`}></span>
              {connectionStatus}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-xs">ETH Price:</span>
            <span className="text-gray-100 text-xs">{ethPrice ? `$${ethPrice.toLocaleString()}` : "Loading..."}</span>
          </div>
        </div>

        {/* Navigation Menus */}
        <div className="flex items-center gap-3">
          <Link href="/token-scanner" className="flex items-center gap-1 group">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <EyeIcon className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
            </div>
            <span className="text-sm text-gray-100 group-hover:text-blue-400 transition-colors">Screener</span>
          </Link>
          <div className="border-r border-blue-500/30 h-2"></div> {/* Thinner separator, matching theme */}
          <Link href="/smart-money" className="flex items-center gap-1 group">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <UsersIcon className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
            </div>
            <span className="text-sm text-gray-100 group-hover:text-blue-400 transition-colors">Smart Money</span>
          </Link>
          <div className="border-r border-blue-500/30 h-2"></div> {/* Thinner separator, matching theme */}
          <Link href="/honeypot-scanner" className="flex items-center gap-1 group">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
            </div>
            <span className="text-sm text-gray-100 group-hover:text-blue-400 transition-colors">Smart Audit</span>
          </Link>
          <div className="border-r border-blue-500/30 h-2"></div> {/* Thinner separator, matching theme */}
          <Link href="/explorer/latest/block" className="flex items-center gap-1 group">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <CommandLineIcon className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
            </div>
            <span className="text-sm text-gray-100 group-hover:text-blue-400 transition-colors">Block Scan</span>
          </Link>
          <div className="border-r border-blue-500/30 h-2"></div> {/* Thinner separator, matching theme */}
          <Link href="/marketplace" className="flex items-center gap-1 group">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <ShoppingBagIcon className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
            </div>
            <span className="text-sm text-gray-100 group-hover:text-blue-400 transition-colors">Marketplace</span>
          </Link>
          <div className="border-r border-blue-500/30 h-2"></div> {/* Thinner separator, matching theme */}
          <Link href="/explorer" className="flex items-center gap-1 group">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <CubeIcon className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
            </div>
            <span className="text-sm text-gray-100 group-hover:text-blue-400 transition-colors">Explorer</span>
          </Link>
        </div>

        {/* Social Media Links */}
        <div className="flex items-center gap-3">
          <a
            href="https://twitter.com/HomebaseMarkets"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-gray-100 hover:text-blue-400 transition-colors"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M22.162 5.656c-.806.358-1.675.599-2.582.709a4.515 4.515 0 001.981-2.481 8.94 8.94 0 01-2.859 1.098 4.515 4.515 0 00-7.692 4.119A12.828 12.828 0 013.437 4.4a4.515 4.515 0 001.401 6.032 4.515 4.515 0 01-2.043-.566v.056a4.515 4.515 0 003.623 4.426 4.515 4.515 0 01-2.037.078 4.515 4.515 0 004.217 3.141 9.03 9.03 0 01-5.607 1.932c-.365 0-.729-.021-1.088-.064a12.794 12.794 0 006.92 2.028c8.302 0 12.838-6.877 12.838-12.837 0-.196-.004-.393-.013-.589a9.14 9.14 0 002.25-2.33z"
              />
            </svg>
          </a>
          <a
            href="https://t.me/HomebaseMarkets"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-gray-100 hover:text-blue-400 transition-colors"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 3.75L2.25 10.5l7.5 3 2.25 7.5 4.5-6.75 6-4.5-1.5-5.25z"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Responsive Styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .container {
            flex-direction: column;
            gap: 8px;
            text-align: center;
          }
          .flex-wrap {
            gap: 8px;
            justify-content: center;
          }
          .flex.items-center.gap-3 {
            justify-content: center;
            flex-wrap: wrap;
            gap: 8px;
          }
          .flex.items-center.gap-4 {
            justify-content: center;
            flex-wrap: wrap;
          }
          .border-r {
            display: none;
          }
        }
        @media (max-width: 480px) {
          .text-xs {
            font-size: 10px;
          }
          .text-sm {
            font-size: 12px;
          }
          .w-5.h-5 {
            width: 16px;
            height: 16px;
          }
          .w-6.h-6 {
            width: 20px;
            height: 20px;
          }
          .w-4.h-4 {
            width: 12px;
            height: 12px;
          }
          .w-2.h-2 {
            width: 8px;
            height: 8px;
          }
        }
      `}</style>
    </footer>
  );
};

export default Footer;