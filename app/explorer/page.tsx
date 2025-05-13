'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ClipboardIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

// Firebase
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/app/providers';

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
  const { user, loading: authLoading } = useAuth();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentBlocks, setRecentBlocks] = useState<Block[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [whaleTransactions, setWhaleTransactions] = useState<WhaleTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>('dark');
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [marketCap, setMarketCap] = useState<number>(0);
  const [totalTxns, setTotalTxns] = useState<number>(0);
  const [latestBlock, setLatestBlock] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Alchemy API URL
  const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_API_URL;

  // Debugging logs
  console.log('NEXT_PUBLIC_ALCHEMY_API_URL from process.env:', process.env.NEXT_PUBLIC_ALCHEMY_API_URL);
  console.log('Using Alchemy URL:', alchemyUrl);

  if (!alchemyUrl) {
    console.error('Missing Alchemy API URL. Set NEXT_PUBLIC_ALCHEMY_API_URL in .env.local.');
    setError('Alchemy API URL is missing. Please set NEXT_PUBLIC_ALCHEMY_API_URL in .env.local.');
  }

  // Theme classes with original Coinbase blues
  const themeClasses = {
    background: theme === 'dark' ? 'bg-black' : 'bg-white',
    text: theme === 'dark' ? 'text-white' : 'text-black',
    border: theme === 'dark' ? 'border-gray-800' : 'border-gray-200',
    headerBg: theme === 'dark' ? 'bg-gray-950' : 'bg-gray-100',
    containerBg: theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100',
    hoverBg: theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50',
    secondaryText: theme === 'dark' ? 'text-gray-500' : 'text-gray-600',
    errorText: theme === 'dark' ? 'text-red-400' : 'text-red-600',
    buttonBg: theme === 'dark' ? 'bg-[#1652F0]' : 'bg-[#1652F0]',
    buttonHover: theme === 'dark' ? 'hover:bg-[#66B0FF]' : 'hover:bg-[#66B0FF]',
    buttonDisabled: theme === 'dark' ? 'bg-gray-600' : 'bg-gray-400',
    shadow: theme === 'dark' ? 'shadow-[0_2px_8px_rgba(0,0,0,0.3)]' : 'shadow-[0_2px_8px_rgba(0,0,0,0.1)]',
    tabActive: theme === 'dark' ? 'border-[#1652F0] text-[#1652F0]' : 'border-[#1652F0] text-[#1652F0]',
    tabInactive: theme === 'dark' ? 'border-transparent text-gray-500' : 'border-transparent text-gray-600',
  };

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.position = '';
      document.body.style.width = '';
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
        const res = await fetch('https://api.coingecko.com/api/v3/coins/ethereum');
        const data = await res.json();
        setEthPrice(data.market_data.current_price.usd);
        setMarketCap(data.market_data.market_cap.usd);
      } catch (err) {
        console.error('Error fetching market data:', err);
        setEthPrice(1852.38); // Fallback price
        setMarketCap(222423884847); // Fallback market cap
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
        // Get the latest block number using eth_blockNumber
        const blockNumberResponse = await fetch(alchemyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
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

        // Fetch the last 5 blocks using eth_getBlockByNumber
        const blockPromises = [];
        for (let i = 0; i < 5; i++) {
          const blockNum = latestBlockNumber - i;
          blockPromises.push(
            fetch(alchemyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getBlockByNumber',
                params: [`0x${blockNum.toString(16)}`, true],
                id: i + 2,
              }),
            })
          );
        }
        const blockResponses = await Promise.all(blockPromises);
        const blocks = await Promise.all(blockResponses.map((res) => res.json()));

        // Process blocks
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
            validator: block.result.miner || '0x4200000000000000000000000000000000000011', // Fallback validator
          };
        });

        // Process transactions
        const txData: Transaction[] = [];
        for (const block of blocks) {
          if (block.error || !block.result) continue;
          for (const tx of block.result.transactions.slice(0, 5 - txData.length)) {
            if (txData.length >= 5) break;
            const value = tx.value ? parseInt(tx.value, 16) / 1e18 : 0;
            txData.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to || 'N/A',
              value: value.toFixed(4),
              timestamp: formatDistanceToNow(new Date(parseInt(block.result.timestamp, 16) * 1000), {
                addSuffix: true,
              }).toUpperCase(),
            });
          }
          if (txData.length >= 5) break;
        }

        // Fetch total transaction count (mocked)
        let totalTxCount = 0;
        for (const block of blocks) {
          if (block.result) {
            totalTxCount += block.result.transactions.length;
          }
        }
        setTotalTxns(totalTxCount * 1000000); // Mocked multiplier

        // Fetch whale transactions using alchemy_getAssetTransfers
        const whaleResponse = await fetch(alchemyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'alchemy_getAssetTransfers',
            params: [
              {
                fromBlock: `0x${(latestBlockNumber - 100).toString(16)}`,
                toBlock: 'latest',
                category: ['external'],
                maxCount: '0x32', // 50 transactions
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
          .filter((tx: any) => tx.value && tx.value > 10) // Filter > 10 ETH
          .map((tx: any) => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value.toFixed(4),
            timestamp: formatDistanceToNow(new Date(tx.metadata.blockTimestamp), {
              addSuffix: true,
            }).toUpperCase(),
          }))
          .slice(0, 5);

        setRecentBlocks(blockData);
        setRecentTransactions(txData);
        setWhaleTransactions(whaleData);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error fetching explorer data:', errorMessage);
        setError(`Error: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [alchemyUrl]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const handleSearch = () => {
    const query = searchQuery.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
      router.push(`/explorer/address/${query}`);
    } else if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
      router.push(`/explorer/tx/${query}`);
    } else if (/^\d+$/.test(query)) {
      router.push(`/explorer/block/${query}`);
    } else {
      alert('Invalid search query. Please enter a valid address, transaction hash, or block number.');
    }
  };

  async function handleSignOut() {
    await signOut(auth);
    router.push('/login');
  }

  return (
    <div className={`min-h-screen w-full font-mono ${themeClasses.background} ${themeClasses.text}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 ${themeClasses.headerBg} ${themeClasses.shadow}`}>
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          {/* Title */}
          <Link href="/">
            <h1 className="text-xl font-bold text-white">[ BLOCK EXPLORER ]</h1>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
              Home
            </Link>
            <Link href="/token-scanner" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
              Screener
            </Link>
            <Link href="/terminal" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
              Terminal
            </Link>
            <Link href="/whale-watcher" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
              Whales
            </Link>
            <Link href="/honeypot-scanner" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
              Audit
            </Link>
            <Link href="/calendar" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
              Calendar
            </Link>
            <Link href="/latest/block" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
              Cypherscan
            </Link>
            <Link href="/TradingCompetition" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
              Tournaments
            </Link>

            {/* Sign In Button */}
            {!authLoading && (
              <Link
                href={user ? '/account' : '/login'}
                className={`px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-lg text-white text-sm font-medium transition duration-200`}
              >
                {user ? 'Account' : 'Sign In'}
              </Link>
            )}
          </nav>

          {/* Mobile Nav Toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-white"
            aria-label="Toggle Menu"
          >
            {isMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" strokeWidth={2} />
                <line x1="6" y1="18" x2="18" y2="6" strokeLinecap="round" strokeWidth={2} />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <line x1="4" y1="8" x2="20" y2="8" strokeLinecap="round" strokeWidth={2} />
                <line x1="4" y1="14" x2="16" y2="14" strokeLinecap="round" strokeWidth={2} />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div
        className={`md:hidden fixed inset-0 z-40 ${themeClasses.headerBg} transition-transform duration-300 overscroll-none ${
          isMenuOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ overscrollBehavior: 'none' }}
      >
        <nav className="pt-16 pb-10 px-6 h-full overflow-y-auto flex flex-col">
          <ul className="space-y-3">
            <li>
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-white hover:text-[#66B0FF] transition-colors"
              >
                <span>Home</span>
              </Link>
            </li>
            <li className="border-t border-gray-800"></li>
            <li>
              <Link
                href="/token-scanner"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-white hover:text-[#66B0FF] transition-colors"
              >
                <span>Screener</span>
              </Link>
            </li>
            <li className="border-t border-gray-800"></li>
            <li>
              <Link
                href="/terminal"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-white hover:text-[#66B0FF] transition-colors"
              >
                <span>Terminal</span>
              </Link>
            </li>
            <li className="border-t border-gray-800"></li>
            <li>
              <Link
                href="/whale-watcher"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-white hover:text-[#66B0FF] transition-colors"
              >
                <span>Whales</span>
              </Link>
            </li>
            <li className="border-t border-gray-800"></li>
            <li>
              <Link
                href="/honeypot-scanner"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-white hover:text-[#66B0FF] transition-colors"
              >
                <span>Audit</span>
              </Link>
            </li>
            <li className="border-t border-gray-800"></li>
            <li>
              <Link
                href="/calendar"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-white hover:text-[#66B0FF] transition-colors"
              >
                <span>Calendar</span>
              </Link>
            </li>
            <li className="border-t border-gray-800"></li>
            <li>
              <Link
                href="/latest/block"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-white hover:text-[#66B0FF] transition-colors"
              >
                <span>Cypherscan</span>
              </Link>
            </li>
            <li className="border-t border-gray-800"></li>
            <li>
              <Link
                href="/TradingCompetition"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 py-2 text-white hover:text-[#66B0FF] transition-colors"
              >
                <span>Tournaments</span>
              </Link>
            </li>
            <li className="border-t border-gray-800"></li>
            <li>
              {!authLoading && (
                <Link
                  href={user ? '/account' : '/login'}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2 py-2 text-white hover:text-[#66B0FF] transition-colors"
                >
                  <span>{user ? 'Account' : 'Sign in'}</span>
                </Link>
              )}
            </li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <main className="w-full">
        {/* Search Section */}
        <section className={`w-full py-6 ${themeClasses.background} border-b ${themeClasses.border}`}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by address, transaction hash, block..."
                  className={`w-full p-2 pl-8 text-sm rounded-lg ${themeClasses.containerBg} ${themeClasses.text} border ${themeClasses.border} focus:outline-none focus:ring-2 focus:ring-[#1652F0] transition duration-200`}
                />
                <SearchIcon className="w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" />
              </div>
              <button
                onClick={handleSearch}
                className={`px-4 py-2 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-lg text-white text-sm font-medium transition duration-200`}
              >
                Search
              </button>
            </div>
          </div>
        </section>

        {/* Overview Metrics */}
        <section className={`w-full py-6 ${themeClasses.background}`}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 ${themeClasses.shadow}`}>
                <h3 className="text-sm font-semibold text-[#1652F0]">[ ETH PRICE ]</h3>
                <p className={`${themeClasses.text} text-lg`}>${ethPrice.toLocaleString()}</p>
              </div>
              <div className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 ${themeClasses.shadow}`}>
                <h3 className="text-sm font-semibold text-[#1652F0]">[ MARKET CAP ]</h3>
                <p className={`${themeClasses.text} text-lg`}>${marketCap.toLocaleString()}</p>
              </div>
              <div className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 ${themeClasses.shadow}`}>
                <h3 className="text-sm font-semibold text-[#1652F0]">[ TRANSACTIONS ]</h3>
                <p className={`${themeClasses.text} text-lg`}>{(totalTxns / 1000000).toFixed(1)}M</p>
              </div>
              <div className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 ${themeClasses.shadow}`}>
                <h3 className="text-sm font-semibold text-[#1652F0]">[ LATEST BLOCK ]</h3>
                <p className={`${themeClasses.text} text-lg`}>{latestBlock}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Sections */}
        <section className={`w-full py-6 ${themeClasses.background}`}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Latest Blocks */}
              <div className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 ${themeClasses.shadow}`}>
                <h2 className="text-lg font-semibold text-[#1652F0] mb-4">[ LATEST BLOCKS ]</h2>
                {loading ? (
                  <div className="flex justify-center items-center py-4">
                    <svg
                      className="w-6 h-6 animate-spin text-[#1652F0]"
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
                    <span className={`${themeClasses.secondaryText} ml-2`}>Loading...</span>
                  </div>
                ) : error ? (
                  <p className={`${themeClasses.errorText} text-center py-4`}>{error}</p>
                ) : recentBlocks.length > 0 ? (
                  <div className="space-y-3">
                    {recentBlocks.map((block, index) => (
                      <div key={index} className={`p-3 ${themeClasses.border} rounded-lg ${themeClasses.hoverBg}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <a
                              href={`/explorer/block/${block.number}`}
                              className="text-[#1652F0] font-semibold hover:text-[#66B0FF]"
                            >
                              {block.number}
                            </a>
                            <p className={`${themeClasses.secondaryText} text-xs`}>{block.timestamp}</p>
                          </div>
                          <div className="text-right">
                            <p className={`${themeClasses.text} text-sm`}>{block.transactionCount} txns</p>
                            <p className={`${themeClasses.secondaryText} text-xs`}>
                              Validated by: {block.validator.slice(0, 6)}...{block.validator.slice(-4)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <a
                      href="/explorer/blocks"
                      className="text-[#1652F0] hover:text-[#66B0FF] text-sm block text-center mt-4"
                    >
                      View all blocks
                    </a>
                  </div>
                ) : (
                  <p className={`${themeClasses.secondaryText} text-center py-4`}>No blocks found</p>
                )}
              </div>

              {/* Latest Transactions */}
              <div className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 ${themeClasses.shadow}`}>
                <h2 className="text-lg font-semibold text-[#1652F0] mb-4">[ LATEST TRANSACTIONS ]</h2>
                {loading ? (
                  <div className="flex justify-center items-center py-4">
                    <svg
                      className="w-6 h-6 animate-spin text-[#1652F0]"
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
                    <span className={`${themeClasses.secondaryText} ml-2`}>Loading...</span>
                  </div>
                ) : error ? (
                  <p className={`${themeClasses.errorText} text-center py-4`}>{error}</p>
                ) : recentTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {recentTransactions.map((tx, index) => (
                      <div key={index} className={`p-3 ${themeClasses.border} rounded-lg ${themeClasses.hoverBg}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <a
                              href={`/explorer/tx/${tx.hash}`}
                              className="text-[#1652F0] font-semibold hover:text-[#66B0FF]"
                            >
                              {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                            </a>
                            <p className={`${themeClasses.secondaryText} text-xs`}>{tx.timestamp}</p>
                          </div>
                          <div className="text-right">
                            <p className={`${themeClasses.text} text-sm`}>From: {tx.from.slice(0, 6)}...</p>
                            <p className={`${themeClasses.text} text-sm`}>To: {tx.to.slice(0, 6)}...</p>
                            <p className={`${themeClasses.secondaryText} text-xs`}>{tx.value} ETH</p>
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-2">
                          <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon className="w-4 h-4 text-[#1652F0] hover:text-[#66B0FF]" />
                          </a>
                          <button
                            onClick={() => copyToClipboard(tx.hash)}
                            className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full`}
                          >
                            <ClipboardIcon className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <a
                      href="/explorer/transactions"
                      className="text-[#1652F0] hover:text-[#66B0FF] text-sm block text-center mt-4"
                    >
                      View all transactions
                    </a>
                  </div>
                ) : (
                  <p className={`${themeClasses.secondaryText} text-center py-4`}>No transactions found</p>
                )}
              </div>

              {/* Top Whale Transactions */}
              <div className={`${themeClasses.containerBg} ${themeClasses.border} rounded-lg p-4 ${themeClasses.shadow}`}>
                <h2 className="text-lg font-semibold text-[#1652F0] mb-4">[ TOP WHALE TRANSACTIONS ]</h2>
                {loading ? (
                  <div className="flex justify-center items-center py-4">
                    <svg
                      className="w-6 h-6 animate-spin text-[#1652F0]"
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
                    <span className={`${themeClasses.secondaryText} ml-2`}>Loading...</span>
                  </div>
                ) : error ? (
                  <p className={`${themeClasses.errorText} text-center py-4`}>{error}</p>
                ) : whaleTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {whaleTransactions.map((tx, index) => (
                      <div key={index} className={`p-3 ${themeClasses.border} rounded-lg ${themeClasses.hoverBg}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <a
                              href={`/explorer/tx/${tx.hash}`}
                              className="text-[#1652F0] font-semibold hover:text-[#66B0FF]"
                            >
                              {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                            </a>
                            <p className={`${themeClasses.secondaryText} text-xs`}>{tx.timestamp}</p>
                          </div>
                          <div className="text-right">
                            <p className={`${themeClasses.text} text-sm`}>From: {tx.from.slice(0, 6)}...</p>
                            <p className={`${themeClasses.text} text-sm`}>To: {tx.to.slice(0, 6)}...</p>
                            <p className={`${themeClasses.secondaryText} text-xs`}>{tx.value} ETH</p>
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-2">
                          <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon className="w-4 h-4 text-[#1652F0] hover:text-[#66B0FF]" />
                          </a>
                          <button
                            onClick={() => copyToClipboard(tx.hash)}
                            className={`p-1 ${themeClasses.buttonBg} ${themeClasses.buttonHover} rounded-full`}
                          >
                            <ClipboardIcon className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <a
                      href="/explorer/whale-transactions"
                      className="text-[#1652F0] hover:text-[#66B0FF] text-sm block text-center mt-4"
                    >
                      View all whale transactions
                    </a>
                  </div>
                ) : (
                  <p className={`${themeClasses.secondaryText} text-center py-4`}>No whale transactions found</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={`py-6 ${themeClasses.headerBg} ${themeClasses.text}`}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* CypherScan */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">[ CYPHERSCAN ]</h3>
              <p className={`text-sm ${themeClasses.secondaryText}`}>Unveil the Base blockchain</p>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">[ COMPANY ]</h3>
              <ul className="space-y-2">
                <li>
                  <a href="/about" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
                    About Us
                  </a>
                </li>
                <li>
                  <a href="/contact" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">[ RESOURCES ]</h3>
              <ul className="space-y-2">
                <li>
                  <a href="/api" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
                    API
                  </a>
                </li>
                <li>
                  <a href="/status" className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}>
                    Network Status
                  </a>
                </li>
              </ul>
            </div>

            {/* Community */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">[ COMMUNITY ]</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://discord.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}
                  >
                    Discord
                  </a>
                </li>
                <li>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-sm ${themeClasses.text} hover:text-[#66B0FF]`}
                  >
                    Twitter
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 text-center">
            <p className={`text-sm ${themeClasses.secondaryText}`}>
              Powered by Alchemy © 2025 CypherScan
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}