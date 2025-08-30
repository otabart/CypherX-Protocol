"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiUsers, FiAward } from 'react-icons/fi';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/providers';

interface EventSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId?: string;
  projectName?: string;
}

const EventSubmissionModal = ({ isOpen, onClose, onSuccess, projectId, projectName }: EventSubmissionModalProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    eventType: 'general',
    link: '',
    isTokenGated: false,
    tokenRequirement: {
      contractAddress: '',
      minBalance: 0
    },
    interests: [] as string[]
  });
  const [loading, setLoading] = useState(false);

  const eventTypes = [
    { value: 'general', label: 'General', icon: FiUsers },
    { value: 'ama', label: 'AMA', icon: FiUsers },
    { value: 'launch', label: 'Launch', icon: FiAward },
    { value: 'governance', label: 'Governance', icon: FiUsers },
    { value: 'workshop', label: 'Workshop', icon: FiUsers },
    { value: 'meetup', label: 'Meetup', icon: FiUsers }
  ];

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const eventData = {
        projectId: projectId || user.uid,
        projectName: projectName || 'Personal Event',
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        createdBy: user.uid,
        eventType: formData.eventType,
        link: formData.link,
        status: 'pending',
        isTokenGated: formData.isTokenGated,
        tokenRequirement: formData.isTokenGated ? formData.tokenRequirement : null,
        votes: 0,
        requiredVotes: 10,
        interests: formData.interests,
        reactions: {
          likes: [],
          dislikes: [],
          comments: [],
          views: [],
          rsvps: [],
          pinned: []
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'projectEvents'), eventData);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error submitting event:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addInterest = (interest: string) => {
    if (interest && !formData.interests.includes(interest)) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, interest]
      }));
    }
  };

  const removeInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

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
                  <h2 className="text-2xl font-bold text-white mb-2">Submit Event</h2>
                  <p className="text-gray-300 text-sm">
                    Create a new event for the community to vote on
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-800/50 rounded-lg transition-all duration-200 group"
                >
                  <FiX className="w-6 h-6 text-gray-400 group-hover:text-white" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Event Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateFormData('title', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter event title..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Describe your event..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => updateFormData('date', e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Time</label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => updateFormData('time', e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    />
                  </div>
                </div>

                                 <div>
                   <label className="block text-sm font-medium text-gray-300 mb-2">Event Type</label>
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                     {eventTypes.map((type) => {
                       const Icon = type.icon;
                       return (
                         <button
                           key={type.value}
                           onClick={() => updateFormData('eventType', type.value)}
                           className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                             formData.eventType === type.value
                               ? 'bg-gradient-to-br from-blue-600/20 to-blue-800/10 border-blue-500/50 text-blue-300 shadow-lg shadow-blue-500/10'
                               : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800/70'
                           }`}
                         >
                           <div className="flex items-center gap-2">
                             <div className={`w-6 h-6 rounded flex items-center justify-center ${
                               formData.eventType === type.value ? 'bg-blue-600/30' : 'bg-gray-700'
                             }`}>
                               <Icon className="w-3 h-3" />
                             </div>
                             <span className="text-sm font-medium">{type.label}</span>
                           </div>
                         </button>
                       );
                     })}
                   </div>
                 </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Event Link (Optional)</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => updateFormData('link', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Interests</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.interests.map((interest) => (
                      <span
                        key={interest}
                        className="px-3 py-1 bg-blue-600/20 text-blue-300 text-sm rounded-full border border-blue-500/30 flex items-center gap-1"
                      >
                        {interest}
                        <button
                          onClick={() => removeInterest(interest)}
                          className="hover:text-red-400"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add interest..."
                      className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          addInterest(input.value);
                          input.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="Add interest..."]') as HTMLInputElement;
                        if (input && input.value) {
                          addInterest(input.value);
                          input.value = '';
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="tokenGated"
                    checked={formData.isTokenGated}
                    onChange={(e) => updateFormData('isTokenGated', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-700 rounded focus:ring-blue-500/50"
                  />
                  <label htmlFor="tokenGated" className="text-sm text-gray-300">
                    Token-gated event (require specific token balance)
                  </label>
                </div>

                {formData.isTokenGated && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Token Contract Address</label>
                      <input
                        type="text"
                        value={formData.tokenRequirement.contractAddress}
                        onChange={(e) => updateFormData('tokenRequirement', {
                          ...formData.tokenRequirement,
                          contractAddress: e.target.value
                        })}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                        placeholder="0x..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Balance</label>
                      <input
                        type="number"
                        value={formData.tokenRequirement.minBalance}
                        onChange={(e) => updateFormData('tokenRequirement', {
                          ...formData.tokenRequirement,
                          minBalance: parseFloat(e.target.value) || 0
                        })}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
              </div>

                             {/* Submit Button */}
               <div className="flex gap-3 mt-8">
                 <button
                   onClick={onClose}
                   className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 font-medium"
                 >
                   Cancel
                 </button>
                 <button
                   onClick={handleSubmit}
                   disabled={loading || !formData.title || !formData.description || !formData.date}
                   className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 ml-auto font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {loading ? 'Submitting...' : 'Submit Event'}
                 </button>
               </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EventSubmissionModal;
