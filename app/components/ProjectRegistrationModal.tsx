"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiUsers, FiUser, FiAward, FiCheckCircle } from 'react-icons/fi';
import { doc, setDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/providers';

interface ProjectRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ProjectRegistrationModal = ({ isOpen, onClose, onSuccess }: ProjectRegistrationModalProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [entityType, setEntityType] = useState<'project' | 'kol'>('project');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
    twitter: '',
    discord: '',
    logo: '',
    category: '',
    tags: [] as string[],
    teamMembers: [] as string[],
    requirements: {
      minReputation: 0,
      minFollowers: 0,
      tokenGated: false,
      tokenAddress: '',
      minBalance: 0
    }
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const entityData = {
        ...formData,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        status: 'pending',
        votes: 0,
        requiredVotes: entityType === 'project' ? 15 : 10,
        supporters: [],
        opponents: [],
        type: entityType,
        verified: false
      };

      const collectionName = entityType === 'project' ? 'projects' : 'kols';
      await setDoc(doc(db, collectionName, user.uid), entityData);

      // Create initial event submission
      const eventData = {
        projectId: user.uid,
        projectName: formData.name,
        title: `${formData.name} Introduction`,
        description: `Welcome to ${formData.name}! This is our first event as a ${entityType === 'project' ? 'project' : 'KOL'} on the platform.`,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
        time: '2:00 PM UTC',
        createdBy: user.uid,
        eventType: 'general',
        status: 'pending',
        isTokenGated: formData.requirements.tokenGated,
        votes: 0,
        requiredVotes: entityType === 'project' ? 10 : 8,
        interests: formData.tags,
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
      console.error('Error registering entity:', error);
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

  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
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
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {step === 1 ? 'Choose Type' : step === 2 ? 'Basic Information' : 'Requirements & Settings'}
                  </h2>
                  <p className="text-gray-300 text-sm">
                    {step === 1 ? 'Are you registering as a project or KOL?' : 
                     step === 2 ? 'Tell us about your entity' : 
                     'Set up voting requirements and access controls'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-800/50 rounded-lg transition-all duration-200 group"
                >
                  <FiX className="w-6 h-6 text-gray-400 group-hover:text-white" />
                </button>
              </div>

                             {/* Step Indicator */}
               <div className="flex items-center gap-2 mb-6">
                 {[1, 2, 3].map((stepNumber) => (
                   <div key={stepNumber} className="flex items-center">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                       step >= stepNumber 
                         ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20' 
                         : 'bg-gray-700 text-gray-400'
                     }`}>
                       {step > stepNumber ? <FiCheckCircle className="w-4 h-4" /> : stepNumber}
                     </div>
                     {stepNumber < 3 && (
                       <div className={`w-12 h-0.5 mx-2 transition-all duration-300 ${
                         step > stepNumber ? 'bg-gradient-to-r from-blue-600 to-blue-500' : 'bg-gray-700'
                       }`} />
                     )}
                   </div>
                 ))}
               </div>

              {/* Step 1: Entity Type Selection */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         <button
                       onClick={() => setEntityType('project')}
                       className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                         entityType === 'project'
                           ? 'bg-gradient-to-br from-blue-600/20 to-blue-800/10 border-blue-500/50 text-blue-300 shadow-lg shadow-blue-500/10'
                           : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800/70'
                       }`}
                     >
                       <div className="flex items-center gap-3 mb-3">
                         <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                           entityType === 'project' ? 'bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg' : 'bg-gray-700'
                         }`}>
                           <FiUsers className="w-5 h-5" />
                         </div>
                         <h3 className="font-semibold">Project</h3>
                       </div>
                       <p className="text-sm opacity-75">
                         Register as a DeFi protocol, NFT collection, or crypto project. Requires 15 votes for approval.
                       </p>
                       <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                         <FiAward className="w-3 h-3" />
                         <span>Higher voting threshold</span>
                       </div>
                     </button>

                     <button
                       onClick={() => setEntityType('kol')}
                       className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                         entityType === 'kol'
                           ? 'bg-gradient-to-br from-purple-600/20 to-purple-800/10 border-purple-500/50 text-purple-300 shadow-lg shadow-purple-500/10'
                           : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800/70'
                       }`}
                     >
                       <div className="flex items-center gap-3 mb-3">
                         <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                           entityType === 'kol' ? 'bg-gradient-to-br from-purple-600 to-purple-700 shadow-lg' : 'bg-gray-700'
                         }`}>
                           <FiUser className="w-5 h-5" />
                         </div>
                         <h3 className="font-semibold">KOL</h3>
                       </div>
                       <p className="text-sm opacity-75">
                         Register as a Key Opinion Leader or influencer. Requires 10 votes for approval.
                       </p>
                       <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                         <FiAward className="w-3 h-3" />
                         <span>Faster approval process</span>
                       </div>
                     </button>
                  </div>
                </div>
              )}

              {/* Step 2: Basic Information */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                                         <input
                       type="text"
                       value={formData.name}
                       onChange={(e) => updateFormData('name', e.target.value)}
                       className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 placeholder-gray-500"
                       placeholder={`${entityType === 'project' ? 'Project' : 'KOL'} name`}
                     />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateFormData('description', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      placeholder="Describe your entity..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => updateFormData('website', e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Twitter</label>
                      <input
                        type="text"
                        value={formData.twitter}
                        onChange={(e) => updateFormData('twitter', e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                        placeholder="@username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                                             {formData.tags.map((tag) => (
                         <span
                           key={tag}
                           className="px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-blue-700/10 text-blue-300 text-sm rounded-full border border-blue-500/30 flex items-center gap-1.5 shadow-sm"
                         >
                           {tag}
                           <button
                             onClick={() => removeTag(tag)}
                             className="hover:text-red-400 hover:bg-red-500/10 rounded-full p-0.5 transition-all duration-200"
                           >
                             <FiX className="w-3 h-3" />
                           </button>
                         </span>
                       ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add tag..."
                        className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const input = e.target as HTMLInputElement;
                            addTag(input.value);
                            input.value = '';
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.querySelector('input[placeholder="Add tag..."]') as HTMLInputElement;
                          if (input && input.value) {
                            addTag(input.value);
                            input.value = '';
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Requirements & Settings */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Reputation</label>
                      <input
                        type="number"
                        value={formData.requirements.minReputation}
                        onChange={(e) => updateFormData('requirements', {
                          ...formData.requirements,
                          minReputation: parseInt(e.target.value) || 0
                        })}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Followers</label>
                      <input
                        type="number"
                        value={formData.requirements.minFollowers}
                        onChange={(e) => updateFormData('requirements', {
                          ...formData.requirements,
                          minFollowers: parseInt(e.target.value) || 0
                        })}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="tokenGated"
                      checked={formData.requirements.tokenGated}
                      onChange={(e) => updateFormData('requirements', {
                        ...formData.requirements,
                        tokenGated: e.target.checked
                      })}
                      className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-700 rounded focus:ring-blue-500/50"
                    />
                    <label htmlFor="tokenGated" className="text-sm text-gray-300">
                      Token-gated events (require specific token balance)
                    </label>
                  </div>

                  {formData.requirements.tokenGated && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Token Contract Address</label>
                        <input
                          type="text"
                          value={formData.requirements.tokenAddress}
                          onChange={(e) => updateFormData('requirements', {
                            ...formData.requirements,
                            tokenAddress: e.target.value
                          })}
                          className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                          placeholder="0x..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Balance</label>
                        <input
                          type="number"
                          value={formData.requirements.minBalance}
                          onChange={(e) => updateFormData('requirements', {
                            ...formData.requirements,
                            minBalance: parseFloat(e.target.value) || 0
                          })}
                          className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

                             {/* Navigation Buttons */}
               <div className="flex gap-3 mt-8">
                 {step > 1 && (
                   <button
                     onClick={() => setStep(step - 1)}
                     className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 font-medium"
                   >
                     Back
                   </button>
                 )}
                 
                 {step < 3 ? (
                                        <button
                       onClick={() => setStep(step + 1)}
                       className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 ml-auto font-medium"
                     >
                       Next
                     </button>
                 ) : (
                                       <button
                      onClick={handleSubmit}
                      disabled={loading || !formData.name || !formData.description}
                      className="px-6 py-3 bg-green-600/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-600/30 hover:border-green-500/50 transition-all duration-200 ml-auto font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Submitting...' : 'Submit Registration'}
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

export default ProjectRegistrationModal;
