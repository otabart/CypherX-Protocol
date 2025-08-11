"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { FaWallet, FaExchangeAlt, FaInfoCircle, FaChartLine } from "react-icons/fa";
import { SiEthereum } from "react-icons/si";
import { ethers } from "ethers";
import { toast } from "react-hot-toast";
import debounce from "lodash/debounce";

// ────────────────────────────────────────────────────────────────────────────────
// 1) TYPES
// ────────────────────────────────────────────────────────────────────────────────
interface TokenMetadata {
  poolAddress: string;
  pairAddress: string;
  baseToken: { name: string; symbol: string; address: string };
  quoteToken: { name: string; symbol: string; address: string };
  priceUsd: string;
  liquidity: { usd: number };
  marketCap: number;
  fdv: number;
  bannerUrl?: string;
  logoUrl?: string;
  adImageUrl?: string;
  priceChange?: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
}

interface SwapProps {
  token: TokenMetadata | null;
  ethPrice: number;
}

interface PnLData {
  totalPnL: number;
  totalVolume: number;
  totalTrades: number;
  winRate: number;
  dailyPnL: Array<{ date: string; pnl: number }>;
  recentTrades: Array<{
    id: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    timestamp: number;
    type: 'buy' | 'sell';
  }>;
}

// ────────────────────────────────────────────────────────────────────────────────
// 2) MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────────────
const Swap: React.FC<SwapProps> = ({ token }) => {
  // State
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("");
  const [isSwapLoading, setIsSwapLoading] = useState<boolean>(false);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [showSlippageModal, setShowSlippageModal] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [showPnLModal, setShowPnLModal] = useState<boolean>(false);
  
  // Self-custodial wallet state
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<string>("0.0");
  const [tokenBalance, setTokenBalance] = useState<string>("0.0");
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  
  // PnL State
  const [pnlData, setPnlData] = useState<PnLData | null>(null);

  // ────────────────────────────────────────────────────────────────────────────────
  // 3) WALLET MANAGEMENT
  // ────────────────────────────────────────────────────────────────────────────────
  const loadWallet = useCallback(() => {
    if (typeof window !== "undefined") {
      const storedWallet = localStorage.getItem("cypherx_wallet");
      if (storedWallet) {
        try {
          const walletData = JSON.parse(storedWallet);
          const wallet = new ethers.Wallet(walletData.privateKey);
          setWalletAddress(wallet.address);
          setIsWalletConnected(true);
          fetchBalances(wallet.address);
          fetchPnLData(wallet.address);
        } catch (error) {
          console.error("Error loading wallet:", error);
          toast.error("Failed to load wallet");
        }
      }
    }
  }, []);

  const createWallet = useCallback(() => {
    try {
      const wallet = ethers.Wallet.createRandom();
      const walletData = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase,
      };
      
      localStorage.setItem("cypherx_wallet", JSON.stringify(walletData));
      setWalletAddress(wallet.address);
      setIsWalletConnected(true);
      fetchBalances(wallet.address);
      fetchPnLData(wallet.address);
      toast.success("Wallet created successfully!");
    } catch (error) {
      console.error("Error creating wallet:", error);
      toast.error("Failed to create wallet");
    }
  }, []);

  const fetchBalances = useCallback(async (address: string) => {
    if (!address) return;

    try {
      console.log("🔄 Fetching balances for address:", address);
      
      // Fetch ETH balance
      const ethResponse = await fetch(`/api/wallet/balance?address=${address}`);
      if (ethResponse.ok) {
        const ethData = await ethResponse.json();
        console.log("✅ ETH balance response:", ethData);
        setEthBalance(ethData.ethBalance || "0.0");
      } else {
        console.error("❌ ETH balance response not ok:", ethResponse.status);
      }
      
      // Fetch token balance if we have a token
      if (token?.baseToken.address) {
        const tokenResponse = await fetch(`/api/wallet/balance?address=${address}&tokenAddress=${token.baseToken.address}`);
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          console.log("✅ Token balance response:", tokenData);
          setTokenBalance(tokenData.tokenBalance || "0.0");
        } else {
          console.error("❌ Token balance response not ok:", tokenResponse.status);
        }
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
      // Set fallback values
      setEthBalance("0.0");
      setTokenBalance("0.0");
    }
  }, [token]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 4) QUOTE FETCHING
  // ────────────────────────────────────────────────────────────────────────────────
  const getQuote = useCallback(async (amount: string) => {
    if (!token || !amount || parseFloat(amount) <= 0 || !walletAddress) return;

    setQuoteLoading(true);
    try {
      const response = await fetch("/api/swap/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputToken: activeTab === "buy" ? "ETH" : token.baseToken.symbol,
          outputToken: activeTab === "buy" ? token.baseToken.symbol : "ETH",
          inputAmount: amount,
          walletAddress: walletAddress,
          tokenAddress: token.baseToken.address, // Add token address for better quotes
        }),
      });

      if (response.ok) {
        const quote = await response.json();
        console.log("✅ Quote received:", quote);
        
        // Check if we got a valid quote
        if (quote.outputAmount && parseFloat(quote.outputAmount) > 0) {
          console.log("✅ Setting amountOut to:", quote.outputAmount);
          setAmountOut(quote.outputAmount);
        } else {
          console.log("⚠️ Quote outputAmount is invalid, using fallback");
          // Fallback calculation if quote is invalid
          const inputAmount = parseFloat(amount);
          const tokenPrice = parseFloat(token?.priceUsd || "0");
          if (tokenPrice > 0) {
            const estimatedOutput = activeTab === "buy" ? inputAmount / tokenPrice : inputAmount * tokenPrice;
            console.log("✅ Fallback calculation:", estimatedOutput.toFixed(6));
            setAmountOut(estimatedOutput.toFixed(6));
          }
        }
      } else {
        const errorData = await response.json();
        console.error("Failed to get quote:", errorData);
        // Show fallback calculation
        const inputAmount = parseFloat(amount);
        const tokenPrice = parseFloat(token?.priceUsd || "0");
        if (tokenPrice > 0) {
          const estimatedOutput = activeTab === "buy" ? inputAmount / tokenPrice : inputAmount * tokenPrice;
          setAmountOut(estimatedOutput.toFixed(6));
        }
      }
    } catch (error) {
      console.error("Error fetching quote:", error);
      setAmountOut("");
      // Show fallback calculation
      const inputAmount = parseFloat(amount);
      const tokenPrice = parseFloat(token?.priceUsd || "0");
      if (tokenPrice > 0) {
        const estimatedOutput = activeTab === "buy" ? inputAmount / tokenPrice : inputAmount * tokenPrice;
        setAmountOut(estimatedOutput.toFixed(6));
      }
    } finally {
      setQuoteLoading(false);
    }
  }, [token, activeTab, walletAddress]);

  const debouncedGetQuote = useMemo(
    () => debounce((amount: string) => {
      console.log("🔄 Debounced quote called with amount:", amount);
      getQuote(amount);
    }, 500),
    [getQuote]
  );

  // ────────────────────────────────────────────────────────────────────────────────
  // 5) SWAP EXECUTION WITH WALLET SIGNING
  // ────────────────────────────────────────────────────────────────────────────────
  const executeSwap = useCallback(async () => {
    console.log("Execute swap called with:", { amountIn, amountOut, activeTab, isWalletConnected, walletAddress });
    
    if (!isWalletConnected || !walletAddress || !amountIn || !token) {
      toast.error("Please connect wallet and enter amounts");
      return;
    }

    setIsSwapLoading(true);
    try {
      // Step 1: Prepare transaction data
      console.log("📋 Preparing transaction data...");
      const prepareResponse = await fetch("/api/swap/prepare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputToken: activeTab === "buy" ? "ETH" : token.baseToken.symbol,
          outputToken: activeTab === "buy" ? token.baseToken.symbol : "ETH",
          inputAmount: amountIn,
          outputAmount: amountOut,
          slippage: slippage,
          walletAddress: walletAddress,
          tokenAddress: token.baseToken.address,
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || "Failed to prepare transaction");
      }

      const prepareResult = await prepareResponse.json();
      console.log("✅ Transaction data prepared:", {
        to: prepareResult.transactionData.to,
        dataLength: prepareResult.transactionData.data.length,
        dataPreview: prepareResult.transactionData.data.substring(0, 66) + "...",
        gasLimit: prepareResult.transactionData.gasLimit,
        value: prepareResult.transactionData.value,
        nonce: prepareResult.transactionData.nonce
      });
      
      // Step 2: Get wallet and sign transaction
      console.log("🔐 Signing transaction with wallet...");
      const storedWallet = localStorage.getItem("cypherx_wallet");
      if (!storedWallet) {
        throw new Error("Wallet not found");
      }

      const walletData = JSON.parse(storedWallet);
      const wallet = new ethers.Wallet(walletData.privateKey);
      
      // Ensure transaction data has all required fields - keep everything as strings for ethers.js
      const txData = {
        to: prepareResult.transactionData.to,
        data: prepareResult.transactionData.data, // This is the encoded function call
        nonce: parseInt(prepareResult.transactionData.nonce || "0"),
        gasLimit: prepareResult.transactionData.gasLimit,
        maxFeePerGas: prepareResult.transactionData.maxFeePerGas,
        maxPriorityFeePerGas: prepareResult.transactionData.maxPriorityFeePerGas,
        value: prepareResult.transactionData.value,
        chainId: 8453 // Base chain ID
      };
      
      // Use the transaction data directly since it's already in the correct format
      const transactionToSign = {
        to: txData.to,
        data: txData.data,
        nonce: txData.nonce,
        gasLimit: txData.gasLimit,
        maxFeePerGas: txData.maxFeePerGas,
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas,
        value: txData.value,
        chainId: txData.chainId
      };
      
      // Ensure the data field is properly formatted as a hex string
      if (transactionToSign.data && !transactionToSign.data.startsWith('0x')) {
        transactionToSign.data = '0x' + transactionToSign.data;
      }
      
      // Validate transaction data before signing
      if (!transactionToSign.data || transactionToSign.data === "0x" || transactionToSign.data.length < 10) {
        throw new Error("Invalid transaction data - missing or empty function call");
      }
      
      if (!transactionToSign.to || transactionToSign.to === "0x0000000000000000000000000000000000000000") {
        throw new Error("Invalid transaction recipient address");
      }
      
      console.log("📋 Transaction data to sign:", {
        to: transactionToSign.to,
        data: transactionToSign.data.substring(0, 66) + "...", // Show first part of encoded data
        dataLength: transactionToSign.data.length,
        nonce: transactionToSign.nonce,
        gasLimit: transactionToSign.gasLimit,
        maxFeePerGas: transactionToSign.maxFeePerGas,
        maxPriorityFeePerGas: transactionToSign.maxPriorityFeePerGas,
        value: transactionToSign.value,
        chainId: transactionToSign.chainId
      });
      
      // Sign the transaction
      console.log("🔐 Signing transaction with wallet...");
      console.log("📋 Final transaction data being signed:", {
        to: transactionToSign.to,
        dataLength: transactionToSign.data.length,
        dataPreview: transactionToSign.data.substring(0, 66) + "...",
        nonce: transactionToSign.nonce,
        gasLimit: transactionToSign.gasLimit,
        maxFeePerGas: transactionToSign.maxFeePerGas,
        maxPriorityFeePerGas: transactionToSign.maxPriorityFeePerGas,
        value: transactionToSign.value,
        chainId: transactionToSign.chainId
      });
      
      const signedTx = await wallet.signTransaction(transactionToSign);
      console.log("✅ Transaction signed:", signedTx.substring(0, 66) + "...");
      console.log("📏 Signed transaction length:", signedTx.length);
      
      // Step 3: Submit signed transaction
      console.log("🚀 Submitting signed transaction...");
      const submitResponse = await fetch("/api/swap/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signedTransaction: signedTx,
          inputToken: activeTab === "buy" ? "ETH" : token.baseToken.symbol,
          outputToken: activeTab === "buy" ? token.baseToken.symbol : "ETH",
          inputAmount: amountIn,
          outputAmount: amountOut,
          walletAddress: walletAddress,
          tokenAddress: token.baseToken.address,
        }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        throw new Error(errorData.error || "Failed to submit transaction");
      }

      const submitResult = await submitResponse.json();
      toast.success(`Swap completed! Hash: ${submitResult.transactionHash.slice(0, 10)}...`);
      
      // Refresh balances and PnL
      fetchBalances(walletAddress);
      fetchPnLData(walletAddress);
      
      // Clear form
      setAmountIn("");
      setAmountOut("");
    } catch (error) {
      console.error("Swap execution error:", error);
      toast.error(error instanceof Error ? error.message : "Swap failed");
    } finally {
      setIsSwapLoading(false);
    }
  }, [isWalletConnected, walletAddress, amountIn, amountOut, token, activeTab, slippage, fetchBalances]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 6) PnL TRACKING
  // ────────────────────────────────────────────────────────────────────────────────
  const fetchPnLData = useCallback(async (address: string) => {
    if (!address) return;

    try {
      const response = await fetch(`/api/wallet/pnl?address=${address}&timeframe=30d`);
      if (response.ok) {
        const data = await response.json();
        setPnlData(data);
      }
    } catch (error) {
      console.error("Error fetching PnL data:", error);
    }
  }, []);

  // ────────────────────────────────────────────────────────────────────────────────
  // 7) EVENT HANDLERS
  // ────────────────────────────────────────────────────────────────────────────────
  
  const handleAmountChange = useCallback((value: string) => {
    setAmountIn(value);
    if (value && parseFloat(value) > 0) {
      console.log("Fetching quote for amount:", value);
      debouncedGetQuote(value);
    } else {
      setAmountOut("");
    }
  }, [debouncedGetQuote, token, activeTab]);

  const handleQuickAmount = useCallback((percent: number) => {
    const balance = activeTab === "buy" ? parseFloat(ethBalance) : parseFloat(tokenBalance);
    const amount = (balance * percent) / 100;
    handleAmountChange(amount.toFixed(4));
  }, [ethBalance, tokenBalance, activeTab, handleAmountChange]);

  const handleSwapDirection = useCallback(() => {
    setActiveTab(activeTab === "buy" ? "sell" : "buy");
    setAmountIn("");
    setAmountOut("");
  }, [activeTab]);

  const copyAddress = useCallback(() => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success("Address copied to clipboard!");
    }
  }, [walletAddress]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 8) EFFECTS
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    if (token) {
      fetchBalances(walletAddress);
    }
  }, [token, walletAddress, fetchBalances]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 9) RENDER
  // ────────────────────────────────────────────────────────────────────────────────
  const isSwapReady = amountIn && parseFloat(amountIn) > 0 && isWalletConnected && walletAddress;

  return (
    <div className="bg-gray-900 rounded-lg border border-blue-500/20 p-4 h-full flex flex-col">
      {/* Clean Token Info Header */}
      {token && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-800 rounded-lg border border-blue-500/20">
          {token.logoUrl && (
            <img
              src={token.logoUrl}
              alt={`${token.baseToken.name} logo`}
              className="w-8 h-8 rounded-full border border-blue-500/20"
              onError={(e) => {
                e.currentTarget.src = "https://via.placeholder.com/32";
              }}
            />
          )}
          <div className="flex-1">
            <h3 className="font-bold text-gray-200 text-sm">
              {token.baseToken.name} ({token.baseToken.symbol})
            </h3>
            <p className="text-xs text-gray-400">
              {token.baseToken.symbol}/ETH • ${parseFloat(token.priceUsd).toFixed(6)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSlippageModal(true)}
              className="text-xs bg-gray-700 hover:bg-blue-500/20 text-blue-400 px-2 py-1 rounded transition"
            >
              {slippage}%
            </button>
            <button
              onClick={() => setShowInfoModal(true)}
              className="text-blue-400 hover:text-blue-300 transition"
              title="Swap Info"
            >
              <FaInfoCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Wallet Connection */}
      {!isWalletConnected ? (
        <div className="flex flex-col items-center justify-center py-8">
          <FaWallet className="w-10 h-10 text-gray-400 mb-3" />
          <p className="text-gray-400 mb-3 text-sm">Create or load your CypherX wallet to start swapping</p>
          <div className="flex gap-2">
            <button
              onClick={createWallet}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition text-sm"
            >
              Create Wallet
            </button>
            <button
              onClick={loadWallet}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold transition text-sm"
            >
              Load Wallet
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Wallet Info */}
          <div className="bg-gray-800 rounded-lg p-3 mb-4 border border-blue-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200">
                  <span className="text-blue-400 font-bold">X</span>Wallet
                </span>
              </div>
              <button
                onClick={copyAddress}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Copy
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-gray-300">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            </div>
          </div>

          {/* Swap Interface */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-blue-500/20">
            {/* Token Selection Tabs */}
            <div className="flex bg-gray-700 rounded-lg p-1 mb-4">
              <button
                onClick={() => setActiveTab("buy")}
                className={`flex-1 py-2 px-3 rounded-md font-bold transition text-sm ${
                  activeTab === "buy"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Buy Token
              </button>
              <button
                onClick={() => setActiveTab("sell")}
                className={`flex-1 py-2 px-3 rounded-md font-bold transition text-sm ${
                  activeTab === "sell"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Sell Token
              </button>
            </div>

            {/* Input Section */}
            <div className="mb-3">
              <label className="block text-xs text-gray-400 font-bold mb-1 uppercase">
                YOU PAY
              </label>
              <div className="bg-gray-700 rounded-lg p-3 border border-blue-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">
                    Balance: {activeTab === "buy" ? `${parseFloat(ethBalance).toFixed(4)} ETH` : `${parseFloat(tokenBalance).toFixed(4)} ${token?.baseToken.symbol}`}
                  </span>
                  <div className="flex gap-1">
                    {[25, 50, 75, 100].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => handleQuickAmount(percent)}
                        className="text-xs bg-gray-600 hover:bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded transition"
                      >
                        {percent === 100 ? "Max" : `${percent}%`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="font-bold text-gray-200 mr-2 text-sm">
                    {activeTab === "buy" ? "ETH" : token?.baseToken.symbol}
                  </span>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={amountIn}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="flex-1 bg-transparent text-gray-200 text-base font-mono outline-none border-none min-w-0"
                    disabled={isSwapLoading}
                  />
                </div>
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center my-3">
              <button
                onClick={handleSwapDirection}
                className="bg-gray-700 border border-blue-500/20 rounded-full p-2 hover:bg-blue-500/10 transition"
                disabled={isSwapLoading}
              >
                <FaExchangeAlt className="w-4 h-4 text-blue-400" />
              </button>
            </div>

            {/* Output Section */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 font-bold mb-1 uppercase">
                YOU RECEIVE
              </label>
              <div className="bg-gray-700 rounded-lg p-3 border border-blue-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">
                    {quoteLoading ? "Fetching quote..." : amountOut ? "Estimated" : "Enter amount above"}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="font-bold text-gray-200 mr-2 text-sm">
                    {activeTab === "buy" ? token?.baseToken.symbol : "ETH"}
                  </span>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={amountOut || ""}
                    disabled
                    className="flex-1 bg-transparent text-gray-400 text-base font-mono outline-none border-none min-w-0"
                  />
                </div>
              </div>
            </div>

            {/* Main Action Button */}
            <button
              onClick={executeSwap}
              className={`w-full py-3 rounded-lg font-bold transition text-sm ${
                isSwapReady
                  ? activeTab === "buy"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
              disabled={!isSwapReady || isSwapLoading}
            >
              {isSwapLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                `${activeTab === "buy" ? "Buy" : "Sell"} ${token?.baseToken.symbol}`
              )}
            </button>
          </div>

          {/* PnL Stats Section - Below Swap Interface */}
          {pnlData && (
            <div className="bg-gray-800 rounded-lg p-4 border border-blue-500/20">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-400 mb-2">Bought</span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-blue-400">0</span>
                    <SiEthereum className="w-4 h-4 text-blue-400" />
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-400 mb-2">Sold</span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-red-400">0</span>
                    <SiEthereum className="w-4 h-4 text-red-400" />
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-400 mb-2">Holding</span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-purple-400">0</span>
                    <SiEthereum className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-gray-400">PnL</span>
                    <button
                      onClick={() => setShowPnLModal(true)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <FaChartLine className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-lg font-bold ${pnlData.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {pnlData.totalPnL >= 0 ? "+" : ""}{pnlData.totalPnL.toFixed(2)}%
                    </span>
                    <SiEthereum className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showSlippageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 border border-blue-500/20 w-80">
            <h3 className="text-lg font-bold mb-4">Set Slippage</h3>
            <div className="space-y-3">
              {[0.1, 0.5, 1.0, 2.0].map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    setSlippage(value);
                    setShowSlippageModal(false);
                  }}
                  className={`w-full py-2 rounded-lg transition ${
                    slippage === value
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSlippageModal(false)}
              className="w-full mt-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 border border-blue-500/20 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">CypherSwap Info</h3>
            <div className="space-y-3 text-sm text-gray-300">
              <p>CypherSwap provides secure, decentralized token swapping on Base chain.</p>
              <p>Features include:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Multi-DEX quote aggregation</li>
                <li>Real-time PnL tracking</li>
                <li>Self-custodial wallet integration</li>
                <li>Gas optimization</li>
                <li>MEV protection</li>
              </ul>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full mt-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showPnLModal && pnlData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 border border-blue-500/20 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">PnL Tracking</h3>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs">Total PnL</div>
                  <div className={`font-bold ${pnlData.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pnlData.totalPnL >= 0 ? "+" : ""}{pnlData.totalPnL.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs">Win Rate</div>
                  <div className="text-green-400 font-bold">{pnlData.winRate.toFixed(1)}%</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs">Volume</div>
                  <div className="text-blue-400 font-bold">${pnlData.totalVolume.toFixed(2)}</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg">
                  <div className="text-gray-400 text-xs">Trades</div>
                  <div className="text-purple-400 font-bold">{pnlData.totalTrades}</div>
                </div>
              </div>
              
              {pnlData.recentTrades.length > 0 && (
                <div>
                  <h4 className="font-bold mb-2">Recent Trades</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pnlData.recentTrades.slice(0, 5).map((trade) => (
                      <div key={trade.id} className="bg-gray-800 p-2 rounded text-xs">
                        <div className="flex justify-between">
                          <span className={trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                            {trade.type.toUpperCase()} {trade.tokenOut}
                          </span>
                          <span className="text-gray-400">
                            {new Date(trade.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowPnLModal(false)}
              className="w-full mt-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Swap;