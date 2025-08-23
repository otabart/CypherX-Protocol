"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import PointTransactionModal from "./PointTransactionModal";

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

// Available indexes
const AVAILABLE_INDEXES = [
  { name: 'CDEX', label: 'CDEX Index' },
  { name: 'BDEX', label: 'BDEX Index' },
  { name: 'VDEX', label: 'VDEX Index' },
  { name: 'AIDEX', label: 'AIDEX Index' },
];

interface NewTokenData {
  address: string;
  symbol: string;
  weight: number;
  dexScreenerData?: any;
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
  const [newTokens, setNewTokens] = useState<{[key: string]: NewTokenData}>({});
  const [dexScreenerLoading, setDexScreenerLoading] = useState<{[key: string]: boolean}>({});
  const [fetchedTokens, setFetchedTokens] = useState<Array<{
    id: string;
    symbol: string;
    address: string;
    weight: number;
  }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(indexName);
  
  // Point transaction modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [pendingVotes, setPendingVotes] = useState<any[]>([]);
  const [userPoints, setUserPoints] = useState<number>(0);

  // Fetch user points on component mount
  useEffect(() => {
    const fetchUserPoints = async () => {
      if (!walletAddress) return;
      
      try {
        const response = await fetch(`/api/user/stats?walletAddress=${walletAddress}`);
        if (response.ok) {
          const data = await response.json();
          setUserPoints(data.points || 0);
        }
      } catch (error) {
        console.error('Error fetching user points:', error);
      }
    };

    fetchUserPoints();
  }, [walletAddress]);

  // Fetch voting data
  useEffect(() => {
    if (isOpen && walletAddress) {
      fetchVotingData();
    }
  }, [isOpen, walletAddress, selectedIndex]);

  const fetchVotingData = useCallback(async () => {
    try {
      const response = await fetch(`/api/indexes/voting?walletAddress=${walletAddress}&indexName=${selectedIndex}`);
      if (response.ok) {
        const data = await response.json();
        setVotingData(data);
      }
    } catch (error) {
      console.error('Error fetching voting data:', error);
    }
  }, [walletAddress, selectedIndex]);

  const fetchIndexTokens = useCallback(async () => {
    try {
      const indexRef = collection(db, selectedIndex);
      const querySnapshot = await getDocs(indexRef);
      
      if (querySnapshot.empty) {
        console.warn(`${selectedIndex} collection is empty or does not exist.`);
        return;
      }

      const tokens: Array<{
        id: string;
        symbol: string;
        address: string;
        weight: number;
      }> = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const id = doc.id;
        const symbol = data.symbol || data.baseToken?.symbol || data.name || data.baseToken?.name || `Token-${id.slice(0, 4)}`;
        const address = data.address || "";
        const weight = parseFloat(data.weight) || 0;

        if (address) {
          tokens.push({ id, symbol, address, weight });
        }
      });

      const sortedTokens = tokens.sort((a, b) => b.weight - a.weight).slice(0, 10);
      setFetchedTokens(sortedTokens);
    } catch (error) {
      console.error('Error fetching index tokens:', error);
    }
  }, [selectedIndex]);

  // Fetch index tokens if not provided
  useEffect(() => {
    if (isOpen && currentTokens.length === 0) {
      fetchIndexTokens();
    }
  }, [isOpen, currentTokens.length, fetchIndexTokens]);

  // Initialize token votes when component mounts
  useEffect(() => {
    const tokensToUse = currentTokens.length > 0 ? currentTokens : fetchedTokens;
    if (tokensToUse.length > 0) {
      const initialVotes: {[key: string]: 'keep' | 'remove' | 'weight_change'} = {};
      const initialWeights: {[key: string]: number} = {};
      
      tokensToUse.forEach(token => {
        // Don't pre-select any votes - start with empty state
        initialWeights[token.address] = token.weight;
      });
      
      console.log('Initializing votes:', { tokens: tokensToUse.length, initialVotes: Object.keys(initialVotes).length });
      setTokenVotes(initialVotes);
      setTokenWeights(initialWeights);
    }
  }, [currentTokens, fetchedTokens]);

  const handleTokenVote = (tokenAddress: string, action: 'keep' | 'remove' | 'weight_change') => {
    setTokenVotes(prev => ({
      ...prev,
      [tokenAddress]: action
    }));
  };

  const handleIndexChange = (newIndex: string) => {
    setSelectedIndex(newIndex);
    // Reset all state when switching indexes
    setTokenVotes({});
    setTokenWeights({});
    setNewTokens({});
    setFetchedTokens([]);
    setVotingData(null);
  };

  const handleWeightChange = (tokenAddress: string, weight: number) => {
    // Ensure weight is between 0 and 100
    const clampedWeight = Math.max(0, Math.min(100, weight));
    
    setTokenWeights(prev => ({
      ...prev,
      [tokenAddress]: clampedWeight
    }));
  };

  const fetchDexScreenerData = async (tokenAddress: string, originalTokenAddress: string) => {
    if (!tokenAddress || tokenAddress.length < 42) return; // Basic validation
    
    setDexScreenerLoading(prev => ({ ...prev, [originalTokenAddress]: true }));
    
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0]; // Get the first pair
        const tokenData = {
          address: tokenAddress,
          symbol: pair.baseToken.symbol || 'Unknown',
          weight: newTokens[originalTokenAddress]?.weight || 0,
          dexScreenerData: {
            priceUsd: pair.priceUsd,
            priceChange24h: pair.priceChange?.h24,
            volume24h: pair.volume?.h24,
            liquidity: pair.liquidity?.usd,
            marketCap: pair.marketCap,
            fdv: pair.fdv
          }
        };
        
        setNewTokens(prev => ({
          ...prev,
          [originalTokenAddress]: tokenData
        }));
      }
    } catch (error) {
      console.error('Error fetching DexScreener data:', error);
      toast.error('Failed to fetch token data from DexScreener');
    } finally {
      setDexScreenerLoading(prev => ({ ...prev, [originalTokenAddress]: false }));
    }
  };

  const handleNewTokenAddressChange = (originalTokenAddress: string, newAddress: string) => {
    setNewTokens(prev => ({
      ...prev,
      [originalTokenAddress]: {
        ...prev[originalTokenAddress],
        address: newAddress
      }
    }));
    
    // Auto-fetch DexScreener data when address is entered
    if (newAddress && newAddress.length >= 42) {
      fetchDexScreenerData(newAddress, originalTokenAddress);
    }
  };

  const handleNewTokenWeightChange = (originalTokenAddress: string, weight: number) => {
    const clampedWeight = Math.max(0, Math.min(100, weight));
    
    setNewTokens(prev => ({
      ...prev,
      [originalTokenAddress]: {
        ...prev[originalTokenAddress],
        weight: clampedWeight
      }
    }));
  };

  // Calculate total weight for validation
  const calculateTotalWeight = () => {
    const weightChangeTokens = currentTokens.filter(token => tokenVotes[token.address] === 'weight_change');
    const totalWeightChange = weightChangeTokens.reduce((sum, token) => {
      return sum + (tokenWeights[token.address] || 0);
    }, 0);
    
    // Add weights of tokens that are being kept (not changed)
    const keptTokens = currentTokens.filter(token => tokenVotes[token.address] === 'keep');
    const totalKeptWeight = keptTokens.reduce((sum, token) => {
      return sum + (token.weight || 0);
    }, 0);
    
    // Add weights of new tokens being added (replacements)
    const removedTokens = currentTokens.filter(token => tokenVotes[token.address] === 'remove');
    const totalNewTokenWeight = removedTokens.reduce((sum, token) => {
      return sum + (newTokens[token.address]?.weight || 0);
    }, 0);
    
    return totalWeightChange + totalKeptWeight + totalNewTokenWeight;
  };

  const totalWeight = calculateTotalWeight();
  const isWeightValid = totalWeight <= 100;

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

    // Check if all removed tokens have new token data
    const removedTokens = currentTokens.filter(token => tokenVotes[token.address] === 'remove');
    const missingNewTokenData = removedTokens.filter(token => !newTokens[token.address] || !newTokens[token.address].address);
    
    if (missingNewTokenData.length > 0) {
      toast.error('Please provide new token details for all removed tokens');
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

    // Validate total weight doesn't exceed 100%
    if (!isWeightValid) {
      toast.error(`Total weight (${totalWeight.toFixed(1)}%) exceeds 100%. Please adjust your weight changes.`);
      return;
    }

    // Check if voting is active
    if (votingData && !votingData.isActive) {
      toast.error('Voting is currently closed. Please wait for the next voting period.');
      return;
    }

    // Prepare batch vote data
    const tokensToUse = currentTokens.length > 0 ? currentTokens : fetchedTokens;
    const votes = tokensToUse.map(token => {
      const action = tokenVotes[token.address];
      return {
        tokenAddress: token.address,
        action: action === 'keep' ? 'add' : action === 'remove' ? 'remove' : 'weight_change',
        weight: action === 'weight_change' ? tokenWeights[token.address] : undefined,
      };
    });

    // Add new token data for removed tokens
    const newTokenVotes = removedTokens.map(token => {
      const newToken = newTokens[token.address];
      return {
        tokenAddress: newToken.address,
        action: 'add',
        weight: newToken.weight,
        dexScreenerData: newToken.dexScreenerData,
        replacingToken: token.address
      };
    });

    // Combine all votes
    const allVotes = [...votes, ...newTokenVotes];

    // Set pending votes and show transaction modal
    setPendingVotes(allVotes);
    setShowTransactionModal(true);
  };

  const handleConfirmVoteTransaction = async () => {
    if (!walletAddress || !pendingVotes.length) return;

    setLoading(true);
    try {
      // Show submission confirmation
      toast.loading('Submitting your votes...', { id: 'vote-submission' });
      
      console.log('Submitting votes:', { votes: pendingVotes, totalVotes: pendingVotes.length });

      // Submit batch vote
      const response = await fetch('/api/indexes/voting/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          indexName: selectedIndex,
          votes: pendingVotes,
        }),
      });

      const result = await response.json();
      console.log('Vote submission result:', result);
      
      // Dismiss loading toast
      toast.dismiss('vote-submission');
      
      if (result.success) {
        // Show success message (points are awarded silently to profile)
        if (result.pointsEarned > 0) {
          toast.success('✅ Votes submitted successfully! Points have been added to your profile.', {
            duration: 5000,
          });
        } else {
          toast.success('✅ Votes updated successfully!', {
            duration: 3000,
          });
        }
        
        // Show a more detailed success popup
        setTimeout(() => {
          toast.success(`🎉 Voting complete! You voted on ${result.voteCount} tokens for the ${selectedIndex} index. Your votes have been recorded successfully.`, {
            duration: 6000,
          });
        }, 1000);
        
        fetchVotingData(); // Refresh voting data
        setPendingVotes([]);
        onClose();
      } else {
        // Show detailed error message
        const errorMessage = result.error || result.details || 'Failed to submit votes';
        toast.error(`❌ ${errorMessage}`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error submitting votes:', error);
      toast.dismiss('vote-submission');
      toast.error('❌ Network error. Failed to submit votes. Please check your connection and try again.', {
        duration: 5000,
      });
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


  
  // Add debugging to see if modal is being rendered
  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"
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
          >
                         {/* Header */}
             <div className="flex items-center justify-between mb-3">
               <div>
                 <h2 className="text-lg font-bold text-gray-100 mb-1">
                   Vote for {selectedIndex} Index
                 </h2>
                 <p className="text-gray-400 text-xs">
                   Help shape the future of the {selectedIndex} index
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

                         {/* Index Selector */}
             <div className="mb-3">
               <label className="block text-xs text-gray-400 mb-2">Select Index to Vote On:</label>
               <select
                 value={selectedIndex}
                 onChange={(e) => handleIndexChange(e.target.value)}
                 className="w-full p-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
               >
                 {AVAILABLE_INDEXES.map((index) => (
                   <option key={index.name} value={index.name}>
                     {index.label}
                   </option>
                 ))}
               </select>
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
             <div className="space-y-3">
               <div>
                 <h3 className="text-sm font-semibold text-gray-100 mb-2">Vote on Each Token</h3>
                 <p className="text-xs text-gray-400 mb-3">Select an action for each token in the {selectedIndex} index</p>

                                    {votingData && !votingData.isActive && (
                     <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded text-xs text-orange-400 mb-2">
                       ⏰ Voting is currently closed. This is a preview of the voting interface.
                     </div>
                   )}
                   
                                                            {/* Submission Info */}
                     <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400 mb-2">
                       💡 Every 2 weeks our indexes will be re-weighted and changed. Voters will receive points for completing the voting process.
                     </div>
                     
                     {/* Weight Validation */}
                     {Object.keys(tokenVotes).length > 0 && (
                       <div className={`p-2 border rounded text-xs mb-2 ${
                         isWeightValid 
                           ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                           : 'bg-red-500/10 border-red-500/30 text-red-400'
                       }`}>
                         {isWeightValid 
                           ? `✅ Total Weight: ${totalWeight.toFixed(1)}%` 
                           : `❌ Total Weight: ${totalWeight.toFixed(1)}% (exceeds 100%)`
                         }
                       </div>
                     )}
                  
                                     {/* Token List with Actions */}
                   <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
                    {(() => {
                      const tokensToUse = currentTokens.length > 0 ? currentTokens : fetchedTokens;
                      if (tokensToUse.length === 0) {
                        return (
                          <div key="loading" className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 text-center">
                            <p className="text-gray-400 text-sm">Loading tokens for {selectedIndex} index...</p>
                            <p className="text-gray-500 text-xs mt-1">Please wait while we fetch the data</p>
                          </div>
                        );
                      }
                      return tokensToUse.map((token) => (
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
                              type="text"
                              value={tokenWeights[token.address] || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Only allow numbers and decimal points
                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                  const numValue = parseFloat(value) || 0;
                                  handleWeightChange(token.address, numValue);
                                }
                              }}
                              onBlur={(e) => {
                                // Ensure value is within bounds when user finishes typing
                                const value = parseFloat(e.target.value) || 0;
                                const clampedValue = Math.max(0, Math.min(100, value));
                                if (value !== clampedValue) {
                                  handleWeightChange(token.address, clampedValue);
                                }
                              }}
                              placeholder="0-100"
                              className="w-20 p-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        )}

                        {/* New Token Input for Remove */}
                        {tokenVotes[token.address] === 'remove' && (
                          <div className="space-y-2 mt-2 p-2 bg-gray-700/50 rounded border border-gray-600/50">
                            <div className="text-xs text-gray-300 font-medium">Replace with new token:</div>
                            
                            {/* Token Address Input */}
                            <div className="flex items-center space-x-2">
                              <label className="text-xs text-gray-400">Address:</label>
                              <input
                                type="text"
                                value={newTokens[token.address]?.address || ''}
                                onChange={(e) => handleNewTokenAddressChange(token.address, e.target.value)}
                                placeholder="0x..."
                                className="flex-1 p-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                              />
                              {dexScreenerLoading[token.address] && (
                                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                              )}
                            </div>

                            {/* Token Symbol (auto-filled from DexScreener) */}
                            {newTokens[token.address]?.symbol && (
                              <div className="flex items-center space-x-2">
                                <label className="text-xs text-gray-400">Symbol:</label>
                                <span className="text-xs text-gray-200 font-medium">{newTokens[token.address].symbol}</span>
                              </div>
                            )}

                            {/* Token Weight Input */}
                            <div className="flex items-center space-x-2">
                              <label className="text-xs text-gray-400">Weight:</label>
                              <input
                                type="text"
                                value={newTokens[token.address]?.weight || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                    const numValue = parseFloat(value) || 0;
                                    handleNewTokenWeightChange(token.address, numValue);
                                  }
                                }}
                                onBlur={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  const clampedValue = Math.max(0, Math.min(100, value));
                                  if (value !== clampedValue) {
                                    handleNewTokenWeightChange(token.address, clampedValue);
                                  }
                                }}
                                placeholder="0-100"
                                className="w-20 p-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                              />
                              <span className="text-xs text-gray-400">%</span>
                            </div>

                            {/* DexScreener Data Display */}
                            {newTokens[token.address]?.dexScreenerData && (
                              <div className="mt-2 p-2 bg-gray-800/50 rounded border border-gray-600/50">
                                <div className="text-xs text-gray-300 font-medium mb-1">Token Data:</div>
                                <div className="grid grid-cols-2 gap-1 text-xs">
                                  <div>
                                    <span className="text-gray-400">Price:</span>
                                    <span className="text-gray-200 ml-1">${parseFloat(newTokens[token.address].dexScreenerData.priceUsd || '0').toFixed(6)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">24h:</span>
                                    <span className={`ml-1 ${parseFloat(newTokens[token.address].dexScreenerData.priceChange24h || '0') >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {parseFloat(newTokens[token.address].dexScreenerData.priceChange24h || '0').toFixed(2)}%
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">Volume:</span>
                                    <span className="text-gray-200 ml-1">${(parseFloat(newTokens[token.address].dexScreenerData.volume24h || '0') / 1000).toFixed(1)}K</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">MCap:</span>
                                    <span className="text-gray-200 ml-1">${(parseFloat(newTokens[token.address].dexScreenerData.marketCap || '0') / 1000000).toFixed(1)}M</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ));
                    })()}
                  </div>

                                     {/* Progress Indicator */}
                   <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                     <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Voting Progress</span>
                      <span className="text-xs text-gray-300">
                        {Object.keys(tokenVotes).length}/{(() => {
                          const tokensToUse = currentTokens.length > 0 ? currentTokens : fetchedTokens;
                          return tokensToUse.length;
                        })()} tokens voted
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          Object.keys(tokenVotes).length === currentTokens.length 
                            ? 'bg-green-500' 
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${(Object.keys(tokenVotes).length / (() => {
                          const tokensToUse = currentTokens.length > 0 ? currentTokens : fetchedTokens;
                          return tokensToUse.length;
                        })()) * 100}%` }}
                      />
                    </div>
                    {Object.keys(tokenVotes).length === (() => {
                      const tokensToUse = currentTokens.length > 0 ? currentTokens : fetchedTokens;
                      return tokensToUse.length;
                    })() && (() => {
                      const tokensToUse = currentTokens.length > 0 ? currentTokens : fetchedTokens;
                      return tokensToUse.length;
                    })() > 0 && (
                      <div className="mt-2 flex items-center justify-center">
                        <span className="text-xs text-green-400 font-medium flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Ready to submit!
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={submitVote}
                    disabled={loading || !isWeightValid}
                    className={`w-full p-3 text-white font-semibold rounded-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 ${
                      loading || !isWeightValid
                        ? 'bg-gray-600 cursor-not-allowed' 
                        : Object.keys(tokenVotes).length === (() => {
                          const tokensToUse = currentTokens.length > 0 ? currentTokens : fetchedTokens;
                          return tokensToUse.length;
                        })()
                        ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                    }`}
                    title={`Token votes: ${Object.keys(tokenVotes).length}, Current tokens: ${currentTokens.length}, Weight valid: ${isWeightValid}`}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting Votes...</span>
                      </>
                    ) : (
                      <>
                        <span>{Object.keys(tokenVotes).length === (() => {
                          const tokensToUse = currentTokens.length > 0 ? currentTokens : fetchedTokens;
                          return tokensToUse.length;
                        })() ? 'Submit All Votes' : 'Submit Votes'}</span>
                        <span className="text-xs opacity-75">({Object.keys(tokenVotes).length}/{(() => {
                          const tokensToUse = currentTokens.length > 0 ? currentTokens : fetchedTokens;
                          return tokensToUse.length;
                        })()})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

                         {/* Vote Statistics */}
             {votingData?.voteStats && votingData.voteStats.length > 0 && (
               <div className="mt-3">
                 <h3 className="text-sm font-semibold text-gray-100 mb-2">Vote Statistics</h3>
                                 <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
                  {votingData.voteStats
                    .filter(stat => stat.indexName === selectedIndex)
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
                <li>• Complete all votes to earn rewards</li>
                <li>• Top voted changes will be implemented in the next re-weighting</li>
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Point Transaction Modal */}
      {pendingVotes.length > 0 && (
        <PointTransactionModal
          isOpen={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          onConfirm={handleConfirmVoteTransaction}
          transaction={{
            action: 'index_vote',
            points: 25,
            description: `Submit votes for ${selectedIndex} index (${pendingVotes.length} votes)`,
            metadata: {
              indexName: selectedIndex,
              voteCount: pendingVotes.length,
              votes: pendingVotes
            }
          }}
          userPoints={userPoints}
          walletAddress={walletAddress}
        />
      )}
    </AnimatePresence>
  );
} 