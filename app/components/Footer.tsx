"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const Footer = () => {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"Connected" | "Disconnected">("Connected");
  const [uptime, setUptime] = useState<string>("0h 0m 0s");

  // Fetch ETH and BTC prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Fetch ETH price from CoinGecko
        const ethRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
          cache: "no-store",
        });
        const ethData = await ethRes.json();
        setEthPrice(ethData.ethereum.usd);

        // Fetch Bitcoin price from DEX Screener
        const btcRes = await fetch("https://api.dexscreener.com/latest/dex/tokens/0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", {
          cache: "no-store",
        });
        const btcData = await btcRes.json();
        if (btcData.pairs && btcData.pairs[0]) {
          setBtcPrice(parseFloat(btcData.pairs[0].priceUsd));
        }
      } catch (err) {
        console.error("Error fetching prices:", err);
        setEthPrice(null);
        setBtcPrice(null);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Simulate connection status
  useEffect(() => {
    const simulateConnection = () => {
      setConnectionStatus(Math.random() > 0.1 ? "Connected" : "Disconnected");
    };
    simulateConnection();
    const interval = setInterval(simulateConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate real-time uptime
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
    const interval = setInterval(calculateUptime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="bg-gray-950 border-t border-gray-800 text-gray-300 text-xs py-2 px-4">
      <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
        {/* Left Section - Status & Info */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 w-full sm:w-auto">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">Uptime:</span>
            <span className="text-gray-300">{uptime}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === "Connected" ? "bg-green-400" : "bg-red-400"}`} />
            <span className={connectionStatus === "Connected" ? "text-green-400" : "text-red-400"}>
              {connectionStatus}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            <span className="text-gray-300">
              {ethPrice ? `$${ethPrice.toLocaleString()}` : "Loading..."}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.118 8.738 14.548l-3.18-.844c.637-2.406-.443-4.912-2.42-6.13-1.97-1.21-4.496-.49-5.89 1.168-1.39 1.65-1.547 4.016-.39 5.86 1.16 1.843 3.376 2.88 5.67 2.88.275 0 .55-.027.825-.08l.844 3.18z"/>
            </svg>
            <span className="text-gray-300">
              {btcPrice ? `$${btcPrice.toLocaleString()}` : "Loading..."}
            </span>
          </div>
        </div>

        {/* Center Section - Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 w-full sm:w-auto">
          <Link href="/token-scanner" className="flex items-center space-x-1 hover:text-blue-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Screener</span>
          </Link>
          
          <Link href="/honeypot-scanner" className="flex items-center space-x-1 hover:text-blue-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Smart Audit</span>
          </Link>
          
          <Link href="/explorer/latest/block" className="flex items-center space-x-1 hover:text-blue-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Block Scan</span>
          </Link>
          
          <Link href="/marketplace" className="flex items-center space-x-1 hover:text-blue-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span>Marketplace</span>
          </Link>
          
          <Link href="/explorer" className="flex items-center space-x-1 hover:text-blue-400 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>Explorer</span>
          </Link>
        </div>

        {/* Right Section - Social & Info */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 w-full sm:w-auto">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">Powered by</span>
            <span className="text-blue-400">Base</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <a
              href="https://twitter.com/HomebaseMarkets"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 transition-colors"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.162 5.656c-.806.358-1.675.599-2.582.709a4.515 4.515 0 001.981-2.481 8.94 8.94 0 01-2.859 1.098 4.515 4.515 0 00-7.692 4.119A12.828 12.828 0 013.437 4.4a4.515 4.515 0 001.401 6.032 4.515 4.515 0 01-2.043-.566v.056a4.515 4.515 0 003.623 4.426 4.515 4.515 0 01-2.037.078 4.515 4.515 0 004.217 3.141 9.03 9.03 0 01-5.607 1.932c-.365 0-.729-.021-1.088-.064a12.794 12.794 0 006.92 2.028c8.302 0 12.838-6.877 12.838-12.837 0-.196-.004-.393-.013-.589a9.14 9.14 0 002.25-2.33z" />
              </svg>
            </a>
            
            <a
              href="https://t.me/HomebaseMarkets"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 transition-colors"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
            
            <a
              href="https://discord.gg/homebase"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 transition-colors"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.019 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
              </svg>
            </a>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">v1.0.0</span>
            <span className="text-gray-600">•</span>
            <span className="text-blue-400">Base</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
