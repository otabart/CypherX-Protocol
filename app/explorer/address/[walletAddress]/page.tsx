"use client";

import { notFound } from "next/navigation";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ClipboardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

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

interface WalletData {
  ethBalance: number;
  ethUsdValue: number;
  tokens: Token[];
  txList: Transaction[];
}

export default function WalletPage({ params }: { params: Promise<{ walletAddress: string }> }) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [txPage, setTxPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Theme classes aligned with ExplorerPage
  const themeClasses = {
    background: "bg-gray-950",
    text: "text-gray-200",
    border: "border-blue-500/30",
    headerBg: "bg-gray-950",
    containerBg: "bg-[#141A2F]",
    hoverBg: "hover:bg-[#1E263B] hover:shadow-lg hover:scale-[1.02]",
    secondaryText: "text-gray-400",
    errorText: "text-red-400",
    buttonBg: "bg-blue-500/20",
    buttonHover: "hover:bg-blue-500/40",
    buttonDisabled: "bg-gray-800",
    shadow: "shadow-[0_2px_8px_rgba(59,130,246,0.2)]",
    tabActive: "border-blue-400 text-blue-400",
    tabInactive: "border-transparent text-gray-400",
  };

  // Fetch ETH price
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        if (!res.ok) {
          throw new Error(`Failed to fetch ETH price: ${res.statusText}`);
        }
        const data = await res.json();
        setEthPrice(data.ethereum.usd);
      } catch (err) {
        console.error("Error fetching ETH price:", err);
        setEthPrice(3000); // Fallback price
      }
    };
    fetchEthPrice();
  }, []);

  // Fetch wallet data from API route
  useEffect(() => {
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

        // Fetch data from server-side API route
        const response = await fetch(`/api/wallet/${address}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error("API response not OK:", response.status, errorText);
          throw new Error(errorText || "Failed to fetch wallet data");
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const errorText = await response.text();
          console.error("Unexpected response format:", errorText);
          throw new Error("Response is not JSON");
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // Format timestamps on the client side
        const formattedTxList = data.txList.map((tx: Transaction) => ({
          ...tx,
          timestamp: tx.timestamp !== "N/A" ? formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true }).toUpperCase() : "N/A",
        }));

        const ethUsdValue = data.ethBalance * ethPrice;

        setWalletData({
          ethBalance: data.ethBalance,
          ethUsdValue,
          tokens: data.tokens,
          txList: formattedTxList,
        });

        if (data.ethBalance === 0 && data.tokens.length === 0 && data.txList.length === 0) {
          setError("No data found for this address on Base Mainnet.");
          setWalletData(null);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Error fetching wallet data:", errorMessage);
        setError(`Failed to load wallet data: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params, ethPrice]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const paginatedTxList = walletData?.txList.slice((txPage - 1) * itemsPerPage, txPage * itemsPerPage);
  const totalTxPages = Math.ceil((walletData?.txList.length || 0) / itemsPerPage);

  return (
    <div className={`min-h-screen w-full font-mono ${themeClasses.background} ${themeClasses.text}`}>
      <div className="relative">
        <div className="py-4 sm:py-6 px-4 sm:px-6 max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold uppercase">Wallet Scan</h1>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-blue-500/30 w-full">
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"></div>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center py-6">
            <svg
              className="w-6 h-6 animate-spin text-blue-400"
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
            <span className={`${themeClasses.secondaryText} ml-2 text-sm sm:text-base uppercase`}>Loading...</span>
          </div>
        ) : error ? (
          <p className={`${themeClasses.errorText} text-center py-6 text-sm sm:text-base uppercase`}>Error: {error}</p>
        ) : !walletData ? (
          <p className={`${themeClasses.secondaryText} text-center py-6 text-sm sm:text-base uppercase`}>No Data Available</p>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-semibold uppercase">Address</h2>
                <span className="text-blue-400 truncate max-w-[200px] sm:max-w-[300px] text-sm sm:text-base">{walletAddress}</span>
                <button
                  onClick={() => copyToClipboard(walletAddress)}
                  className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full border ${themeClasses.border}`}
                >
                  <ClipboardIcon className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                </button>
                <a
                  href={`https://basescan.org/address/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full border ${themeClasses.border}`}
                >
                  <ArrowTopRightOnSquareIcon className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                </a>
              </div>
              <span className={`${themeClasses.secondaryText} text-xs sm:text-sm uppercase`}>Base Mainnet</span>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${themeClasses.containerBg} border ${themeClasses.border} p-4 sm:p-6 rounded-lg`}>
              <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase">Balance</h3>
                <p className={`${themeClasses.text} text-base sm:text-lg mt-1`}>{walletData.ethBalance.toFixed(4)} BASE ETH</p>
                <p className={`${themeClasses.secondaryText} text-xs sm:text-sm`}>${walletData.ethUsdValue.toFixed(2)} USD</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase">Tokens</h3>
                <p className={`${themeClasses.text} text-base sm:text-lg mt-1`}>{walletData.tokens.length}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-blue-400 uppercase">Transactions</h3>
                <p className={`${themeClasses.text} text-base sm:text-lg mt-1`}>{walletData.txList.length}</p>
              </div>
            </div>

            <div className="border-b border-blue-400">
              <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto">
                {["overview", "transactions", "tokens"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-3 sm:px-4 text-sm sm:text-base font-semibold border-b-2 whitespace-nowrap ${
                      activeTab === tab ? themeClasses.tabActive : themeClasses.tabInactive
                    } hover:${themeClasses.tabActive} transition-all duration-200 uppercase`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            <div className="mt-4 sm:mt-6">
              {activeTab === "overview" && (
                <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 sm:p-6 rounded-lg`}>
                  <h3 className="text-base sm:text-lg font-semibold text-blue-400 mb-3 uppercase">Overview</h3>
                  <div className="space-y-2 text-sm sm:text-base">
                    <p>
                      <strong>Balance:</strong> {walletData.ethBalance.toFixed(4)} BASE ETH (${walletData.ethUsdValue.toFixed(2)} USD)
                    </p>
                    <p>
                      <strong>Total Tokens:</strong> {walletData.tokens.length}
                    </p>
                    <p>
                      <strong>Recent Transactions:</strong> {walletData.txList.length}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "transactions" && (
                <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 sm:p-6 rounded-lg`}>
                  <h3 className="text-base sm:text-lg font-semibold text-blue-400 mb-3 uppercase">Transactions</h3>
                  {walletData.txList.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                          <thead>
                            <tr className={`text-blue-400 border-b ${themeClasses.border}`}>
                              <th className="py-2 px-2 sm:px-3 text-left font-semibold uppercase">Hash</th>
                              <th className="py-2 px-2 sm:px-3 text-left font-semibold uppercase">From</th>
                              <th className="py-2 px-2 sm:px-3 text-left font-semibold uppercase">To</th>
                              <th className="py-2 px-2 sm:px-3 text-left font-semibold uppercase">Value</th>
                              <th className="py-2 px-2 sm:px-3 text-left font-semibold uppercase">Asset</th>
                              <th className="py-2 px-2 sm:px-3 text-left font-semibold uppercase">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTxList?.map((tx: Transaction, index: number) => (
                              <tr key={index} className={`border-b ${themeClasses.border} ${themeClasses.hoverBg}`}>
                                <td className="py-2 px-2 sm:px-3 truncate">
                                  <div className="flex items-center space-x-1 sm:space-x-2">
                                    <Link
                                      href={`/explorer/hash/${tx.hash}`}
                                      className="text-blue-400 hover:underline"
                                    >
                                      {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                                    </Link>
                                    <a
                                      href={`https://basescan.org/tx/${tx.hash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400"
                                    >
                                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                    </a>
                                    <button
                                      onClick={() => copyToClipboard(tx.hash)}
                                      className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full border ${themeClasses.border}`}
                                    >
                                      <ClipboardIcon className="w-4 h-4 text-blue-400" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2 px-2 sm:px-3 truncate">
                                  <Link
                                    href={`/explorer/address/${tx.from}`}
                                    className="text-blue-400 hover:underline"
                                  >
                                    {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                                  </Link>
                                </td>
                                <td className="py-2 px-2 sm:px-3 truncate">
                                  {tx.to === "N/A" ? (
                                    "N/A"
                                  ) : (
                                    <Link
                                      href={`/explorer/address/${tx.to}`}
                                      className="text-blue-400 hover:underline"
                                    >
                                      {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                                    </Link>
                                  )}
                                </td>
                                <td className="py-2 px-2 sm:px-3">{tx.value}</td>
                                <td className="py-2 px-2 sm:px-3">{tx.asset}</td>
                                <td className="py-2 px-2 sm:px-3">{tx.timestamp}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
                        <button
                          onClick={() => setTxPage((prev) => Math.max(prev - 1, 1))}
                          disabled={txPage === 1}
                          className={`px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} ${txPage === 1 ? themeClasses.buttonDisabled : ""} rounded-lg text-sm uppercase w-full sm:w-auto`}
                        >
                          Previous
                        </button>
                        <span className={`${themeClasses.text} text-sm uppercase`}>
                          Page {txPage} of {totalTxPages}
                        </span>
                        <button
                          onClick={() => setTxPage((prev) => Math.min(prev + 1, totalTxPages))}
                          disabled={txPage === totalTxPages}
                          className={`px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} ${txPage === totalTxPages ? themeClasses.buttonDisabled : ""} rounded-lg text-sm uppercase w-full sm:w-auto`}
                        >
                          Next
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className={`${themeClasses.secondaryText} text-sm sm:text-base uppercase`}>No Transactions Found</p>
                  )}
                </div>
              )}

              {activeTab === "tokens" && (
                <div className={`${themeClasses.containerBg} border ${themeClasses.border} p-4 sm:p-6 rounded-lg`}>
                  <h3 className="text-base sm:text-lg font-semibold text-blue-400 mb-3 uppercase">Token Holdings</h3>
                  {walletData.tokens.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className={`text-blue-400 border-b ${themeClasses.border}`}>
                            <th className="py-2 px-2 sm:px-3 text-left font-semibold uppercase">Name</th>
                            <th className="py-2 px-2 sm:px-3 text-left font-semibold uppercase">Symbol</th>
                            <th className="py-2 px-2 sm:px-3 text-left font-semibold uppercase">Balance</th>
                            <th className="py-2 px-2 sm:px-3 text-left font-semibold uppercase">Contract</th>
                          </tr>
                        </thead>
                        <tbody>
                          {walletData.tokens.map((token: Token, index: number) => (
                            <tr key={index} className={`border-b ${themeClasses.border} ${themeClasses.hoverBg}`}>
                              <td className="py-2 px-2 sm:px-3">{token.name}</td>
                              <td className="py-2 px-2 sm:px-3">{token.symbol}</td>
                              <td className="py-2 px-2 sm:px-3">{token.balance}</td>
                              <td className="py-2 px-2 sm:px-3 truncate">
                                <Link
                                  href={`/explorer/address/${token.contractAddress}`}
                                  className="text-blue-400 hover:underline"
                                >
                                  {token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className={`${themeClasses.secondaryText} text-sm sm:text-base uppercase`}>No Tokens Found</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}