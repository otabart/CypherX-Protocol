"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";

interface IndexVotingModalProps {
  isOpen: boolean;
  onClose: () => void;
  indexName: string;
  currentTokens: Array<{
    id: string;
    symbol: string;
    address: string;
    weight: number;
  }>;
}

interface VotingData {
  isActive: boolean;
  periodId: string;
  startDate: string;
  endDate: string;
  totalVotes: number;
  userVote: { indexName: string; tokenAddress: string; action: string; weight?: number; changeCount?: number } | null;
  voteStats: Array<{
    indexName: string;
    tokenAddress: string;
    action: string;
    weight: number;
    voteCount: number;
  }>;
}

export default function IndexVotingModal({ 
  isOpen, 
  onClose, 
  indexName, 
  currentTokens 
}: IndexVotingModalProps) {
  const { address: walletAddress } = useAccount();
  const [votingData, setVotingData] = useState<VotingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenVotes, setTokenVotes] = useState<{[key: string]: 'keep' | 'remove' | 'weight_change'}>({});
  const [tokenWeights, setTokenWeights] = useState<{[key: string]: number}>({});

  // Fetch voting data
  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchVotingData();
    }
  }, [isOpen, walletAddress, indexName]);

  const fetchVotingData = useCallback(async () => {
    try {
      const response = await fetch(`/api/indexes/voting?walletAddress=${walletAddress}&indexName=${indexName}`);
      if (response.ok) {
        const data = await response.json();
        setVotingData(data);
      }
    } catch (error) {
      console.error('Error fetching voting data:', error);
    }
  }, [walletAddress, indexName]);

  // Initialize token votes when component mounts
  useEffect(() => {
    if (currentTokens.length > 0) {
      const initialVotes: {[key: string]: 'keep' | 'remove' | 'weight_change'} = {};
      const initialWeights: {[key: string]: number} = {};
      
      currentTokens.forEach(token => {
        initialVotes[token.address] = 'keep';
        initialWeights[token.address] = token.weight;
      });
      
      setTokenVotes(initialVotes);
      setTokenWeights(initialWeights);
    }
  }, [currentTokens]);

  const handleTokenVote = (tokenAddress: string, action: 'keep' | 'remove' | 'weight_change') => {
    setTokenVotes(prev => ({
      ...prev,
      [tokenAddress]: action
    }));
  };

  const handleWeightChange = (tokenAddress: string, weight: number) => {
    setTokenWeights(prev => ({
      ...prev,
      [tokenAddress]: weight
    }));
  };

  const submitVote = async () => {
    if (!walletAddress) {
      toast.error('Please connect your wallet to vote');
      return;
    }

    // Check if all tokens have been voted on
    const allTokensVoted = currentTokens.every(token => tokenVotes[token.address]);
    if (!allTokensVoted) {
      toast.error('Please vote on all tokens before submitting');
      return;
    }

    // Validate weight changes
    const weightChanges = currentTokens.filter(token => tokenVotes[token.address] === 'weight_change');
    const invalidWeights = weightChanges.filter(token => 
      tokenWeights[token.address] <= 0 || tokenWeights[token.address] > 100
    );
    
    if (invalidWeights.length > 0) {
      toast.error('Please enter valid weights (1-100%) for weight changes');
      return;
    }

    setLoading(true);
    try {
      // Submit votes for each token
      const votePromises = currentTokens.map(token => {
        const action = tokenVotes[token.address];
        const weight = action === 'weight_change' ? tokenWeights[token.address] : undefined;
        
        return fetch('/api/indexes/voting', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress,
            indexName,
            tokenAddress: token.address,
            action: action === 'keep' ? 'add' : action === 'remove' ? 'remove' : 'weight_change',
            weight,
          }),
        });
      });

      const responses = await Promise.all(votePromises);
      const results = await Promise.all(responses.map(r => r.json()));
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.length - successCount;
      
      if (errorCount === 0) {
        toast.success(`Successfully voted on ${successCount} tokens!`);
        fetchVotingData(); // Refresh voting data
        onClose();
      } else {
        toast.error(`Voted on ${successCount} tokens, ${errorCount} failed`);
      }
    } catch (error) {
      console.error('Error submitting votes:', error);
      toast.error('Failed to submit votes');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTimeRemaining = () => {
    if (!votingData) return '';
    const now = new Date();
    const endDate = new Date(votingData.endDate);
    const diff = endDate.getTime() - now.getTime();
    
    if (diff <= 0) return 'Voting ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return `${days}d ${hours}h remaining`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
                     {/* Modal */}
           <motion.div
             className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-blue-500/30 p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto scrollbar-hide"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{ marginTop: '80px', marginBottom: '20px' }}
          >
                         {/* Header */}
             <div className="flex items-center justify-between mb-3">
               <div>
                 <h2 className="text-lg font-bold text-gray-100 mb-1">
                   Vote for {indexName} Index
                 </h2>
                 <p className="text-gray-400 text-xs">
                   Help shape the future of the {indexName} index
                 </p>
               </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

                         {/* Voting Status */}
             {votingData && (
               <div className="mb-3 p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      votingData.isActive 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {votingData.isActive ? 'Voting Active' : 'Voting Closed'}
                    </span>
                    <p className="text-gray-400 text-xs mt-1">
                      Period: {formatDate(votingData.startDate)} - {formatDate(votingData.endDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-400">{votingData.totalVotes}</p>
                    <p className="text-gray-400 text-xs">Total Votes</p>
                  </div>
                </div>
                {votingData.isActive && (
                  <p className="text-orange-400 text-xs mt-1 font-medium">
                    ⏰ {getTimeRemaining()}
                  </p>
                )}
              </div>
            )}

                         {/* User's Current Vote */}
             {votingData?.userVote && (
               <div className="mb-3 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20">
                 <h3 className="text-sm font-semibold text-yellow-400 mb-1">Your Current Vote</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-300 text-sm">
                      Action: <span className="text-yellow-400 capitalize">{votingData.userVote.action.replace('_', ' ')}</span>
                    </p>
                    <p className="text-gray-400 text-xs">
                      Token: {votingData.userVote.tokenAddress.slice(0, 8)}...{votingData.userVote.tokenAddress.slice(-6)}
                    </p>
                    {votingData.userVote.weight && votingData.userVote.weight > 0 && (
                      <p className="text-gray-400 text-xs">
                        Weight: {votingData.userVote.weight}%
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">
                      Changes: {votingData.userVote.changeCount}/1
                    </span>
                  </div>
                </div>
              </div>
            )}

                         {/* Token Voting Interface */}
             {votingData?.isActive && (
               <div className="space-y-3">
                 <div>
                   <h3 className="text-sm font-semibold text-gray-100 mb-2">Vote on Each Token</h3>
                   <p className="text-xs text-gray-400 mb-3">Select an action for each token in the {indexName} index</p>
                  
                                     {/* Token List with Actions */}
                   <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
                    {currentTokens.map((token) => (
                      <div key={token.address} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-200 font-medium text-sm">{token.symbol}</span>
                            <span className="text-gray-400 text-xs">({token.weight}%)</span>
                          </div>
                          <span className="text-gray-500 text-xs">{token.address.slice(0, 8)}...{token.address.slice(-6)}</span>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex space-x-2 mb-2">
                          <button
                            onClick={() => handleTokenVote(token.address, 'keep')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                              tokenVotes[token.address] === 'keep'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                          >
                            Keep
                          </button>
                          <button
                            onClick={() => handleTokenVote(token.address, 'remove')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                              tokenVotes[token.address] === 'remove'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => handleTokenVote(token.address, 'weight_change')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                              tokenVotes[token.address] === 'weight_change'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                          >
                            Change Weight
                          </button>
                        </div>
                        
                        {/* Weight Input for Weight Change */}
                        {tokenVotes[token.address] === 'weight_change' && (
                          <div className="flex items-center space-x-2">
                            <label className="text-xs text-gray-400">New Weight:</label>
                            <input
                              type="number"
                              value={tokenWeights[token.address] || token.weight}
                              onChange={(e) => handleWeightChange(token.address, parseFloat(e.target.value) || token.weight)}
                              min="1"
                              max="100"
                              step="0.1"
                              className="w-20 p-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                                     {/* Progress Indicator */}
                   <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                     <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Voting Progress</span>
                      <span className="text-xs text-gray-300">
                        {Object.keys(tokenVotes).length}/{currentTokens.length} tokens voted
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(Object.keys(tokenVotes).length / currentTokens.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={submitVote}
                    disabled={loading || Object.keys(tokenVotes).length < currentTokens.length}
                    className="w-full p-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:cursor-not-allowed text-sm"
                  >
                    {loading ? 'Submitting Votes...' : `Submit Votes (${Object.keys(tokenVotes).length}/${currentTokens.length})`}
                  </button>
                </div>
              </div>
            )}

                         {/* Vote Statistics */}
             {votingData?.voteStats && votingData.voteStats.length > 0 && (
               <div className="mt-3">
                 <h3 className="text-sm font-semibold text-gray-100 mb-2">Vote Statistics</h3>
                                 <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
                  {votingData.voteStats
                    .filter(stat => stat.indexName === indexName)
                    .map((stat, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
                        <div>
                          <p className="text-gray-300 text-xs">
                            {stat.action.replace('_', ' ')} {stat.tokenAddress.slice(0, 8)}...{stat.tokenAddress.slice(-6)}
                          </p>
                          {stat.weight > 0 && (
                            <p className="text-gray-400 text-xs">Weight: {stat.weight}%</p>
                          )}
                        </div>
                        <span className="text-blue-400 font-semibold text-xs">{stat.voteCount} votes</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

                         {/* Info Section */}
             <div className="mt-3 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
               <h3 className="text-sm font-semibold text-purple-400 mb-1">How Voting Works</h3>
              <ul className="text-xs text-gray-300 space-y-1">
                <li>• Voting periods: 1st-15th and 16th-end of month</li>
                <li>• One vote per wallet per period</li>
                <li>• You can change your vote once per period</li>
                <li>• Earn 25 points for participating in voting</li>
                <li>• Top voted changes will be implemented in the next re-weighting</li>
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 