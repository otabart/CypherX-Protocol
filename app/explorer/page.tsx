"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ClipboardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

// Components
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

// Search Icon Component
function SearchIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z"
      />
    </svg>
  );
}

// External Link Icon Component
function ExternalLinkIcon({ className }: { className: string }) {
  return <ArrowTopRightOnSquareIcon className={className} />;
}

interface Block {
  number: number;
  hash: string;
  timestamp: string;
  transactionCount: number;
  validator: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
}

interface WhaleTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
}

export default function ExplorerPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [recentBlocks, setRecentBlocks] = useState<Block[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [whaleTransactions, setWhaleTransactions] = useState<WhaleTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [marketCap, setMarketCap] = useState<number>(0);
  const [totalTxns, setTotalTxns] = useState<number>(0);
  const [latestBlock, setLatestBlock] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Alchemy API URL
  const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

  // Debugging logs
  console.log("NEXT_PUBLIC_ALCHEMY_API_URL from process.env:", process.env.NEXT_PUBLIC_ALCHEMY_API_URL);
  console.log("Using Alchemy URL:", alchemyUrl);

  if (!alchemyUrl) {
    console.error("Missing Alchemy API URL. Set NEXT_PUBLIC_ALCHEMY_API_URL in .env.local.");
    setError("Alchemy API URL is missing. Please set NEXT_PUBLIC_ALCHEMY_API_URL in .env.local.");
  }

  // Theme classes aligned with Marketplace
  const themeClasses = {
    background: "bg-gray-950", // #030712
    text: "text-gray-200",
    border: "border-blue-500/30",
    headerBg: "bg-gray-950",
    containerBg: "bg-[#141A2F]", // Slightly lighter for contrast
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

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100vh";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [isMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Fetch ETH price and market cap
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/coins/ethereum");
        const data = await res.json();
        setEthPrice(data.market_data.current_price.usd);
        setMarketCap(data.market_data.market_cap.usd);
      } catch (err) {
        console.error("Error fetching market data:", err);
        setEthPrice(1852.38);
        setMarketCap(222423884847);
      }
    };
    fetchMarketData();
  }, []);

  // Fetch blockchain data
  useEffect(() => {
    if (!alchemyUrl) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const blockNumberResponse = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 1,
          }),
        });
        const blockNumberData = await blockNumberResponse.json();
        if (blockNumberData.error) {
          throw new Error(blockNumberData.error.message);
        }
        const latestBlockNumber = parseInt(blockNumberData.result, 16);
        setLatestBlock(latestBlockNumber);

        const blockPromises = [];
        for (let i = 0; i < 5; i++) {
          const blockNum = latestBlockNumber - i;
          blockPromises.push(
            fetch(alchemyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getBlockByNumber",
                params: [`0x${blockNum.toString(16)}`, true],
                id: i + 2,
              }),
            })
          );
        }
        const blockResponses = await Promise.all(blockPromises);
        const blocks = await Promise.all(blockResponses.map((res) => res.json()));

        const blockData: Block[] = blocks.map((block: any, index: number) => {
          if (block.error) {
            throw new Error(`Failed to fetch block ${latestBlockNumber - index}: ${block.error.message}`);
          }
          return {
            number: parseInt(block.result.number, 16),
            hash: block.result.hash,
            timestamp: formatDistanceToNow(new Date(parseInt(block.result.timestamp, 16) * 1000), {
              addSuffix: true,
            }).toUpperCase(),
            transactionCount: block.result.transactions.length,
            validator: block.result.miner || "0x4200000000000000000000000000000000000011",
          };
        });

        const txData: Transaction[] = [];
        for (const block of blocks) {
          if (block.error || !block.result) continue;
          for (const tx of block.result.transactions.slice(0, 5 - txData.length)) {
            if (txData.length >= 5) break;
            const value = tx.value ? parseInt(tx.value, 16) / 1e18 : 0;
            txData.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to || "N/A",
              value: value.toFixed(4),
              timestamp: formatDistanceToNow(new Date(parseInt(block.result.timestamp, 16) * 1000), {
                addSuffix: true,
              }).toUpperCase(),
            });
          }
          if (txData.length >= 5) break;
        }

        let totalTxCount = 0;
        for (const block of blocks) {
          if (block.result) {
            totalTxCount += block.result.transactions.length;
          }
        }
        setTotalTxns(totalTxCount * 1000000);

        const whaleResponse = await fetch(alchemyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "alchemy_getAssetTransfers",
            params: [
              {
                fromBlock: `0x${(latestBlockNumber - 100).toString(16)}`,
                toBlock: "latest",
                category: ["external"],
                maxCount: "0x32",
              },
            ],
            id: 3,
          }),
        });
        const whaleDataResponse = await whaleResponse.json();
        if (whaleDataResponse.error) {
          throw new Error(whaleDataResponse.error.message);
        }

        const whaleData: WhaleTransaction[] = whaleDataResponse.result.transfers
          .filter((tx: any) => tx.value && tx.value > 10)
          .map((tx: any) => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value.toFixed(4),
            timestamp: formatDistanceToNow(new Date(tx.metadata?.blockTimestamp || Date.now()), {
              addSuffix: true,
            }).toUpperCase(),
          }))
          .slice(0, 5);

        setRecentBlocks(blockData);
        setRecentTransactions(txData);
        setWhaleTransactions(whaleData);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Error fetching explorer data:", errorMessage);
        setError(`Error: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [alchemyUrl]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const handleSearch = () => {
    const query = searchQuery.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
      router.push(`/explorer/address/${query}`);
    } else if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
      router.push(`/explorer/hash/${query}`);
    } else if (/^\d+$/.test(query)) {
      router.push(`/explorer/latest/block/${query}`);
    } else {
      alert("Invalid search query. Please enter a valid address, transaction hash, or block number.");
    }
  };

  return (
    <div className={`min-h-screen w-full font-mono ${themeClasses.background} ${themeClasses.text}`}>
      {/* Header */}
      <div className="relative">
        <Header />
        {/* Skinny Separator Line Under Header */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-blue-500/30 w-full">
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"></div>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full">
        {/* Search Section */}
        <section className={`w-full py-8 sm:py-10 ${themeClasses.background}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search by address, transaction hash, or block number..."
                  className={`w-full py-3 pl-10 pr-4 text-sm sm:text-base rounded-lg ${themeClasses.containerBg} ${themeClasses.text} border ${themeClasses.border} focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all duration-200 placeholder-gray-500`}
                />
                <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
              <button
                onClick={handleSearch}
                className={`px-4 sm:px-6 py-3 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-lg text-blue-400 border ${themeClasses.border} text-sm sm:text-base font-medium transition-all duration-200 uppercase`}
              >
                Search
              </button>
            </div>
          </div>
        </section>

        {/* Overview Metrics */}
        <section className={`w-full py-8 sm:py-12 ${themeClasses.background}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 uppercase">Network Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div
                className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 sm:p-6 ${themeClasses.shadow} transition-all duration-200 ${themeClasses.hoverBg}`}
              >
                <h3 className="text-sm sm:text-base font-semibold text-blue-400 uppercase">ETH Price</h3>
                <p className={`${themeClasses.text} text-lg sm:text-xl mt-2`}>${ethPrice.toLocaleString()}</p>
              </div>
              <div
                className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 sm:p-6 ${themeClasses.shadow} transition-all duration-200 ${themeClasses.hoverBg}`}
              >
                <h3 className="text-sm sm:text-base font-semibold text-blue-400 uppercase">Market Cap</h3>
                <p className={`${themeClasses.text} text-lg sm:text-xl mt-2`}>${marketCap.toLocaleString()}</p>
              </div>
              <div
                className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 sm:p-6 ${themeClasses.shadow} transition-all duration-200 ${themeClasses.hoverBg}`}
              >
                <h3 className="text-sm sm:text-base font-semibold text-blue-400 uppercase">Transactions</h3>
                <p className={`${themeClasses.text} text-lg sm:text-xl mt-2`}>{(totalTxns / 1000000).toFixed(1)}M</p>
              </div>
              <div
                className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 sm:p-6 ${themeClasses.shadow} transition-all duration-200 ${themeClasses.hoverBg}`}
              >
                <h3 className="text-sm sm:text-base font-semibold text-blue-400 uppercase">Latest Block</h3>
                <p className={`${themeClasses.text} text-lg sm:text-xl mt-2`}>{latestBlock}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Sections */}
        <section className={`w-full py-8 sm:py-12 ${themeClasses.background}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Latest Blocks */}
              <div
                className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 sm:p-6 ${themeClasses.shadow} flex flex-col min-h-[400px]`}
              >
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 uppercase">Latest Blocks</h2>
                {loading ? (
                  <div className="flex justify-center items-center py-6 flex-grow">
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
                    <span className={`${themeClasses.secondaryText} ml-2 uppercase text-sm sm:text-base`}>Loading...</span>
                  </div>
                ) : error ? (
                  <p className={`${themeClasses.errorText} text-center py-6 uppercase flex-grow text-sm sm:text-base`}>{error}</p>
                ) : recentBlocks.length > 0 ? (
                  <div className="space-y-4 sm:space-y-6 flex-grow">
                    {recentBlocks.map((block, index) => (
                      <div
                        key={index}
                        className={`p-4 sm:p-5 ${themeClasses.border} rounded-lg ${themeClasses.hoverBg} transition-all duration-200`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <Link
                              href={`/explorer/latest/block/${block.number}`}
                              className="text-blue-400 font-semibold hover:underline text-base sm:text-lg"
                            >
                              Block #{block.number}
                            </Link>
                            <p className={`${themeClasses.secondaryText} text-xs sm:text-sm mt-1`}>{block.timestamp}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className={`${themeClasses.text} text-sm sm:text-base`}>{block.transactionCount} txns</p>
                            <p className={`${themeClasses.secondaryText} text-xs sm:text-sm mt-1 truncate`}>
                              Validator: {block.validator.slice(0, 6)}...{block.validator.slice(-4)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Link
                      href="/explorer/blocks"
                      className="text-blue-400 hover:underline text-sm sm:text-base block text-center mt-6 sm:mt-8 uppercase"
                    >
                      View All Blocks
                    </Link>
                  </div>
                ) : (
                  <p className={`${themeClasses.secondaryText} text-center py-6 uppercase flex-grow text-sm sm:text-base`}>No blocks found</p>
                )}
              </div>

              {/* Latest Transactions */}
              <div
                className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 sm:p-6 ${themeClasses.shadow} flex flex-col min-h-[400px]`}
              >
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 uppercase">Latest Transactions</h2>
                {loading ? (
                  <div className="flex justify-center items-center py-6 flex-grow">
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
                    <span className={`${themeClasses.secondaryText} ml-2 uppercase text-sm sm:text-base`}>Loading...</span>
                  </div>
                ) : error ? (
                  <p className={`${themeClasses.errorText} text-center py-6 uppercase flex-grow text-sm sm:text-base`}>{error}</p>
                ) : recentTransactions.length > 0 ? (
                  <div className="space-y-4 sm:space-y-6 flex-grow">
                    {recentTransactions.map((tx, index) => (
                      <div
                        key={index}
                        className={`p-4 sm:p-5 ${themeClasses.border} rounded-lg ${themeClasses.hoverBg} transition-all duration-200`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <Link
                              href={`/explorer/hash/${tx.hash}`}
                              className="text-blue-400 font-semibold hover:underline text-base sm:text-lg truncate"
                            >
                              {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                            </Link>
                            <p className={`${themeClasses.secondaryText} text-xs sm:text-sm mt-1`}>{tx.timestamp}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className={`${themeClasses.text} text-sm sm:text-base truncate`}>
                              From: {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                            </p>
                            <p className={`${themeClasses.text} text-sm sm:text-base mt-1 truncate`}>
                              To: {tx.to === "N/A" ? "N/A" : `${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`}
                            </p>
                            <p className={`${themeClasses.secondaryText} text-xs sm:text-sm mt-1`}>{tx.value} ETH</p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 sm:gap-3 mt-3">
                          <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400 hover:text-blue-500 transition-all" />
                          </a>
                          <button
                            onClick={() => copyToClipboard(tx.hash)}
                            className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full border ${themeClasses.border} transition-all`}
                          >
                            <ClipboardIcon className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <Link
                      href="/explorer/transactions"
                      className="text-blue-400 hover:underline text-sm sm:text-base block text-center mt-6 sm:mt-8 uppercase"
                    >
                      View All Transactions
                    </Link>
                  </div>
                ) : (
                  <p className={`${themeClasses.secondaryText} text-center py-6 uppercase flex-grow text-sm sm:text-base`}>No transactions found</p>
                )}
              </div>

              {/* Top Whale Transactions */}
              <div
                className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 sm:p-6 ${themeClasses.shadow} flex flex-col min-h-[400px]`}
              >
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 uppercase">Top Whale Transactions</h2>
                {loading ? (
                  <div className="flex justify-center items-center py-6 flex-grow">
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
                    <span className={`${themeClasses.secondaryText} ml-2 uppercase text-sm sm:text-base`}>Loading...</span>
                  </div>
                ) : error ? (
                  <p className={`${themeClasses.errorText} text-center py-6 uppercase flex-grow text-sm sm:text-base`}>{error}</p>
                ) : whaleTransactions.length > 0 ? (
                  <div className="space-y-4 sm:space-y-6 flex-grow">
                    {whaleTransactions.map((tx, index) => (
                      <div
                        key={index}
                        className={`p-4 sm:p-5 ${themeClasses.border} rounded-lg ${themeClasses.hoverBg} transition-all duration-200`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <Link
                              href={`/explorer/hash/${tx.hash}`}
                              className="text-blue-400 font-semibold hover:underline text-base sm:text-lg truncate"
                            >
                              {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                            </Link>
                            <p className={`${themeClasses.secondaryText} text-xs sm:text-sm mt-1`}>{tx.timestamp}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className={`${themeClasses.text} text-sm sm:text-base truncate`}>
                              From: {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                            </p>
                            <p className={`${themeClasses.text} text-sm sm:text-base mt-1 truncate`}>
                              To: {tx.to.slice(0, 6)}...{tx.to.slice(-4)}
                            </p>
                            <p className={`${themeClasses.secondaryText} text-xs sm:text-sm mt-1`}>{tx.value} ETH</p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 sm:gap-3 mt-3">
                          <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400 hover:text-blue-500 transition-all" />
                          </a>
                          <button
                            onClick={() => copyToClipboard(tx.hash)}
                            className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full border ${themeClasses.border} transition-all`}
                          >
                            <ClipboardIcon className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <Link
                      href="/explorer/whale-transactions"
                      className="text-blue-400 hover:underline text-sm sm:text-base block text-center mt-6 sm:mt-8 uppercase"
                    >
                      View All Whale Transactions
                    </Link>
                  </div>
                ) : (
                  <p className={`${themeClasses.secondaryText} text-center py-6 uppercase flex-grow text-sm sm:text-base`}>No whale transactions found</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}