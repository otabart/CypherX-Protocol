'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PointTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  transaction: {
    action: string;
    points: number;
    description: string;
    metadata?: any;
  };
  userPoints: number;
  walletAddress?: string;
}

const PointTransactionModal: React.FC<PointTransactionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transaction,
  userPoints,
  walletAddress
}) => {
  const [isSigning, setIsSigning] = useState(false);
  const [signatureProgress, setSignatureProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsSigning(false);
      setSignatureProgress(0);
      setShowSuccess(false);
      setHasConfirmed(false);
    }
  }, [isOpen]);

  // Simulate signature progress
  useEffect(() => {
    if (isSigning) {
      const interval = setInterval(() => {
        setSignatureProgress(prev => {
                  if (prev >= 100) {
          clearInterval(interval);
          setShowSuccess(true);
          if (!hasConfirmed) {
            setHasConfirmed(true);
            setTimeout(() => {
              onConfirm();
              onClose();
            }, 2000);
          }
          return 100;
        }
          return prev + 5;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isSigning, onConfirm, onClose, hasConfirmed]);

  const handleConfirm = () => {
    if (isSigning || hasConfirmed) return; // Prevent multiple confirmations
    setIsSigning(true);
  };



  const getActionIcon = (action: string) => {
    switch (action) {
      case 'alpha_boost':
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'post_comment':
        return (
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'submit_token':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        );
      case 'index_vote':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        );
    }
  };

  const formatActionName = (action: string) => {
    return action.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Get author name from metadata or use default
  const getAuthorName = () => {
    if (!transaction?.metadata) return 'CypherX Points';
    
    if (transaction.metadata.authorName) {
      return transaction.metadata.authorName;
    }
    if (transaction.metadata.articleSlug) {
      // Extract author from article slug or use a default
      return 'Article Author';
    }
    return 'CypherX Points';
  };

  if (!isOpen || !transaction) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="absolute top-20 right-4 w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Point Transaction Style */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Confirm Point Transaction</h3>
                  <p className="text-xs text-gray-400">CypherX Points Network</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="p-4 space-y-4">
            {/* From/To Addresses */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <span className="text-xs text-gray-400 block mb-1">From</span>
                <span className="text-xs text-white font-mono">
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Unknown'}
                </span>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <span className="text-xs text-gray-400 block mb-1">To</span>
                <span className="text-xs text-white font-mono">{getAuthorName()}</span>
              </div>
            </div>

            {/* Transaction Data */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                {getActionIcon(transaction.action || 'default')}
                <span className="text-sm font-medium text-white">{formatActionName(transaction.action || 'default')}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{transaction.description || 'Transaction'}</p>
              <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">Points to Spend</span>
                  <span className="text-sm font-bold text-red-400">-{transaction.points}</span>
                </div>
              </div>
            </div>

            {/* Balance Changes */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Current Balance</span>
                  <span className="text-xs text-green-400 font-mono">{userPoints || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">New Balance</span>
                  <span className="text-xs text-green-400 font-mono">{(userPoints || 0) - (transaction.points || 0)}</span>
                </div>
              </div>
            </div>

            {/* Signature Progress */}
            {isSigning && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-300">Processing Transaction</span>
                  <span className="text-xs text-blue-400">{signatureProgress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <motion.div
                    className="bg-blue-500 h-1.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${signatureProgress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {signatureProgress < 30 && "Preparing transaction..."}
                  {signatureProgress >= 30 && signatureProgress < 60 && "Processing payment..."}
                  {signatureProgress >= 60 && signatureProgress < 90 && "Updating balances..."}
                  {signatureProgress >= 90 && "Confirming transaction..."}
                </div>
              </div>
            )}

            {/* Success Message */}
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center"
              >
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-green-400 font-medium">Transaction Confirmed!</p>
                <p className="text-xs text-gray-400 mt-1">Points have been deducted from your balance.</p>
              </motion.div>
            )}

            {/* Action Buttons */}
            {!isSigning && !showSuccess && (
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={(userPoints || 0) < (transaction.points || 0)}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {(userPoints || 0) < (transaction.points || 0) ? 'Insufficient Points' : 'Confirm Transaction'}
                </button>
              </div>
            )}

            {/* Warning for insufficient points */}
            {(userPoints || 0) < (transaction.points || 0) && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-xs text-red-400 text-center">
                  You need {(transaction.points || 0) - (userPoints || 0)} more points to complete this transaction.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PointTransactionModal;
