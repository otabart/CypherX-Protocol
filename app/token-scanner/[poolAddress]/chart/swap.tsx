"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { FaWallet, FaExchangeAlt, FaInfoCircle } from "react-icons/fa";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useAccount, useConnect } from "wagmi";
import debounce from "lodash/debounce";

// ────────────────────────────────────────────────────────────────────────────────
// 1) CONSTANTS & ABIs
// ────────────────────────────────────────────────────────────────────────────────
const SWAP_ROUTER_ADDRESS = "0x2626664c2603336E57B271c5C0b26F421741e481"; // Uniswap V3 SwapRouter02 on Base
const QUOTER_ADDRESS = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"; // Uniswap V3 QuoterV2 on Base
const ETH_ADDRESS = ethers.ZeroAddress;

const QUOTER_ABI = [
  {
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "fee", type: "uint24" },
      { name: "sqrtPriceLimitX96", type: "uint160" },
    ],
    name: "quoteExactInputSingle",
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const SWAP_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
      { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
        name: "exactInputSingle",
        type: "function",
        stateMutability: "payable",
      },
    ],
    name: "exactInputSingle",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
];

const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

// ────────────────────────────────────────────────────────────────────────────────
// 2) TYPES
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

interface SwapToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

// ────────────────────────────────────────────────────────────────────────────────
// 3) MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────────────
const Swap: React.FC<SwapProps> = ({ token, ethPrice }) => {
  // State
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("");
  const [tokenIn, setTokenIn] = useState<SwapToken | null>(null);
  const [tokenOut, setTokenOut] = useState<SwapToken | null>(null);
  const [isSwapLoading, setIsSwapLoading] = useState<boolean>(false);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [gasEstimate, setGasEstimate] = useState<string>("0");
  const [walletBalance, setWalletBalance] = useState<string>("0.0");
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [showSlippageModal, setShowSlippageModal] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // PnL State
  const [boughtAmount, setBoughtAmount] = useState<number>(0);
  const [soldAmount, setSoldAmount] = useState<number>(0);
  const [profitLoss] = useState<number>(0);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();

  // Provider
  const provider = useMemo(() => new ethers.JsonRpcProvider("https://mainnet.base.org"), []);

  // ────────────────────────────────────────────────────────────────────────────────
  // 4) UTILITY FUNCTIONS
  // ────────────────────────────────────────────────────────────────────────────────
  const setupSigner = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        setSigner(signer);
        return signer;
      } catch (error) {
        console.error("Failed to setup signer:", error);
        return null;
      }
    }
    return null;
  }, []);

  const fetchTokenData = useCallback(async () => {
    if (!token) return;

    try {
      // Set up tokens based on active tab
      if (activeTab === "buy") {
        // Buying token with ETH
        setTokenIn({
          address: ETH_ADDRESS,
          symbol: "ETH",
          name: "Ethereum",
          decimals: 18,
        });
        setTokenOut({
      address: token.baseToken.address,
      symbol: token.baseToken.symbol,
      name: token.baseToken.name,
          decimals: 18, // Most tokens use 18 decimals
        });
    } else {
        // Selling token for ETH
        setTokenIn({
          address: token.baseToken.address,
          symbol: token.baseToken.symbol,
          name: token.baseToken.name,
          decimals: 18,
        });
        setTokenOut({
          address: ETH_ADDRESS,
          symbol: "ETH",
          name: "Ethereum",
          decimals: 18,
        });
      }
    } catch (error) {
      console.error("Error fetching token data:", error);
      }
  }, [token, activeTab]);

  const fetchEthBalance = useCallback(async () => {
    if (!address || !provider) return;

      try {
      const balance = await provider.getBalance(address);
      const ethBalance = parseFloat(ethers.formatEther(balance));
      setWalletBalance(ethBalance.toFixed(4));
    } catch (error) {
      console.error("Error fetching ETH balance:", error);
      }
  }, [address, provider]);

  const fetchTokenBalance = useCallback(async () => {
    if (!address || !provider || !tokenIn || tokenIn.address === ETH_ADDRESS) return;

    try {
      const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(address);
      const tokenBalance = parseFloat(ethers.formatUnits(balance, tokenIn.decimals));
      setWalletBalance(tokenBalance.toFixed(4));
    } catch (error) {
      console.error("Error fetching token balance:", error);
      }
  }, [address, provider, tokenIn]);

  const checkAllowance = useCallback(async () => {
    if (!address || !signer || !tokenIn || tokenIn.address === ETH_ADDRESS) {
      setIsApproved(true);
        return;
      }

      try {
      const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(address, SWAP_ROUTER_ADDRESS);
      const amountInWei = ethers.parseUnits(amountIn || "0", tokenIn.decimals);
      setIsApproved(allowance >= amountInWei);
    } catch (error) {
      console.error("Error checking allowance:", error);
      setIsApproved(false);
    }
  }, [address, signer, tokenIn, amountIn]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 5) QUOTE FUNCTIONALITY
  // ────────────────────────────────────────────────────────────────────────────────
  const getQuote = useCallback(async (inputAmount: string) => {
    if (!inputAmount || parseFloat(inputAmount) <= 0 || !tokenIn || !tokenOut) {
        setAmountOut("");
        setPriceImpact(0);
        setGasEstimate("0");
        return;
      }

      setQuoteLoading(true);
      try {
      const quoterContract = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);
      const amountInWei = ethers.parseUnits(inputAmount, tokenIn.decimals);
      
      // Use 0.3% fee tier (most common)
      const fee = 3000;
      
      const quote = await quoterContract.quoteExactInputSingle(
        tokenIn.address,
        tokenOut.address,
        amountInWei,
        fee,
        0 // sqrtPriceLimitX96
      );

      const amountOutWei = quote[0];
      const amountOutFormatted = ethers.formatUnits(amountOutWei, tokenOut.decimals);
      
      setAmountOut(amountOutFormatted);
      setGasEstimate(quote[3].toString());

      // Calculate price impact
      if (token && token.priceUsd) {
        const inputValue = parseFloat(inputAmount) * ethPrice;
        const outputValue = parseFloat(amountOutFormatted) * ethPrice;
        const impact = ((inputValue - outputValue) / inputValue) * 100;
        setPriceImpact(Math.abs(impact));
      }
    } catch (error) {
      console.error("Error getting quote:", error);
        setAmountOut("");
        setPriceImpact(0);
        setGasEstimate("0");
      } finally {
        setQuoteLoading(false);
      }
  }, [tokenIn, tokenOut, provider, token, ethPrice]);

  // Debounced quote function
  const debouncedGetQuote = useMemo(
    () => debounce(getQuote, 500),
    [getQuote]
  );

  // ────────────────────────────────────────────────────────────────────────────────
  // 6) SWAP EXECUTION
  // ────────────────────────────────────────────────────────────────────────────────
  const executeSwap = useCallback(async () => {
    if (!signer || !address || !tokenIn || !tokenOut || !amountIn || !amountOut) {
      toast.error("Missing required swap parameters");
      return;
    }

    setIsSwapLoading(true);
    try {
      const swapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, signer);
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      const amountOutWei = ethers.parseUnits(amountOut, tokenOut.decimals);
      
      // Calculate minimum amount out with slippage
      const slippageMultiplier = (100 - slippage) / 100;
      const amountOutMinimum = amountOutWei * BigInt(Math.floor(slippageMultiplier * 1000)) / 1000n;
      
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
      
      const swapParams = {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fee: 3000, // 0.3% fee
        recipient: address,
        deadline: deadline,
        amountIn: amountInWei,
        amountOutMinimum: amountOutMinimum,
        sqrtPriceLimitX96: 0,
      };

      let tx;
      if (tokenIn.address === ETH_ADDRESS) {
        // ETH to Token swap
        tx = await swapRouter.exactInputSingle(swapParams, { value: amountInWei });
      } else {
        // Token to ETH swap
        tx = await swapRouter.exactInputSingle(swapParams);
      }

      toast.info("Swap transaction submitted! Waiting for confirmation...");
      
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast.success("Swap completed successfully!");
        
        // Update PnL
        if (activeTab === "buy") {
          setBoughtAmount(prev => prev + parseFloat(amountOut));
        } else {
          setSoldAmount(prev => prev + parseFloat(amountIn));
        }
        
        setAmountIn("");
        setAmountOut("");
        fetchEthBalance();
        fetchTokenBalance();
      } else {
        toast.error("Swap failed");
      }
    } catch (error: unknown) {
      console.error("Swap execution error:", error);
      let errorMessage = "Swap failed";
      if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
        if (error.message.includes("insufficient")) {
          errorMessage = "Insufficient balance";
        } else if (error.message.includes("slippage")) {
          errorMessage = "Slippage too high";
        } else if (error.message.includes("user rejected")) {
          errorMessage = "Transaction cancelled";
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsSwapLoading(false);
    }
  }, [signer, address, tokenIn, tokenOut, amountIn, amountOut, slippage, activeTab, fetchEthBalance, fetchTokenBalance]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 7) EVENT HANDLERS
  // ────────────────────────────────────────────────────────────────────────────────
  const handleConnectWallet = useCallback(async () => {
    try {
      await connectAsync({ connector: connectors[0] });
      const signer = await setupSigner();
      if (signer) {
        fetchEthBalance();
        fetchTokenBalance();
      }
    } catch (error) {
      console.error("Connect failed:", error);
      toast.error("Failed to connect wallet");
          }
  }, [connectAsync, connectors, setupSigner, fetchEthBalance, fetchTokenBalance]);

  const handleAmountChange = useCallback((value: string) => {
    setAmountIn(value);
    if (value && parseFloat(value) > 0) {
      debouncedGetQuote(value);
    } else {
      setAmountOut("");
      setPriceImpact(0);
    }
  }, [debouncedGetQuote]);

  const handleQuickAmount = useCallback((percent: number) => {
    const balance = parseFloat(walletBalance);
    const amount = (balance * percent) / 100;
    handleAmountChange(amount.toFixed(4));
  }, [walletBalance, handleAmountChange]);

  const handleSwapDirection = useCallback(() => {
    setActiveTab(activeTab === "buy" ? "sell" : "buy");
    setAmountIn("");
    setAmountOut("");
  }, [activeTab]);

  const handleApprove = useCallback(async () => {
    if (!signer || !address || !tokenIn || tokenIn.address === ETH_ADDRESS) return;

    try {
      const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, signer);
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      
      const tx = await tokenContract.approve(SWAP_ROUTER_ADDRESS, amountInWei);
      toast.info("Approval transaction submitted...");
      
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        toast.success("Token approved successfully!");
        setIsApproved(true);
      }
    } catch (error: unknown) {
      console.error("Approval error:", error);
      toast.error("Approval failed");
    }
  }, [signer, address, tokenIn, amountIn]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 8) EFFECTS
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTokenData();
  }, [fetchTokenData]);

  useEffect(() => {
    if (isConnected && address) {
      setupSigner();
      fetchEthBalance();
      fetchTokenBalance();
    }
  }, [isConnected, address, setupSigner, fetchEthBalance, fetchTokenBalance]);

  useEffect(() => {
    checkAllowance();
  }, [checkAllowance]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 9) RENDER
  // ────────────────────────────────────────────────────────────────────────────────
  const isSwapReady = amountIn && amountOut && parseFloat(amountIn) > 0 && parseFloat(amountOut) > 0;
  const isBuyMode = activeTab === "sell"; // Swapped: sell is actually buy, buy is actually sell

  return (
    <div className="bg-gray-900 rounded-lg border border-blue-500/20 p-4 h-full flex flex-col">
      {/* Token Info Header */}
      {token && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-800 rounded-lg border border-blue-500/20">
                {token.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
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
          <button
            onClick={() => setShowInfoModal(true)}
            className="text-blue-400 hover:text-blue-300 transition"
            title="Swap Info"
          >
            <FaInfoCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-200 uppercase">Swap</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSlippageModal(true)}
            className="text-xs bg-gray-800 hover:bg-blue-500/20 text-blue-400 px-2 py-1 rounded transition"
          >
            Slippage: {slippage}%
                    </button>
              </div>
            </div>

            {/* Wallet Connection */}
            {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-6">
          <FaWallet className="w-10 h-10 text-gray-400 mb-3" />
          <p className="text-gray-400 mb-3 text-sm">Connect your wallet to start swapping</p>
              <button
                onClick={handleConnectWallet}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition text-sm"
              >
            Connect Wallet
              </button>
        </div>
            ) : (
              <>
          {/* Token Selection Tabs */}
          <div className="flex bg-gray-800 rounded-lg p-1 mb-3">
            <button
              onClick={() => setActiveTab("buy")}
              className={`flex-1 py-2 px-3 rounded-md font-bold transition text-sm ${
                activeTab === "buy"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Buy {token?.baseToken.symbol}
            </button>
            <button
              onClick={() => setActiveTab("sell")}
              className={`flex-1 py-2 px-3 rounded-md font-bold transition text-sm ${
                activeTab === "sell"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Sell {token?.baseToken.symbol}
            </button>
          </div>

          {/* Input Section */}
          <div className="mb-3">
            <label className="block text-xs text-gray-400 font-bold mb-1 uppercase">
              YOU PAY
            </label>
            <div className="bg-gray-800 rounded-lg p-3 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Balance: {walletBalance} {isBuyMode ? "ETH" : token?.baseToken.symbol}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleQuickAmount(25)}
                    className="text-xs bg-gray-700 hover:bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded transition"
                  >
                    25%
                  </button>
                  <button
                    onClick={() => handleQuickAmount(50)}
                    className="text-xs bg-gray-700 hover:bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded transition"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => handleQuickAmount(75)}
                    className="text-xs bg-gray-700 hover:bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded transition"
                  >
                    75%
                  </button>
                  <button
                    onClick={() => handleQuickAmount(100)}
                    className="text-xs bg-gray-700 hover:bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded transition"
                  >
                    Max
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <span className="font-bold text-gray-200 mr-2 text-sm">
                  {isBuyMode ? "ETH" : token?.baseToken.symbol}
                </span>
                    <input
                      type="number"
                      placeholder="0.0"
                      value={amountIn}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="flex-1 bg-transparent text-gray-200 text-base font-mono outline-none border-none"
                  disabled={isSwapLoading}
                    />
                    </div>
                  </div>
                </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center my-3">
                  <button
              onClick={handleSwapDirection}
                    className="bg-gray-800 border border-blue-500/20 rounded-full p-2 hover:bg-blue-500/10 transition"
              disabled={isSwapLoading}
                  >
              <FaExchangeAlt className="w-4 h-4 text-blue-400" />
                  </button>
                </div>

                {/* Output Section */}
          <div className="mb-3">
                  <label className="block text-xs text-gray-400 font-bold mb-1 uppercase">
              YOU RECEIVE
                  </label>
            <div className="bg-gray-800 rounded-lg p-3 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">
                  {quoteLoading ? "Fetching quote..." : "Estimated"}
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-bold text-gray-200 mr-2 text-sm">
                  {isBuyMode ? token?.baseToken.symbol : "ETH"}
                </span>
                    <input
                      type="number"
                      placeholder="0.0"
                      value={amountOut}
                      disabled
                  className="flex-1 bg-transparent text-gray-400 text-base font-mono outline-none border-none"
                    />
                  </div>
            </div>
          </div>

          {/* Swap Info */}
          {isSwapReady && (
            <div className="bg-gray-800 rounded-lg p-3 mb-3 border border-blue-500/20">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Price Impact:</span>
                  <span className={priceImpact > 5 ? "text-red-400" : "text-blue-400"}>
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Gas Estimate:</span>
                  <span className="text-blue-400">{gasEstimate} gas</span>
                  </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Slippage:</span>
                  <span className="text-blue-400">{slippage}%</span>
                  </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Network:</span>
                  <span className="text-blue-400">Base</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 mb-3">
            {!isApproved && tokenIn && tokenIn.address !== ETH_ADDRESS && amountIn && (
              <button
                onClick={handleApprove}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold transition text-sm"
                disabled={isSwapLoading}
              >
                Approve {tokenIn.symbol}
              </button>
            )}
            
                <button
              onClick={executeSwap}
              className={`w-full py-2 rounded-lg font-bold transition text-sm ${
                isSwapReady && isApproved
                  ? "bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 text-white"
                  : "bg-gray-700 text-gray-400 cursor-not-allowed"
              }`}
              disabled={!isSwapReady || !isApproved || isSwapLoading}
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

          {/* P&L Section */}
          <div className="bg-gray-800 rounded-lg p-3 border border-blue-500/20">
            <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-200">Portfolio P&L</span>
                    <span className={`text-xs px-2 py-1 rounded ${profitLoss >= 0 ? "bg-green-900/20 text-green-400" : "bg-red-900/20 text-red-400"}`}>
                      {profitLoss >= 0 ? "+" : ""}{((profitLoss / (boughtAmount || 1)) * 100).toFixed(2)}%
                    </span>
                  </div>
                  
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Bought:</span>
                <span className="text-gray-200 font-bold">{boughtAmount.toFixed(2)} {token?.baseToken.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sold:</span>
                <span className="text-gray-200 font-bold">{soldAmount.toFixed(2)} {token?.baseToken.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Unrealized:</span>
                      <span className={`font-bold ${profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                        <span className="mr-1">Ξ</span>
                        {profitLoss >= 0 ? "+" : ""}{profitLoss.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ROI:</span>
                      <span className={`font-bold ${profitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {((profitLoss / (boughtAmount || 1)) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  
                  {/* Mini P&L Chart */}
            <div className="h-12 bg-gray-900 rounded border border-gray-700 flex items-center justify-center mb-2">
                    <div className="text-xs text-gray-500">P&L Chart</div>
                  </div>
                  
                  {/* Position Info */}
            <div className="pt-2 border-t border-gray-700">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Position Size:</span>
                <span className="text-gray-200 font-bold">{boughtAmount.toFixed(2)} {token?.baseToken.symbol}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-400">Avg Price:</span>
                <span className="text-gray-200 font-bold">${token?.priceUsd ? parseFloat(token.priceUsd).toFixed(6) : "0.000000"}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

      {/* Slippage Modal */}
      {showSlippageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg border border-blue-500/20 w-80">
            <h3 className="text-lg font-bold text-gray-200 mb-4">Set Slippage</h3>
            <div className="space-y-3">
              <button
                onClick={() => { setSlippage(0.5); setShowSlippageModal(false); }}
                className={`w-full py-2 rounded ${slippage === 0.5 ? "bg-blue-600" : "bg-gray-800"} text-white`}
              >
                0.5%
              </button>
              <button
                onClick={() => { setSlippage(1); setShowSlippageModal(false); }}
                className={`w-full py-2 rounded ${slippage === 1 ? "bg-blue-600" : "bg-gray-800"} text-white`}
              >
                1%
              </button>
              <button
                onClick={() => { setSlippage(2); setShowSlippageModal(false); }}
                className={`w-full py-2 rounded ${slippage === 2 ? "bg-blue-600" : "bg-gray-800"} text-white`}
              >
                2%
              </button>
            </div>
            <button
              onClick={() => setShowSlippageModal(false)}
              className="w-full mt-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg border border-blue-500/20 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-200">Swap Info</h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                ×
              </button>
            </div>
            <div className="text-sm text-gray-400 space-y-3">
              <p>• Swaps are executed through Uniswap V3 on Base</p>
              <p>• 0.3% fee applies to all swaps</p>
              <p>• Ensure you have sufficient balance for gas fees</p>
              <p>• Transaction may take 1-2 minutes to confirm</p>
              <p>• Price impact shows how much your trade affects the market</p>
              <p>• Slippage protects against price movement during execution</p>
            </div>
          </div>
      </div>
      )}
    </div>
  );
};

export default Swap;