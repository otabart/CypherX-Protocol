"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ClipboardIcon } from "@heroicons/react/24/outline";

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCED METRIC CARD
// ─────────────────────────────────────────────────────────────────────────────
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: "blue" | "green" | "red" | "yellow" | "purple" | "teal";
  loading?: boolean;
  tooltip?: string;
  onClick?: () => void;
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = "blue", 
  loading = false, 
  tooltip,
  onClick 
}: MetricCardProps) {
  const colorClasses = {
    blue: "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20",
    green: "border-green-500/30 bg-green-500/10 hover:bg-green-500/20",
    red: "border-red-500/30 bg-red-500/10 hover:bg-red-500/20",
    yellow: "border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20",
    purple: "border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20",
    teal: "border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20",
  };

  const Component = onClick ? motion.button : motion.div;

  return (
    <Component
      className={`flex flex-col p-4 rounded-xl border ${colorClasses[color]} shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      title={tooltip}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase">{title}</span>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      {loading ? (
        <div className="animate-pulse">
          <div className="h-6 bg-gray-600 rounded mb-1" />
          {subtitle && <div className="h-4 bg-gray-600 rounded w-3/4" />}
        </div>
      ) : (
        <>
          <span className="text-lg font-bold text-gray-200">{value}</span>
          {subtitle && <span className="mt-1 text-gray-400 text-xs">{subtitle}</span>}
        </>
      )}
    </Component>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WALLET HEADER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface WalletHeaderProps {
  walletAddress: string;
  ethPrice: number;
  ethPriceChanges: { "24h"?: number; "7d"?: number; "30d"?: number };
  onCopyAddress: () => void;
  failedImages: Record<string, string | null>;
  onImageError: (key: string) => void;
}

function WalletHeader({ 
  walletAddress, 
  ethPrice, 
  ethPriceChanges, 
  onCopyAddress, 
  failedImages, 
  onImageError 
}: WalletHeaderProps) {
  return (
    <header className="w-full border-b border-blue-500/30 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <p className="break-all text-gray-400 text-sm md:text-base font-mono">{walletAddress || "—"}</p>
            <button
              onClick={onCopyAddress}
              disabled={!walletAddress}
              className="flex items-center gap-1 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 px-2 py-1 rounded-md text-xs md:text-sm uppercase transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Copy wallet address to clipboard"
            >
              <ClipboardIcon className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-medium">Copy</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Image
            src={failedImages["eth-header"] || "https://assets.coingecko.com/coins/images/279/small/ethereum.png"}
            alt="ETH Logo"
            width={32}
            height={32}
            className="w-8 h-8"
            onError={() => onImageError("eth-header")}
            priority={true}
            aria-label="ETH Logo"
          />
          {ethPrice > 0 ? (
            <div className="flex flex-col">
              <span className="text-lg md:text-xl font-semibold">${ethPrice.toLocaleString()}</span>
              <span
                className={`text-xs ${ethPriceChanges["24h"]! > 0 ? "text-green-400" : "text-red-400"}`}
              >
                {ethPriceChanges["24h"]?.toFixed(2)}% (24h)
              </span>
            </div>
          ) : (
            <div className="animate-pulse">
              <div className="h-6 bg-gray-600 rounded mb-1" />
              <div className="h-4 bg-gray-600 rounded w-16" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN METRICS COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface WalletMetricsProps {
  walletData: WalletData | null;
  loading: boolean;
  ethPrice: number;
  ethPriceChanges: { "24h"?: number; "7d"?: number; "30d"?: number };
  onCopyAddress: () => void;
  failedImages: Record<string, string | null>;
  onImageError: (key: string) => void;
  walletAddress: string;
}

export default function WalletMetrics({
  walletData,
  loading,
  ethPrice,
  ethPriceChanges,
  onCopyAddress,
  failedImages,
  onImageError,
  walletAddress
}: WalletMetricsProps) {
  // Calculate unique counterparties
  let uniqueCounterparties = 0;
  if (walletData) {
    const addrSet = new Set<string>();
    walletData.txList.forEach((tx) => {
      addrSet.add(tx.from);
      if (tx.to && tx.to !== "") addrSet.add(tx.to);
    });
    uniqueCounterparties = addrSet.size;
  }

  const metrics = [
    {
      title: "ETH Balance",
      value: walletData ? `${walletData.ethBalance.toLocaleString(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      })} ETH` : "—",
      subtitle: walletData ? `$${walletData.ethUsdValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} USD` : "—",
      color: "blue" as const,
      tooltip: "Total ETH held in the wallet"
    },
    {
      title: "Net Worth",
      value: walletData ? `$${walletData.totalUsdValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}` : "—",
      color: "green" as const,
      tooltip: "Total value of ETH and tokens in USD"
    },
    {
      title: "Tokens",
      value: walletData ? walletData.tokens.length.toLocaleString() : "—",
      color: "purple" as const,
      tooltip: "Number of unique tokens held"
    },
    {
      title: "Transactions",
      value: walletData ? walletData.txList.length.toLocaleString() : "—",
      color: "yellow" as const,
      tooltip: "Total number of transactions"
    },
    {
      title: "Counterparties",
      value: uniqueCounterparties.toLocaleString(),
      color: "teal" as const,
      tooltip: "Number of unique addresses interacted with"
    },
    {
      title: "First Activity",
      value: walletData?.firstTxDate
        ? new Date(walletData.firstTxDate * 1000).toLocaleDateString()
        : "—",
      color: "red" as const,
      tooltip: "First transaction date"
    }
  ];

  return (
    <>
      {/* Wallet Header */}
      <WalletHeader
        walletAddress={walletAddress}
        ethPrice={ethPrice}
        ethPriceChanges={ethPriceChanges}
        onCopyAddress={onCopyAddress}
        failedImages={failedImages}
        onImageError={onImageError}
      />

      {/* Main Metrics */}
      <section className="w-full bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map((metric, idx) => (
            <MetricCard
              key={idx}
              title={metric.title}
              value={metric.value}
              subtitle={metric.subtitle}
              color={metric.color}
              loading={loading}
              tooltip={metric.tooltip}
            />
          ))}
        </div>
      </section>
    </>
  );
} 