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

  // Fetch ETH price
  const fetchEthPrice = useCallback(async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      if (data.ethereum && data.ethereum.usd) {
        setEthPrice(data.ethereum.usd);
        console.log("ETH price fetched:", data.ethereum.usd);
      } else {
        console.error("Invalid ETH price data:", data);
        setEthPrice(0);
      }
    } catch (error) {
      console.error("Error fetching ETH price:", error);
      setEthPrice(0);
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

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!walletData?.address) return;
    
    setIsLoadingTransactions(true);
    try {
      const response = await fetch(`/api/wallet/transactions?walletAddress=${walletData.address}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTransactions(data.transactions);
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
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
              ? "fixed inset-x-0 bottom-0 w-full bg-gray-900/95 backdrop-blur-xl border-t border-blue-500/30 rounded-t-2xl shadow-2xl z-50 h-[70vh] flex flex-col"
              : "fixed top-20 right-8 w-96 bg-gray-900/95 backdrop-blur-xl border border-blue-500/30 rounded-2xl shadow-2xl z-50 max-h-[80vh] overflow-hidden"
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
            {/* Header with single close button */}
            <div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl pt-4 pb-2 px-6 border-b border-blue-500/20">
              {isMobile && (
                <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-3"></div>
              )}
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-100">
                  <span className="text-blue-400 font-bold">X</span>
                  <span className="text-gray-100">Wallet</span>
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="text-gray-400 hover:text-gray-200 p-1 rounded transition-colors"
                    title="Settings"
                  >
                    <FaCog className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-200 px-2 py-1 rounded transition-colors bg-gray-800/50 border border-gray-600/50"
                    title="Close"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 flex-1 overflow-y-auto max-h-[calc(80vh-80px)] scrollbar-hide">

               

               {/* Self-Custodial Wallet Section */}
               {walletSystem === "self-custodial" && (
                 <div>
                                       {/* Tab Navigation */}
                    <div className="flex mb-6 bg-gray-800/80 p-1.5 rounded-xl border border-blue-500/20">
                      <button
                        onClick={() => setActiveTab("overview")}
                        className={`flex-1 flex items-center justify-center py-2.5 px-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                          activeTab === "overview" 
                            ? "bg-blue-500/20 text-blue-100 shadow-sm border border-blue-500/30" 
                            : "text-gray-400 hover:text-blue-300 hover:bg-blue-500/10"
                        }`}
                      >
                        <FaWallet className="w-3.5 h-3.5 mr-1.5" />
                        Overview
                      </button>
                                             <button
                         onClick={() => setActiveTab("swap")}
                         className={`flex-1 flex items-center justify-center py-2.5 px-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                           activeTab === "swap" 
                             ? "bg-blue-500/20 text-blue-100 shadow-sm border border-blue-500/30" 
                             : "text-gray-400 hover:text-blue-300 hover:bg-blue-500/10"
                         }`}
                       >
                         <FaExchangeAlt className="w-3.5 h-3.5 mr-1.5" />
                         Send
                       </button>
                      <button
                        onClick={() => setActiveTab("history")}
                        className={`flex-1 flex items-center justify-center py-2.5 px-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                          activeTab === "history" 
                            ? "bg-blue-500/20 text-blue-100 shadow-sm border border-blue-500/30" 
                            : "text-gray-400 hover:text-blue-300 hover:bg-blue-500/10"
                        }`}
                      >
                        <FaDownload className="w-3.5 h-3.5 mr-1.5" />
                        History
                      </button>
                    </div>

                   {/* Main Tab */}
                   {activeTab === "overview" && (
                     <div className="space-y-4">
                       {/* Wallet Status */}
                       {walletData ? (
                         <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                                                       <div className="flex items-center justify-between mb-3">
                              <span className="text-sm text-gray-400">Wallet Address</span>
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => walletData && fetchBalance(walletData.address, true)}
                                    disabled={isRefreshingBalance}
                                    className="text-xs bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-gray-300 px-2 py-1 rounded border border-gray-600 transition-colors"
                                  >
                                    {isRefreshingBalance ? "..." : "Refresh"}
                                  </button>

                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-mono text-gray-200">
                                {walletData.address.slice(0, 8)}...{walletData.address.slice(-6)}
                              </span>
                              <button
                                onClick={copyAddress}
                                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded border border-gray-600 transition-colors"
                              >
                                Copy
                              </button>
                            </div>
                            <div className="space-y-2">
                              <div className="text-lg font-semibold text-green-400">
                                {parseFloat(ethBalance).toFixed(6)} ETH
                              </div>
                              {ethPrice > 0 && (
                                <div className="text-sm text-gray-400">
                                  ≈ ${(parseFloat(ethBalance) * ethPrice).toFixed(2)} USD
                                </div>
                              )}
                            </div>
                           <div className="mt-3 text-xs text-gray-500">
                             {walletData.address}
                           </div>
                         </div>
                       ) : (
                         <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-center">
                           <FaWallet className="w-12 h-12 mx-auto mb-3 text-gray-500" />
                           <p className="text-gray-400 mb-4">No wallet loaded</p>
                           <div className="space-y-3">
                             <button
                               onClick={importWallet}
                               className="w-full flex items-center justify-center p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg border border-blue-500 transition-colors font-medium"
                             >
                               <FaUpload className="w-4 h-4 mr-2" />
                               <span className="text-sm">Import Wallet from Backup</span>
                             </button>
                             <div className="grid grid-cols-2 gap-3">
                               <button
                                 onClick={createWallet}
                                 className="flex items-center justify-center p-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg border border-gray-600 transition-colors"
                               >
                                 <FaWallet className="w-4 h-4 mr-2" />
                                 <span className="text-sm">Create New</span>
                               </button>
                               <button
                                 onClick={loadWallet}
                                 className="flex items-center justify-center p-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg border border-gray-600 transition-colors"
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

                        {/* Wallet Actions */}
                        {walletData && !showPrivateKey && (
                          <div className="grid grid-cols-3 gap-3">
                            <button
                              onClick={handleDeposit}
                              className="flex flex-col items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 transition-colors"
                            >
                              <FaUpload className="w-5 h-5 mb-2" />
                              <span className="text-xs">Deposit</span>
                            </button>
                            <button
                              onClick={handleReceive}
                              className="flex flex-col items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 transition-colors"
                            >
                              <FaDownload className="w-5 h-5 mb-2" />
                              <span className="text-xs">Receive</span>
                            </button>
                                                         <button
                               onClick={() => setActiveTab("swap")}
                               className="flex flex-col items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 transition-colors"
                             >
                               <FaExchangeAlt className="w-5 h-5 mb-2" />
                               <span className="text-xs">Send</span>
                             </button>
                          </div>
                        )}
                     </div>
                   )}

                                       {/* Send/Receive Tab */}
                    {activeTab === "swap" && walletData && (
                      <div className="space-y-4">
                        {/* Send Section */}
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-200 mb-3">Send ETH</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Recipient Address</label>
                              <input
                                type="text"
                                value={sendAddress}
                                onChange={(e) => setSendAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Amount (ETH)</label>
                              <input
                                type="number"
                                value={sendAmount}
                                onChange={(e) => setSendAmount(e.target.value)}
                                placeholder="0.0"
                                step="0.000001"
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-500"
                              />
                            </div>
                            <div className="text-xs text-gray-400">
                              Available: {parseFloat(ethBalance).toFixed(6)} ETH
                            </div>
                            <button
                              onClick={handleSend}
                              disabled={isSending}
                              className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-gray-200 rounded-lg transition-colors"
                            >
                              {isSending ? "Sending..." : "Send ETH"}
                            </button>
                          </div>
                        </div>

                        {/* Receive Section */}
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-200 mb-3">Receive ETH</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-mono text-gray-300">
                                {walletData.address.slice(0, 8)}...{walletData.address.slice(-6)}
                              </span>
                              <button
                                onClick={copyAddress}
                                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded border border-gray-600 transition-colors"
                              >
                                Copy
                              </button>
                            </div>
                            <div className="text-xs text-gray-500 break-all">
                              {walletData.address}
                            </div>
                            <div className="text-xs text-gray-400">
                              Share this address to receive ETH
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    

                                       {/* Transactions Tab */}
                    {activeTab === "history" && (
                      <div className="space-y-4">
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-gray-200">Transaction History</h4>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={fetchTransactions}
                                disabled={isLoadingTransactions}
                                className="text-xs bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-gray-300 px-2 py-1 rounded border border-gray-600 transition-colors"
                              >
                                {isLoadingTransactions ? "Loading..." : "Refresh"}
                              </button>
                            </div>
                          </div>
                          
                          {isLoadingTransactions ? (
                            <div className="text-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto"></div>
                              <p className="text-xs text-gray-400 mt-2">Loading transactions...</p>
                            </div>
                          ) : transactions.length > 0 ? (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                              {transactions.map((tx, index) => (
                                <div key={tx.id || index} className="bg-gray-700 p-3 rounded-lg border border-gray-600">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-300">
                                      {tx.type || 'Transaction'}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      tx.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                                      tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                      'bg-red-500/20 text-red-400'
                                    }`}>
                                      {tx.status || 'pending'}
                                    </span>
                                  </div>
                                  
                                  {tx.amount && (
                                    <div className="text-sm text-gray-200 mb-1">
                                      {tx.amount} {tx.token || 'ETH'}
                                    </div>
                                  )}
                                  
                                  {tx.description && (
                                    <div className="text-xs text-gray-400 mb-2">
                                      {tx.description}
                                    </div>
                                  )}
                                  
                                  <div className="text-xs text-gray-500">
                                    {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'Unknown time'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="text-gray-500 mb-2">
                                <FaDownload className="w-8 h-8 mx-auto" />
                              </div>
                              <p className="text-sm text-gray-400">No transactions yet</p>
                              <p className="text-xs text-gray-500 mt-1">Your transaction history will appear here</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                 </div>
               )}

               

                                                                                               {/* Security & Legal Disclaimers - Only show in overview tab when settings are closed */}
                 {!showPrivateKey && activeTab === "overview" && (
                   <div className="mt-6 space-y-3">
                     {/* Important Notice */}
                     <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                       <div className="flex items-start gap-3">
                         <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                           <span className="text-white text-xs font-bold">i</span>
                         </div>
                         <div className="text-xs text-blue-300">
                           <strong>Important:</strong> Create a backup of your wallet to ensure you can recover your funds if needed.
                         </div>
                       </div>
                     </div>

                     {/* Security Guidelines */}
                     <div className="p-3 bg-gray-800/50 border border-gray-600 rounded-lg">
                       <div className="text-xs text-gray-300">
                         <strong>Security Guidelines:</strong>
                         <div className="mt-1 space-y-1">
                           <div>• Download and securely store your backup file</div>
                           <div>• Keep your backup file private and secure</div>
                           <div>• Use &quot;Import Wallet&quot; when switching devices</div>
                         </div>
                       </div>
                     </div>

                                           {/* Legal Disclaimers */}
                      <div className="p-3 bg-gray-800/30 border border-gray-600 rounded-lg">
                        <div className="text-xs text-gray-400 space-y-2">
                          <div><strong>Self-Custody:</strong> This is a self-custodial wallet. You maintain full control and responsibility for your funds.</div>
                          <div><strong>No Access:</strong> We do not have access to your private keys or funds, just like other self-custodial solutions.</div>
                          <div><strong>No Liability:</strong> We are not responsible for any loss of funds due to lost private keys, compromised backups, or user error.</div>
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

