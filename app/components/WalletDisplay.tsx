"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FaWallet, FaChevronDown } from "react-icons/fa";
import { SiEthereum } from "react-icons/si";
import { useWalletSystem } from "@/app/providers";

interface WalletDisplayProps {
  onToggleDropdown: () => void;
  isDropdownOpen: boolean;
}

interface WalletData {
  address: string;
  privateKey: string;
  createdAt: number;
}

const WalletDisplay: React.FC<WalletDisplayProps> = ({
  onToggleDropdown,
  isDropdownOpen
}) => {
  const { setSelfCustodialWallet, setWalletLoading } = useWalletSystem();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [ethBalance, setEthBalance] = useState<string>("0.0");
  const [ethPrice, setEthPrice] = useState<number>(0);

  // Fetch ETH price
  const fetchEthPrice = useCallback(async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      setEthPrice(data.ethereum.usd);
    } catch (error) {
      console.error("Error fetching ETH price:", error);
    }
  }, []);

  // Fetch wallet balance
  const fetchBalance = useCallback(async (address: string) => {
    try {
      console.log(`🔍 Fetching balance for: ${address}`);
      
      const response = await fetch(`/api/wallet/balance?address=${address}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Balance fetched: ${data.ethBalance} ETH`);
        setEthBalance(data.ethBalance);
        
        // Update global context with the fetched balance
        console.log("🔍 WalletDisplay - Updating global context with fetched balance:", data.ethBalance);
        setSelfCustodialWallet({
          address: address,
          isConnected: true,
          ethBalance: data.ethBalance,
          tokenBalance: data.tokenBalance || "0.0"
        });
      } else {
        throw new Error(data.error || 'Failed to fetch balance');
      }
      
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }, [setSelfCustodialWallet]);

  // Load wallet from localStorage on component mount
  useEffect(() => {
    const loadWallet = () => {
      if (typeof window !== "undefined") {
        const storedWallet = localStorage.getItem("cypherx_wallet");
        if (storedWallet) {
          try {
            const data = JSON.parse(storedWallet);
            console.log("🔍 WalletDisplay - Loading wallet from localStorage:", data.address);
            setWalletData(data);
            
            // Update global context so other components can access the wallet
            console.log("🔍 WalletDisplay - Updating global context with wallet:", data.address);
            setSelfCustodialWallet({
              address: data.address,
              isConnected: true,
              ethBalance: "0.0",
              tokenBalance: "0.0"
            });
            
            fetchBalance(data.address);
          } catch (error) {
            console.error("Error loading wallet:", error);
          }
        } else {
          console.log("🔍 WalletDisplay - No wallet found in localStorage");
        }
        
        // Set loading to false regardless of whether wallet was found
        setWalletLoading(false);
      }
    };

    loadWallet();
  }, [setSelfCustodialWallet, setWalletLoading]);

  // Auto-load wallet and fetch data
  useEffect(() => {
    fetchEthPrice();
  }, [fetchEthPrice]);

  // Refresh balance periodically
  useEffect(() => {
    if (walletData?.address) {
      const interval = setInterval(() => {
        fetchBalance(walletData.address);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [walletData?.address, fetchBalance]);

  if (!walletData) {
    return (
      <button
        onClick={onToggleDropdown}
        className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-gray-900/80 border border-gray-700 hover:bg-gray-800/80 transition-all duration-200"
      >
        <FaWallet className="w-4 h-4 text-gray-400 hidden sm:block" />
        <div className="flex items-center space-x-2">
          <span className="text-gray-300 text-sm font-medium hidden sm:block">XWallet</span>
          <span className="text-gray-300 text-sm font-medium sm:hidden">Connect</span>
          <FaChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''} hidden sm:block`} />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onToggleDropdown}
      className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-gray-900/80 border border-gray-700 hover:bg-gray-800/80 transition-all duration-200"
    >
      {/* Wallet Icon - Hidden on Mobile */}
      <FaWallet className="w-4 h-4 text-gray-400 hidden sm:block" />
      
      {/* Separator - Hidden on Mobile */}
      <div className="w-px h-4 bg-gray-600 hidden sm:block"></div>
      
      {/* ETH Balance Display - Hidden on Mobile */}
      <div className="hidden sm:flex items-center space-x-2">
        {/* ETH Icon */}
        <div className="w-5 h-5 flex items-center justify-center relative">
          <SiEthereum className="w-5 h-5 text-blue-400" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-400 rounded-full border border-white"></div>
        </div>
        
        {/* Balance */}
        <div className="flex flex-col items-start">
          <span className="text-white text-sm font-semibold">
            {parseFloat(ethBalance).toFixed(4)} ETH
          </span>
          {ethPrice > 0 && (
            <span className="text-gray-400 text-xs font-medium">
              ${(parseFloat(ethBalance) * ethPrice).toFixed(2)}
            </span>
          )}
        </div>
      </div>
      
      {/* Mobile: Show "Connected" text */}
      <div className="sm:hidden flex items-center space-x-2">
        <span className="text-gray-300 text-sm font-medium">Connected</span>
      </div>
      
      {/* Dropdown Arrow - Hidden on Mobile */}
      <FaChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''} hidden sm:block`} />
    </button>
  );
};

export default WalletDisplay;
