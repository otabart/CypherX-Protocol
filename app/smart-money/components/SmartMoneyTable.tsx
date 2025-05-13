import React, { useState } from 'react';
import type { TokenHolder } from '../types';
import { formatBalance, formatAddress } from '../utils/format'; // Import utilities
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid';

interface Props {
  holders: TokenHolder[];
  onWalletClick: (walletAddress: string) => void;
}

const SmartMoneyTable: React.FC<Props> = ({ holders, onWalletClick }) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortField, setSortField] = useState<'balance'>('balance');

  const sortedHolders = [...holders].sort((a, b) => {
    const aValue = parseFloat(formatBalance(a[sortField]));
    const bValue = parseFloat(formatBalance(b[sortField]));
    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const handleSort = (field: 'balance') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  if (!holders || holders.length === 0) {
    return (
      <div className="text-gray-400 text-center py-4 bg-gray-800 rounded-lg shadow-lg">
        No holders data available. Try refreshing or selecting a different token.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-700">
            <th className="p-4 text-gray-200 font-semibold">Rank</th>
            <th className="p-4 text-gray-200 font-semibold">Wallet Address</th>
            <th
              className="p-4 text-gray-200 font-semibold cursor-pointer flex items-center"
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
            <th className="p-4 text-gray-200 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedHolders.map((holder, index) => (
            <tr
              key={holder.address}
              className="border-b border-gray-700 hover:bg-gray-600 transition-colors duration-150"
            >
              <td className="p-4 text-gray-300">{index + 1}</td>
              <td className="p-4 text-gray-300 font-mono text-sm relative group">
                <span>{formatAddress(holder.address)}</span>
                <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs p-2 rounded-lg -mt-10">
                  {holder.address}
                </div>
              </td>
              <td className="p-4 text-gray-300">
                {formatBalance(holder.balance)} Tokens
              </td>
              <td className="p-4">
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200"
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