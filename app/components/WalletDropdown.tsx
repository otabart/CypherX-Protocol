"use client";

import React, { useState, useCallback, useEffect } from "react";
import { FaWallet, FaDownload, FaUpload, FaExchangeAlt, FaCog } from "react-icons/fa";
import { ethers } from "ethers";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletSystem } from "@/app/providers";

interface WalletDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  walletSystem: "wagmi" | "self-custodial";
}

interface WalletData {
  address: string;
  privateKey: string;
  createdAt: number;
}

interface Transaction {
  id?: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  type?: string;
  amount?: string;
  token?: string;
  description?: string;
}

const WalletDropdown: React.FC<WalletDropdownProps> = ({
  isOpen,
  onClose,
  walletSystem
}) => {
  const { setSelfCustodialWallet, setWalletLoading } = useWalletSystem();
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [ethBalance, setEthBalance] = useState<string>("0.0");
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "swap" | "history" | "settings">("overview");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [sendAmount, setSendAmount] = useState<string>("");
  const [sendAddress, setSendAddress] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [isLoadingEthPrice, setIsLoadingEthPrice] = useState<boolean>(false);
  const [showCopiedTooltip, setShowCopiedTooltip] = useState<boolean>(false);

  // Fetch ETH price with retry logic
  const fetchEthPrice = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second delay between retries
    
    // Set loading state on first attempt only
    if (retryCount === 0) {
      setIsLoadingEthPrice(true);
    }
    
    try {
      console.log(`🔍 Fetching ETH price (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
              const response = await fetch('/api/price/eth', {
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.ethereum && data.ethereum.usd) {
        setEthPrice(data.ethereum.usd);
        setIsLoadingEthPrice(false);
        console.log("✅ ETH price fetched successfully:", data.ethereum.usd);
        return; // Success, exit retry loop
      } else {
        throw new Error("Invalid ETH price data received");
      }
      
    } catch (error) {
      console.error(`❌ ETH price fetch failed (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying ETH price fetch in ${retryDelay}ms...`);
        setTimeout(() => {
          fetchEthPrice(retryCount + 1);
        }, retryDelay);
      } else {
        console.error("❌ All ETH price fetch attempts failed");
        setEthPrice(0);
        setIsLoadingEthPrice(false);
      }
    }
  }, []);

  // Fetch wallet balance
  const fetchBalance = useCallback(async (address: string, showLoading = false) => {
    if (showLoading) {
      setIsRefreshingBalance(true);
    }
    
    try {
      console.log(`🔍 Fetching balance for: ${address}`);
      
      // Use our backend API to bypass CSP restrictions
      const response = await fetch(`/api/wallet/balance?address=${address}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Balance fetched: ${data.ethBalance} ETH`);
        setEthBalance(data.ethBalance);
        
        // Update global context with the fetched balance
        console.log("🔍 WalletDropdown - Updating global context with fetched balance:", data.ethBalance);
        setSelfCustodialWallet({
          address: address,
          isConnected: true,
          ethBalance: data.ethBalance,
          tokenBalance: data.tokenBalance || "0.0"
        });
        
        if (showLoading) {
          toast.success("Balance updated!");
        }
      } else {
        throw new Error(data.error || 'Failed to fetch balance');
      }
      
    } catch (error) {
      console.error("Error fetching balance:", error);
      toast.error("Failed to fetch balance");
    } finally {
      if (showLoading) {
        setIsRefreshingBalance(false);
      }
    }
  }, [setSelfCustodialWallet]);

  // Load existing wallet from localStorage
  const loadWallet = useCallback(() => {
    if (typeof window !== "undefined") {
      const storedWallet = localStorage.getItem("cypherx_wallet");
      if (storedWallet) {
        try {
          const data = JSON.parse(storedWallet);
          console.log("🔍 WalletDropdown - Loading wallet from localStorage:", data.address);
          setWalletData(data);
          
          // Update global context so other components can access the wallet
          console.log("🔍 WalletDropdown - Updating global context with wallet:", data.address);
          setSelfCustodialWallet({
            address: data.address,
            isConnected: true,
            ethBalance: "0.0",
            tokenBalance: "0.0"
          });
          
          fetchBalance(data.address);
          fetchTransactions(); // Fetch transaction history
          toast.success("Wallet loaded successfully!");
          if (!data.isBackedUp) {
            toast("Consider backing up your wallet for security", { duration: 4000 });
          }
        } catch (error) {
          console.error("Error loading wallet:", error);
          toast.error("Failed to load wallet");
        }
      } else {
        console.log("🔍 WalletDropdown - No wallet found in localStorage");
        toast("No wallet found in browser storage. Try importing from backup file.");
      }
      
      // Set loading to false regardless of whether wallet was found
      setWalletLoading(false);
    }
  }, [setSelfCustodialWallet, fetchBalance, setWalletLoading]);

  // Import wallet from backup file
  const importWallet = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            
            // Handle different backup file formats
            let walletData: WalletData;
            
            if (data.address && data.privateKey) {
              // Standard format
              walletData = {
                address: data.address,
                privateKey: data.privateKey,
                createdAt: data.createdAt || Date.now()
              };
            } else if (data.address && data.privateKey && data.backupDate) {
              // Backup format with date
              walletData = {
                address: data.address,
                privateKey: data.privateKey,
                createdAt: new Date(data.backupDate).getTime()
              };
            } else {
              throw new Error("Invalid wallet file format");
            }
            
            // Validate the wallet
            try {
              const wallet = new ethers.Wallet(walletData.privateKey);
              if (wallet.address.toLowerCase() !== walletData.address.toLowerCase()) {
                throw new Error("Private key doesn't match address");
              }
            } catch {
              throw new Error("Invalid private key");
            }
            
            // Save to localStorage
            localStorage.setItem("cypherx_wallet", JSON.stringify(walletData));
            setWalletData(walletData);
            
            // Update global context
            setSelfCustodialWallet({
              address: walletData.address,
              isConnected: true,
              ethBalance: "0.0",
              tokenBalance: "0.0"
            });
            
            fetchBalance(walletData.address);
            fetchTransactions(); // Fetch transaction history
            toast.success(`Wallet imported successfully! Address: ${walletData.address.slice(0, 8)}...${walletData.address.slice(-6)}`);
            toast("Remember to backup your wallet for security", { duration: 4000 });
            
          } catch (error) {
            console.error("Error importing wallet:", error);
            toast.error("Failed to import wallet. Please check your backup file.");
          }
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  }, [setSelfCustodialWallet, fetchBalance]);

  // Fetch transactions from Alchemy (real blockchain data only)
  const fetchTransactions = useCallback(async () => {
    if (!walletData?.address) return;
    
    setIsLoadingTransactions(true);
    try {
      // Fetch from Alchemy for real blockchain transactions only
      const alchemyResponse = await fetch('/api/alchemy/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletData.address,
          action: 'transactions',
          page: 1,
          limit: 20,
          filter: 'all'
        })
      });
      
      let alchemyTransactions: Transaction[] = [];
      
      if (alchemyResponse.ok) {
        const alchemyData = await alchemyResponse.json();
        console.log('🔍 Alchemy response:', alchemyData);
        if (alchemyData.success && alchemyData.data && alchemyData.data.transactions) {
          console.log('🔍 Found transactions:', alchemyData.data.transactions.length);
          alchemyTransactions = alchemyData.data.transactions.map((tx: any) => {
            console.log('🔍 Processing transaction:', tx);
            return {
              id: tx.hash,
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: tx.value,
              gasUsed: tx.gasUsed || '0',
              gasPrice: tx.gasPrice || '0',
              timestamp: tx.timestamp || Date.now(),
              status: tx.status || 'confirmed',
              type: tx.type || 'transfer',
              amount: tx.amount || '0',
              description: tx.description || `Transaction ${tx.hash.slice(0, 8)}...${tx.hash.slice(-6)}`
            };
          });
        } else {
          console.log('🔍 No transactions found in Alchemy response');
        }
      } else {
        console.log('🔍 Alchemy response not ok:', alchemyResponse.status);
      }
      
      // Sort by timestamp (newest first)
      const sortedTransactions = alchemyTransactions.sort((a, b) => 
        (b.timestamp || 0) - (a.timestamp || 0)
      );
      
      setTransactions(sortedTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to fetch transaction history');
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [walletData?.address]);

  // Store transaction
  const storeTransaction = useCallback(async (transaction: {
    type: string;
    amount?: string;
    token?: string;
    description?: string;
    status: string;
    recipient?: string;
  }) => {
    if (!walletData?.address) return;
    
    try {
      const response = await fetch('/api/wallet/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: walletData.address,
          transaction
        }),
      });
      
      if (response.ok) {
        // Refresh transactions after storing
        fetchTransactions();
      }
    } catch (error) {
      console.error('Error storing transaction:', error);
    }
  }, [walletData?.address, fetchTransactions]);

  // Create new wallet
  const createWallet = useCallback(() => {
    try {
      const wallet = ethers.Wallet.createRandom();
      const data: WalletData = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        createdAt: Date.now()
      };
      
      localStorage.setItem("cypherx_wallet", JSON.stringify(data));
      setWalletData(data);
      setEthBalance("0.0");
      
      // Update global context so other components can access the wallet
      setSelfCustodialWallet({
        address: data.address,
        isConnected: true,
        ethBalance: "0.0",
        tokenBalance: "0.0"
      });
      
      toast.success("Wallet created successfully!");
      toast("Please backup your wallet to secure your funds", { duration: 5000 });
    } catch (error) {
      console.error("Error creating wallet:", error);
      toast.error("Failed to create wallet");
    }
  }, [setSelfCustodialWallet]);

  // Copy wallet address
  const copyAddress = useCallback(async () => {
    if (walletData?.address) {
      try {
        await navigator.clipboard.writeText(walletData.address);
        setShowCopiedTooltip(true);
        setTimeout(() => setShowCopiedTooltip(false), 2000);
        toast.success("Wallet address copied to clipboard!");
      } catch (error) {
        console.error("Failed to copy address:", error);
        toast.error("Failed to copy address");
      }
    }
  }, [walletData]);

  // Backup wallet
  const backupWallet = useCallback(() => {
    if (walletData) {
      const backupData = {
        address: walletData.address,
        privateKey: walletData.privateKey,
        createdAt: walletData.createdAt,
        backupDate: Date.now()
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json"
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cypherx-wallet-${walletData.address.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Wallet backup downloaded!");
    }
  }, [walletData]);

  // Restore wallet
  const restoreWallet = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            if (data.address && data.privateKey) {
              localStorage.setItem("cypherx_wallet", JSON.stringify(data));
              setWalletData(data);
              fetchBalance(data.address);
              toast.success("Wallet restored successfully!");
            } else {
              toast.error("Invalid wallet file");
            }
          } catch (error) {
            console.error("Error restoring wallet:", error);
            toast.error("Failed to restore wallet");
          }
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  }, [fetchBalance]);

  // Deposit function (placeholder)
  const handleDeposit = useCallback(() => {
    if (!walletData) {
      toast.error("Please create or load a wallet first");
      return;
    }
    toast.success("Deposit functionality coming soon!");
  }, [walletData]);

  // Receive function
  const handleReceive = useCallback(() => {
    if (!walletData) {
      toast.error("Please create or load a wallet first");
      return;
    }
    copyAddress();
  }, [walletData, copyAddress]);

  // Send ETH function
  const handleSend = useCallback(async () => {
    if (!walletData) {
      toast.error("Please create or load a wallet first");
      return;
    }
    
    if (!sendAmount || !sendAddress) {
      toast.error("Please enter amount and recipient address");
      return;
    }
    
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    if (amount > parseFloat(ethBalance)) {
      toast.error("Insufficient balance");
      return;
    }
    
    // Basic address validation
    if (!sendAddress.startsWith("0x") || sendAddress.length !== 42) {
      toast.error("Please enter a valid Ethereum address");
      return;
    }
    
    setIsSending(true);
    
    try {
      // Store the transaction
      await storeTransaction({
        type: 'send',
        amount: sendAmount,
        token: 'ETH',
        description: `Sent ${sendAmount} ETH to ${sendAddress.slice(0, 8)}...${sendAddress.slice(-6)}`,
        recipient: sendAddress,
        status: 'pending'
      });
      
      // This would integrate with your swap/execute API
      toast.success("Send functionality coming soon!");
      setSendAmount("");
      setSendAddress("");
    } catch (error) {
      console.error("Error sending transaction:", error);
      toast.error("Failed to send transaction");
    } finally {
      setIsSending(false);
    }
  }, [walletData, sendAmount, sendAddress, ethBalance, storeTransaction]);

  // Settings handlers
  const handleBackup = useCallback(() => {
    if (!walletData) return;
    
    try {
      const backupData = {
        address: walletData.address,
        privateKey: walletData.privateKey,
        createdAt: walletData.createdAt || new Date().toISOString(),
        version: '1.0'
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cypherx-wallet-backup-${walletData.address.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Wallet backup downloaded successfully!');
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Failed to create backup');
    }
  }, [walletData]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const backupData = JSON.parse(event.target?.result as string);
            if (backupData.address && backupData.privateKey) {
              // Import the wallet
              setSelfCustodialWallet({
                address: backupData.address,
                isConnected: true,
                ethBalance: "0.0",
                tokenBalance: "0.0"
              });
              
              // Set local wallet data with private key
              setWalletData({
                address: backupData.address,
                privateKey: backupData.privateKey,
                createdAt: backupData.createdAt || Date.now()
              });
              
              toast.success('Wallet imported successfully!');
            } else {
              toast.error('Invalid backup file');
            }
          } catch (error) {
            console.error('Error importing wallet:', error);
            toast.error('Failed to import wallet');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [setSelfCustodialWallet]);

  const handleClearWallet = useCallback(() => {
    if (confirm('Are you sure you want to clear all wallet data? This action cannot be undone.')) {
      setSelfCustodialWallet(null);
      setWalletData(null);
      setEthBalance("0.0");
      setTransactions([]);
      setShowPrivateKey(false);
      toast.success('Wallet data cleared');
    }
  }, [setSelfCustodialWallet]);

  // Auto-load wallet when dropdown opens
  React.useEffect(() => {
    if (isOpen && walletSystem === "self-custodial" && !walletData) {
      loadWallet();
    }
  }, [isOpen, walletSystem, walletData, loadWallet]);

  // Fetch transactions when wallet is loaded or tab changes
  React.useEffect(() => {
    if (walletData?.address && activeTab === "history") {
      fetchTransactions();
    }
  }, [walletData?.address, activeTab, fetchTransactions]);



  // Fetch ETH price when dropdown opens
  React.useEffect(() => {
    if (isOpen) {
      fetchEthPrice();
    }
  }, [isOpen, fetchEthPrice]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Enhanced backdrop with grey tint */}
          <motion.div
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
                    className={isMobile
          ? "fixed inset-x-0 bottom-0 w-full bg-gray-950/98 backdrop-blur-xl border-t border-gray-700/40 rounded-t-3xl shadow-2xl z-50 h-[75vh] flex flex-col"
          : "fixed top-20 right-8 w-[420px] bg-gray-950/98 backdrop-blur-xl border border-gray-700/40 rounded-3xl shadow-2xl z-50 max-h-[85vh] overflow-hidden"
        }
            initial={isMobile 
              ? { opacity: 0, y: 100 }
              : { opacity: 0, y: -10, scale: 0.95 }
            }
            animate={isMobile 
              ? { opacity: 1, y: 0 }
              : { opacity: 1, y: 0, scale: 1 }
            }
            exit={isMobile 
              ? { opacity: 0, y: 100 }
              : { opacity: 0, y: -10, scale: 0.95 }
            }
            transition={{ duration: 0.3 }}
          >
            {/* Enhanced Header */}
            <div className="sticky top-0 bg-gray-950/98 backdrop-blur-xl pt-6 pb-4 px-6 border-b border-gray-700/30">
              {isMobile && (
                <div className="w-16 h-1 bg-gray-600 rounded-full mx-auto mb-4"></div>
              )}
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                    <FaWallet className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-100">
                      <span className="text-blue-400">Wallet</span>
                    </h3>
                    <p className="text-xs text-gray-400">Secure & Self-Custodial</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      activeTab === "settings"
                        ? "text-blue-400 bg-blue-500/20 border border-blue-500/30"
                        : "text-gray-400 hover:text-blue-400 hover:bg-blue-500/10"
                    }`}
                    title="Settings"
                  >
                    <FaCog className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-lg transition-all duration-200"
                    title="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 overflow-y-auto max-h-[calc(80vh-80px)] scrollbar-hide">

               

               {/* Self-Custodial Wallet Section */}
               {walletSystem === "self-custodial" && (
                 <div>
                                       {/* Enhanced Tab Navigation */}
                    <div className="flex mb-6 bg-gray-950/60 p-2 rounded-2xl border border-gray-800/50 backdrop-blur-sm">
                      <button
                        onClick={() => setActiveTab("overview")}
                        className={`flex-1 flex items-center justify-center py-3 px-4 text-sm font-medium rounded-xl transition-all duration-300 ${
                          activeTab === "overview" 
                            ? "bg-blue-500/20 text-blue-100 shadow-lg border border-blue-500/40" 
                            : "text-gray-400 hover:text-blue-300 hover:bg-blue-500/10"
                        }`}
                      >
                        <FaWallet className="w-4 h-4 mr-2" />
                        Overview
                      </button>
                      <button
                        onClick={() => setActiveTab("swap")}
                        className={`flex-1 flex items-center justify-center py-3 px-4 text-sm font-medium rounded-xl transition-all duration-300 ${
                          activeTab === "swap" 
                            ? "bg-blue-500/20 text-blue-100 shadow-lg border border-blue-500/40" 
                            : "text-gray-400 hover:text-blue-300 hover:bg-blue-500/10"
                        }`}
                      >
                        <FaExchangeAlt className="w-4 h-4 mr-2" />
                        Send
                      </button>
                      <button
                        onClick={() => setActiveTab("history")}
                        className={`flex-1 flex items-center justify-center py-3 px-4 text-sm font-medium rounded-xl transition-all duration-300 ${
                          activeTab === "history" 
                            ? "bg-blue-500/20 text-blue-100 shadow-lg border border-blue-500/40" 
                            : "text-gray-400 hover:text-blue-300 hover:bg-blue-500/10"
                        }`}
                      >
                        <FaDownload className="w-4 h-4 mr-2" />
                        History
                      </button>

                    </div>

                   {/* Main Tab */}
                   {activeTab === "overview" && (
                     <div className="space-y-4">
                       {/* Enhanced Wallet Status */}
                       {walletData ? (
                                                     <div className="bg-gray-950/30 p-6 rounded-2xl border border-gray-700/50">
                           <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center space-x-2">
                               <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-green-500 rounded-full animate-pulse"></div>
                               <span className="text-sm font-medium text-gray-300">Connected</span>
                             </div>
                             <button
                               onClick={() => walletData && fetchBalance(walletData.address, true)}
                               disabled={isRefreshingBalance}
                               className="flex items-center space-x-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-700/50 disabled:text-gray-500 text-blue-300 px-3 py-1.5 rounded-lg border border-blue-500/30 transition-all duration-200"
                             >
                               <svg className={`w-3 h-3 ${isRefreshingBalance ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                               </svg>
                               <span>{isRefreshingBalance ? "Updating..." : "Refresh"}</span>
                             </button>
                           </div>
                           
                           <div className="bg-gray-950/70 rounded-xl p-4 mb-4 border border-gray-700/30">
                                                           <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400 font-medium">WALLET ADDRESS</span>
                                <div className="relative">
                                  <button
                                    onClick={copyAddress}
                                    className="text-xs bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 px-2 py-1 rounded-lg border border-gray-600/50 transition-all duration-200 hover:border-blue-500/50"
                                  >
                                    Copy
                                  </button>
                                  {showCopiedTooltip && (
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                      Copied!
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-green-500"></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                             <div className="flex items-center space-x-2">
                               <span className="text-sm font-mono text-gray-200 font-medium">
                                 {walletData.address.slice(0, 8)}...{walletData.address.slice(-6)}
                               </span>
                               <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                             </div>
                           </div>
                           
                                                       <div className="bg-gray-950/50 rounded-xl p-4 border border-blue-500/20">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400 font-medium">BALANCE</span>
                                <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                  </svg>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-2xl font-bold text-gray-100">
                                  {parseFloat(ethBalance).toFixed(6)} ETH
                                </div>
                                <div className="text-sm text-gray-400">
                                  {isLoadingEthPrice ? (
                                    <span className="flex items-center space-x-1">
                                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                      <span>Loading...</span>
                                    </span>
                                  ) : (
                                    `≈ $${ethPrice > 0 ? (parseFloat(ethBalance) * ethPrice).toFixed(2) : '0.00'} USD`
                                  )}
                                </div>
                              </div>
                            </div>
                           
                           <div className="mt-3 text-xs text-gray-500 text-center">
                             {walletData.address}
                           </div>
                         </div>
                                                  ) : (
                                                         <div className="bg-gray-950/30 p-8 rounded-2xl border border-gray-700/50 text-center">
                              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                             <FaWallet className="w-8 h-8 text-blue-400" />
                           </div>
                           <h4 className="text-lg font-semibold text-gray-200 mb-2">Welcome to Wallet</h4>
                           <p className="text-gray-400 mb-6 text-sm">Create or import your self-custodial wallet to get started</p>
                           <div className="space-y-4">
                             <button
                               onClick={importWallet}
                               className="w-full flex items-center justify-center p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl border border-blue-500/50 transition-all duration-300 font-medium shadow-lg hover:shadow-blue-500/25"
                             >
                               <FaUpload className="w-4 h-4 mr-3" />
                               <span className="text-sm">Import Wallet from Backup</span>
                             </button>
                             <div className="grid grid-cols-2 gap-3">
                                                            <button
                               onClick={createWallet}
                               className="flex items-center justify-center p-4 bg-gray-800/50 hover:bg-blue-500/10 text-gray-200 rounded-xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300"
                             >
                                 <FaWallet className="w-4 h-4 mr-2" />
                                 <span className="text-sm">Create New</span>
                               </button>
                                                            <button
                               onClick={loadWallet}
                               className="flex items-center justify-center p-4 bg-gray-800/50 hover:bg-blue-500/10 text-gray-200 rounded-xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300"
                             >
                                 <FaDownload className="w-4 h-4 mr-2" />
                                 <span className="text-sm">Load from Browser</span>
                               </button>
                             </div>
                           </div>
                         </div>
                       )}

                                               {/* Settings Section */}
                        {showPrivateKey && walletData && (
                          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm text-gray-400">Wallet Settings</span>
                              <button
                                onClick={() => setShowPrivateKey(false)}
                                className="text-xs text-gray-400 hover:text-gray-300"
                              >
                                ×
                              </button>
                            </div>
                            
                            {/* Backup/Restore */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              <button
                                onClick={backupWallet}
                                className="flex items-center justify-center p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600 transition-colors"
                              >
                                <FaDownload className="w-3 h-3 mr-1" />
                                <span className="text-xs">Backup</span>
                              </button>
                              <button
                                onClick={restoreWallet}
                                className="flex items-center justify-center p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600 transition-colors"
                              >
                                <FaUpload className="w-3 h-3 mr-1" />
                                <span className="text-xs">Restore</span>
                              </button>
                            </div>

                                                         {/* Private Key Management */}
                             <div className="space-y-2">
                               <div className="flex items-center justify-between">
                                 <span className="text-xs text-gray-400">Private Key</span>
                                 <button
                                   onClick={() => {
                                     navigator.clipboard.writeText(walletData.privateKey);
                                     toast.success("Private key copied!");
                                   }}
                                   className="text-xs text-red-400 hover:text-red-300"
                                 >
                                   Copy Key
                                 </button>
                               </div>
                               <div className="text-xs font-mono text-red-400 break-all bg-gray-900 p-2 rounded border border-gray-600">
                                 {walletData.privateKey}
                               </div>
                             </div>

                             {/* Technical Information */}
                             <details className="group mt-4">
                               <summary className="cursor-pointer p-2 bg-gray-700/50 border border-gray-600 rounded-lg text-xs text-gray-400 hover:text-gray-300 transition-colors">
                                 <span className="flex items-center gap-2">
                                   <span className="group-open:rotate-90 transition-transform">▶</span>
                                   Technical Information
                                 </span>
                               </summary>
                               <div className="mt-2 p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-xs text-gray-400 space-y-2">
                                 <div><strong>Local Storage:</strong> Wallet data is stored locally in your browser for convenience</div>
                                 <div><strong>Backup:</strong> Download a JSON file containing your wallet credentials</div>
                                 <div><strong>Recovery:</strong> Import your backup file to restore wallet access</div>
                                 <div><strong>Privacy:</strong> Private keys never leave your device or browser</div>
                                 <div><strong>Verification:</strong> Test your backup on a different device to ensure it works</div>
                               </div>
                             </details>
                          </div>
                        )}

                        {/* Enhanced Wallet Actions */}
                        {walletData && !showPrivateKey && (
                          <div className="grid grid-cols-3 gap-4">
                            <button
                              onClick={handleDeposit}
                              className="group flex flex-col items-center justify-center p-4 bg-gray-950/30 hover:bg-blue-500/10 text-gray-300 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:scale-105"
                            >
                              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-500/30 transition-all duration-300">
                                <FaUpload className="w-5 h-5 text-green-400" />
                              </div>
                              <span className="text-xs font-medium">Deposit</span>
                            </button>
                            <button
                              onClick={handleReceive}
                              className="group flex flex-col items-center justify-center p-4 bg-gray-950/30 hover:bg-blue-500/10 text-gray-300 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:scale-105"
                            >
                              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-500/30 transition-all duration-300">
                                <FaDownload className="w-5 h-5 text-blue-400" />
                              </div>
                              <span className="text-xs font-medium">Receive</span>
                            </button>
                            <button
                              onClick={() => setActiveTab("swap")}
                              className="group flex flex-col items-center justify-center p-4 bg-gray-950/30 hover:bg-blue-500/10 text-gray-300 rounded-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:scale-105"
                            >
                              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-500/30 transition-all duration-300">
                                <FaExchangeAlt className="w-5 h-5 text-blue-400" />
                              </div>
                              <span className="text-xs font-medium">Send</span>
                            </button>
                          </div>
                        )}
                     </div>
                   )}

                                                               {/* Enhanced Send/Receive Tab */}
                        {activeTab === "swap" && walletData && (
                          <div className="space-y-6">
                            {/* Send Section */}
                            <div className="bg-gray-950/30 p-6 rounded-2xl border border-gray-700/50">
                          <div className="flex items-center space-x-3 mb-4">
                            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                              <FaExchangeAlt className="w-4 h-4 text-blue-400" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-200">Send ETH</h4>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs text-gray-400 mb-2 font-medium">RECIPIENT ADDRESS</label>
                              <input
                                type="text"
                                value={sendAddress}
                                onChange={(e) => setSendAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-2 font-medium">AMOUNT (ETH)</label>
                              <input
                                type="number"
                                value={sendAmount}
                                onChange={(e) => setSendAmount(e.target.value)}
                                placeholder="0.0"
                                step="0.000001"
                                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                              />
                            </div>
                                                          <div className="bg-gray-950/30 rounded-lg p-3 border border-gray-700/30">
                              <div className="text-xs text-gray-400 mb-1">Available Balance</div>
                              <div className="text-sm font-medium text-gray-200">
                                {parseFloat(ethBalance).toFixed(6)} ETH
                              </div>
                            </div>
                            <button
                              onClick={handleSend}
                              disabled={isSending}
                              className="w-full py-3 px-4 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-700/50 disabled:text-gray-500 text-blue-300 border border-blue-500/30 rounded-xl transition-all duration-300 font-medium"
                            >
                              {isSending ? (
                                <div className="flex items-center justify-center space-x-2">
                                  <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span>Sending...</span>
                                </div>
                              ) : (
                                "Send ETH"
                              )}
                            </button>
                          </div>
                        </div>

                                                    {/* Receive Section */}
                            <div className="bg-gray-950/30 p-6 rounded-2xl border border-gray-700/50">
                          <div className="flex items-center space-x-3 mb-4">
                            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                              <FaDownload className="w-4 h-4 text-green-400" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-200">Receive ETH</h4>
                          </div>
                          <div className="space-y-4">
                                                         <div className="bg-gray-950/30 rounded-lg p-4 border border-gray-700/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400 font-medium">WALLET ADDRESS</span>
                                <div className="relative">
                                  <button
                                    onClick={copyAddress}
                                    className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg border border-blue-500/30 transition-all duration-200"
                                  >
                                    Copy
                                  </button>
                                  {showCopiedTooltip && (
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                      Copied!
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-green-500"></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-mono text-gray-200 font-medium">
                                  {walletData.address.slice(0, 8)}...{walletData.address.slice(-6)}
                                </span>
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              </div>
                            </div>
                                                         <div className="bg-gray-950/50 rounded-lg p-3 border border-gray-700/30">
                              <div className="text-xs text-gray-500 break-all font-mono">
                                {walletData.address}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 text-center">
                              Share this address to receive ETH
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    

                                                               {/* Professional Transaction History */}
                        {activeTab === "history" && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-gray-200">Recent Transactions</h4>
                              <button
                                onClick={fetchTransactions}
                                disabled={isLoadingTransactions}
                                className="flex items-center space-x-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-gray-300 px-2 py-1 rounded transition-colors"
                              >
                                <svg className={`w-3 h-3 ${isLoadingTransactions ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>{isLoadingTransactions ? "Loading" : "Refresh"}</span>
                              </button>
                            </div>
                            
                            {isLoadingTransactions ? (
                              <div className="text-center py-8">
                                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                                <p className="text-xs text-gray-400">Loading transactions...</p>
                              </div>
                                                         ) : transactions.length > 0 ? (
                               <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide">
                                {transactions.map((tx, index) => (
                                  <div key={tx.hash || tx.id || index} className="flex items-center justify-between p-3 bg-gray-950/30 rounded-lg border border-gray-700/30 hover:bg-gray-950/50 transition-colors">
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                      {/* Status indicator */}
                                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                        tx.status === 'confirmed' ? 'bg-green-400' :
                                        tx.status === 'pending' ? 'bg-yellow-400' :
                                        'bg-red-400'
                                      }`}></div>
                                      
                                      {/* Transaction details */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-sm font-medium text-gray-200 truncate">
                                            {tx.type === 'incoming' ? 'Received' : tx.type === 'outgoing' ? 'Sent' : 'Transaction'}
                                          </span>
                                                                                     <span className="text-sm font-semibold text-gray-100 ml-2">
                                             {tx.amount && parseFloat(tx.amount) > 0 ? `${parseFloat(tx.amount).toFixed(4)} ETH` : '0 ETH'}
                                           </span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-gray-400 truncate">
                                            {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() + ' ' + new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown'}
                                          </span>
                                          {tx.hash && (
                                            <a
                                              href={`https://basescan.org/tx/${tx.hash}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors ml-2 flex-shrink-0"
                                            >
                                              View
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <div className="w-12 h-12 bg-gray-950/50 rounded-lg flex items-center justify-center mx-auto mb-3 border border-gray-700/30">
                                  <FaDownload className="w-6 h-6 text-gray-500" />
                                </div>
                                <p className="text-sm text-gray-400">No transactions found</p>
                                <p className="text-xs text-gray-500 mt-1">Your transaction history will appear here</p>
                              </div>
                                                         )}
                           </div>
                         )}
                 </div>
               )}

               {/* Settings Tab */}
               {activeTab === "settings" && (
                 <div className="space-y-6">
                   {/* Security Settings */}
                   <div className="bg-gray-950/30 p-6 rounded-2xl border border-gray-700/50">
                     <div className="flex items-center space-x-3 mb-4">
                       <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                         <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                           <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                         </svg>
                       </div>
                       <h4 className="text-lg font-semibold text-gray-200">Security & Backup</h4>
                     </div>
                     
                     <div className="space-y-4">
                       {/* Private Key Management */}
                       <div className="p-4 bg-gray-950/50 rounded-xl border border-gray-700/30">
                         <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center space-x-3">
                             <div className="w-6 h-6 bg-orange-500/20 rounded-lg flex items-center justify-center">
                               <svg className="w-3 h-3 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                                 <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                               </svg>
                             </div>
                             <span className="text-sm font-medium text-gray-200">Private Key</span>
                           </div>
                           <button
                             onClick={() => setShowPrivateKey(!showPrivateKey)}
                             className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs rounded-lg border border-red-500/30 transition-all duration-200"
                           >
                             {showPrivateKey ? "Hide" : "Reveal"}
                           </button>
                         </div>
                         
                         {showPrivateKey && walletData && (
                           <div className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                             <div className="text-xs text-red-300 mb-2 font-medium">⚠️ WARNING: Keep this private and secure!</div>
                             <div className="text-xs font-mono text-red-200 break-all bg-gray-950/50 p-2 rounded border border-red-500/20">
                               {walletData.privateKey}
                             </div>
                           </div>
                         )}
                       </div>

                       {/* Backup Wallet */}
                       <div className="p-4 bg-gray-950/50 rounded-xl border border-gray-700/30">
                         <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center space-x-3">
                             <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
                               <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                 <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                               </svg>
                             </div>
                             <span className="text-sm font-medium text-gray-200">Backup Wallet</span>
                           </div>
                           <button
                             onClick={handleBackup}
                             className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded-lg border border-blue-500/30 transition-all duration-200"
                           >
                             Download
                           </button>
                         </div>
                         <p className="text-xs text-gray-400">Download a secure backup file of your wallet</p>
                       </div>

                       {/* Import Wallet */}
                       <div className="p-4 bg-gray-950/50 rounded-xl border border-gray-700/30">
                         <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center space-x-3">
                             <div className="w-6 h-6 bg-green-500/20 rounded-lg flex items-center justify-center">
                               <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                                 <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                               </svg>
                             </div>
                             <span className="text-sm font-medium text-gray-200">Import Wallet</span>
                           </div>
                           <button
                             onClick={handleImport}
                             className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs rounded-lg border border-green-500/30 transition-all duration-200"
                           >
                             Import
                           </button>
                         </div>
                         <p className="text-xs text-gray-400">Import an existing wallet from backup file</p>
                       </div>
                     </div>
                   </div>

                   {/* Wallet Information */}
                   <div className="bg-gray-950/30 p-6 rounded-2xl border border-gray-700/50">
                     <div className="flex items-center space-x-3 mb-4">
                       <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                         <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                           <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                         </svg>
                       </div>
                       <h4 className="text-lg font-semibold text-gray-200">Wallet Information</h4>
                     </div>
                     
                     <div className="space-y-3">
                       <div className="flex justify-between items-center p-3 bg-gray-950/50 rounded-lg border border-gray-700/30">
                         <span className="text-sm text-gray-400">Network</span>
                         <span className="text-sm font-medium text-gray-200">Base</span>
                       </div>
                       <div className="flex justify-between items-center p-3 bg-gray-950/50 rounded-lg border border-gray-700/30">
                         <span className="text-sm text-gray-400">Wallet Type</span>
                         <span className="text-sm font-medium text-gray-200">Self-Custodial</span>
                       </div>
                       <div className="flex justify-between items-center p-3 bg-gray-950/50 rounded-lg border border-gray-700/30">
                         <span className="text-sm text-gray-400">Created</span>
                         <span className="text-sm font-medium text-gray-200">
                           {walletData ? new Date(walletData.createdAt || Date.now()).toLocaleDateString() : 'Unknown'}
                         </span>
                       </div>
                     </div>
                   </div>

                   {/* Advanced Settings */}
                   <div className="bg-gray-950/30 p-6 rounded-2xl border border-gray-700/50">
                     <div className="flex items-center space-x-3 mb-4">
                       <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                         <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                           <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                         </svg>
                       </div>
                       <h4 className="text-lg font-semibold text-gray-200">Advanced</h4>
                     </div>
                     
                     <div className="space-y-3">
                       <button
                         onClick={handleClearWallet}
                         className="w-full p-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm rounded-lg border border-red-500/30 transition-all duration-200 text-left"
                       >
                         <div className="flex items-center justify-between">
                           <span>Clear Wallet Data</span>
                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                             <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                           </svg>
                         </div>
                         <p className="text-xs text-red-400 mt-1">Remove wallet from this device</p>
                       </button>
                     </div>
                   </div>
                 </div>
               )}

               

                                                                                               {/* Enhanced Security & Legal Disclaimers */}
                 {!showPrivateKey && activeTab === "overview" && (
                   <div className="mt-8 space-y-4">
                     {/* Important Notice */}
                     <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                       <div className="flex items-start gap-3">
                         <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                           <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                           </svg>
                         </div>
                         <div className="text-sm text-blue-300">
                           <strong>Important:</strong> Create a backup of your wallet to ensure you can recover your funds if needed.
                         </div>
                       </div>
                     </div>

                     {/* Security Guidelines */}
                     <div className="p-4 bg-gray-950/30 border border-gray-700/50 rounded-xl">
                       <div className="flex items-center space-x-3 mb-3">
                         <div className="w-6 h-6 bg-green-500/20 rounded-lg flex items-center justify-center">
                           <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                             <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                           </svg>
                         </div>
                         <h5 className="text-sm font-semibold text-gray-200">Security Guidelines</h5>
                       </div>
                       <div className="text-sm text-gray-300 space-y-2">
                         <div className="flex items-center space-x-2">
                           <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                           <span>Download and securely store your backup file</span>
                         </div>
                         <div className="flex items-center space-x-2">
                           <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                           <span>Keep your backup file private and secure</span>
                         </div>
                         <div className="flex items-center space-x-2">
                           <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                           <span>Use &quot;Import Wallet&quot; when switching devices</span>
                         </div>
                       </div>
                     </div>

                     {/* Legal Disclaimers */}
                     <div className="p-4 bg-gray-950/20 border border-gray-700/40 rounded-xl">
                       <div className="flex items-center space-x-3 mb-3">
                         <div className="w-6 h-6 bg-orange-500/20 rounded-lg flex items-center justify-center">
                           <svg className="w-3 h-3 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                           </svg>
                         </div>
                         <h5 className="text-sm font-semibold text-gray-200">Legal Disclaimers</h5>
                       </div>
                       <div className="text-sm text-gray-400 space-y-3">
                         <div>
                           <strong className="text-gray-300">Self-Custody:</strong> This is a self-custodial wallet. You maintain full control and responsibility for your funds.
                         </div>
                         <div>
                           <strong className="text-gray-300">No Access:</strong> We do not have access to your private keys or funds, just like other self-custodial solutions.
                         </div>
                         <div>
                           <strong className="text-gray-300">No Liability:</strong> We are not responsible for any loss of funds due to lost private keys, compromised backups, or user error.
                         </div>
                       </div>
                     </div>
                   </div>
                 )}
             </div>
           </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WalletDropdown;

