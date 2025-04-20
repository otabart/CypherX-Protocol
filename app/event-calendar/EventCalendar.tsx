'use client';

import React, { useState, useEffect } from 'react';
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
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { auth } from '../../lib/firebase';
import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import {
  FiCalendar,
  FiThumbsUp,
  FiMessageSquare,
  FiPlus,
  FiLink,
  FiFilter,
} from 'react-icons/fi';

// Types for Event Data
interface Event {
  id: string;
  projectId: string;
  projectName: string;
  projectTicker: string;
  title: string;
  description: string;
  date: string;
  createdBy: string;
  eventType: string;
  link?: string;
  reactions: { likes: string[]; comments: { userId: string; text: string }[] };
}

interface DayEvents {
  events: Event[];
}

interface EventDay {
  day: string;
  date: string;
  events: DayEvents;
}

interface Project {
  id: string;
  name: string;
  ticker: string;
}

interface EventCalendarProps {
  user: User | null;
  followedProjects: string[];
}

function timestampToDateString(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toISOString().split('T')[0];
}

function getCurrentWeekDates(): { day: string; date: string; fullDate: string }[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek + 1);

  const days = [];
  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(startOfWeek);
    currentDay.setDate(startOfWeek.getDate() + i);
    days.push({
      day: dayNames[i],
      date: currentDay.getDate().toString(),
      fullDate: currentDay.toISOString().split('T')[0],
    });
  }
  return days;
}

export default function EventCalendar({ user, followedProjects }: EventCalendarProps) {
  const [eventData, setEventData] = useState<EventDay[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [newEvent, setNewEvent] = useState({
    projectId: '',
    title: '',
    description: '',
    date: '',
    eventType: 'AMA',
    link: '',
  });
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('All');

  const weekDates = getCurrentWeekDates();

  // Fetch projects for the dropdown
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
    async function fetchEventData() {
      setLoading(true);
      setError(null);
      try {
        const startDate = weekDates[0].fullDate;
        const endDate = weekDates[6].fullDate;

        const startTimestamp = Timestamp.fromDate(new Date(startDate));
        const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T23:59:59.999Z'));

        let q = query(
          collection(db, 'projectEvents'),
          where('date', '>=', startTimestamp),
          where('date', '<=', endTimestamp)
        );

        if (user && followedProjects.length > 0) {
          q = query(
            collection(db, 'projectEvents'),
            where('date', '>=', startTimestamp),
            where('date', '<=', endTimestamp),
            where('projectId', 'in', followedProjects)
          );
        }

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          console.warn('No events found in projectEvents collection for this week.');
          setError('No events found for this week. Check back later!');
          setLoading(false);
          return;
        }

        const fetchedData: { [key: string]: DayEvents } = {};
        for (const doc of querySnapshot.docs) {
          const data = doc.data();
          const eventDateString = timestampToDateString(data.date);

          // Fetch project details
          const projectDoc = await getDoc(doc(db, 'tokenLaunch', data.projectId));
          const projectData = projectDoc.exists() ? projectDoc.data() : { name: 'Unknown', ticker: 'N/A' };

          const event: Event = {
            id: doc.id,
            projectId: data.projectId,
            projectName: projectData.name || 'Unknown',
            projectTicker: projectData.ticker || 'N/A',
            title: data.title,
            description: data.description,
            date: eventDateString,
            createdBy: data.createdBy,
            eventType: data.eventType,
            link: data.link,
            reactions: data.reactions || { likes: [], comments: [] },
          };

          if (eventTypeFilter !== 'All' && event.eventType !== eventTypeFilter) {
            continue;
          }

          if (!fetchedData[eventDateString]) {
            fetchedData[eventDateString] = { events: [] };
          }
          fetchedData[eventDateString].events.push(event);
        }

        const newEventData = weekDates.map((dayInfo) => ({
          day: dayInfo.day,
          date: dayInfo.date,
          events: fetchedData[dayInfo.fullDate] || { events: [] },
        }));

        setEventData(newEventData);
      } catch (error) {
        console.error('Error fetching event data:', error);
        setError('Failed to load event data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchEventData();
  }, [user, followedProjects, eventTypeFilter]);

  const handleLike = async (event: Event) => {
    if (!user) {
      alert('Please sign in to react!');
      return;
    }
    try {
      const eventRef = doc(db, 'projectEvents', event.id);
      const userId = user.uid;
      const isLiked = event.reactions.likes.includes(userId);
      await updateDoc(eventRef, {
        'reactions.likes': isLiked ? arrayRemove(userId) : arrayUnion(userId),
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
                      likes: isLiked
                        ? e.reactions.likes.filter((id) => id !== userId)
                        : [...e.reactions.likes, userId],
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
            likes: isLiked
              ? selectedEvent.reactions.likes.filter((id) => id !== userId)
              : [...selectedEvent.reactions.likes, userId],
          },
        });
      }
    } catch (error) {
      console.error('Error liking event:', error);
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
      const newComment = { userId: user.uid, text: comment };
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

  const handleCreateEvent = async () => {
    if (!user) {
      alert('Please sign in to create an event!');
      return;
    }
    if (
      !newEvent.projectId ||
      !newEvent.title ||
      !newEvent.description ||
      !newEvent.date ||
      !newEvent.eventType
    ) {
      alert('Please fill in all required fields.');
      return;
    }
    try {
      const eventData = {
        projectId: newEvent.projectId,
        title: newEvent.title,
        description: newEvent.description,
        date: Timestamp.fromDate(new Date(newEvent.date)),
        createdBy: user.uid,
        eventType: newEvent.eventType,
        link: newEvent.link || null,
        reactions: { likes: [], comments: [] },
      };
      await addDoc(collection(db, 'projectEvents'), eventData);
      setShowCreateModal(false);
      setNewEvent({ projectId: '', title: '', description: '', date: '', eventType: 'AMA', link: '' });

      // Simulate notifying followers
      const projectDoc = await getDoc(doc(db, 'tokenLaunch', newEvent.projectId));
      if (projectDoc.exists()) {
        const projectData = projectDoc.data();
        const followers = projectData.followers || [];
        if (Notification.permission === 'granted') {
          followers.forEach((followerId: string) => {
            if (followerId === user.uid) return; // Skip the creator
            new Notification(`New Event for ${projectData.name}`, {
              body: `${newEvent.title} - ${newEvent.description.slice(0, 50)}...`,
            });
          });
        }
      }

      // Refresh events
      fetchEventData();
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const fetchEventData = async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = weekDates[0].fullDate;
      const endDate = weekDates[6].fullDate;

      const startTimestamp = Timestamp.fromDate(new Date(startDate));
      const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T23:59:59.999Z'));

      let q = query(
        collection(db, 'projectEvents'),
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp)
      );

      if (user && followedProjects.length > 0) {
        q = query(
          collection(db, 'projectEvents'),
          where('date', '>=', startTimestamp),
          where('date', '<=', endTimestamp),
          where('projectId', 'in', followedProjects)
        );
      }

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn('No events found in projectEvents collection for this week.');
        setError('No events found for this week. Check back later!');
        setLoading(false);
        return;
      }

      const fetchedData: { [key: string]: DayEvents } = {};
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const eventDateString = timestampToDateString(data.date);

        // Fetch project details
        const projectDoc = await getDoc(doc(db, 'tokenLaunch', data.projectId));
        const projectData = projectDoc.exists() ? projectDoc.data() : { name: 'Unknown', ticker: 'N/A' };

        const event: Event = {
          id: doc.id,
          projectId: data.projectId,
          projectName: projectData.name || 'Unknown',
          projectTicker: projectData.ticker || 'N/A',
          title: data.title,
          description: data.description,
          date: eventDateString,
          createdBy: data.createdBy,
          eventType: data.eventType,
          link: data.link,
          reactions: data.reactions || { likes: [], comments: [] },
        };

        if (eventTypeFilter !== 'All' && event.eventType !== eventTypeFilter) {
          continue;
        }

        if (!fetchedData[eventDateString]) {
          fetchedData[eventDateString] = { events: [] };
        }
        fetchedData[eventDateString].events.push(event);
      }

      const newEventData = weekDates.map((dayInfo) => ({
        day: dayInfo.day,
        date: dayInfo.date,
        events: fetchedData[dayInfo.fullDate] || { events: [] },
      }));

      setEventData(newEventData);
    } catch (error) {
      console.error('Error fetching event data:', error);
      setError('Failed to load event data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-12">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-[#0052FF]">
          Event Calendar
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="appearance-none px-3 py-2 border border-gray-300 rounded-md text-sm sm:text-base bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0052FF] pr-8"
            >
              <option value="All">All Events</option>
              <option value="AMA">AMA</option>
              <option value="Giveaway">Giveaway</option>
              <option value="Update">Update</option>
              <option value="Other">Other</option>
            </select>
            <FiFilter className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
          </div>
          {(user?.email === 'homebasemarkets@gmail.com' || true) && ( // Replace true with hasRole('moderator') check
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-[#0052FF] text-white rounded-md hover:bg-[#0042CC] transition text-sm sm:text-base flex items-center gap-1"
            >
              <FiPlus className="w-4 h-4 sm:w-5 sm:h-5" />
              Create Event
            </motion.button>
          )}
        </div>
      </div>
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl border border-gray-200">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 sm:gap-6">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="bg-white p-4 rounded-lg shadow-md border border-gray-200 min-h-80 flex flex-col animate-pulse"
              >
                <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-4"></div>
                <div className="flex-grow space-y-4">
                  <div className="bg-gray-100 p-3 rounded-md">
                    <div className="h-4 bg-gray-300 rounded w-1/2 mx-auto mb-2"></div>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="bg-white p-2 rounded-md h-16"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-6">
            <p>{error}</p>
            <button
              onClick={fetchEventData}
              className="mt-2 text-blue-500 underline hover:text-blue-600"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 sm:gap-6">
            {eventData.map((day, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className="bg-white p-4 rounded-lg shadow-md border border-gray-200 min-h-80 flex flex-col"
              >
                <div className="text-center">
                  <h2 className="text-lg sm:text-xl font-bold text-[#0052FF]">
                    {day.day}
                  </h2>
                  <p className="text-gray-500 text-xs sm:text-sm">
                    {day.date}
                  </p>
                </div>
                <div className="flex-grow mt-4">
                  <div className="bg-gray-100 p-3 rounded-md border border-gray-200 flex-1">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-700 text-center mb-2 flex items-center justify-center gap-1">
                      <FiCalendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                      Events
                    </h3>
                    {day.events.events.length === 0 ? (
                      <p className="text-xs sm:text-sm text-gray-500 text-center">
                        No events scheduled
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {day.events.events.map((event, idx) => (
                          <motion.div
                            key={idx}
                            className="bg-white p-2 rounded-md shadow-sm hover:bg-gray-50 transition-all cursor-pointer"
                            whileHover={{ scale: 1.05 }}
                            onClick={() => setSelectedEvent(event)}
                          >
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate w-full text-center">
                              {event.title}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 text-center">
                              {event.projectName} ({event.projectTicker})
                            </p>
                            <span
                              className={`inline-block mt-1 px-2 py-1 text-[10px] sm:text-xs rounded-full text-white ${
                                event.eventType === 'AMA'
                                  ? 'bg-purple-500'
                                  : event.eventType === 'Giveaway'
                                  ? 'bg-green-500'
                                  : event.eventType === 'Update'
                                  ? 'bg-blue-500'
                                  : 'bg-gray-500'
                              }`}
                            >
                              {event.eventType}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md sm:max-w-lg relative mx-4 my-8"
          >
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-3 right-3 text-gray-600 text-lg hover:text-gray-800"
            >
              ×
            </button>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
              {selectedEvent.title}
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-2">
              <strong>Project:</strong> {selectedEvent.projectName} ({selectedEvent.projectTicker})
            </p>
            <p className="text-sm sm:text-base text-gray-600 mb-2">
              <strong>Date:</strong> {selectedEvent.date}
            </p>
            <p className="text-sm sm:text-base text-gray-600 mb-2">
              <strong>Type:</strong> {selectedEvent.eventType}
            </p>
            {selectedEvent.link && (
              <p className="text-sm sm:text-base text-gray-600 mb-4">
                <strong>Link:</strong>{' '}
                <a
                  href={selectedEvent.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0052FF] hover:underline flex items-center gap-1"
                >
                  <FiLink className="w-4 h-4" />
                  Join Event
                </a>
              </p>
            )}
            <p className="text-sm sm:text-base text-gray-600 mb-4 break-words">
              <strong>Description:</strong> {selectedEvent.description}
            </p>
            <div className="flex flex-wrap justify-between mb-4 gap-2">
              <button
                onClick={() => handleLike(selectedEvent)}
                className={`flex items-center gap-1 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base transition ${
                  user && selectedEvent.reactions.likes.includes(user.uid)
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                <FiThumbsUp className="w-4 h-4 sm:w-5 sm:h-5" />
                Like ({selectedEvent.reactions.likes.length})
              </button>
            </div>
            <div className="mb-4">
              <h4 className="text-sm sm:text-base font-semibold text-gray-800 mb-2">
                Comments
              </h4>
              {selectedEvent.reactions.comments.length > 0 ? (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedEvent.reactions.comments.map((c, idx) => (
                    <li
                      key={idx}
                      className="text-xs sm:text-sm text-gray-600 border-b border-gray-200 pb-1 break-words"
                    >
                      <strong>User {c.userId.slice(0, 8)}:</strong> {c.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs sm:text-sm text-gray-500">
                  No comments yet.
                </p>
              )}
              {user && (
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-1 rounded-md border border-gray-300 text-sm sm:text-base"
                  />
                  <button
                    onClick={() => handleCommentSubmit(selectedEvent)}
                    className="bg-[#0052FF] text-white px-3 py-1 rounded-md hover:bg-[#0042CC] transition text-sm sm:text-base"
                  >
                    Post
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md sm:max-w-lg relative mx-4 my-8"
          >
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-3 right-3 text-gray-600 text-lg hover:text-gray-800"
            >
              ×
            </button>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
              Create New Event
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Project
                </label>
                <select
                  value={newEvent.projectId}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, projectId: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm sm:text-base"
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.ticker})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Event Title
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, title: e.target.value })
                  }
                  placeholder="e.g., Community AMA"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Event Type
                </label>
                <select
                  value={newEvent.eventType}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, eventType: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm sm:text-base"
                >
                  <option value="AMA">AMA</option>
                  <option value="Giveaway">Giveaway</option>
                  <option value="Update">Update</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, description: e.target.value })
                  }
                  placeholder="Describe the event..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm sm:text-base h-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, date: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Link (Optional)
                </label>
                <input
                  type="url"
                  value={newEvent.link}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, link: e.target.value })
                  }
                  placeholder="e.g., Zoom or Discord link"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm sm:text-base"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleCreateEvent}
                className="w-full bg-[#0052FF] text-white py-2 rounded-md hover:bg-[#0042CC] transition text-sm sm:text-base"
              >
                Create Event
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}