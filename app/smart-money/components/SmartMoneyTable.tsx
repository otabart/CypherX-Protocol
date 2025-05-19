import React, { useState } from 'react';
import type { TokenHolder } from '../types';
import { formatBalance, formatAddress } from '../utils/format';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid';

interface Props {
  holders: TokenHolder[];
  onWalletClick: (walletAddress: string) => void;
}

const SmartMoneyTable: React.FC<Props> = ({ holders, onWalletClick }) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortField, setSortField] = useState<'balance' | 'percentage'>('balance');

  const sortedHolders = [...holders].sort((a, b) => {
    const aValue = parseFloat(sortField === 'balance' ? a.balance : a.percentage);
    const bValue = parseFloat(sortField === 'balance' ? b.balance : b.percentage);
    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const handleSort = (field: 'balance' | 'percentage') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  if (!holders || holders.length === 0) {
    return (
      <div className="text-gray-400 text-center py-4 bg-gray-900 rounded-lg border border-blue-500/30">
        No smart holders data available. Try refreshing or selecting a different token.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-900">
            <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Rank</th>
            <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Wallet Address</th>
            <th
              className="p-3 text-gray-400 font-semibold text-sm uppercase cursor-pointer flex items-center"
              onClick={() => handleSort('balance')}
            >
              Balance
              {sortField === 'balance' && (
                sortOrder === 'asc' ? (
                  <ArrowUpIcon className="w-4 h-4 ml-1" />
                ) : (
                  <ArrowDownIcon className="w-4 h-4 ml-1" />
                )
              )}
            </th>
            <th
              className="p-3 text-gray-400 font-semibold text-sm uppercase cursor-pointer flex items-center"
              onClick={() => handleSort('percentage')}
            >
              % Owned
              {sortField === 'percentage' && (
                sortOrder === 'asc' ? (
                  <ArrowUpIcon className="w-4 h-4 ml-1" />
                ) : (
                  <ArrowDownIcon className="w-4 h-4 ml-1" />
                )
              )}
            </th>
            <th className="p-3 text-gray-400 font-semibold text-sm uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedHolders.map((holder, index) => (
            <tr
              key={holder.address}
              className="border-b border-gray-800 hover:bg-blue-500/10 transition-colors duration-150"
            >
              <td className="p-3 text-gray-200 text-sm">{index + 1}</td>
              <td className="p-3 text-gray-200 font-mono text-sm relative group">
                <span>{formatAddress(holder.address)}</span>
                <div className="absolute hidden group-hover:block bg-gray-900 text-gray-200 text-xs p-2 rounded-lg -mt-10 z-10 border border-blue-500/30">
                  {holder.address}
                </div>
              </td>
              <td className="p-3 text-gray-200 text-sm">
                {formatBalance(holder.balance)} Tokens
              </td>
              <td className="p-3 text-gray-200 text-sm">
                {holder.percentage}%
              </td>
              <td className="p-3">
                <button
                  className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-200 text-sm uppercase"
                  onClick={() => onWalletClick(holder.address)}
                >
                  View Transactions
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SmartMoneyTable;