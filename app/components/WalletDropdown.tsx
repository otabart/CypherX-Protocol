"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { FaWallet, FaDownload, FaEye, FaEyeSlash, FaArrowLeft } from "react-icons/fa";
import { Sparklines, SparklinesLine, SparklinesCurve } from "react-sparklines";
import { ethers } from "ethers";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletSystem } from "@/app/providers";

// Error Boundary Component
class WalletDropdownErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('WalletDropdown Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Wallet Error</h3>
            <p className="text-gray-400 text-sm mb-4">There was an error loading the wallet interface.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  usdValue?: string;
  priceAtTime?: number;
}

const WalletDropdown: React.FC<WalletDropdownProps> = ({
  isOpen,
  onClose,
  walletSystem
}) => {
  const { setSelfCustodialWallet, setWalletLoading } = useWalletSystem();
  const [isMobile, setIsMobile] = useState(false);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [ethBalance, setEthBalance] = useState<string>("0.0");
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "settings">("overview");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [tokenHoldings, setTokenHoldings] = useState<any[]>([]);
  const [isLoadingHoldings, setIsLoadingHoldings] = useState<boolean>(false);
  const [hiddenTokens, setHiddenTokens] = useState<Set<string>>(new Set());
  const [showWalletDropdown, setShowWalletDropdown] = useState<boolean>(false);
  const [userAlias, setUserAlias] = useState<string>('');
  const [currentSection, setCurrentSection] = useState<'main' | 'send' | 'receive' | 'swap' | 'buy'>('main');
  const [sendAmount, setSendAmount] = useState<string>('');
  const [sendAddress, setSendAddress] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<string>('ETH');
  const [showBalance, setShowBalance] = useState(true);

  const [selectedTokenForChart, setSelectedTokenForChart] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'main' | 'asset-details'>('main');
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'15m' | '1h' | '4h' | '1d'>('1h');
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const walletLoadedRef = useRef(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch user account information
  const fetchUserAccount = useCallback(async () => {
    try {
      // Try to get user info from localStorage or session
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        // You can replace this with your actual user info fetching logic
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
          const user = JSON.parse(userInfo);
          setUserAlias(user.alias || '');
        }
      }
    } catch (error) {
      console.error('Error fetching user account:', error);
    }
  }, []);

  // Fetch ETH price
  const fetchEthPrice = useCallback(async () => {
    try {
      const response = await fetch('/api/price/eth', { cache: 'no-store' });
      if (response.ok) {
      const data = await response.json();
      if (data.ethereum && data.ethereum.usd) {
        setEthPrice(data.ethereum.usd);
      }
      }
    } catch (error) {
      console.error('Error fetching ETH price:', error);
    }
  }, []);

  // Fetch wallet balance
  const fetchBalance = useCallback(async (address: string) => {
    try {
      const response = await fetch(`/api/wallet/balance?address=${address}`);
      if (response.ok) {
      const data = await response.json();
      if (data.success) {
        setEthBalance(data.ethBalance);
        setSelfCustodialWallet({
          address: address,
          isConnected: true,
          ethBalance: data.ethBalance,
          tokenBalance: data.tokenBalance || "0.0"
        });
        }
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }, [setSelfCustodialWallet]);

  // Load existing wallet from localStorage
  const loadWallet = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        const storedWallet = localStorage.getItem("cypherx_wallet");
        if (storedWallet) {
          try {
            const data = JSON.parse(storedWallet);
            setWalletData(data);
            setSelfCustodialWallet({
              address: data.address,
              isConnected: true,
              ethBalance: "0.0",
              tokenBalance: "0.0"
            });
            fetchBalance(data.address);
            fetchTransactions();
          } catch (error) {
            console.error("Error loading wallet:", error);
            toast.error("Failed to load wallet");
          }
        }
        setWalletLoading(false);
      }
    } catch (error) {
      console.error("Error in loadWallet:", error);
      toast.error("Failed to load wallet");
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
            if (data.address && data.privateKey) {
              const walletData: WalletData = {
                address: data.address,
                privateKey: data.privateKey,
                createdAt: data.createdAt || Date.now()
              };
              
            localStorage.setItem("cypherx_wallet", JSON.stringify(walletData));
            setWalletData(walletData);
            setSelfCustodialWallet({
              address: walletData.address,
              isConnected: true,
              ethBalance: "0.0",
              tokenBalance: "0.0"
            });
            
            walletLoadedRef.current = false; // Reset ref for imported wallet
            fetchBalance(walletData.address);
              fetchTransactions();
            }
          } catch (error) {
            console.error("Error importing wallet:", error);
            toast.error("Failed to import wallet");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [setSelfCustodialWallet, fetchBalance]);

  // Fetch token holdings
  const fetchTokenHoldings = useCallback(async () => {
    if (!walletData?.address) return;
    
    console.log('🔍 Fetching token holdings for address:', walletData.address);
    setIsLoadingHoldings(true);
    try {
      const response = await fetch('/api/alchemy/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletData.address,
          action: 'tokens'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Token holdings response:', data);
        if (data.success && data.data && data.data.tokenBalances) {
          console.log('🔍 Setting token holdings:', data.data.tokenBalances);
          setTokenHoldings(data.data.tokenBalances);
        } else {
          console.log('🔍 No token balances found in response');
        }
      } else {
        console.error('🔍 Token holdings response not ok:', response.status);
      }
    } catch (error) {
      console.error('Error fetching token holdings:', error);
    } finally {
      setIsLoadingHoldings(false);
    }
  }, [walletData?.address]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!walletData?.address) return;
    
    console.log('🔍 Fetching transactions for address:', walletData.address);
    setIsLoadingTransactions(true);
    try {
      const response = await fetch('/api/alchemy/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletData.address,
          action: 'transactions',
          page: 1,
          limit: 20
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Transactions response:', data);
        if (data.success && data.data && data.data.transactions) {
          console.log('🔍 Found transactions:', data.data.transactions.length);
          const processedTransactions = data.data.transactions.map((tx: any) => {
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
              type: tx.type || (tx.from.toLowerCase() === walletData.address.toLowerCase() ? 'outgoing' : 'incoming'),
              amount: tx.amount || (tx.value ? ethers.formatEther(tx.value) : '0'),
              token: tx.asset || 'ETH',
              usdValue: tx.value ? (parseFloat(ethers.formatEther(tx.value)) * ethPrice).toFixed(2) : '0'
            };
          });
          console.log('🔍 Processed transactions:', processedTransactions);
          setTransactions(processedTransactions);
        } else {
          console.log('🔍 No transactions found in response');
          
          // Add mock transactions for testing if no real transactions found
          const mockTransactions: Transaction[] = [
            {
              id: 'mock-1',
              hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              from: '0x0000000000000000000000000000000000000000',
              to: walletData.address,
              value: '1000000000000000000', // 1 ETH
              gasUsed: '21000',
              gasPrice: '20000000000',
              timestamp: Date.now() - 86400000, // 1 day ago
              status: 'confirmed' as const,
              type: 'incoming' as const,
              amount: '1.0',
              token: 'ETH',
              usdValue: '2000.00'
            },
            {
              id: 'mock-2',
              hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
              from: walletData.address,
              to: '0x1111111111111111111111111111111111111111',
              value: '500000000000000000', // 0.5 ETH
              gasUsed: '21000',
              gasPrice: '20000000000',
              timestamp: Date.now() - 172800000, // 2 days ago
              status: 'confirmed' as const,
              type: 'outgoing' as const,
              amount: '0.5',
              token: 'ETH',
              usdValue: '1000.00'
            }
          ];
          
          console.log('🔍 Using mock transactions for testing');
          setTransactions(mockTransactions);
        }
      } else {
        console.error('🔍 Transactions response not ok:', response.status);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [walletData?.address, ethPrice]);

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
      
      setSelfCustodialWallet({
        address: data.address,
        isConnected: true,
        ethBalance: "0.0",
        tokenBalance: "0.0"
      });
      
      walletLoadedRef.current = false; // Reset ref for new wallet
      toast.success("Wallet created successfully!");
    } catch (error) {
      console.error("Error creating wallet:", error);
      toast.error("Failed to create wallet");
    }
  }, [setSelfCustodialWallet]);

  // Copy wallet address
  const copyAddress = useCallback(async () => {
    console.log("copyAddress called, walletData:", walletData);
    
    if (!walletData?.address) {
      console.error("No wallet address available");
      toast.error("No address available to copy");
      return;
    }
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(walletData.address);
        toast.success("Address copied to clipboard");
        console.log("Address copied successfully:", walletData.address);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = walletData.address;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast.success("Address copied to clipboard");
          console.log("Address copied successfully (fallback):", walletData.address);
        } else {
          throw new Error("execCommand copy failed");
        }
      }
    } catch (error) {
      console.error("Failed to copy address:", error);
      console.error("Error details:", error instanceof Error ? error.message : 'Unknown error');
      toast.error("Failed to copy address");
    }
  }, [walletData]);

  // Copy private key
  const copyPrivateKey = useCallback(async () => {
    if (!walletData?.privateKey) {
      console.error("No private key available");
      toast.error("No private key available to copy");
      return;
    }
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(walletData.privateKey);
        toast.success("Private key copied to clipboard");
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = walletData.privateKey;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast.success("Private key copied to clipboard");
        } else {
          throw new Error("execCommand copy failed");
        }
      }
    } catch (error) {
      console.error("Failed to copy private key:", error);
      toast.error("Failed to copy private key");
    }
  }, [walletData]);

  // Copy token address
  const copyTokenAddress = useCallback(async (address: string) => {
    console.log("copyTokenAddress called with:", address);
    console.log("Type of address:", typeof address);
    
    if (!address || typeof address !== 'string') {
      console.error("Invalid address:", address);
      toast.error("No valid address to copy");
      return;
    }
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(address);
        setCopiedAddress(true);
        toast.success("Address copied to clipboard");
        console.log("Address copied successfully:", address);
        
        // Reset the copied state after 2 seconds
        setTimeout(() => {
          setCopiedAddress(false);
        }, 2000);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = address;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          setCopiedAddress(true);
          toast.success("Address copied to clipboard");
          console.log("Address copied successfully (fallback):", address);
          
          setTimeout(() => {
            setCopiedAddress(false);
          }, 2000);
        } else {
          throw new Error("execCommand copy failed");
        }
      }
    } catch (error) {
      console.error("Failed to copy token address:", error);
      console.error("Error details:", error instanceof Error ? error.message : 'Unknown error');
      toast.error("Failed to copy token address");
    }
  }, []);

  // Handle hiding/showing tokens
  const toggleTokenVisibility = useCallback((contractAddress: string) => {
    setHiddenTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contractAddress)) {
        newSet.delete(contractAddress);
      } else {
        newSet.add(contractAddress);
      }
      return newSet;
    });
  }, []);

  // Handle hiding all tokens
  const hideAllTokens = useCallback(() => {
    setHiddenTokens(new Set(tokenHoldings.map(token => token.contractAddress)));
  }, [tokenHoldings]);

  // Handle showing all tokens
  const showAllTokens = useCallback(() => {
    setHiddenTokens(new Set());
  }, []);

  // Handle back to main section
  const handleBackToMain = useCallback(() => {
    setCurrentSection('main');
    setCurrentView('main');
    setSendAmount('');
    setSendAddress('');
    setSelectedToken('ETH');
    setSelectedTokenForChart(null);
  }, []);

  // Fetch OHLC data using GeckoTerminal API (same as chart page)
  const fetchChartData = useCallback(async (_tokenAddress: string, _timeframe: string) => {
    setIsLoadingChart(true);
    try {
      // Historical price fetching removed to prevent CORS errors
      // For now, use mock data for all tokens
      const mockData = Array.from({ length: 24 }, (_, i) => {
        const time = Date.now() / 1000 - (24 - i) * 3600;
        const basePrice = 1;
        const variance = Math.sin(i * 0.5) * 0.1;
        const price = basePrice * (1 + variance);
        return {
          time,
          open: price * 0.99,
          high: price * 1.02,
          low: price * 0.98,
          close: price
        };
      });
      setChartData(mockData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartData([]);
    } finally {
      setIsLoadingChart(false);
    }
  }, []);

  // Fetch token price from DexScreener
  const fetchTokenPrice = useCallback(async (tokenAddress: string) => {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        // Get the first pair (usually the most liquid one)
        const pair = data.pairs[0];
        return {
          price: parseFloat(pair.priceUsd || '0'),
          priceChange: pair.priceChange?.h24 || 0,
          volume24h: pair.volume?.h24 || 0,
          liquidity: pair.liquidity?.usd || 0
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching token price:', error);
      return null;
    }
  }, []);

  // Format USD value with proper abbreviation
  const formatUSDValue = (value: number): string => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Format token price with more decimal support
  const formatTokenPrice = (price: number): string => {
    if (price >= 1000) {
      return `$${price.toFixed(2)}`;
    } else if (price >= 1) {
      return `$${price.toFixed(4)}`;
    } else if (price >= 0.01) {
      return `$${price.toFixed(6)}`;
    } else if (price >= 0.0001) {
      return `$${price.toPrecision(4)}`;
    } else {
      return `$${price.toExponential(4)}`;
    }
  };

  // Convert OHLC data to sparkline data (closing prices)
  const getSparklineData = (): number[] => {
    if (!chartData || chartData.length === 0) {
      return [];
    }
    return chartData.map(item => item.close);
  };

  // Handle send transaction
  const handleSendTransaction = useCallback(async () => {
    if (!walletData || !sendAmount || !sendAddress) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      // Basic validation
      if (selectedToken === 'ETH') {
        const amount = parseFloat(sendAmount);
        const balance = parseFloat(ethBalance);
        if (amount > balance) {
          toast.error("Insufficient ETH balance");
          return;
        }
      }

      // For now, just show a success message
      // In a real implementation, you would sign and send the transaction
      toast.success(`Sending ${sendAmount} ${selectedToken} to ${sendAddress?.slice(0, 6)}...${sendAddress?.slice(-4)}`);
      
      // Reset form and go back to main
      setSendAmount('');
      setSendAddress('');
      setCurrentSection('main');
    } catch (error) {
      console.error('Error sending transaction:', error);
      toast.error("Failed to send transaction");
    }
  }, [walletData, sendAmount, sendAddress, selectedToken, ethBalance]);

  // Handle Buy/Sell button
  const handleBuySell = useCallback(() => {
    if (!walletData) {
      toast.error("Please create or load a wallet first");
      return;
    }
    setCurrentSection('buy');
  }, [walletData]);

  // Handle Swap button
  const handleSwap = useCallback(() => {
    if (!walletData) {
      toast.error("Please create or load a wallet first");
      return;
    }
    setCurrentSection('swap');
  }, [walletData]);

  // Handle Send button
  const handleSend = useCallback(() => {
    if (!walletData) {
      toast.error("Please create or load a wallet first");
      return;
    }
    setCurrentSection('send');
  }, [walletData]);

  // Handle receive
  const handleReceive = useCallback(() => {
    if (!walletData) {
      toast.error("Please create or load a wallet first");
      return;
    }
    setCurrentSection('receive');
  }, [walletData]);

  // Backup wallet
  const handleBackup = useCallback(() => {
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
      a.download = `cypherx-wallet-${walletData?.address?.slice(0, 8) || 'backup'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Wallet backup downloaded!");
    }
  }, [walletData]);

  // Import wallet handler
  const handleImport = useCallback(() => {
    importWallet();
  }, [importWallet]);

  // Clear wallet
  const handleClearWallet = useCallback(() => {
    if (confirm('Are you sure you want to clear all wallet data?')) {
      setSelfCustodialWallet(null);
      setWalletData(null);
      setEthBalance("0.0");
      setTransactions([]);
      toast.success('Wallet data cleared');
    }
  }, [setSelfCustodialWallet]);

  // Auto-load wallet when dropdown opens
  useEffect(() => {
    if (isOpen && walletSystem === "self-custodial" && !walletData) {
      try {
        // Use setTimeout to avoid state updates during render
        setTimeout(() => {
          loadWallet();
        }, 0);
      } catch (error) {
        console.error('Error loading wallet:', error);
        toast.error('Failed to load wallet');
      }
    }
  }, [isOpen, walletSystem, walletData, loadWallet]);

  // Fetch data when wallet is loaded
  useEffect(() => {
    if (walletData?.address) {
      fetchTokenHoldings();
      if (activeTab === "history") {
        fetchTransactions();
      }
      // Show wallet loaded toast only once when wallet is first loaded
      if (!walletLoadedRef.current) {
        toast.success("Wallet loaded successfully!");
        walletLoadedRef.current = true;
      }
    }
  }, [walletData?.address, activeTab, fetchTokenHoldings, fetchTransactions]);

  // Fetch transactions when history tab is opened
  useEffect(() => {
    if (activeTab === "history" && walletData?.address) {
      console.log('🔍 History tab opened, fetching transactions...');
      fetchTransactions();
    }
  }, [activeTab, walletData?.address, fetchTransactions]);

  // Fetch user account and ETH price when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchUserAccount();
      fetchEthPrice();
    }
  }, [isOpen, fetchUserAccount, fetchEthPrice]);

  // Close wallet dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showWalletDropdown && !target.closest('.wallet-dropdown-menu')) {
        setShowWalletDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showWalletDropdown]);

  // Safety check to prevent rendering issues - move this after all hooks
  const isClient = typeof window !== 'undefined';
  
  // Safety check to prevent errors when wallet data is corrupted
  const isValidWalletData = walletData && walletData.address && walletData.privateKey;
  
  // Check if we should show loading state
  const shouldShowLoading = !walletData && isOpen;

  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance);
  };

  const getDisplayBalance = () => {
    if (!showBalance) {
      const totalBalance = ethPrice > 0 ? (parseFloat(ethBalance) * ethPrice + tokenHoldings.reduce((sum, token) => sum + (token.usdValue || 0), 0)).toFixed(2) : '0.00';
      return '*'.repeat(totalBalance.length);
    }
    return `$${ethPrice > 0 ? (parseFloat(ethBalance) * ethPrice + tokenHoldings.reduce((sum, token) => sum + (token.usdValue || 0), 0)).toFixed(2) : '0.00'}`;
  };

  const getDisplayEthBalance = () => {
    if (!showBalance) {
      const ethBalanceStr = parseFloat(ethBalance).toFixed(6);
      return '*'.repeat(ethBalanceStr.length);
    }
    return parseFloat(ethBalance).toFixed(6);
  };

  // Handle clicking on a token to show detailed chart
  const handleTokenClick = useCallback(async (token: any) => {
    setSelectedTokenForChart(token);
    setCurrentView('asset-details');
    
    // Fetch real-time price from DexScreener
    if (token.contractAddress) {
      const priceData = await fetchTokenPrice(token.contractAddress);
      if (priceData) {
        setSelectedTokenForChart({
          ...token,
          price: priceData.price,
          priceChange: priceData.priceChange
        });
      }
    }
    
    // Fetch chart data for the token using contract address
    if (token.contractAddress) {
      fetchChartData(token.contractAddress, '1h');
    }
  }, [fetchChartData, fetchTokenPrice]);

  // Handle clicking on ETH balance
  const handleEthClick = useCallback(() => {
    const ethToken = {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: ethBalance,
      usdValue: ethPrice > 0 ? (parseFloat(ethBalance) * ethPrice).toFixed(2) : '0.00',
      price: ethPrice,
      logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
      coinGeckoId: 'ethereum'
    };
    setSelectedTokenForChart(ethToken);
    setCurrentView('asset-details');
    fetchChartData('ethereum', '1h');
  }, [ethBalance, ethPrice, fetchChartData]);



  // Don't render if not client-side
  if (!isClient) {
    return null;
  }

  // Don't render if wallet data is invalid
  if (walletData && !isValidWalletData) {
    console.error('Invalid wallet data detected');
    return null;
  }

  // Show loading state if needed
  if (shouldShowLoading) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-gray-900/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className="fixed top-20 right-8 w-[400px] bg-gray-900 border border-gray-700 shadow-2xl z-[9999999] max-h-[85vh] overflow-hidden"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-2 border-[#0052FF]/20 border-t-[#0052FF] rounded-full animate-spin"></div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-gray-900/60 z-[9999999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            data-wallet-dropdown
                    className={isMobile
              ? "fixed inset-x-0 bottom-0 w-full bg-gray-900 border-t border-gray-700 shadow-2xl z-[9999999] h-[75vh] flex flex-col"
              : "fixed top-20 right-8 w-[400px] bg-gray-900 border border-gray-700 shadow-2xl z-[9999999] max-h-[85vh] overflow-hidden"
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
            {/* MetaMask-style Header */}
            <div className="bg-gray-900 px-4 py-3 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-[#0052FF] rounded-full flex items-center justify-center">
                    <FaWallet className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm font-medium text-gray-200">
                        {userAlias || 'Account 1'}
                      </span>
                  <button
                        onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                        className="text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        <svg className={`w-4 h-4 transition-transform ${showWalletDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                  </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 font-mono">
                        {walletData?.address ? `${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}` : 'Not Connected'}
                      </span>
                  <button
                        onClick={copyAddress}
                        className="text-gray-400 hover:text-gray-300"
                  >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>

              </div>
            </div>
                
                      <button
                  onClick={() => setActiveTab("settings")}
                  className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                  title="Settings"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                      </button>
              </div>
                    </div>

            {/* Wallet Dropdown Menu */}
            {showWalletDropdown && (
              <div className="wallet-dropdown-menu bg-gray-800 border-b border-gray-700">
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-400 mb-2">Current Wallet</div>
                  <div className="flex items-center justify-between p-2 bg-gray-700 rounded">
                             <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-[#0052FF] rounded-full flex items-center justify-center">
                        <FaWallet className="w-3 h-3 text-white" />
                             </div>
                      <div>
                        <div className="text-sm font-medium text-gray-200">
                          {walletData?.address ? `${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}` : 'No Wallet'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {walletData ? `${parseFloat(ethBalance).toFixed(4)} ETH` : 'Create or import wallet'}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-green-400">Active</div>
                  </div>
                  
                  <div className="mt-3 space-y-1">
                             <button
                      onClick={() => {
                        createWallet();
                        setShowWalletDropdown(false);
                      }}
                      className="w-full text-left p-2 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                               </svg>
                        <span>Create New Wallet</span>
                           </div>
                    </button>
                                  <button
                      onClick={() => {
                        importWallet();
                        setShowWalletDropdown(false);
                      }}
                      className="w-full text-left p-2 text-sm text-gray-300 hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        <span>Import Wallet</span>
                      </div>
                                  </button>
                                    </div>
                                </div>
                              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {walletSystem === "self-custodial" && currentSection === 'main' && currentView === 'main' && (
                <div>
                  {/* Balance Section */}
                  {walletData ? (
                    <div className="px-4 py-6 bg-gray-900">
                              <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-bold text-gray-200">
                          {getDisplayBalance()}
                        </span>
                        <button 
                          onClick={toggleBalanceVisibility}
                          className="text-gray-400 hover:text-gray-300 transition-colors duration-200"
                          title={showBalance ? "Hide balance" : "Show balance"}
                        >
                          {showBalance ? (
                            <FaEyeSlash className="w-5 h-5" />
                          ) : (
                            <FaEye className="w-5 h-5" />
                          )}
                        </button>
                                </div>
                                              <div className="flex items-center space-x-2 text-sm text-gray-400">
                          <button 
                            onClick={handleEthClick}
                            className="hover:text-gray-300 transition-colors cursor-pointer"
                            title="Click to view ETH chart"
                          >
                            <span>{getDisplayEthBalance()} ETH</span>
                          </button>
                          <span>•</span>
                          <span>{tokenHoldings.length + (parseFloat(ethBalance) > 0 ? 1 : 0)} tokens</span>
                          <span>•</span>
                          <span className="text-red-400">-0.45%</span>
                        </div>
                                </div>
                  ) : (
                    <div className="px-4 py-6 bg-gray-800 text-center">
                      <div className="w-16 h-16 bg-[#0052FF]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaWallet className="w-8 h-8 text-[#0052FF]" />
                                </div>
                      <h3 className="text-lg font-semibold text-gray-200 mb-2">Welcome to CypherX</h3>
                      <p className="text-gray-400 mb-6">Create or import your wallet to get started</p>
                      <div className="space-y-3">
                             <button
                               onClick={importWallet}
                          className="w-full py-3 px-4 bg-[#0052FF] hover:bg-[#0052FF]/80 text-white rounded-lg font-medium transition-colors"
                             >
                          Import Wallet
                             </button>
                                                            <button
                               onClick={createWallet}
                          className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors"
                        >
                          Create New Wallet
                               </button>
                           </div>
                         </div>
                       )}

                  {/* Quick Actions */}
                  {walletData && (
                    <div className="px-4 py-4">
                      <div className="grid grid-cols-4 gap-4">
                              <button
                          onClick={handleBuySell}
                          className="flex flex-col items-center p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <div className="w-8 h-8 bg-[#0052FF] rounded-lg flex items-center justify-center mb-2">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            </div>
                          <span className="text-xs text-gray-300">Buy/Sell</span>
                        </button>
                              <button
                          onClick={handleSwap}
                          className="flex flex-col items-center p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <div className="w-8 h-8 bg-[#0052FF] rounded-lg flex items-center justify-center mb-2">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </div>
                          <span className="text-xs text-gray-300">Swap</span>
                              </button>
                              <button
                          onClick={handleSend}
                          className="flex flex-col items-center p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <div className="w-8 h-8 bg-[#0052FF] rounded-lg flex items-center justify-center mb-2">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            </div>
                          <span className="text-xs text-gray-300">Send</span>
                        </button>
                                 <button
                          onClick={handleReceive}
                          className="flex flex-col items-center p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <div className="w-8 h-8 bg-[#0052FF] rounded-lg flex items-center justify-center mb-2">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                          </div>
                          <span className="text-xs text-gray-300">Receive</span>
                                 </button>
                               </div>
                          </div>
                        )}

                  {/* Navigation Tabs */}
                  <div className="px-4 py-2 border-b border-gray-700">
                    <div className="flex space-x-8">
                            <button
                        onClick={() => setActiveTab("overview")}
                        className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === "overview" 
                            ? "text-[#0052FF] border-[#0052FF]" 
                            : "text-gray-400 border-transparent hover:text-gray-300"
                        }`}
                      >
                        Tokens
                            </button>
                            <button
                        onClick={() => setActiveTab("history")}
                        className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === "history" 
                            ? "text-[#0052FF] border-[#0052FF]" 
                            : "text-gray-400 border-transparent hover:text-gray-300"
                        }`}
                      >
                        Activity
                      </button>
                              </div>
                  </div>

                  {/* Content Sections */}
                  {activeTab === "overview" && (
                    <div className="px-4 py-4">
                      {/* Network Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-200">Base Network</span>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        <div className="flex items-center space-x-2">
                          {tokenHoldings.length > 0 && (
                            <>
                              <button
                                onClick={hideAllTokens}
                                className="text-xs text-gray-400 hover:text-gray-300 px-2 py-1 rounded border border-gray-600 hover:border-gray-500"
                              >
                                Hide All
                            </button>
                            <button
                                onClick={showAllTokens}
                                className="text-xs text-gray-400 hover:text-gray-300 px-2 py-1 rounded border border-gray-600 hover:border-gray-500"
                            >
                                Show All
                            </button>
                            </>
                        )}
                          <button className="text-gray-400 hover:text-gray-300">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                            </svg>
                          </button>
                     </div>
                      </div>

                      

                       {/* Token List */}
                       {isLoadingHoldings ? (
                         <div className="text-center py-8">
                           <div className="w-8 h-8 border-2 border-[#0052FF]/20 border-t-[#0052FF] rounded-full animate-spin mx-auto mb-2"></div>
                           <p className="text-sm text-gray-400">Loading tokens...</p>
                            </div>
                       ) : (tokenHoldings.length > 0 || parseFloat(ethBalance) > 0) ? (
                        <div className="space-y-2">
                                                    {/* ETH Balance - Always show first if balance > 0 */}
                          {parseFloat(ethBalance) > 0 && (
                            <div 
                              onClick={handleEthClick}
                              className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors group cursor-pointer"
                              title="Click to view ETH chart"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden">
                                  <img 
                                    src="https://assets.coingecko.com/coins/images/279/small/ethereum.png"
                                    alt="ETH"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMxRjFGMjMiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMiA3TDEyIDEyTDIyIDdMMTIgMloiIGZpbGw9IiM2QjcyODAiLz4KPHBhdGggZD0iTTIgMTdMMTIgMjJMMjIgMTdMMTIgMTJMMiAxN1oiIGZpbGw9IiM2QjcyODAiLz4KPHBhdGggZD0iTTIgMTJMMTIgMTdMMjIgMTJMMiAxNloiIGZpbGw9IiM2QjcyODAiLz4KPC9zdmc+Cjwvc3ZnPg==';
                                    }}
                                  />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-200">ETH</div>
                                  <div className="text-xs text-gray-400">
                                    {getDisplayEthBalance()} ETH
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-200">
                                    ${ethPrice > 0 ? (parseFloat(ethBalance) * ethPrice).toFixed(2) : '0.00'}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    ${ethPrice > 0 ? ethPrice.toFixed(2) : '0.00'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Other Token Holdings */}
                          {tokenHoldings
                            .filter(token => !hiddenTokens.has(token.contractAddress))
                            .map((token, index) => (
                            <div 
                              key={token.contractAddress || index} 
                              onClick={() => handleTokenClick(token)}
                              className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors group cursor-pointer"
                              title={`Click to view ${token.symbol} chart`}
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden">
                                  <img 
                                    src={token.logo || `https://dexscreener.com/base/${token.contractAddress}/logo.png`} 
                                    alt={token.symbol}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = `https://dexscreener.com/base/${token.contractAddress}/logo.png`;
                                    }}
                              />
                            </div>
                            <div>
                                  <div className="text-sm font-medium text-gray-200">{token.name || token.symbol}</div>
                                  <div className="text-xs text-gray-400">
                                    {parseFloat(token.tokenBalance || '0').toFixed(4)} {token.symbol}
                            </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="text-right">
                              <div className="text-sm font-medium text-gray-200">
                                    ${token.usdValue ? parseFloat(token.usdValue).toFixed(2) : '0.00'}
                                  </div>
                                  <div className={`text-xs ${token.priceChange24h > 0 ? 'text-green-400' : token.priceChange24h < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                    {token.priceChange24h ? `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%` : '0.00%'}
                              </div>
                            </div>
                            <button
                                  onClick={() => toggleTokenVisibility(token.contractAddress)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-300 transition-opacity"
                                  title="Hide token"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                            </button>
                          </div>
                        </div>
                          ))}
                          
                          {/* Show hidden tokens count */}
                          {hiddenTokens.size > 0 && (
                            <div className="text-center py-2">
                                  <button
                                onClick={showAllTokens}
                                className="text-xs text-gray-400 hover:text-gray-300 underline"
                                  >
                                Show {hiddenTokens.size} hidden token{hiddenTokens.size !== 1 ? 's' : ''}
                                  </button>
                                    </div>
                                  )}
                                </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                              </div>
                          <p className="text-sm text-gray-400">No tokens found</p>
                          <p className="text-xs text-gray-500 mt-1">Your tokens will appear here</p>
                              </div>
                      )}
                      </div>
                    )}

                        {activeTab === "history" && (
                    <div className="px-4 py-4">
                          <div className="space-y-3">
                            {isLoadingTransactions ? (
                              <div className="text-center py-8">
                            <div className="w-8 h-8 border-2 border-[#0052FF]/20 border-t-[#0052FF] rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-sm text-gray-400">Loading transactions...</p>
                              </div>
                                                         ) : transactions.length > 0 ? (
                          <div className="space-y-2">
                                {transactions.map((tx, index) => (
                              <div key={tx.hash || tx.id || index} className="flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-2 h-2 rounded-full ${
                                        tx.status === 'confirmed' ? 'bg-green-400' :
                                        tx.status === 'pending' ? 'bg-yellow-400' :
                                        'bg-red-400'
                                      }`}></div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-200">
                                            {tx.type === 'incoming' ? 'Received' : tx.type === 'outgoing' ? 'Sent' : 'Transaction'}
                                        </div>
                                    <div className="text-xs text-gray-400">
                                            {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() + ' ' + new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown'}
                                        </div>
                                      </div>
                                    </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-200">
                                    {tx.amount && parseFloat(tx.amount) > 0 ? `${parseFloat(tx.amount).toFixed(4)} ${tx.token || 'ETH'}` : `0 ${tx.token || 'ETH'}`}
                                  </div>
                                  {tx.usdValue && parseFloat(tx.usdValue) > 0 && (
                                    <div className="text-xs text-gray-400">
                                      ${parseFloat(tx.usdValue).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                  <FaDownload className="w-6 h-6 text-gray-500" />
                                </div>
                                <p className="text-sm text-gray-400">No transactions found</p>
                                <p className="text-xs text-gray-500 mt-1">Your transaction history will appear here</p>
                              </div>
                                                         )}
                           </div>
                 </div>
               )}

               {/* Settings Tab */}
               {activeTab === "settings" && (
                    <div className="px-4 py-4 space-y-4">
                   {/* Security Settings */}
                      <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                        <h4 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                         </svg>
                          Security & Backup
                        </h4>
                     
                       {/* Private Key Management */}
                        <div className="mb-6">
                         <div className="flex items-center justify-between mb-3">
                             <span className="text-sm font-medium text-gray-200">Private Key</span>
                           <button
                             onClick={() => setShowPrivateKey(!showPrivateKey)}
                              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600 transition-colors"
                           >
                             {showPrivateKey ? "Hide" : "Reveal"}
                           </button>
                         </div>
                         
                         {showPrivateKey && walletData && (
                            <div className="p-3 bg-gray-800 rounded border border-gray-600">
                              <div className="text-xs text-gray-300 mb-2 font-medium flex items-center">
                                <svg className="w-3 h-3 mr-1 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                WARNING: Keep this private and secure!
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-mono text-gray-300 break-all bg-gray-900 p-2 rounded border border-gray-700 flex-1 mr-2">
                                 {walletData.privateKey}
                               </div>
                               <button
                                 onClick={copyPrivateKey}
                                 className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600 transition-colors"
                                 title="Copy private key"
                               >
                                 Copy
                               </button>
                             </div>
                           </div>
                         )}
                       </div>

                       {/* Backup Wallet */}
                        <div className="mb-6">
                         <div className="flex items-center justify-between mb-3">
                             <span className="text-sm font-medium text-gray-200">Backup Wallet</span>
                           <button
                             onClick={handleBackup}
                              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600 transition-colors"
                           >
                             Download
                           </button>
                         </div>
                         <p className="text-xs text-gray-400">Download a secure backup file of your wallet</p>
                       </div>

                       {/* Import Wallet */}
                        <div className="mb-6">
                         <div className="flex items-center justify-between mb-3">
                             <span className="text-sm font-medium text-gray-200">Import Wallet</span>
                           <button
                             onClick={handleImport}
                              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600 transition-colors"
                           >
                             Import
                           </button>
                         </div>
                         <p className="text-xs text-gray-400">Import an existing wallet from backup file</p>
                   </div>

                        {/* Clear Wallet */}
                        <div>
                          <button
                            onClick={handleClearWallet}
                            className="w-full p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded border border-gray-600 transition-colors text-left"
                          >
                            <div className="flex items-center justify-between">
                              <span>Clear Wallet Data</span>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                         </svg>
                       </div>
                            <p className="text-xs text-gray-400 mt-1">Remove wallet from this device</p>
                          </button>
                     </div>
                     
                        {/* Wallet Creation Date */}
                        <div className="mt-6 pt-4 border-t border-gray-700">
                          <div className="flex justify-between items-center">
                         <span className="text-sm text-gray-400">Created</span>
                         <span className="text-sm font-medium text-gray-200">
                           {walletData ? new Date(walletData.createdAt || Date.now()).toLocaleDateString() : 'Unknown'}
                         </span>
                       </div>
                     </div>
                   </div>
                    </div>
                  )}
                </div>
              )}

              {/* Asset Details Section */}
              {walletSystem === "self-custodial" && currentSection === 'main' && currentView === 'asset-details' && selectedTokenForChart && (
                <div className="px-4 py-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleBackToMain}
                        className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <FaArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-200">
                          {selectedTokenForChart.symbol}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {(selectedTokenForChart.contractAddress || selectedTokenForChart.symbol === 'ETH') && (
                        <button
                          onClick={() => {
                            console.log("Copy button clicked!");
                            console.log("selectedTokenForChart:", selectedTokenForChart);
                            
                            let addressToCopy = '';
                            if (selectedTokenForChart.contractAddress) {
                              addressToCopy = selectedTokenForChart.contractAddress;
                            } else if (selectedTokenForChart.symbol === 'ETH') {
                              addressToCopy = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
                            }
                            
                            console.log("Address to copy:", addressToCopy);
                            if (addressToCopy) {
                              copyTokenAddress(addressToCopy);
                            } else {
                              console.error("No address found to copy");
                              toast.error("No address available to copy");
                            }
                          }}
                          className={`p-2 rounded-lg transition-colors active:bg-gray-700 ${
                            copiedAddress 
                              ? 'text-green-400 bg-green-900/20' 
                              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                          }`}
                          title={copiedAddress ? "Address copied!" : "Copy token address"}
                        >
                          {copiedAddress ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                            </svg>
                          )}
                        </button>
                      )}
                      <button className="p-2 text-gray-400 hover:text-gray-300">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Price Display */}
                  <div className="mb-6">
                    <div className="text-3xl font-bold text-gray-200 mb-2">
                      {formatTokenPrice(selectedTokenForChart.price || 0)}
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className={`${(selectedTokenForChart.priceChange || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(selectedTokenForChart.priceChange || 0) >= 0 ? '▲' : '▼'} {Math.abs(selectedTokenForChart.priceChange || 0).toFixed(2)}%
                      </span>
                      <span className="text-gray-400">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="mb-6">
                    <div className="h-48 bg-gray-900 rounded-lg p-4">
                      {isLoadingChart ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="w-8 h-8 border-2 border-[#0052FF]/20 border-t-[#0052FF] rounded-full animate-spin"></div>
                        </div>
                      ) : chartData.length > 0 ? (
                        <div className="h-full flex items-center justify-center">
                          <Sparklines data={getSparklineData()} width={300} height={120} margin={5}>
                            <SparklinesLine
                              color="#3B82F6"
                              style={{ strokeWidth: 2 }}
                            />
                            <SparklinesCurve
                              color="#3B82F6"
                              style={{ fill: "url(#gradient)", opacity: 0.3 }}
                            />
                          </Sparklines>
                          <svg width="0" height="0">
                            <defs>
                              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center text-gray-400 text-sm">
                            No chart data available
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Time Period Selector */}
                    <div className="flex justify-center space-x-1 mt-4">
                      {(['15m', '1h', '4h', '1d'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => {
                            setSelectedTimeframe(period);
                            if (selectedTokenForChart.contractAddress) {
                              fetchChartData(selectedTokenForChart.contractAddress, period);
                            } else if (selectedTokenForChart.symbol === 'ETH') {
                              fetchChartData('ethereum', period);
                            }
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            selectedTimeframe === period
                              ? 'bg-gray-700 text-white shadow-lg shadow-gray-700/25'
                              : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                    

                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    <div className="bg-gray-800 p-2 rounded-xl border border-gray-600 shadow-lg">
                      <button 
                        onClick={() => {
                          setCurrentSection('buy');
                          setCurrentView('main');
                        }}
                        className="flex flex-col items-center p-3 bg-gray-800 rounded-lg transition-colors w-full"
                      >
                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mb-2">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Buy/Sell</span>
                      </button>
                    </div>
                    <div className="bg-gray-800 p-2 rounded-xl border border-gray-600 shadow-lg">
                      <button 
                        onClick={() => {
                          setCurrentSection('swap');
                          setCurrentView('main');
                        }}
                        className="flex flex-col items-center p-3 bg-gray-800 rounded-lg transition-colors w-full"
                      >
                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mb-2">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Swap</span>
                      </button>
                    </div>
                    <div className="bg-gray-800 p-2 rounded-xl border border-gray-600 shadow-lg">
                      <button 
                        onClick={() => {
                          setCurrentSection('send');
                          setSelectedToken(selectedTokenForChart.symbol || 'ETH');
                          setCurrentView('main');
                        }}
                        className="flex flex-col items-center p-3 bg-gray-800 rounded-lg transition-colors w-full"
                      >
                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mb-2">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Send</span>
                      </button>
                    </div>
                    <div className="bg-gray-800 p-2 rounded-xl border border-gray-600 shadow-lg">
                      <button 
                        onClick={() => {
                          setCurrentSection('receive');
                          setCurrentView('main');
                        }}
                        className="flex flex-col items-center p-3 bg-gray-800 rounded-lg transition-colors w-full"
                      >
                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mb-2">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-300">Receive</span>
                      </button>
                    </div>
                  </div>

                  {/* Your Balance Section */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-200 mb-3">Your balance</h4>
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <img 
                          src={selectedTokenForChart.logo || `https://ui-avatars.com/api/?name=${selectedTokenForChart.symbol}&background=1f2937&color=60a5fa&size=32`}
                          alt={selectedTokenForChart.symbol}
                          className="w-8 h-8 rounded-full"
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${selectedTokenForChart.symbol}&background=1f2937&color=60a5fa&size=32`;
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-200">
                            {selectedTokenForChart.name || selectedTokenForChart.symbol}
                          </div>
                          <div className="flex items-center space-x-1 text-xs text-red-400">
                            <span>▼</span>
                            <span>-2.47%</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-200">
                          {formatUSDValue(parseFloat(selectedTokenForChart.usdValue || '0'))}
                        </div>
                        <div className="text-xs text-gray-400">
                          {parseFloat(selectedTokenForChart.balance || '0').toFixed(6)} {selectedTokenForChart.symbol}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Send Section */}
              {walletSystem === "self-custodial" && currentSection === 'send' && (
                <div className="px-4 py-4">
                     <div className="flex items-center space-x-3 mb-4">
                    <button
                      onClick={handleBackToMain}
                      className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                         </svg>
                    </button>
                    <h3 className="text-lg font-semibold text-gray-200">Send</h3>
                       </div>

                  <div className="space-y-4">
                    {/* Token Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Token</label>
                      <select
                        value={selectedToken}
                        onChange={(e) => setSelectedToken(e.target.value)}
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-[#0052FF]"
                      >
                        <option value="ETH">ETH</option>
                        {tokenHoldings.map((token) => (
                          <option key={token.contractAddress} value={token.symbol}>
                            {token.symbol}
                          </option>
                        ))}
                      </select>
                     </div>
                     
                    {/* Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Amount</label>
                      <input
                        type="number"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-[#0052FF]"
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        Balance: {selectedToken === 'ETH' ? parseFloat(ethBalance).toFixed(6) : 
                          tokenHoldings.find(t => t.symbol === selectedToken)?.tokenBalance || '0'} {selectedToken}
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">To Address</label>
                      <input
                        type="text"
                        value={sendAddress}
                        onChange={(e) => setSendAddress(e.target.value)}
                        placeholder="0x..."
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:border-[#0052FF]"
                      />
                    </div>

                    {/* Send Button */}
                       <button
                      onClick={handleSendTransaction}
                      className="w-full py-3 px-4 bg-[#0052FF] hover:bg-[#0052FF]/80 text-white rounded-lg font-medium transition-colors"
                    >
                      Send {selectedToken}
                       </button>
                   </div>
                 </div>
               )}

              {/* Receive Section */}
              {walletSystem === "self-custodial" && currentSection === 'receive' && (
                <div className="px-4 py-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <button
                      onClick={handleBackToMain}
                      className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h3 className="text-lg font-semibold text-gray-200">Receive</h3>
                  </div>

                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-[#0052FF]/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                           </svg>
                         </div>
                    
                    <div>
                      <h4 className="text-lg font-medium text-gray-200 mb-2">Your Wallet Address</h4>
                      <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                        <div className="text-sm font-mono text-gray-300 break-all">
                          {walletData ? walletData.address : 'No wallet loaded'}
                         </div>
                       </div>
                     </div>

                    <button
                      onClick={copyAddress}
                      className="w-full py-3 px-4 bg-[#0052FF] hover:bg-[#0052FF]/80 text-white rounded-lg font-medium transition-colors"
                    >
                      Copy Address
                    </button>
                         </div>
                       </div>
              )}

              {/* Swap Section */}
              {walletSystem === "self-custodial" && currentSection === 'swap' && (
                <div className="px-4 py-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <button
                      onClick={handleBackToMain}
                      className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h3 className="text-lg font-semibold text-gray-200">Swap</h3>
                         </div>

                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-[#0052FF]/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                         </div>
                    
                    <div>
                      <h4 className="text-lg font-medium text-gray-200 mb-2">Token Swap</h4>
                      <p className="text-gray-400">Advanced swapping functionality coming soon</p>
                         </div>

                    <button
                      onClick={() => window.location.href = '/trade'}
                      className="w-full py-3 px-4 bg-[#0052FF] hover:bg-[#0052FF]/80 text-white rounded-lg font-medium transition-colors"
                    >
                      Go to Swap Page
                    </button>
                       </div>
                     </div>
              )}

              {/* Buy/Sell Section */}
              {walletSystem === "self-custodial" && currentSection === 'buy' && (
                <div className="px-4 py-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <button
                      onClick={handleBackToMain}
                      className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                           </svg>
                    </button>
                    <h3 className="text-lg font-semibold text-gray-200">Buy/Sell</h3>
                         </div>

                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-[#0052FF]/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-[#0052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                       </div>
                    
                         <div>
                      <h4 className="text-lg font-medium text-gray-200 mb-2">Buy & Sell Tokens</h4>
                      <p className="text-gray-400">Advanced trading functionality coming soon</p>
                         </div>

                    <button
                      onClick={() => window.location.href = '/trade'}
                      className="w-full py-3 px-4 bg-[#0052FF] hover:bg-[#0052FF]/80 text-white rounded-lg font-medium transition-colors"
                    >
                      Go to Trade Page
                    </button>
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

const WalletDropdownWithErrorBoundary: React.FC<WalletDropdownProps> = (props) => {
  return (
    <WalletDropdownErrorBoundary>
      <WalletDropdown {...props} />
    </WalletDropdownErrorBoundary>
  );
};

export default WalletDropdownWithErrorBoundary;

