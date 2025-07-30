"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
interface Token {
  name: string;
  symbol: string;
  balance: string;
  contractAddress: string;
  usdValue: number;
  recentActivity: number;
  tokenType: "ERC-20";
  logo?: string;
  decimals: number;
  priceChange24h?: number;
  priceChange7d?: number;
  priceChange30d?: number;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  asset: string;
  gasUsed?: string;
  gasFeeUsd?: number;
  timestamp?: number;
  type?: string;
}

interface WalletData {
  ethBalance: number;
  ethUsdValue: number;
  totalUsdValue: number;
  tokens: Token[];
  txList: Transaction[];
  lastScannedBlock?: { number: string; timestamp: number };
  nonce?: number;
  isContract?: boolean;
  chainId?: string;
  portfolioAllocation?: { eth: number; tokens: number };
  firstTxDate?: number;
  mostActivePeriod?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCED SKELETON LOADER
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonLoader({ type }: { type: "table" | "chart" | "metric" }) {
  if (type === "table") {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <motion.div 
            key={i} 
            className="h-12 bg-gradient-to-r from-gray-800 to-gray-700 animate-pulse rounded-lg"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          />
        ))}
      </div>
    );
  }
  if (type === "chart") {
    return (
      <motion.div 
        className="h-full bg-gradient-to-br from-gray-800 to-gray-700 animate-pulse rounded-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
    );
  }
  return (
    <motion.div 
      className="flex flex-col p-4 rounded-lg bg-gradient-to-br from-gray-800 to-gray-700 animate-pulse"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="h-4 w-1/2 bg-gray-600 rounded mb-2" />
      <div className="h-6 w-3/4 bg-gray-600 rounded" />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCED TOKEN TABLE
// ─────────────────────────────────────────────────────────────────────────────
interface TokenTableProps {
  tokens: Token[];
  loading: boolean;
  searchQuery: string;
  sortBy: string;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: string) => void;
  onExportCSV: () => void;
  failedImages: Record<string, string | null>;
  onImageError: (key: string) => void;
}

function TokenTable({ 
  tokens, 
  loading, 
  searchQuery, 
  sortBy, 
  onSearchChange, 
  onSortChange, 
  onExportCSV,
  failedImages,
  onImageError
}: TokenTableProps) {
  const filteredTokens = tokens
    .filter((t) => t.tokenType === "ERC-20")
    .filter(
      (t) =>
        (t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "value-desc":
          return b.usdValue - a.usdValue;
        case "value-asc":
          return a.usdValue - b.usdValue;
        case "balance-desc":
          return parseFloat(b.balance) - parseFloat(a.balance);
        case "balance-asc":
          return parseFloat(a.balance) - parseFloat(b.balance);
        case "price-desc":
          return (b.usdValue / parseFloat(b.balance)) - (a.usdValue / parseFloat(a.balance));
        case "price-asc":
          return (a.usdValue / parseFloat(a.balance)) - (b.usdValue / parseFloat(b.balance));
        default:
          return 0;
      }
    });

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg sm:text-xl font-semibold text-blue-400 uppercase">
          Token Holdings
        </h2>
        <button
          onClick={onExportCSV}
          className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/40 rounded-md text-xs uppercase transition-all duration-200 hover:scale-105"
          title="Export token holdings to CSV"
        >
          Export CSV
        </button>
      </div>
      
      <div className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Search tokens by name or symbol…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-gray-800 text-gray-200 border border-blue-500/30 p-3 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all duration-200"
        />
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="w-full bg-gray-800 text-gray-200 border border-blue-500/30 p-3 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase transition-all duration-200"
        >
          <option value="value-desc">Value ↓</option>
          <option value="value-asc">Value ↑</option>
          <option value="price-desc">Price ↓</option>
          <option value="price-asc">Price ↑</option>
          <option value="balance-desc">Balance ↓</option>
          <option value="balance-asc">Balance ↑</option>
        </select>
      </div>
      
      {loading ? (
        <SkeletonLoader type="table" />
      ) : filteredTokens.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-blue-400 bg-gray-800">
                <th className="px-3 py-3 text-left uppercase text-xs">Asset</th>
                <th className="px-3 py-3 text-left uppercase text-xs hidden sm:table-cell">Price (USD)</th>
                <th className="px-3 py-3 text-left uppercase text-xs">Balance</th>
                <th className="px-3 py-3 text-left uppercase text-xs">Value (USD)</th>
                <th className="px-3 py-3 text-left uppercase text-xs hidden md:table-cell">24h %</th>
                <th className="px-3 py-3 text-left uppercase text-xs hidden lg:table-cell">7d %</th>
                <th className="px-3 py-3 text-left uppercase text-xs hidden xl:table-cell">30d %</th>
              </tr>
            </thead>
            <tbody>
              {filteredTokens.map((token, idx) => {
                const rawBal = parseFloat(token.balance);
                const tokenPriceUsd = rawBal > 0 ? token.usdValue / rawBal : 0;
                return (
                  <motion.tr
                    key={idx}
                    className="border-b border-blue-500/30 hover:bg-gray-800/50 transition-all duration-200"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <td className="px-3 py-3 flex items-center gap-2">
                      {token.logo && failedImages[`token-table-${token.contractAddress}`] !== null && (
                        <Image
                          src={token.logo}
                          alt={token.symbol || "Token"}
                          width={20}
                          height={20}
                          className="w-5 h-5 rounded-full"
                          onError={() => onImageError(`token-table-${token.contractAddress}`)}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{token.name}</div>
                        <div className="text-gray-400 text-xs">{token.symbol}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      {tokenPriceUsd > 0
                        ? `$${tokenPriceUsd.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                          })}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm">
                      {rawBal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className="px-3 py-3 font-medium text-sm">
                      ${token.usdValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      className={`px-3 py-3 hidden md:table-cell text-sm ${
                        token.priceChange24h! > 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {token.priceChange24h?.toFixed(2) || "—"}%
                    </td>
                    <td
                      className={`px-3 py-3 hidden lg:table-cell text-sm ${
                        token.priceChange7d! > 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {token.priceChange7d?.toFixed(2) || "—"}%
                    </td>
                    <td
                      className={`px-3 py-3 hidden xl:table-cell text-sm ${
                        token.priceChange30d! > 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {token.priceChange30d?.toFixed(2) || "—"}%
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-400 py-8">No tokens found</p>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCED TRANSACTION TABLE
// ─────────────────────────────────────────────────────────────────────────────
interface TransactionTableProps {
  transactions: Transaction[];
  loading: boolean;
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  filters: {
    asset: string;
    type: string;
    date: string;
  };
  timeZone: "local" | "utc";
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (items: number) => void;
  onFilterChange: (filter: string, value: string) => void;
  onTimeZoneChange: (tz: "local" | "utc") => void;
  onExportCSV: () => void;
}

function TransactionTable({
  transactions,
  loading,
  currentPage,
  itemsPerPage,
  totalPages,
  filters,
  timeZone,
  onPageChange,
  onItemsPerPageChange,
  onFilterChange,
  onTimeZoneChange,
  onExportCSV
}: TransactionTableProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg sm:text-xl font-semibold text-blue-400 uppercase">
          Transaction History
        </h2>
        <button
          onClick={onExportCSV}
          className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/40 rounded-md text-xs uppercase transition-all duration-200 hover:scale-105"
          title="Export transactions to CSV"
        >
          Export CSV
        </button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <select
          value={filters.asset}
          onChange={(e) => onFilterChange("asset", e.target.value)}
          className="w-full bg-gray-800 text-gray-200 border border-blue-500/30 p-3 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase transition-all duration-200"
        >
          <option value="all">All Assets</option>
          <option value="ETH">ETH</option>
        </select>
        <select
          value={filters.type}
          onChange={(e) => onFilterChange("type", e.target.value)}
          className="w-full bg-gray-800 text-gray-200 border border-blue-500/30 p-3 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase transition-all duration-200"
        >
          <option value="all">All Types</option>
          <option value="Transfer">Transfer</option>
          <option value="Swap">Swap</option>
          <option value="Contract Interaction">Contract Interaction</option>
          <option value="Unknown">Unknown</option>
        </select>
        <select
          value={filters.date}
          onChange={(e) => onFilterChange("date", e.target.value)}
          className="w-full bg-gray-800 text-gray-200 border border-blue-500/30 p-3 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase transition-all duration-200"
        >
          <option value="all">All Time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7d</option>
          <option value="30d">Last 30d</option>
        </select>
        <select
          value={timeZone}
          onChange={(e) => onTimeZoneChange(e.target.value as "local" | "utc")}
          className="w-full bg-gray-800 text-gray-200 border border-blue-500/30 p-3 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase transition-all duration-200"
        >
          <option value="local">Local Time</option>
          <option value="utc">UTC</option>
        </select>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="w-full bg-gray-800 text-gray-200 border border-blue-500/30 p-3 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 uppercase transition-all duration-200"
        >
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
        </select>
      </div>
      
      {loading ? (
        <SkeletonLoader type="table" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-blue-400 bg-gray-800">
                  <th className="px-3 py-3 text-left uppercase text-xs">Time</th>
                  <th className="px-3 py-3 text-left uppercase text-xs">From</th>
                  <th className="px-3 py-3 text-left uppercase text-xs">To</th>
                  <th className="px-3 py-3 text-left uppercase text-xs">Value</th>
                  <th className="px-3 py-3 text-left uppercase text-xs hidden sm:table-cell">Asset</th>
                  <th className="px-3 py-3 text-left uppercase text-xs hidden md:table-cell">Type</th>
                  <th className="px-3 py-3 text-left uppercase text-xs">Hash</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => (
                  <motion.tr
                    key={idx}
                    className="border-b border-blue-500/30 hover:bg-gray-800/50 transition-all duration-200"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <td className="px-3 py-3 whitespace-nowrap text-gray-400 text-xs">
                      {tx.timestamp
                        ? timeZone === "local"
                          ? new Date(tx.timestamp * 1000).toLocaleString()
                          : new Date(tx.timestamp * 1000).toUTCString()
                        : "—"}
                    </td>
                    <td className="px-3 py-3 truncate">
                      <Link
                        href={`/explorer/address/${tx.from}`}
                        className="text-blue-400 hover:text-blue-300 transition-colors text-xs"
                        title={tx.from}
                      >
                        {tx.from.slice(0, 6)}…{tx.from.slice(-4)}
                      </Link>
                    </td>
                    <td className="px-3 py-3 truncate">
                      {tx.to && tx.to !== "" ? (
                        <Link
                          href={`/explorer/address/${tx.to}`}
                          className="text-blue-400 hover:text-blue-300 transition-colors text-xs"
                          title={tx.to}
                        >
                          {tx.to.slice(0, 6)}…{tx.to.slice(-4)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap font-medium text-xs">
                      {parseFloat(tx.value).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell text-xs">
                      {tx.asset}
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell text-xs">
                      {tx.type || "Unknown"}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/explorer/hash/${tx.hash}`}
                        className="text-blue-400 hover:text-blue-300 transition-colors text-xs"
                        title="View transaction details"
                      >
                        {tx.hash.slice(0, 6)}…{tx.hash.slice(-4)}
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-4">
            <button
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 rounded-md text-sm uppercase transition-all duration-200 ${
                currentPage === 1 ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
              }`}
            >
              ← Previous
            </button>
            <span className="text-gray-200 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 rounded-md text-sm uppercase transition-all duration-200 ${
                currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
              }`}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WALLET EXPLORER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface WalletExplorerProps {
  walletData: WalletData | null;
  loading: boolean;
  error: string | null;
  activeTab: "tokens" | "transactions";
  onTabChange: (tab: "tokens" | "transactions") => void;
  onExportTokensCSV: () => void;
  onExportTransactionsCSV: () => void;
  failedImages: Record<string, string | null>;
  onImageError: (key: string) => void;
}

export default function WalletExplorer({
  walletData,
  loading,
  error,
  activeTab,
  onTabChange,
  onExportTokensCSV,
  onExportTransactionsCSV,
  failedImages,
  onImageError
}: WalletExplorerProps) {
  const [tokenSearch, setTokenSearch] = useState<string>("");
  const [tokenSort, setTokenSort] = useState<string>("value-desc");
  const [txPage, setTxPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [txFilters, setTxFilters] = useState({
    asset: "all",
    type: "all",
    date: "all"
  });
  const [timeZone, setTimeZone] = useState<"local" | "utc">("local");

  // Filter and paginate transactions
  const filteredTxList = (walletData?.txList || [])
    .filter((tx) => (txFilters.asset === "all" ? true : tx.asset === txFilters.asset))
    .filter((tx) => (txFilters.type === "all" ? true : tx.type === txFilters.type))
    .filter((tx) => {
      if (txFilters.date === "all") return true;
      if (!tx.timestamp) return false;
      const txDate = new Date(tx.timestamp * 1000);
      const now = new Date();
      if (txFilters.date === "24h") return txDate >= new Date(now.setHours(now.getHours() - 24));
      if (txFilters.date === "7d") return txDate >= new Date(now.setDate(now.getDate() - 7));
      if (txFilters.date === "30d") return txDate >= new Date(now.setDate(now.getDate() - 30));
      return true;
    });

  const paginatedTxList = filteredTxList.slice(
    (txPage - 1) * itemsPerPage,
    txPage * itemsPerPage
  );
  const totalTxPages = Math.ceil(filteredTxList.length / itemsPerPage);

  return (
    <div className="w-full flex flex-col bg-gray-950 text-gray-200">
      {/* Navigation Tabs */}
      <nav className="w-full bg-gray-900 border-t border-b border-blue-500/30">
        <div className="w-full px-4 sm:px-6">
          <ul className="grid grid-cols-2 text-center text-sm lg:text-base uppercase">
            {[
              { key: "transactions", label: "Transactions" },
              { key: "tokens", label: "Tokens" }
            ].map((tab) => (
              <li key={tab.key}>
                <button
                  onClick={() => onTabChange(tab.key as "tokens" | "transactions")}
                  className={`py-4 w-full transition-all duration-200 font-semibold ${
                    activeTab === tab.key 
                      ? "border-b-2 border-blue-400 text-blue-400" 
                      : "border-b-2 border-transparent text-gray-400 hover:text-blue-400"
                  }`}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-auto px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
            <span className="mt-4 text-gray-400 uppercase text-sm">
              Loading data…
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-red-400 text-center max-w-md">
              <p className="text-lg font-semibold mb-2">Error Loading Data</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : !walletData ? (
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-gray-400 text-center">
              No data available for this wallet address
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "transactions" && (
              <motion.section
                key="transactions"
                className="w-full"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <TransactionTable
                  transactions={paginatedTxList}
                  loading={loading}
                  currentPage={txPage}
                  itemsPerPage={itemsPerPage}
                  totalPages={totalTxPages}
                  filters={txFilters}
                  timeZone={timeZone}
                  onPageChange={setTxPage}
                  onItemsPerPageChange={setItemsPerPage}
                  onFilterChange={(filter, value) => setTxFilters(prev => ({ ...prev, [filter]: value }))}
                  onTimeZoneChange={setTimeZone}
                  onExportCSV={onExportTransactionsCSV}
                />
              </motion.section>
            )}

            {activeTab === "tokens" && (
              <motion.section
                key="tokens"
                className="w-full"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <TokenTable
                  tokens={walletData.tokens}
                  loading={loading}
                  searchQuery={tokenSearch}
                  sortBy={tokenSort}
                  onSearchChange={setTokenSearch}
                  onSortChange={setTokenSort}
                  onExportCSV={onExportTokensCSV}
                  failedImages={failedImages}
                  onImageError={onImageError}
                />
              </motion.section>
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  );
} 