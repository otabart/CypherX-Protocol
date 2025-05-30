"use client";

import React, { useEffect, useState } from "react";
import { FaWallet } from "react-icons/fa";
import { useAccount, useConnect, useDisconnect, useBalance, useSignMessage } from "wagmi";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { db } from "lib/firebase"; // Absolute import
import { collection, query, where, getDocs } from "firebase/firestore";

// Constants for Base network (Uniswap V3 addresses - Updated for Base Mainnet)
const SWAP_ROUTER_ADDRESS = "0x2626664c2603E5475e998cB8976B0dF48E8b8A9"; // SwapRouter02 on Base
const QUOTER_ADDRESS = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76"; // QuoterV2 on Base
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base
const ETH_ADDRESS = ethers.ZeroAddress; // ETH represented as zero address
const PLATFORM_WALLET = "0x4146E18FeF6883Ee7c2F16feC60109133F1Fc491"; // Platform wallet for fee
const PLATFORM_FEE_PERCENTAGE = 0.02; // 0.02% fee
const BASE_CHAIN_ID = 8453; // Base network chain ID

// ABI for Uniswap V3 QuoterV2
const QUOTER_ABI = [
  "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) calldata params) external view returns (uint256 amountOut, uint256 amountOutAfterFees, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

// WETH ABI for wrapping/unwrapping
const WETH_ABI = [
  "function deposit() external payable",
  "function withdraw(uint256 wad) external",
  "function balanceOf(address owner) public view returns (uint256)",
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function transfer(address to, uint256 amount) public returns (bool)",
];

// ERC20 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function decimals() public view returns (uint8)",
  "function transfer(address to, uint256 amount) public returns (bool)",
];

// Swap Router ABI
const SWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) calldata params) external payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) external payable",
];

// Types
type SwapToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
};

interface TokenMetadata {
  poolAddress: string;
  pairAddress: string;
  baseToken: { name: string; symbol: string; address?: string };
  quoteToken: { name: string; symbol: string; address?: string };
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

const Swap: React.FC<SwapProps> = ({ token, ethPrice }) => {
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("");
  const [tokenIn, setTokenIn] = useState<SwapToken | null>(null);
  const [tokenOut, setTokenOut] = useState<SwapToken | null>(null);
  const [isSwapLoading, setIsSwapLoading] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [slippage] = useState<number>(0.5);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [gasEstimate, setGasEstimate] = useState<string>("0");
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [walletBalance, setWalletBalance] = useState<string>("0.0");
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [platformFee, setPlatformFee] = useState<string>("0");
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [boughtAmount, setBoughtAmount] = useState<number>(0);
  const [soldAmount, setSoldAmount] = useState<number>(0);
  const [profitLoss, setProfitLoss] = useState<number>(0);

  // Fetch ETH/WETH balance using wagmi
  const { data: balance } = useBalance({
    address: address as `0x${string}`,
  });

  const { data: wethBalance } = useBalance({
    address: address as `0x${string}`,
    token: WETH_ADDRESS as `0x${string}`,
  });

  const provider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN");

  // Fetch token address from Firebase and set up tokens
  useEffect(() => {
    const fetchTokenAddress = async () => {
      if (!token || !token.baseToken || !token.quoteToken) {
        console.warn("Token metadata is incomplete:", { token });
        toast.error("Token metadata is incomplete. Please check the token configuration.");
        return;
      }

      try {
        console.log("Fetching token address from Firebase for symbol:", token.baseToken.symbol);
        const tokensRef = collection(db, "tokens");
        const q = query(tokensRef, where("symbol", "==", token.baseToken.symbol));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          console.error(`No token found in Firebase for symbol: ${token.baseToken.symbol}`);
          toast.error(`Token ${token.baseToken.symbol} not found in database.`);
          return;
        }

        const tokenDoc = querySnapshot.docs[0].data();
        const tokenAddress = tokenDoc.address;

        if (!tokenAddress) {
          console.error(`Token address not found in Firebase for ${token.baseToken.symbol}`);
          toast.error(`Token address for ${token.baseToken.symbol} is missing in database.`);
          return;
        }

        const wethToken: SwapToken = {
          address: WETH_ADDRESS,
          symbol: "WETH",
          name: "Wrapped Ether",
          decimals: 18,
        };
        const otherToken: SwapToken = {
          address: tokenAddress,
          symbol: token.baseToken.symbol,
          name: token.baseToken.name,
          decimals: 18,
        };

        console.log("Tokens set:", { wethToken, otherToken });

        // WETH -> Other Token = Buy
        // Other Token -> WETH = Sell
        if (activeTab === "buy") {
          setTokenIn(wethToken);
          setTokenOut(otherToken);
        } else {
          setTokenIn(otherToken);
          setTokenOut(wethToken);
        }
      } catch (error) {
        console.error("Error fetching token address from Firebase:", error);
        toast.error("Failed to fetch token data from database.");
      }
    };

    fetchTokenAddress();
  }, [token, activeTab]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!isConnected || !address || !tokenIn) {
        setWalletBalance("0.0");
        return;
      }

      try {
        if (tokenIn.address === ETH_ADDRESS) {
          const ethBalance = balance ? ethers.formatEther(balance.value) : "0";
          setWalletBalance(parseFloat(ethBalance).toFixed(4));
        } else {
          const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, provider);
          const tokenBalance = await tokenContract.balanceOf(address);
          const decimals = await tokenContract.decimals();
          const formattedBalance = ethers.formatUnits(tokenBalance, decimals);
          setWalletBalance(parseFloat(formattedBalance).toFixed(4));
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
        setWalletBalance("0.0");
        toast.error("Failed to fetch wallet balance. Please try again.");
      }
    };

    fetchBalance();
  }, [isConnected, address, tokenIn, balance, wethBalance]);

  // Check allowance for tokenIn
  useEffect(() => {
    const checkAllowance = async () => {
      if (!isConnected || !address || !tokenIn || tokenIn.address === ETH_ADDRESS || !amountIn || parseFloat(amountIn) <= 0) {
        setIsApproved(false);
        return;
      }

      try {
        const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, provider);
        const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
        const allowance = await tokenContract.allowance(address, SWAP_ROUTER_ADDRESS);
        setIsApproved(allowance >= amountInWei);
      } catch (error) {
        console.error("Error checking allowance:", error);
        setIsApproved(false);
        toast.error("Failed to check token allowance.");
      }
    };

    checkAllowance();
  }, [isConnected, address, tokenIn, amountIn]);

  // Fetch live quote, gas estimate, and platform fee
  useEffect(() => {
    console.log("useEffect for fetching quote triggered with:", { amountIn, tokenIn, tokenOut, ethPrice, isConnected, address });

    if (!amountIn || parseFloat(amountIn) <= 0 || !tokenIn || !tokenOut) {
      console.log("Skipping quote fetch: invalid inputs", { amountIn, tokenIn, tokenOut });
      setAmountOut("");
      setPriceImpact(0);
      setGasEstimate("0");
      setPlatformFee("0");
      return;
    }

    const fetchQuote = async () => {
      try {
        console.log("Fetching quote for:", { amountIn, tokenIn: tokenIn.symbol, tokenOut: tokenOut.symbol });
        const quoterContract = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);

        let tokenInAddress = tokenIn.address;
        let tokenOutAddress = tokenOut.address;

        // Handle ETH/WETH conversion for quoting
        if (tokenIn.address === ETH_ADDRESS) tokenInAddress = WETH_ADDRESS;
        if (tokenOut.address === ETH_ADDRESS) tokenOutAddress = WETH_ADDRESS;

        const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
        const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1% fee tiers
        let quotedAmountOut: bigint | null = null;
        let selectedFee: number = 3000;

        // Try different fee tiers to find a valid pool
        for (const fee of feeTiers) {
          try {
            const params = {
              tokenIn: tokenInAddress,
              tokenOut: tokenOutAddress,
              amountIn: amountInWei,
              fee: fee,
              sqrtPriceLimitX96: 0,
            };
            const [amountOut] = await quoterContract.quoteExactInputSingle.staticCall(params);
            quotedAmountOut = amountOut;
            selectedFee = fee;
            console.log(`Quote successful with fee tier ${fee}: ${amountOut} ${tokenOut.symbol}`);
            break;
          } catch (error) {
            console.warn(`Quote failed with fee tier ${fee}:`, error);
            continue;
          }
        }

        if (!quotedAmountOut) {
          throw new Error(`No valid pool found for token pair ${tokenIn.symbol}/${tokenOut.symbol}`);
        }

        const amountOutFormatted = ethers.formatUnits(quotedAmountOut, tokenOut.decimals);
        setAmountOut(parseFloat(amountOutFormatted).toFixed(6));

        // Calculate price impact
        const inputPrice = parseFloat(amountIn) * (tokenIn.symbol === "WETH" ? ethPrice : parseFloat(token?.priceUsd || "0"));
        const outputPrice = parseFloat(amountOutFormatted) * (tokenOut.symbol === "WETH" ? ethPrice : parseFloat(token?.priceUsd || "0"));
        const impact = inputPrice && outputPrice ? ((inputPrice - outputPrice) / inputPrice) * 100 : 0;
        setPriceImpact(Math.abs(impact));

        // Calculate platform fee (0.02% of amountIn)
        const platformFeeWei = (amountInWei * BigInt(Math.floor(PLATFORM_FEE_PERCENTAGE * 10000))) / BigInt(1000000);
        const platformFeeFormatted = ethers.formatUnits(platformFeeWei, tokenIn.decimals);
        setPlatformFee(parseFloat(platformFeeFormatted).toFixed(6));

        // Estimate gas
        if (isConnected && address) {
          const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
          const swapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, signer);
          const params = {
            tokenIn: tokenInAddress,
            tokenOut: tokenOutAddress,
            fee: selectedFee,
            recipient: tokenOut.address === ETH_ADDRESS ? SWAP_ROUTER_ADDRESS : address,
            amountIn: amountInWei,
            amountOutMinimum: BigInt(quotedAmountOut) * BigInt(Math.floor((100 - slippage) * 100)) / BigInt(10000),
            sqrtPriceLimitX96: 0,
          };
          const gas = await swapRouter.exactInputSingle.estimateGas(params, {
            value: tokenIn.address === ETH_ADDRESS ? amountInWei : 0,
          });
          setGasEstimate(ethers.formatUnits(gas, "gwei"));
        }
      } catch (error: any) {
        console.error("Error fetching swap quote:", error.message);
        setAmountOut("");
        setPriceImpact(0);
        setGasEstimate("0");
        setPlatformFee("0");
        toast.error(error.message || "Failed to fetch swap quote. Please check the token pair and try again.");
      }
    };

    fetchQuote();
  }, [amountIn, tokenIn, tokenOut, ethPrice, token?.priceUsd, isConnected, address, slippage]);

  // Handle wallet connection with message signing
  const handleConnectWallet = async (connector: any) => {
    if (!isConnected) {
      try {
        await connect({ connector });
        setShowWalletModal(false);
        toast.success("Wallet connected successfully");

        // Request a message signature after connection
        const message = `Please sign this message to authenticate your wallet for swapping on Base network.\n\nAddress: ${address}\nTimestamp: ${Date.now()}`;
        await signMessageAsync({ message });
        toast.success("Wallet authenticated successfully");
      } catch (error) {
        console.error("Wallet connection or signing failed:", error);
        toast.error("Failed to connect or authenticate wallet. Please try again.");
      }
    }
  };

  // Validate swap inputs
  const validateSwap = (): boolean => {
    console.log("Validating swap with:", { isConnected, address, tokenIn, tokenOut, amountIn, amountOut, walletBalance });

    if (!isConnected || !address) {
      console.log("Validation failed: Wallet not connected");
      toast.error("Please connect your wallet");
      return false;
    }

    if (!tokenIn || !tokenOut) {
      console.log("Validation failed: Tokens not selected", { tokenIn, tokenOut });
      toast.error("Please select tokens to swap");
      return false;
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      console.log("Validation failed: Invalid amountIn", { amountIn });
      toast.error("Please enter a valid amount to swap");
      return false;
    }

    const balanceValue = parseFloat(walletBalance);
    if (parseFloat(amountIn) > balanceValue) {
      console.log("Validation failed: Insufficient balance", { amountIn, walletBalance });
      toast.error(`Insufficient ${tokenIn.symbol} balance. You have ${balanceValue} ${tokenIn.symbol}.`);
      return false;
    }

    if (!amountOut || parseFloat(amountOut) <= 0) {
      console.log("Validation failed: Invalid amountOut", { amountOut });
      toast.error("Unable to fetch swap quote. Please try again.");
      return false;
    }

    console.log("Validation passed");
    return true;
  };

  // Check if wallet is on the correct network (Base)
  const checkNetwork = async (signer: ethers.Signer): Promise<boolean> => {
    try {
      if (!signer.provider) {
        throw new Error("Signer provider is null. Please ensure your wallet is connected.");
      }
      const network = await signer.provider.getNetwork();
      const chainId = Number(network.chainId);
      console.log("Current network chain ID:", chainId);
      if (chainId !== BASE_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }],
          });
          return true;
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${BASE_CHAIN_ID.toString(16)}`,
                  chainName: "Base",
                  rpcUrls: ["https://mainnet.base.org"],
                  nativeCurrency: {
                    name: "Ether",
                    symbol: "ETH",
                    decimals: 18,
                  },
                  blockExplorerUrls: ["https://basescan.org"],
                },
              ],
            });
            return true;
          }
          console.error("Network switch failed:", switchError);
          toast.error("Please switch to the Base network in your wallet.");
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Error checking network:", error);
      toast.error("Failed to check network. Please ensure your wallet is connected.");
      return false;
    }
  };

  // Open confirmation modal
  const openConfirmModal = () => {
    console.log("Opening confirm modal...");
    if (validateSwap()) {
      setShowConfirmModal(true);
    } else {
      console.log("Swap validation failed, confirm modal not opened");
    }
  };

  // Handle combined approve, swap, and platform fee
  const handleSwapWithApproval = async () => {
    console.log("Handling swap with approval...");
    if (!validateSwap()) return;

    setShowConfirmModal(false);
    setIsSwapLoading(true);
    setTransactionStatus("Initiating swap...");

    try {
      if (!window.ethereum) {
        throw new Error("No wallet detected. Please install MetaMask or another wallet provider.");
      }

      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();

      // Check if the wallet is on the Base network
      const isCorrectNetwork = await checkNetwork(signer);
      if (!isCorrectNetwork) {
        throw new Error("Incorrect network. Please switch to Base.");
      }

      const amountInWei = ethers.parseUnits(amountIn, tokenIn!.decimals);
      const amountOutMin = ethers.parseUnits(amountOut || "0", tokenOut!.decimals) * BigInt(Math.floor((100 - slippage) * 100)) / BigInt(10000);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      // Step 1: Handle ETH to WETH conversion if necessary
      let tokenInAddress = tokenIn!.address;
      if (tokenIn!.address === ETH_ADDRESS) {
        setTransactionStatus("Converting ETH to WETH...");
        console.log("Converting ETH to WETH...");
        const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
        const depositGas = await wethContract.deposit.estimateGas({ value: amountInWei });
        const depositTx = await wethContract.deposit({ value: amountInWei, gasLimit: depositGas });
        await depositTx.wait();
        tokenInAddress = WETH_ADDRESS;
        toast.info("ETH converted to WETH");
      }

      // Step 2: Approve token if necessary
      if (tokenIn!.address !== ETH_ADDRESS && !isApproved) {
        setTransactionStatus("Approving token...");
        console.log("Approving token...");
        const tokenContract = new ethers.Contract(tokenIn!.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(address, SWAP_ROUTER_ADDRESS);
        if (allowance < amountInWei) {
          const approveGas = await tokenContract.approve.estimateGas(SWAP_ROUTER_ADDRESS, amountInWei);
          const approveTx = await tokenContract.approve(SWAP_ROUTER_ADDRESS, amountInWei, { gasLimit: approveGas });
          await approveTx.wait();
          setIsApproved(true);
          toast.success(`${tokenIn!.symbol} approved for swapping`);
        }
      }

      // Step 3: Calculate and send platform fee (0.02%)
      const platformFeeWei = (amountInWei * BigInt(Math.floor(PLATFORM_FEE_PERCENTAGE * 10000))) / BigInt(1000000);
      const amountInAfterFee = amountInWei - platformFeeWei;

      if (platformFeeWei > 0) {
        setTransactionStatus("Sending platform fee...");
        console.log("Sending platform fee...");
        if (tokenIn!.address === ETH_ADDRESS) {
          const feeGas = await signer.estimateGas({
            to: PLATFORM_WALLET,
            value: platformFeeWei,
          });
          const feeTx = await signer.sendTransaction({
            to: PLATFORM_WALLET,
            value: platformFeeWei,
            gasLimit: feeGas,
          });
          await feeTx.wait();
        } else {
          const tokenContract = new ethers.Contract(tokenInAddress, ERC20_ABI, signer);
          const feeGas = await tokenContract.transfer.estimateGas(PLATFORM_WALLET, platformFeeWei);
          const feeTx = await tokenContract.transfer(PLATFORM_WALLET, platformFeeWei, { gasLimit: feeGas });
          await feeTx.wait();
        }
        toast.info("Platform fee sent");
      }

      // Step 4: Execute the swap with the remaining amount
      setTransactionStatus("Executing swap...");
      console.log("Executing swap...");
      const swapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, signer);
      const params = {
        tokenIn: tokenInAddress,
        tokenOut: tokenOut!.address === ETH_ADDRESS ? WETH_ADDRESS : tokenOut!.address,
        fee: 3000,
        recipient: tokenOut!.address === ETH_ADDRESS ? SWAP_ROUTER_ADDRESS : address,
        amountIn: amountInAfterFee,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0,
      };

      const swapGas = await swapRouter.exactInputSingle.estimateGas(params, {
        value: tokenIn!.address === ETH_ADDRESS ? amountInAfterFee : 0,
      });
      const swapTx = await swapRouter.exactInputSingle(params, {
        value: tokenIn!.address === ETH_ADDRESS ? amountInAfterFee : 0,
        gasLimit: swapGas,
      });
      await swapTx.wait();
      toast.info("Swap executed");

      // Step 5: Unwrap WETH to ETH if necessary
      if (tokenOut!.address === ETH_ADDRESS) {
        setTransactionStatus("Unwrapping WETH to ETH...");
        console.log("Unwrapping WETH to ETH...");
        const unwrapGas = await swapRouter.unwrapWETH9.estimateGas(amountOutMin, address);
        const unwrapTx = await swapRouter.unwrapWETH9(amountOutMin, address, { gasLimit: unwrapGas });
        await unwrapTx.wait(); // Fixed: Wait for unwrapTx, not swapTx
        toast.info("WETH unwrapped to ETH");
      }

      // Update Bought/Sold and Profit/Loss
      const amountInNum = parseFloat(amountIn);
      const amountOutNum = parseFloat(amountOut);
      if (activeTab === "buy") {
        setBoughtAmount((prev) => prev + amountOutNum);
        setProfitLoss((prev) => prev - amountInNum * ethPrice + amountOutNum * parseFloat(token?.priceUsd || "0"));
      } else {
        setSoldAmount((prev) => prev + amountInNum);
        setProfitLoss((prev) => prev + amountInNum * parseFloat(token?.priceUsd || "0") - amountOutNum * ethPrice);
      }

      setTransactionStatus("Transaction Complete");
      toast.success(`Successfully swapped ${amountIn} ${tokenIn!.symbol} for ${amountOut} ${tokenOut!.symbol}`);
      setAmountIn("");
      setAmountOut("");
      setIsApproved(false);
    } catch (error: any) {
      console.error("Swap failed:", error);
      setTransactionStatus("");
      if (error.code === 4001) {
        toast.error("Transaction rejected by user.");
      } else if (error.message.includes("Incorrect network")) {
        toast.error("Please switch to the Base network in your wallet.");
      } else {
        toast.error(error.reason || "Swap failed. Please try again.");
      }
    } finally {
      setIsSwapLoading(false);
    }
  };

  // Handle token swap (for the swap arrow button)
  const handleSwapTokens = () => {
    if (tokenIn && tokenOut) {
      setTokenIn(tokenOut);
      setTokenOut(tokenIn);
      setAmountIn("");
      setAmountOut("");
      setIsApproved(false);
      // Toggle buy/sell based on token pair
      setActiveTab(tokenIn.symbol === "WETH" ? "sell" : "buy");
    }
  };

  return (
    <div className="w-full font-sans">
      {/* @ts-ignore */}
      <style jsx>{`
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.6s ease-out;
        }
        .swap-container {
          background: #111827;
          border-radius: 8px;
          padding: 8px; /* Increased for better spacing */
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
          border: none;
          width: 100%;
          box-sizing: border-box;
          margin: 0;
        }
        .swap-input-container {
          background: #1f2937;
          border-radius: 4px;
          padding: 6px; /* Increased for better spacing */
          margin-bottom: 4px; /* Increased for better spacing */
          border: none;
          width: 100%;
          box-sizing: border-box;
        }
        .swap-input {
          background: transparent;
          border: none;
          color: #d1d5db;
          width: 100%;
          font-size: 16px; /* Slightly larger for readability */
          outline: none;
        }
        .swap-input:disabled {
          color: #6b7280;
          cursor: not-allowed;
        }
        .token-label {
          font-size: 14px; /* Slightly larger for readability */
          color: #6b7280;
          margin-bottom: 2px; /* Added small margin for clarity */
          text-transform: uppercase;
        }
        .token-select {
          background: #111827;
          color: #d1d5db;
          padding: 4px 8px; /* Increased for better spacing */
          border-radius: 4px;
          font-size: 16px; /* Slightly larger for readability */
          font-weight: 500;
          border: none;
        }
        .swap-arrow-container {
          display: flex;
          justify-content: center;
          margin: 4px 0; /* Increased for better spacing */
          background: #111827; /* Match parent background */
        }
        .swap-arrow {
          background: #1f2937;
          border-radius: 50%;
          padding: 4px; /* Increased for better spacing */
          cursor: pointer;
          transition: transform 0.3s ease-in-out;
          border: none;
        }
        .swap-arrow:hover {
          transform: scale(1.1);
        }
        .swap-arrow:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .buy-sell-toggle {
          display: flex;
          background: #1f2937;
          border-radius: 9999px;
          padding: 2px; /* Slightly increased */
          margin-bottom: 6px; /* Increased for better spacing */
          border: none;
          width: 100%;
          box-sizing: border-box;
        }
        .buy-sell-button {
          flex: 1;
          padding: 6px; /* Increased for better spacing */
          border-radius: 9999px;
          font-size: 16px; /* Slightly larger for readability */
          font-weight: 600;
          text-align: center;
          text-transform: uppercase;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .buy-sell-button.buy {
          color: #34d399;
          border: none;
        }
        .buy-sell-button.sell {
          color: #f87171;
          border: none;
        }
        .buy-sell-button.active.buy {
          background: rgba(52, 211, 153, 0.2);
          color: #34d399;
          border: none;
        }
        .buy-sell-button.active.sell {
          background: rgba(248, 113, 113, 0.2);
          color: #f87171;
          border: none;
        }
        .buy-sell-button:not(.active) {
          opacity: 0.7;
        }
        .buy-sell-button:hover:not(.active) {
          opacity: 1;
          background: rgba(59, 130, 246, 0.1);
        }
        .swap-action-button {
          background: linear-gradient(90deg, #6366f1, #4f46e5);
          color: #ffffff;
          padding: 8px; /* Increased for better spacing */
          border-radius: 4px;
          font-size: 16px; /* Slightly larger for readability */
          font-weight: 600;
          text-transform: uppercase;
          transition: all 0.3s ease;
          width: 100%;
          border: none;
          cursor: pointer;
          margin-top: 6px; /* Increased for better spacing */
          box-sizing: border-box;
        }
        .swap-action-button:hover {
          background: linear-gradient(90deg, #4f46e5, #4338ca);
        }
        .swap-action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .swap-info {
          font-size: 14px; /* Slightly larger for readability */
          color: #6b7280;
          margin: 4px 0; /* Increased for better spacing */
        }
        .swap-info div {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px; /* Added small margin for clarity */
        }
        .profit-loss {
          display: flex;
          justify-content: space-between;
          font-size: 14px; /* Slightly larger for readability */
          color: #6b7280;
          padding: 6px; /* Increased for better spacing */
          background: #1f2937;
          border-radius: 4px;
          margin-top: 4px; /* Increased for better spacing */
          border: none;
          width: 100%;
          box-sizing: border-box;
        }
        .profit-loss span {
          color: #d1d5db;
        }
        .profit-loss .profit-positive {
          color: #34d399;
        }
        .profit-loss .profit-negative {
          color: #f87171;
        }
        .eth-icon {
          font-size: 14px; /* Slightly larger for readability */
          margin-right: 4px;
          color: #6b7280;
        }
        .wallet-button {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          padding: 6px; /* Increased for better spacing */
          border-radius: 4px;
          font-size: 16px; /* Slightly larger for readability */
          font-weight: 600;
          text-transform: uppercase;
          transition: all 0.3s ease;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: none;
          cursor: pointer;
          box-sizing: border-box;
        }
        .wallet-button:hover {
          background: rgba(59, 130, 246, 0.4);
        }
        .wallet-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .wallet-address {
          background: #1f2937;
          border-radius: 4px;
          padding: 6px; /* Increased for better spacing */
          color: #d1d5db;
          font-size: 14px; /* Slightly larger for readability */
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: none;
          width: 100%;
          box-sizing: border-box;
        }
        .wallet-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 50;
        }
        .wallet-modal-content {
          background: #111827;
          border: none;
          border-radius: 8px;
          padding: 16px;
          width: 300px;
          max-width: 90%;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          box-sizing: border-box;
        }
        .wallet-option {
          background: #1f2937;
          padding: 8px;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.3s ease;
          border: none;
        }
        .wallet-option:hover {
          background: #374151;
        }
        .transaction-status {
          padding: 6px; /* Increased for better spacing */
          background: rgba(59, 130, 246, 0.1);
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #d1d5db;
          font-size: 14px; /* Slightly larger for readability */
          border: none;
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 4px; /* Increased for better spacing */
        }
        .transaction-complete {
          padding: 6px; /* Increased for better spacing */
          background: rgba(52, 211, 153, 0.1);
          border-radius: 4px;
          color: #34d399;
          font-size: 14px; /* Slightly larger for readability */
          text-align: center;
          border: none;
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 4px; /* Increased for better spacing */
        }
        @media (max-width: 768px) {
          .swap-container {
            padding: 6px;
          }
          .swap-input {
            font-size: 14px;
            padding: 4px;
          }
          .buy-sell-button,
          .swap-action-button,
          .wallet-button {
            font-size: 14px;
            padding: 6px;
          }
          .swap-info,
          .profit-loss {
            font-size: 12px;
          }
          .wallet-address {
            font-size: 12px;
            padding: 4px;
          }
          .token-label,
          .token-select {
            font-size: 14px;
          }
          .wallet-modal-content {
            width: 90%;
          }
        }
      `}</style>

      {/* Wallet Connection Modal */}
      {showWalletModal && (
        <div className="wallet-modal">
          <div className="wallet-modal-content fade-in">
            <h3 className="text-lg font-semibold mb-4 text-gray-100 uppercase">Connect a Wallet</h3>
            {connectors.map((connector) => (
              <div
                key={connector.id}
                className="wallet-option"
                onClick={() => handleConnectWallet(connector)}
              >
                <FaWallet className="w-4 h-4 text-blue-400" />
                <span className="text-gray-200">{connector.name}</span>
              </div>
            ))}
            <button
              onClick={() => setShowWalletModal(false)}
              className="mt-4 text-gray-400 hover:text-red-400 text-sm uppercase"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Swap Confirmation Modal */}
      {showConfirmModal && (
        <div className="wallet-modal">
          <div className="wallet-modal-content fade-in">
            <h3 className="text-lg font-semibold mb-4 text-gray-100 uppercase">Confirm {activeTab === "buy" ? "Buy" : "Sell"}</h3>
            <div className="space-y-2 text-sm text-gray-200">
              <div className="flex justify-between">
                <span>You Pay:</span>
                <span>{amountIn} {tokenIn?.symbol ?? "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span>You Receive (Est.):</span>
                <span>{amountOut} {tokenOut?.symbol ?? "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform Fee (0.02%):</span>
                <span>{platformFee} {tokenIn?.symbol ?? "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span>Price Impact:</span>
                <span className={priceImpact > 5 ? "text-red-400" : "text-gray-100"}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Gas Estimate:</span>
                <span>{gasEstimate} Gwei</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSwapWithApproval}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white uppercase ${activeTab === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                Confirm {activeTab === "buy" ? "Buy" : "Sell"}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-600 text-gray-100 hover:bg-gray-700 uppercase"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap Container */}
      <div className="swap-container fade-in">
        {/* Wallet Connection */}
        <div className="mb-4">
          {isConnected ? (
            <div className="wallet-address">
              <div className="flex items-center gap-2">
                <FaWallet className="text-blue-400 w-4 h-4" />
                <span className="truncate">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              </div>
              <button
                onClick={() => disconnect()}
                className="text-gray-400 hover:text-red-400 text-xs uppercase"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowWalletModal(true)}
              className="wallet-button"
              disabled={isSwapLoading}
            >
              <FaWallet className="w-4 h-4" />
              Connect Wallet
            </button>
          )}
        </div>

        {/* Buy/Sell Toggle */}
        <div className="buy-sell-toggle">
          <div
            onClick={() => setActiveTab("buy")}
            className={`buy-sell-button buy ${activeTab === "buy" ? "active" : ""}`}
          >
            Buy
          </div>
          <div
            onClick={() => setActiveTab("sell")}
            className={`buy-sell-button sell ${activeTab === "sell" ? "active" : ""}`}
          >
            Sell
          </div>
        </div>

        {/* Transaction Status */}
        {transactionStatus && (
          <div className={transactionStatus === "Transaction Complete" ? "transaction-complete" : "transaction-status"}>
            {transactionStatus !== "Transaction Complete" && (
              <svg
                className="animate-spin h-4 w-4 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            <span>{transactionStatus}</span>
          </div>
        )}

        {/* Token In */}
        <div className="swap-input-container">
          <div className="token-label">You Pay (Balance: {walletBalance} {tokenIn?.symbol ?? ""})</div>
          <div className="flex items-center gap-2">
            <span className="token-select">{tokenIn?.symbol ?? "Select"}</span>
            <input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="swap-input"
              disabled={!tokenIn || !isConnected || isSwapLoading}
            />
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="swap-arrow-container">
          <button
            onClick={handleSwapTokens}
            className="swap-arrow"
            disabled={!tokenIn || !tokenOut || isSwapLoading}
          >
            <svg
              className="w-4 h-4 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
          </button>
        </div>

        {/* Token Out */}
        <div className="swap-input-container">
          <div className="token-label">You Receive (Est. {amountOut || "0.0"} {tokenOut?.symbol ?? ""})</div>
          <div className="flex items-center gap-2">
            <span className="token-select">{tokenOut?.symbol ?? "Select"}</span>
            <input
              type="number"
              placeholder="0.0"
              value={amountOut}
              disabled
              className="swap-input"
            />
          </div>
        </div>

        {/* Swap Info */}
        <div className="swap-info">
          <div>
            <span>Price Impact:</span>
            <span className={priceImpact > 5 ? "text-red-400" : "text-gray-100"}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
          <div>
            <span>Platform Fee (0.02%):</span>
            <span>{platformFee} {tokenIn?.symbol ?? ""}</span>
          </div>
          <div>
            <span>Slippage Tolerance:</span>
            <span>{slippage}%</span>
          </div>
          <div>
            <span>Gas Estimate:</span>
            <span>{gasEstimate} Gwei</span>
          </div>
        </div>

        {/* Profit/Loss Section */}
        <div className="profit-loss">
          <div>
            <span>Bought: </span>
            <span>{boughtAmount.toFixed(2)} {tokenOut?.symbol === "WETH" ? "" : tokenOut?.symbol ?? ""}</span>
          </div>
          <div>
            <span>Sold: </span>
            <span>{soldAmount.toFixed(2)} {tokenIn?.symbol === "WETH" ? "" : tokenIn?.symbol ?? ""}</span>
          </div>
          <div>
            <span>P&L: </span>
            <span className={profitLoss >= 0 ? "profit-positive" : "profit-negative"}>
              <span className="eth-icon">Ξ</span>
              {profitLoss >= 0 ? "+" : ""}{profitLoss.toFixed(2)} ({((profitLoss / (boughtAmount || 1)) * 100).toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Swap Button */}
        <button
          onClick={openConfirmModal}
          className="swap-action-button"
          disabled={isSwapLoading || !isConnected || !amountIn || !tokenIn || !tokenOut}
        >
          {isSwapLoading ? "Processing..." : activeTab === "buy" ? "Buy" : "Sell"}
        </button>
      </div>
    </div>
  );
};

export default Swap;