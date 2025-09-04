import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUserFriends, FaCopy, FaTimes, FaCheck } from 'react-icons/fa';
import { useRewards } from '../hooks/useRewards';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReferralModal({ isOpen, onClose }: ReferralModalProps) {
  const { rewards, referralData, processReferral } = useRewards();
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleCopyCode = async () => {
    if (rewards?.referralCode) {
      await navigator.clipboard.writeText(rewards.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleProcessReferral = async () => {
    if (!referralCode.trim()) return;
    
    setProcessing(true);
    const result = await processReferral(referralCode.trim());
    if (result.success) {
      alert('Referral code applied successfully!');
      setReferralCode('');
      onClose();
    } else {
      alert(`Error: ${result.error}`);
    }
    setProcessing(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-200 flex items-center space-x-2">
                <FaUserFriends className="w-5 h-5 text-blue-400" />
                <span>Referral Program</span>
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors duration-200"
              >
                <FaTimes className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Referral Input */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Enter Referral Code</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="Enter referral code..."
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleProcessReferral}
                  disabled={!referralCode.trim() || processing}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all duration-200"
                >
                  {processing ? 'Processing...' : 'Apply'}
                </button>
              </div>
            </div>

            {/* Referral Statistics */}
            {referralData && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Your Referral Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center border border-gray-700/30">
                    <p className="text-2xl font-bold text-blue-400">{referralData.totalReferrals}</p>
                    <p className="text-xs text-gray-400">Total Referrals</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center border border-gray-700/30">
                    <p className="text-2xl font-bold text-green-400">{referralData.referralEarnings.toFixed(4)}</p>
                    <p className="text-xs text-gray-400">ETH Earned</p>
                  </div>
                </div>
              </div>
            )}

            {/* Share Your Code */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Share Your Referral Code</h3>
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                <p className="text-xs text-gray-400 mb-2">Earn 30% of the fees from users you refer</p>
                <div className="flex items-center justify-between">
                  <code className="bg-gray-700 px-3 py-2 rounded-lg font-mono text-blue-400 text-sm">
                    {rewards?.referralCode || 'Loading...'}
                  </code>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-200"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <FaCheck className="w-4 h-4 text-green-400" />
                    ) : (
                      <FaCopy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Referrals */}
            {referralData && referralData.referrals.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3">Recent Referrals</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {referralData.referrals.slice(0, 5).map((referral, index) => (
                    <div key={index} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-300">
                            {referral.refereeId?.slice(0, 8)}...{referral.refereeId?.slice(-6)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(referral.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-green-400">
                            +{referral.referralReward?.toFixed(6) || '0'} ETH
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-700/30">
              <button
                onClick={onClose}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
