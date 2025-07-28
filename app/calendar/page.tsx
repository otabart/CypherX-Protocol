"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

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
  deleteDoc,
  Timestamp,
  setDoc,
  increment,
  onSnapshot,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type { User } from "firebase/auth";

import {
  FiThumbsUp,
  FiThumbsDown,
  FiPlus,
  FiLink,
  FiFilter,
  FiMessageSquare,
  FiEye,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiX,
  FiShield,
  FiEdit,
  FiTrash,
  FiShare2,
  FiLoader,
  FiInfo,
  FiMapPin,
  FiAnchor,
  FiBell,
  FiAward,
  FiUser,
  FiChevronsLeft,
} from "react-icons/fi";

import { format, isPast, isToday, isBefore, parseISO, differenceInSeconds } from "date-fns";

import Image from "next/image";

import toast, { Toaster } from "react-hot-toast";

import { ethers } from "ethers";

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
  isFeatured?: boolean; // New: For featured events
  votes: number; // New: For community voting
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
  rsvpedEvents: string[]; // New: List of RSVPed event IDs
}

interface DayEvents {
  events: Event[];
}

interface EventDay {
  day: string;
  date: string;
  fullDate: string;
  events: DayEvents;
}

interface Project {
  id: string;
  name: string;
  ticker: string;
  logo?: string;
}

interface EventCalendarProps {
  user: User | null;
  followedProjects: string[];
}

// ────────── Helpers ──────────

function timestampToDateTime(timestamp: Timestamp): { date: string; time: string } {
  const dt = timestamp.toDate();
  return {
    date: dt.toISOString().split("T")[0],
    time: dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

function getWeekDates(weekOffset: number = 0): { day: string; date: string; fullDate: string }[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const days: { day: string; date: string; fullDate: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      day: dayNames[i],
      date: d.getDate().toString(),
      fullDate: d.toISOString().split("T")[0],
    });
  }
  return days;
}

const chunkArray = (array: string[], size: number) =>
  Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, (i + 1) * size));

function getCountdown(eventDateTime: Date): string {
  const now = new Date();
  const diff = differenceInSeconds(eventDateTime, now);
  if (diff < 0) return "Event has ended";
  const days = Math.floor(diff / (3600 * 24));
  const hours = Math.floor((diff % (3600 * 24)) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

// ────────── Main Component ──────────

export default function EventCalendar({ user, followedProjects }: EventCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [eventData, setEventData] = useState<EventDay[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [showSubmitProjectModal, setShowSubmitProjectModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [newEvent, setNewEvent] = useState<{
    projectId: string;
    title: string;
    description: string;
    date: string;
    time: string;
    eventType: string;
    link: string;
    isTokenGated: boolean;
    tokenRequirement: { contractAddress: string; minBalance: number };
    isFeatured: boolean;
  }>({
    projectId: "",
    title: "",
    description: "",
    date: "",
    time: "",
    eventType: "AMA",
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
  const [eventTypeFilter, setEventTypeFilter] = useState("All");
  const [useFollowedFilter, setUseFollowedFilter] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof typeof newEvent, string>>>({});
  const [userPoints, setUserPoints] = useState(0);
  const [userBadges, setUserBadges] = useState<string[]>([]);
  const [userRsvpedEvents, setUserRsvpedEvents] = useState<string[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showDiscussionPanel, setShowDiscussionPanel] = useState(false);
  const [discussionEvent, setDiscussionEvent] = useState<Event | null>(null);
  const [dayEventsModal, setDayEventsModal] = useState<Event[]>([]);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [projectNotisEnabled, setProjectNotisEnabled] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<Event[]>([]);

  const weekDates1 = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekDates2 = useMemo(() => getWeekDates(weekOffset + 1), [weekOffset]);
  const allDates = useMemo(() => [...weekDates1, ...weekDates2], [weekDates1, weekDates2]);

  const twoWeekLabel = useMemo(() => {
    const start = parseISO(allDates[0].fullDate);
    const end = parseISO(allDates[allDates.length - 1].fullDate);
    const monthStart = format(start, "MMM d");
    const monthEnd = format(end, "MMM d, yyyy");
    return `${monthStart} – ${monthEnd}`;
  }, [allDates]);

  // Fetch user points, badges, and RSVPed events
  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        try {
          const userRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userRef);
          const data = userDoc.data() as UserProfile;
          setUserPoints(data?.points || 0);
          setUserBadges(data?.badges || []);
          setUserRsvpedEvents(data?.rsvpedEvents || []);
        } catch (err) {
          console.error("Error fetching user data:", err);
          setUserPoints(0);
          setUserBadges([]);
          setUserRsvpedEvents([]);
          toast.error("Failed to load user data. Check permissions.");
        }
      };
      fetchUserData();
    }
  }, [user]);

  // ─── Points System with Action Limits ───
  const handlePoints = useCallback(
    async (action: "view" | "like" | "dislike" | "comment" | "rsvp" | "share" | "vote", projectId: string, pointsToAdd: number) => {
      if (!user) {
        toast.error("Please sign in to perform this action.");
        return false;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        let interactions: UserProfile["interactions"] = {};
        let currentPoints = 0;
        let currentBadges: string[] = [];
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          interactions = userData.interactions || {};
          currentPoints = userData.points || 0;
          currentBadges = userData.badges || [];
        }

        const actionKey = `${action}ed` as keyof UserProfile["interactions"][string];
        if (interactions[projectId]?.[actionKey]) {
          return false;
        }

        if (pointsToAdd < 0 && currentPoints + pointsToAdd < 0) {
          toast.error("You don't have enough points for this action.");
          return false;
        }

        await setDoc(
          userRef,
          {
            uid: user.uid,
            points: increment(pointsToAdd),
            email: user.email || "",
            interactions: {
              ...interactions,
              [projectId]: {
                ...interactions[projectId],
                [actionKey]: true,
              },
            },
          },
          { merge: true }
        );

        setUserPoints(currentPoints + pointsToAdd);
        toast.success(`Earned ${pointsToAdd} points for ${action}!`);

        // Badge logic example: Award 'Engager' badge if points > 50
        if (currentPoints + pointsToAdd > 50 && !currentBadges.includes("Engager")) {
          currentBadges.push("Engager");
          await updateDoc(userRef, { badges: currentBadges });
          setUserBadges(currentBadges);
          toast.success("You've earned the 'Engager' badge!");
        }

        return true;
      } catch {
        toast.error(`Failed to award points for ${action}.`);
        return false;
      }
    },
    [user]
  );

  // ─── Fetch Projects for Dropdown and Logos ───
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const q = query(collection(db, "tokenLaunch"), where("status", "==", "approved"));
        const snap = await getDocs(q);
        const list: Project[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.data().ticker || "Unknown",
          ticker: d.data().ticker || "N/A",
          logo: d.data().logo || "/fallback.png",
        }));
        setProjects(list);
      } catch {
        toast.error("Failed to load approved projects. Submit a project first if none exist.");
      }
    };
    fetchProjects();
  }, []);

  // ─── Fetch Event Data ───
  const fetchEventData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = new Date(allDates[0].fullDate + "T00:00:00.000Z");
      const endDate = new Date(allDates[allDates.length - 1].fullDate + "T23:59:59.999Z");
      const startTs = Timestamp.fromDate(startDate);
      const endTs = Timestamp.fromDate(endDate);

      const projectMap: Record<string, { name: string; ticker: string; logo: string }> = {};
      const projSnap = await getDocs(collection(db, "tokenLaunch"));
      projSnap.forEach((d) => {
        projectMap[d.id] = {
          name: d.data().name || d.data().ticker || "Unknown",
          ticker: d.data().ticker || "N/A",
          logo: d.data().logo || "/fallback.png",
        };
      });

      const eventCol = collection(db, "projectEvents");
      let docs: DocumentData[] = [];
      if (useFollowedFilter && followedProjects.length > 0) {
        const chunks = chunkArray(followedProjects, 10);
        for (const chunk of chunks) {
          const q = query(
            eventCol,
            where("date", ">=", startTs),
            where("date", "<=", endTs),
            where("projectId", "in", chunk),
            where("status", "==", "approved")
          );
          const snap = await getDocs(q);
          snap.forEach((d) => docs.push(d));
        }
      } else {
        const baseQ = query(
          eventCol,
          where("date", ">=", startTs),
          where("date", "<=", endTs),
          where("status", "==", "approved")
        );
        const snap = await getDocs(baseQ);
        docs = snap.docs;
      }

      const temp: Record<string, Event[]> = {};
      docs.forEach((d) => {
        const dt = d.data();
        const { date: dateStr, time: timeStr } = timestampToDateTime(dt.date);
        const ev: Event = {
          id: d.id,
          projectId: dt.projectId,
          projectName: projectMap[dt.projectId]?.name || "Unknown",
          projectTicker: projectMap[dt.projectId]?.ticker || "N/A",
          projectLogo: projectMap[dt.projectId]?.logo || "/fallback.png",
          title: dt.title,
          description: dt.description,
          date: dateStr,
          time: timeStr,
          createdBy: dt.createdBy,
          eventType: dt.eventType,
          link: dt.link || "",
          status: dt.status || "approved",
          isTokenGated: dt.isTokenGated || false,
          tokenRequirement: dt.tokenRequirement || { contractAddress: "", minBalance: 0 },
          isFeatured: dt.isFeatured || false,
          votes: dt.votes || 0,
          reactions: {
            likes: dt.reactions?.likes || [],
            dislikes: dt.reactions?.dislikes || [],
            comments: dt.reactions?.comments || [],
            views: dt.reactions?.views || [],
            rsvps: dt.reactions?.rsvps || [],
            pinned: dt.reactions?.pinned || [],
          },
        };

        if (eventTypeFilter !== "All" && ev.eventType !== eventTypeFilter) {
          return;
        }

        if (projectSearch && !ev.projectName.toLowerCase().includes(projectSearch.toLowerCase())) {
          return;
        }

        if (!temp[dateStr]) {
          temp[dateStr] = [];
        }
        temp[dateStr].push(ev);
      });

      const finalData: EventDay[] = allDates.map((wd) => ({
        day: wd.day,
        date: wd.date,
        fullDate: wd.fullDate,
        events: { events: temp[wd.fullDate] || [] },
      }));
      setEventData(finalData);

      // Set featured and trending
      const allEvents = finalData.flatMap((day) => day.events.events);
      setFeaturedEvents(allEvents.filter((ev) => ev.isFeatured));
      setTrendingEvents(allEvents.sort((a, b) => b.votes - a.votes).slice(0, 5));

      if (finalData.every((day) => day.events.events.length === 0)) {
        setError("No approved events found for these two weeks.");
      }
    } catch {
      toast.error("Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, [allDates, eventTypeFilter, useFollowedFilter, followedProjects, projectSearch]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  // ─── Token Gate Check ───
  const checkTokenGate = async (tokenRequirement: { contractAddress: string; minBalance: number }) => {
    if (!user) return false;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(tokenRequirement.contractAddress, ["function balanceOf(address) view returns (uint256)"], signer);
      const balance = await contract.balanceOf(await signer.getAddress());
      return balance.gte(tokenRequirement.minBalance);
    } catch {
      toast.error("Failed to check token balance.");
      return false;
    }
  };

  // ─── Engagement / RSVP / Comments / Views ───
  const handleView = useCallback(
    async (ev: Event) => {
      if (!user) {
        toast.error("Please sign in to view events.");
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        const interactions = userDoc.exists() ? (userDoc.data() as UserProfile).interactions || {} : {};
        const actionKey = "viewed" as keyof UserProfile["interactions"][string];
        if (interactions[ev.projectId]?.[actionKey]) {
          return;
        }

        const ref = doc(db, "projectEvents", ev.id);
        await updateDoc(ref, {
          "reactions.views": arrayUnion(user.uid),
        });
        await handlePoints("view", ev.projectId, 1);
        fetchEventData();

        if (selectedEvent?.id === ev.id) {
          setSelectedEvent({
            ...selectedEvent,
            reactions: {
              ...selectedEvent.reactions,
              views: [...selectedEvent.reactions.views, user.uid],
            },
          });
        }
      } catch {
        toast.error("Failed to update views.");
      }
    },
    [selectedEvent, fetchEventData, user, handlePoints]
  );

  const handleEngagement = useCallback(
    async (ev: Event, action: "like" | "dislike") => {
      if (!user) {
        toast.error("Please sign in to react.");
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        const interactions = userDoc.exists() ? (userDoc.data() as UserProfile).interactions || {} : {};
        const actionKey = `${action}ed` as keyof UserProfile["interactions"][string];
        if (interactions[ev.projectId]?.[actionKey]) {
          return;
        }

        const ref = doc(db, "projectEvents", ev.id);
        const uid = user.uid;
        const isLiked = ev.reactions.likes.includes(uid);
        const isDisliked = ev.reactions.dislikes.includes(uid);

        if (action === "like") {
          await updateDoc(ref, {
            "reactions.likes": isLiked ? arrayRemove(uid) : arrayUnion(uid),
            "reactions.dislikes": isDisliked ? arrayRemove(uid) : ev.reactions.dislikes,
          });
          if (!isLiked) await handlePoints("like", ev.projectId, 5);
        } else {
          await updateDoc(ref, {
            "reactions.dislikes": isDisliked ? arrayRemove(uid) : arrayUnion(uid),
            "reactions.likes": isLiked ? arrayRemove(uid) : ev.reactions.likes,
          });
          if (!isDisliked) await handlePoints("dislike", ev.projectId, 5);
        }

        fetchEventData();

        if (selectedEvent?.id === ev.id) {
          const newLikes =
            action === "like"
              ? isLiked
                ? selectedEvent.reactions.likes.filter((id) => id !== uid)
                : [...selectedEvent.reactions.likes, uid]
              : selectedEvent.reactions.likes;
          const newDislikes =
            action === "dislike"
              ? isDisliked
                ? selectedEvent.reactions.dislikes.filter((id) => id !== uid)
                : [...selectedEvent.reactions.dislikes, uid]
              : selectedEvent.reactions.dislikes;
          setSelectedEvent({
            ...selectedEvent,
            reactions: {
              ...selectedEvent.reactions,
              likes: newLikes,
              dislikes: newDislikes,
            },
          });
        }
      } catch {
        toast.error(`Failed to update ${action}.`);
      }
    },
    [user, selectedEvent, fetchEventData, handlePoints]
  );

  const handleCommentSubmit = useCallback(
    async (ev: Event) => {
      if (!user) {
        toast.error("Please sign in to comment.");
        return;
      }

      if (!commentText.trim()) {
        toast.error("Comment cannot be empty.");
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        const interactions = userDoc.exists() ? (userDoc.data() as UserProfile).interactions || {} : {};
        const actionKey = "commented" as keyof UserProfile["interactions"][string];
        if (interactions[ev.projectId]?.[actionKey]) {
          toast.error("You have already commented on this project.");
          return;
        }

        const ref = doc(db, "projectEvents", ev.id);
        const newComment = {
          userId: user.uid,
          text: commentText.trim(),
          timestamp: Timestamp.now(),
        };
        await updateDoc(ref, {
          "reactions.comments": arrayUnion(newComment),
        });
        await handlePoints("comment", ev.projectId, 10);
        setCommentText("");
        fetchEventData();

        if (discussionEvent?.id === ev.id) {
          setDiscussionEvent({
            ...discussionEvent,
            reactions: {
              ...discussionEvent.reactions,
              comments: [...discussionEvent.reactions.comments, newComment],
            },
          });
        }

        toast.success("Comment posted successfully!");
      } catch {
        toast.error("Failed to submit comment.");
      }
    },
    [user, commentText, discussionEvent, fetchEventData, handlePoints]
  );

  const handleRSVP = useCallback(
    async (ev: Event) => {
      if (!user) {
        toast.error("Please sign in to RSVP.");
        return;
      }

      if (ev.isTokenGated) {
        const hasToken = await checkTokenGate(ev.tokenRequirement!);
        if (!hasToken) {
          toast.error("You don't meet the token requirements for this event.");
          return;
        }
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        const interactions = userDoc.exists() ? (userDoc.data() as UserProfile).interactions || {} : {};
        const isGoing = ev.reactions.rsvps.includes(user.uid);
        const actionKey = "rsvped" as keyof UserProfile["interactions"][string];
        if (!isGoing && interactions[ev.projectId]?.[actionKey]) {
          toast.error("You have already RSVPed for this project.");
          return;
        }

        const ref = doc(db, "projectEvents", ev.id);
        const uid = user.uid;

        if (isGoing) {
          await updateDoc(ref, {
            "reactions.rsvps": arrayRemove(uid),
          });
          toast.success("RSVP removed!");
          // Update user RSVPed events
          setUserRsvpedEvents((prev) => prev.filter((id) => id !== ev.id));
          await updateDoc(userRef, { rsvpedEvents: arrayRemove(ev.id) });
        } else {
          await updateDoc(ref, {
            "reactions.rsvps": arrayUnion(uid),
          });
          await handlePoints("rsvp", ev.projectId, 5);
          toast.success("RSVP confirmed!");
          // Update user RSVPed events
          setUserRsvpedEvents((prev) => [...prev, ev.id]);
          await updateDoc(userRef, { rsvpedEvents: arrayUnion(ev.id) });
        }

        fetchEventData();

        if (selectedEvent?.id === ev.id) {
          const newRsvps = isGoing
            ? selectedEvent.reactions.rsvps.filter((id) => id !== uid)
            : [...selectedEvent.reactions.rsvps, uid];
          setSelectedEvent({
            ...selectedEvent,
            reactions: {
              ...selectedEvent.reactions,
              rsvps: newRsvps,
            },
          });
        }
      } catch {
        toast.error("Failed to update RSVP.");
      }
    },
    [user, selectedEvent, fetchEventData, handlePoints]
  );

  // ─── Set Reminder ───
  const handleSetReminder = (ev: Event) => {
    if (!("Notification" in window)) {
      toast.error("Browser does not support notifications.");
      return;
    }

    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        const eventTime = parseISO(`${ev.date}T${ev.time}`);
        const timeUntilEvent = eventTime.getTime() - Date.now();
        if (timeUntilEvent > 0) {
          setTimeout(() => {
            new Notification("Event Reminder", { body: `${ev.title} is starting soon!` });
          }, timeUntilEvent - 3600000); // 1 hour before
          toast.success("Reminder set for 1 hour before the event!");
        } else {
          toast.error("Event has already started or passed.");
        }
      }
    });
  };

  // ─── Toggle Featured ───
  const handleToggleFeatured = async (ev: Event) => {
    if (!isAdmin(user)) return;
    try {
      const ref = doc(db, "projectEvents", ev.id);
      await updateDoc(ref, { isFeatured: !ev.isFeatured });
      toast.success(`Event ${ev.isFeatured ? "unfeatured" : "featured"}!`);
      fetchEventData();
    } catch {
      toast.error("Failed to toggle featured status.");
    }
  };

  // ─── Vote for Event ───
  const handleVote = async (ev: Event) => {
    if (!user) {
      toast.error("Please sign in to vote.");
      return;
    }

    if (await handlePoints("vote", ev.projectId, -5)) {
      // Deduct 5 points for vote
      try {
        const ref = doc(db, "projectEvents", ev.id);
        await updateDoc(ref, { votes: increment(1) });
        toast.success("Vote cast! 5 points deducted.");
        fetchEventData();
      } catch {
        toast.error("Failed to vote.");
      }
    } else {
      toast.error("Not enough points to vote (requires 5 points).");
    }
  };

  // ─── Share Event ───
  const handleShareEvent = async (ev: Event) => {
    if (ev.link) {
      navigator.clipboard.writeText(ev.link);
      toast.success("Event link copied to clipboard!");
      await handlePoints("share", ev.projectId, 2);
    }
  };

  // ─── Share Profile ───
  const handleShareProfile = async () => {
    const profileLink = `https://example.com/profile/${user?.uid}`; // Replace with actual profile link
    navigator.clipboard.writeText(profileLink);
    toast.success("Profile link copied to clipboard!");
    await handlePoints("share", "profile", 2); // Arbitrary projectId for profile share
  };

  // ─── Edit Event ───
  const handleEditEvent = (ev: Event) => {
    if (!user || (!isAdmin(user) && user.uid !== ev.createdBy)) {
      toast.error("Only admins or event owners can edit events.");
      return;
    }

    setNewEvent({
      projectId: ev.projectId,
      title: ev.title,
      description: ev.description,
      date: ev.date,
      time: ev.time,
      eventType: ev.eventType,
      link: ev.link || "",
      isTokenGated: ev.isTokenGated || false,
      tokenRequirement: ev.tokenRequirement || { contractAddress: "", minBalance: 0 },
      isFeatured: ev.isFeatured || false,
    });
    setIsEdit(true);
    setShowCreateModal(true);
  };

  // ─── Delete Event ───
  const handleDeleteEvent = async (ev: Event) => {
    if (!user || (!isAdmin(user) && user.uid !== ev.createdBy)) {
      toast.error("Only admins or event owners can delete events.");
      return;
    }

    if (confirm("Are you sure you want to delete this event?")) {
      try {
        await deleteDoc(doc(db, "projectEvents", ev.id));
        setSelectedEvent(null);
        fetchEventData();
        toast.success("Event deleted successfully!");
      } catch {
        toast.error("Failed to delete event.");
      }
    }
  };

  // ─── Approve Event ───
  const handleApproveEvent = async (ev: Event) => {
    if (!isAdmin(user)) return;
    try {
      const ref = doc(db, "projectEvents", ev.id);
      await updateDoc(ref, { status: "approved" });
      toast.success("Event approved!");
      fetchEventData();
    } catch {
      toast.error("Failed to approve event.");
    }
  };

  // ─── Pin Comment ───
  const handlePinComment = useCallback(
    async (ev: Event, comment: { userId: string; text: string; timestamp: Timestamp }) => {
      if (!isAdmin(user)) return;
      try {
        const ref = doc(db, "projectEvents", ev.id);
        await updateDoc(ref, {
          "reactions.pinned": arrayUnion(comment),
          "reactions.comments": arrayRemove(comment),
        });
        toast.success("Comment pinned!");
        fetchEventData();
        if (discussionEvent?.id === ev.id) {
          setDiscussionEvent({
            ...discussionEvent,
            reactions: {
              ...discussionEvent.reactions,
              pinned: [...discussionEvent.reactions.pinned, comment],
              comments: discussionEvent.reactions.comments.filter((c) => c.timestamp !== comment.timestamp),
            },
          });
        }
      } catch {
        toast.error("Failed to pin.");
      }
    },
    [user, fetchEventData, discussionEvent]
  );

  // ─── Unpin Comment ───
  const handleUnpinComment = useCallback(
    async (ev: Event, comment: { userId: string; text: string; timestamp: Timestamp }) => {
      if (!isAdmin(user)) return;
      try {
        const ref = doc(db, "projectEvents", ev.id);
        await updateDoc(ref, {
          "reactions.comments": arrayUnion(comment),
          "reactions.pinned": arrayRemove(comment),
        });
        toast.success("Comment unpinned!");
        fetchEventData();
        if (discussionEvent?.id === ev.id) {
          setDiscussionEvent({
            ...discussionEvent,
            reactions: {
              ...discussionEvent.reactions,
              comments: [...discussionEvent.reactions.comments, comment],
              pinned: discussionEvent.reactions.pinned.filter((c) => c.timestamp !== comment.timestamp),
            },
          });
        }
      } catch {
        toast.error("Failed to unpin.");
      }
    },
    [user, fetchEventData, discussionEvent]
  );

  // ─── Save Event (Create or Update) ───
  const validateForm = () => {
    const errs: Partial<Record<keyof typeof newEvent, string>> = {};
    if (!newEvent.projectId) errs.projectId = "Project is required";
    if (!newEvent.title) errs.title = "Title is required";
    if (newEvent.title.length > 100) errs.title = "Title must be 100 characters or less";
    if (!newEvent.description) errs.description = "Description is required";
    if (newEvent.description.length > 1000) errs.description = "Description must be 1000 characters or less";
    if (!newEvent.date) errs.date = "Date is required";
    if (!newEvent.time) errs.time = "Time is required";
    if (newEvent.date && newEvent.time) {
      try {
        const dt = parseISO(`${newEvent.date}T${newEvent.time}`);
        if (isNaN(dt.getTime())) {
          errs.date = "Invalid date or time format";
        } else if (isBefore(dt, new Date())) {
          errs.date = "Cannot create event in the past";
        }
      } catch {
        errs.date = "Invalid date or time format";
      }
    }
    if (newEvent.eventType && newEvent.eventType.length > 50) errs.eventType = "Event type must be 50 characters or less";
    if (newEvent.link && !new RegExp("^https?://[^\\s]+$").test(newEvent.link)) {
      errs.link = "Invalid URL";
    }
    if (newEvent.link && newEvent.link.length > 500) errs.link = "Link must be 500 characters or less";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isAdmin = (user: User | null): boolean => {
    return user?.email === "homebasemarkets@gmail.com";
  };

  const handleSaveEvent = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to create an event.");
      return;
    }

    if (!validateForm()) {
      toast.error("Please correct the errors in the form.");
      return;
    }

    setIsCreating(true);
    try {
      const dt = parseISO(`${newEvent.date}T${newEvent.time}`);
      let eventToSave = {
        projectId: newEvent.projectId,
        title: newEvent.title,
        description: newEvent.description,
        date: Timestamp.fromDate(dt),
        createdBy: user.uid,
        eventType: newEvent.eventType,
        link: newEvent.link || "",
        isTokenGated: newEvent.isTokenGated,
        tokenRequirement: newEvent.tokenRequirement,
        isFeatured: newEvent.isFeatured,
        votes: 0,
        reactions: {
          likes: [],
          dislikes: [],
          comments: [],
          views: [],
          rsvps: [],
          pinned: [],
        },
        status: isEdit && selectedEvent ? selectedEvent.status : isAdmin(user) ? "approved" : "pending",
      };

      const projectRef = doc(db, "tokenLaunch", newEvent.projectId);
      const projectDoc = await getDoc(projectRef);
      if (!projectDoc.exists()) {
        toast.error("Selected project does not exist.");
        return;
      }

      let docRef;
      if (isEdit && selectedEvent) {
        docRef = doc(db, "projectEvents", selectedEvent.id);
        await updateDoc(docRef, eventToSave);
        toast.success("Event updated successfully!");
      } else {
        docRef = await addDoc(collection(db, "projectEvents"), eventToSave);
        await addDoc(collection(db, "notifications"), {
          type: "event",
          subjectId: docRef.id,
          projectId: newEvent.projectId,
          title: newEvent.title,
          when: Timestamp.now(),
        });

        if (!isAdmin(user)) {
          const unsubscribe = onSnapshot(doc(db, "projectEvents", docRef.id), (snap) => {
            if (snap.exists() && snap.data().status === "approved") {
              toast.success("Your event has been approved! Share to earn points.");
              unsubscribe();
            }
          });
          toast.success("Event submitted for review. We'll notify on approval.");
        } else {
          toast.success("Event created & approved!");
        }
      }

      setShowCreateModal(false);
      setIsEdit(false);
      setNewEvent({
        projectId: "",
        title: "",
        description: "",
        date: "",
        time: "",
        eventType: "AMA",
        link: "",
        isTokenGated: false,
        tokenRequirement: { contractAddress: "", minBalance: 0 },
        isFeatured: false,
      });
      setFormErrors({});
      fetchEventData();
    } catch {
      toast.error("Failed to save event. Check console for details.");
    } finally {
      setIsCreating(false);
    }
  }, [user, newEvent, isEdit, selectedEvent, fetchEventData]);

  const handleSubmitProject = async () => {
    if (!user) {
      toast.error("Please sign in to submit a project.");
      return;
    }

    if (
      !newProject.name ||
      !newProject.ticker ||
      !newProject.description ||
      !newProject.contractAddress ||
      !newProject.website ||
      !newProject.proofOfOwnership
    ) {
      toast.error("Please fill in all project fields.");
      return;
    }

    try {
      await addDoc(collection(db, "pendingProjects"), {
        name: newProject.name,
        ticker: newProject.ticker,
        description: newProject.description,
        contractAddress: newProject.contractAddress,
        website: newProject.website,
        proofOfOwnership: newProject.proofOfOwnership,
        submitterId: user.uid,
        submittedAt: Timestamp.now(),
        status: "pending",
        adminNotes: "",
      });
      setShowSubmitProjectModal(false);
      setNewProject({
        name: "",
        ticker: "",
        description: "",
        contractAddress: "",
        website: "",
        proofOfOwnership: "",
      });
      toast.success("Project submitted for review!");
    } catch {
      toast.error("Failed to submit project.");
    }
  };

  // ─── Render ───
  return (
    <div className="w-full h-full bg-gray-950 p-4 overflow-auto">
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <div className="flex items-center justify-center mb-4 gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setWeekOffset((prev) => prev - 1)}
          className="p-3 rounded-full bg-gray-900 hover:bg-gray-800 text-gray-100 shadow-md"
          aria-label="Previous two weeks"
        >
          <FiChevronLeft className="w-6 h-6" />
        </motion.button>
        <h1 className="text-2xl font-bold text-gray-100">{twoWeekLabel}</h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setWeekOffset((prev) => prev + 1)}
          className="p-3 rounded-full bg-gray-900 hover:bg-gray-800 text-gray-100 shadow-md"
          aria-label="Next two weeks"
        >
          <FiChevronRight className="w-6 h-6" />
        </motion.button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={eventTypeFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEventTypeFilter(e.target.value)}
          className="px-4 py-2 border border-blue-500/20 rounded-lg text-sm bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto flex-1 min-w-[140px] shadow-sm"
          aria-label="Filter events by type"
        >
          <option>All Events</option>
          <option>AMA</option>
          <option>Giveaway</option>
          <option>Update</option>
          <option>Other</option>
        </select>

        <input
          type="text"
          value={projectSearch}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectSearch(e.target.value)}
          placeholder="Search project..."
          className="px-4 py-2 border border-blue-500/20 rounded-lg text-sm bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto flex-1 min-w-[140px] shadow-sm"
          aria-label="Search projects"
        />

        {followedProjects.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setUseFollowedFilter((prev) => !prev)}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition w-full sm:w-auto min-w-[140px] shadow-sm ${
              useFollowedFilter
                ? "bg-blue-600 text-gray-100 hover:bg-blue-700"
                : "bg-gray-900 text-gray-100 hover:bg-gray-800 border border-blue-500/20"
            }`}
            aria-label={useFollowedFilter ? "Show all events" : "Show events from followed projects only"}
          >
            <FiFilter className="w-4 h-4" />
            {useFollowedFilter ? "All Events" : "Followed Only"}
          </motion.button>
        )}

        {user && (
          <motion.div className="ml-auto p-2 bg-gray-900 border border-blue-500/20 rounded-lg text-gray-100 text-sm flex items-center gap-3 shadow-sm min-w-[160px]">
            <span>Points: {userPoints}</span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPointsModal(true)}
              className="text-blue-400 hover:text-blue-300"
              aria-label="How to earn points"
            >
              <FiInfo className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowProfileModal(true)}
              className="text-blue-400 hover:text-blue-300"
              aria-label="View profile"
            >
              <FiUser className="w-5 h-5" />
            </motion.button>
          </motion.div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setIsEdit(false);
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-gray-100 rounded-lg text-sm flex items-center gap-2 shadow-md w-full sm:w-auto min-w-[140px]"
          aria-label="Create new event"
        >
          <FiPlus className="w-4 h-4" />
          Create Event
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowSubmitProjectModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-gray-100 rounded-lg text-sm flex items-center gap-2 shadow-md w-full sm:w-auto min-w-[140px]"
          aria-label="Submit new project"
        >
          <FiPlus className="w-4 h-4" />
          Submit Project
        </motion.button>

        {isAdmin(user) && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => alert("Admin Panel Placeholder")}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-gray-100 rounded-lg text-sm flex items-center gap-2 shadow-md w-full sm:w-auto min-w-[140px]"
            aria-label="Open Admin Panel"
          >
            <FiShield className="w-4 h-4" />
            Admin Panel
          </motion.button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setRemindersEnabled((prev) => !prev)}
          className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition min-w-[140px] shadow-sm ${
            remindersEnabled ? "bg-green-600 text-gray-100 hover:bg-green-700" : "bg-gray-900 text-gray-100 hover:bg-gray-800 border border-blue-500/20"
          }`}
        >
          <FiBell className="w-4 h-4" />
          Reminders {remindersEnabled ? "On" : "Off"}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setProjectNotisEnabled((prev) => !prev)}
          className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition min-w-[140px] shadow-sm ${
            projectNotisEnabled ? "bg-green-600 text-gray-100 hover:bg-green-700" : "bg-gray-900 text-gray-100 hover:bg-gray-800 border border-blue-500/20"
          }`}
        >
          <FiBell className="w-4 h-4" />
          Project Notis {projectNotisEnabled ? "On" : "Off"}
        </motion.button>
      </div>

      {/* Featured Events */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-100 mb-3">Featured Events</h2>
        <div className="flex overflow-x-auto gap-4 pb-3 scrollbar-thin scrollbar-thumb-blue-500/50 scrollbar-track-gray-900">
          {featuredEvents.map((ev) => (
            <motion.div
              key={ev.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gray-900 p-4 rounded-xl min-w-[220px] cursor-pointer shadow-lg border border-blue-500/10 hover:border-blue-500/30"
              onClick={() => setSelectedEvent(ev)}
            >
              <h3 className="text-md font-bold text-gray-100 mb-2">{ev.title}</h3>
              <p className="text-sm text-gray-400">{ev.date} at {ev.time}</p>
              {isAdmin(user) && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFeatured(ev);
                  }}
                  className="text-yellow-400 text-sm flex items-center gap-1 mt-2 hover:text-yellow-300"
                >
                  <FiAward className="w-4 h-4" />
                  {ev.isFeatured ? "Unfeature" : "Feature"}
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Trending Events */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-100 mb-3">Trending Events</h2>
        <div className="flex overflow-x-auto gap-4 pb-3 scrollbar-thin scrollbar-thumb-blue-500/50 scrollbar-track-gray-900">
          {trendingEvents.map((ev) => (
            <motion.div
              key={ev.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gray-900 p-4 rounded-xl min-w-[220px] cursor-pointer shadow-lg border border-blue-500/10 hover:border-blue-500/30"
              onClick={() => setSelectedEvent(ev)}
            >
              <h3 className="text-md font-bold text-gray-100 mb-2">{ev.title}</h3>
              <p className="text-sm text-gray-400">{ev.date} at {ev.time}</p>
              <p className="text-sm text-gray-400">Votes: {ev.votes}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 14 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-gray-900 animate-pulse border border-blue-500/20 aspect-square p-4 flex flex-col items-center justify-center rounded-xl shadow-sm"
            >
              <div className="h-6 bg-gray-800 w-1/3 mb-2 rounded"></div>
              <div className="h-4 bg-gray-800 w-1/4 rounded"></div>
            </div>
          ))}
        </div>
      ) : eventData.every((day) => day.events.events.length === 0) ? (
        <div className="text-center text-gray-100 py-8">
          <p className="text-md">{error}</p>
          {followedProjects.length > 0 && useFollowedFilter && (
            <p className="text-sm mt-2">Try showing all events instead of followed only.</p>
          )}
          {eventTypeFilter !== "All" && <p className="text-sm mt-2">Try setting event type filter to “All.”</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {eventData.map((day, idx) => {
            const isTodayDay = isToday(parseISO(day.fullDate));
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className={`bg-gray-900 border border-blue-500/20 aspect-square flex flex-col items-center p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow ${
                  isTodayDay ? "ring-2 ring-blue-500/40" : ""
                }`}
              >
                <div className="text-center mb-3">
                  <h2 className="text-lg font-bold text-blue-400">{day.day}</h2>
                  <p className="text-md text-gray-100">{day.date}</p>
                </div>

                <div className="w-full flex-1 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500/50 scrollbar-track-gray-900">
                  {day.events.events.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center flex-1 flex items-center justify-center">
                      No events today. RSVP or create one!
                    </p>
                  ) : (
                    <>
                      {day.events.events.slice(0, 2).map((ev) => {
                        const evDateTime = parseISO(`${ev.date}T${ev.time}`);
                        const isPastEvent = isPast(evDateTime);
                        const isGoing = ev.reactions.rsvps.includes(user?.uid || "");

                        return (
                          <motion.div
                            key={ev.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`bg-gray-800 border border-blue-500/10 rounded-lg p-3 cursor-pointer shadow-sm hover:shadow-md transition-shadow ${
                              isPastEvent ? "opacity-70" : ""
                            }`}
                            onClick={() => {
                              setSelectedEvent(ev);
                              handleView(ev);
                            }}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <Image
                                src={ev.projectLogo || "/fallback.png"}
                                alt={ev.projectName}
                                width={40}
                                height={40}
                                className="rounded-full object-cover border border-blue-500/20"
                                onError={(e) => {
                                  e.currentTarget.src = "/fallback.png";
                                }}
                              />
                              <span className="px-2 py-1 bg-green-700 text-green-100 text-xs rounded-md shadow">Approved</span>
                            </div>

                            <div className="flex justify-between items-center gap-2 text-xs text-gray-100 mb-2">
                              <span
                                className={`px-2 py-1 rounded flex-1 text-center truncate shadow-sm ${
                                  ev.eventType === "AMA"
                                    ? "bg-blue-700"
                                    : ev.eventType === "Giveaway"
                                    ? "bg-green-700"
                                    : ev.eventType === "Update"
                                    ? "bg-purple-700"
                                    : "bg-yellow-700"
                                }`}
                              >
                                {ev.eventType}
                              </span>
                              <span className="px-2 py-1 bg-gray-800 rounded flex-1 text-center truncate shadow-sm">
                                <FiClock className="inline mr-1 w-3 h-3" />
                                {ev.time}
                              </span>
                            </div>

                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(evt) => {
                                evt.stopPropagation();
                                handleRSVP(ev);
                              }}
                              className={`w-full px-2 py-1 rounded text-sm text-center transition shadow-sm ${
                                isGoing
                                  ? "bg-green-700 text-gray-100 hover:bg-green-800"
                                  : "bg-blue-700 text-gray-100 hover:bg-blue-800"
                              }`}
                              aria-label={isGoing ? "Un-RSVP" : "RSVP"}
                            >
                              {isGoing ? "Going ✅" : "RSVP"}
                            </motion.button>

                            {ev.link && (
                              <div className="text-center mt-2">
                                <a
                                  href={ev.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-400 text-xs hover:underline"
                                  onClick={(evt) => evt.stopPropagation()}
                                >
                                  <FiLink className="w-3 h-3" />
                                  Join
                                </a>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}

                      {day.events.events.length > 2 && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          className="w-full text-blue-400 text-sm underline mt-2"
                          onClick={() => setDayEventsModal(day.events.events)}
                        >
                          +{day.events.events.length - 2} more
                        </motion.button>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Upcoming RSVPs */}
      <div className="mt-6 mb-6">
        <h2 className="text-xl font-bold text-gray-100 mb-3">Upcoming RSVPs</h2>
        <div className="flex overflow-x-auto gap-4 pb-3 scrollbar-thin scrollbar-thumb-blue-500/50 scrollbar-track-gray-900">
          {userRsvpedEvents.map((id) => (
            <motion.div
              key={id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gray-900 p-4 rounded-xl min-w-[220px] shadow-lg border border-blue-500/10 hover:border-blue-500/30"
            >
              <h3 className="text-md font-bold text-gray-100 mb-2">Event ID: {id}</h3>
              <p className="text-sm text-gray-400">Details coming soon...</p>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-950/80 flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 p-6 border border-blue-500/20 w-full max-w-lg rounded-2xl relative shadow-2xl"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedEvent(null)}
                className="absolute top-4 right-4 p-1 bg-gray-800 rounded-full text-gray-100 hover:bg-gray-700 transition"
                aria-label="Close event details"
              >
                <FiX className="w-5 h-5" />
              </motion.button>

              {(isAdmin(user) || user?.uid === selectedEvent.createdBy) && (
                <div className="flex justify-end mb-3 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleEditEvent(selectedEvent)}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-gray-100 rounded-lg text-sm flex items-center gap-2 shadow-sm"
                    aria-label="Edit event"
                  >
                    <FiEdit className="w-4 h-4" />
                    Edit
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDeleteEvent(selectedEvent)}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 text-gray-100 rounded-lg text-sm flex items-center gap-2 shadow-sm"
                    aria-label="Delete event"
                  >
                    <FiTrash className="w-4 h-4" />
                    Delete
                  </motion.button>
                </div>
              )}

              {isAdmin(user) && selectedEvent.status === "pending" && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleApproveEvent(selectedEvent)}
                  className="px-4 py-2 bg-green-700 hover:bg-green-800 text-gray-100 rounded-lg text-sm flex items-center gap-2 mb-3 shadow-sm"
                  aria-label="Approve event"
                >
                  Post (Approve)
                </motion.button>
              )}

              <div className="flex items-center gap-4 mb-4">
                <Image
                  src={selectedEvent.projectLogo || "/fallback.png"}
                  alt={selectedEvent.projectName}
                  width={64}
                  height={64}
                  className="rounded-full object-cover border border-blue-500/20 shadow-md"
                  onError={(e) => {
                    e.currentTarget.src = "/fallback.png";
                  }}
                />
                <div>
                  <h3 className="text-xl font-bold text-gray-100">{selectedEvent.title || "Unknown"}</h3>
                  <p className="text-sm text-gray-400 flex items-center gap-2">
                    {selectedEvent.projectName || "Unknown"} ({selectedEvent.projectTicker || "N/A"})
                    <span className="px-2 py-1 bg-green-700 text-green-100 text-xs rounded-md shadow">Approved</span>
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-100 mb-2">
                <strong>Date:</strong> {selectedEvent.date} at {selectedEvent.time}
              </p>

              <p className="text-sm text-gray-100 mb-2">
                <strong>Type:</strong> {selectedEvent.eventType}
              </p>

              {selectedEvent.link && (
                <p className="text-sm text-gray-100 mb-4">
                  <strong>Link:</strong>{" "}
                  <a
                    href={selectedEvent.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <FiLink className="w-4 h-4" />
                    Join Event
                  </a>
                </p>
              )}

              <p className="text-sm text-gray-100 mb-4 break-words">
                <strong>Description:</strong> {selectedEvent.description}
              </p>

              <p className="text-sm text-gray-100 mb-4">
                <strong>Countdown:</strong> {getCountdown(parseISO(`${selectedEvent.date}T${selectedEvent.time}`))}
              </p>

              {selectedEvent.isTokenGated && selectedEvent.tokenRequirement && (
                <p className="text-sm text-yellow-400 mb-4">
                  <strong>Token Gated:</strong> Requires {selectedEvent.tokenRequirement.minBalance} tokens from contract{" "}
                  {selectedEvent.tokenRequirement.contractAddress}
                </p>
              )}

              <div className="flex flex-wrap gap-3 mb-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSetReminder(selectedEvent)}
                  className="px-4 py-2 bg-yellow-700 hover:bg-yellow-800 text-gray-100 rounded-lg text-sm flex items-center gap-2 shadow-sm"
                  aria-label="Set reminder"
                >
                  <FiBell className="w-4 h-4" />
                  Set Reminder
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleVote(selectedEvent)}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-gray-100 rounded-lg text-sm flex items-center gap-2 shadow-sm"
                  aria-label="Vote for event"
                >
                  <FiChevronsLeft className="w-4 h-4" />
                  Vote (5 points)
                </motion.button>

                {selectedEvent.link && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleShareEvent(selectedEvent)}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-gray-100 rounded-lg text-sm flex items-center gap-2 shadow-sm"
                    aria-label="Share event"
                  >
                    <FiShare2 className="w-4 h-4" />
                    Share
                  </motion.button>
                )}
              </div>

              <div className="flex flex-wrap gap-3 mb-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleEngagement(selectedEvent, "like")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition shadow-sm ${
                    user && selectedEvent.reactions.likes.includes(user.uid)
                      ? "bg-blue-700 text-gray-100 hover:bg-blue-800"
                      : "bg-gray-800 text-gray-100 hover:bg-gray-700 border border-blue-500/20"
                  }`}
                  aria-label={user && selectedEvent.reactions.likes.includes(user.uid) ? "Unlike" : "Like"}
                >
                  <FiThumbsUp className="w-4 h-4" />
                  Like ({selectedEvent.reactions.likes.length})
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleEngagement(selectedEvent, "dislike")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition shadow-sm ${
                    user && selectedEvent.reactions.dislikes.includes(user.uid)
                      ? "bg-red-700 text-gray-100 hover:bg-red-800"
                      : "bg-gray-800 text-gray-100 hover:bg-gray-700 border border-blue-500/20"
                  }`}
                  aria-label={user && selectedEvent.reactions.dislikes.includes(user.uid) ? "Remove dislike" : "Dislike"}
                >
                  <FiThumbsDown className="w-4 h-4" />
                  Dislike ({selectedEvent.reactions.dislikes.length})
                </motion.button>

                <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-gray-800 text-gray-100 border border-blue-500/20 shadow-sm">
                  <FiEye className="w-4 h-4" />
                  Views ({selectedEvent.reactions.views.length})
                </div>
              </div>

              <div className="mb-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowDiscussionPanel(true);
                    setDiscussionEvent(selectedEvent);
                  }}
                  className="text-md font-semibold text-gray-100 mb-2 flex items-center gap-2"
                >
                  <FiMessageSquare className="w-5 h-5" />
                  Comments ({selectedEvent.reactions.comments.length + selectedEvent.reactions.pinned.length})
                </motion.button>
              </div>

              {isAdmin(user) && (
                <p className="text-sm text-gray-400 mt-4">
                  <strong>Admin Notes:</strong> [Add notes here if needed. Approve pending events in panel.]
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Points System Pop-up Modal */}
      <AnimatePresence>
        {showPointsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-950/80 flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 p-6 border border-blue-500/20 w-full max-w-md rounded-2xl relative shadow-2xl"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowPointsModal(false)}
                className="absolute top-4 right-4 p-1 bg-gray-800 rounded-full text-gray-100 hover:bg-gray-700 transition"
                aria-label="Close points modal"
              >
                <FiX className="w-5 h-5" />
              </motion.button>

              <h3 className="text-xl font-bold text-gray-100 mb-4">How to Earn Points</h3>
              <p className="text-sm text-gray-100 mb-4">
                Engage with the calendar to earn points, redeemable for badges, USDC, or exclusive Web3 perks. Build your flywheel: more actions = more rewards!
              </p>

              <table className="w-full text-sm text-gray-100 border-collapse">
                <thead>
                  <tr className="border-b border-blue-500/20">
                    <th className="text-left pb-2">Action</th>
                    <th className="text-right pb-2">Points</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-blue-500/10">
                    <td className="py-2">View an event</td>
                    <td className="text-right">+1</td>
                  </tr>
                  <tr className="border-b border-blue-500/10">
                    <td className="py-2">Like/Dislike</td>
                    <td className="text-right">+5</td>
                  </tr>
                  <tr className="border-b border-blue-500/10">
                    <td className="py-2">Comment</td>
                    <td className="text-right">+10</td>
                  </tr>
                  <tr className="border-b border-blue-500/10">
                    <td className="py-2">RSVP</td>
                    <td className="text-right">+5</td>
                  </tr>
                  <tr className="border-b border-blue-500/10">
                    <td className="py-2">Share</td>
                    <td className="text-right">+2</td>
                  </tr>
                  <tr className="border-b border-blue-500/10">
                    <td className="py-2">Create approved event</td>
                    <td className="text-right">+50</td>
                  </tr>
                  <tr>
                    <td className="py-2">Vote</td>
                    <td className="text-right">-5</td>
                  </tr>
                </tbody>
              </table>

              <p className="text-sm text-gray-400 mt-4">Points reset monthly—redeem before they expire!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-950/80 flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 p-6 border border-blue-500/20 w-full max-w-md rounded-2xl relative shadow-2xl"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 p-1 bg-gray-800 rounded-full text-gray-100 hover:bg-gray-700 transition"
                aria-label="Close profile modal"
              >
                <FiX className="w-5 h-5" />
              </motion.button>

              <h3 className="text-xl font-bold text-gray-100 mb-4">Your Profile</h3>
              <p className="text-sm text-gray-100 mb-2">Points: {userPoints}</p>
              <p className="text-sm text-gray-100 mb-2">Badges:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {userBadges.map((badge) => (
                  <span key={badge} className="px-3 py-1 bg-purple-700 text-purple-100 text-xs rounded-md flex items-center gap-1 shadow-sm">
                    <FiAward className="w-4 h-4" />
                    {badge}
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-100 mb-2">RSVPed Events:</p>
              <ul className="space-y-2 mb-4">
                {userRsvpedEvents.map((id) => (
                  <li key={id} className="text-sm text-gray-400">
                    Event ID: {id}
                  </li>
                ))}
              </ul>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleShareProfile}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-gray-100 rounded-lg text-sm flex items-center gap-2 shadow-sm"
                aria-label="Share profile"
              >
                <FiShare2 className="w-4 h-4" />
                Share Profile
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Events Modal for Multiples */}
      <AnimatePresence>
        {dayEventsModal.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-950/80 flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 p-6 border border-blue-500/20 w-full max-w-lg rounded-2xl relative space-y-4 shadow-2xl"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setDayEventsModal([])}
                className="absolute top-4 right-4 p-1 bg-gray-800 rounded-full text-gray-100 hover:bg-gray-700 transition"
                aria-label="Close day events modal"
              >
                <FiX className="w-5 h-5" />
              </motion.button>

              <h3 className="text-xl font-bold text-gray-100">All Events for the Day</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500/50 scrollbar-track-gray-900">
                {dayEventsModal.map((ev) => (
                  <motion.div
                    key={ev.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gray-800 border border-blue-500/10 rounded-lg p-4 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                    onClick={() => {
                      setSelectedEvent(ev);
                      setDayEventsModal([]);
                      handleView(ev);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <Image
                        src={ev.projectLogo || "/fallback.png"}
                        alt={ev.projectName}
                        width={40}
                        height={40}
                        className="rounded-full object-cover border border-blue-500/20"
                      />
                      <span className="px-2 py-1 bg-green-700 text-green-100 text-xs rounded-md shadow">Approved</span>
                    </div>

                    <div className="flex justify-between items-center gap-2 text-xs text-gray-100 mb-2">
                      <span
                        className={`px-2 py-1 rounded flex-1 text-center truncate shadow-sm ${
                          ev.eventType === "AMA"
                            ? "bg-blue-700"
                            : ev.eventType === "Giveaway"
                            ? "bg-green-700"
                            : ev.eventType === "Update"
                            ? "bg-purple-700"
                            : "bg-yellow-700"
                        }`}
                      >
                        {ev.eventType}
                      </span>
                      <span className="px-2 py-1 bg-gray-800 rounded flex-1 text-center truncate shadow-sm">
                        <FiClock className="inline mr-1 w-3 h-3" />
                        {ev.time}
                      </span>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full px-2 py-1 bg-blue-700 text-gray-100 rounded text-sm text-center truncate shadow-sm hover:bg-blue-800"
                      onClick={(evt) => {
                        evt.stopPropagation();
                        handleRSVP(ev);
                      }}
                    >
                      RSVP
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sliding Discussion Panel */}
      <AnimatePresence>
        {showDiscussionPanel && discussionEvent && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-blue-500/20 p-6 overflow-y-auto z-50 shadow-2xl"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDiscussionPanel(false)}
              className="absolute top-4 right-4 p-1 bg-gray-800 rounded-full text-gray-100 hover:bg-gray-700 transition"
              aria-label="Close discussion panel"
            >
              <FiX className="w-5 h-5" />
            </motion.button>

            <h3 className="text-xl font-bold text-gray-100 mb-4">Discussion Room</h3>
            <div className="space-y-4">
              {discussionEvent.reactions.pinned.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-100 mb-2">Pinned Comments</h4>
                  {discussionEvent.reactions.pinned.map((c, idx) => (
                    <div key={idx} className="bg-gray-800 p-4 rounded-lg mb-3 break-words shadow-sm">
                      <p className="text-sm text-gray-100">{c.text}</p>
                      <span className="text-xs text-gray-400 block mt-1">{format(c.timestamp.toDate(), "MMM d, yyyy h:mm a")}</span>
                      {isAdmin(user) && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleUnpinComment(discussionEvent, c)}
                          className="text-red-400 text-xs mt-2 flex items-center gap-1 hover:text-red-300"
                        >
                          <FiAnchor className="w-4 h-4" />
                          Unpin
                        </motion.button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <h4 className="text-md font-semibold text-gray-100 mb-2">Comments</h4>
                {discussionEvent.reactions.comments.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500/50 scrollbar-track-gray-900">
                    {discussionEvent.reactions.comments.map((c, idx) => (
                      <div key={idx} className="bg-gray-800 p-4 rounded-lg break-words shadow-sm">
                        <p className="text-sm text-gray-100">{c.text}</p>
                        <span className="text-xs text-gray-400 block mt-1">{format(c.timestamp.toDate(), "MMM d, yyyy h:mm a")}</span>
                        {isAdmin(user) && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handlePinComment(discussionEvent, c)}
                            className="text-blue-400 text-xs mt-2 flex items-center gap-1 hover:text-blue-300"
                          >
                            <FiMapPin className="w-4 h-4" />
                            Pin
                          </motion.button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No comments yet. Add one to earn 10 points!</p>
                )}
              </div>

              {user && (
                <div className="mt-4 flex gap-3">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment to share your thoughts (earn 10 points)..."
                    className="flex-1 px-4 py-2 border border-blue-500/20 bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm rounded-lg shadow-sm"
                    aria-label="Comment input"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCommentSubmit(discussionEvent)}
                    className="bg-blue-700 text-gray-100 px-5 py-2 rounded-lg hover:bg-blue-800 transition text-sm shadow-sm"
                    aria-label="Post comment"
                  >
                    Post
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-950/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-900 p-6 border border-blue-500/20 w-full max-w-lg rounded-2xl relative shadow-2xl"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1 bg-gray-800 rounded-full text-gray-100 hover:bg-gray-700 transition"
              aria-label="Close create event modal"
            >
              <FiX className="w-5 h-5" />
            </motion.button>

            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {isEdit ? "Edit Event - Update details for your community" : "Create New Event - Engage users and earn points on approval"}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {isAdmin(user)
                ? "As admin, your events are auto-approved. Manage pending submissions in panel."
                : "Events are reviewed for approval. Approved events earn 50 USDC + points. Fill out to submit!"}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Project (Select an approved project to host the event)</label>
                <select
                  value={newEvent.projectId}
                  onChange={(e) => setNewEvent({ ...newEvent, projectId: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${
                    formErrors.projectId ? "border-red-500" : "border-blue-500/20"
                  }`}
                  aria-label="Select project"
                >
                  <option value="">Select a project (approved only)</option>
                  {projects.length === 0 ? (
                    <option disabled>No approved projects available - submit one first!</option>
                  ) : (
                    projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.ticker} ({p.name})
                      </option>
                    ))
                  )}
                </select>
                {formErrors.projectId && <p className="text-xs text-red-500 mt-1">{formErrors.projectId}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Event Title (Make it engaging to attract RSVPs)</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="e.g., Community AMA - Discuss project updates"
                  className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${
                    formErrors.title ? "border-red-500" : "border-blue-500/20"
                  }`}
                  aria-label="Event title"
                />
                {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Event Type (Choose the format for your audience)</label>
                <select
                  value={newEvent.eventType}
                  onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${
                    formErrors.eventType ? "border-red-500" : "border-blue-500/20"
                  }`}
                  aria-label="Select event type"
                >
                  <option value="AMA">AMA (Ask Me Anything - Interactive Q&A)</option>
                  <option value="Giveaway">Giveaway (Reward participants with tokens or NFTs)</option>
                  <option value="Update">Update (Share project progress and news)</option>
                  <option value="Other">Other (Custom event type)</option>
                </select>
                {formErrors.eventType && <p className="text-xs text-red-500 mt-1">{formErrors.eventType}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">
                  Description (Explain what attendees will gain - boost RSVPs!)
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Describe the event, topics, and why users should join (e.g., 'Learn about our roadmap and win prizes!')"
                  className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 shadow-sm ${
                    formErrors.description ? "border-red-500" : "border-blue-500/20"
                  }`}
                  aria-label="Event description"
                />
                {formErrors.description && <p className="text-xs text-red-500 mt-1">{formErrors.description}</p>}
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-100 mb-1">Date (Choose a future date for scheduling)</label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${
                      formErrors.date ? "border-red-500" : "border-blue-500/20"
                    }`}
                    aria-label="Event date"
                  />
                  {formErrors.date && <p className="text-xs text-red-500 mt-1">{formErrors.date}</p>}
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-100 mb-1">Time (Set the start time in your timezone)</label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${
                      formErrors.time ? "border-red-500" : "border-blue-500/20"
                    }`}
                    aria-label="Event time"
                  />
                  {formErrors.time && <p className="text-xs text-red-500 mt-1">{formErrors.time}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">
                  Link (Optional - Provide a join link for virtual events)
                </label>
                <input
                  type="url"
                  value={newEvent.link}
                  onChange={(e) => setNewEvent({ ...newEvent, link: e.target.value })}
                  placeholder="e.g., Zoom or Discord link to join the event"
                  className={`w-full px-4 py-2 border rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm ${
                    formErrors.link ? "border-red-500" : "border-blue-500/20"
                  }`}
                  aria-label="Event link"
                />
                {formErrors.link && <p className="text-xs text-red-500 mt-1">{formErrors.link}</p>}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newEvent.isTokenGated}
                  onChange={(e) => setNewEvent({ ...newEvent, isTokenGated: e.target.checked })}
                  className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                  aria-label="Token Gated"
                />
                <label className="text-sm font-medium text-gray-100">Token Gated</label>
              </div>

              {newEvent.isTokenGated && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-100 mb-1">Token Contract Address</label>
                    <input
                      type="text"
                      value={newEvent.tokenRequirement.contractAddress}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, tokenRequirement: { ...newEvent.tokenRequirement, contractAddress: e.target.value } })
                      }
                      placeholder="e.g., 0x..."
                      className="w-full px-4 py-2 border border-blue-500/20 rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      aria-label="Token Contract Address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-100 mb-1">Minimum Balance</label>
                    <input
                      type="number"
                      value={newEvent.tokenRequirement.minBalance}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, tokenRequirement: { ...newEvent.tokenRequirement, minBalance: Number(e.target.value) } })
                      }
                      placeholder="e.g., 1"
                      className="w-full px-4 py-2 border border-blue-500/20 rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      aria-label="Minimum Balance"
                    />
                  </div>
                </div>
              )}

              {isAdmin(user) && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newEvent.isFeatured}
                    onChange={(e) => setNewEvent({ ...newEvent, isFeatured: e.target.checked })}
                    className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                    aria-label="Featured Event"
                  />
                  <label className="text-sm font-medium text-gray-100">Featured Event</label>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSaveEvent}
                disabled={isCreating}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-gray-100 py-3 rounded-lg transition text-sm flex items-center justify-center shadow-md"
                aria-label={isEdit ? "Update event" : "Create event"}
              >
                {isCreating ? <FiLoader className="animate-spin w-5 h-5 mr-2" /> : null}
                {isEdit ? "Update Event" : "Create Event"}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Submit Project Modal */}
      {showSubmitProjectModal && (
        <div className="fixed inset-0 bg-gray-950/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-900 p-6 border border-blue-500/20 w-full max-w-lg rounded-2xl relative shadow-2xl"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSubmitProjectModal(false)}
              className="absolute top-4 right-4 p-1 bg-gray-800 rounded-full text-gray-100 hover:bg-gray-700 transition"
              aria-label="Close submit project modal"
            >
              <FiX className="w-5 h-5" />
            </motion.button>

            <h3 className="text-xl font-bold text-gray-100 mb-4">Submit New Project</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g., Homebase Project"
                  className="w-full px-4 py-2 border border-blue-500/20 rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  aria-label="Project name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Ticker</label>
                <input
                  type="text"
                  value={newProject.ticker}
                  onChange={(e) => setNewProject({ ...newProject, ticker: e.target.value })}
                  placeholder="e.g., HMB"
                  className="w-full px-4 py-2 border border-blue-500/20 rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  aria-label="Project ticker"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Describe your project..."
                  className="w-full px-4 py-2 border border-blue-500/20 rounded-lg text-sm h-32 bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  aria-label="Project description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Contract Address</label>
                <input
                  type="text"
                  value={newProject.contractAddress}
                  onChange={(e) => setNewProject({ ...newProject, contractAddress: e.target.value })}
                  placeholder="e.g., 0x..."
                  className="w-full px-4 py-2 border border-blue-500/20 rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  aria-label="Contract address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Website</label>
                <input
                  type="url"
                  value={newProject.website}
                  onChange={(e) => setNewProject({ ...newProject, website: e.target.value })}
                  placeholder="e.g., https://project.com"
                  className="w-full px-4 py-2 border border-blue-500/20 rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  aria-label="Project website"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Proof of Ownership</label>
                <input
                  type="text"
                  value={newProject.proofOfOwnership}
                  onChange={(e) => setNewProject({ ...newProject, proofOfOwnership: e.target.value })}
                  placeholder="e.g., Link to contract or admin proof"
                  className="w-full px-4 py-2 border border-blue-500/20 rounded-lg text-sm bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  aria-label="Proof of ownership"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSubmitProject}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-gray-100 py-3 rounded-lg transition text-sm shadow-md"
                aria-label="Submit project"
              >
                Submit Project
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}