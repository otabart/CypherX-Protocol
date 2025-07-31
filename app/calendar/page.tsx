"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FiThumbsUp,
  FiThumbsDown,
  FiPlus,
  FiLink,
  FiMessageSquare,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiShield,
  FiBell,
  FiAward,
  FiUser,
} from "react-icons/fi";
import { format, parseISO } from "date-fns";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "@/app/providers";
import { useAccount, useSignMessage } from "wagmi";
import Header from "../components/Header";
import Footer from "../components/Footer";

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
  points: number;
  email: string;
  badges: string[];
  interactions: {
    [projectId: string]: {
      viewed?: boolean;
      liked?: boolean;
      disliked?: boolean;
      commented?: boolean;
      rsvped?: boolean;
    };
  };
  rsvpedEvents: string[];
}

interface Project {
  id: string;
  name: string;
  ticker: string;
  logo?: string;
}

// ────────── Utility Functions ──────────

function getWeekDates(weekOffset: number = 0): { day: string; date: string; fullDate: string }[] {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return {
      day: format(date, "EEE"),
      date: format(date, "d"),
      fullDate: format(date, "yyyy-MM-dd"),
    };
  });
}

// ────────── Main Component ──────────

export default function CalendarPage() {
  const { user } = useAuth();
  
  // State management
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [followedProjects, setFollowedProjects] = useState<string[]>([]);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showSubmitProjectModal, setShowSubmitProjectModal] = useState(false);
  const [showDiscussionPanel, setShowDiscussionPanel] = useState(false);
  const [discussionEvent, setDiscussionEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [commentText, setCommentText] = useState("");
  const [userPoints, setUserPoints] = useState(0);
  const [userBadges, setUserBadges] = useState<string[]>([]);
  const [userRsvpedEvents, setUserRsvpedEvents] = useState<string[]>([]);

  // Form states
  const [newEvent, setNewEvent] = useState({
    projectId: "",
    title: "",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "12:00",
    eventType: "general",
    link: "",
    isTokenGated: false,
    tokenRequirement: { contractAddress: "", minBalance: 0 },
    isFeatured: false,
  });

  const [newProject, setNewProject] = useState({
    name: "",
    ticker: "",
    description: "",
    contractAddress: "",
    website: "",
    proofOfOwnership: "",
  });

  // Wallet signing state
  const { address: walletAddress } = useAccount();
  const { signMessage, isPending: isSigning, data: signatureData } = useSignMessage();
  const [signature, setSignature] = useState("");
  const [isVerifyingOwnership, setIsVerifyingOwnership] = useState(false);

  // Handle signature result
  useEffect(() => {
    if (signatureData) {
      setSignature(signatureData);
      toast.success("Ownership verified! Signature generated.");
    }
  }, [signatureData]);

  // ────────── Data Fetching ──────────

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user data
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          setUserPoints(userData.points || 0);
          setUserBadges(userData.badges || []);
          setUserRsvpedEvents(userData.rsvpedEvents || []);
          setFollowedProjects(userData.interactions ? Object.keys(userData.interactions) : []);
        }

        // Fetch events from projectEvents collection
        const eventsQuery = query(collection(db, "projectEvents"), where("status", "==", "approved"));
        const eventsSnapshot = await getDocs(eventsQuery);
        const eventsData = eventsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            projectId: data.projectId || "",
            projectName: data.projectName || "Unknown Project",
            projectTicker: data.projectTicker || "",
            projectLogo: data.projectLogo || "",
            title: data.title || "",
            description: data.description || "",
            date: data.date ? format(data.date.toDate(), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
            time: data.date ? format(data.date.toDate(), "HH:mm") : "12:00",
            createdBy: data.createdBy || "",
            eventType: data.eventType || "general",
            link: data.link || "",
            status: data.status || "pending",
            isTokenGated: data.isTokenGated || false,
            tokenRequirement: data.tokenRequirement || { contractAddress: "", minBalance: 0 },
            isFeatured: data.isFeatured || false,
            votes: data.votes || 0,
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

        // Fetch projects
        const projectsQuery = query(collection(db, "projects"));
        const projectsSnapshot = await getDocs(projectsQuery);
        const projectsData = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(projectsData);

      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load calendar data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // ────────── Event Handlers ──────────

  const handleVerifyOwnership = async () => {
    if (!walletAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!newProject.contractAddress.trim()) {
      toast.error("Please enter a contract address first");
      return;
    }

    try {
      setIsVerifyingOwnership(true);
      
      // Create a message to sign that includes the contract address and timestamp
      const message = `I verify ownership of contract ${newProject.contractAddress} for project submission on Homebase. Timestamp: ${Date.now()}`;
      
      // Use the signMessage function
      signMessage({ message });
      
      toast.success("Please approve the signature request in your wallet to verify ownership.");
    } catch (error) {
      console.error("Error signing message:", error);
      toast.error("Failed to verify ownership. Please try again.");
    } finally {
      setIsVerifyingOwnership(false);
    }
  };

  const handleAddEvent = async () => {
    if (!user) {
      toast.error("Please log in to add events");
      return;
    }

    if (!newEvent.projectId || !newEvent.title || !newEvent.description || !newEvent.date || !newEvent.time) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
      const eventData = {
        ...newEvent,
        createdBy: user.uid,
        status: "pending",
        votes: 0,
        date: Timestamp.fromDate(eventDateTime),
        reactions: {
          likes: [],
          dislikes: [],
          comments: [],
          views: [],
          rsvps: [],
          pinned: [],
        },
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, "projectEvents"), eventData);
      toast.success("Event submitted for approval!");
      setShowAddEventModal(false);
      setNewEvent({
        projectId: "",
        title: "",
        description: "",
        date: format(new Date(), "yyyy-MM-dd"),
        time: "12:00",
        eventType: "general",
        link: "",
        isTokenGated: false,
        tokenRequirement: { contractAddress: "", minBalance: 0 },
        isFeatured: false,
      });
    } catch (error) {
      console.error("Error adding event:", error);
      toast.error("Failed to add event");
    }
  };

  const handleSubmitProject = async () => {
    console.log("Submit project clicked");
    console.log("User:", user);
    console.log("New project data:", newProject);
    console.log("Field values:", {
      name: `"${newProject.name}"`,
      ticker: `"${newProject.ticker}"`,
      description: `"${newProject.description}"`,
      contractAddress: `"${newProject.contractAddress}"`,
      website: `"${newProject.website}"`,
      proofOfOwnership: `"${newProject.proofOfOwnership}"`
    });
    
    if (!user) {
      toast.error("Please log in to submit projects");
      return;
    }

    // Check for empty or whitespace-only fields
    if (!newProject.name.trim() || !newProject.ticker.trim() || !newProject.description.trim() || !newProject.contractAddress.trim() || !newProject.website.trim()) {
      toast.error("Please fill in all required fields including contract address and website");
      return;
    }

    // Check if ownership has been verified with signature
    if (!signature) {
      toast.error("Please verify ownership by signing a message with your wallet");
      return;
    }

    // Validate Ethereum address format
    if (!newProject.contractAddress.trim().match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error("Please enter a valid Ethereum contract address (0x followed by 40 hex characters)");
      return;
    }

    try {
      const projectData = {
        ...newProject,
        proofOfOwnership: signature, // Use the signature as proof of ownership
        submitterId: user.uid,
        submittedAt: Timestamp.now(),
        status: "pending",
        adminNotes: "",
      };

      console.log("Project data to submit:", projectData);
      console.log("User UID:", user.uid);

      await addDoc(collection(db, "pendingProjects"), projectData);
      toast.success("Project submitted for approval!");
      setShowSubmitProjectModal(false);
      setNewProject({
        name: "",
        ticker: "",
        description: "",
        contractAddress: "",
        website: "",
        proofOfOwnership: "",
      });
    } catch (error) {
      console.error("Error submitting project:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        code: error instanceof Error ? (error as any).code : "Unknown",
        stack: error instanceof Error ? error.stack : "No stack trace"
      });
      toast.error("Failed to submit project");
    }
  };

  const handleEngagement = async (event: Event, action: "like" | "dislike") => {
    if (!user) {
      toast.error("Please log in to interact with events");
      return;
    }

    try {
      const eventRef = doc(db, "projectEvents", event.id);
      const uid = user.uid;
      const isLiked = event.reactions.likes.includes(uid);
      const isDisliked = event.reactions.dislikes.includes(uid);

      if (action === "like") {
        await updateDoc(eventRef, {
          "reactions.likes": isLiked ? arrayRemove(uid) : arrayUnion(uid),
          "reactions.dislikes": isDisliked ? arrayRemove(uid) : event.reactions.dislikes,
        });
        if (!isLiked) {
          await updateDoc(doc(db, "users", user.uid), {
            points: increment(5)
          });
          setUserPoints(prev => prev + 5);
          toast.success("Liked! +5 points");
        }
      } else {
        await updateDoc(eventRef, {
          "reactions.dislikes": isDisliked ? arrayRemove(uid) : arrayUnion(uid),
          "reactions.likes": isLiked ? arrayRemove(uid) : event.reactions.likes,
        });
        if (!isDisliked) {
          await updateDoc(doc(db, "users", user.uid), {
            points: increment(5)
          });
          setUserPoints(prev => prev + 5);
          toast.success("Disliked! +5 points");
        }
      }

      // Refresh events
      const eventsQuery = query(collection(db, "projectEvents"), where("status", "==", "approved"));
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          projectId: data.projectId || "",
          projectName: data.projectName || "Unknown Project",
          projectTicker: data.projectTicker || "",
          projectLogo: data.projectLogo || "",
          title: data.title || "",
          description: data.description || "",
          date: data.date ? format(data.date.toDate(), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          time: data.date ? format(data.date.toDate(), "HH:mm") : "12:00",
          createdBy: data.createdBy || "",
          eventType: data.eventType || "general",
          link: data.link || "",
          status: data.status || "pending",
          isTokenGated: data.isTokenGated || false,
          tokenRequirement: data.tokenRequirement || { contractAddress: "", minBalance: 0 },
          isFeatured: data.isFeatured || false,
          votes: data.votes || 0,
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
    } catch (error) {
      console.error("Error updating engagement:", error);
      toast.error("Failed to update engagement");
    }
  };

  const handleCommentSubmit = async (event: Event) => {
    if (!user) {
      toast.error("Please log in to comment");
      return;
    }

    if (!commentText.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    try {
      const eventRef = doc(db, "projectEvents", event.id);
      const newComment = {
        userId: user.uid,
        text: commentText.trim(),
        timestamp: Timestamp.now(),
      };

      await updateDoc(eventRef, {
        "reactions.comments": arrayUnion(newComment),
      });

      await updateDoc(doc(db, "users", user.uid), {
        points: increment(10)
      });

      setUserPoints(prev => prev + 10);
      setCommentText("");
      toast.success("Comment posted! +10 points");

      // Refresh events
      const eventsQuery = query(collection(db, "projectEvents"), where("status", "==", "approved"));
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          projectId: data.projectId || "",
          projectName: data.projectName || "Unknown Project",
          projectTicker: data.projectTicker || "",
          projectLogo: data.projectLogo || "",
          title: data.title || "",
          description: data.description || "",
          date: data.date ? format(data.date.toDate(), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          time: data.date ? format(data.date.toDate(), "HH:mm") : "12:00",
          createdBy: data.createdBy || "",
          eventType: data.eventType || "general",
          link: data.link || "",
          status: data.status || "pending",
          isTokenGated: data.isTokenGated || false,
          tokenRequirement: data.tokenRequirement || { contractAddress: "", minBalance: 0 },
          isFeatured: data.isFeatured || false,
          votes: data.votes || 0,
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
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    }
  };

  const handleRSVP = async (event: Event) => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }

    try {
      const eventRef = doc(db, "projectEvents", event.id);
      const uid = user.uid;
      const isGoing = event.reactions.rsvps.includes(uid);

      if (isGoing) {
        await updateDoc(eventRef, {
          "reactions.rsvps": arrayRemove(uid),
        });
        await updateDoc(doc(db, "users", user.uid), {
          rsvpedEvents: arrayRemove(event.id)
        });
        setUserRsvpedEvents(prev => prev.filter(id => id !== event.id));
        toast.success("RSVP removed!");
      } else {
        await updateDoc(eventRef, {
          "reactions.rsvps": arrayUnion(uid),
        });
        await updateDoc(doc(db, "users", user.uid), {
          rsvpedEvents: arrayUnion(event.id),
          points: increment(5)
        });
        setUserRsvpedEvents(prev => [...prev, event.id]);
        setUserPoints(prev => prev + 5);
        toast.success("RSVP confirmed! +5 points");
      }

      // Refresh events
      const eventsQuery = query(collection(db, "projectEvents"), where("status", "==", "approved"));
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          projectId: data.projectId || "",
          projectName: data.projectName || "Unknown Project",
          projectTicker: data.projectTicker || "",
          projectLogo: data.projectLogo || "",
          title: data.title || "",
          description: data.description || "",
          date: data.date ? format(data.date.toDate(), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          time: data.date ? format(data.date.toDate(), "HH:mm") : "12:00",
          createdBy: data.createdBy || "",
          eventType: data.eventType || "general",
          link: data.link || "",
          status: data.status || "pending",
          isTokenGated: data.isTokenGated || false,
          tokenRequirement: data.tokenRequirement || { contractAddress: "", minBalance: 0 },
          isFeatured: data.isFeatured || false,
          votes: data.votes || 0,
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
    } catch (error) {
      console.error("Error updating RSVP:", error);
      toast.error("Failed to update RSVP");
    }
  };

  // ────────── Computed Values ──────────

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (filterType === "followed") {
      filtered = filtered.filter(event => followedProjects.includes(event.projectId));
    } else if (filterType === "featured") {
      filtered = filtered.filter(event => event.isFeatured);
    }

    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.projectName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [events, filterType, followedProjects, searchTerm]);

  const selectedDateEvents = useMemo(() => {
    return filteredEvents.filter(event => event.date === selectedDate);
  }, [filteredEvents, selectedDate]);

  // ────────── Render ──────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-gray-400 mt-4">Loading calendar...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col">
      <Header />
      <Toaster position="top-right" />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">📅 Event Calendar</h1>
          <p className="text-gray-400">Stay updated with the latest events in the Base ecosystem</p>
        </div>

        {/* User Stats */}
        {user && (
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-800/30 rounded-lg">
            <div className="flex items-center gap-2">
              <FiAward className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-medium">Points: {userPoints}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiUser className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium">RSVPs: {userRsvpedEvents.length}</span>
            </div>
            {userBadges.length > 0 && (
              <div className="flex items-center gap-2">
                <FiShield className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">Badges: {userBadges.join(", ")}</span>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentWeek(prev => prev - 1)}
              className="p-2 bg-gray-800 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentWeek(prev => prev + 1)}
              className="p-2 bg-gray-800 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300"
          >
            <option value="all">All Events</option>
            <option value="followed">Followed Projects</option>
            <option value="featured">Featured Events</option>
          </select>

          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 placeholder-gray-500"
          />

          <button
            onClick={() => setShowAddEventModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiPlus className="w-4 h-4 inline mr-2" />
            Add Event
          </button>

          <button
            onClick={() => setShowSubmitProjectModal(true)}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FiPlus className="w-4 h-4 inline mr-2" />
            Submit Project
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-4 mb-8">
          {weekDates.map((day) => (
            <div
              key={day.fullDate}
              onClick={() => setSelectedDate(day.fullDate)}
              className={`p-4 rounded-lg cursor-pointer transition-colors ${
                selectedDate === day.fullDate
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <div className="text-sm font-medium">{day.day}</div>
              <div className="text-2xl font-bold">{day.date}</div>
              <div className="text-xs mt-2">
                {filteredEvents.filter(event => event.date === day.fullDate).length} events
              </div>
            </div>
          ))}
        </div>

        {/* Selected Date Events */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-6">
            Events for {format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}
          </h2>
          
          {selectedDateEvents.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No events scheduled for this date</p>
          ) : (
            <div className="space-y-4">
              {selectedDateEvents.map((event) => (
                <div key={event.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-white">{event.title}</h3>
                    <span className="text-sm text-gray-400">{event.time}</span>
                  </div>
                  <p className="text-gray-300 mb-2">{event.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <span>{event.projectName}</span>
                    <span>{event.eventType}</span>
                    {event.link && (
                      <a href={event.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                        <FiLink className="w-4 h-4 inline mr-1" />
                        Link
                      </a>
                    )}
                  </div>
                  
                  {/* Event Actions */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleEngagement(event, "like")}
                      className={`flex items-center gap-1 px-3 py-1 rounded ${
                        event.reactions.likes.includes(user?.uid || "")
                          ? "bg-blue-600 text-white"
                          : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                      }`}
                    >
                      <FiThumbsUp className="w-4 h-4" />
                      {event.reactions.likes.length}
                    </button>
                    
                    <button
                      onClick={() => handleEngagement(event, "dislike")}
                      className={`flex items-center gap-1 px-3 py-1 rounded ${
                        event.reactions.dislikes.includes(user?.uid || "")
                          ? "bg-red-600 text-white"
                          : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                      }`}
                    >
                      <FiThumbsDown className="w-4 h-4" />
                      {event.reactions.dislikes.length}
                    </button>
                    
                    <button
                      onClick={() => handleRSVP(event)}
                      className={`flex items-center gap-1 px-3 py-1 rounded ${
                        event.reactions.rsvps.includes(user?.uid || "")
                          ? "bg-green-600 text-white"
                          : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                      }`}
                    >
                      <FiBell className="w-4 h-4" />
                      RSVP ({event.reactions.rsvps.length})
                    </button>
                    
                    <button
                      onClick={() => {
                        setDiscussionEvent(event);
                        setShowDiscussionPanel(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-gray-300 rounded hover:bg-gray-500"
                    >
                      <FiMessageSquare className="w-4 h-4" />
                      Comments ({event.reactions.comments.length})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Discussion Panel */}
      <AnimatePresence>
        {showDiscussionPanel && discussionEvent && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-700 p-6 overflow-y-auto z-50"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Discussion</h3>
              <button
                onClick={() => setShowDiscussionPanel(false)}
                className="text-gray-400 hover:text-white"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {discussionEvent.reactions.comments.map((comment, index) => (
                <div key={index} className="bg-gray-800 p-3 rounded-lg">
                  <p className="text-gray-300 text-sm">{comment.text}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {format(comment.timestamp.toDate(), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
              ))}
              
              {user && (
                <div className="mt-4">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                    rows={3}
                  />
                  <button
                    onClick={() => handleCommentSubmit(discussionEvent)}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Post Comment
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Event Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-white mb-4">Add New Event</h3>
            <div className="space-y-4">
              <select
                value={newEvent.projectId}
                onChange={(e) => setNewEvent({ ...newEvent, projectId: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">Select Project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.ticker})
                  </option>
                ))}
              </select>
              
              <input
                type="text"
                placeholder="Event Title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              
              <textarea
                placeholder="Event Description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-24"
              />
              
              <input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              
              <input
                type="time"
                value={newEvent.time}
                onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              
              <select
                value={newEvent.eventType}
                onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="general">General</option>
                <option value="ama">AMA</option>
                <option value="giveaway">Giveaway</option>
                <option value="update">Update</option>
                <option value="launch">Launch</option>
              </select>
              
              <input
                type="url"
                placeholder="Event Link (optional)"
                value={newEvent.link}
                onChange={(e) => setNewEvent({ ...newEvent, link: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              
              <div className="flex gap-4">
                <button
                  onClick={handleAddEvent}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Add Event
                </button>
                <button
                  onClick={() => setShowAddEventModal(false)}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Submit Project Modal */}
      {showSubmitProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-white mb-4">Submit New Project</h3>
            
            {/* Wallet Connection Status */}
            <div className={`p-3 rounded-lg mb-4 ${
              walletAddress ? 'bg-green-900/20 border border-green-600' : 'bg-red-900/20 border border-red-600'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${walletAddress ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">
                  {walletAddress 
                    ? `Wallet Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                    : 'Please connect your wallet to submit a project'
                  }
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Project Name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              
              <input
                type="text"
                placeholder="Ticker"
                value={newProject.ticker}
                onChange={(e) => setNewProject({ ...newProject, ticker: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              
              <textarea
                placeholder="Project Description"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-24"
              />
              
              <input
                type="text"
                placeholder="Contract Address"
                value={newProject.contractAddress}
                onChange={(e) => setNewProject({ ...newProject, contractAddress: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              
              <input
                type="url"
                placeholder="Website"
                value={newProject.website}
                onChange={(e) => setNewProject({ ...newProject, website: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleVerifyOwnership}
                  disabled={isVerifyingOwnership || !walletAddress || !newProject.contractAddress.trim()}
                  className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                    signature 
                      ? 'bg-green-600 text-white cursor-default' 
                      : isVerifyingOwnership 
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : !walletAddress || !newProject.contractAddress.trim()
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {signature 
                    ? '✅ Ownership Verified' 
                    : isVerifyingOwnership 
                      ? 'Verifying...' 
                      : !walletAddress 
                        ? 'Connect Wallet First'
                        : !newProject.contractAddress.trim()
                          ? 'Enter Contract Address First'
                          : '🔐 Verify Ownership with Wallet'
                  }
                </button>
                {signature && (
                  <div className="text-xs text-gray-400 bg-gray-700 p-2 rounded">
                    Signature: {signature.slice(0, 20)}...{signature.slice(-20)}
                  </div>
                )}
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={handleSubmitProject}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700"
                >
                  Submit Project
                </button>
                <button
                  onClick={() => setShowSubmitProjectModal(false)}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  );
}