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
  FiCalendar,
} from "react-icons/fi";
import { format, parseISO } from "date-fns";
import toast, { Toaster } from "react-hot-toast";
import { useAuth, useWalletSystem } from "@/app/providers";
import { useSignMessage } from "wagmi";
import Header from "../components/Header";
import Footer from "../components/Footer";

// Mobile detection hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
};

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
  attendedEvents?: Array<{
    eventId: string;
    eventTitle: string;
    attendanceTime: string;
    wasLate: boolean;
    minutesLate: number;
  }>;
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
  const { selfCustodialWallet } = useWalletSystem();
  const isMobile = useIsMobile();
  
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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
  const walletAddress = selfCustodialWallet?.address;
  const { signMessage, data: signatureData } = useSignMessage();
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
          setUserProfile(userData); // Set userProfile state
        }

        // Fetch events from projectEvents collection
        const eventsQuery = query(collection(db, "projectEvents"), where("status", "==", "approved"));
        const eventsSnapshot = await getDocs(eventsQuery);
        const eventsData = eventsSnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Handle date formatting properly
          let formattedDate = format(new Date(), "yyyy-MM-dd");
          let formattedTime = "12:00";
          
          if (data.date) {
            try {
              if (data.date.toDate) {
                // Firestore Timestamp
                formattedDate = format(data.date.toDate(), "yyyy-MM-dd");
                formattedTime = format(data.date.toDate(), "HH:mm");
              } else if (data.date instanceof Date) {
                // JavaScript Date
                formattedDate = format(data.date, "yyyy-MM-dd");
                formattedTime = format(data.date, "HH:mm");
              } else if (typeof data.date === 'string') {
                // String date
                const dateObj = new Date(data.date);
                if (!isNaN(dateObj.getTime())) {
                  formattedDate = format(dateObj, "yyyy-MM-dd");
                  formattedTime = format(dateObj, "HH:mm");
                }
              }
            } catch (error) {
              console.error("Error formatting date:", error);
            }
          }
          
          return {
            id: doc.id,
            projectId: data.projectId || "",
            projectName: data.projectName || "Unknown Project",
            projectTicker: data.projectTicker || "",
            projectLogo: data.projectLogo || "",
            title: data.title || "",
            description: data.description || "",
            date: formattedDate,
            time: formattedTime,
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
        // Only show error toast for actual network/database errors
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
      toast.error("Please create or connect your XWallet first");
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
    if (!user || !walletAddress) {
      toast.error("Please log in and create or connect your XWallet to add events");
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

      // Add event to Firestore
      const eventRef = await addDoc(collection(db, "projectEvents"), eventData);
      
      // Award points for creating event
      const pointsResponse = await fetch('/api/points/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          userId: user.uid,
          eventId: eventRef.id,
          action: 'create_event',
          eventTitle: newEvent.title
        })
      });

      if (pointsResponse.ok) {
        const pointsData = await pointsResponse.json();
        setUserPoints(prev => prev + pointsData.pointsEarned);
        toast.success(`Event submitted for approval! +${pointsData.pointsEarned} points`);
      } else {
        toast.success("Event submitted for approval!");
      }

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
        code: error instanceof Error ? (error as { code?: string }).code : "Unknown",
        stack: error instanceof Error ? error.stack : "No stack trace"
      });
      toast.error("Failed to submit project");
    }
  };

  const handleEngagement = async (event: Event, action: "like" | "dislike") => {
    if (!user || !walletAddress) {
      toast.error("Please log in and create or connect your XWallet to interact with events");
      return;
    }

    try {
      // Call points API for calendar engagement
      const pointsResponse = await fetch('/api/points/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          userId: user.uid,
          eventId: event.id,
          action,
          eventTitle: event.title
        })
      });

      if (!pointsResponse.ok) {
        const errorData = await pointsResponse.json();
        if (errorData.error?.includes('Daily limit')) {
          toast.error(`Daily limit reached for ${action}`);
        } else if (errorData.alreadyPerformed) {
          toast.error(errorData.error);
        } else {
          toast.error("Failed to process engagement");
        }
        return;
      }

      const pointsData = await pointsResponse.json();
      
      // Update local state
      setUserPoints(prev => prev + pointsData.pointsEarned);
      const actionText = action === 'like' ? 'Liked' : 'Disliked';
      const pointsText = pointsData.pointsEarned >= 0 ? `+${pointsData.pointsEarned}` : `${pointsData.pointsEarned}`;
      toast.success(`${actionText}! ${pointsText} points`);

      // Update Firestore event reactions
      const eventRef = doc(db, "projectEvents", event.id);
      const uid = user.uid;
      const isLiked = event.reactions.likes.includes(uid);
      const isDisliked = event.reactions.dislikes.includes(uid);

      if (action === "like") {
        await updateDoc(eventRef, {
          "reactions.likes": isLiked ? arrayRemove(uid) : arrayUnion(uid),
          "reactions.dislikes": isDisliked ? arrayRemove(uid) : event.reactions.dislikes,
        });
      } else {
        await updateDoc(eventRef, {
          "reactions.dislikes": isDisliked ? arrayRemove(uid) : arrayUnion(uid),
          "reactions.likes": isLiked ? arrayRemove(uid) : event.reactions.likes,
        });
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
    if (!user || !walletAddress) {
      toast.error("Please log in and create or connect your XWallet to comment");
      return;
    }

    if (!commentText.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    try {
      // Call points API for calendar comment
      const pointsResponse = await fetch('/api/points/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          userId: user.uid,
          eventId: event.id,
          action: 'comment',
          eventTitle: event.title,
          comment: commentText.trim()
        })
      });

      if (!pointsResponse.ok) {
        const errorData = await pointsResponse.json();
        if (errorData.error?.includes('Daily limit')) {
          toast.error("Daily comment limit reached");
        } else if (errorData.alreadyPerformed) {
          toast.error(errorData.error);
        } else {
          toast.error("Failed to post comment");
        }
        return;
      }

      const pointsData = await pointsResponse.json();
      
      // Update Firestore event comments first
      const eventRef = doc(db, "projectEvents", event.id);
      const newComment = {
        userId: user.uid,
        text: commentText.trim(),
        timestamp: Timestamp.now(),
      };

      await updateDoc(eventRef, {
        "reactions.comments": arrayUnion(newComment),
      });
      
      // Update local state and show success message
      setUserPoints(prev => prev + pointsData.pointsEarned);
      setCommentText("");
      toast.success(`Comment posted! +${pointsData.pointsEarned} points`);

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
    if (!user || !walletAddress) {
      toast.error("Please log in and create or connect your XWallet to RSVP");
      return;
    }

    try {
      const eventRef = doc(db, "projectEvents", event.id);
      const uid = user.uid;
      const isGoing = event.reactions.rsvps.includes(uid);

      if (isGoing) {
        // Remove RSVP with point deduction
        const pointsResponse = await fetch('/api/points/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            userId: user.uid,
            eventId: event.id,
            action: 'unrsvp',
            eventTitle: event.title
          })
        });

        if (!pointsResponse.ok) {
          const errorData = await pointsResponse.json();
          if (errorData.error?.includes('Daily limit')) {
            toast.error("Daily un-RSVP limit reached");
          } else if (errorData.alreadyPerformed) {
            toast.error(errorData.error);
          } else {
            toast.error("Failed to un-RSVP");
          }
          return;
        }

        const pointsData = await pointsResponse.json();
        
        // Update Firestore
        try {
          await updateDoc(eventRef, {
            "reactions.rsvps": arrayRemove(uid),
          });
          await updateDoc(doc(db, "users", user.uid), {
            rsvpedEvents: arrayRemove(event.id)
          });
        } catch (error) {
          console.error("Error updating Firestore for un-RSVP:", error);
          toast.error("Failed to update RSVP status");
          return;
        }
        
        // Update local state
        setUserRsvpedEvents(prev => prev.filter(id => id !== event.id));
        setUserPoints(prev => prev + pointsData.pointsEarned);
        
        // Update local events state to reflect the un-RSVP
        setEvents(prevEvents => 
          prevEvents.map(evt => 
            evt.id === event.id 
              ? { ...evt, reactions: { ...evt.reactions, rsvps: evt.reactions.rsvps.filter(id => id !== user.uid) } }
              : evt
          )
        );
        
        const pointsText = pointsData.pointsEarned >= 0 ? `+${pointsData.pointsEarned}` : `${pointsData.pointsEarned}`;
        toast.success(`RSVP removed! ${pointsText} points`);
      } else {
        // Add RSVP with points
        const pointsResponse = await fetch('/api/points/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            userId: user.uid,
            eventId: event.id,
            action: 'rsvp',
            eventTitle: event.title
          })
        });

        if (!pointsResponse.ok) {
          const errorData = await pointsResponse.json();
          if (errorData.error?.includes('Daily limit')) {
            toast.error("Daily RSVP limit reached");
          } else if (errorData.alreadyPerformed) {
            toast.error(errorData.error);
          } else {
            toast.error("Failed to RSVP");
          }
          return;
        }

        const pointsData = await pointsResponse.json();
        
        // Update Firestore
        try {
          await updateDoc(eventRef, {
            "reactions.rsvps": arrayUnion(uid),
          });
          await updateDoc(doc(db, "users", user.uid), {
            rsvpedEvents: arrayUnion(event.id)
          });
        } catch (error) {
          console.error("Error updating Firestore for RSVP:", error);
          toast.error("Failed to update RSVP status");
          return;
        }
        
        // Update local state
        setUserRsvpedEvents(prev => [...prev, event.id]);
        setUserPoints(prev => prev + pointsData.pointsEarned);
        
        // Update local events state to reflect the RSVP
        setEvents(prevEvents => 
          prevEvents.map(evt => 
            evt.id === event.id 
              ? { ...evt, reactions: { ...evt.reactions, rsvps: [...evt.reactions.rsvps, user.uid] } }
              : evt
          )
        );
        
        toast.success(`RSVP confirmed! +${pointsData.pointsEarned} points`);
      }

      // Remove the unnecessary events refresh that was causing events to disappear
      // const eventsQuery = query(collection(db, "projectEvents"), where("status", "==", "approved"));
      // const eventsSnapshot = await getDocs(eventsQuery);
      // const eventsData = eventsSnapshot.docs.map(doc => ({
      //   id: doc.id,
      //   ...doc.data(),
      // })) as Event[];
      // setEvents(eventsData);
    } catch (error) {
      console.error("Error handling RSVP:", error);
      toast.error("Failed to update RSVP");
    }
  };

  // ─── Handle Event Attendance ───
  const handleEventAttendance = async (event: Event) => {
    if (!user || !walletAddress) {
      toast.error("Please log in and create or connect your XWallet to track attendance");
      return;
    }

    // Check if user has RSVP'd
    if (!event.reactions.rsvps.includes(user.uid)) {
      toast.error("You must RSVP to an event before attending");
      return;
    }

    try {
      const now = new Date();
      const eventDateTime = new Date(`${event.date}T${event.time}`);
      const attendanceTime = now.toISOString();
      
      // Calculate if user is on time or late
      const timeDifference = now.getTime() - eventDateTime.getTime();
      const minutesDifference = timeDifference / (1000 * 60);
      
      let action: 'attend' | 'attend_late';
      let message: string;
      
      if (minutesDifference <= 15) {
        // On time (within 15 minutes of event start)
        action = 'attend';
        message = "Great! You're on time! +30 points";
      } else if (minutesDifference <= 60) {
        // Late but within 1 hour
        action = 'attend_late';
        message = "You're a bit late, but still welcome! +20 points";
      } else {
        // Too late (more than 1 hour late)
        toast.error("You're too late for this event. Please RSVP to future events on time.");
        return;
      }

      // Track attendance with points
      const pointsResponse = await fetch('/api/points/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          userId: user.uid,
          eventId: event.id,
          action,
          eventTitle: event.title,
          eventTime: eventDateTime.toISOString(),
          attendanceTime
        })
      });

      if (!pointsResponse.ok) {
        const errorData = await pointsResponse.json();
        if (errorData.error?.includes('Daily limit')) {
          toast.error("Daily attendance limit reached");
        } else if (errorData.alreadyPerformed) {
          toast.error("You have already attended this event");
        } else {
          toast.error("Failed to track attendance");
        }
        return;
      }

      const pointsData = await pointsResponse.json();
      
      // Update user points
      setUserPoints(prev => prev + pointsData.pointsEarned);
      
      // Show appropriate message
      if (minutesDifference <= 15) {
        toast.success(message);
      } else if (minutesDifference <= 60) {
        toast.success(message);
      }
      
      // Update attendance tracking in Firestore
      try {
        await updateDoc(doc(db, "users", user.uid), {
          attendedEvents: arrayUnion({
            eventId: event.id,
            eventTitle: event.title,
            attendanceTime,
            wasLate: minutesDifference > 15,
            minutesLate: minutesDifference > 15 ? minutesDifference : 0
          })
        });
        
        // Update local user profile state
        if (userProfile) {
          setUserProfile({
            ...userProfile,
            attendedEvents: [
              ...(userProfile.attendedEvents || []),
              {
                eventId: event.id,
                eventTitle: event.title,
                attendanceTime,
                wasLate: minutesDifference > 15,
                minutesLate: minutesDifference > 15 ? minutesDifference : 0
              }
            ]
          });
        }
      } catch (error) {
        console.error("Error updating attendance tracking:", error);
        // Don't fail the entire request if attendance tracking fails
      }

    } catch (error) {
      console.error("Error tracking attendance:", error);
      toast.error("Failed to track attendance");
    }
  };

  // ─── Handle Event Link Click ───
  const handleEventLinkClick = async (event: Event) => {
    if (!event.link) {
      toast.error("No link available for this event");
      return;
    }

    // Track attendance if user has RSVP'd
    if (user && walletAddress && event.reactions.rsvps.includes(user.uid)) {
      await handleEventAttendance(event);
    }

    // Open the event link
    window.open(event.link, '_blank');
  };

  // ─── Check Attendance Status ───
  const hasAttendedEvent = (eventId: string): boolean => {
    if (!userProfile?.attendedEvents) return false;
    return userProfile.attendedEvents.some((attendance) => attendance.eventId === eventId);
  };

  const getAttendanceStatus = (eventId: string): { attended: boolean; wasLate: boolean; minutesLate: number } => {
    if (!userProfile?.attendedEvents) return { attended: false, wasLate: false, minutesLate: 0 };
    
    const attendance = userProfile.attendedEvents.find((att) => att.eventId === eventId);
    if (!attendance) return { attended: false, wasLate: false, minutesLate: 0 };
    
    return {
      attended: true,
      wasLate: attendance.wasLate,
      minutesLate: attendance.minutesLate
    };
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
      
      <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
        {/* Enhanced Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-5xl font-bold text-white mb-3">📅 Event Calendar</h1>
              <p className="text-lg text-gray-400 max-w-2xl">Stay updated with the latest events, AMAs, launches, and community gatherings in the Base ecosystem</p>
            </div>
            
            {/* Enhanced User Stats Card */}
            {user && (
              <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6 min-w-[300px]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500/80 to-purple-600/80 rounded-full flex items-center justify-center">
                      <FiAward className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Your Points</p>
                      <p className="text-2xl font-bold text-white">{userPoints.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">RSVPs</p>
                    <p className="text-xl font-bold text-blue-400">{userRsvpedEvents.length}</p>
                  </div>
                </div>
                
                {userBadges.length > 0 && (
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-700">
                    <FiShield className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-gray-300">Badges: {userBadges.slice(0, 2).join(", ")}{userBadges.length > 2 && ` +${userBadges.length - 2} more`}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>



        {/* Enhanced Controls Section */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeek(prev => prev - 1)}
                className="p-3 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600 transition-all duration-200 hover:scale-105"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-white font-medium px-4">Week {currentWeek + 1}</span>
              <button
                onClick={() => setCurrentWeek(prev => prev + 1)}
                className="p-3 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600 transition-all duration-200 hover:scale-105"
              >
                <FiChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Controls */}
            <div className="flex gap-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
              >
                <option value="all">All Events</option>
                <option value="followed">Followed Projects</option>
                <option value="featured">Featured Events</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddEventModal(true)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600/80 to-blue-700/80 text-white rounded-lg hover:from-blue-700/90 hover:to-blue-800/90 transition-all duration-200 hover:scale-105 font-medium"
              >
                <FiPlus className="w-4 h-4 inline mr-2" />
                Add Event
              </button>

              <button
                onClick={() => setShowSubmitProjectModal(true)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 hover:scale-105 font-medium"
              >
                <FiPlus className="w-4 h-4 inline mr-2" />
                Submit Project
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Calendar Grid */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6 mb-8">
          <div className="grid grid-cols-7 gap-3">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center pb-3">
                <div className="text-sm font-medium text-gray-400">{day}</div>
              </div>
            ))}
            
            {/* Calendar Days */}
            {weekDates.map((day) => {
              const dayEvents = filteredEvents.filter(event => event.date === day.fullDate);
              const featuredEvents = dayEvents.filter(event => event.isFeatured);
              const regularEvents = dayEvents.filter(event => !event.isFeatured);
              const isToday = day.fullDate === format(new Date(), "yyyy-MM-dd");
              const isSelected = selectedDate === day.fullDate;
              
              return (
                <motion.div
                  key={day.fullDate}
                  onClick={() => setSelectedDate(day.fullDate)}
                  className={`relative p-4 rounded-xl cursor-pointer transition-all duration-300 min-h-[160px] flex flex-col group ${
                    isSelected
                      ? "bg-blue-600/20 text-white shadow-xl border-2 border-blue-400/50"
                      : isToday
                      ? "bg-green-600/20 text-white shadow-lg border-2 border-green-400/50"
                      : "bg-gray-800/80 text-gray-300 hover:bg-gray-700/80 hover:scale-105 hover:shadow-lg border border-gray-600/50 hover:border-gray-500/50"
                  }`}
                  whileHover={{ 
                    scale: 1.03,
                    y: -2,
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className={`text-sm font-semibold ${
                      isSelected ? 'text-blue-200' : isToday ? 'text-green-100' : 'text-gray-400'
                    }`}>
                      {day.day}
                    </div>
                    {isToday && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-300 font-medium">TODAY</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Date Number */}
                  <div className={`text-3xl font-bold text-center mb-3 ${
                    isSelected ? 'text-white' : isToday ? 'text-green-100' : 'text-white'
                  }`}>
                    {day.date}
                  </div>
                  
                  {/* Event Summary */}
                  {dayEvents.length > 0 && (
                    <div className="mt-auto">
                      {/* Featured Events */}
                      {featuredEvents.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1 mb-1">
                            <FiAward className="w-3 h-3 text-yellow-400" />
                            <span className="text-xs font-medium text-yellow-300">Featured</span>
                          </div>
                          <div className="flex gap-1">
                            {featuredEvents.slice(0, 2).map((_, index) => (
                              <div
                                key={index}
                                className="w-1.5 h-1.5 bg-yellow-400 rounded-full"
                              />
                            ))}
                            {featuredEvents.length > 2 && (
                              <span className="text-xs text-yellow-300/70">+{featuredEvents.length - 2}</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Regular Events */}
                      {regularEvents.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <FiCalendar className="w-3 h-3 text-blue-300" />
                            <span className="text-xs font-medium text-blue-200">Events</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {regularEvents.slice(0, 4).map((event, index) => (
                              <div
                                key={index}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  event.eventType === 'ama' 
                                    ? 'bg-purple-400'
                                    : event.eventType === 'launch'
                                      ? 'bg-green-400'
                                      : event.eventType === 'giveaway'
                                        ? 'bg-yellow-400'
                                        : 'bg-blue-400'
                                }`}
                              />
                            ))}
                            {regularEvents.length > 4 && (
                              <span className="text-xs text-blue-200/70">+{regularEvents.length - 4}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Empty State */}
                  {dayEvents.length === 0 && (
                    <div className="mt-auto text-center">
                      <div className="w-1 h-1 bg-gray-500/30 rounded-full mx-auto"></div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Enhanced Events Display */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">
              Events for {format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}
            </h2>
            <div className="text-sm text-gray-400">
              {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          {selectedDateEvents.length === 0 ? (
            <div className="text-center py-12">
              <FiCalendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No events scheduled for this date</p>
              <p className="text-gray-500 text-sm mt-2">Be the first to add an event!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedDateEvents.map((event) => (
                <motion.div 
                  key={event.id} 
                  className={`backdrop-blur-sm rounded-xl border-2 p-6 transition-all duration-300 hover:scale-[1.02] ${
                    event.isFeatured 
                      ? "bg-yellow-500/10 border-yellow-500/30 shadow-lg shadow-yellow-500/10"
                      : event.eventType === 'ama'
                        ? "bg-purple-500/10 border-purple-500/30 shadow-lg shadow-purple-500/10"
                        : event.eventType === 'launch'
                          ? "bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/10"
                          : "bg-blue-500/5 border-blue-500/20 shadow-lg shadow-blue-500/5"
                  }`}
                  whileHover={{ 
                    y: -4,
                    transition: { duration: 0.2 }
                  }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-xl font-bold text-white">{event.title}</h3>
                        {event.isFeatured && (
                          <span className="px-3 py-1 bg-yellow-500/30 text-yellow-200 text-xs rounded-full border border-yellow-400/50 font-medium">
                            ⭐ Featured
                          </span>
                        )}
                        <span className={`px-3 py-1 text-xs rounded-full capitalize font-medium ${
                          event.eventType === 'ama' 
                            ? 'bg-purple-500/30 text-purple-200 border border-purple-400/50'
                            : event.eventType === 'launch'
                              ? 'bg-green-500/30 text-green-200 border border-green-400/50'
                              : 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                        }`}>
                          {event.eventType}
                        </span>
                      </div>
                      
                      <p className="text-gray-200 mb-4 leading-relaxed text-sm">{event.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mb-4">
                        <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1 rounded-lg">
                          <FiUser className="w-4 h-4 text-blue-300" />
                          <span className="font-medium">{event.projectName}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1 rounded-lg">
                          <FiCalendar className="w-4 h-4 text-green-400" />
                          <span className="font-medium">{event.time}</span>
                        </div>
                        {event.link && (
                                                  <button 
                          onClick={() => handleEventLinkClick(event)}
                          className="flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors bg-gray-800/50 px-3 py-1 rounded-lg"
                        >
                            <FiLink className="w-4 h-4" />
                            <span className="font-medium">Event Link</span>
                          </button>
                        )}
                        {/* Attendance Status Indicator */}
                        {user && hasAttendedEvent(event.id) && (
                          <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-lg border border-green-500/30">
                            <FiAward className="w-4 h-4" />
                            <span className="font-medium">
                              {getAttendanceStatus(event.id).wasLate ? 'Attended (Late)' : 'Attended'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Enhanced Event Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => handleEngagement(event, "like")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                          event.reactions.likes.includes(user?.uid || "")
                            ? "bg-green-600/20 text-green-200 border border-green-500/20"
                            : "bg-gray-700/80 text-gray-300 hover:bg-gray-600/80 border border-gray-600/50"
                        }`}
                      >
                        <FiThumbsUp className="w-4 h-4" />
                        <span>{event.reactions.likes.length}</span>
                      </button>
                      
                      <button
                        onClick={() => handleEngagement(event, "dislike")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                          event.reactions.dislikes.includes(user?.uid || "")
                            ? "bg-red-600/20 text-red-200 border border-red-500/20"
                            : "bg-gray-700/80 text-gray-300 hover:bg-gray-600/80 border border-gray-600/50"
                        }`}
                      >
                        <FiThumbsDown className="w-4 h-4" />
                        <span>{event.reactions.dislikes.length}</span>
                      </button>
                      
                      <button
                        onClick={() => handleRSVP(event)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                          event.reactions.rsvps.includes(user?.uid || "")
                            ? "bg-green-600/20 text-green-200 border border-green-500/20"
                            : "bg-gray-700/80 text-gray-300 hover:bg-gray-600/80 border border-gray-600/50"
                        }`}
                      >
                        <FiBell className="w-4 h-4" />
                        <span>RSVP ({event.reactions.rsvps.length})</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setDiscussionEvent(event);
                          setShowDiscussionPanel(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700/80 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-600/80 border border-gray-600/50 transition-all duration-200 hover:scale-105"
                      >
                        <FiMessageSquare className="w-4 h-4" />
                        <span>Comments ({event.reactions.comments.length})</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* My RSVP Events Section - Moved underneath main events */}
        {user && userRsvpedEvents.length > 0 && (
          <div className="mt-8">
            <div className="bg-gradient-to-r from-blue-900/20 to-gray-900/20 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                    <FiBell className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">My RSVP Events</h2>
                    <p className="text-sm text-gray-400">Events you&apos;ve confirmed attendance for</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-300">{userRsvpedEvents.length}</p>
                  <p className="text-sm text-gray-400">Confirmed</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events
                  .filter(event => userRsvpedEvents.includes(event.id))
                  .map((event) => (
                    <motion.div 
                      key={event.id} 
                      className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-blue-500/20 p-4 hover:border-blue-400/30 transition-all duration-200"
                      whileHover={{ y: -2 }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white line-clamp-2">{event.title}</h3>
                        {event.isFeatured && (
                          <span className="px-2 py-1 bg-yellow-500/30 text-yellow-200 text-xs rounded-full border border-yellow-400/50 font-medium ml-2">
                            ⭐
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{event.description}</p>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                        <FiUser className="w-3 h-3" />
                        <span>{event.projectName}</span>
                        <span>•</span>
                        <FiCalendar className="w-3 h-3" />
                        <span>{event.date} at {event.time}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEventLinkClick(event)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600/20 text-green-200 rounded-lg text-sm font-medium hover:bg-green-600/30 transition-colors border border-green-500/20"
                        >
                          <FiLink className="w-3 h-3" />
                          <span>Join Event</span>
                        </button>
                        
                        <button
                          onClick={() => handleRSVP(event)}
                          className="px-3 py-2 bg-red-600/20 text-red-200 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-colors border border-red-500/20"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Enhanced Discussion Panel */}
      <AnimatePresence>
        {showDiscussionPanel && discussionEvent && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className={`fixed top-0 right-0 h-full bg-gradient-to-br from-gray-900 to-gray-800 border-l border-gray-700 overflow-hidden z-50 ${
              isMobile ? 'w-full' : 'w-[500px]'
            }`}
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Event Discussion</h3>
                    <p className="text-gray-400 text-sm">{discussionEvent.title}</p>
                  </div>
                  <button
                    onClick={() => setShowDiscussionPanel(false)}
                    className="p-2 bg-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Comments Section */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {discussionEvent.reactions.comments.length === 0 ? (
                    <div className="text-center py-12">
                      <FiMessageSquare className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-400">No comments yet</p>
                      <p className="text-gray-500 text-sm mt-2">Be the first to comment!</p>
                    </div>
                  ) : (
                    discussionEvent.reactions.comments.map((comment, index) => (
                      <div key={index} className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <FiUser className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-300 leading-relaxed">{comment.text}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {format(comment.timestamp.toDate(), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Comment Input */}
              {user && (
                <div className="bg-gray-800/50 backdrop-blur-sm border-t border-gray-700 p-6">
                  <div className="space-y-3">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Share your thoughts about this event..."
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-transparent resize-none"
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {commentText.length}/500 characters
                      </p>
                      <button
                        onClick={() => handleCommentSubmit(discussionEvent)}
                        disabled={!commentText.trim()}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        Post Comment
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Event Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg sm:text-xl font-bold text-white mb-4">Add New Event</h3>
            <div className="space-y-3 sm:space-y-4">
              <select
                value={newEvent.projectId}
                onChange={(e) => setNewEvent({ ...newEvent, projectId: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base"
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
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base"
              />
              
              <textarea
                placeholder="Event Description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-20 sm:h-24 text-sm sm:text-base"
              />
              
              <input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base"
              />
              
              <input
                type="time"
                value={newEvent.time}
                onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base"
              />
              
              <select
                value={newEvent.eventType}
                onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base"
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
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base"
              />
              
              <div className="flex gap-3 sm:gap-4">
                <button
                  onClick={handleAddEvent}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                >
                  Add Event
                </button>
                <button
                  onClick={() => setShowAddEventModal(false)}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 text-sm sm:text-base"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg sm:text-xl font-bold text-white mb-4">Submit New Project</h3>
            
            {/* Wallet Connection Status */}
            <div className={`p-3 rounded-lg mb-4 ${
              walletAddress ? 'bg-green-900/20 border border-green-600' : 'bg-red-900/20 border border-red-600'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${walletAddress ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">
                  {walletAddress 
                    ? `XWallet Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                    : 'Please create or connect your XWallet to submit a project'
                  }
                </span>
              </div>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <input
                type="text"
                placeholder="Project Name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base"
              />
              
              <input
                type="text"
                placeholder="Ticker"
                value={newProject.ticker}
                onChange={(e) => setNewProject({ ...newProject, ticker: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base"
              />
              
              <textarea
                placeholder="Project Description"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-20 sm:h-24 text-sm sm:text-base"
              />
              
              <input
                type="text"
                placeholder="Contract Address"
                value={newProject.contractAddress}
                onChange={(e) => setNewProject({ ...newProject, contractAddress: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base"
              />
              
              <input
                type="url"
                placeholder="Website"
                value={newProject.website}
                onChange={(e) => setNewProject({ ...newProject, website: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm sm:text-base"
              />
              
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleVerifyOwnership}
                  disabled={isVerifyingOwnership || !walletAddress || !newProject.contractAddress.trim()}
                  className={`w-full px-3 sm:px-4 py-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${
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
                        ? 'Create XWallet First'
                        : !newProject.contractAddress.trim()
                          ? 'Enter Contract Address First'
                          : '🔐 Verify Ownership with XWallet'
                  }
                </button>
                {signature && (
                  <div className="text-xs text-gray-400 bg-gray-700 p-2 rounded">
                    Signature: {signature.slice(0, 20)}...{signature.slice(-20)}
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 sm:gap-4">
                <button
                  onClick={handleSubmitProject}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 text-sm sm:text-base"
                >
                  Submit Project
                </button>
                <button
                  onClick={() => setShowSubmitProjectModal(false)}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 text-sm sm:text-base"
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