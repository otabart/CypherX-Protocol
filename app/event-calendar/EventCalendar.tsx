'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { User } from 'firebase/auth';
import {
  FiCalendar,
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
} from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import { format, isPast, isToday, parseISO, isBefore } from 'date-fns';

// ────────── Types ──────────

interface Event {
  id: string;
  projectId: string;
  projectName: string;
  projectTicker: string;
  title: string;
  description: string;
  date: string; // “YYYY-MM-DD”
  time: string; // “HH:MM AM/PM”
  createdBy: string;
  eventType: string;
  link?: string;
  status: string;
  reactions: {
    likes: string[];
    dislikes: string[];
    comments: { userId: string; text: string; timestamp: Timestamp }[];
    views: number;
  };
  attendees?: string[];
}

interface DayEvents {
  events: Event[];
}

interface EventDay {
  day: string;      // “MON”
  date: string;     // “2”
  fullDate: string; // “2025-06-02”
  events: DayEvents;
}

interface Project {
  id: string;
  name: string;
  ticker: string;
}

interface PendingProject {
  name: string;
  ticker: string;
  description: string;
  contractAddress: string;
  website: string;
  proofOfOwnership: string;
}

interface EventCalendarProps {
  user: User | null;
  followedProjects: string[];
}

// ────────── Helpers ──────────

function timestampToDateTime(timestamp: Timestamp): { date: string; time: string } {
  const dt = timestamp.toDate();
  return {
    date: dt.toISOString().split('T')[0], // “2025-06-05”
    time: dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getWeekDates(weekOffset: number = 0): {
  day: string;
  date: string;
  fullDate: string;
}[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const days: { day: string; date: string; fullDate: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      day: dayNames[i],
      date: d.getDate().toString(),
      fullDate: d.toISOString().split('T')[0],
    });
  }
  return days;
}

const chunkArray = (array: string[], size: number) =>
  Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, (i + 1) * size)
  );

// ────────── Main Component ──────────

export default function EventCalendar({
  user,
  followedProjects,
}: EventCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [eventData, setEventData] = useState<EventDay[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
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
  }>({
    projectId: '',
    title: '',
    description: '',
    date: '',
    time: '',
    eventType: 'AMA',
    link: '',
  });
  const [newProject, setNewProject] = useState<PendingProject>({
    name: '',
    ticker: '',
    description: '',
    contractAddress: '',
    website: '',
    proofOfOwnership: '',
  });
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('All');
  const [useFollowedFilter, setUseFollowedFilter] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof typeof newEvent, string>>>(
    {}
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Combine two weeks (14 days) into one array
  const weekDates1 = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekDates2 = useMemo(() => getWeekDates(weekOffset + 1), [weekOffset]);
  // total 14-day array
  const allDates: {
    day: string;
    date: string;
    fullDate: string;
  }[] = useMemo(() => [...weekDates1, ...weekDates2], [weekDates1, weekDates2]);

  // A label spanning two weeks (e.g. “June 2 – June 15, 2025”)
  const twoWeekLabel = useMemo(() => {
    const start = parseISO(allDates[0].fullDate);
    const end = parseISO(allDates[allDates.length - 1].fullDate);
    const monthStart = format(start, 'MMM d');
    const monthEnd = format(end, 'MMM d, yyyy');
    return `${monthStart} – ${monthEnd}`;
  }, [allDates]);

  // ─── Fetch All Projects for Dropdown ───
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const snap = await getDocs(collection(db, 'tokenLaunch'));
        const list: Project[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || 'Unknown',
          ticker: d.data().ticker || 'N/A',
        }));
        setProjects(list);
      } catch (e) {
        console.error(e);
      }
    };
    fetchProjects();
  }, []);

  // ─── Fetch Event Data (14 days) ───
  useEffect(() => {
    fetchEventData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, eventTypeFilter, useFollowedFilter]);

  const fetchEventData = async () => {
    setLoading(true);
    setError(null);

    try {
      // We have 14 days: allDates[0] → allDates[13]
      const startDate = new Date(allDates[0].fullDate + 'T00:00:00.000Z');
      const endDate = new Date(allDates[allDates.length - 1].fullDate + 'T23:59:59.999Z');
      const startTs = Timestamp.fromDate(startDate);
      const endTs = Timestamp.fromDate(endDate);

      // Build project → name/ticker map
      const projectMap: Record<string, { name: string; ticker: string }> = {};
      const projSnap = await getDocs(collection(db, 'tokenLaunch'));
      projSnap.forEach((d) => {
        projectMap[d.id] = {
          name: d.data().name || 'Unknown',
          ticker: d.data().ticker || 'N/A',
        };
      });

      // Base query over the 14-day range
      const eventCol = collection(db, 'projectEvents');
      let docs: any[] = [];

      if (useFollowedFilter && followedProjects.length > 0) {
        // Firestore “in” ≤10, so chunk into groups of 10
        const chunks = chunkArray(followedProjects, 10);
        for (const chunk of chunks) {
          const q = query(
            eventCol,
            where('date', '>=', startTs),
            where('date', '<=', endTs),
            where('projectId', 'in', chunk),
            where('status', '==', 'approved')
          );
          const snap = await getDocs(q);
          snap.forEach((d) => docs.push(d));
        }
      } else {
        const baseQ = query(
          eventCol,
          where('date', '>=', startTs),
          where('date', '<=', endTs),
          where('status', '==', 'approved')
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
          projectName: projectMap[dt.projectId]?.name || 'Unknown',
          projectTicker: projectMap[dt.projectId]?.ticker || 'N/A',
          title: dt.title,
          description: dt.description,
          date: dateStr,
          time: timeStr,
          createdBy: dt.createdBy,
          eventType: dt.eventType,
          link: dt.link || '',
          status: dt.status || 'approved',
          reactions: {
            likes: dt.reactions?.likes || [],
            dislikes: dt.reactions?.dislikes || [],
            comments: dt.reactions?.comments || [],
            views: dt.reactions?.views || 0,
          },
          attendees: dt.attendees || [],
        };

        if (eventTypeFilter !== 'All' && ev.eventType !== eventTypeFilter) {
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

      if (finalData.every((day) => day.events.events.length === 0)) {
        setError('No approved events found for these two weeks.');
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load events.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Engagement / RSVP / Comments ───

  const handleView = async (ev: Event) => {
    try {
      const ref = doc(db, 'projectEvents', ev.id);
      await updateDoc(ref, {
        'reactions.views': ev.reactions.views + 1,
      });
      fetchEventData();
      if (selectedEvent?.id === ev.id) {
        setSelectedEvent({
          ...selectedEvent,
          reactions: {
            ...selectedEvent.reactions,
            views: selectedEvent.reactions.views + 1,
          },
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEngagement = async (ev: Event, action: 'like' | 'dislike') => {
    if (!user) {
      alert('Please sign in to react.');
      return;
    }
    try {
      const ref = doc(db, 'projectEvents', ev.id);
      const uid = user.uid;
      const isLiked = ev.reactions.likes.includes(uid);
      const isDisliked = ev.reactions.dislikes.includes(uid);

      if (action === 'like') {
        await updateDoc(ref, {
          'reactions.likes': isLiked ? arrayRemove(uid) : arrayUnion(uid),
          'reactions.dislikes': isDisliked ? arrayRemove(uid) : ev.reactions.dislikes,
        });
      } else {
        await updateDoc(ref, {
          'reactions.dislikes': isDisliked ? arrayRemove(uid) : arrayUnion(uid),
          'reactions.likes': isLiked ? arrayRemove(uid) : ev.reactions.likes,
        });
      }
      fetchEventData();
      if (selectedEvent?.id === ev.id) {
        const newLikes =
          action === 'like'
            ? isLiked
              ? selectedEvent.reactions.likes.filter((id) => id !== uid)
              : [...selectedEvent.reactions.likes, uid]
            : selectedEvent.reactions.likes;
        const newDislikes =
          action === 'dislike'
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
    } catch (e) {
      console.error(e);
    }
  };

  const handleCommentSubmit = async (ev: Event) => {
    if (!user) {
      alert('Please sign in to comment.');
      return;
    }
    if (!commentText.trim()) return;
    try {
      const ref = doc(db, 'projectEvents', ev.id);
      const newComment = { userId: user.uid, text: commentText.trim(), timestamp: Timestamp.now() };
      await updateDoc(ref, {
        'reactions.comments': arrayUnion(newComment),
      });
      setCommentText('');
      fetchEventData();
      if (selectedEvent?.id === ev.id) {
        setSelectedEvent({
          ...selectedEvent,
          reactions: {
            ...selectedEvent.reactions,
            comments: [...selectedEvent.reactions.comments, newComment],
          },
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRSVP = async (ev: Event) => {
    if (!user) {
      alert('Please sign in to RSVP.');
      return;
    }
    try {
      const ref = doc(db, 'projectEvents', ev.id);
      const uid = user.uid;
      const isGoing = ev.attendees?.includes(uid) || false;
      if (isGoing) {
        await updateDoc(ref, {
          attendees: arrayRemove(uid),
        });
      } else {
        await updateDoc(ref, {
          attendees: arrayUnion(uid),
        });
      }
      fetchEventData();
      if (selectedEvent?.id === ev.id) {
        const newAttendees = isGoing
          ? (selectedEvent.attendees || []).filter((id) => id !== uid)
          : [...(selectedEvent.attendees || []), uid];
        setSelectedEvent({
          ...selectedEvent,
          attendees: newAttendees,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ─── Create Event / Submit Project ──────────
  const validateForm = () => {
    const errs: Partial<Record<keyof typeof newEvent, string>> = {};
    if (!newEvent.projectId) errs.projectId = 'Project is required';
    if (!newEvent.title) errs.title = 'Title is required';
    if (!newEvent.description) errs.description = 'Description is required';
    if (!newEvent.date) errs.date = 'Date is required';
    if (!newEvent.time) errs.time = 'Time is required';
    if (newEvent.date && newEvent.time) {
      const dt = new Date(`${newEvent.date}T${newEvent.time}`);
      if (isBefore(dt, new Date())) errs.date = 'Cannot create event in the past';
    }
    if (newEvent.link && !/^https?:\/\/[^\s]+$/.test(newEvent.link)) {
      errs.link = 'Invalid URL';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateEvent = async () => {
    if (!user) {
      alert('Please sign in to create an event.');
      return;
    }
    if (!validateForm()) return;

    try {
      const isAdmin = user.email === 'homebasemarkets@gmail.com';
      const dt = new Date(`${newEvent.date}T${newEvent.time}`);
      const eventToSave = {
        projectId: newEvent.projectId,
        title: newEvent.title,
        description: newEvent.description,
        date: Timestamp.fromDate(dt),
        createdBy: user.uid,
        eventType: newEvent.eventType,
        link: newEvent.link || '',
        status: isAdmin ? 'approved' : 'pending',
        reactions: {
          likes: [],
          dislikes: [],
          comments: [],
          views: 0,
        },
        attendees: [], // NEW
      };
      const docRef = await addDoc(collection(db, 'projectEvents'), eventToSave);

      // Notify “projectEvents” collection
      await addDoc(collection(db, 'notifications'), {
        type: 'event',
        subjectId: docRef.id,
        projectId: newEvent.projectId,
        title: newEvent.title,
        when: Timestamp.now(),
      });

      setShowCreateModal(false);
      setNewEvent({
        projectId: '',
        title: '',
        description: '',
        date: '',
        time: '',
        eventType: 'AMA',
        link: '',
      });
      setSuccessMessage(isAdmin ? 'Event created & approved!' : 'Event submitted for review!');
      fetchEventData();
    } catch (e) {
      console.error(e);
      alert('Failed to create event.');
    }
  };

  const handleSubmitProject = async () => {
    if (!user) {
      alert('Please sign in to submit a project.');
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
      alert('Please fill in all project fields.');
      return;
    }
    try {
      await addDoc(collection(db, 'pendingProjects'), {
        name: newProject.name,
        ticker: newProject.ticker,
        description: newProject.description,
        contractAddress: newProject.contractAddress,
        website: newProject.website,
        proofOfOwnership: newProject.proofOfOwnership,
        submitterId: user.uid,
        submittedAt: Timestamp.now(),
        status: 'pending',
        adminNotes: '',
      });
      setShowSubmitProjectModal(false);
      setNewProject({
        name: '',
        ticker: '',
        description: '',
        contractAddress: '',
        website: '',
        proofOfOwnership: '',
      });
      setSuccessMessage('Project submitted for review!');
    } catch (e) {
      console.error(e);
      alert('Failed to submit project.');
    }
  };

  // ─── Render ───
  return (
    <div className="w-full flex flex-col overflow-x-hidden">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col sm:flex-row justify-between items-center w-full mb-4 gap-4 px-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-100"
            aria-label="Previous two weeks"
            data-tooltip-id="prev-week-tooltip"
          >
            <FiChevronLeft className="w-5 h-5" />
          </motion.button>

          <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
            <FiCalendar className="w-6 h-6 text-blue-400" />
            {twoWeekLabel}
          </h2>

          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-100"
            aria-label="Next two weeks"
            data-tooltip-id="next-week-tooltip"
          >
            <FiChevronRight className="w-5 h-5" />
          </motion.button>

          <Tooltip id="prev-week-tooltip" place="top" content="Previous Two Weeks" />
          <Tooltip id="next-week-tooltip" place="top" content="Next Two Weeks" />
        </div>

        <div className="flex items-center gap-3">
          {/* Event Type Filter */}
          <div className="relative">
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="appearance-none px-4 py-2 border border-blue-500/20 rounded text-base bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              aria-label="Filter events by type"
            >
              <option value="All">All Events</option>
              <option value="AMA">AMA</option>
              <option value="Giveaway">Giveaway</option>
              <option value="Update">Update</option>
              <option value="Other">Other</option>
            </select>
            <FiFilter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-100 w-5 h-5" />
          </div>

          {/* Followed Only Toggle */}
          {followedProjects.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setUseFollowedFilter((prev) => !prev)}
              className={`px-4 py-2 rounded text-base flex items-center gap-1 transition-colors ${
                useFollowedFilter
                  ? 'bg-blue-500/20 text-gray-100 hover:bg-blue-400/30'
                  : 'bg-gray-900 text-gray-100 hover:bg-gray-800 border border-blue-500/20'
              }`}
              aria-label={
                useFollowedFilter
                  ? 'Show all events'
                  : 'Show events from followed projects only'
              }
              data-tooltip-id="followed-filter-tooltip"
            >
              {useFollowedFilter ? 'All Events' : 'Followed Only'}
            </motion.button>
          )}
          <Tooltip
            id="followed-filter-tooltip"
            place="top"
            content={
              useFollowedFilter
                ? 'Showing all events'
                : 'Showing only followed projects'
            }
          />

          {/* Create Event Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-gray-100 rounded text-base flex items-center gap-1 shadow-md"
            aria-label="Create new event"
            data-tooltip-id="create-event-tooltip"
          >
            <FiPlus className="w-5 h-5" />
            Create Event
          </motion.button>
          <Tooltip id="create-event-tooltip" place="top" content="Create new event" />

          {/* Submit Project Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => setShowSubmitProjectModal(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-gray-100 rounded text-base flex items-center gap-1 shadow-md"
            aria-label="Submit new project"
            data-tooltip-id="submit-project-tooltip"
          >
            <FiPlus className="w-5 h-5" />
            Submit Project
          </motion.button>
          <Tooltip id="submit-project-tooltip" place="top" content="Submit a new project" />

          {/* Admin Panel Button (if admin) */}
          {user?.email === 'homebasemarkets@gmail.com' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => alert('Admin Panel Placeholder')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-gray-100 rounded text-base flex items-center gap-1 shadow-md"
              aria-label="Open Admin Panel"
              data-tooltip-id="admin-panel-tooltip"
            >
              <FiShield className="w-5 h-5" />
              Admin Panel
            </motion.button>
          )}
          <Tooltip id="admin-panel-tooltip" place="top" content="Admin Panel (Admins only)" />
        </div>
      </div>

      {/* ───────── SUCCESS MESSAGE ───────── */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-4 mx-4 p-4 bg-green-500/20 text-green-400 rounded text-center text-base"
        >
          {successMessage}
        </motion.div>
      )}

      {/* ───────── EVENT CALENDAR GRID (14 days) ───────── */}
      <div className="bg-gray-950 w-full pb-6 overflow-x-hidden">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 xl:grid-cols-7 w-full gap-4">
            {Array.from({ length: 14 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-gray-950 animate-pulse border border-blue-500/20 w-full aspect-square p-4 flex flex-col"
              >
                <div className="h-6 bg-gray-900 w-1/3 mx-auto mb-2"></div>
                <div className="h-4 bg-gray-900 w-1/4 mx-auto mb-4"></div>
                <div className="flex-1 space-y-4">
                  <div className="h-32 bg-gray-900"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-6 w-full px-4">
            <p className="text-base">{error}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={fetchEventData}
              className="mt-2 text-blue-400 underline hover:text-blue-300 text-base"
              aria-label="Retry loading events"
            >
              Retry
            </motion.button>
          </div>
        ) : eventData.every((day) => day.events.events.length === 0) ? (
          <div className="text-center text-gray-100 py-6 w-full px-4">
            <p className="text-base">No approved events scheduled for these two weeks.</p>
            {followedProjects.length > 0 && useFollowedFilter && (
              <p className="text-base">Try showing all events instead of followed only.</p>
            )}
            {eventTypeFilter !== 'All' && (
              <p className="text-base">Try setting event type filter to “All.”</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 w-full">
            {eventData.map((day, idx) => {
              const isTodayDay = isToday(parseISO(day.fullDate));
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  className={`bg-gray-950 border border-blue-500/20 w-full aspect-square flex flex-col p-4 ${
                    isTodayDay ? 'ring-2 ring-blue-500/50' : ''
                  }`}
                >
                  <div className="text-center mb-2">
                    <h2 className="text-xl font-bold text-blue-400">
                      {day.day}
                    </h2>
                    <p className="text-base text-gray-100">{day.date}</p>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="bg-gray-900 p-2 border border-blue-500/20 h-full flex flex-col">
                      <h3 className="text-base font-semibold text-gray-100 text-center mb-2 flex items-center justify-center gap-1">
                        <FiCalendar className="w-5 h-5 text-gray-100" />
                        Events
                      </h3>
                      {day.events.events.length === 0 ? (
                        <p className="text-base text-gray-100 text-center mt-4 flex-1">
                          No events scheduled
                        </p>
                      ) : (
                        <div className="space-y-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-800">
                          {day.events.events.map((ev) => {
                            const evDateTime = new Date(`${ev.date}T${ev.time}`);
                            const isPastEvent = isPast(evDateTime);
                            const isGoing = ev.attendees?.includes(user?.uid || '');
                            return (
                              <div
                                key={ev.id}
                                className={`bg-gray-950 p-3 border border-blue-500/20 hover:bg-gray-800 cursor-pointer mb-2 ${
                                  isPastEvent ? 'opacity-60' : ''
                                }`}
                                onClick={() => {
                                  setSelectedEvent(ev);
                                  handleView(ev);
                                }}
                              >
                                <p className="text-base font-semibold text-gray-100 text-center break-words">
                                  {ev.title}
                                </p>
                                <p className="text-sm text-gray-100 text-center mb-1">
                                  {ev.projectName} ({ev.projectTicker})
                                </p>
                                {ev.link && (
                                  <div className="text-center mb-1">
                                    <a
                                      href={ev.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-blue-400 text-sm hover:underline"
                                    >
                                      <FiLink className="w-4 h-4" />
                                      Join
                                    </a>
                                  </div>
                                )}
                                <div className="flex justify-center items-center gap-2 mb-2">
                                  <span
                                    className={`inline-flex items-center px-2 py-1 text-xs rounded text-gray-100 ${
                                      ev.eventType === 'AMA'
                                        ? 'bg-blue-500/40'
                                        : ev.eventType === 'Giveaway'
                                        ? 'bg-green-500/40'
                                        : ev.eventType === 'Update'
                                        ? 'bg-purple-500/40'
                                        : 'bg-gray-800'
                                    }`}
                                  >
                                    <FiCalendar className="w-3 h-3 mr-1" />
                                    {ev.eventType}
                                  </span>
                                  <span className="inline-flex items-center px-2 py-1 text-xs rounded text-gray-100 bg-gray-800">
                                    <FiClock className="w-3 h-3 mr-1" />
                                    {ev.time}
                                  </span>
                                </div>

                                {/* RSVP / Attending Toggle */}
                                <div className="flex justify-center">
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRSVP(ev);
                                    }}
                                    className={`px-3 py-1 rounded text-sm transition ${
                                      isGoing
                                        ? 'bg-green-600 text-gray-100 hover:bg-green-700'
                                        : 'bg-gray-800 text-gray-100 hover:bg-gray-700 border border-blue-500/20'
                                    }`}
                                    data-tooltip-id={`rsvp-${ev.id}`}
                                    aria-label={isGoing ? 'Un-RSVP' : 'RSVP'}
                                  >
                                    {isGoing ? 'Going ✅' : 'RSVP'}
                                  </motion.button>
                                  <Tooltip
                                    id={`rsvp-${ev.id}`}
                                    place="top"
                                    content={isGoing ? 'Click to un-RSVP' : 'Click to RSVP'}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* EVENT DETAILS MODAL */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-950/70 flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-950 p-6 border border-blue-500/20 w-full max-w-md sm:max-w-lg relative"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedEvent(null)}
                className="absolute top-3 right-3 p-1 bg-gray-900 rounded text-gray-100 hover:bg-gray-800 transition"
                aria-label="Close event details"
              >
                <FiX className="w-6 h-6" />
              </motion.button>

              <h3 className="text-2xl font-bold text-gray-100 mb-4">
                {selectedEvent.title}
              </h3>
              <p className="text-base text-gray-100 mb-2">
                <strong>Project:</strong> {selectedEvent.projectName} (
                {selectedEvent.projectTicker})
              </p>
              <p className="text-base text-gray-100 mb-2">
                <strong>Date:</strong> {selectedEvent.date} at {selectedEvent.time}
              </p>
              <p className="text-base text-gray-100 mb-2">
                <strong>Type:</strong> {selectedEvent.eventType}
              </p>
              {selectedEvent.link && (
                <p className="text-base text-gray-100 mb-4">
                  <strong>Link:</strong>{' '}
                  <a
                    href={selectedEvent.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <FiLink className="w-5 h-5" />
                    Join Event
                  </a>
                </p>
              )}
              <p className="text-base text-gray-100 mb-4 break-words">
                <strong>Description:</strong> {selectedEvent.description}
              </p>

              <div className="flex flex-wrap justify-between gap-2 mb-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => handleEngagement(selectedEvent, 'like')}
                  className={`flex items-center gap-1 px-3 py-2 rounded text-base transition ${
                    user && selectedEvent.reactions.likes.includes(user.uid)
                      ? 'bg-blue-500/40 text-gray-100 hover:bg-blue-400/50'
                      : 'bg-gray-900 text-gray-100 hover:bg-gray-800 border border-blue-500/20'
                  }`}
                  aria-label={
                    user && selectedEvent.reactions.likes.includes(user.uid)
                      ? 'Unlike'
                      : 'Like'
                  }
                >
                  <FiThumbsUp className="w-5 h-5" />
                  Like ({selectedEvent.reactions.likes.length})
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => handleEngagement(selectedEvent, 'dislike')}
                  className={`flex items-center gap-1 px-3 py-2 rounded text-base transition ${
                    user && selectedEvent.reactions.dislikes.includes(user.uid)
                      ? 'bg-red-500/40 text-gray-100 hover:bg-red-400/50'
                      : 'bg-gray-900 text-gray-100 hover:bg-gray-800 border border-blue-500/20'
                  }`}
                  aria-label={
                    user && selectedEvent.reactions.dislikes.includes(user.uid)
                      ? 'Remove dislike'
                      : 'Dislike'
                  }
                >
                  <FiThumbsDown className="w-5 h-5" />
                  Dislike ({selectedEvent.reactions.dislikes.length})
                </motion.button>

                <div className="flex items-center gap-1 px-3 py-2 rounded text-base bg-gray-900 text-gray-100 border border-blue-500/20">
                  <FiEye className="w-5 h-5" />
                  Views ({selectedEvent.reactions.views})
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-base font-semibold text-gray-100 mb-2 flex items-center gap-1">
                  <FiMessageSquare className="w-5 h-5" />
                  Comments ({selectedEvent.reactions.comments.length})
                </h4>
                {selectedEvent.reactions.comments.length > 0 ? (
                  <ul className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-800">
                    {selectedEvent.reactions.comments.map((c, idx) => (
                      <li
                        key={idx}
                        className="text-base text-gray-100 border-b border-blue-500/20 pb-1 break-words"
                      >
                        <strong>User {c.userId.slice(0, 8)}:</strong> {c.text}
                        <span className="text-xs text-gray-400 block">
                          {format(c.timestamp.toDate(), 'MMM d, yyyy h:mm a')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base text-gray-100">No comments yet.</p>
                )}
                {user && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 px-3 py-2 border border-blue-500/20 bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base rounded"
                      aria-label="Comment input"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={() => handleCommentSubmit(selectedEvent)}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 text-gray-100 px-4 py-2 rounded hover:from-blue-600 hover:to-blue-700 transition text-base"
                      aria-label="Post comment"
                    >
                      Post
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATE EVENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-950 p-6 border border-blue-500/20 w-full max-w-md sm:max-w-lg relative"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute top-3 right-3 p-1 bg-gray-900 rounded text-gray-100 hover:bg-gray-800 transition"
              aria-label="Close create event modal"
            >
              <FiX className="w-6 h-6" />
            </motion.button>

            <h3 className="text-2xl font-bold text-gray-100 mb-4">
              Create New Event
            </h3>
            <p className="text-base text-gray-400 mb-4">
              Approved events earn 50 USDC, paid monthly to your wallet.
            </p>
            <div className="space-y-4">
              {/* Project Dropdown */}
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Project
                </label>
                <select
                  value={newEvent.projectId}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, projectId: e.target.value })
                  }
                  className={`mt-1 w-full px-3 py-2 border rounded text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.projectId ? 'border-red-500' : 'border-blue-500/20'
                  }`}
                  aria-label="Select project"
                >
                  <option value="">Select a project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.ticker})
                    </option>
                  ))}
                </select>
                {formErrors.projectId && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.projectId}</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Event Title
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, title: e.target.value })
                  }
                  placeholder="e.g., Community AMA"
                  className={`mt-1 w-full px-3 py-2 border rounded text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.title ? 'border-red-500' : 'border-blue-500/20'
                  }`}
                  aria-label="Event title"
                />
                {formErrors.title && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Event Type
                </label>
                <select
                  value={newEvent.eventType}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, eventType: e.target.value })
                  }
                  className={`mt-1 w-full px-3 py-2 border rounded text-base bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.eventType ? 'border-red-500' : 'border-blue-500/20'
                  }`}
                  aria-label="Select event type"
                >
                  <option value="AMA">AMA</option>
                  <option value="Giveaway">Giveaway</option>
                  <option value="Update">Update</option>
                  <option value="Other">Other</option>
                </select>
                {formErrors.eventType && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.eventType}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Description
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, description: e.target.value })
                  }
                  placeholder="Describe the event..."
                  className={`mt-1 w-full px-3 py-2 border rounded text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.description ? 'border-red-500' : 'border-blue-500/20'
                  }`}
                  aria-label="Event description"
                />
                {formErrors.description && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.description}</p>
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-base font-medium text-gray-100">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, date: e.target.value })
                    }
                    className={`mt-1 w-full px-3 py-2 border rounded text-base bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.date ? 'border-red-500' : 'border-blue-500/20'
                    }`}
                    aria-label="Event date"
                  />
                  {formErrors.date && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.date}</p>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-base font-medium text-gray-100">
                    Time
                  </label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, time: e.target.value })
                    }
                    className={`mt-1 w-full px-3 py-2 border rounded text-base bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.time ? 'border-red-500' : 'border-blue-500/20'
                    }`}
                    aria-label="Event time"
                  />
                  {formErrors.time && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.time}</p>
                  )}
                </div>
              </div>

              {/* Link */}
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Link (Optional)
                </label>
                <input
                  type="url"
                  value={newEvent.link}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, link: e.target.value })
                  }
                  placeholder="e.g., Zoom or Discord link"
                  className={`mt-1 w-full px-3 py-2 border rounded text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.link ? 'border-red-500' : 'border-blue-500/20'
                  }`}
                  aria-label="Event link"
                />
                {formErrors.link && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.link}</p>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleCreateEvent}
                className="w-full bg-blue-500 hover:bg-blue-600 text-gray-100 py-2 rounded transition text-base"
                aria-label="Create event"
              >
                Create Event
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* SUBMIT PROJECT MODAL */}
      {showSubmitProjectModal && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-950 p-6 border border-blue-500/20 w-full max-w-md sm:max-w-lg relative"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={() => setShowSubmitProjectModal(false)}
              className="absolute top-3 right-3 p-1 bg-gray-900 rounded text-gray-100 hover:bg-gray-800 transition"
              aria-label="Close submit project modal"
            >
              <FiX className="w-6 h-6" />
            </motion.button>

            <h3 className="text-2xl font-bold text-gray-100 mb-4">
              Submit New Project
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                  placeholder="e.g., Homebase Project"
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Project name"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Ticker
                </label>
                <input
                  type="text"
                  value={newProject.ticker}
                  onChange={(e) =>
                    setNewProject({ ...newProject, ticker: e.target.value })
                  }
                  placeholder="e.g., HMB"
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Project ticker"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject({ ...newProject, description: e.target.value })
                  }
                  placeholder="Describe your project..."
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded text-base h-24 bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Project description"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Contract Address
                </label>
                <input
                  type="text"
                  value={newProject.contractAddress}
                  onChange={(e) =>
                    setNewProject({ ...newProject, contractAddress: e.target.value })
                  }
                  placeholder="e.g., 0x..."
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Contract address"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Website
                </label>
                <input
                  type="url"
                  value={newProject.website}
                  onChange={(e) =>
                    setNewProject({ ...newProject, website: e.target.value })
                  }
                  placeholder="e.g., https://project.com"
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Project website"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-100">
                  Proof of Ownership
                </label>
                <input
                  type="text"
                  value={newProject.proofOfOwnership}
                  onChange={(e) =>
                    setNewProject({ ...newProject, proofOfOwnership: e.target.value })
                  }
                  placeholder="e.g., Link to contract or admin proof"
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Proof of ownership"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleSubmitProject}
                className="w-full bg-blue-500 hover:bg-blue-600 text-gray-100 py-2 rounded transition text-base"
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


