"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { FaWallet, FaExchangeAlt, FaInfoCircle } from "react-icons/fa";
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
  dexId?: string;
  dexName?: string;
  imageUrl?: string;
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
  
  // 🔧 NEW: Store quote information for consistency
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  
  // Self-custodial wallet state
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<string>("0.0");
  const [tokenBalance, setTokenBalance] = useState<string>("0.0");
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  
  // PnL State
  const [pnlData, setPnlData] = useState<PnLData | null>(null);

  // ────────────────────────────────────────────────────────────────────────────────
  // 3) HELPER FUNCTIONS
  // ────────────────────────────────────────────────────────────────────────────────
  
  // Helper function to check and approve token spending
  const checkAndApproveToken = useCallback(async (
    tokenAddress: string,
    amount: string,
    spenderAddress: string,
    wallet: any
  ) => {
    try {
      // 🔧 CRITICAL: Ensure wallet has a provider attached
      let connectedWallet = wallet;
      if (!wallet.provider) {
        console.log("⚠️ Wallet missing provider, attaching provider...");
        const provider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN");
        connectedWallet = wallet.connect(provider);
        console.log("✅ Provider attached to wallet");
      }

      console.log("🔍 Checking token approval for:", {
        tokenAddress,
        amount,
        spenderAddress,
        walletAddress: connectedWallet.address
      });

      // ERC20 ABI for approval functions
      const erc20ABI = [
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)"
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, connectedWallet);
      
      // Check current allowance
      console.log("🔍 Checking allowance with provider:", {
        walletProvider: !!connectedWallet.provider,
        tokenAddress,
        spenderAddress,
        walletAddress: connectedWallet.address
      });
      
      const currentAllowance = await tokenContract.allowance(connectedWallet.address, spenderAddress);
      console.log("🔍 Current allowance:", {
        current: currentAllowance.toString(),
        required: amount,
        hasEnough: currentAllowance >= BigInt(amount)
      });

      // If allowance is insufficient, approve
      if (currentAllowance < BigInt(amount)) {
        console.log("⚠️ Insufficient allowance, approving tokens...");
        
        try {
          // Approve the router to spend tokens
          const approveTx = await tokenContract.approve(spenderAddress, BigInt(amount));
          console.log("🔍 Approval transaction sent:", approveTx.hash);
          
          // Wait for approval confirmation
          const approveReceipt = await approveTx.wait();
          console.log("✅ Token approval confirmed:", {
            hash: approveReceipt.hash,
            gasUsed: approveReceipt.gasUsed.toString()
          });
          
          return true;
        } catch (approvalError) {
          console.error("❌ Approval transaction failed:", {
            error: approvalError,
            message: approvalError instanceof Error ? approvalError.message : 'Unknown error',
            code: (approvalError as any)?.code,
            data: (approvalError as any)?.data
          });
          throw approvalError;
        }
      } else {
        console.log("✅ Sufficient allowance already exists");
        return true;
      }
    } catch (error) {
      console.error("❌ Token approval failed:", error);
      throw error;
    }
  }, []);



  // ────────────────────────────────────────────────────────────────────────────────
  // 4) WALLET MANAGEMENT
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
  
  // Quote auto-refresh state
  const [quoteCountdown, setQuoteCountdown] = useState(30);
  const [isQuoteExpired, setIsQuoteExpired] = useState(false);
  
  const getQuote = useCallback(async (amount: string) => {
    if (!token || !amount || parseFloat(amount) <= 0 || !walletAddress) {
      console.log("❌ Quote fetch skipped:", { token: !!token, amount, walletAddress: !!walletAddress });
      return;
    }

    console.log("🔄 Fetching quote for:", {
      inputToken: activeTab === "buy" ? "ETH" : token.baseToken.address,
      outputToken: activeTab === "buy" ? token.baseToken.address : "ETH",
      inputAmount: amount,
      tokenAddress: token.baseToken.address
    });

    setQuoteLoading(true);
    try {
      const response = await fetch("/api/swap/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputToken: activeTab === "buy" ? "ETH" : token.baseToken.address,
          outputToken: activeTab === "buy" ? token.baseToken.address : "ETH",
          inputAmount: amount,
          walletAddress: walletAddress,
          tokenAddress: token.baseToken.address,
        }),
      });

      if (response.ok) {
        const quote = await response.json();
        console.log("✅ Quote received:", quote);
        
        // Improved quote validation
        if (quote.outputAmount && 
            parseFloat(quote.outputAmount) > 0 && 
            !isNaN(parseFloat(quote.outputAmount))) {
          console.log("✅ Setting amountOut to:", quote.outputAmount);
          setAmountOut(quote.outputAmount);
          setCurrentQuote(quote); // 🔧 NEW: Store the quote
          setQuoteCountdown(30);
          setIsQuoteExpired(false);
          
          // Warn if quote is from DexScreener (different DEX than execution)
          if (quote.route && quote.route.length > 0 && quote.route[0] !== "Uniswap V3") {
            console.log("⚠️ Quote from different DEX:", quote.route[0]);
            toast.error(`Quote from ${quote.route[0]} - execution may fail if no Uniswap V3 liquidity`);
          }
        } else {
          console.log("⚠️ Quote outputAmount is invalid:", quote.outputAmount);
          setAmountOut("");
          toast.error("Unable to get valid quote - try a different amount");
        }
      } else {
        const errorData = await response.json();
        console.error("❌ Failed to get quote:", errorData);
        setAmountOut("");
        
        // Provide specific error messages based on the error
        if (errorData.error === "No liquidity found for this token pair") {
          toast.error("No liquidity found for this token pair - try a different token or amount");
        } else if (errorData.error === "Invalid quote received from exchange") {
          toast.error("Exchange returned invalid quote - try again or use a different amount");
        } else {
          toast.error(errorData.error || "Failed to get quote");
        }
      }
    } catch (error) {
      console.error("Error fetching quote:", error);
      setAmountOut("");
      toast.error("Network error while fetching quote");
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
  
  // Swap status tracking
  const [swapStatus, setSwapStatus] = useState<'idle' | 'preparing' | 'signing' | 'submitting' | 'confirming' | 'success' | 'failed'>('idle');
  const [swapError, setSwapError] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string>('');
  
  const executeSwap = useCallback(async () => {
    console.log("Execute swap called with:", { amountIn, amountOut, activeTab, isWalletConnected, walletAddress });
    
    if (!isWalletConnected || !walletAddress || !amountIn || !token) {
      toast.error("Please connect wallet and enter amounts");
      return;
    }

    // Reset status
    setSwapStatus('preparing');
    setSwapError('');
    setTransactionHash('');
    setIsSwapLoading(true);
    try {
      // Step 1: Prepare transaction data
      console.log("📋 Preparing transaction data...");
      setSwapStatus('preparing');
      const prepareResponse = await fetch("/api/swap/prepare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputToken: activeTab === "buy" ? "ETH" : token.baseToken.address,
          outputToken: activeTab === "buy" ? token.baseToken.address : "ETH",
          inputAmount: amountIn,
          outputAmount: amountOut,
          slippage: slippage,
          walletAddress: walletAddress,
          tokenAddress: token.baseToken.address,
          quoteDex: currentQuote?.route?.[0], // 🔧 NEW: Pass the DEX from the quote
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        setSwapStatus('failed');
        
        // Enhanced error handling for insufficient balance
        if (errorData.error && errorData.error.includes("Insufficient ETH balance")) {
          const match = errorData.error.match(/Required: ([\d.]+), Available: ([\d.]+)/);
          if (match) {
            const required = parseFloat(match[1]);
            const available = parseFloat(match[2]);
            const needed = required - available;
            setSwapError(`Insufficient ETH balance. You need ${needed.toFixed(4)} more ETH (${required.toFixed(4)} total needed, ${available.toFixed(4)} available)`);
          } else {
            setSwapError(errorData.error);
          }
        } else {
          setSwapError(errorData.error || "Failed to prepare transaction");
        }
        
        throw new Error(errorData.error || "Failed to prepare transaction");
      }

      const prepareResult = await prepareResponse.json();
      console.log("✅ Prepare result received:", prepareResult);
      
      // 🔧 CRITICAL: Debug the prepare result structure
      console.log("🔍 Prepare result structure:", {
        hasTransactionData: !!prepareResult.transactionData,
        transactionDataKeys: prepareResult.transactionData ? Object.keys(prepareResult.transactionData) : [],
        hasData: !!prepareResult.data,
        dataKeys: prepareResult.data ? Object.keys(prepareResult.data) : [],
        hasParams: !!prepareResult.data?.params,
        paramsKeys: prepareResult.data?.params ? Object.keys(prepareResult.data.params) : [],
        hasTransactionDataData: !!prepareResult.transactionData?.data,
        dataLength: prepareResult.transactionData?.data ? prepareResult.transactionData.data.length : 0,
        dataPreview: prepareResult.transactionData?.data ? prepareResult.transactionData.data.substring(0, 66) + "..." : "No data"
      });
      
      // Step 2: Create transaction data using router contract
      console.log("🔧 Creating transaction data...");
      setSwapStatus('signing');
      
      const storedWallet = localStorage.getItem("cypherx_wallet");
      if (!storedWallet) {
        setSwapStatus('failed');
        setSwapError("Wallet not found");
        throw new Error("Wallet not found");
      }

      const walletData = JSON.parse(storedWallet);
      const wallet = new ethers.Wallet(walletData.privateKey);
      
      // Create transaction data
      let router, method, params;
      
      // Handle different response structures from backend
      if (prepareResult.data) {
        // New structure
        router = prepareResult.data.router;
        method = prepareResult.data.method;
        params = prepareResult.data.params;
      } else if (prepareResult.transactionData) {
        // Old structure
        router = prepareResult.routerAddress;
        method = prepareResult.method;
        params = prepareResult.transactionData;
      } else {
        throw new Error("Invalid prepare result structure");
      }
      
      console.log("🔍 Router address:", router);
      console.log("🔍 Method:", method);
      console.log("🔍 Params:", params);
      console.log("🔍 Frontend received params:", params);
      console.log("🔍 Frontend received method:", method);
      console.log("🔍 Params keys:", Object.keys(params));
      console.log("🔍 Path in params:", params.path);
      
            // Create router contract interface for ALL DEX versions
      const routerInterface = new ethers.Interface([
        // Uniswap V3 functions
        "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
        "function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)",
        "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
        "function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external payable returns (uint256 amountOut)",
        // Uniswap V2 functions (including fee-on-transfer variants)
        "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
        "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        // V3-style DEX functions (Aerodrome, Baseswap, etc.)
        "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, address to, uint256 deadline) external returns (uint256 amountOut)",
        // Generic swap functions for compatibility
        "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
        "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
      ]);
      
      console.log("🔍 Router interface functions:", Object.keys(routerInterface.fragments));
      console.log("🔍 Required method:", method);
      
      if (!routerInterface.hasFunction(method)) {
        throw new Error(`Router interface does not have function: ${method}`);
      }
      
      let transactionData;
      
      if (method === "exactInputSingle") {
        // For Uniswap V3 exactInputSingle - needs to be a struct
        console.log("🔍 Creating exactInputSingle params:", {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          fee: params.fee,
          recipient: params.recipient,
          deadline: params.deadline,
          amountIn: params.amountIn,
          amountOutMinimum: params.amountOutMinimum
        });
        
        // According to Uniswap V3 docs, exactInputSingle expects a struct
        // When using ethers.js, struct parameters are passed as a single object
        const exactInputSingleParams = {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          fee: params.fee,
          recipient: params.recipient,
          deadline: params.deadline,
          amountIn: params.amountIn,
          amountOutMinimum: params.amountOutMinimum,
          sqrtPriceLimitX96: params.sqrtPriceLimitX96
        };
        
        transactionData = routerInterface.encodeFunctionData("exactInputSingle", [exactInputSingleParams]);
        console.log("🔍 Encoded transaction data:", {
          method: "exactInputSingle",
          params: exactInputSingleParams,
          encodedData: transactionData,
          dataLength: transactionData.length
        });
      } else if (method === "swapExactETHForTokens") {
        // For Uniswap V2 ETH swaps
        console.log("🔍 Creating swapExactETHForTokens params:", {
          amountOutMin: params.amountOutMin,
          path: params.path,
          to: params.to,
          deadline: params.deadline
        });
        
        // Validate path array
        if (!params.path || !Array.isArray(params.path) || params.path.length < 2) {
          throw new Error("Invalid path array for swap");
        }
        
        // Validate path addresses
        for (let i = 0; i < params.path.length; i++) {
          if (!ethers.isAddress(params.path[i])) {
            throw new Error(`Invalid address at path index ${i}: ${params.path[i]}`);
          }
        }
        
        console.log("✅ Path validation passed:", params.path);
        
        // Try the standard function first, fallback to fee-on-transfer version
        try {
          console.log("🔍 Attempting to encode swapExactETHForTokens with params:", {
            amountOutMin: params.amountOutMin,
            path: params.path,
            to: params.to,
            deadline: params.deadline
          });
          
          transactionData = routerInterface.encodeFunctionData("swapExactETHForTokens", [
            params.amountOutMin,
            params.path,
            params.to,
            params.deadline
          ]);
          
          console.log("🔍 Encoded transaction data (standard):", {
            method: "swapExactETHForTokens",
            params: {
              amountOutMin: params.amountOutMin,
              path: params.path,
              to: params.to,
              deadline: params.deadline
            },
            encodedData: transactionData,
            dataLength: transactionData.length
          });
        } catch (error) {
          console.log("⚠️ Standard function failed, trying fee-on-transfer version");
          transactionData = routerInterface.encodeFunctionData("swapExactETHForTokensSupportingFeeOnTransferTokens", [
            params.amountOutMin,
            params.path,
            params.to,
            params.deadline
          ]);
          console.log("🔍 Encoded transaction data (fee-on-transfer):", {
            method: "swapExactETHForTokensSupportingFeeOnTransferTokens",
            params: {
              amountOutMin: params.amountOutMin,
              path: params.path,
              to: params.to,
              deadline: params.deadline
            },
            encodedData: transactionData,
            dataLength: transactionData.length
          });
        }
      } else if (method === "swapExactTokensForETH") {
        // For Uniswap V2 token to ETH swaps (sell) - EXACT SAME PATTERN AS WORKING BUY + APPROVAL
        console.log("🔍 Creating swapExactTokensForETH params (same pattern as buy):", {
          amountIn: params.amountIn,
          amountOutMin: params.amountOutMin,
          path: params.path,
          to: params.to,
          deadline: params.deadline
        });
        
        // Validate path array (same as buy)
        if (!params.path || !Array.isArray(params.path) || params.path.length < 2) {
          throw new Error("Invalid path array for swap");
        }
        
        // Validate path addresses (same as buy)
        for (let i = 0; i < params.path.length; i++) {
          if (!ethers.isAddress(params.path[i])) {
            throw new Error(`Invalid address at path index ${i}: ${params.path[i]}`);
          }
        }
        
        console.log("✅ Path validation passed:", params.path);
        
        // 🔧 CRITICAL: Check and approve token spending for sell operations
        const tokenAddress = params.path[0]; // First token in path is the one being sold
        console.log("🔍 Checking token approval for sell operation:", {
          tokenAddress,
          amountIn: params.amountIn,
          routerAddress: router
        });
        
        // Use backend encoded data directly (same as working buy operation)
        transactionData = prepareResult.transactionData.data;
        console.log("🔍 Using backend encoded data for sell operation:", {
          data: transactionData ? transactionData.substring(0, 66) + "..." : "No data",
          dataLength: transactionData ? transactionData.length : 0,
          hasData: !!transactionData && transactionData !== "0x"
        });
        
        // 🔧 CRITICAL: Validate that we have transaction data
        if (!transactionData || transactionData === "0x" || transactionData.length < 10) {
          console.error("❌ Backend transaction data is empty or invalid:", {
            data: transactionData,
            dataLength: transactionData ? transactionData.length : 0,
            prepareResult: prepareResult
          });
          
          // 🔧 FALLBACK: Try frontend encoding if backend data is empty
          console.log("🔄 Attempting frontend encoding as fallback...");
          try {
            transactionData = routerInterface.encodeFunctionData("swapExactTokensForETH", [
              params.amountIn,
              params.amountOutMin,
              params.path,
              params.to,
              params.deadline
            ]);
            console.log("✅ Frontend encoding successful:", {
              data: transactionData.substring(0, 66) + "...",
              dataLength: transactionData.length
            });
          } catch (fallbackError) {
            console.error("❌ Frontend encoding also failed:", fallbackError);
            throw new Error("Both backend and frontend encoding failed for sell operation");
          }
        }
      } else if (method === "swapExactTokensForTokens") {
        // For Uniswap V2 token swaps
        console.log("🔍 Creating swapExactTokensForTokens params:", {
          amountIn: params.amountIn,
          amountOutMin: params.amountOutMin,
          path: params.path,
          to: params.to,
          deadline: params.deadline
        });
        
        // Try the standard function first, fallback to fee-on-transfer version
        try {
          transactionData = routerInterface.encodeFunctionData("swapExactTokensForTokens", [
            params.amountIn,
            params.amountOutMin,
            params.path,
            params.to,
            params.deadline
          ]);
          console.log("🔍 Encoded transaction data (standard):", {
            method: "swapExactTokensForTokens",
            params: {
              amountIn: params.amountIn,
              amountOutMin: params.amountOutMin,
              path: params.path,
              to: params.to,
              deadline: params.deadline
            },
            encodedData: transactionData,
            dataLength: transactionData.length
          });
        } catch (error) {
          console.log("⚠️ Standard function failed, trying fee-on-transfer version");
          transactionData = routerInterface.encodeFunctionData("swapExactTokensForTokensSupportingFeeOnTransferTokens", [
            params.amountIn,
            params.amountOutMin,
            params.path,
            params.to,
            params.deadline
          ]);
          console.log("🔍 Encoded transaction data (fee-on-transfer):", {
            method: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
            params: {
              amountIn: params.amountIn,
              amountOutMin: params.amountOutMin,
              path: params.path,
              to: params.to,
              deadline: params.deadline
            },
            encodedData: transactionData,
            dataLength: transactionData.length
          });
        }
      } else if (method === "swap") {
        // For V3-style DEXs (Aerodrome, Baseswap, etc.)
        console.log("🔍 Creating swap params:", {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          amountOutMin: params.amountOutMin,
          to: params.to,
          deadline: params.deadline
        });
        
        // Try different parameter formats for V3-style DEXs
        try {
          transactionData = routerInterface.encodeFunctionData("swap", [
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            params.amountOutMin,
            params.to,
            params.deadline
          ]);
          console.log("🔍 Encoded transaction data (V3-style):", {
            method: "swap",
            params: {
              tokenIn: params.tokenIn,
              tokenOut: params.tokenOut,
              amountIn: params.amountIn,
              amountOutMin: params.amountOutMin,
              to: params.to,
              deadline: params.deadline
            },
            encodedData: transactionData,
            dataLength: transactionData.length
          });
        } catch (error) {
          console.log("⚠️ V3-style swap failed, trying alternative format");
          // Try alternative parameter format
          transactionData = routerInterface.encodeFunctionData("swap", [
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            params.amountOutMin,
            params.to,
            params.deadline
          ]);
          console.log("🔍 Encoded transaction data (alternative):", {
            method: "swap",
            params: {
              tokenIn: params.tokenIn,
              tokenOut: params.tokenOut,
              amountIn: params.amountIn,
              amountOutMin: params.amountOutMin,
              to: params.to,
              deadline: params.deadline
            },
            encodedData: transactionData,
            dataLength: transactionData.length
          });
        }
      } else {
        throw new Error(`Unsupported method: ${method}. Supported methods: exactInputSingle, swapExactETHForTokens, swapExactTokensForETH, swapExactTokensForTokens, swap, and their fee-on-transfer variants`);
      }
      
      // Get current nonce
      const provider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN");
      let nonce = await provider.getTransactionCount(wallet.address);
      
      // 🔧 CRITICAL: Handle token approval for sell operations (after nonce is declared)
      if (method === "swapExactTokensForETH") {
        const tokenAddress = params.path[0]; // First token in path is the one being sold
        
        // Ensure wallet is properly connected with provider
        let connectedWallet = wallet;
        if (!wallet.provider) {
          console.log("⚠️ Wallet missing provider for sell operation, attaching provider...");
          connectedWallet = wallet.connect(provider);
          console.log("✅ Provider attached to wallet for sell operation");
        }
        
        try {
          // 🔧 FIXED: Use current amountIn from user input instead of params.amountIn
          // This ensures approval matches the actual amount being executed
          const approvalAmount = ethers.parseUnits(amountIn, 18).toString();
          console.log("🔍 Approval amount check:", {
            userInput: amountIn,
            paramsAmountIn: params.amountIn,
            approvalAmount: approvalAmount
          });
          
          await checkAndApproveToken(tokenAddress, approvalAmount, router, connectedWallet);
          console.log("✅ Token approval completed for sell operation");
          
          // 🔧 CRITICAL: Get fresh nonce after approval transaction
          console.log("🔄 Getting fresh nonce after approval...");
          nonce = await provider.getTransactionCount(wallet.address);
          console.log("✅ Fresh nonce obtained after approval:", nonce);
        } catch (approvalError) {
          console.error("❌ Token approval failed:", approvalError);
          throw new Error(`Token approval failed: ${approvalError instanceof Error ? approvalError.message : 'Unknown error'}`);
        }
      }
      
      // Calculate fresh deadline (30 minutes from now) to avoid expired deadline issues
      const freshDeadline = Math.floor(Date.now() / 1000) + 1800;
      console.log("🕐 Fresh deadline calculated:", {
        deadline: freshDeadline,
        deadlineTime: new Date(freshDeadline * 1000).toISOString(),
        currentTime: new Date().toISOString()
      });
      
      // Validate router address
      if (!router || router === "0x0000000000000000000000000000000000000000") {
        throw new Error("Invalid router address received from prepare API");
      }
      
      // Debug: Log the transaction data after encoding
      console.log("🔍 Transaction data after encoding:", {
        method: method,
        transactionData: transactionData,
        dataLength: transactionData ? transactionData.length : 0,
        isValid: transactionData && transactionData !== "0x" && transactionData.length >= 10
      });
      
      // Validate transaction data
      if (!transactionData || transactionData === "0x" || transactionData.length < 10) {
        console.error("❌ Invalid transaction data:", {
          data: transactionData,
          dataLength: transactionData ? transactionData.length : 0,
          router: router
        });
        throw new Error("Invalid transaction data - missing or empty function call");
      }
      
      // Additional validation: Check if the router contract exists
      try {
        const code = await provider.getCode(router);
        if (code === "0x") {
          console.error(`❌ Router contract does not exist at address: ${router}`);
          
          // Try alternative router addresses for Base chain
          const alternativeRouters = [
            "0x2626664c2603336E57B271c5C0b26F421741e481", // Uniswap V3 Router
            "0x420DD381b31aEf6683db6B902084cB0FFECe40Da", // Aerodrome Router
            "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB", // Baseswap Router
            "0x66a9893cc07d91d95644aedd05d03f95e1dba8af"  // Universal Router V4
          ];
          
          console.log("🔄 Trying alternative router addresses...");
          for (const altRouter of alternativeRouters) {
            try {
              const altCode = await provider.getCode(altRouter);
              if (altCode !== "0x") {
                console.log(`✅ Found working router at: ${altRouter}`);
                // Update the router address
                router = altRouter;
                break;
              }
            } catch (altError) {
              console.log(`❌ Alternative router ${altRouter} failed:`, altError);
            }
          }
          
          if (router === "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24") {
            throw new Error(`No working router found. Original router ${router} does not exist.`);
          }
        }
        console.log("✅ Router contract exists at:", router);
      } catch (routerError) {
        console.error("❌ Router validation failed:", routerError);
        throw new Error(`Router validation failed: ${routerError instanceof Error ? routerError.message : 'Unknown error'}`);
      }
      
      // Use the backend's encoded transaction data (like the working buy operations)
      const txData = {
        to: router,
        data: prepareResult.transactionData.data, // Use backend encoded data
        nonce: nonce,
        gasLimit: BigInt(prepareResult.transactionData.gasLimit || "0"),
        maxFeePerGas: BigInt(prepareResult.transactionData.maxFeePerGas || "0"),
        maxPriorityFeePerGas: BigInt(prepareResult.transactionData.maxPriorityFeePerGas || "0"),
        value: BigInt(prepareResult.transactionData.value || "0"),
        chainId: 8453 // Base chain ID
      };
      
      // 🔧 CRITICAL: Validate backend transaction data
      console.log("🔍 Backend transaction data validation:", {
        prepareResultData: prepareResult.transactionData.data,
        prepareResultDataLength: prepareResult.transactionData.data ? prepareResult.transactionData.data.length : 0,
        hasData: !!prepareResult.transactionData.data && prepareResult.transactionData.data !== "0x",
        txDataData: txData.data,
        txDataDataLength: txData.data ? txData.data.length : 0
      });
      
      // 🔧 CRITICAL: Debug the final transaction data
      console.log("🔍 Final transaction data before signing:", {
        to: txData.to,
        data: txData.data ? txData.data.substring(0, 66) + "..." : "No data",
        dataLength: txData.data ? txData.data.length : 0,
        hasData: !!txData.data && txData.data !== "0x",
        nonce: txData.nonce,
        value: txData.value.toString()
      });
      
      console.log("✅ Transaction data created:", {
        to: txData.to,
        dataLength: txData.data.length,
        dataPreview: txData.data.substring(0, 66) + "...",
        gasLimit: txData.gasLimit.toString(),
        value: txData.value.toString(),
        nonce: txData.nonce
      });
      
      // Validate transaction data before signing
      if (!txData.data || txData.data === "0x" || txData.data.length < 10) {
        console.error("❌ Invalid transaction data:", {
          data: txData.data,
          dataLength: txData.data ? txData.data.length : 0,
          to: txData.to,
          method: method,
          transactionData: transactionData
        });
        throw new Error("Invalid transaction data - missing or empty function call");
      }
      
      // Additional validation for sell operations
      if (method === "swapExactTokensForETH") {
        console.log("🔍 Validating sell transaction data:", {
          data: txData.data,
          dataLength: txData.data.length,
          method: method,
          router: router
        });
      }
      
      // Additional validation: Check if the transaction value matches the amount (only for ETH input methods)
      if (method === "swapExactETHForTokens" && params.amountIn && txData.value.toString() !== params.amountIn) {
        console.warn("⚠️ Transaction value mismatch:", {
          expected: params.amountIn,
          actual: txData.value.toString()
        });
      }
      
      if (!txData.to || txData.to === "0x0000000000000000000000000000000000000000") {
        throw new Error("Invalid transaction recipient address");
      }
      
      console.log("📋 Transaction data to sign:", {
        to: txData.to,
        data: txData.data.substring(0, 66) + "...",
        dataLength: txData.data.length,
        nonce: txData.nonce,
        gasLimit: txData.gasLimit.toString(),
        maxFeePerGas: txData.maxFeePerGas.toString(),
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas.toString(),
        value: txData.value.toString(),
        chainId: txData.chainId
      });
      
      // Sign the transaction with proper BigInt handling
      console.log("🔍 Signing transaction with data:", {
        to: txData.to,
        dataLength: txData.data.length,
        dataPreview: txData.data.substring(0, 66) + "...",
        nonce: txData.nonce,
        gasLimit: txData.gasLimit.toString(),
        maxFeePerGas: txData.maxFeePerGas.toString(),
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas.toString(),
        value: txData.value.toString(),
        chainId: txData.chainId
      });
      
      // 🔧 CRITICAL: Validate data before signing
      if (!txData.data || txData.data === "0x" || txData.data.length < 10) {
        console.error("❌ CRITICAL: Transaction data is empty before signing:", {
          data: txData.data,
          dataLength: txData.data ? txData.data.length : 0,
          prepareResultData: prepareResult.transactionData.data,
          prepareResultDataLength: prepareResult.transactionData.data ? prepareResult.transactionData.data.length : 0
        });
        throw new Error("Transaction data is empty before signing - this indicates a backend encoding issue");
      }
      
      // 🔧 CRITICAL: Test transaction data integrity
      console.log("🔍 Transaction data integrity test:", {
        dataStartsWith0x: txData.data.startsWith("0x"),
        dataLength: txData.data.length,
        dataPreview: txData.data.substring(0, 66) + "...",
        methodSignature: txData.data.substring(0, 10),
        expectedMethodSignature: "0x38ed1739" // swapExactTokensForETH
      });
      
            // Debug: Log the exact data being passed to signTransaction
      console.log("🔍 Data being passed to signTransaction:", {
        to: txData.to,
        data: txData.data,
        dataLength: txData.data.length,
        dataPreview: txData.data.substring(0, 66) + "...",
        nonce: txData.nonce,
        gasLimit: txData.gasLimit.toString(),
        maxFeePerGas: txData.maxFeePerGas.toString(),
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas.toString(),
        value: txData.value.toString(),
        chainId: txData.chainId,
        methodSignature: txData.data.substring(0, 10),
        hasValidData: !!txData.data && txData.data !== "0x" && txData.data.length >= 10
      });
      
      const signedTx = await wallet.signTransaction({
        to: txData.to,
        data: txData.data,
        nonce: txData.nonce,
        gasLimit: txData.gasLimit,
        maxFeePerGas: txData.maxFeePerGas,
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas,
        value: txData.value,
        chainId: txData.chainId
      });
      
      console.log("✅ Transaction signed:", signedTx.substring(0, 66) + "...");
      console.log("📏 Signed transaction length:", signedTx.length);
      
      // Debug: Parse and verify the signed transaction
      try {
        const parsedSignedTx = ethers.Transaction.from(signedTx);
        console.log("🔍 Parsed signed transaction:", {
          to: parsedSignedTx.to,
          data: parsedSignedTx.data,
          dataLength: parsedSignedTx.data ? parsedSignedTx.data.length : 0,
          dataPreview: parsedSignedTx.data ? parsedSignedTx.data.substring(0, 66) + "..." : "No data",
          value: parsedSignedTx.value?.toString(),
          nonce: parsedSignedTx.nonce,
          gasLimit: parsedSignedTx.gasLimit?.toString(),
          maxFeePerGas: parsedSignedTx.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: parsedSignedTx.maxPriorityFeePerGas?.toString()
        });
      } catch (parseError) {
        console.error("❌ Error parsing signed transaction:", parseError);
      }
      
      // Validate the signed transaction
      try {
        const parsedSignedTx = ethers.Transaction.from(signedTx);
        console.log("🔍 Signed transaction validation:", {
          hasData: !!parsedSignedTx.data,
          dataLength: parsedSignedTx.data ? parsedSignedTx.data.length : 0,
          dataPreview: parsedSignedTx.data ? parsedSignedTx.data.substring(0, 66) + "..." : "NO DATA",
          to: parsedSignedTx.to,
          value: parsedSignedTx.value?.toString(),
          nonce: parsedSignedTx.nonce,
          gasLimit: parsedSignedTx.gasLimit?.toString(),
          maxFeePerGas: parsedSignedTx.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: parsedSignedTx.maxPriorityFeePerGas?.toString()
        });
        
        if (!parsedSignedTx.data || parsedSignedTx.data === "0x" || parsedSignedTx.data.length < 10) {
          console.error("❌ Signed transaction has empty data:", {
            data: parsedSignedTx.data,
            dataLength: parsedSignedTx.data ? parsedSignedTx.data.length : 0
          });
          throw new Error("Signed transaction has invalid or missing data");
        }
      } catch (validationError) {
        console.error("❌ Signed transaction validation failed:", validationError);
        throw new Error("Transaction signing failed - invalid transaction data");
      }
      
      // Step 3: Submit signed transaction
      console.log("🚀 Submitting signed transaction...");
      console.log("🔍 Signed transaction being sent:", {
        signedTx: signedTx,
        signedTxLength: signedTx.length,
        signedTxPrefix: signedTx.substring(0, 66) + "...",
        signedTxFull: signedTx
      });
      setSwapStatus('submitting');
      const submitResponse = await fetch("/api/swap/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signedTransaction: signedTx,
          inputToken: activeTab === "buy" ? "ETH" : token.baseToken.address,
          outputToken: activeTab === "buy" ? token.baseToken.address : "ETH",
          inputAmount: amountIn,
          outputAmount: amountOut,
          walletAddress: walletAddress,
          tokenAddress: token.baseToken.address,
          autoConfirm: true, // Auto-confirm the transaction
        }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        console.error("❌ Backend error response:", {
          status: submitResponse.status,
          statusText: submitResponse.statusText,
          errorData: errorData,
          errorMessage: errorData.error,
          errorDetails: errorData.details
        });
        setSwapStatus('failed');
        setSwapError(errorData.error || "Failed to submit transaction");
        throw new Error(errorData.error || "Failed to submit transaction");
      }

      const submitResult = await submitResponse.json();
      setSwapStatus('success');
      setTransactionHash(submitResult.transactionHash);
      toast.success(`Swap completed! Hash: ${submitResult.transactionHash.slice(0, 10)}...`);
      
      // Refresh balances and PnL
      fetchBalances(walletAddress);
      fetchPnLData(walletAddress);
      
      // Clear form
      setAmountIn("");
      setAmountOut("");
    } catch (error) {
      console.error("Swap execution error:", error);
      setSwapStatus('failed');
      setSwapError(error instanceof Error ? error.message : "Swap failed");
      toast.error(error instanceof Error ? error.message : "Swap failed");
    } finally {
      setIsSwapLoading(false);
      // Reset status after a delay for success/failure display
      if (swapStatus === 'success' || swapStatus === 'failed') {
        setTimeout(() => {
          setSwapStatus('idle');
          setSwapError('');
          setTransactionHash('');
        }, 5000); // Show status for 5 seconds
      }
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

  // Quote countdown effect
  useEffect(() => {
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setQuoteCountdown(30);
      setIsQuoteExpired(false);
      return;
    }

    const interval = setInterval(() => {
      setQuoteCountdown((prev) => {
        if (prev <= 1) {
          setIsQuoteExpired(true);
          // Auto-refresh quote when countdown reaches 0
          if (amountIn && parseFloat(amountIn) > 0) {
            console.log("🔄 Auto-refreshing quote after 30s timeout");
            getQuote(amountIn);
          }
          return 30; // Reset to 30
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [amountIn, getQuote]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 9) RENDER
  // ────────────────────────────────────────────────────────────────────────────────
  const isSwapReady = amountIn && parseFloat(amountIn) > 0 && isWalletConnected && walletAddress;

  return (
    <div className="rounded-lg border border-blue-500/20 p-4 h-full flex flex-col bg-gray-950">
      {/* Clean Token Info Header */}
      {token && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border border-blue-500/20 bg-gray-950">
          {/* Token Logo - Use DexScreener API response */}
          <img
            src={token.logoUrl || `https://dexscreener.com/base/${token.baseToken.address}/logo.png`}
            alt={`${token.baseToken.name} logo`}
            className="w-8 h-8 rounded-full border border-blue-500/20"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.baseToken.symbol}&background=1f2937&color=60a5fa&size=32`;
            }}
          />
          <div className="flex-1">
            <h3 className="font-bold text-gray-200 text-sm">
              {token.baseToken.name} ({token.baseToken.symbol})
            </h3>
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
                          <p className="text-gray-400 mb-3 text-sm">Create or load your wallet to start swapping</p>
          <div className="flex gap-2">
            <button
              onClick={createWallet}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition text-sm"
            >
              Create Wallet
            </button>
            <button
              onClick={loadWallet}
              className="bg-gray-950 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold transition text-sm"
            >
              Load Wallet
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Wallet Info */}
          <div className="rounded-lg p-3 mb-4 border border-blue-500/20 bg-gray-950">
            <div className="flex items-center justify-start mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200">
                  <span className="text-blue-400 font-bold">Wallet</span>
                </span>
              </div>
              <button
                onClick={copyAddress}
                className="text-xs text-blue-400 hover:text-blue-300 ml-auto"
              >
                Copy
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-gray-300">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <span className="text-xs text-gray-400">
                Balance: {activeTab === "buy" ? `${parseFloat(ethBalance).toFixed(4)} ETH` : `${parseFloat(tokenBalance).toFixed(4)} ${token?.baseToken.symbol}`}
              </span>
            </div>
          </div>

          {/* Swap Interface */}
          <div className="rounded-lg p-4 mb-4 border border-blue-500/20 bg-gray-950">
            {/* Token Selection Tabs */}
            <div className="flex rounded-lg p-1 mb-4 bg-gray-950">
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
                     ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
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
              <div className="rounded-lg p-3 border border-blue-500/20 bg-gray-950">
                <div className="flex items-center justify-end mb-2">
                  <div className="flex gap-1">
                    {[25, 50, 75, 100].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => handleQuickAmount(percent)}
                        className="text-xs bg-gray-800 hover:bg-blue-500/20 text-blue-400 px-2 py-1 rounded transition border border-gray-700 font-medium"
                      >
                        {percent === 100 ? "Max" : `${percent}%`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center gap-2 mr-2">
                    {activeTab === "buy" ? (
                      <>
                        <SiEthereum className="w-4 h-4 text-blue-400" />
                        <span className="font-bold text-gray-200 text-sm">ETH</span>
                      </>
                    ) : (
                      <>
                        <img
                          src={token?.logoUrl || `https://dexscreener.com/base/${token?.baseToken.address}/logo.png`}
                          alt={`${token?.baseToken.symbol} logo`}
                          className="w-4 h-4 rounded-full"
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${token?.baseToken.symbol}&background=1f2937&color=60a5fa&size=16`;
                          }}
                        />
                        <span className="font-bold text-gray-200 text-sm">{token?.baseToken.symbol}</span>
                      </>
                    )}
                  </div>
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
              <div className="rounded-lg p-3 border border-blue-500/20 bg-gray-950">
                <div className="flex items-center justify-start mb-2">
                  <span className="text-xs text-gray-400">
                    {quoteLoading ? "Fetching quote..." : amountOut ? "Estimated" : "Enter amount above"}
                  </span>
                  {amountOut && !quoteLoading && (
                    <span className={`text-xs ml-2 ${isQuoteExpired ? 'text-red-400' : 'text-green-400'}`}>
                      {isQuoteExpired ? 'Expired' : `${quoteCountdown}s`}
                    </span>
                  )}
                </div>
                <div className="flex items-center">
                  <div className="flex items-center gap-2 mr-2">
                    {activeTab === "buy" ? (
                      <>
                        <img
                          src={token?.logoUrl || `https://dexscreener.com/base/${token?.baseToken.address}/logo.png`}
                          alt={`${token?.baseToken.symbol} logo`}
                          className="w-4 h-4 rounded-full"
                          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${token?.baseToken.symbol}&background=1f2937&color=60a5fa&size=16`;
                          }}
                        />
                        <span className="font-bold text-gray-200 text-sm">{token?.baseToken.symbol}</span>
                      </>
                    ) : (
                      <>
                        <SiEthereum className="w-4 h-4 text-blue-400" />
                        <span className="font-bold text-gray-200 text-sm">ETH</span>
                      </>
                    )}
                  </div>
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
                swapStatus === 'success'
                  ? "bg-green-500/20 text-green-400 border border-green-500/30 cursor-not-allowed"
                  : swapStatus === 'failed'
                  ? "bg-red-500/20 text-red-400 border border-red-500/30 cursor-not-allowed"
                                     : isSwapReady && !isQuoteExpired
                   ? activeTab === "buy"
                     ? "bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                     : "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                  : isQuoteExpired && isSwapReady
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 cursor-not-allowed"
                  : "bg-green-500/10 text-green-400/50 border border-green-500/20 cursor-not-allowed"
              }`}
              disabled={!isSwapReady || isSwapLoading || isQuoteExpired || swapStatus === 'success' || swapStatus === 'failed'}
            >
              {swapStatus === 'success' ? (
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Swap Successful!
                </span>
              ) : swapStatus === 'failed' ? (
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Swap Failed
                </span>
              ) : isSwapLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {swapStatus === 'preparing' ? 'Preparing...' : 
                   swapStatus === 'signing' ? 'Signing...' : 
                   swapStatus === 'submitting' ? 'Submitting...' : 
                   'Processing...'}
                </span>
              ) : isQuoteExpired ? (
                "Quote Expired - Refreshing..."
              ) : (
                `${activeTab === "buy" ? "Buy" : "Sell"} ${token?.baseToken.symbol}`
              )}
            </button>
            
            {/* Status Messages */}
            {swapStatus === 'success' && transactionHash && (
              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-green-400 font-medium">Transaction Successful!</span>
                  </div>
                  <a 
                    href={`https://basescan.org/tx/${transactionHash}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    View on BaseScan
                  </a>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Hash: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                </div>
              </div>
            )}
            
            {swapStatus === 'failed' && swapError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-red-400 font-medium">Transaction Failed</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {swapError}
                </div>
                {swapError && swapError.includes("Insufficient ETH balance") && (
                  <div className="text-xs text-blue-400 mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                    💡 Tip: You can reduce the swap amount or add more ETH to your wallet to complete this transaction.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PnL Stats Section - Below Swap Interface */}
          {pnlData && (
            <div className="rounded-lg p-3 border border-blue-500/20 bg-gray-950">
              <div className="grid grid-cols-4 gap-2 text-center justify-items-center">
                <div className="flex flex-col items-center justify-center relative px-2">
                  <span className="text-xs text-gray-400 mb-1">Bought</span>
                  <div className="flex items-center gap-1">
                    <SiEthereum className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-bold text-green-400">0</span>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700"></div>
                </div>
                
                <div className="flex flex-col items-center justify-center relative px-2">
                  <span className="text-xs text-gray-400 mb-1">Sold</span>
                  <div className="flex items-center gap-1">
                    <SiEthereum className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-bold text-red-400">0</span>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700"></div>
                </div>
                
                <div className="flex flex-col items-center justify-center relative px-2">
                  <span className="text-xs text-gray-400 mb-1">Holding</span>
                  <div className="flex items-center gap-1">
                    <SiEthereum className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-bold text-white">0</span>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700"></div>
                </div>
                
                <div className="flex flex-col items-center justify-center relative px-2">
                  <span className="text-xs text-gray-400 mb-1">PnL</span>
                  <div className="flex items-center gap-1">
                    <SiEthereum className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-bold text-green-400">
                      {pnlData.totalPnL >= 0 ? "+" : ""}{pnlData.totalPnL.toFixed(0)}%
                    </span>
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
          <div className="rounded-lg p-6 border border-blue-500/20 w-80 bg-gray-950">
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
                      ? "bg-blue-600 text-white border border-blue-500/30"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSlippageModal(false)}
              className="w-full mt-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition border border-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-lg p-6 border border-blue-500/20 w-96 max-h-96 overflow-y-auto bg-gray-950">
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
              className="w-full mt-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition border border-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showPnLModal && pnlData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-lg p-6 border border-blue-500/20 w-96 max-h-96 overflow-y-auto bg-gray-950">
            <h3 className="text-lg font-bold mb-4">PnL Tracking</h3>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="text-gray-400 text-xs">Total PnL</div>
                  <div className={`font-bold ${pnlData.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pnlData.totalPnL >= 0 ? "+" : ""}{pnlData.totalPnL.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="text-gray-400 text-xs">Win Rate</div>
                  <div className="text-green-400 font-bold">{pnlData.winRate.toFixed(1)}%</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="text-gray-400 text-xs">Volume</div>
                  <div className="text-blue-400 font-bold">${pnlData.totalVolume.toFixed(2)}</div>
                </div>
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="text-gray-400 text-xs">Trades</div>
                  <div className="text-purple-400 font-bold">{pnlData.totalTrades}</div>
                </div>
              </div>
              
              {pnlData.recentTrades.length > 0 && (
                <div>
                  <h4 className="font-bold mb-2">Recent Trades</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pnlData.recentTrades.slice(0, 5).map((trade) => (
                      <div key={trade.id} className="bg-gray-800 p-2 rounded text-xs border border-gray-700">
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
              className="w-full mt-4 py-2 bg-gray-950 text-gray-300 rounded-lg hover:bg-gray-900 transition"
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