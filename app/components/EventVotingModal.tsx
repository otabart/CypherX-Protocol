"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiThumbsUp, FiThumbsDown, FiUsers, FiClock, FiCheckCircle } from 'react-icons/fi';
import { doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/providers';

interface EventVotingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event: any;
  userProfile: any;
}

const EventVotingModal = ({ isOpen, onClose, onSuccess, event, userProfile }: EventVotingModalProps) => {
  const { user } = useAuth();
  const [vote, setVote] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVote = async () => {
    if (!user || !vote || !event) return;
    
    setLoading(true);
    try {
      const eventRef = doc(db, 'projectEvents', event.id);
      const userRef = doc(db, 'users', user.uid);
      
      // Update event votes
      await updateDoc(eventRef, {
        votes: increment(vote === 'approve' ? 1 : -1),
        [`reactions.${vote === 'approve' ? 'likes' : 'dislikes'}`]: arrayUnion(user.uid),
        updatedAt: new Date()
      });

      // Update user voting history
      await updateDoc(userRef, {
        [`votingHistory.${event.id}`]: {
          vote,
          reason,
          timestamp: new Date(),
          eventTitle: event.title
        },
        reputation: {
          ...userProfile.reputation,
          totalScore: increment(vote === 'approve' ? 5 : 2)
        }
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error voting on event:', error);
    } finally {
      setLoading(false);
    }
  };

  const canVote = userProfile?.reputation?.canVoteOnEvents && 
                  userProfile?.reputation?.votingPower > 0 &&
                  !userProfile?.votingHistory?.[event?.id];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-gray-900/95 backdrop-blur-sm rounded-2xl border border-gray-700/50 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Vote on Event</h2>
                  <p className="text-gray-300 text-sm">
                    Help the community decide on this event
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-800/50 rounded-lg transition-all duration-200 group"
                >
                  <FiX className="w-6 h-6 text-gray-400 group-hover:text-white" />
                </button>
              </div>

              {/* Event Preview */}
              <div className="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700/30">
                <h3 className="text-lg font-semibold text-white mb-2">{event?.title}</h3>
                <p className="text-gray-300 text-sm mb-3 line-clamp-2">{event?.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <FiClock className="w-4 h-4" />
                    <span>{event?.date} at {event?.time}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FiUsers className="w-4 h-4" />
                    <span>{event?.projectName}</span>
                  </div>
                </div>
              </div>

              {/* Voting Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FiThumbsUp className="w-5 h-5 text-blue-400" />
                    <span className="text-blue-300 font-medium">Approval Votes</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-300">
                    {event?.reactions?.likes?.length || 0}
                  </div>
                </div>
                <div className="bg-red-600/10 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FiThumbsDown className="w-5 h-5 text-red-400" />
                    <span className="text-red-300 font-medium">Rejection Votes</span>
                  </div>
                  <div className="text-2xl font-bold text-red-300">
                    {event?.reactions?.dislikes?.length || 0}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Progress to Approval</span>
                  <span>{event?.votes || 0} / {event?.requiredVotes || 10}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(((event?.votes || 0) / (event?.requiredVotes || 10)) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
              </div>

              {/* User Voting Power */}
              <div className="bg-gray-800/30 rounded-lg p-4 mb-6 border border-gray-700/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">Your Voting Power</h4>
                    <p className="text-gray-400 text-sm">Based on your reputation and engagement</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">
                      {userProfile?.reputation?.votingPower || 0}
                    </div>
                    <div className="text-xs text-gray-500">Vote Weight</div>
                  </div>
                </div>
              </div>

              {/* Voting Options */}
              {canVote ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setVote('approve')}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        vote === 'approve'
                          ? 'bg-gradient-to-br from-green-600/20 to-green-800/10 border-green-500/50 text-green-300 shadow-lg shadow-green-500/10'
                          : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          vote === 'approve' ? 'bg-gradient-to-br from-green-600 to-green-700 shadow-lg' : 'bg-gray-700'
                        }`}>
                          <FiThumbsUp className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold">Approve</h3>
                      </div>
                      <p className="text-sm opacity-75">
                        This event should be approved and featured
                      </p>
                    </button>

                    <button
                      onClick={() => setVote('reject')}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        vote === 'reject'
                          ? 'bg-gradient-to-br from-red-600/20 to-red-800/10 border-red-500/50 text-red-300 shadow-lg shadow-red-500/10'
                          : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          vote === 'reject' ? 'bg-gradient-to-br from-red-600 to-red-700 shadow-lg' : 'bg-gray-700'
                        }`}>
                          <FiThumbsDown className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold">Reject</h3>
                      </div>
                      <p className="text-sm opacity-75">
                        This event should not be approved
                      </p>
                    </button>
                  </div>

                  {/* Reason Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Reason for your vote (optional)
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 placeholder-gray-500"
                      placeholder="Explain your reasoning..."
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FiCheckCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">
                    {userProfile?.votingHistory?.[event?.id] ? 'Already Voted' : 'Cannot Vote'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {userProfile?.votingHistory?.[event?.id] 
                      ? 'You have already voted on this event'
                      : 'You need more reputation or voting power to vote on events'
                    }
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                {canVote && (
                                     <button
                     onClick={handleVote}
                     disabled={loading || !vote}
                     className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 ml-auto font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {loading ? 'Submitting Vote...' : 'Submit Vote'}
                   </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EventVotingModal;
