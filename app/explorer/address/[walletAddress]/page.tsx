"use client";

import { notFound } from "next/navigation";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ClipboardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

interface Token {
  name: string;
  symbol: string;
  balance: string;
  contractAddress: string;
  usdValue?: number;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  timestamp: string;
}

interface NFT {
  name: string;
  contractAddress: string;
  tokenId: string;
  image?: string;
}

interface WalletData {
  ethBalance: number;
  ethUsdValue: number;
  tokens: Token[];
  txList: Transaction[];
  nfts: NFT[];
}

export default function WalletPage({ params }: { params: Promise<{ walletAddress: string }> }) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>("dark");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [txPage, setTxPage] = useState<number>(1);
  const [nftPage, setNftPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Alchemy API URL
  const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

  // Debugging logs
  console.log("NEXT_PUBLIC_ALCHEMY_API_URL from process.env (WalletPage):", process.env.NEXT_PUBLIC_ALCHEMY_API_URL);
  console.log("Using Alchemy URL (WalletPage):", alchemyUrl);

  if (!alchemyUrl) {
    console.error("Missing Alchemy API URL. Set NEXT_PUBLIC_ALCHEMY_API_URL in .env.local.");
    setError("Alchemy API URL is missing. Please set NEXT_PUBLIC_ALCHEMY_API_URL in .env.local.");
  }

  const themeClasses = {
    background: theme === "dark" ? "bg-black" : "bg-white",
    text: theme === "dark" ? "text-white" : "text-black",
    border: theme === "dark" ? "border-[#333333]" : "border-gray-200",
    headerBg: theme === "dark" ? "bg-[#1A1A1A]" : "bg-gray-100",
    containerBg: theme === "dark" ? "bg-[#1A1A1A]" : "bg-gray-100",
    hoverBg: theme === "dark" ? "hover:bg-[#222222]" : "hover:bg-gray-50",
    secondaryText: theme === "dark" ? "text-gray-400" : "text-gray-600",
    errorText: theme === "dark" ? "text-red-400" : "text-red-600",
    buttonBg: theme === "dark" ? "bg-[#0052FF]" : "bg-blue-600",
    buttonHover: theme === "dark" ? "hover:bg-[#003ECB]" : "hover:bg-blue-700",
    buttonDisabled: theme === "dark" ? "bg-[#4A4A4A]" : "bg-gray-400",
    shadow: theme === "dark" ? "shadow-[0_2px_8px_rgba(0,82,255,0.2)]" : "shadow-[0_2px_8px_rgba(0,0,0,0.1)]",
    tabActive: theme === "dark" ? "border-[#0052FF] text-[#0052FF]" : "border-blue-600 text-blue-600",
    tabInactive: theme === "dark" ? "border-transparent text-gray-400" : "border-transparent text-gray-600",
  };

  // Fetch ETH price
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        const data = await res.json();
        setEthPrice(data.ethereum.usd);
      } catch (err) {
        console.error("Error fetching ETH price:", err);
        setEthPrice(3000); // Fallback price
      }
    };
    fetchEthPrice();
  }, []);

  // Fetch wallet data using fetch with Alchemy API
  useEffect(() => {
    if (!alchemyUrl) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const resolvedParams = await params;
        const address = resolvedParams.walletAddress;
        setWalletAddress(address);

        // Validate wallet address
        const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
        if (!isValidAddress) {
          notFound();
        }

        // Fetch ETH balance (eth_getBalance)
        const balanceResponse = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBalance",
            params: [address, "latest"],
            id: 1,
          }),
        });
        const balanceData = await balanceResponse.json();
        if (balanceData.error) {
          throw new Error(balanceData.error.message);
        }
        const ethBalance = parseInt(balanceData.result, 16) / 1e18;

        // Fetch token balances (alchemy_getTokenBalances)
        const tokenBalancesResponse = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "alchemy_getTokenBalances",
            params: [address],
            id: 2,
          }),
        });
        const tokenBalancesData = await tokenBalancesResponse.json();
        if (tokenBalancesData.error) {
          throw new Error(tokenBalancesData.error.message);
        }
        const tokenBalances = tokenBalancesData.result.tokenBalances;

        // Fetch token metadata and process balances
        const tokens: Token[] = await Promise.all(
          tokenBalances.map(async (token: any) => {
            try {
              const metadataResponse = await fetch(alchemyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  method: "alchemy_getTokenMetadata",
                  params: [token.contractAddress],
                  id: 3,
                }),
              });
              const metadataData = await metadataResponse.json();
              const metadata = metadataData.result || {};

              const balance = parseInt(token.tokenBalance || "0", 16) / 10 ** (metadata.decimals || 18);
              const usdValue = 0; // Placeholder; fetch token price if needed
              return {
                name: metadata.name || "Unknown Token",
                symbol: metadata.symbol || "N/A",
                balance: balance.toFixed(4),
                contractAddress: token.contractAddress,
                usdValue,
              };
            } catch (error: unknown) {
              console.error(`Error processing token ${token.contractAddress}:`, (error as Error).message);
              return {
                name: "Unknown Token",
                symbol: "N/A",
                balance: "0",
                contractAddress: token.contractAddress,
                usdValue: 0,
              };
            }
          })
        );

        // Fetch transactions (alchemy_getAssetTransfers)
        const transactionsResponse = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "alchemy_getAssetTransfers",
            params: [
              {
                fromBlock: "0x0",
                toBlock: "latest",
                fromAddress: address,
                toAddress: address,
                excludeZeroValue: true,
                category: ["external", "internal", "erc20", "erc721", "erc1155"],
                maxCount: "0x19", // 25 in hex
              },
            ],
            id: 4,
          }),
        });
        const transactionsData = await transactionsResponse.json();
        if (transactionsData.error) {
          throw new Error(transactionsData.error.message);
        }
        const transactions = transactionsData.result.transfers || [];

        const txList: Transaction[] = transactions.map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value ? tx.value.toFixed(4) : "N/A",
          asset: tx.asset || "N/A",
          timestamp: tx.metadata?.blockTimestamp
            ? formatDistanceToNow(new Date(tx.metadata.blockTimestamp), { addSuffix: true }).toUpperCase()
            : "N/A",
        }));

        // Fetch NFTs (alchemy_getNftsForOwner)
        const nftsResponse = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "alchemy_getNftsForOwner",
            params: [address, { pageSize: 100 }],
            id: 5,
          }),
        });
        const nftsData = await nftsResponse.json();
        if (nftsData.error) {
          throw new Error(nftsData.error.message);
        }
        const nftHoldings = nftsData.result || { ownedNfts: [] };

        const nfts: NFT[] = nftHoldings.ownedNfts.map((nft: any) => ({
          name: nft.title || "Unknown NFT",
          contractAddress: nft.contract?.address || "N/A",
          tokenId: nft.tokenId,
          image: nft.media?.[0]?.gateway || "https://via.placeholder.com/150",
        }));

        if (ethBalance === 0 && tokens.length === 0 && txList.length === 0 && nfts.length === 0) {
          setError("No data found for this address on Base Mainnet.");
          setWalletData(null);
          return;
        }

        const ethUsdValue = ethBalance * ethPrice;

        const data: WalletData = {
          ethBalance,
          ethUsdValue,
          tokens,
          txList,
          nfts,
        };
        setWalletData(data);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Error fetching wallet data:", errorMessage);
        setError(`Failed to load wallet data: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params, ethPrice, alchemyUrl]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const paginatedTxList = walletData?.txList.slice((txPage - 1) * itemsPerPage, txPage * itemsPerPage);
  const totalTxPages = Math.ceil((walletData?.txList.length || 0) / itemsPerPage);

  const paginatedNfts = walletData?.nfts.slice((nftPage - 1) * itemsPerPage, nftPage * itemsPerPage);
  const totalNftPages = Math.ceil((walletData?.nfts.length || 0) / itemsPerPage);

  return (
    <div className={`min-h-screen w-full font-mono ${themeClasses.background} ${themeClasses.text}`}>
      <div className={`border ${themeClasses.border} ${themeClasses.shadow} w-full min-h-screen`}>
        <div className={`flex items-center justify-between px-4 py-3 sm:px-3 sm:py-2 ${themeClasses.headerBg}`}>
          <h1 className={`${themeClasses.text} text-lg sm:text-base font-semibold`}>[ WALLET SCAN ]</h1>
          <div className="flex space-x-2">
            <button
              onClick={toggleTheme}
              className={`p-2 sm:p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} transition-colors ${themeClasses.shadow}`}
            >
              {theme === "dark" ? (
                <svg
                  className="w-5 h-5 sm:w-4 sm:h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 sm:w-4 sm:h-4 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-3 max-w-7xl mx-auto">
          {loading ? (
            <div className="flex justify-center items-center py-4">
              <svg
                className="w-6 h-6 sm:w-5 sm:h-5 animate-spin text-[#0052FF]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z"
                />
              </svg>
              <span className={`${themeClasses.secondaryText} ml-2 text-sm sm:text-xs`}>[LOADING...]</span>
            </div>
          ) : error ? (
            <p className={`${themeClasses.errorText} text-center py-4 text-sm sm:text-xs`}>ERR: {error}</p>
          ) : !walletData ? (
            <p className={`${themeClasses.secondaryText} text-center py-4 text-sm sm:text-xs`}>[NO DATA]</p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-lg sm:text-base font-semibold">Address</h2>
                <span className="text-[#0052FF] truncate max-w-[200px] sm:max-w-[150px]">{walletAddress}</span>
                <button
                  onClick={() => copyToClipboard(walletAddress)}
                  className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded`}
                >
                  <ClipboardIcon className="w-4 h-4 text-white" />
                </button>
                <a
                  href={`https://basescan.org/address/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded`}
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 text-white" />
                </a>
                <span className={`${themeClasses.secondaryText} text-sm`}>[Base Mainnet]</span>
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${themeClasses.containerBg} border ${themeClasses.border} p-4 rounded-lg`}>
                <div>
                  <h3 className="text-sm font-semibold text-[#0052FF]">[ BALANCE ]</h3>
                  <p className={`${themeClasses.text} text-sm`}>{walletData.ethBalance.toFixed(4)} BASE ETH</p>
                  <p className={`${themeClasses.secondaryText} text-xs`}>${walletData.ethUsdValue.toFixed(2)} USD</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0052FF]">[ TOKENS ]</h3>
                  <p className={`${themeClasses.text} text-sm`}>{walletData.tokens.length}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0052FF]">[ NFTS ]</h3>
                  <p className={`${themeClasses.text} text-sm`}>{walletData.nfts.length}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0052FF]">[ TRANSACTIONS ]</h3>
                  <p className={`${themeClasses.text} text-sm`}>{walletData.txList.length}</p>
                </div>
              </div>

              <div className="border-b border-[#0052FF]">
                <nav className="flex space-x-4 overflow-x-auto">
                  {["overview", "transactions", "tokens", "nfts"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-2 px-4 text-sm font-semibold border-b-2 whitespace-nowrap ${
                        activeTab === tab ? themeClasses.tabActive : themeClasses.tabInactive
                      } hover:${themeClasses.tabActive}`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="mt-4">
                {activeTab === "overview" && (
                  <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 rounded-lg`}>
                    <h3 className="text-base font-semibold text-[#0052FF] mb-2">[ OVERVIEW ]</h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Balance:</strong> {walletData.ethBalance.toFixed(4)} BASE ETH (${walletData.ethUsdValue.toFixed(2)} USD)
                      </p>
                      <p>
                        <strong>Total Tokens:</strong> {walletData.tokens.length}
                      </p>
                      <p>
                        <strong>Total NFTs:</strong> {walletData.nfts.length}
                      </p>
                      <p>
                        <strong>Recent Transactions:</strong> {walletData.txList.length}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "transactions" && (
                  <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 rounded-lg overflow-x-auto`}>
                    <h3 className="text-base font-semibold text-[#0052FF] mb-2">[ TRANSACTIONS ]</h3>
                    {walletData.txList.length > 0 ? (
                      <>
                        <table className="w-full text-sm sm:text-xs">
                          <thead>
                            <tr className="text-[#0052FF] border-b border-[#0052FF]">
                              <th className="py-2 px-2 text-left font-semibold">Hash</th>
                              <th className="py-2 px-2 text-left font-semibold">From</th>
                              <th className="py-2 px-2 text-left font-semibold">To</th>
                              <th className="py-2 px-2 text-left font-semibold">Value</th>
                              <th className="py-2 px-2 text-left font-semibold">Asset</th>
                              <th className="py-2 px-2 text-left font-semibold">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTxList?.map((tx: Transaction, index: number) => (
                              <tr key={index} className={`border-b ${themeClasses.border} ${themeClasses.hoverBg}`}>
                                <td className="py-2 px-2 truncate">
                                  <div className="flex items-center space-x-1">
                                    <a
                                      href={`/explorer/tx/${tx.hash}`}
                                      className="text-[#0052FF] cursor-pointer"
                                    >
                                      {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                                    </a>
                                    <a
                                      href={`https://basescan.org/tx/${tx.hash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#0052FF] cursor-pointer"
                                    >
                                      <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[#0052FF]" />
                                    </a>
                                    <button
                                      onClick={() => copyToClipboard(tx.hash)}
                                      className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded`}
                                    >
                                      <ClipboardIcon className="w-4 h-4 text-white" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2 px-2 truncate">
                                  <a
                                    href={`/explorer/address/${tx.from}`}
                                    className="text-[#0052FF] cursor-pointer"
                                  >
                                    {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                                  </a>
                                </td>
                                <td className="py-2 px-2 truncate">
                                  <a
                                    href={`/explorer/address/${tx.to}`}
                                    className="text-[#0052FF] cursor-pointer"
                                  >
                                    {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                                  </a>
                                </td>
                                <td className="py-2 px-2">{tx.value}</td>
                                <td className="py-2 px-2">{tx.asset}</td>
                                <td className="py-2 px-2">{tx.timestamp}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex justify-between mt-4">
                          <button
                            onClick={() => setTxPage((prev) => Math.max(prev - 1, 1))}
                            disabled={txPage === 1}
                            className={`px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} ${txPage === 1 ? themeClasses.buttonDisabled : ""} rounded`}
                          >
                            Previous
                          </button>
                          <span className={`${themeClasses.text} text-sm`}>
                            Page {txPage} of {totalTxPages}
                          </span>
                          <button
                            onClick={() => setTxPage((prev) => Math.min(prev + 1, totalTxPages))}
                            disabled={txPage === totalTxPages}
                            className={`px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} ${txPage === totalTxPages ? themeClasses.buttonDisabled : ""} rounded`}
                          >
                            Next
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className={`${themeClasses.secondaryText} text-sm sm:text-xs`}>[NO TRANSACTIONS FOUND]</p>
                    )}
                  </div>
                )}

                {activeTab === "tokens" && (
                  <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 rounded-lg overflow-x-auto`}>
                    <h3 className="text-base font-semibold text-[#0052FF] mb-2">[ TOKEN HOLDINGS ]</h3>
                    {walletData.tokens.length > 0 ? (
                      <table className="w-full text-sm sm:text-xs">
                        <thead>
                          <tr className="text-[#0052FF] border-b border-[#0052FF]">
                            <th className="py-2 px-2 text-left font-semibold">Name</th>
                            <th className="py-2 px-2 text-left font-semibold">Symbol</th>
                            <th className="py-2 px-2 text-left font-semibold">Balance</th>
                            <th className="py-2 px-2 text-left font-semibold">Contract</th>
                          </tr>
                        </thead>
                        <tbody>
                          {walletData.tokens.map((token: Token, index: number) => (
                            <tr key={index} className={`border-b ${themeClasses.border} ${themeClasses.hoverBg}`}>
                              <td className="py-2 px-2">{token.name}</td>
                              <td className="py-2 px-2">{token.symbol}</td>
                              <td className="py-2 px-2">{token.balance}</td>
                              <td className="py-2 px-2 truncate">
                                <a
                                  href={`/explorer/address/${token.contractAddress}`}
                                  className="text-[#0052FF] cursor-pointer"
                                >
                                  {token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className={`${themeClasses.secondaryText} text-sm sm:text-xs`}>[NO TOKENS FOUND]</p>
                    )}
                  </div>
                )}

                {activeTab === "nfts" && (
                  <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 rounded-lg overflow-x-auto`}>
                    <h3 className="text-base font-semibold text-[#0052FF] mb-2">[ NFT HOLDINGS ]</h3>
                    {walletData.nfts.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {paginatedNfts?.map((nft: NFT, index: number) => (
                            <div key={index} className={`border ${themeClasses.border} p-2 rounded-lg`}>
                              <img
                                src={nft.image}
                                alt={nft.name}
                                className="w-full h-32 object-cover rounded"
                                onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/150")}
                              />
                              <p className="text-sm mt-2">{nft.name}</p>
                              <p className={`${themeClasses.secondaryText} text-xs`}>Token ID: {nft.tokenId}</p>
                              <a
                                href={`/explorer/address/${nft.contractAddress}`}
                                className="text-[#0052FF] text-xs cursor-pointer"
                              >
                                Contract: {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)}
                              </a>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mt-4">
                          <button
                            onClick={() => setNftPage((prev) => Math.max(prev - 1, 1))}
                            disabled={nftPage === 1}
                            className={`px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} ${nftPage === 1 ? themeClasses.buttonDisabled : ""} rounded`}
                          >
                            Previous
                          </button>
                          <span className={`${themeClasses.text} text-sm`}>
                            Page {nftPage} of {totalNftPages}
                          </span>
                          <button
                            onClick={() => setNftPage((prev) => Math.min(prev + 1, totalNftPages))}
                            disabled={nftPage === totalNftPages}
                            className={`px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} ${nftPage === totalNftPages ? themeClasses.buttonDisabled : ""} rounded`}
                          >
                            Next
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className={`${themeClasses.secondaryText} text-sm sm:text-xs`}>[NO NFTS FOUND]</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}