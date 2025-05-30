'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  addDoc,
  getDoc,
  type DocumentData,
  type CollectionReference,
  type Query,
  increment,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { type User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
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
} from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import { format, isPast, isToday, parseISO, isBefore } from 'date-fns';

// Types for Event Data
interface Event {
  id: string;
  projectId: string;
  projectName: string;
  projectTicker: string;
  title: string;
  description: string;
  date: string;
  time: string;
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

function timestampToDateTime(timestamp: Timestamp): { date: string; time: string } {
  const dateObj = timestamp.toDate();
  return {
    date: dateObj.toISOString().split('T')[0],
    time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getWeekDates(weekOffset: number = 0): { day: string; date: string; fullDate: string }[] {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const days = [];
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(startOfWeek);
    currentDay.setDate(startOfWeek.getDate() + i);
    days.push({
      day: dayNames[i],
      date: currentDay.getUTCDate().toString(),
      fullDate: currentDay.toISOString().split('T')[0],
    });
  }
  return days;
}

const chunkArray = (array: string[], size: number) =>
  Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, (i + 1) * size)
  );

export default function EventCalendar({ user, followedProjects }: EventCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [eventData, setEventData] = useState<EventDay[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitProjectModal, setShowSubmitProjectModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [newEvent, setNewEvent] = useState({
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
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof typeof newEvent, string>>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekLabel = useMemo(() => {
    const start = parseISO(weekDates[0].fullDate);
    return `${format(start, 'MMMM yyyy')}`;
  }, [weekDates]);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const querySnapshot = await getDocs(collection(db, 'tokenLaunch'));
        const projectList: Project[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || 'Unknown',
          ticker: doc.data().ticker || 'N/A',
        }));
        setProjects(projectList);
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    }
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchEventData();
  }, [weekOffset, eventTypeFilter, useFollowedFilter]);

  async function fetchEventData() {
    setLoading(true);
    setError(null);
    try {
      const startDate = new Date(weekDates[0].fullDate + 'T00:00:00.000Z');
      const endDate = new Date(weekDates[6].fullDate + 'T23:59:59.999Z');
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      const projectMap: { [key: string]: { name: string; ticker: string } } = {};
      const projectCollection = collection(db, 'tokenLaunch') as CollectionReference<DocumentData>;
      const projectSnapshot = await getDocs(projectCollection);
      projectSnapshot.forEach((doc) => {
        projectMap[doc.id] = {
          name: doc.data().name || 'Unknown',
          ticker: doc.data().ticker || 'N/A',
        };
      });

      const eventCollection = collection(db, 'projectEvents') as CollectionReference<DocumentData>;
      let querySnapshotDocs: DocumentData[] = [];

      const baseQuery = query(
        eventCollection,
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp),
        where('status', '==', 'approved')
      );

      if (useFollowedFilter && followedProjects.length > 0) {
        const chunks = chunkArray(followedProjects, 30);
        for (const chunk of chunks) {
          const q = query(
            eventCollection,
            where('date', '>=', startTimestamp),
            where('date', '<=', endTimestamp),
            where('projectId', 'in', chunk),
            where('status', '==', 'approved')
          );
          const snapshot = await getDocs(q);
          snapshot.forEach((doc) => querySnapshotDocs.push(doc));
        }
      } else {
        const snapshot = await getDocs(baseQuery);
        querySnapshotDocs = snapshot.docs;
      }

      const fetchedData: { [key: string]: DayEvents } = {};
      for (const doc of querySnapshotDocs) {
        const data = doc.data();
        const { date: eventDateString, time: eventTime } = timestampToDateTime(data.date);

        const event: Event = {
          id: doc.id,
          projectId: data.projectId,
          projectName: projectMap[data.projectId]?.name || 'Unknown',
          projectTicker: projectMap[data.projectId]?.ticker || 'N/A',
          title: data.title,
          description: data.description,
          date: eventDateString,
          time: eventTime,
          createdBy: data.createdBy,
          eventType: data.eventType,
          link: data.link,
          status: data.status || 'approved',
          reactions: {
            likes: data.reactions?.likes || [],
            dislikes: data.reactions?.dislikes || [],
            comments: data.reactions?.comments || [],
            views: data.reactions?.views || 0,
          },
        };

        if (eventTypeFilter !== 'All' && event.eventType !== eventTypeFilter) continue;

        if (!fetchedData[eventDateString]) {
          fetchedData[eventDateString] = { events: [] };
        }
        fetchedData[eventDateString].events.push(event);
      }

      const newEventData = weekDates.map((dayInfo) => ({
        day: dayInfo.day,
        date: dayInfo.date,
        fullDate: dayInfo.fullDate,
        events: fetchedData[dayInfo.fullDate] || { events: [] },
      }));

      setEventData(newEventData);

      if (newEventData.every((day) => day.events.events.length === 0)) {
        setError('No approved events found for this week. Try a different week or filter.');
      }
    } catch (error: any) {
      console.error('Error fetching event data:', error);
      setError('Failed to load events. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleView = async (event: Event) => {
    try {
      const eventRef = doc(db, 'projectEvents', event.id);
      await updateDoc(eventRef, {
        'reactions.views': increment(1),
      });
      setEventData((prev) =>
        prev.map((day) => ({
          ...day,
          events: {
            events: day.events.events.map((e) =>
              e.id === event.id
                ? {
                    ...e,
                    reactions: { ...e.reactions, views: e.reactions.views + 1 },
                  }
                : e
            ),
          },
        }))
      );
      if (selectedEvent?.id === event.id) {
        setSelectedEvent({
          ...selectedEvent,
          reactions: { ...selectedEvent.reactions, views: selectedEvent.reactions.views + 1 },
        });
      }
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  };

  const handleEngagement = async (event: Event, action: 'like' | 'dislike') => {
    if (!user) {
      alert('Please sign in to react!');
      return;
    }
    try {
      const eventRef = doc(db, 'projectEvents', event.id);
      const userId = user.uid;
      const isLiked = event.reactions.likes.includes(userId);
      const isDisliked = event.reactions.dislikes.includes(userId);

      if (action === 'like') {
        await updateDoc(eventRef, {
          'reactions.likes': isLiked ? arrayRemove(userId) : arrayUnion(userId),
          'reactions.dislikes': isDisliked ? arrayRemove(userId) : event.reactions.dislikes,
        });
      } else {
        await updateDoc(eventRef, {
          'reactions.dislikes': isDisliked ? arrayRemove(userId) : arrayUnion(userId),
          'reactions.likes': isLiked ? arrayRemove(userId) : event.reactions.likes,
        });
      }

      setEventData((prev) =>
        prev.map((day) => ({
          ...day,
          events: {
            events: day.events.events.map((e) =>
              e.id === event.id
                ? {
                    ...e,
                    reactions: {
                      ...e.reactions,
                      likes: action === 'like'
                        ? (isLiked ? e.reactions.likes.filter((id) => id !== userId) : [...e.reactions.likes, userId])
                        : (isLiked ? e.reactions.likes.filter((id) => id !== userId) : e.reactions.likes),
                      dislikes: action === 'dislike'
                        ? (isDisliked ? e.reactions.dislikes.filter((id) => id !== userId) : [...e.reactions.dislikes, userId])
                        : (isDisliked ? e.reactions.dislikes.filter((id) => id !== userId) : e.reactions.dislikes),
                    },
                  }
                : e
            ),
          },
        }))
      );

      if (selectedEvent?.id === event.id) {
        setSelectedEvent({
          ...selectedEvent,
          reactions: {
            ...selectedEvent.reactions,
            likes: action === 'like'
              ? (isLiked ? selectedEvent.reactions.likes.filter((id) => id !== userId) : [...selectedEvent.reactions.likes, userId])
              : (isLiked ? selectedEvent.reactions.likes.filter((id) => id !== userId) : selectedEvent.reactions.likes),
            dislikes: action === 'dislike'
              ? (isDisliked ? selectedEvent.reactions.dislikes.filter((id) => id !== userId) : [...selectedEvent.reactions.dislikes, userId])
              : (isDisliked ? selectedEvent.reactions.dislikes.filter((id) => id !== userId) : selectedEvent.reactions.dislikes),
          },
        });
      }
    } catch (error) {
      console.error(`Error ${action} event:`, error);
    }
  };

  const handleCommentSubmit = async (event: Event) => {
    if (!user) {
      alert('Please sign in to comment!');
      return;
    }
    if (!comment.trim()) return;
    try {
      const eventRef = doc(db, 'projectEvents', event.id);
      const newComment = { userId: user.uid, text: comment, timestamp: Timestamp.now() };
      await updateDoc(eventRef, {
        'reactions.comments': arrayUnion(newComment),
      });
      setEventData((prev) =>
        prev.map((day) => ({
          ...day,
          events: {
            events: day.events.events.map((e) =>
              e.id === event.id
                ? {
                    ...e,
                    reactions: {
                      ...e.reactions,
                      comments: [...e.reactions.comments, newComment],
                    },
                  }
                : e
            ),
          },
        }))
      );
      if (selectedEvent?.id === event.id) {
        setSelectedEvent({
          ...selectedEvent,
          reactions: {
            ...selectedEvent.reactions,
            comments: [...selectedEvent.reactions.comments, newComment],
          },
        });
      }
      setComment('');
    } catch (error) {
      console.error('Error commenting on event:', error);
    }
  };

  const validateForm = () => {
    const errors: Partial<Record<keyof typeof newEvent, string>> = {};
    if (!newEvent.projectId) errors.projectId = 'Project is required';
    if (!newEvent.title) errors.title = 'Title is required';
    if (!newEvent.description) errors.description = 'Description is required';
    if (!newEvent.date) errors.date = 'Date is required';
    if (!newEvent.time) errors.time = 'Time is required';
    if (!newEvent.eventType) errors.eventType = 'Event type is required';
    if (newEvent.date && newEvent.time) {
      const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
      if (isBefore(eventDateTime, new Date())) errors.date = 'Date and time cannot be in the past';
    }
    if (newEvent.link && !/^https?:\/\/[^\s]+$/.test(newEvent.link)) {
      errors.link = 'Invalid URL format';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateEvent = async () => {
    if (!user) {
      alert('Please sign in to create an event!');
      return;
    }
    if (!validateForm()) return;

    try {
      const isAdmin = user.email === 'homebasemarkets@gmail.com';
      const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
      const eventData = {
        projectId: newEvent.projectId,
        title: newEvent.title,
        description: newEvent.description,
        date: Timestamp.fromDate(eventDateTime),
        createdBy: user.uid,
        eventType: newEvent.eventType,
        link: newEvent.link || null,
        status: isAdmin ? 'approved' : 'pending',
        reactions: { likes: [], dislikes: [], comments: [], views: 0 },
      };
      const docRef = await addDoc(collection(db, 'projectEvents'), eventData);
      setShowCreateModal(false);
      setNewEvent({ projectId: '', title: '', description: '', date: '', time: '', eventType: 'AMA', link: '' });
      setSuccessMessage(isAdmin ? 'Event created and approved!' : 'Event submitted for review!');

      if (eventData.status === 'approved') {
        const projectDoc = await getDoc(doc(db, 'tokenLaunch', newEvent.projectId));
        if (projectDoc.exists()) {
          const projectData = projectDoc.data() as { name: string; followers?: string[] };
          const followers = projectData.followers || [];
          if (Notification.permission === 'granted') {
            followers.forEach((followerId: string) => {
              if (followerId === user.uid) return;
              new Notification(`New Event for ${projectData.name}`, {
                body: `${newEvent.title} on ${newEvent.date} at ${newEvent.time} - ${newEvent.description.slice(0, 50)}...`,
              });
            });
          }
        }
      }

      fetchEventData();
    } catch (error: any) {
      console.error('Error creating event:', error);
      alert(`Failed to create event: ${error.message}`);
    }
  };

  const handleSubmitProject = async () => {
    if (!user) {
      alert('Please sign in to submit a project!');
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
      alert('Please fill in all required fields.');
      return;
    }
    try {
      const projectData = {
        name: newProject.name,
        ticker: newProject.ticker,
        description: newProject.description,
        contractAddress: newProject.contractAddress,
        website: newProject.website,
        proofOfOwnership: newProject.proofOfOwnership,
        submitterId: user.uid,
        submittedAt: Timestamp.fromDate(new Date()),
        status: 'pending',
        adminNotes: '',
      };
      const docRef = await addDoc(collection(db, 'pendingProjects'), projectData);
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
    } catch (error: any) {
      console.error('Error submitting project:', error);
      alert(`Failed to submit project: ${error.message}`);
    }
  };

  return (
    <div className="my-12">
      {/* Header with Navigation and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="p-2 rounded-full bg-gray-900 hover:bg-gray-800 text-gray-200"
            aria-label="Previous week"
            data-tooltip-id="prev-week-tooltip"
          >
            <FiChevronLeft className="w-5 h-5" />
          </motion.button>
          <h2 className="text-xl sm:text-2xl font-bold text-blue-400 flex items-center gap-2">
            <FiCalendar className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
            Event Calendar - {weekLabel}
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="p-2 rounded-full bg-gray-900 hover:bg-gray-800 text-gray-200"
            aria-label="Next week"
            data-tooltip-id="next-week-tooltip"
          >
            <FiChevronRight className="w-5 h-5" />
          </motion.button>
          <Tooltip id="prev-week-tooltip" place="top" content="Previous Week" />
          <Tooltip id="next-week-tooltip" place="top" content="Next Week" />
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="appearance-none px-4 py-2 border border-blue-500/20 rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 cursor-pointer transition-all duration-200"
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
          {followedProjects.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setUseFollowedFilter((prev) => !prev)}
              className={`px-4 py-2 rounded-lg text-sm sm:text-base flex items-center gap-1 transition-all duration-200 ${
                useFollowedFilter
                  ? 'bg-blue-500/20 text-gray-100 hover:bg-blue-400/30'
                  : 'bg-gray-900 text-gray-100 hover:bg-gray-800 border border-blue-500/20'
              }`}
              aria-label={useFollowedFilter ? 'Show all events' : 'Show followed projects only'}
              data-tooltip-id="followed-filter-tooltip"
            >
              {useFollowedFilter ? 'All Events' : 'Followed Only'}
            </motion.button>
          )}
          <Tooltip id="followed-filter-tooltip" place="top" content={useFollowedFilter ? 'Show all events' : 'Show events from followed projects'} />
          {(user?.email === 'homebasemarkets@gmail.com' || true) && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-gray-100 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-sm sm:text-base flex items-center gap-1 shadow-md"
                aria-label="Create new event"
                data-tooltip-id="create-event-tooltip"
              >
                <FiPlus className="w-5 h-5" />
                Create Event
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setShowSubmitProjectModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-gray-100 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-sm sm:text-base flex items-center gap-1 shadow-md"
                aria-label="Submit new project"
                data-tooltip-id="submit-project-tooltip"
              >
                <FiPlus className="w-5 h-5" />
                Submit Project
              </motion.button>
              <Tooltip id="create-event-tooltip" place="top" content="Create a new event" />
              <Tooltip id="submit-project-tooltip" place="top" content="Submit a new project" />
            </>
          )}
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 p-4 bg-green-500/20 text-green-400 rounded-lg text-center text-sm sm:text-base"
        >
          {successMessage}
        </motion.div>
      )}

      {/* Calendar Grid */}
      <div className="bg-gray-950 p-6 sm:p-8 rounded-xl shadow-md border border-blue-500/20">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 sm:gap-6">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="bg-gray-950 p-4 rounded-lg shadow-md border border-blue-500/20 min-h-80 flex flex-col animate-pulse"
              >
                <div className="h-6 bg-gray-900 rounded w-1/3 mx-auto mb-2"></div>
                <div className="h-4 bg-gray-900 rounded w-1/4 mx-auto mb-4"></div>
                <div className="flex-grow space-y-4">
                  <div className="bg-gray-900 p-3 rounded-md border border-blue-500/20">
                    <div className="h-4 bg-gray-800 rounded w-1/2 mx-auto mb-2"></div>
                    <div className="space-y-2">
                      <div className="bg-gray-950 p-2 rounded-md h-16 border border-blue-500/20"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-6">
            <p>{error}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={fetchEventData}
              className="mt-2 text-blue-400 underline hover:text-blue-300 text-sm sm:text-base"
              aria-label="Retry loading events"
            >
              Retry
            </motion.button>
          </div>
        ) : eventData.every((day) => day.events.events.length === 0) ? (
          <div className="text-center text-gray-100 py-6">
            <p>No approved events scheduled for this week.</p>
            {followedProjects.length > 0 && useFollowedFilter && (
              <p>Try showing all events instead of followed projects only.</p>
            )}
            {eventTypeFilter !== 'All' && (
              <p>Try setting the event type filter to "All".</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 sm:gap-6">
            {eventData.map((day, index) => {
              const isDayToday = isToday(parseISO(day.fullDate));
              const hasPastEvents = day.events.events.some((event) =>
                isPast(new Date(`${event.date}T${event.time}`))
              );
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                  className={`bg-gray-950 p-4 rounded-lg shadow-md border border-blue-500/20 min-h-80 flex flex-col ${
                    isDayToday ? 'ring-2 ring-blue-500/50' : ''
                  } ${hasPastEvents ? 'opacity-75' : ''}`}
                >
                  <div className="text-center">
                    <h2 className="text-lg sm:text-xl font-bold text-blue-400">{day.day}</h2>
                    <p className="text-gray-100 text-xs sm:text-sm">{day.date}</p>
                  </div>
                  <div className="flex-grow mt-4">
                    <div className="bg-gray-900 p-3 rounded-md border border-blue-500/20 flex-1">
                      <h3 className="text-sm font-semibold text-gray-100 text-center mb-2 flex items-center justify-center gap-1">
                        <FiCalendar className="w-5 h-5 text-gray-100" />
                        Events
                      </h3>
                      {day.events?.events?.length === 0 ? (
                        <p className="text-sm text-gray-100 text-center">No events scheduled</p>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {day.events.events.map((event, idx) => {
                            const eventDateTime = new Date(`${event.date}T${event.time}`);
                            const isEventPast = isPast(eventDateTime);
                            return (
                              <motion.div
                                key={idx}
                                className={`bg-gray-950 p-3 rounded-md shadow-sm hover:bg-gray-800 transition-all cursor-pointer border border-blue-500/20 ${
                                  isEventPast ? 'opacity-60' : ''
                                }`}
                                whileHover={{ scale: 1.05 }}
                                onClick={() => {
                                  setSelectedEvent(event);
                                  handleView(event);
                                }}
                                role="button"
                                aria-label={`View details for ${event.title}`}
                              >
                                <p className="text-sm font-semibold text-gray-100 text-center">{event.title}</p>
                                <p className="text-xs text-gray-100 text-center">
                                  {event.projectName} ({event.projectTicker})
                                </p>
                                <div className="flex justify-center items-center gap-2 mt-1">
                                  <span
                                    className={`inline-flex items-center px-2 py-1 text-xs rounded-full text-gray-100 ${
                                      event.eventType === 'AMA'
                                        ? 'bg-blue-500/40'
                                        : event.eventType === 'Giveaway'
                                        ? 'bg-green-500/40'
                                        : event.eventType === 'Update'
                                        ? 'bg-purple-500/40'
                                        : 'bg-gray-800'
                                    }`}
                                  >
                                    <FiCalendar className="w-3 h-3 mr-1" />
                                    {event.eventType}
                                  </span>
                                  <span className="inline-flex items-center px-2 py-1 text-xs rounded-full text-gray-100 bg-gray-800">
                                    <FiClock className="w-3 h-3 mr-1" />
                                    {event.time}
                                  </span>
                                </div>
                              </motion.div>
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

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-950 p-6 rounded-xl shadow-md w-full max-w-md sm:max-w-lg relative mx-4 my-8 border border-blue-500/20"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={() => setSelectedEvent(null)}
              className="absolute top-3 right-3 p-1 bg-gray-900 rounded-full text-gray-100 hover:bg-gray-800 transition-all"
              aria-label="Close event details"
            >
              <FiX className="w-6 h-6" />
            </motion.button>
            <h3 className="text-lg sm:text-xl font-bold text-gray-100 mb-4">{selectedEvent.title}</h3>
            <p className="text-sm sm:text-base text-gray-100 mb-2">
              <strong>Project:</strong> {selectedEvent.projectName} ({selectedEvent.projectTicker})
            </p>
            <p className="text-sm sm:text-base text-gray-100 mb-2">
              <strong>Date:</strong> {selectedEvent.date} at {selectedEvent.time}
            </p>
            <p className="text-sm sm:text-base text-gray-100 mb-2">
              <strong>Type:</strong> {selectedEvent.eventType}
            </p>
            {selectedEvent.link && (
              <p className="text-sm sm:text-base text-gray-100 mb-4">
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
            <p className="text-sm sm:text-base text-gray-100 mb-4 break-words">
              <strong>Description:</strong> {selectedEvent.description}
            </p>
            <div className="flex flex-wrap justify-between mb-4 gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => handleEngagement(selectedEvent, 'like')}
                className={`flex items-center gap-1 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-all ${
                  user && selectedEvent.reactions.likes.includes(user.uid)
                    ? 'bg-blue-500/40 text-gray-100 hover:bg-blue-400/50'
                    : 'bg-gray-900 text-gray-100 hover:bg-gray-800 border border-blue-500/20'
                }`}
                aria-label={user && selectedEvent.reactions.likes.includes(user.uid) ? 'Unlike event' : 'Like event'}
              >
                <FiThumbsUp className="w-5 h-5" />
                Like ({selectedEvent.reactions.likes.length})
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => handleEngagement(selectedEvent, 'dislike')}
                className={`flex items-center gap-1 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition-all ${
                  user && selectedEvent.reactions.dislikes.includes(user.uid)
                    ? 'bg-red-500/40 text-gray-100 hover:bg-red-400/50'
                    : 'bg-gray-900 text-gray-100 hover:bg-gray-800 border border-blue-500/20'
                }`}
                aria-label={user && selectedEvent.reactions.dislikes.includes(user.uid) ? 'Remove dislike' : 'Dislike event'}
              >
                <FiThumbsDown className="w-5 h-5" />
                Dislike ({selectedEvent.reactions.dislikes.length})
              </motion.button>
              <div className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 border border-blue-500/20">
                <FiEye className="w-5 h-5" />
                Views ({selectedEvent.reactions.views})
              </div>
            </div>
            <div className="mb-4">
              <h4 className="text-sm sm:text-base font-semibold text-gray-100 mb-2 flex items-center gap-1">
                <FiMessageSquare className="w-5 h-5" />
                Comments ({selectedEvent.reactions.comments.length})
              </h4>
              {selectedEvent.reactions.comments.length > 0 ? (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedEvent.reactions.comments.map((c, idx) => (
                    <li
                      key={idx}
                      className="text-xs sm:text-sm text-gray-100 border-b border-blue-500/20 pb-1 break-words"
                    >
                      <strong>User {c.userId.slice(0, 8)}:</strong> {c.text}
                      <span className="text-xs text-gray-400 block">
                        {format(c.timestamp.toDate(), 'MMM d, yyyy h:mm a')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-100">No comments yet.</p>
              )}
              {user && (
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 rounded-lg border border-blue-500/20 bg-gray-900 text-gray-100 placeholder-gray-400 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Comment input"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={() => handleCommentSubmit(selectedEvent)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-gray-100 px-4 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all text-sm sm:text-base"
                    aria-label="Post comment"
                  >
                    Post
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-950 p-6 rounded-xl shadow-md w-full max-w-md sm:max-w-lg relative mx-4 my-8 border border-blue-500/20"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute top-3 right-3 p-1 bg-gray-900 rounded-full text-gray-100 hover:bg-gray-800 transition-all"
              aria-label="Close create event modal"
            >
              <FiX className="w-6 h-6" />
            </motion.button>
            <h3 className="text-lg sm:text-xl font-bold text-gray-100 mb-4">Create New Event</h3>
            <p className="text-sm text-gray-400 mb-4">
              Approved events earn 50 USDC, paid monthly to your wallet.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-100">Project</label>
                <select
                  value={newEvent.projectId}
                  onChange={(e) => setNewEvent({ ...newEvent, projectId: e.target.value })}
                  className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.projectId ? 'border-red-500' : 'border-blue-500/20'
                  }`}
                  aria-label="Select project"
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.ticker})
                    </option>
                  ))}
                </select>
                {formErrors.projectId && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.projectId}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100">Event Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="e.g., Community AMA"
                  className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.title ? 'border-red-500' : 'border-blue-500/20'
                  }`}
                  aria-label="Event title"
                />
                {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100">Event Type</label>
                <select
                  value={newEvent.eventType}
                  onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                  className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
              <div>
                <label className="block text-sm font-medium text-gray-100">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Describe the event..."
                  className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm sm:text-base h-24 bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
                  <label className="block text-sm font-medium text-gray-100">Date</label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.date ? 'border-red-500' : 'border-blue-500/20'
                    }`}
                    aria-label="Event date"
                  />
                  {formErrors.date && <p className="text-xs text-red-500 mt-1">{formErrors.date}</p>}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-100">Time</label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.time ? 'border-red-500' : 'border-blue-500/20'
                    }`}
                    aria-label="Event time"
                  />
                  {formErrors.time && <p className="text-xs text-red-500 mt-1">{formErrors.time}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100">Link (Optional)</label>
                <input
                  type="url"
                  value={newEvent.link}
                  onChange={(e) => setNewEvent({ ...newEvent, link: e.target.value })}
                  placeholder="e.g., Zoom or Discord link"
                  className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.link ? 'border-red-500' : 'border-blue-500/20'
                  }`}
                  aria-label="Event link"
                />
                {formErrors.link && <p className="text-xs text-red-500 mt-1">{formErrors.link}</p>}
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleCreateEvent}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-gray-100 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all text-sm sm:text-base shadow-md"
                aria-label="Create event"
              >
                Create Event
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Submit Project Modal */}
      {showSubmitProjectModal && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-950 p-6 rounded-xl shadow-md w-full max-w-md sm:max-w-lg relative mx-4 my-8 border border-blue-500/20"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={() => setShowSubmitProjectModal(false)}
              className="absolute top-3 right-3 p-1 bg-gray-900 rounded-full text-gray-100 hover:bg-gray-800 transition-all"
              aria-label="Close submit project modal"
            >
              <FiX className="w-6 h-6" />
            </motion.button>
            <h3 className="text-lg sm:text-xl font-bold text-gray-100 mb-4">Submit New Project</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-100">Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g., Homebase Project"
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100">Ticker</label>
                <input
                  type="text"
                  value={newProject.ticker}
                  onChange={(e) => setNewProject({ ...newProject, ticker: e.target.value })}
                  placeholder="e.g., HMB"
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Project ticker"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100">Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Describe your project..."
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded-lg text-sm sm:text-base h-24 bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Project description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100">Contract Address</label>
                <input
                  type="text"
                  value={newProject.contractAddress}
                  onChange={(e) => setNewProject({ ...newProject, contractAddress: e.target.value })}
                  placeholder="e.g., 0x..."
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Contract address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100">Website</label>
                <input
                  type="url"
                  value={newProject.website}
                  onChange={(e) => setNewProject({ ...newProject, website: e.target.value })}
                  placeholder="e.g., https://project.com"
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Project website"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100">Proof of Ownership</label>
                <input
                  type="text"
                  value={newProject.proofOfOwnership}
                  onChange={(e) => setNewProject({ ...newProject, proofOfOwnership: e.target.value })}
                  placeholder="e.g., Link to verified contract or admin proof"
                  className="mt-1 w-full px-3 py-2 border border-blue-500/20 rounded-lg text-sm sm:text-base bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Proof of ownership"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleSubmitProject}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-gray-100 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all text-sm sm:text-base shadow-md"
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