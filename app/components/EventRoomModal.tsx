"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiUsers, FiShare } from 'react-icons/fi';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/providers';

interface EventRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  userProfile: any;
}

const EventRoomModal = ({ isOpen, onClose, event, userProfile }: EventRoomModalProps) => {
  const { user } = useAuth();
  const [chatMessage, setChatMessage] = useState('');
  const [participants, setParticipants] = useState([
    { id: '1', name: 'Event Host', avatar: '👤', isHost: true, isSpeaking: true },
    { id: '2', name: 'Community Member', avatar: '👤', isHost: false, isSpeaking: false },
    { id: '3', name: 'Project Lead', avatar: '👤', isHost: false, isSpeaking: false },
  ]);
     const [chatMessages, setChatMessages] = useState([
     { id: '1', user: 'Event Host', message: 'Welcome to the pre-event discussion! Feel free to ask any questions about what we\'ll cover.', timestamp: new Date(), isHost: true },
     { id: '2', user: 'Community Member', message: 'Will you be discussing the new tokenomics model?', timestamp: new Date(), isHost: false },
     { id: '3', user: 'Event Host', message: 'Yes, we\'ll definitely cover that! It\'s one of our main topics.', timestamp: new Date(), isHost: true },
   ]);

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !user) return;

    const newMessage = {
      id: Date.now().toString(),
      user: userProfile?.displayName || user.email || 'Anonymous',
      message: chatMessage,
      timestamp: new Date(),
      isHost: false
    };

    setChatMessages(prev => [...prev, newMessage]);
    setChatMessage('');
  };

  const handleJoinRoom = async () => {
    if (!user || !event) return;

    try {
      const eventRef = doc(db, "projectEvents", event.id);
      await updateDoc(eventRef, {
        [`reactions.views`]: arrayUnion(user.uid),
        updatedAt: Timestamp.now()
      });

      // Add user to participants
      const newParticipant = {
        id: user.uid,
        name: userProfile?.displayName || user.email || 'Anonymous',
        avatar: '👤',
        isHost: false,
        isSpeaking: false
      };

      setParticipants(prev => [...prev, newParticipant]);
    } catch (error) {
      console.error('Error joining room:', error);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      handleJoinRoom();
    }
  }, [isOpen, user]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-gray-900/95 backdrop-blur-sm rounded-2xl border border-gray-700/50 w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                  <FiUsers className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{event?.title}</h2>
                  <p className="text-sm text-gray-400">{event?.projectName} • {participants.length} participants</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800/50 rounded-lg transition-all duration-200 group"
              >
                <FiX className="w-6 h-6 text-gray-400 group-hover:text-white" />
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex">
              {/* Video/Content Area */}
              <div className="flex-1 p-6">
                <div className="bg-gray-800/50 rounded-xl h-full flex items-center justify-center border border-gray-700/50">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiUsers className="w-12 h-12 text-blue-400" />
                    </div>
                                         <h3 className="text-lg font-semibold text-white mb-2">Pre-Event Discussion</h3>
                     <p className="text-gray-400 text-sm mb-4">Ask questions and connect before the event</p>
                                         <div className="flex items-center gap-2 justify-center">
                       <button className="p-3 bg-gray-700/50 text-gray-300 rounded-full hover:bg-gray-600/50 transition-all duration-200">
                         <FiShare className="w-5 h-5" />
                       </button>
                     </div>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="w-80 border-l border-gray-700/50 flex flex-col">
                {/* Participants */}
                <div className="p-4 border-b border-gray-700/50">
                  <h3 className="text-sm font-semibold text-white mb-3">Participants ({participants.length})</h3>
                  <div className="space-y-2">
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition-all duration-200">
                        <div className="relative">
                          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm">
                            {participant.avatar}
                          </div>
                          {participant.isSpeaking && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium">{participant.name}</p>
                                                   {participant.isHost && (
                           <span className="text-xs text-blue-400">Host</span>
                         )}
                       </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chat */}
                <div className="flex-1 flex flex-col">
                                     <div className="p-4 border-b border-gray-700/50">
                     <h3 className="text-sm font-semibold text-white">Discussion</h3>
                   </div>
                  
                  {/* Chat Messages */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3">
                    {chatMessages.map((message) => (
                      <div key={message.id} className="flex gap-3">
                        <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs">
                          {message.user.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">{message.user}</span>
                            {message.isHost && (
                              <span className="text-xs text-blue-400">Host</span>
                            )}
                            <span className="text-xs text-gray-500">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300">{message.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <div className="p-4 border-t border-gray-700/50">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                                 placeholder="Ask a question or share your thoughts..."
                        className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="px-4 py-2 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-all duration-200"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EventRoomModal;
