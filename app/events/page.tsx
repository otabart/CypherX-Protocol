"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  getDocs,
  getDoc,
  query,
  doc,
  updateDoc,
  setDoc,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FiThumbsUp,
  FiThumbsDown,
  FiLink,
  FiX,
  FiBell,
  FiAward,
  FiUser,
  FiCalendar,
  FiTrendingUp,
  FiImage,
  FiPlay,
  FiCode,
  FiUsers,
  FiSettings,
  FiStar,
  FiSearch,
  FiHeart,
  FiEye,
  FiChevronDown,
  FiLock,
  FiClock,
  FiPlus,
  FiMessageCircle,
  FiCheckCircle,
  FiShield,
} from "react-icons/fi";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useAuth } from "@/app/providers";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Image from "next/image";
import ProjectRegistrationModal from "../components/ProjectRegistrationModal";
import EventSubmissionModal from "../components/EventSubmissionModal";
import EventVotingModal from "../components/EventVotingModal";
import EventRoomModal from "../components/EventRoomModal";



// ────────── Types ──────────

interface Event {
  id: string;
  projectId: string;
  projectName: string;
  projectTicker: string;
  projectLogo?: string;
  title: string;
  description: string;
  date: string;
  time: string;
  createdBy: string;
  eventType: string;
  link?: string;
  status: string;
  isTokenGated?: boolean;
  tokenRequirement?: { contractAddress: string; minBalance: number };
  isFeatured?: boolean;
  votes: number;
  requiredVotes: number;
  interests: string[];
  reactions: {
    likes: string[];
    dislikes: string[];
    comments: { userId: string; text: string; timestamp: Timestamp }[];
    views: string[];
    rsvps: string[];
    pinned: { userId: string; text: string; timestamp: Timestamp }[];
  };
}

interface UserProfile {
  uid: string;
  email: string;
  badges: string[];
  interests: string[];
  followedProjects: string[];
  followedKOLs: string[];
  reputation: {
    totalScore: number;
    interests: Array<{
      category: string;
      level: 'beginner' | 'intermediate' | 'expert';
      score: number;
      eventsAttended: number;
      eventsHosted: number;
    }>;
    votingPower: number;
    canVoteOnEvents: boolean;
  };
  votingHistory: Record<string, any>;
  projectEngagement: {
    [projectId: string]: {
      eventsAttended: number;
      eventsRSVPd: number;
      totalEngagement: number;
      lastEngagement: string;
      engagementStreak: number;
      favoriteProject?: boolean;
    };
  };
  rsvpedEvents: string[];
  attendedEvents: Array<{
    eventId: string;
    eventTitle: string;
    attendanceTime: string;
    wasLate: boolean;
    minutesLate: number;
  }>;
}



interface InterestCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  subcategories: string[];
}

// ────────── Interest Categories ──────────

const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    id: 'defi',
    name: 'DeFi',
    description: 'Decentralized Finance protocols and applications',
    icon: 'FiTrendingUp',
    color: 'blue',
    subcategories: ['yield-farming', 'lending', 'dex', 'derivatives', 'insurance']
  },
  {
    id: 'nfts',
    name: 'NFTs',
    description: 'Non-Fungible Tokens and digital collectibles',
    icon: 'FiImage',
    color: 'purple',
    subcategories: ['art', 'gaming', 'music', 'virtual-worlds', 'collectibles']
  },
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Blockchain gaming and play-to-earn',
    icon: 'FiPlay',
    color: 'green',
    subcategories: ['play-to-earn', 'metaverse', 'esports', 'virtual-worlds']
  },
  {
    id: 'trading',
    name: 'Trading',
    description: 'Cryptocurrency trading and analysis',
    icon: 'FiTrendingUp',
    color: 'yellow',
    subcategories: ['technical-analysis', 'fundamental-analysis', 'day-trading', 'swing-trading']
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Blockchain development and smart contracts',
    icon: 'FiCode',
    color: 'red',
    subcategories: ['smart-contracts', 'dapp-development', 'defi-protocols', 'web3']
  },
  {
    id: 'governance',
    name: 'Governance',
    description: 'DAO governance and community management',
    icon: 'FiUsers',
    color: 'indigo',
    subcategories: ['dao-participation', 'proposal-writing', 'community-management', 'voting']
  }
];

// ────────── Main Component ──────────

export default function EventsPage() {
  const { user } = useAuth();
  
  // State management
  const [events, setEvents] = useState<Event[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  
  // UI States
  const [showInterestSelector, setShowInterestSelector] = useState(false);
  const [showProjectRegistration, setShowProjectRegistration] = useState(false);
  const [showEventSubmission, setShowEventSubmission] = useState(false);
  const [showEventVoting, setShowEventVoting] = useState(false);
  const [showEventRoom, setShowEventRoom] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showGovernance, setShowGovernance] = useState(false);
  const [pendingProjects, setPendingProjects] = useState<any[]>([]);
  const [pendingKOLs, setPendingKOLs] = useState<any[]>([]);


  // ────────── Data Fetching ──────────
  
  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching user profile for:', user.uid);
      // Fetch user profile
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        console.log('✅ User profile found:', userData);
        setUserProfile(userData);
        setSelectedInterests(userData.interests || []);
        
        // Show interest selector if no interests are set
        if (!userData.interests || userData.interests.length === 0) {
          console.log('📝 No interests found, showing selector');
          setShowInterestSelector(true);
        }
      } else {
        // User doesn't exist in database yet, show interest selector
        console.log('❌ User document not found, showing selector');
        setShowInterestSelector(true);
      }

      // Fetch events based on user interests and followed projects/KOLs
      const eventsQuery = query(collection(db, "projectEvents"));
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate?.() || data.date,
          reactions: {
            likes: data.reactions?.likes || [],
            dislikes: data.reactions?.dislikes || [],
            comments: data.reactions?.comments || [],
            views: data.reactions?.views || [],
            rsvps: data.reactions?.rsvps || [],
            pinned: data.reactions?.pinned || [],
          },
        } as Event;
      });
      setEvents(eventsData);

      // Fetch pending projects and KOLs for governance
      const projectsQuery = query(collection(db, "projects"));
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectsData = projectsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter((project: any) => project.status === 'pending');
      setPendingProjects(projectsData);

      const kolsQuery = query(collection(db, "kols"));
      const kolsSnapshot = await getDocs(kolsQuery);
      const kolsData = kolsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter((kol: any) => kol.status === 'pending');
      setPendingKOLs(kolsData);

    } catch (error) {
      console.error("❌ Error fetching data:", error);
      console.error("Error details:", {
        user: user?.uid,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      if (user) {
        toast.error("Failed to load events data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // ────────── Filtered Events ──────────

  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Filter by user interests and followed projects/KOLs (only for personalized view)
    if (filterType === "personalized" && userProfile?.interests && userProfile.interests.length > 0) {
      filtered = filtered.filter(event => 
        event.interests?.some(interest => userProfile.interests.includes(interest)) ||
        (userProfile.followedProjects && userProfile.followedProjects.includes(event.projectId))
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.projectName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter(event => event.eventType === filterType);
    }

    return filtered.sort((a, b) => {
      // Sort by featured first, then by date
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [events, userProfile, searchTerm, filterType]);

  // ────────── Event Handlers ──────────

    const handleInterestSelection = async () => {
    if (!user) return;

    try {
      console.log('💾 Saving interests for user:', user.uid);
      console.log('📋 Selected interests:', selectedInterests);
      
      // First, check if user document exists
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        console.log('✅ User document exists, updating interests');
        // Update existing user
        await updateDoc(userDocRef, {
          interests: selectedInterests,
        });
      } else {
        console.log('❌ User document not found, creating new one');
        // Create new user document
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          interests: selectedInterests,
          followedProjects: [],
          followedKOLs: [],
          reputation: {
            totalScore: 0,
            interests: [],
            votingPower: 1,
            canVoteOnEvents: true,
          },
          projectEngagement: {},
          rsvpedEvents: [],
          attendedEvents: [],
          badges: [],
        });
      }

      setShowInterestSelector(false);
      toast.success("Interests saved! You'll now see relevant events.");
      
      // Refresh user profile
      const updatedUserDoc = await getDoc(userDocRef);
      if (updatedUserDoc.exists()) {
        setUserProfile(updatedUserDoc.data() as UserProfile);
      }
    } catch (error) {
      console.error("Error saving interests:", error);
      toast.error("Failed to save interests");
    }
  };

  // ────────── Follow/Unfollow Functions ──────────

  const handleFollowProject = async (projectId: string) => {
    if (!user || !userProfile) return;

    try {
      const userDocRef = doc(db, "users", user.uid);
      const isFollowing = userProfile.followedProjects?.includes(projectId);
      
      if (isFollowing) {
        // Unfollow
        await updateDoc(userDocRef, {
          followedProjects: userProfile.followedProjects.filter(id => id !== projectId)
        });
      } else {
        // Follow
        await updateDoc(userDocRef, {
          followedProjects: [...(userProfile.followedProjects || []), projectId]
        });
      }

      // Refresh user profile
      const updatedUserDoc = await getDoc(userDocRef);
      if (updatedUserDoc.exists()) {
        setUserProfile(updatedUserDoc.data() as UserProfile);
      }
    } catch (error) {
      console.error("Error following/unfollowing project:", error);
      toast.error("Failed to update follow status");
    }
  };

  // ────────── Event Actions ──────────

  const handleEventAction = async (eventId: string, action: 'like' | 'comment' | 'rsvp' | 'room') => {
    if (!user || !userProfile) {
      toast.error("Please log in to interact with events");
      return;
    }

    try {
      const eventRef = doc(db, "projectEvents", eventId);
      const eventDoc = await getDoc(eventRef);
      
      if (!eventDoc.exists()) {
        toast.error("Event not found");
        return;
      }

      const eventData = eventDoc.data() as Event;
      const reactions = eventData.reactions || {
        likes: [],
        dislikes: [],
        comments: [],
        views: [],
        rsvps: [],
        pinned: []
      };

      let updatedReactions = { ...reactions };

      switch (action) {
        case 'like':
          const isLiked = reactions.likes.includes(user.uid);
          updatedReactions.likes = isLiked 
            ? reactions.likes.filter(id => id !== user.uid)
            : [...reactions.likes, user.uid];
          break;

        case 'rsvp':
          const isRSVPed = reactions.rsvps.includes(user.uid);
          updatedReactions.rsvps = isRSVPed 
            ? reactions.rsvps.filter(id => id !== user.uid)
            : [...reactions.rsvps, user.uid];
          break;

        case 'comment':
          // For now, just show a toast. In a full implementation, this would open a comment modal
          toast.success("Comment feature coming soon!");
          return;

        case 'room':
          // Open event room modal
          setSelectedEvent(eventData);
          setShowEventRoom(true);
          return;
      }

      // Update event reactions
      await updateDoc(eventRef, {
        reactions: updatedReactions,
        updatedAt: Timestamp.now()
      });

      // Update user reputation for engagement
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        "reputation.totalScore": increment(2)
      });

      // Refresh events data
      const eventsQuery = query(collection(db, "projectEvents"));
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate?.() || data.date,
          reactions: {
            likes: data.reactions?.likes || [],
            dislikes: data.reactions?.dislikes || [],
            comments: data.reactions?.comments || [],
            views: data.reactions?.views || [],
            rsvps: data.reactions?.rsvps || [],
            pinned: data.reactions?.pinned || [],
          },
        } as Event;
      });
      setEvents(eventsData);

      // Refresh user profile
      const updatedUserDoc = await getDoc(userRef);
      if (updatedUserDoc.exists()) {
        setUserProfile(updatedUserDoc.data() as UserProfile);
      }

      toast.success(`Event ${action} updated successfully!`);

    } catch (error) {
      console.error(`Error ${action}ing event:`, error);
      toast.error(`Failed to ${action} event`);
    }
  };

  const handleGovernanceVote = async (entityId: string, entityType: 'project' | 'kol', vote: 'approve' | 'reject') => {
    if (!user || !userProfile) return;

    try {
      const collectionName = entityType === 'project' ? 'projects' : 'kols';
      const entityRef = doc(db, collectionName, entityId);
      const userRef = doc(db, 'users', user.uid);

      // Update entity votes
      await updateDoc(entityRef, {
        votes: increment(vote === 'approve' ? 1 : -1),
        [vote === 'approve' ? 'supporters' : 'opponents']: increment(1),
        updatedAt: Timestamp.now()
      });

      // Update user voting history
      await updateDoc(userRef, {
        [`votingHistory.${entityId}`]: {
          vote,
          entityType,
          timestamp: Timestamp.now()
        },
        'reputation.totalScore': increment(vote === 'approve' ? 5 : 2)
      });

      // Refresh data
      fetchData();
      toast.success(`Vote ${vote === 'approve' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to submit vote');
    }
  };

  // ────────── Render Functions ──────────

  const renderInterestSelector = () => (
    <AnimatePresence>
      {showInterestSelector && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-3xl font-bold text-white mb-2">Select Your Interests</h3>
                <p className="text-gray-300">
                  Choose your interests to discover relevant events and build reputation in specific areas. 
                  You can always update these later.
                </p>
              </div>
              <button
                onClick={() => setShowInterestSelector(false)}
                className="p-3 hover:bg-gray-800/50 rounded-xl transition-all duration-200 group"
              >
                <FiX className="w-6 h-6 text-gray-400 group-hover:text-white" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {INTEREST_CATEGORIES.map((category) => (
                <motion.div
                  key={category.id}
                  onClick={() => {
                    setSelectedInterests(prev => 
                      prev.includes(category.id)
                        ? prev.filter(id => id !== category.id)
                        : [...prev, category.id]
                    );
                  }}
                                     className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                     selectedInterests.includes(category.id)
                       ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                       : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600'
                   }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {category.icon === 'FiTrendingUp' && <FiTrendingUp className="w-6 h-6" />}
                      {category.icon === 'FiImage' && <FiImage className="w-6 h-6" />}
                      {category.icon === 'FiPlay' && <FiPlay className="w-6 h-6" />}
                      {category.icon === 'FiCode' && <FiCode className="w-6 h-6" />}
                      {category.icon === 'FiUsers' && <FiUsers className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="font-semibold">{category.name}</h4>
                      <p className="text-sm opacity-75">{category.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

                         <div className="flex gap-3">
               <button
                 onClick={handleInterestSelection}
                 className="flex-1 bg-blue-600/20 text-blue-300 py-3 rounded-lg hover:bg-blue-600/30 transition-colors font-medium border border-blue-500/30"
               >
                 {selectedInterests.length > 0 ? `Save ${selectedInterests.length} Interest${selectedInterests.length !== 1 ? 's' : ''}` : 'Save (No Interests)'}
               </button>
               <button
                 onClick={() => setShowInterestSelector(false)}
                 className="flex-1 bg-gray-700 text-gray-300 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium border border-gray-600"
               >
                 Cancel
               </button>
             </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

     const renderEmptyState = () => (
               <div className="relative">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-blue-800/5 rounded-3xl"></div>
          
          <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm rounded-3xl border border-gray-700/50 p-12">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
              >
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl mb-6 shadow-2xl">
                  <FiCalendar className="w-12 h-12 text-white" />
                </div>
               <h3 className="text-3xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                 {filterType === "personalized" 
                   ? (!userProfile?.interests || userProfile.interests.length === 0)
                     ? "Set Up Your Interests"
                     : "No Events Found"
                   : "Welcome to Events"
                 }
               </h3>
               <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
                 {filterType === "personalized" 
                   ? (!userProfile?.interests || userProfile.interests.length === 0)
                     ? "Tell us what interests you and we'll curate the perfect events just for you"
                     : "Follow more projects and KOLs to see their events in your personalized feed"
                   : "Discover amazing events from the crypto community. Set up your interests to get personalized recommendations."
                 }
               </p>
             </motion.div>
            
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.6, delay: 0.2 }}
               className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
             >
               {filterType === "personalized" && (!userProfile?.interests || userProfile.interests.length === 0) && (
                                 <button
                  onClick={() => setShowInterestSelector(true)}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-xl"
                >
                  Set Up Interests
                </button>
               )}
               
                               <button
                  onClick={() => setShowInterestSelector(true)}
                  className="px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white rounded-2xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-xl border border-gray-600/50"
                >
                  Manage Interests
                </button>
             </motion.div>
           </div>

                       {/* Feature Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
            >
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 hover:border-gray-600/50 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-700/50 rounded-xl flex items-center justify-center shadow-lg">
                    <FiTrendingUp className="w-6 h-6 text-gray-300" />
                  </div>
                  <h4 className="font-bold text-white text-lg">Smart Discovery</h4>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  Get personalized event recommendations based on your interests in DeFi, NFTs, Gaming, and more.
                </p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 hover:border-gray-600/50 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-700/50 rounded-xl flex items-center justify-center shadow-lg">
                    <FiAward className="w-6 h-6 text-gray-300" />
                  </div>
                  <h4 className="font-bold text-white text-lg">Community Voting</h4>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  Vote on events and build reputation. Help curate the best events for the community.
                </p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 hover:border-gray-600/50 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-700/50 rounded-xl flex items-center justify-center shadow-lg">
                    <FiUsers className="w-6 h-6 text-gray-300" />
                  </div>
                  <h4 className="font-bold text-white text-lg">Follow & Connect</h4>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  Follow your favorite projects and key opinion leaders to never miss their events.
                </p>
              </div>
            </motion.div>

           {/* Sample Event Preview */}
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.6, delay: 0.6 }}
             className="bg-gradient-to-br from-gray-800/50 to-gray-700/50 backdrop-blur-sm rounded-2xl border border-gray-600/50 p-8"
           >
             <h4 className="font-bold text-white mb-6 flex items-center gap-3 text-xl">
               <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                 <FiStar className="w-4 h-4 text-white" />
               </div>
               Featured Events You'll See
             </h4>
             
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-700/50 rounded-xl flex items-center justify-center">
                      <FiTrendingUp className="w-6 h-6 text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-bold text-white text-lg mb-2">CypherX Platform Launch</h5>
                      <p className="text-gray-300 mb-3">Join us for the official launch of CypherX - the next-generation DeFi platform with lightning-fast swaps and revolutionary features.</p>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-gray-700/50 text-gray-300 text-sm rounded-full border border-gray-600/50">DeFi</span>
                        <span className="px-3 py-1 bg-gray-700/50 text-gray-300 text-sm rounded-full border border-gray-600/50">Launch</span>
                        <span className="text-gray-400 text-sm">Dec 20, 2024</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-700/50 rounded-xl flex items-center justify-center">
                      <FiImage className="w-6 h-6 text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-bold text-white text-lg mb-2">CypherX NFT Collection</h5>
                      <p className="text-gray-300 mb-3">Exclusive CypherX NFT collection featuring unique digital art and special platform perks for early supporters.</p>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-gray-700/50 text-gray-300 text-sm rounded-full border border-gray-600/50">NFTs</span>
                        <span className="px-3 py-1 bg-gray-700/50 text-gray-300 text-sm rounded-full border border-gray-600/50">Art</span>
                        <span className="text-gray-400 text-sm">Jan 5, 2025</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
           </motion.div>

           {/* Quick Stats */}
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.6, delay: 0.8 }}
             className="mt-8 text-center"
           >
             <div className="inline-flex items-center gap-8 text-gray-300 text-sm">
               <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                   <FiUsers className="w-4 h-4 text-white" />
                 </div>
                 <span className="font-semibold">1,234+ Community Members</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                   <FiCalendar className="w-4 h-4 text-white" />
                 </div>
                 <span className="font-semibold">567+ Events This Month</span>
               </div>
               <div className="flex items-center gap-2">
                                 <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <FiAward className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold">89 Projects & KOLs</span>
               </div>
             </div>
           </motion.div>
         </div>
       </div>
     );

  const renderEventCard = (event: Event) => (
    <div className="group relative bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6 hover:border-gray-600/70 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-1">
      {/* Featured Badge */}
      {event.isFeatured && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg">
            <FiStar className="w-3 h-3 inline mr-1" />
            Featured
          </div>
        </div>
      )}

      {/* Status Badge */}
      {event.status === "pending" && (
        <div className="absolute -top-2 -left-2 z-10">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg">
            <FiClock className="w-3 h-3 inline mr-1" />
            Pending
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            {event.projectLogo ? (
              <Image 
                src={event.projectLogo} 
                alt={event.projectName} 
                width={48} 
                height={48} 
                className="rounded-xl ring-2 ring-gray-700/50 group-hover:ring-blue-500/30 transition-all" 
              />
            ) : (
                          <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            )}
            {event.isTokenGated && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <FiLock className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
              {event.title}
            </h3>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-300 font-medium">{event.projectName}</p>
                              <button
                  onClick={() => handleFollowProject(event.projectId)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    userProfile?.followedProjects?.includes(event.projectId)
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                      : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/50'
                  }`}
                >
                  <FiHeart className={`w-3 h-3 ${userProfile?.followedProjects?.includes(event.projectId) ? 'fill-current' : ''}`} />
                  {userProfile?.followedProjects?.includes(event.projectId) ? 'Following' : 'Follow'}
                </button>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-300 mb-6 leading-relaxed line-clamp-3">
        {event.description}
      </p>

      {/* Event Details */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
            <FiCalendar className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-white">{format(new Date(event.date), "MMM d, yyyy")}</p>
            <p className="text-xs text-gray-500">{event.time}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
            <FiUser className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="font-medium text-white">{event.eventType}</p>
            <p className="text-xs text-gray-500 capitalize">{event.eventType}</p>
          </div>
        </div>
      </div>

      {/* Interests Tags */}
      {event.interests && event.interests.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {event.interests.slice(0, 4).map((interest) => (
            <span
              key={interest}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600/20 to-purple-700/20 text-purple-300 text-xs rounded-full border border-purple-500/30 font-medium"
            >
              {interest}
            </span>
          ))}
          {event.interests.length > 4 && (
            <span className="px-3 py-1.5 bg-gray-700/50 text-gray-400 text-xs rounded-full">
              +{event.interests.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Voting Section */}
      {userProfile?.reputation?.canVoteOnEvents && event.status === "pending" && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-blue-300 font-medium">Vote on this event:</p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <FiAward className="w-3 h-3" />
              <span>Voting Power: {userProfile?.reputation?.votingPower || 0}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
                          <button
                onClick={() => {
                  setSelectedEvent(event);
                  setShowEventVoting(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium"
              >
                <FiThumbsUp className="w-4 h-4" />
                Vote Now
              </button>
            <div className="text-xs text-gray-400">
              {event.votes || 0} / {event.requiredVotes || 10} votes needed
            </div>
          </div>
        </div>
      )}

      {/* Event Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
        <div className="flex items-center gap-4">
          {/* Like Button */}
          <button 
            onClick={() => handleEventAction(event.id, 'like')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              event.reactions?.likes?.includes(user?.uid || '')
                ? 'bg-green-600/20 text-green-300 border border-green-500/30'
                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/50'
            }`}
          >
            <FiHeart className={`w-4 h-4 flex-shrink-0 ${event.reactions?.likes?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
            <span>{event.reactions?.likes?.length || 0}</span>
          </button>

          {/* Comment Button */}
          <button 
            onClick={() => handleEventAction(event.id, 'comment')}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/50 rounded-full text-sm font-medium transition-all duration-200"
          >
            <FiMessageCircle className="w-4 h-4 flex-shrink-0" />
            <span>{event.reactions?.comments?.length || 0}</span>
          </button>

          {/* RSVP Button */}
          <button 
            onClick={() => handleEventAction(event.id, 'rsvp')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              event.reactions?.rsvps?.includes(user?.uid || '')
                ? 'bg-green-600/20 text-green-300 border border-green-500/30'
                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600/50'
            }`}
          >
            <FiCheckCircle className={`w-4 h-4 flex-shrink-0 ${event.reactions?.rsvps?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
            <span>{event.reactions?.rsvps?.length || 0}</span>
          </button>

          {/* Event Room Button */}
          <button 
            onClick={() => handleEventAction(event.id, 'room')}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 rounded-full text-sm font-medium transition-all duration-200"
          >
            <FiUsers className="w-4 h-4 flex-shrink-0" />
            <span>Room</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Voting Stats */}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <FiAward className="w-4 h-4 text-yellow-400" />
            <span>{event.votes}/{event.requiredVotes} votes</span>
          </div>
          
          {/* External Link */}
          {event.link && (
            <a
              href={event.link}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg hover:from-blue-600/30 hover:to-purple-600/30 transition-all duration-200 group"
            >
              <FiLink className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
            </a>
          )}
          
          {/* Notification */}
          <button className="p-2 bg-gradient-to-r from-gray-700/50 to-gray-600/50 border border-gray-600/50 rounded-lg hover:from-gray-600/50 hover:to-gray-500/50 transition-all duration-200 group">
            <FiBell className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />
          </button>
        </div>
      </div>
    </div>
  );

  // ────────── Main Render ──────────

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading events...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-12">
          {/* Enhanced Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-4 mb-6"
          >
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search events, projects, or topics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>
              
              {/* Filter Dropdown */}
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="appearance-none w-full lg:w-40 px-3 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all cursor-pointer text-sm"
                >
                  <option value="all">All Events</option>
                  <option value="personalized">Personalized</option>
                  <option value="general">General</option>
                  <option value="ama">AMA</option>
                  <option value="launch">Launch</option>
                  <option value="governance">Governance</option>
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3 pointer-events-none" />
              </div>
              
                             {/* Action Buttons */}
               <div className="flex gap-3">
                 <button
                   onClick={() => setShowProjectRegistration(true)}
                   className="px-4 py-2.5 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 hover:border-blue-500/50 font-medium transition-all duration-200 text-sm flex items-center gap-2"
                 >
                   <FiPlus className="w-4 h-4" />
                   Register
                 </button>
                 <button
                   onClick={() => setShowEventSubmission(true)}
                   className="px-4 py-2.5 bg-green-600/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-600/30 hover:border-green-500/50 font-medium transition-all duration-200 text-sm flex items-center gap-2"
                 >
                   <FiCalendar className="w-4 h-4" />
                   Submit Event
                 </button>
                 <button
                   onClick={() => setShowInterestSelector(true)}
                   className="px-4 py-2.5 bg-gray-600/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-600/30 hover:border-gray-500/50 font-medium transition-all duration-200 text-sm flex items-center gap-2"
                 >
                   <FiSettings className="w-4 h-4" />
                   Interests
                 </button>
               </div>
            </div>
          </motion.div>

          {/* Enhanced Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
          >
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 hover:border-gray-600/50 transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gray-700/50 rounded-lg flex items-center justify-center">
                  <FiAward className="w-4 h-4 text-gray-300" />
                </div>
                <span className="text-xs text-gray-300 font-medium">Reputation</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {userProfile?.reputation?.totalScore || 0}
              </p>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 hover:border-gray-600/50 transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gray-700/50 rounded-lg flex items-center justify-center">
                  <FiHeart className="w-4 h-4 text-gray-300" />
                </div>
                <span className="text-xs text-gray-300 font-medium">Following</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {(userProfile?.followedProjects?.length || 0) + (userProfile?.followedKOLs?.length || 0)}
              </p>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 hover:border-gray-600/50 transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gray-700/50 rounded-lg flex items-center justify-center">
                  <FiEye className="w-4 h-4 text-gray-300" />
                </div>
                <span className="text-xs text-gray-300 font-medium">Interests</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {userProfile?.interests?.length || 0}
              </p>
            </div>
          </motion.div>

          {/* Governance Section */}
          {(pendingProjects.length > 0 || pendingKOLs.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-6"
            >
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <FiShield className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Governance</h3>
                      <p className="text-sm text-gray-400">Vote on pending projects and KOLs</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGovernance(!showGovernance)}
                    className="px-4 py-2 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 hover:border-blue-500/50 font-medium transition-all duration-200 text-sm flex items-center gap-2"
                  >
                    {showGovernance ? 'Hide' : 'View'} Governance
                  </button>
                </div>

                {showGovernance && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    {/* Governance Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FiUsers className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-gray-300">Pending Projects</span>
                        </div>
                        <div className="text-xl font-bold text-white">{pendingProjects.length}</div>
                      </div>
                      
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FiUser className="w-4 h-4 text-purple-400" />
                          <span className="text-sm text-gray-300">Pending KOLs</span>
                        </div>
                        <div className="text-xl font-bold text-white">{pendingKOLs.length}</div>
                      </div>
                      
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FiAward className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-gray-300">Your Voting Power</span>
                        </div>
                        <div className="text-xl font-bold text-white">{userProfile?.reputation?.votingPower || 0}</div>
                      </div>
                    </div>

                    {/* Pending Entities */}
                    <div className="space-y-3">
                      {[...pendingProjects, ...pendingKOLs].map((entity: any) => {
                        const hasVoted = userProfile?.votingHistory?.[entity.id];
                        const canVote = (userProfile?.reputation?.votingPower || 0) > 0 && !hasVoted;
                        const userVote = userProfile?.votingHistory?.[entity.id]?.vote;

                        return (
                          <div key={entity.id} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/30">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center">
                                  {entity.type === 'project' ? (
                                    <FiUsers className="w-5 h-5 text-blue-400" />
                                  ) : (
                                    <FiUser className="w-5 h-5 text-purple-400" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-white font-medium">{entity.name}</h4>
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      entity.type === 'project' 
                                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                                        : 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                                    }`}>
                                      {entity.type === 'project' ? 'Project' : 'KOL'}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {entity.createdAt?.toDate?.() ? format(entity.createdAt.toDate(), "MMM d") : 'Recently'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <p className="text-gray-300 text-sm mb-3 line-clamp-2">{entity.description}</p>

                            {/* Voting Progress */}
                            <div className="mb-3">
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Voting Progress</span>
                                <span>{entity.votes || 0} / {entity.requiredVotes || 10}</span>
                              </div>
                              <div className="w-full bg-gray-600 rounded-full h-1.5">
                                <div 
                                  className="bg-gradient-to-r from-blue-600 to-blue-500 h-1.5 rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${Math.min(((entity.votes || 0) / (entity.requiredVotes || 10)) * 100, 100)}%` 
                                  }}
                                ></div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {canVote ? (
                                  <>
                                    <button
                                      onClick={() => handleGovernanceVote(entity.id, entity.type, 'approve')}
                                      className="px-3 py-1.5 bg-green-600/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-600/30 transition-all duration-200 text-sm font-medium"
                                    >
                                      <FiThumbsUp className="w-3 h-3 inline mr-1" />
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleGovernanceVote(entity.id, entity.type, 'reject')}
                                      className="px-3 py-1.5 bg-red-600/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-all duration-200 text-sm font-medium"
                                    >
                                      <FiThumbsDown className="w-3 h-3 inline mr-1" />
                                      Reject
                                    </button>
                                  </>
                                ) : hasVoted ? (
                                  <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                    userVote === 'approve' 
                                      ? 'bg-green-600/20 text-green-300 border border-green-500/30'
                                      : 'bg-red-600/20 text-red-300 border border-red-500/30'
                                  }`}>
                                    {userVote === 'approve' ? 'Approved' : 'Rejected'}
                                  </span>
                                ) : (
                                  <span className="px-3 py-1.5 bg-gray-600/50 text-gray-400 rounded-lg text-sm font-medium">
                                    Need more voting power
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Events Count */}
          {filteredEvents.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-6"
            >
              <div className="flex items-center gap-2 text-gray-300">
                <FiCalendar className="w-4 h-4" />
                <span className="font-medium">
                  Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
                </span>
              </div>
            </motion.div>
          )}

          {/* Events Grid */}
          {filteredEvents.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {filteredEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 * index }}
                >
                  {renderEventCard(event)}
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {renderEmptyState()}
            </motion.div>
          )}
        </div>
      </main>

      {/* Modals */}
      {renderInterestSelector()}
      
      <ProjectRegistrationModal
        isOpen={showProjectRegistration}
        onClose={() => setShowProjectRegistration(false)}
        onSuccess={() => {
          fetchData();
          setShowProjectRegistration(false);
        }}
      />
      
      <EventSubmissionModal
        isOpen={showEventSubmission}
        onClose={() => setShowEventSubmission(false)}
        onSuccess={() => {
          fetchData();
          setShowEventSubmission(false);
        }}
      />
      
      <EventVotingModal
        isOpen={showEventVoting}
        onClose={() => setShowEventVoting(false)}
        onSuccess={() => {
          fetchData();
          setShowEventVoting(false);
        }}
        event={selectedEvent}
        userProfile={userProfile}
      />
      
      <EventRoomModal
        isOpen={showEventRoom}
        onClose={() => setShowEventRoom(false)}
        event={selectedEvent}
        userProfile={userProfile}
      />
      
      <Footer />
    </div>
  );
}
