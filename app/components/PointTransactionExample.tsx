'use client';

import React from 'react';
import { usePointTransaction } from '@/app/hooks/usePointTransaction';
import PointTransactionModal from './PointTransactionModal';

// Example component showing how to use the point transaction modal
export default function PointTransactionExample() {
  const {
    showTransactionModal,
    setShowTransactionModal,
    executeTransaction,
    transaction,
    userPoints,
    walletAddress,
    onConfirm
  } = usePointTransaction();

  const handleAlphaBoost = () => {
    executeTransaction({
      action: 'alpha_boost',
      points: 25,
      description: 'Apply Alpha Boost to article (1.5x multiplier)',
      metadata: {
        articleId: 'example-article',
        multiplier: 1.5
      }
    }, () => {
      // This callback runs after successful transaction
      console.log('Alpha boost applied successfully!');
      // You can add your API call here
    });
  };

  const handlePostArticle = () => {
    executeTransaction({
      action: 'post_article',
      points: 50,
      description: 'Publish new article',
      metadata: {
        title: 'Example Article',
        category: 'crypto'
      }
    }, () => {
      console.log('Article posted successfully!');
    });
  };

  const handleComment = () => {
    executeTransaction({
      action: 'comment',
      points: 10,
      description: 'Add comment to article',
      metadata: {
        articleId: 'example-article',
        commentText: 'Great article!'
      }
    }, () => {
      console.log('Comment added successfully!');
    });
  };

  return (
    <div className="space-y-4 p-6 bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-4">
        Point Transaction Examples
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleAlphaBoost}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
        >
          Alpha Boost (25 pts)
        </button>
        
        <button
          onClick={handlePostArticle}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
        >
          Post Article (50 pts)
        </button>
        
        <button
          onClick={handleComment}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
        >
          Add Comment (10 pts)
        </button>
      </div>

      {/* Transaction Modal */}
      {transaction && (
        <PointTransactionModal
          isOpen={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          onConfirm={onConfirm}
          transaction={transaction}
          userPoints={userPoints}
          walletAddress={walletAddress}
        />
      )}
    </div>
  );
}
