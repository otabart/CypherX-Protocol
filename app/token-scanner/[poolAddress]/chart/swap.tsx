// File: app/token-scanner/[poolAddress]/chart/swap.tsx
"use client";

import React, { useEffect, useState } from "react";
import { FaWallet } from "react-icons/fa";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useSignMessage,
} from "wagmi";
import { ethers } from "ethers";
import { toast } from "react-toastify";

// ────────────────────────────────────────────────────────────────────────────────
// 1) CONSTANTS & ABIs
// ────────────────────────────────────────────────────────────────────────────────
// SwapRouter02 on Base
const SWAP_ROUTER_ADDRESS = "0x2626664c2603E5475e998cB8976B0dF48E8b8A9";
// QuoterV2 on Base
const QUOTER_ADDRESS = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76";
// WETH on Base
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
// Represent ETH as zero‐address
const ETH_ADDRESS = ethers.ZeroAddress;
// Platform fee recipient
const PLATFORM_WALLET = "0x4146E18FeF6883Ee7c2F16feC60109133F1Fc491";
// 0.02% expressed as decimal (i.e. 2 basis points)
const PLATFORM_FEE_PERCENTAGE = 0.0002;
const BASE_CHAIN_ID = 8453; // Base mainnet

// ABI: QuoterV2 (quoteExactInputSingle)
const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) external view returns (uint256 amountOut,uint256 amountOutAfterFees,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
];

// ABI: WETH (deposit, withdraw, ERC20 basics)
const WETH_ABI = [
  "function deposit() external payable",
  "function withdraw(uint256 wad) external",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function transfer(address to,uint256 amount) returns (bool)",
];

// ERC20 ABI subset
const ERC20_ABI = [
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to,uint256 amount) returns (bool)",
];

// SwapRouter02 ABI (exactInputSingle + unwrapWETH9)
const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum,address recipient) external payable",
];

// ────────────────────────────────────────────────────────────────────────────────
// 2) TYPES
// ────────────────────────────────────────────────────────────────────────────────
type SwapToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
};

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

// ────────────────────────────────────────────────────────────────────────────────
// 3) COMPONENT
// ────────────────────────────────────────────────────────────────────────────────
const Swap: React.FC<SwapProps> = ({ token, ethPrice }) => {
  // ────────────────────────────────────────────────────────────────────────────────
  // 3.1) STATE HOOKS
  // ────────────────────────────────────────────────────────────────────────────────
  const [amountIn, setAmountIn] = useState<string>("");   // user enters this
  const [amountOut, setAmountOut] = useState<string>(""); // quoted result
  const [tokenIn, setTokenIn] = useState<SwapToken | null>(null);
  const [tokenOut, setTokenOut] = useState<SwapToken | null>(null);
  const [isSwapLoading, setIsSwapLoading] = useState<boolean>(false);
  const [transactionStatus, setTransactionStatus] = useState<string>(""); // status text
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [slippage] = useState<number>(0.5);  // default 0.5%
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [gasEstimate, setGasEstimate] = useState<string>("0");      // in Gwei
  const [walletBalance, setWalletBalance] = useState<string>("0.0"); // tokenIn balance
  const [platformFee, setPlatformFee] = useState<string>("0");      // 0.02% of amountIn
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [boughtAmount, setBoughtAmount] = useState<number>(0);
  const [soldAmount, setSoldAmount] = useState<number>(0);
  const [profitLoss, setProfitLoss] = useState<number>(0);

  // wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  // Native ETH balance (if tokenIn is ETH)
  const { data: nativeBalance } = useBalance({
    address: address as `0x${string}`,
  });

  // Ethers.js provider for read‐only RPC calls
  const provider = new ethers.JsonRpcProvider(
    "https://base-mainnet.g.alchemy.com/v2/8KR6qwxbLlIISgrMCZfsrYeMmn6-S-bN"
  );

  // ────────────────────────────────────────────────────────────────────────────────
  // 3.2) SET DEFAULT TOKENS: ETH → [chart token] or vice versa
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    // Build “otherToken” from token.baseToken
    const otherToken: SwapToken = {
      address: token.baseToken.address,
      symbol: token.baseToken.symbol,
      name: token.baseToken.name,
      decimals: 18, // assume ERC‐20 tokens are 18 decimals
    };
    // Build ETH placeholder
    const ethToken: SwapToken = {
      address: ETH_ADDRESS,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
    };

    if (activeTab === "buy") {
      setTokenIn(ethToken);
      setTokenOut(otherToken);
    } else {
      setTokenIn(otherToken);
      setTokenOut(ethToken);
    }
  }, [token, activeTab]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 3.3) FETCH WALLET BALANCE FOR tokenIn
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchBalance = async () => {
      if (!isConnected || !address || !tokenIn) {
        setWalletBalance("0.0");
        return;
      }
      try {
        if (tokenIn.address === ETH_ADDRESS) {
          // Native ETH
          const bal = nativeBalance
            ? ethers.formatEther(nativeBalance.value)
            : "0";
          setWalletBalance(parseFloat(bal).toFixed(4));
        } else {
          // ERC20 token
          const contract = new ethers.Contract(
            tokenIn.address,
            ERC20_ABI,
            provider
          );
          const rawBal = (await contract.balanceOf(address)) as ethers.BigNumber;
          const dec = (await contract.decimals()) as number;
          const formatted = ethers.formatUnits(rawBal, dec);
          setWalletBalance(parseFloat(formatted).toFixed(4));
        }
      } catch (err) {
        console.error("Error fetching wallet balance:", err);
        setWalletBalance("0.0");
      }
    };
    fetchBalance();
  }, [isConnected, address, tokenIn, nativeBalance]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 3.4) CHECK ALLOWANCE (if tokenIn ≠ ETH)
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAllowance = async () => {
      if (
        !isConnected ||
        !address ||
        !tokenIn ||
        tokenIn.address === ETH_ADDRESS ||
        !amountIn ||
        parseFloat(amountIn) <= 0
      ) {
        setIsApproved(false);
        return;
      }
      try {
        const contract = new ethers.Contract(
          tokenIn.address,
          ERC20_ABI,
          provider
        );
        // Convert amountIn to bigint
        const amtInWei: bigint = ethers.parseUnits(
          amountIn,
          tokenIn.decimals
        );
        const allowanceBn = (await contract.allowance(
          address,
          SWAP_ROUTER_ADDRESS
        )) as ethers.BigNumber;
        setIsApproved(allowanceBn.toBigInt() >= amtInWei);
      } catch (err) {
        console.error("Error checking allowance:", err);
        setIsApproved(false);
      }
    };
    checkAllowance();
  }, [isConnected, address, tokenIn, amountIn]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 3.5) FETCH QUOTE + PRICE IMPACT + GAS + PLATFORM FEE
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log("Quote effect:", {
      amountIn,
      tokenIn: tokenIn?.symbol,
      tokenOut: tokenOut?.symbol,
      ethPrice,
    });

    // If invalid inputs, clear everything
    if (!amountIn || parseFloat(amountIn) <= 0 || !tokenIn || !tokenOut) {
      setAmountOut("");
      setPriceImpact(0);
      setGasEstimate("0");
      setPlatformFee("0");
      return;
    }

    const fetchQuote = async () => {
      try {
        const quoter = new ethers.Contract(
          QUOTER_ADDRESS,
          QUOTER_ABI,
          provider
        );

        // Convert ETH→WETH if needed
        let inAddr = tokenIn.address;
        let outAddr = tokenOut.address;
        if (tokenIn.address === ETH_ADDRESS) inAddr = WETH_ADDRESS;
        if (tokenOut.address === ETH_ADDRESS) outAddr = WETH_ADDRESS;

        const amtInWei: bigint = ethers.parseUnits(
          amountIn,
          tokenIn.decimals
        );
        const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
        let quotedOut: bigint | null = null;
        let chosenFee = 3000;

        for (const fee of feeTiers) {
          try {
            const params = {
              tokenIn: inAddr,
              tokenOut: outAddr,
              amountIn: amtInWei,
              fee: fee,
              sqrtPriceLimitX96: 0n, // must be bigint
            };
            // Use callStatic on quoteExactInputSingle
            const result = (await (quoter as any).callStatic.quoteExactInputSingle(
              params
            )) as [
              ethers.BigNumber,
              ethers.BigNumber,
              ethers.BigNumber,
              number,
              ethers.BigNumber
            ];
            const amountOutBn = result[0];
            quotedOut = amountOutBn.toBigInt();
            chosenFee = fee;
            console.log(`Quote succeeded at fee ${fee}: ${amountOutBn}`);
            break;
          } catch (_err) {
            console.warn(`No pool at fee ${fee}`);
            continue;
          }
        }

        if (!quotedOut) {
          throw new Error(
            `No valid pool found for ${tokenIn.symbol}/${tokenOut.symbol}`
          );
        }

        // Format quotedOut into decimal string
        const outFormatted = ethers.formatUnits(
          quotedOut,
          tokenOut.decimals
        );
        setAmountOut(parseFloat(outFormatted).toFixed(6));

        // Price Impact in USD
        const inUsd =
          parseFloat(amountIn) *
          (tokenIn.symbol === "ETH"
            ? ethPrice
            : parseFloat(token?.priceUsd || "0"));
        const outUsd =
          parseFloat(outFormatted) *
          (tokenOut.symbol === "ETH"
            ? ethPrice
            : parseFloat(token?.priceUsd || "0"));
        const impact = inUsd > 0 ? ((inUsd - outUsd) / inUsd) * 100 : 0;
        setPriceImpact(Math.abs(impact));

        // Platform fee (0.02% of amountIn)
        const feeWeiBigint =
          (amtInWei * BigInt(Math.round(PLATFORM_FEE_PERCENTAGE * 1e6))) /
          BigInt(1e6);
        const feeFmt = ethers.formatUnits(
          feeWeiBigint,
          tokenIn.decimals
        );
        setPlatformFee(parseFloat(feeFmt).toFixed(6));

        // If wallet is connected, estimate gas
        if (isConnected && address) {
          const signer = await new ethers.BrowserProvider(
            (window as any).ethereum
          ).getSigner();
          const swapRouter = new ethers.Contract(
            SWAP_ROUTER_ADDRESS,
            SWAP_ROUTER_ABI,
            signer
          );
          const swapParams = {
            tokenIn: inAddr,
            tokenOut:
              tokenOut.address === ETH_ADDRESS
                ? WETH_ADDRESS
                : tokenOut.address,
            fee: chosenFee,
            recipient:
              tokenOut.address === ETH_ADDRESS ? SWAP_ROUTER_ADDRESS : address,
            amountIn: amtInWei,
            amountOutMinimum:
              quotedOut *
              BigInt(Math.floor((100 - slippage) * 100)) /
              BigInt(10000),
            sqrtPriceLimitX96: 0n,
          };
          // Cast to any so TS doesn’t object
          const gasUsedBn = await (swapRouter as any).estimateGas.exactInputSingle(
            swapParams,
            {
              value:
                tokenIn.address === ETH_ADDRESS ? amtInWei : (0n as bigint),
            }
          );
          const gasUsedGwei = ethers.formatUnits(gasUsedBn, "gwei");
          setGasEstimate(parseFloat(gasUsedGwei).toFixed(2));
        }
      } catch (err: any) {
        console.error("Fetch quote error:", err);
        setAmountOut("");
        setPriceImpact(0);
        setGasEstimate("0");
        setPlatformFee("0");
        toast.error(
          err.message || "Failed to fetch swap quote. Check token pair."
        );
      }
    };

    fetchQuote();
  }, [
    amountIn,
    tokenIn,
    tokenOut,
    ethPrice,
    token?.priceUsd,
    isConnected,
    address,
    slippage,
  ]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 3.6) CONNECT WALLET & SIGN MESSAGE
  // ────────────────────────────────────────────────────────────────────────────────
  const handleConnectWallet = async (connector: any) => {
    try {
      await connect({ connector });
      setShowWalletModal(false);
      toast.success("Wallet connected");

      // Ask user to sign an “authenticate” message
      const msg = `Authenticate wallet for swap on Base:\nAddress: ${address}\nTimestamp: ${Date.now()}`;
      await signMessageAsync({ message: msg });
      toast.success("Wallet authenticated");
    } catch (err) {
      console.error("Connect/sign failed:", err);
      toast.error("Failed to connect or authenticate wallet.");
    }
  };

  // ────────────────────────────────────────────────────────────────────────────────
  // 3.7) VALIDATE SWAP INPUT
  // ────────────────────────────────────────────────────────────────────────────────
  const validateSwap = (): boolean => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet.");
      return false;
    }
    if (!tokenIn || !tokenOut) {
      toast.error("Token not set.");
      return false;
    }
    if (!amountIn || parseFloat(amountIn) <= 0) {
      toast.error("Enter a valid amount to swap.");
      return false;
    }
    if (parseFloat(amountIn) > parseFloat(walletBalance)) {
      toast.error(
        `Insufficient ${tokenIn.symbol} balance (${walletBalance}).`
      );
      return false;
    }
    if (!amountOut || parseFloat(amountOut) <= 0) {
      toast.error("Swap quote invalid. Try a different amount.");
      return false;
    }
    return true;
  };

  // Trigger confirm modal (with an extra “sign message”)
  const openConfirmModal = async () => {
    if (!validateSwap()) return;
    try {
      // Ask user to sign a “confirm swap” message
      const confirmMsg = `Confirm ${
        activeTab === "buy" ? "Buy" : "Sell"
      } ${amountIn} ${tokenIn?.symbol} → ${amountOut} ${
        tokenOut?.symbol
      } on Base\nTimestamp: ${Date.now()}`;
      await signMessageAsync({ message: confirmMsg });
      setShowConfirmModal(true);
    } catch (err) {
      console.error("Confirm signature failed:", err);
      toast.error("Swap confirmation cancelled.");
    }
  };

  // ────────────────────────────────────────────────────────────────────────────────
  // 3.8) SWITCH WALLET TO BASE (if needed)
  // ────────────────────────────────────────────────────────────────────────────────
  const checkNetwork = async (signer: ethers.Signer): Promise<boolean> => {
    try {
      if (!signer.provider) throw new Error("No provider on signer.");
      const net = await signer.provider.getNetwork();
      if (Number(net.chainId) !== BASE_CHAIN_ID) {
        // Attempt to switch to Base chain
        try {
          await (window as any).ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }],
          });
          return true;
        } catch (switchErr: any) {
          // If Base isn’t added to wallet, add it
          if (switchErr.code === 4902) {
            await (window as any).ethereum.request({
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
          toast.error("Please switch to the Base network in your wallet.");
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error("Network check failed:", err);
      toast.error("Unable to verify network.");
      return false;
    }
  };

  // ────────────────────────────────────────────────────────────────────────────────
  // 3.9) HANDLE “SWAP WITH APPROVAL”
  // ────────────────────────────────────────────────────────────────────────────────
  const handleSwapWithApproval = async () => {
    setShowConfirmModal(false);
    setIsSwapLoading(true);
    setTransactionStatus("Starting swap...");

    try {
      // Ensure window.ethereum exists
      if (!(window as any).ethereum) {
        throw new Error("No wallet detected.");
      }
      const signer = await new ethers.BrowserProvider(
        (window as any).ethereum
      ).getSigner();
      const onBase = await checkNetwork(signer);
      if (!onBase) throw new Error("Switch to Base network first.");

      // Parse amounts
      const amtInWei: bigint = ethers.parseUnits(
        amountIn,
        tokenIn!.decimals
      );
      const amtOutMin: bigint =
        ethers.parseUnits(amountOut || "0", tokenOut!.decimals) *
        BigInt(Math.floor((100 - slippage) * 100)) /
        BigInt(10000);

      // 1) If tokenIn = ETH → wrap to WETH
      let inAddr = tokenIn!.address;
      if (tokenIn!.address === ETH_ADDRESS) {
        setTransactionStatus("Wrapping ETH → WETH...");
        const wethContract = new ethers.Contract(
          WETH_ADDRESS,
          WETH_ABI,
          signer
        );
        // Estimate gas for deposit
        const depositData = wethContract.interface.encodeFunctionData(
          "deposit",
          []
        );
        const gasDeposit = await signer.estimateGas({
          to: WETH_ADDRESS,
          data: depositData,
          value: amtInWei,
        });
        const depositTx = await wethContract.deposit({
          value: amtInWei,
          gasLimit: gasDeposit,
        });
        await depositTx.wait();
        toast.info("ETH converted to WETH");
        inAddr = WETH_ADDRESS;
      }

      // 2) If tokenIn ≠ ETH and not approved → approve
      if (tokenIn!.address !== ETH_ADDRESS && !isApproved) {
        setTransactionStatus("Approving token...");
        const tokenContract = new ethers.Contract(
          tokenIn!.address,
          ERC20_ABI,
          signer
        );
        const allowanceBn = (await tokenContract.allowance(
          address,
          SWAP_ROUTER_ADDRESS
        )) as ethers.BigNumber;
        if (allowanceBn.toBigInt() < amtInWei) {
          // Estimate gas for approve
          const approveGas = await (tokenContract as any).estimateGas.approve(
            SWAP_ROUTER_ADDRESS,
            amtInWei
          );
          const approveTx = await tokenContract.approve(
            SWAP_ROUTER_ADDRESS,
            amtInWei,
            { gasLimit: approveGas }
          );
          await approveTx.wait();
          setIsApproved(true);
          toast.success(`${tokenIn!.symbol} approved`);
        }
      }

      // 3) Send platform fee (0.02%)
      const feeWeiBigint =
        (amtInWei * BigInt(Math.round(PLATFORM_FEE_PERCENTAGE * 1e6))) /
        BigInt(1e6);
      const amtAfterFee = amtInWei - feeWeiBigint;
      if (feeWeiBigint > 0n) {
        setTransactionStatus("Sending platform fee...");
        if (tokenIn!.address === ETH_ADDRESS) {
          const feeTx = await signer.sendTransaction({
            to: PLATFORM_WALLET,
            value: feeWeiBigint,
          });
          await feeTx.wait();
        } else {
          const tokenContract = new ethers.Contract(
            tokenIn!.address,
            ERC20_ABI,
            signer
          );
          const transferData = tokenContract.interface.encodeFunctionData(
            "transfer",
            [PLATFORM_WALLET, feeWeiBigint]
          );
          const gasFee = await signer.estimateGas({
            to: tokenIn!.address,
            data: transferData,
          });
          const feeTx = await tokenContract.transfer(
            PLATFORM_WALLET,
            feeWeiBigint,
            { gasLimit: gasFee }
          );
          await feeTx.wait();
        }
        toast.info("Platform fee sent");
      }

      // 4) Execute the swap
      setTransactionStatus("Executing swap...");
      const swapRouter = new ethers.Contract(
        SWAP_ROUTER_ADDRESS,
        SWAP_ROUTER_ABI,
        signer
      );
      const swapParams = {
        tokenIn: inAddr,
        tokenOut:
          tokenOut!.address === ETH_ADDRESS
            ? WETH_ADDRESS
            : tokenOut!.address,
        fee: 3000,
        recipient:
          tokenOut!.address === ETH_ADDRESS ? SWAP_ROUTER_ADDRESS : address,
        amountIn: amtAfterFee,
        amountOutMinimum: amtOutMin,
        sqrtPriceLimitX96: 0n, // must be bigint
      };
      // Estimate gas for exactInputSingle
      const gasSwap = await (swapRouter as any).estimateGas.exactInputSingle(
        swapParams,
        {
          value:
            tokenIn!.address === ETH_ADDRESS
              ? amtAfterFee
              : (0n as bigint),
        }
      );
      const swapTx = await swapRouter.exactInputSingle(swapParams, {
        value:
          tokenIn!.address === ETH_ADDRESS
            ? amtAfterFee
            : (0n as bigint),
        gasLimit: gasSwap,
      });
      await swapTx.wait();
      toast.info("Swap executed");

      // 5) If tokenOut = ETH → unwrap WETH → ETH
      if (tokenOut!.address === ETH_ADDRESS) {
        setTransactionStatus("Unwrapping WETH → ETH...");
        const unwrapData = swapRouter.interface.encodeFunctionData(
          "unwrapWETH9",
          [amtOutMin, address]
        );
        const gasUnwrap = await signer.estimateGas({
          to: SWAP_ROUTER_ADDRESS,
          data: unwrapData,
        });
        const unwrapTx = await swapRouter.unwrapWETH9(
          amtOutMin,
          address,
          { gasLimit: gasUnwrap }
        );
        await unwrapTx.wait();
        toast.info("WETH unwrapped into ETH");
      }

      // 6) Update Bought / Sold / P&L
      const amtInNum = parseFloat(amountIn);
      const amtOutNum = parseFloat(amountOut);
      if (activeTab === "buy") {
        setBoughtAmount((prev) => prev + amtOutNum);
        setProfitLoss((prev) =>
          prev -
          amtInNum * ethPrice +
          amtOutNum * parseFloat(token?.priceUsd || "0")
        );
      } else {
        setSoldAmount((prev) => prev + amtInNum);
        setProfitLoss((prev) =>
          prev +
          amtInNum * parseFloat(token?.priceUsd || "0") -
          amtOutNum * ethPrice
        );
      }

      setTransactionStatus("Transaction Complete");
      toast.success(
        `Swapped ${amountIn} ${tokenIn!.symbol} → ${amountOut} ${tokenOut!.symbol}`
      );
      setAmountIn("");
      setAmountOut("");
      setIsApproved(false);
    } catch (err: any) {
      console.error("Swap error:", err);
      setTransactionStatus("");
      if (err.code === 4001) {
        toast.error("User rejected transaction.");
      } else if (err.message.includes("Switch")) {
        toast.error("Please switch to the Base network.");
      } else {
        toast.error(err.reason || "Swap failed. Please try again.");
      }
    } finally {
      setIsSwapLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────────
  // 3.10) SWAP TOKEN-IN ⇆ TOKEN-OUT
  // ────────────────────────────────────────────────────────────────────────────────
  const handleSwapTokens = () => {
    if (!tokenIn || !tokenOut) return;
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
    setAmountOut("");
    setIsApproved(false);
    setActiveTab(tokenIn.symbol === "ETH" ? "sell" : "buy");
  };

  // ────────────────────────────────────────────────────────────────────────────────
  // 4) RENDER
  // ────────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full font-sans">
      {/*───────────────────────────────────────────────────────────────────────────────*/}
      {/* STYLES */}
      {/*───────────────────────────────────────────────────────────────────────────────*/}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }

        /* MAIN SWAP CONTAINER: fully transparent */
        .swap-container {
          background: transparent;
          border-radius: 8px;
          padding: 4px;
          width: 100%;
          box-sizing: border-box;
        }

        /* WALLET BUTTON */
        .wallet-button {
          background: rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          padding: 8px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;
        }
        .wallet-button:hover {
          background: rgba(59, 130, 246, 0.5);
        }
        .wallet-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* WALLET ADDRESS BOX (connected) */
        .wallet-address {
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          border-radius: 6px;
          padding: 6px 8px;
          color: #d1d5db;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          box-sizing: border-box;
        }
        .wallet-address .disconnect-btn {
          font-size: 12px;
          color: #d1d5db;
          background: transparent;
          border: none;
          cursor: pointer;
          text-transform: uppercase;
        }
        .wallet-address .disconnect-btn:hover {
          color: #f87171;
        }

        /* BUY/SELL SEGMENTED CONTROL */
        .buy-sell-toggle {
          display: flex;
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          border-radius: 9999px;
          margin: 8px 0;
          width: 100%;
          box-sizing: border-box;
        }
        .buy-sell-button {
          flex: 1;
          padding: 8px;
          border-radius: 9999px;
          font-size: 16px;
          font-weight: 600;
          text-align: center;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #9ca3af;
          border: none;
          background: transparent;
        }
        .buy-sell-button.buy {
          color: #34d399;
        }
        .buy-sell-button.sell {
          color: #f87171;
        }
        .buy-sell-button.active.buy {
          background: rgba(52, 211, 153, 0.2);
          color: #34d399;
        }
        .buy-sell-button.active.sell {
          background: rgba(248, 113, 113, 0.2);
          color: #f87171;
        }
        .buy-sell-button:not(.active) {
          opacity: 0.7;
        }
        .buy-sell-button:hover:not(.active) {
          opacity: 1;
          background: rgba(59, 130, 246, 0.1);
        }

        /* STATUS INDICATOR */
        .transaction-status,
        .transaction-complete {
          padding: 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          margin-bottom: 8px;
          width: 100%;
          box-sizing: border-box;
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
        }
        .transaction-status {
          color: #60a5fa;
        }
        .transaction-complete {
          border-color: rgba(52, 211, 153, 0.5);
          color: #34d399;
        }

        /* INPUT CONTAINER (transparent) */
        .swap-input-container {
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 8px;
          width: 100%;
          box-sizing: border-box;
        }
        .token-label {
          font-size: 14px;
          color: #9ca3af;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .swap-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .token-select {
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 500;
          color: #d1d5db;
          white-space: nowrap;
          cursor: default;
        }
        .swap-input {
          background: transparent;
          border: none;
          color: #d1d5db;
          width: 100%;
          font-size: 18px;
          outline: none;
        }
        .swap-input:disabled {
          color: #6b7280;
          cursor: not-allowed;
        }

        /* SWAP ARROW BUTTON */
        .swap-arrow-container {
          display: flex;
          justify-content: center;
          margin: 6px 0;
          width: 100%;
          box-sizing: border-box;
        }
        .swap-arrow {
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          border-radius: 50%;
          padding: 6px;
          cursor: pointer;
          transition: transform 0.3s ease;
          color: #60a5fa;
        }
        .swap-arrow:hover {
          transform: scale(1.1);
        }
        .swap-arrow:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* SWAP INFO (transparent) */
        .swap-info {
          font-size: 14px;
          color: #d1d5db;
          margin: 8px 0;
          width: 100%;
          box-sizing: border-box;
        }
        .swap-info > div {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .swap-info .label {
          color: #9ca3af;
        }
        .swap-info .value {
          color: #d1d5db;
          font-weight: 500;
        }
        .swap-info .high-impact {
          color: #f87171;
          font-weight: 600;
        }

        /* SWAP BUTTON */
        .swap-action-button {
          background: linear-gradient(90deg, #6366f1, #4f46e5);
          color: #ffffff;
          padding: 10px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          text-transform: uppercase;
          cursor: pointer;
          border: none;
          width: 100%;
          box-sizing: border-box;
          transition: background 0.3s ease;
        }
        .swap-action-button:hover {
          background: linear-gradient(90deg, #4f46e5, #4338ca);
        }
        .swap-action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* PROFIT/LOSS BOX */
        .profit-loss {
          display: flex;
          flex-direction: column;
          font-size: 14px;
          color: #d1d5db;
          border: 1px solid rgba(156, 163, 175, 0.3);
          border-radius: 6px;
          padding: 8px;
          margin-top: 8px;
          width: 100%;
          box-sizing: border-box;
        }
        .profit-loss .label {
          color: #9ca3af;
          margin-right: 4px;
        }
        .profit-loss .value {
          color: #d1d5db;
          font-weight: 500;
        }
        .profit-positive {
          color: #34d399;
        }
        .profit-negative {
          color: #f87171;
        }
        .eth-icon {
          margin-right: 4px;
        }

        /* MODAL OVERLAY */
        .wallet-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 50;
        }
        .wallet-modal-content {
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          border-radius: 8px;
          padding: 16px;
          width: 300px;
          max-width: 90%;
          box-sizing: border-box;
        }
        .wallet-modal-content h3 {
          color: #d1d5db;
          font-size: 18px;
          margin-bottom: 12px;
          text-transform: uppercase;
          text-align: center;
        }
        .wallet-option {
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.3s ease;
          width: 100%;
          box-sizing: border-box;
          color: #d1d5db;
          font-size: 16px;
          font-weight: 500;
        }
        .wallet-option:hover {
          background: rgba(59, 130, 246, 0.1);
        }
        .wallet-modal-content .cancel-btn {
          margin-top: 12px;
          background: transparent;
          border: none;
          color: #9ca3af;
          text-transform: uppercase;
          font-size: 14px;
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;
        }
        .wallet-modal-content .cancel-btn:hover {
          color: #f87171;
        }

        /* CONFIRMATION MODAL */
        .confirm-modal-content {
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          border-radius: 8px;
          padding: 16px;
          width: 300px;
          max-width: 90%;
          box-sizing: border-box;
        }
        .confirm-modal-content h3 {
          color: #d1d5db;
          font-size: 18px;
          margin-bottom: 12px;
          text-transform: uppercase;
          text-align: center;
        }
        .confirm-modal-content .detail-row {
          display: flex;
          justify-content: space-between;
          margin: 6px 0;
          font-size: 14px;
          color: #d1d5db;
        }
        .confirm-modal-content .button-row {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          width: 100%;
          box-sizing: border-box;
        }
        .confirm-modal-content .confirm-btn {
          flex: 1;
          padding: 8px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 6px;
          text-transform: uppercase;
          cursor: pointer;
          border: none;
          color: #111827;
        }
        .confirm-modal-content .confirm-btn.buy {
          background: #34d399;
        }
        .confirm-modal-content .confirm-btn.sell {
          background: #f87171;
        }
        .confirm-modal-content .confirm-btn:hover {
          opacity: 0.9;
        }
        .confirm-modal-content .cancel-btn {
          flex: 1;
          padding: 8px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 6px;
          text-transform: uppercase;
          cursor: pointer;
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          color: #d1d5db;
        }
        .confirm-modal-content .cancel-btn:hover {
          background: rgba(59, 130, 246, 0.1);
        }

        @media (max-width: 768px) {
          .wallet-button,
          .swap-action-button {
            font-size: 14px;
            padding: 8px;
          }
          .token-select,
          .swap-input {
            font-size: 16px;
          }
          .profit-loss,
          .swap-info div {
            font-size: 12px;
          }
          .buy-sell-button {
            font-size: 14px;
            padding: 6px;
          }
          .wallet-modal-content,
          .confirm-modal-content {
            width: 90%;
          }
        }
      `}</style>

      {/*───────────────────────────────────────────────────────────────────────────────*/}
      {/* 1) WALLET CONNECTION MODAL */}
      {/*───────────────────────────────────────────────────────────────────────────────*/}
      {showWalletModal && (
        <div className="wallet-modal">
          <div className="wallet-modal-content fade-in">
            <h3>Connect Wallet</h3>
            {connectors.map((connector) => (
              <button
                key={connector.id}
                className="wallet-option"
                onClick={() => handleConnectWallet(connector)}
              >
                <FaWallet className="w-5 h-5 text-blue-400" />
                <span>{connector.name}</span>
              </button>
            ))}
            <button
              onClick={() => setShowWalletModal(false)}
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/*───────────────────────────────────────────────────────────────────────────────*/}
      {/* 2) CONFIRMATION MODAL */}
      {/*───────────────────────────────────────────────────────────────────────────────*/}
      {showConfirmModal && (
        <div className="wallet-modal">
          <div className="confirm-modal-content fade-in">
            <h3>Confirm {activeTab === "buy" ? "Buy" : "Sell"}</h3>
            <div className="detail-row">
              <span>You Pay:</span>
              <span>
                {amountIn} {tokenIn?.symbol}
              </span>
            </div>
            <div className="detail-row">
              <span>You Receive:</span>
              <span>
                {amountOut} {tokenOut?.symbol}
              </span>
            </div>
            <div className="detail-row">
              <span>Platform Fee (0.02%):</span>
              <span>
                {platformFee} {tokenIn?.symbol}
              </span>
            </div>
            <div className="detail-row">
              <span>Price Impact:</span>
              <span
                className={priceImpact > 5 ? "high-impact" : "value"}
              >
                {priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="detail-row">
              <span>Gas Estimate:</span>
              <span>{gasEstimate} Gwei</span>
            </div>
            <div className="button-row">
              <button
                onClick={handleSwapWithApproval}
                className={`confirm-btn ${activeTab === "buy" ? "buy" : "sell"}`}
              >
                {activeTab === "buy" ? "Confirm Buy" : "Confirm Sell"}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/*───────────────────────────────────────────────────────────────────────────────*/}
      {/* 3) MAIN SWAP UI */}
      {/*───────────────────────────────────────────────────────────────────────────────*/}
      <div className="swap-container fade-in">
        {/* A) WALLET CONNECTION OR DISPLAY ADDRESS */}
        <div className="mb-6">
          {isConnected ? (
            <div className="wallet-address">
              <div className="flex items-center gap-2">
                <FaWallet className="text-blue-400 w-5 h-5" />
                <span>
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
              <button
                onClick={() => disconnect()}
                className="disconnect-btn"
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
              <FaWallet className="w-5 h-5" />
              Connect Wallet
            </button>
          )}
        </div>

        {/* B) BUY / SELL TOGGLE */}
        <div className="buy-sell-toggle">
          <div
            onClick={() => setActiveTab("buy")}
            className={`buy-sell-button buy ${
              activeTab === "buy" ? "active" : ""
            }`}
          >
            Buy
          </div>
          <div
            onClick={() => setActiveTab("sell")}
            className={`buy-sell-button sell ${
              activeTab === "sell" ? "active" : ""
            }`}
          >
            Sell
          </div>
        </div>

        {/* C) TRANSACTION STATUS */}
        {transactionStatus && (
          <div
            className={
              transactionStatus === "Transaction Complete"
                ? "transaction-complete"
                : "transaction-status"
            }
          >
            {transactionStatus !== "Transaction Complete" && (
              <svg
                className="animate-spin w-5 h-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
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

        {/* D) “You Pay” INPUT */}
        <div className="swap-input-container">
          <div className="token-label">
            You Pay (Balance: {walletBalance} {tokenIn?.symbol})
          </div>
          <div className="swap-input-wrapper">
            <span className="token-select">
              {tokenIn?.symbol ?? ""}
            </span>
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

        {/* E) SWAP ARROW BUTTON */}
        <div className="swap-arrow-container">
          <button
            onClick={handleSwapTokens}
            className="swap-arrow"
            disabled={!tokenIn || !tokenOut || isSwapLoading}
          >
            <svg
              className="w-6 h-6 text-blue-400"
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

        {/* F) “You Receive (Est)” */}
        <div className="swap-input-container">
          <div className="token-label">
            You Receive (Est. {amountOut || "0.0"} {tokenOut?.symbol})
          </div>
          <div className="swap-input-wrapper">
            <span className="token-select">
              {tokenOut?.symbol ?? ""}
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

        {/* G) SWAP INFO */}
        <div className="swap-info">
          <div>
            <span className="label">Price Impact:</span>
            <span className={priceImpact > 5 ? "high-impact" : "value"}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="label">Platform Fee:</span>
            <span className="value">
              {platformFee} {tokenIn?.symbol}
            </span>
          </div>
          <div>
            <span className="label">Slippage:</span>
            <span className="value">{slippage}%</span>
          </div>
          <div>
            <span className="label">Gas Estimate:</span>
            <span className="value">{gasEstimate} Gwei</span>
          </div>
        </div>

        {/* H) SWAP BUTTON */}
        <button
          onClick={openConfirmModal}
          className="swap-action-button"
          disabled={
            isSwapLoading ||
            !isConnected ||
            !amountIn ||
            !tokenIn ||
            !tokenOut
          }
        >
          {isSwapLoading
            ? "Processing..."
            : activeTab === "buy"
            ? "Buy"
            : "Sell"}
        </button>

        {/* I) PROFIT / LOSS */}
        <div className="profit-loss">
          <div>
            <span className="label">Bought:</span>
            <span className="value">
              {boughtAmount.toFixed(2)}{" "}
              {tokenOut?.symbol === "ETH" ? "" : tokenOut?.symbol}
            </span>
          </div>
          <div>
            <span className="label">Sold:</span>
            <span className="value">
              {soldAmount.toFixed(2)}{" "}
              {tokenIn?.symbol === "ETH" ? "" : tokenIn?.symbol}
            </span>
          </div>
          <div>
            <span className="label">P&L:</span>
            <span
              className={
                profitLoss >= 0 ? "profit-positive" : "profit-negative"
              }
            >
              <span className="eth-icon">Ξ</span>
              {profitLoss >= 0 ? "+" : ""}
              {profitLoss.toFixed(2)} (
              {((profitLoss / (boughtAmount || 1)) * 100).toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Swap;




