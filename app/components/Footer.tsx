"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SiEthereum, SiBitcoin } from "react-icons/si";
import { FiShield, FiBarChart, FiTrendingUp, FiEye } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const Footer = () => {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"Connected" | "Disconnected">("Connected");
  const [uptime, setUptime] = useState<string>("0h 0m 0s");
  const [showAuditWidget, setShowAuditWidget] = useState(false);
  const [auditAddress, setAuditAddress] = useState("");
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const auditWidgetRef = useRef<HTMLDivElement>(null);
  const auditButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch ETH and BTC prices with better error handling and caching
  useEffect(() => {
    let isMounted = true;
    
    const fetchPrices = async () => {
      try {
        // Fetch ETH price from CoinGecko with timeout
        const ethController = new AbortController();
        const ethTimeout = setTimeout(() => ethController.abort(), 5000);
        
        const ethRes = await fetch("/api/price/eth", {
          cache: "no-store",
          signal: ethController.signal,
        });
        clearTimeout(ethTimeout);
        
        if (isMounted) {
          const ethData = await ethRes.json();
          setEthPrice(ethData.ethereum.usd);
        }

        // Fetch Bitcoin price from DEX Screener with timeout
        const btcController = new AbortController();
        const btcTimeout = setTimeout(() => btcController.abort(), 5000);
        
        const btcRes = await fetch("https://api.dexscreener.com/latest/dex/tokens/0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", {
          cache: "no-store",
          signal: btcController.signal,
        });
        clearTimeout(btcTimeout);
        
        if (isMounted && btcRes.ok) {
          const btcData = await btcRes.json();
          if (btcData.pairs && btcData.pairs[0]) {
            setBtcPrice(parseFloat(btcData.pairs[0].priceUsd));
          }
        }
              } catch (err) {
          if (isMounted && err instanceof Error && err.name !== 'AbortError') {
            console.error("Error fetching prices:", err);
            // Don't clear prices on error, keep last known values
          }
        }
    };
    
    fetchPrices();
    
    // Only set interval if component is still mounted
    const interval = setInterval(() => {
      if (isMounted) {
        fetchPrices();
      }
    }, 120000); // Update every 2 minutes instead of 1 minute
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Real connection status monitoring
  useEffect(() => {
    let isMounted = true;
    
    const checkConnection = () => {
      if (isMounted) {
        // Check if we can reach external services
        const checkOnline = async () => {
          try {
            // Try to fetch a small resource to check connectivity
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            await fetch('/api/price/eth', {
              signal: controller.signal,
              cache: 'no-store'
            });
            
            clearTimeout(timeoutId);
            setConnectionStatus("Connected");
          } catch (error) {
            setConnectionStatus("Disconnected");
          }
        };
        
        checkOnline();
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Calculate real-time uptime
  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    
    const calculateUptime = () => {
      if (isMounted) {
        const diff = Date.now() - startTime;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setUptime(`${hours}h ${minutes}m ${seconds}s`);
      }
    };
    calculateUptime();
    const interval = setInterval(calculateUptime, 1000); // Update every 1 second
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Cleanup audit widget on unmount
  useEffect(() => {
    return () => {
      setShowAuditWidget(false);
      setAuditResult(null);
      setAuditAddress("");
    };
  }, []);

  // Quick audit function
  const handleQuickAudit = async () => {
    if (!auditAddress.trim() || isScanning) return;
    
    setIsScanning(true);
    setAuditResult("Scanning contract...");
    
    try {
      // Call the actual honeypot scan API
      const response = await fetch(`/api/honeypot/scan?address=${auditAddress.trim()}`);
      
      if (!response.ok) {
        throw new Error('Audit request failed');
      }
      
      const data = await response.json();
      console.log('Audit API response:', data); // Debug log
      
      // Check if we have valid data
      if (!data || data.error) {
        setAuditResult("Audit failed");
        return;
      }
      
      // Determine if contract is secure based on honeypot scan results
      // The API returns the actual honeypot.is response structure
      const isHoneypot = data.isHoneypot || false;
      const isBlacklisted = data.isBlacklisted || false;
      const isProxy = data.isProxy || false;
      const isFakeToken = data.isFakeToken || false;
      const riskLevel = data.summary?.riskLevel || 'Low';
      
      console.log('Security checks:', { isHoneypot, isBlacklisted, isProxy, isFakeToken, riskLevel }); // Debug log
      
      // Contract is secure if it's not a honeypot and has low risk
      const isSecure = !isHoneypot && !isBlacklisted && !isProxy && !isFakeToken && riskLevel !== 'High';
      
      setAuditResult(isSecure ? "Contract Secure" : "Security Issues Found");
      
      // Keep widget open for 5 seconds to show result
      setTimeout(() => {
        setAuditResult(null);
        setAuditAddress("");
        setShowAuditWidget(false);
      }, 5000);
      
    } catch (error) {
      console.error('Audit error:', error);
      setAuditResult("Audit failed");
      setTimeout(() => setAuditResult(null), 3000);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle mouse events for audit widget
  const handleMouseEnter = () => {
    setShowAuditWidget(true);
  };

  const handleMouseLeave = () => {
    // Only close if not scanning and no result is showing
    // Use setTimeout to prevent immediate closing when moving mouse to widget
    setTimeout(() => {
      if (!isScanning && !auditResult) {
        setShowAuditWidget(false);
      }
    }, 100);
  };

  return (
    <footer className="bg-gray-950 border-t border-gray-800 text-gray-300 text-xs py-2 px-4">
      {/* Desktop Layout - Unchanged */}
      <div className="hidden sm:flex flex-row items-center justify-between">
        {/* Left Section - Status & Info */}
        <div className="flex items-center justify-start gap-4">
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
            <SiEthereum className="w-3 h-3 text-gray-600" />
            <span className="text-gray-300">
              {ethPrice ? `$${ethPrice.toLocaleString()}` : "Loading..."}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <SiBitcoin className="w-3 h-3 text-orange-500" />
            <span className="text-gray-300">
              {btcPrice ? `$${btcPrice.toLocaleString()}` : "Loading..."}
            </span>
          </div>
        </div>

        {/* Center Section - Navigation Links */}
        <div className="flex items-center gap-8">
          <Link 
            href="/trade" 
            className="flex items-center space-x-1 hover:text-blue-400 transition-colors duration-200"
            prefetch={true}
          >
            <FiBarChart className="w-3 h-3" />
            <span>Screener</span>
          </Link>
          
          {/* Audit Widget */}
          <div className="relative" ref={auditWidgetRef}>
            <button
              ref={auditButtonRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className="flex items-center space-x-1 hover:text-blue-400 transition-colors duration-200"
            >
              <FiShield className="w-3 h-3" />
              <span>Audit</span>
            </button>
            
            <AnimatePresence>
              {showAuditWidget && (
                <motion.div
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 w-56 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl z-50"
                  style={{ 
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <FiShield className="w-3 h-3 text-blue-400" />
                    <span className="text-xs font-medium text-gray-200">Contract Audit</span>
                  </div>
                  
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Contract address"
                      value={auditAddress}
                      onChange={(e) => setAuditAddress(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                      onKeyPress={(e) => e.key === 'Enter' && handleQuickAudit()}
                      disabled={isScanning}
                    />
                    
                    <button
                      onClick={handleQuickAudit}
                      disabled={!auditAddress.trim() || isScanning}
                      className="w-full px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors"
                    >
                      {isScanning ? "Scanning..." : "Scan"}
                    </button>
                  </div>
                  
                  {auditResult && (
                    <motion.div 
                      className="mt-2 text-xs text-center font-medium"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {auditResult.includes("Secure") ? (
                        <span className="text-green-400">Contract Secure</span>
                      ) : (
                        <span className="text-red-400">Security Issues Found</span>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <Link 
            href="/radar" 
            className="flex items-center space-x-1 hover:text-blue-400 transition-colors duration-200"
            prefetch={true}
          >
            <FiEye className="w-3 h-3" />
            <span>Radar</span>
          </Link>
          
          <Link 
            href="/insights" 
            className="flex items-center space-x-1 hover:text-blue-400 transition-colors duration-200"
            prefetch={true}
          >
            <FiTrendingUp className="w-3 h-3" />
            <span>Insights</span>
          </Link>
          
          <Link 
            href="/explorer/latest/block" 
            className="flex items-center space-x-1 hover:text-blue-400 transition-colors duration-200"
            prefetch={true}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Block Scan</span>
          </Link>
        </div>

        {/* Right Section - Social & Info */}
        <div className="flex items-center justify-end gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">Powered by</span>
            <span className="text-blue-400">Base</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <a
              href="https://x.com/CypherXProtocol"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 transition-colors"
              title="Follow CypherX Protocol on X (Twitter)"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            
            <a
              href="https://t.me/CypherXCommunity"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 transition-colors"
              title="Join CypherX Community on Telegram"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
            
            <a
              href="https://discord.gg/a9Kc462p"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 transition-colors"
              title="Join CypherX Community on Discord"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.019 1.3332-.9555 2.4189-2.1568 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
              </svg>
            </a>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">v1.0.0</span>
            <span className="text-gray-600">•</span>
            <span className="text-blue-400">Base</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">DeFi Analytics</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">Smart Contracts</span>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Optimized */}
      <div className="sm:hidden">
        {/* Top Row - Status & Prices */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === "Connected" ? "bg-green-400" : "bg-red-400"}`} />
              <span className={connectionStatus === "Connected" ? "text-green-400" : "text-red-400"}>
                {connectionStatus}
              </span>
            </div>
            
            <div className="flex items-center space-x-1">
              <span className="text-gray-500">Uptime:</span>
              <span className="text-gray-300">{uptime}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <SiEthereum className="w-3 h-3 text-gray-600" />
              <span className="text-gray-300 text-xs">
                {ethPrice ? `$${(ethPrice / 1000).toFixed(1)}k` : "..."}
              </span>
            </div>
            
            <div className="flex items-center space-x-1">
              <SiBitcoin className="w-3 h-3 text-orange-500" />
              <span className="text-gray-300 text-xs">
                {btcPrice ? `$${(btcPrice / 1000).toFixed(1)}k` : "..."}
              </span>
            </div>
          </div>
        </div>

        {/* Middle Row - Navigation Links */}
        <div className="flex items-center justify-center gap-4 mb-3">
          <Link 
            href="/trade" 
            className="flex items-center space-x-1 text-gray-400 hover:text-blue-400 transition-colors duration-200"
            prefetch={true}
          >
            <FiBarChart className="w-3 h-3" />
            <span className="text-xs">Screener</span>
          </Link>
          
          <Link 
            href="/radar" 
            className="flex items-center space-x-1 text-gray-400 hover:text-blue-400 transition-colors duration-200"
            prefetch={true}
          >
            <FiEye className="w-3 h-3" />
            <span className="text-xs">Radar</span>
          </Link>
          
          <Link 
            href="/insights" 
            className="flex items-center space-x-1 text-gray-400 hover:text-blue-400 transition-colors duration-200"
            prefetch={true}
          >
            <FiTrendingUp className="w-3 h-3" />
            <span className="text-xs">Insights</span>
          </Link>
          
          <Link 
            href="/explorer/latest/block" 
            className="flex items-center space-x-1 text-gray-400 hover:text-blue-400 transition-colors duration-200"
            prefetch={true}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs">Blocks</span>
          </Link>
        </div>

        {/* Bottom Row - Audit, Social & Info */}
        <div className="flex items-center justify-between">
          {/* Mobile Audit Button */}
          <div className="relative">
            <button
              onClick={() => setShowAuditWidget(!showAuditWidget)}
              className="flex items-center space-x-1 text-gray-400 hover:text-blue-400 transition-colors duration-200"
            >
              <FiShield className="w-3 h-3" />
              <span className="text-xs">Audit</span>
            </button>
            
            <AnimatePresence>
              {showAuditWidget && (
                <motion.div
                  className="absolute bottom-full left-0 mb-2 w-48 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl z-50"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <FiShield className="w-3 h-3 text-blue-400" />
                    <span className="text-xs font-medium text-gray-200">Contract Audit</span>
                  </div>
                  
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Contract address"
                      value={auditAddress}
                      onChange={(e) => setAuditAddress(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                      onKeyPress={(e) => e.key === 'Enter' && handleQuickAudit()}
                      disabled={isScanning}
                    />
                    
                    <button
                      onClick={handleQuickAudit}
                      disabled={!auditAddress.trim() || isScanning}
                      className="w-full px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors"
                    >
                      {isScanning ? "Scanning..." : "Scan"}
                    </button>
                  </div>
                  
                  {auditResult && (
                    <motion.div 
                      className="mt-2 text-xs text-center font-medium"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {auditResult.includes("Secure") ? (
                        <span className="text-green-400">Contract Secure</span>
                      ) : (
                        <span className="text-red-400">Security Issues Found</span>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Social Links */}
          <div className="flex items-center space-x-3">
            <a
              href="https://x.com/CypherXProtocol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-400 transition-colors"
              title="Follow CypherX Protocol on X (Twitter)"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            
            <a
              href="https://t.me/CypherXCommunity"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-400 transition-colors"
              title="Join CypherX Community on Telegram"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
            
            <a
              href="https://discord.gg/a9Kc462p"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-400 transition-colors"
              title="Join CypherX Community on Discord"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.019 1.3332-.9555 2.4189-2.1568 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
              </svg>
            </a>
          </div>

          {/* Version Info */}
          <div className="flex items-center space-x-1">
            <span className="text-gray-500 text-xs">v1.0.0</span>
            <span className="text-gray-600">•</span>
            <span className="text-blue-400 text-xs">Base</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
