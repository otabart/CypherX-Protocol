// /token-scanner/swap.tsx
"use client";

import React, { useEffect, useState } from "react";
import { FaExchangeAlt, FaWallet } from "react-icons/fa";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { ethers } from "ethers";
import { toast } from "react-toastify";

// Constants for Base network (Uniswap V3 addresses)
const SWAP_ROUTER_ADDRESS = "0x2626664c2603E5475e998cB8976B0dF48E8b8A94"; // Uniswap V3 SwapRouter on Base
const QUOTER_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"; // Uniswap V3 Quoter on Base
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base
const ETH_ADDRESS = ethers.ZeroAddress; // ETH represented as zero address

// ABI for Uniswap V3 Quoter
const QUOTER_ABI = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external view returns (uint256 amountOut)",
];

// WETH ABI for wrapping/unwrapping
const WETH_ABI = [
  "function deposit() external payable",
  "function withdraw(uint256 wad) external",
  "function balanceOf(address owner) public view returns (uint256)",
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
];

// ERC20 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function decimals() public view returns (uint8)",
];

// Swap Router ABI
const SWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) external payable",
];

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
}

interface SwapFormProps {
  token: TokenMetadata | null;
  ethPrice: number;
}

const provider = new ethers.JsonRpcProvider("https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN");

export default function SwapForm({ token, ethPrice }: SwapFormProps) {
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("");
  const [tokenIn, setTokenIn] = useState<SwapToken | null>(null);
  const [tokenOut, setTokenOut] = useState<SwapToken | null>(null);
  const [isSwapLoading, setIsSwapLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [slippage] = useState<number>(0.5);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [gasEstimate, setGasEstimate] = useState<string>("0");
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [walletBalance, setWalletBalance] = useState<string>("0.0");
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);

  // Fetch ETH/WETH balance using wagmi
  const { data: ethBalance } = useBalance({
    address: address as `0x${string}`,
  });

  const { data: wethBalance } = useBalance({
    address: address as `0x${string}`,
    token: WETH_ADDRESS as `0x${string}`,
  });

  // Setup tokens for swapping
  useEffect(() => {
    if (token && token.baseToken && token.quoteToken) {
      const baseToken: SwapToken = {
        address: token.baseToken.address || ETH_ADDRESS,
        symbol: token.baseToken.symbol === "ETH" ? "ETH" : token.baseToken.symbol,
        name: token.baseToken.name,
        decimals: 18,
      };
      const quoteToken: SwapToken = {
        address: token.quoteToken.address || WETH_ADDRESS,
        symbol: token.quoteToken.symbol === "WETH" ? "WETH" : token.quoteToken.symbol,
        name: token.quoteToken.name,
        decimals: 18,
      };
      setTokenIn(baseToken);
      setTokenOut(quoteToken);
    }
  }, [token]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!isConnected || !address || !tokenIn) {
        setWalletBalance("0.0");
        return;
      }

      try {
        if (tokenIn.address === ETH_ADDRESS) {
          const balance = ethBalance ? ethers.formatEther(ethBalance.value) : "0";
          setWalletBalance(parseFloat(balance).toFixed(4));
        } else {
          const balance = wethBalance ? ethers.formatUnits(wethBalance.value, tokenIn.decimals) : "0";
          setWalletBalance(parseFloat(balance).toFixed(4));
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
        setWalletBalance("0.0");
        toast.error("Failed to fetch wallet balance");
      }
    };

    fetchBalance();
  }, [isConnected, address, tokenIn, ethBalance, wethBalance]);

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
      }
    };

    checkAllowance();
  }, [isConnected, address, tokenIn, amountIn]);

  // Fetch live quote and gas estimate
  useEffect(() => {
    if (!amountIn || parseFloat(amountIn) <= 0 || !tokenIn || !tokenOut) {
      setAmountOut("");
      setPriceImpact(0);
      setGasEstimate("0");
      return;
    }

    const fetchQuote = async () => {
      try {
        const quoterContract = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);

        let tokenInAddress = tokenIn.address;
        let tokenOutAddress = tokenOut.address;

        // Handle ETH/WETH conversion for quoting
        if (tokenIn.address === ETH_ADDRESS) tokenInAddress = WETH_ADDRESS;
        if (tokenOut.address === ETH_ADDRESS) tokenOutAddress = WETH_ADDRESS;

        const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
        const fee = 3000; // 0.3% fee tier
        const quotedAmountOut = await quoterContract.quoteExactInputSingle.staticCall(
          tokenInAddress,
          tokenOutAddress,
          fee,
          amountInWei,
          0
        );

        const amountOutFormatted = ethers.formatUnits(quotedAmountOut, tokenOut.decimals);
        setAmountOut(parseFloat(amountOutFormatted).toFixed(4));

        // Calculate price impact
        const inputPrice = parseFloat(amountIn) * parseFloat(token?.priceUsd || "0");
        const outputPrice = parseFloat(amountOutFormatted) * (tokenOut.symbol === "WETH" || tokenOut.symbol === "ETH" ? ethPrice : parseFloat(token?.priceUsd || "0"));
        const impact = inputPrice && outputPrice ? ((inputPrice - outputPrice) / inputPrice) * 100 : 0;
        setPriceImpact(Math.abs(impact));

        // Estimate gas
        if (isConnected && address) {
          const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
          const swapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, signer);
          const params = {
            tokenIn: tokenInAddress,
            tokenOut: tokenOutAddress,
            fee: 3000,
            recipient: tokenOut.address === ETH_ADDRESS ? SWAP_ROUTER_ADDRESS : address,
            deadline: Math.floor(Date.now() / 1000) + 60 * 20,
            amountIn: amountInWei,
            amountOutMinimum: BigInt(quotedAmountOut) * BigInt(Math.floor((100 - slippage) * 100)) / BigInt(10000),
            sqrtPriceLimitX96: 0,
          };
          const gas = await swapRouter.exactInputSingle.estimateGas(params, {
            value: tokenIn.address === ETH_ADDRESS ? amountInWei : 0,
          });
          setGasEstimate(ethers.formatUnits(gas, "gwei"));
        }
      } catch (error) {
        console.error("Error fetching swap quote:", error);
        setAmountOut("");
        setPriceImpact(0);
        setGasEstimate("0");
        toast.error("Failed to fetch swap quote");
      }
    };

    fetchQuote();
  }, [amountIn, tokenIn, tokenOut, ethPrice, token, isConnected, address, slippage]);

  // Handle wallet connection
  const handleConnectWallet = (connector: any) => {
    if (!isConnected) {
      try {
        connect({ connector });
        setShowWalletModal(false);
        toast.success("Wallet connected successfully");
      } catch (error) {
        console.error("Wallet connection failed:", error);
        toast.error("Failed to connect wallet. Please try again.");
      }
    }
  };

  // Handle combined approve and swap
  const handleSwapWithApproval = async () => {
    if (!isConnected || !address || !tokenIn || !tokenOut) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!amountIn || parseFloat(amountIn) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSwapLoading(true);
    try {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
      const amountOutMin = ethers.parseUnits(amountOut || "0", tokenOut.decimals) * BigInt(Math.floor((100 - slippage) * 100)) / BigInt(10000);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      // Step 1: Handle ETH to WETH conversion if necessary
      let tokenInAddress = tokenIn.address;
      if (tokenIn.address === ETH_ADDRESS) {
        const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
        const depositTx = await wethContract.deposit({ value: amountInWei });
        await depositTx.wait();
        tokenInAddress = WETH_ADDRESS;
      }

      // Step 2: Approve token if necessary
      if (tokenIn.address !== ETH_ADDRESS && !isApproved) {
        const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(address, SWAP_ROUTER_ADDRESS);
        if (allowance < amountInWei) {
          const approveTx = await tokenContract.approve(SWAP_ROUTER_ADDRESS, amountInWei);
          await approveTx.wait();
          setIsApproved(true);
          toast.success(`${tokenIn.symbol} approved for swapping`);
        }
      }

      // Step 3: Execute the swap
      const swapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, signer);
      const params = {
        tokenIn: tokenInAddress,
        tokenOut: tokenOut.address === ETH_ADDRESS ? WETH_ADDRESS : tokenOut.address,
        fee: 3000,
        recipient: tokenOut.address === ETH_ADDRESS ? SWAP_ROUTER_ADDRESS : address,
        deadline,
        amountIn: amountInWei,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0,
      };

      const swapTx = await swapRouter.exactInputSingle(params, {
        value: tokenIn.address === ETH_ADDRESS ? amountInWei : 0,
        gasLimit: 300000,
      });
      await swapTx.wait();

      // Step 4: Unwrap WETH to ETH if necessary
      if (tokenOut.address === ETH_ADDRESS) {
        const unwrapTx = await swapRouter.unwrapWETH9(amountOutMin, address);
        await unwrapTx.wait();
      }

      toast.success(`Successfully swapped ${amountIn} ${tokenIn.symbol} for ${amountOut} ${tokenOut.symbol}`);
      setAmountIn("");
      setAmountOut("");
      setIsApproved(false);
    } catch (error) {
      console.error("Swap failed:", error);
      toast.error("Swap failed");
    } finally {
      setIsSwapLoading(false);
    }
  };

  // Handle token swap
  const handleSwapTokens = () => {
    if (tokenIn && tokenOut) {
      setTokenIn(tokenOut);
      setTokenOut(tokenIn);
      setAmountIn("");
      setAmountOut("");
      setIsApproved(false);
    }
  };

  return (
    <>
      {/* Wallet Connection Modal */}
      {showWalletModal && (
        <div className="wallet-modal">
          <div className="wallet-modal-content">
            <h3 className="text-lg font-semibold mb-4 text-gray-100">Connect a Wallet</h3>
            {connectors.map((connector) => (
              <div
                key={connector.id}
                className="wallet-option"
                onClick={() => handleConnectWallet(connector)}
              >
                <FaWallet className="w-5 h-5 text-blue-500" />
                <span className="text-gray-200">{connector.name}</span>
              </div>
            ))}
            <button
              onClick={() => setShowWalletModal(false)}
              className="mt-4 text-gray-400 hover:text-red-400 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Swap Form Card */}
      <div className="swap-form-container">
        <h3 className="text-sm font-semibold mb-3 text-gray-100">Swap Tokens</h3>
        {/* Wallet Connection */}
        <div className="mb-4">
          {isConnected ? (
            <div className="wallet-address">
              <div className="flex items-center gap-2">
                <FaWallet className="text-blue-500 w-4 h-4" />
                <span className="truncate">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              </div>
              <button
                onClick={() => disconnect()}
                className="text-gray-400 hover:text-red-400 text-xs"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowWalletModal(true)}
              className="wallet-button"
            >
              <FaWallet className="w-4 h-4" />
              Connect Wallet
            </button>
          )}
        </div>

        {/* Token In */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">You Pay</span>
            <span className="text-xs text-gray-400">
              Balance: {walletBalance} {tokenIn?.symbol || ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-[#2A3B5A] text-gray-100 rounded p-2 font-sans text-sm">
              {tokenIn ? tokenIn.symbol : "Select"}
            </span>
            <input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="swap-input"
              disabled={!tokenIn || !isConnected}
            />
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center mb-4">
          <button
            onClick={handleSwapTokens}
            className="swap-arrow"
            disabled={!tokenIn || !tokenOut}
          >
            <FaExchangeAlt className="w-5 h-5 text-blue-500" />
          </button>
        </div>

        {/* Token Out */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">You Receive</span>
            <span className="text-xs text-gray-400">
              Est. {amountOut || "0.0"} {tokenOut?.symbol || ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-[#2A3B5A] text-gray-100 rounded p-2 font-sans text-sm">
              {tokenOut ? tokenOut.symbol : "Select"}
            </span>
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
        <div className="swap-info mb-4">
          <div className="flex justify-between">
            <span>Price Impact:</span>
            <span className={priceImpact > 5 ? "text-red-400" : "text-gray-100"}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span>Slippage Tolerance:</span>
            <span>{slippage}%</span>
          </div>
          <div className="flex justify-between">
            <span>Gas Estimate:</span>
            <span>{gasEstimate} Gwei</span>
          </div>
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwapWithApproval}
          disabled={isSwapLoading || !isConnected || !amountIn || !tokenIn || !tokenOut}
          className="swap-button"
        >
          {isSwapLoading ? "Processing..." : "Swap"}
        </button>
      </div>
    </>
  );
}