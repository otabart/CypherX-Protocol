"use client";

import React, { useEffect, useState } from "react";
import { FaWallet } from "react-icons/fa";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";

// ────────────────────────────────────────────────────────────────────────────────
// 1) CONSTANTS & ABIs
// ────────────────────────────────────────────────────────────────────────────────
const SWAP_ROUTER_ADDRESS = "0x2626664c2603336E57B271c5C0b26F421741e481"; // Correct Uniswap V3 SwapRouter02 on Base
const QUOTER_ADDRESS = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a"; // Correct Uniswap V3 QuoterV2 on Base
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const USDC_WETH_POOL_FEE = 500; // 0.05% fee for USDC/WETH pool on Base
const ETH_ADDRESS = ethers.ZeroAddress;
const PLATFORM_WALLET = "0x4146E18FeF6883Ee7c2F16feC60109133F1Fc491"; // Your platform wallet
const PLATFORM_FEE_PERCENTAGE = 0.0002;
const BASE_CHAIN_ID = 8453;

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
  {
    inputs: [
      { name: "path", type: "bytes" },
      { name: "amountIn", type: "uint256" },
    ],
    name: "quoteExactInput",
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96AfterList", type: "uint160[]" },
      { name: "initializedTicksCrossedList", type: "uint32[]" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
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
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
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
        name: "params",
        type: "tuple",
      },
    ],
    name: "exactInputSingle",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
    name: "exactInput",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    name: "unwrapWETH9",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const POOL_ABI = [
  {
    inputs: [],
    name: "fee",
    outputs: [{ internalType: "uint24", name: "", type: "uint24" }],
    stateMutability: "view",
    type: "function",
  },
];

// ────────────────────────────────────────────────────────────────────────────────
// 2) CONTRACT INTERFACES
// ────────────────────────────────────────────────────────────────────────────────
interface SwapRouterContract {
  exactInputSingle(
    params: {
      tokenIn: string;
      tokenOut: string;
      fee: number;
      recipient: `0x${string}`;
      deadline: bigint;
      amountIn: bigint;
      amountOutMinimum: bigint;
      sqrtPriceLimitX96: bigint;
    },
    options?: { gasLimit?: bigint; value?: bigint }
  ): Promise<ethers.ContractTransactionResponse>;
  exactInput(
    params: {
      path: string;
      recipient: `0x${string}`;
      deadline: bigint;
      amountIn: bigint;
      amountOutMinimum: bigint;
    },
    options?: { gasLimit?: bigint; value?: bigint }
  ): Promise<ethers.ContractTransactionResponse>;
  unwrapWETH9(amountMinimum: bigint, recipient: `0x${string}`, options?: { gasLimit?: bigint }): Promise<ethers.ContractTransactionResponse>;
  estimateGas: {
    exactInputSingle(
      params: {
        tokenIn: string;
        tokenOut: string;
        fee: number;
        recipient: `0x${string}`;
        deadline: bigint;
        amountIn: bigint;
        amountOutMinimum: bigint;
        sqrtPriceLimitX96: bigint;
      },
      options?: { value?: bigint }
    ): Promise<bigint>;
    exactInput(
      params: {
        path: string;
        recipient: `0x${string}`;
        deadline: bigint;
        amountIn: bigint;
        amountOutMinimum: bigint;
      },
      options?: { value?: bigint }
    ): Promise<bigint>;
    unwrapWETH9(amountMinimum: bigint, recipient: `0x${string}`): Promise<bigint>;
  };
}

interface QuoterContract {
  quoteExactInputSingle(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    fee: bigint,
    sqrtPriceLimitX96: bigint
  ): Promise<[bigint, bigint, number, bigint]>;
  quoteExactInput(
    path: string,
    amountIn: bigint
  ): Promise<[bigint, bigint[], number[], bigint]>;
}

interface ERC20Contract {
  approve(spender: string, amount: bigint, options?: { gasLimit?: bigint }): Promise<ethers.ContractTransactionResponse>;
  transfer(to: string, amount: bigint, options?: { gasLimit?: bigint }): Promise<ethers.ContractTransactionResponse>;
  allowance(owner: string, spender: string): Promise<bigint>;
  balanceOf(owner: string): Promise<bigint>;
  decimals(): Promise<number>;
  estimateGas: {
    approve(spender: string, amount: bigint): Promise<bigint>;
    transfer(to: string, amount: bigint): Promise<bigint>;
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// 3) TYPES
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
// 4) COMPONENT
// ────────────────────────────────────────────────────────────────────────────────
const Swap: React.FC<SwapProps> = ({ token, ethPrice }) => {
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("");
  const [tokenIn, setTokenIn] = useState<SwapToken | null>(null);
  const [tokenOut, setTokenOut] = useState<SwapToken | null>(null);
  const [isSwapLoading, setIsSwapLoading] = useState<boolean>(false);
  const [transactionStatus, setTransactionStatus] = useState<string>("");
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [slippage] = useState<number>(0.5);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [gasEstimate, setGasEstimate] = useState<string>("0");
  const [walletBalance, setWalletBalance] = useState<string>("0.0");
  const [platformFee, setPlatformFee] = useState<string>("0");
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [boughtAmount, setBoughtAmount] = useState<number>(0);
  const [soldAmount, setSoldAmount] = useState<number>(0);
  const [profitLoss, setProfitLoss] = useState<number>(0);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [poolFee, setPoolFee] = useState<number>(0);
  const [isWETHPair, setIsWETHPair] = useState<boolean>(false);
  const [isUSDCPair, setIsUSDCPair] = useState<boolean>(false);

  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const provider = new ethers.JsonRpcProvider("https://rpc.base.org");

  useEffect(() => {
    if (!isConnected || !address) return;
    const setupSigner = async () => {
      try {
        if (!window.ethereum) {
          console.error("No Ethereum provider detected");
          toast.error("No wallet detected. Please install MetaMask or a compatible EVM wallet.");
          return;
        }
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        const signer = await browserProvider.getSigner();
        setSigner(signer);
      } catch (err: unknown) {
        console.error("Failed to set up signer:", err);
        toast.error("Failed to initialize wallet signer.");
      }
    };
    setupSigner();
  }, [isConnected, address]);

  useEffect(() => {
    if (!token) return;
    const fetchTokenData = async () => {
      try {
        const contract = new ethers.Contract(token.baseToken.address, ERC20_ABI, provider) as unknown as ERC20Contract;
        const decimals = await contract.decimals();
        const otherToken: SwapToken = {
          address: token.baseToken.address,
          symbol: token.baseToken.symbol,
          name: token.baseToken.name,
          decimals,
        };
        const ethToken: SwapToken = {
          address: ETH_ADDRESS,
          symbol: "ETH",
          name: "Ether",
          decimals: 18,
        };
        const poolContract = new ethers.Contract(token.poolAddress, POOL_ABI, provider);
        const fee = await poolContract.fee();
        setPoolFee(Number(fee));

        const quoteAddr = token.quoteToken.address.toLowerCase();
        if (quoteAddr === WETH_ADDRESS.toLowerCase()) {
          setIsWETHPair(true);
          setIsUSDCPair(false);
        } else if (quoteAddr === USDC_ADDRESS.toLowerCase()) {
          setIsWETHPair(false);
          setIsUSDCPair(true);
        } else {
          toast.error("Unsupported pair for swap.");
          return;
        }

        if (activeTab === "buy") {
          setTokenIn(ethToken);
          setTokenOut(otherToken);
        } else {
          setTokenIn(otherToken);
          setTokenOut(ethToken);
        }
      } catch (err: unknown) {
        console.error("Error fetching token details:", err);
        toast.error("Failed to load token details.");
      }
    };
    fetchTokenData();
  }, [token, activeTab, provider]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!signer || !address || !tokenIn) {
        setWalletBalance("0.0");
        return;
      }
      try {
        if (tokenIn.address === ETH_ADDRESS) {
          const bal = await provider.getBalance(address);
          setWalletBalance(ethers.formatEther(bal));
        } else {
          const contract = new ethers.Contract(tokenIn.address, ERC20_ABI, provider) as unknown as ERC20Contract;
          const rawBal = await contract.balanceOf(address);
          const dec = await contract.decimals();
          setWalletBalance(ethers.formatUnits(rawBal, dec));
        }
      } catch (err: unknown) {
        console.error("Error fetching wallet balance:", err);
        setWalletBalance("0.0");
      }
    };
    fetchBalance();
  }, [signer, address, tokenIn, provider]);

  useEffect(() => {
    const checkAllowance = async () => {
      if (
        !signer ||
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
        const contract = new ethers.Contract(tokenIn.address, ERC20_ABI, provider) as unknown as ERC20Contract;
        const amtInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
        const allowance = await contract.allowance(address, SWAP_ROUTER_ADDRESS);
        setIsApproved(allowance >= amtInWei);
      } catch (err: unknown) {
        console.error("Error checking allowance:", err);
        setIsApproved(false);
      }
    };
    checkAllowance();
  }, [signer, address, tokenIn, amountIn, provider]);

  useEffect(() => {
    if (!amountIn || parseFloat(amountIn) <= 0 || !tokenIn || !tokenOut || !token || poolFee === 0 || (!isWETHPair && !isUSDCPair)) {
      setAmountOut("");
      setPriceImpact(0);
      setGasEstimate("0");
      setPlatformFee("0");
      return;
    }

    const fetchQuote = async () => {
      try {
        const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider) as unknown as QuoterContract;
        const inAddr = tokenIn.address === ETH_ADDRESS ? WETH_ADDRESS : tokenIn.address;
        const outAddr = tokenOut.address === ETH_ADDRESS ? WETH_ADDRESS : tokenOut.address;
        const amtInWeiFull = ethers.parseUnits(amountIn, tokenIn.decimals);
        const feeWei = (amtInWeiFull * BigInt(Math.round(PLATFORM_FEE_PERCENTAGE * 1e6))) / BigInt(1e6);
        const amtInWeiAdjusted = amtInWeiFull - feeWei;
        let amountOut: bigint;

        if (isWETHPair) {
          // Single hop
          [amountOut] = await quoter.quoteExactInputSingle(inAddr, outAddr, amtInWeiAdjusted, BigInt(poolFee), BigInt(0));
        } else {
          // Multi hop via USDC
          let path: string;
          if (activeTab === "buy") {
            // ETH -> USDC -> token
            path = ethers.solidityPacked(
              ["address", "uint24", "address", "uint24", "address"],
              [WETH_ADDRESS, USDC_WETH_POOL_FEE, USDC_ADDRESS, poolFee, token.baseToken.address]
            );
          } else {
            // token -> USDC -> ETH
            path = ethers.solidityPacked(
              ["address", "uint24", "address", "uint24", "address"],
              [token.baseToken.address, poolFee, USDC_ADDRESS, USDC_WETH_POOL_FEE, WETH_ADDRESS]
            );
          }
          [amountOut] = await quoter.quoteExactInput(path, amtInWeiAdjusted);
        }

        const outFormatted = ethers.formatUnits(amountOut, tokenOut.decimals);
        setAmountOut(parseFloat(outFormatted).toFixed(6));

        const inUsd = parseFloat(amountIn) * (tokenIn.symbol === "ETH" ? ethPrice : parseFloat(token.priceUsd || "0"));
        const outUsd = parseFloat(outFormatted) * (tokenOut.symbol === "ETH" ? ethPrice : parseFloat(token.priceUsd || "0"));
        const impact = inUsd > 0 ? ((inUsd - outUsd) / inUsd) * 100 : 0;
        setPriceImpact(Math.abs(impact));

        const feeFmt = ethers.formatUnits(feeWei, tokenIn.decimals);
        setPlatformFee(parseFloat(feeFmt).toFixed(6));

        let quoteData: string;
        if (isWETHPair) {
          quoteData = quoter.interface.encodeFunctionData("quoteExactInputSingle", [inAddr, outAddr, amtInWeiAdjusted, BigInt(poolFee), BigInt(0)]);
        } else {
          let path: string;
          if (activeTab === "buy") {
            path = ethers.solidityPacked(
              ["address", "uint24", "address", "uint24", "address"],
              [WETH_ADDRESS, USDC_WETH_POOL_FEE, USDC_ADDRESS, poolFee, token.baseToken.address]
            );
          } else {
            path = ethers.solidityPacked(
              ["address", "uint24", "address", "uint24", "address"],
              [token.baseToken.address, poolFee, USDC_ADDRESS, USDC_WETH_POOL_FEE, WETH_ADDRESS]
            );
          }
          quoteData = quoter.interface.encodeFunctionData("quoteExactInput", [path, amtInWeiAdjusted]);
        }
        const gasEst = await provider.estimateGas({
          to: QUOTER_ADDRESS,
          data: quoteData,
        });
        setGasEstimate(gasEst.toString());
      } catch (err: unknown) {
        console.error("Fetch quote error:", err);
        setAmountOut("");
        setPriceImpact(0);
        setGasEstimate("0");
        setPlatformFee("0");
        let errorMessage = "Failed to fetch swap quote. Check token pair or liquidity.";
        if (err && typeof err === "object" && "reason" in err && typeof err.reason === "string") {
          errorMessage = err.reason;
        } else if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
          errorMessage = err.message;
        }
        toast.error(errorMessage);
      }
    };

    fetchQuote();
  }, [amountIn, tokenIn, tokenOut, ethPrice, token, poolFee, isWETHPair, isUSDCPair, activeTab, provider]);

  const handleConnectWallet = async () => {
    if (!window.ethereum) {
      console.error("No Ethereum provider detected");
      toast.error("No wallet detected. Please install MetaMask or a compatible EVM wallet.");
      return;
    }
    try {
      console.log("Available connectors:", connectors.map(c => c.id));
      const injectedConnector = connectors.find((c) => c.id === "injected");
      if (!injectedConnector) {
        console.error("Injected connector not found. Available connectors:", connectors.map(c => c.id));
        throw new Error("Injected connector (e.g., MetaMask) not found in Wagmi config.");
      }
      console.log("Attempting to connect with injected connector");
      await connectAsync({ connector: injectedConnector });
      if (address) {
        console.log("Connected address:", address);
        const msg = `Authenticate wallet for swap on Base:\nAddress: ${address}\nTimestamp: ${Date.now()}`;
        await signMessageAsync({ message: msg });
        toast.success("Wallet connected and authenticated");
      } else {
        console.error("No address returned after connection");
        toast.error("Failed to retrieve wallet address.");
      }
    } catch (err: unknown) {
      console.error("Connect/sign failed:", err);
      let errorMessage = "Failed to connect or authenticate wallet. Ensure your wallet is unlocked.";
      if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
        errorMessage = err.message;
      }
      toast.error(errorMessage);
    }
  };

  const validateSwap = async (): Promise<boolean> => {
    if (!signer || !address) {
      toast.error("Please connect your wallet.");
      return false;
    }
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== BASE_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }],
        });
      } catch (switchErr: unknown) {
        if (switchErr && typeof switchErr === "object" && "code" in switchErr && switchErr.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${BASE_CHAIN_ID.toString(16)}`,
                chainName: "Base",
                rpcUrls: ["https://mainnet.base.org"],
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                blockExplorerUrls: ["https://basescan.org"],
              },
            ],
          });
        } else {
          toast.error("Please switch to the Base network.");
          return false;
        }
      }
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
      toast.error(`Insufficient ${tokenIn.symbol} balance (${walletBalance}).`);
      return false;
    }
    if (!amountOut || parseFloat(amountOut) <= 0) {
      toast.error("Swap quote invalid. Try a different amount.");
      return false;
    }
    return true;
  };

  const openConfirmModal = async () => {
    if (!(await validateSwap())) return;
    try {
      const confirmMsg = `Confirm ${
        activeTab === "buy" ? "Buy" : "Sell"
      } ${amountIn} ${tokenIn?.symbol} → ${amountOut} ${
        tokenOut?.symbol
      } on Base\nTimestamp: ${Date.now()}`;
      await signMessageAsync({ message: confirmMsg });
      setShowConfirmModal(true);
    } catch (err: unknown) {
      console.error("Confirm signature failed:", err);
      let errorMessage = "Swap confirmation cancelled.";
      if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
        errorMessage = err.message;
      }
      toast.error(errorMessage);
    }
  };

  const handleSwapWithApproval = async () => {
    if (!address) {
      toast.error("Wallet not connected.");
      return;
    }
    setShowConfirmModal(false);
    setIsSwapLoading(true);
    setTransactionStatus("Starting swap...");

    try {
      if (!signer || !tokenIn || !tokenOut || !token) throw new Error("Tokens or signer not set.");
      const amtInWeiFull = ethers.parseUnits(amountIn, tokenIn.decimals);
      const feeWeiBigint = (amtInWeiFull * BigInt(Math.round(PLATFORM_FEE_PERCENTAGE * 1e6))) / BigInt(1e6);
      const amtAfterFee = amtInWeiFull - feeWeiBigint;
      const amtOutMin = (ethers.parseUnits(amountOut, tokenOut.decimals) * BigInt(Math.floor((100 - slippage) * 100))) / BigInt(10000);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30-minute deadline

      // Approve token if needed
      if (tokenIn.address !== ETH_ADDRESS && !isApproved) {
        setTransactionStatus("Approving token...");
        const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, signer) as unknown as ERC20Contract;
        const gasLimit = await tokenContract.estimateGas.approve(SWAP_ROUTER_ADDRESS, amtInWeiFull);
        const approveTx = await tokenContract.approve(SWAP_ROUTER_ADDRESS, amtInWeiFull, { gasLimit });
        await approveTx.wait();
        setIsApproved(true);
        toast.success(`${tokenIn.symbol} approved`);
      }

      // Send platform fee
      if (feeWeiBigint > 0n) {
        setTransactionStatus("Sending platform fee...");
        if (tokenIn.address === ETH_ADDRESS) {
          const feeTx = await signer.sendTransaction({ to: PLATFORM_WALLET, value: feeWeiBigint });
          await feeTx.wait();
        } else {
          const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, signer) as unknown as ERC20Contract;
          const gasLimit = await tokenContract.estimateGas.transfer(PLATFORM_WALLET, feeWeiBigint);
          const feeTx = await tokenContract.transfer(PLATFORM_WALLET, feeWeiBigint, { gasLimit });
          await feeTx.wait();
        }
        toast.info("Platform fee sent");
      }

      // Execute swap
      setTransactionStatus("Executing swap...");
      const swapRouter = new ethers.Contract(SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI, signer) as unknown as SwapRouterContract;
      const value = tokenIn.address === ETH_ADDRESS ? amtAfterFee : BigInt(0);
      const recipient = tokenOut.address === ETH_ADDRESS ? SWAP_ROUTER_ADDRESS : address;
      let swapTx: ethers.ContractTransactionResponse;
      if (isWETHPair) {
        const swapParams = {
          tokenIn: tokenIn.address === ETH_ADDRESS ? WETH_ADDRESS : tokenIn.address,
          tokenOut: tokenOut.address === ETH_ADDRESS ? WETH_ADDRESS : tokenOut.address,
          fee: poolFee,
          recipient,
          deadline,
          amountIn: amtAfterFee,
          amountOutMinimum: amtOutMin,
          sqrtPriceLimitX96: BigInt(0),
        };
        const gasLimit = await swapRouter.estimateGas.exactInputSingle(swapParams, { value });
        swapTx = await swapRouter.exactInputSingle(swapParams, { gasLimit, value });
      } else {
        let path: string;
        if (activeTab === "buy") {
          path = ethers.solidityPacked(
            ["address", "uint24", "address", "uint24", "address"],
            [WETH_ADDRESS, USDC_WETH_POOL_FEE, USDC_ADDRESS, poolFee, token.baseToken.address]
          );
        } else {
          path = ethers.solidityPacked(
            ["address", "uint24", "address", "uint24", "address"],
            [token.baseToken.address, poolFee, USDC_ADDRESS, USDC_WETH_POOL_FEE, WETH_ADDRESS]
          );
        }
        const swapParams = {
          path,
          recipient,
          deadline,
          amountIn: amtAfterFee,
          amountOutMinimum: amtOutMin,
        };
        const gasLimit = await swapRouter.estimateGas.exactInput(swapParams, { value });
        swapTx = await swapRouter.exactInput(swapParams, { gasLimit, value });
      }
      await swapTx.wait();
      toast.info("Swap executed");

      // Unwrap WETH if receiving ETH
      if (tokenOut.address === ETH_ADDRESS) {
        setTransactionStatus("Unwrapping WETH → ETH...");
        const gasLimitUnwrap = await swapRouter.estimateGas.unwrapWETH9(amtOutMin, address);
        const unwrapTx = await swapRouter.unwrapWETH9(amtOutMin, address, { gasLimit: gasLimitUnwrap });
        await unwrapTx.wait();
        toast.info("WETH unwrapped into ETH");
      }

      // Update P&L
      const amtInNum = parseFloat(amountIn);
      const amtOutNum = parseFloat(amountOut);
      if (activeTab === "buy") {
        setBoughtAmount((prev) => prev + amtOutNum);
        setProfitLoss((prev) => prev - amtInNum * ethPrice + amtOutNum * parseFloat(token.priceUsd || "0"));
      } else {
        setSoldAmount((prev) => prev + amtInNum);
        setProfitLoss((prev) => prev + amtInNum * parseFloat(token.priceUsd || "0") - amtOutNum * ethPrice);
      }

      setTransactionStatus("Transaction Complete");
      toast.success(`Swapped ${amountIn} ${tokenIn.symbol} → ${amountOut} ${tokenOut.symbol}`);
      setAmountIn("");
      setAmountOut("");
      setIsApproved(false);
    } catch (err: unknown) {
      console.error("Swap error:", err);
      setTransactionStatus("");
      let isUserRejected = false;
      let isInsufficientFunds = false;
      let errorMessage = "Swap failed. Please try again.";
      if (err && typeof err === "object") {
        if ("code" in err && err.code === 4001) {
          isUserRejected = true;
        }
        if ("message" in err && typeof err.message === "string" && err.message.includes("insufficient funds")) {
          isInsufficientFunds = true;
        }
        if ("reason" in err && typeof err.reason === "string") {
          errorMessage = err.reason;
        } else if ("message" in err && typeof err.message === "string") {
          errorMessage = err.message;
        }
      }
      if (isUserRejected) {
        toast.error("User rejected transaction.");
      } else if (isInsufficientFunds) {
        toast.error("Insufficient funds for gas or swap amount.");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSwapLoading(false);
    }
  };

  const handleSwapTokens = () => {
    if (!tokenIn || !tokenOut) return;
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
    setAmountOut("");
    setIsApproved(false);
    setActiveTab(tokenIn.symbol === "ETH" ? "sell" : "buy");
  };

  const handleQuickAmount = (percent: number) => {
    if (!walletBalance || parseFloat(walletBalance) === 0) return;
    const amount = (parseFloat(walletBalance) * percent / 100).toFixed(6);
    setAmountIn(amount);
  };

  // Styling (unchanged from provided code)
  return (
    <div className="w-full font-sans">
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

        .swap-container {
          background: transparent;
          border-radius: 8px;
          padding: 4px;
          width: 100%;
          box-sizing: border-box;
        }

        .wallet-section {
          margin-bottom: 16px;
        }

        .wallet-button {
          background: rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          padding: 12px;
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

        .wallet-address {
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          border-radius: 6px;
          padding: 12px;
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
          padding: 12px;
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

        .quick-buttons {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
        }
        .quick-button {
          background: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }
        .quick-button:hover {
          background: rgba(59, 130, 246, 0.2);
        }

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

        .confirm-modal-content {
          background: transparent;
          border: 1px solid rgba(156, 163, 175, 0.3);
          border-radius: 8px;
          padding: 16px;
          width: 300px;
          max-width: 90%;
          box-sizing: border-box;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 50;
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

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.6);
          z-index: 40;
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
          .confirm-modal-content {
            width: 90%;
          }
        }
      `}</style>

      <div className="swap-container fade-in">
        <div className="wallet-section">
          {address && isConnected ? (
            <div className="wallet-address">
              <div className="flex items-center gap-2">
                <FaWallet className="text-blue-400 w-5 h-5" />
                <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
              </div>
              <button
                onClick={() => {
                  disconnect();
                  setSigner(null);
                  setWalletBalance("0.0");
                }}
                className="disconnect-btn"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              className="wallet-button"
              disabled={isSwapLoading}
            >
              <FaWallet className="w-5 h-5" />
              Connect Wallet
            </button>
          )}
        </div>

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

        <div className="swap-input-container">
          <div className="token-label">
            You Pay (Balance: {walletBalance} {tokenIn?.symbol})
          </div>
          <div className="swap-input-wrapper">
            <span className="token-select">{tokenIn?.symbol ?? ""}</span>
            <input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="swap-input"
              disabled={!tokenIn || !address || isSwapLoading}
            />
          </div>
          <div className="quick-buttons">
            <button className="quick-button" onClick={() => handleQuickAmount(25)}>25%</button>
            <button className="quick-button" onClick={() => handleQuickAmount(50)}>50%</button>
            <button className="quick-button" onClick={() => handleQuickAmount(75)}>75%</button>
            <button className="quick-button" onClick={() => handleQuickAmount(100)}>Max</button>
          </div>
        </div>

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

        <div className="swap-input-container">
          <div className="token-label">
            You Receive (Est. {amountOut || "0.0"} {tokenOut?.symbol})
          </div>
          <div className="swap-input-wrapper">
            <span className="token-select">{tokenOut?.symbol ?? ""}</span>
            <input
              type="number"
              placeholder="0.0"
              value={amountOut}
              disabled
              className="swap-input"
            />
          </div>
        </div>

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
            <span className="value">{gasEstimate} gas</span>
          </div>
        </div>

        <button
          onClick={openConfirmModal}
          className="swap-action-button"
          disabled={isSwapLoading || !address || !amountIn || !tokenIn || !tokenOut}
        >
          {isSwapLoading ? "Processing..." : activeTab === "buy" ? "Buy" : "Sell"}
        </button>

        <div className="profit-loss">
          <div>
            <span className="label">Bought:</span>
            <span className="value">
              {boughtAmount.toFixed(2)} {tokenOut?.symbol === "ETH" ? "" : tokenOut?.symbol}
            </span>
          </div>
          <div>
            <span className="label">Sold:</span>
            <span className="value">
              {soldAmount.toFixed(2)} {tokenIn?.symbol === "ETH" ? "" : tokenIn?.symbol}
            </span>
          </div>
          <div>
            <span className="label">P&L:</span>
            <span className={profitLoss >= 0 ? "profit-positive" : "profit-negative"}>
              <span className="eth-icon">Ξ</span>
              {profitLoss >= 0 ? "+" : ""}
              {profitLoss.toFixed(2)} (
              {((profitLoss / (boughtAmount || 1)) * 100).toFixed(2)}%)
            </span>
          </div>
        </div>

        {showConfirmModal && (
          <>
            <div className="modal-overlay" />
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
                <span className={priceImpact > 5 ? "high-impact" : "value"}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="detail-row">
                <span>Gas Estimate:</span>
                <span>{gasEstimate} gas</span>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Swap;