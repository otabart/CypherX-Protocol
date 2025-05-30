'use client';

import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { auth } from '../../lib/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import {
  FiSend,
  FiCheckCircle,
  FiShare2,
  FiThumbsUp,
  FiBell,
  FiRefreshCw,
  FiX,
} from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import { DragDropContext, Droppable, Draggable, type DroppableProvided, type DraggableProvided } from 'react-beautiful-dnd';
import EventCalendar from '../event-calendar/EventCalendar';

// Types for Launch Data
interface Launch {
  id: string;
  name: string;
  ticker: string;
  logo?: string;
  launchType: string;
  date: string;
  description?: string;
  votes: { moon: number; rug: number };
  reactions: { likes: string[]; comments: { userId: string; text: string }[] };
  followers: string[];
}

interface DayLaunches {
  launchingSoon: Launch[];
  launched: Launch[];
}

interface LaunchDay {
  day: string;
  date: string;
  fullDate: string;
  launches: DayLaunches;
}

// Placeholder interface for Header component props
interface HeaderProps {
  user: User | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
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

function timestampToDateString(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toISOString().split('T')[0];
}

function requestNotificationPermission() {
  if (Notification.permission === 'default') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        console.log('Notification permission granted.');
      }
    });
  }
}

export default function LaunchCalendar() {
  const [launchData, setLaunchData] = useState<LaunchDay[]>([]);
  const [selectedLaunch, setSelectedLaunch] = useState<Launch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [comment, setComment] = useState('');
  const [followedProjects, setFollowedProjects] = useState<string[]>([]);
  const [showComments, setShowComments] = useState(false);

  const weekDates = getCurrentWeekDates();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const fetchFollowedProjects = async () => {
          const q = query(
            collection(db, 'tokenLaunch'),
            where('followers', 'array-contains', currentUser.uid)
          );
          const querySnapshot = await getDocs(q);
          const projectIds = querySnapshot.docs.map((doc) => doc.id);
          setFollowedProjects(projectIds);
        };
        fetchFollowedProjects();
      } else {
        setFollowedProjects([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchLaunchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = weekDates[0].fullDate;
      const endDate = weekDates[6].fullDate;

      const startTimestamp = Timestamp.fromDate(new Date(startDate));
      const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T23:59:59.999Z'));

      const q = query(
        collection(db, 'tokenLaunch'),
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn('No launches found in tokenLaunch collection for this week.');
        setError('No launches found for this week. Check back later!');
        setLoading(false);
        return;
      }

      const fetchedData: { [key: string]: DayLaunches } = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const launchDateString = timestampToDateString(data.date);
        const launch: Launch = {
          id: doc.id,
          name: data.name || '',
          ticker: data.ticker || '',
          logo: data.logo,
          launchType: data.launchType || '',
          date: launchDateString,
          description: data.description || '',
          votes: data.votes || { moon: 0, rug: 0 },
          reactions: data.reactions || { likes: [], comments: [] },
          followers: data.followers || [],
        };

        if (!fetchedData[launchDateString]) {
          fetchedData[launchDateString] = { launchingSoon: [], launched: [] };
        }
        const now = new Date();
        const launchDateTime = new Date(launchDateString);
        const isLaunched = now > launchDateTime;
        if (isLaunched) {
          fetchedData[launchDateString].launched.push(launch);
        } else {
          fetchedData[launchDateString].launchingSoon.push(launch);
        }
      });

      const newLaunchData = weekDates.map((dayInfo) => ({
        day: dayInfo.day,
        date: dayInfo.date,
        fullDate: dayInfo.fullDate,
        launches: fetchedData[dayInfo.fullDate] || {
          launchingSoon: [],
          launched: [],
        },
      }));

      setLaunchData(newLaunchData);
    } catch (error) {
      console.error('Error fetching launch data:', error);
      setError('Failed to load launch data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLaunchData();
  }, []);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleVote = async (launch: Launch, voteType: 'moon' | 'rug') => {
    if (!user) {
      alert('Please sign in to vote!');
      return;
    }
    try {
      const launchRef = doc(db, 'tokenLaunch', launch.id);
      await updateDoc(launchRef, {
        [`votes.${voteType}`]: launch.votes[voteType] + 1,
      });
      setLaunchData((prev) =>
        prev.map((day) => ({
          ...day,
          launches: {
            launchingSoon: day.launches.launchingSoon.map((l) =>
              l.id === launch.id
                ? { ...l, votes: { ...l.votes, [voteType]: l.votes[voteType] + 1 } }
                : l
            ),
            launched: day.launches.launched.map((l) =>
              l.id === launch.id
                ? { ...l, votes: { ...l.votes, [voteType]: l.votes[voteType] + 1 } }
                : l
            ),
          },
        }))
      );
      if (selectedLaunch?.id === launch.id) {
        setSelectedLaunch({
          ...selectedLaunch,
          votes: { ...selectedLaunch.votes, [voteType]: selectedLaunch.votes[voteType] + 1 },
        });
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleLike = async (launch: Launch) => {
    if (!user) {
      alert('Please sign in to react!');
      return;
    }
    try {
      const launchRef = doc(db, 'tokenLaunch', launch.id);
      const userId = user.uid;
      const isLiked = launch.reactions.likes.includes(userId);
      await updateDoc(launchRef, {
        'reactions.likes': isLiked ? arrayRemove(userId) : arrayUnion(userId),
      });
      setLaunchData((prev) =>
        prev.map((day) => ({
          ...day,
          launches: {
            launchingSoon: day.launches.launchingSoon.map((l) =>
              l.id === launch.id
                ? {
                    ...l,
                    reactions: {
                      ...l.reactions,
                      likes: isLiked
                        ? l.reactions.likes.filter((id) => id !== userId)
                        : [...l.reactions.likes, userId],
                    },
                  }
                : l
            ),
            launched: day.launches.launched.map((l) =>
              l.id === launch.id
                ? {
                    ...l,
                    reactions: {
                      ...l.reactions,
                      likes: isLiked
                        ? l.reactions.likes.filter((id) => id !== userId)
                        : [...l.reactions.likes, userId],
                    },
                  }
                : l
            ),
          },
        }))
      );
      if (selectedLaunch?.id === launch.id) {
        setSelectedLaunch({
          ...selectedLaunch,
          reactions: {
            ...selectedLaunch.reactions,
            likes: isLiked
              ? selectedLaunch.reactions.likes.filter((id) => id !== userId)
              : [...selectedLaunch.reactions.likes, userId],
          },
        });
      }
    } catch (error) {
      console.error('Error liking:', error);
    }
  };

  const handleCommentSubmit = async (launch: Launch) => {
    if (!user) {
      alert('Please sign in to comment!');
      return;
    }
    if (!comment.trim()) return;
    try {
      const launchRef = doc(db, 'tokenLaunch', launch.id);
      const newComment = { userId: user.uid, text: comment };
      await updateDoc(launchRef, {
        'reactions.comments': arrayUnion(newComment),
      });
      setLaunchData((prev) =>
        prev.map((day) => ({
          ...day,
          launches: {
            launchingSoon: day.launches.launchingSoon.map((l) =>
              l.id === launch.id
                ? {
                    ...l,
                    reactions: {
                      ...l.reactions,
                      comments: [...l.reactions.comments, newComment],
                    },
                  }
                : l
            ),
            launched: day.launches.launched.map((l) =>
              l.id === launch.id
                ? {
                    ...l,
                    reactions: {
                      ...l.reactions,
                      comments: [...l.reactions.comments, newComment],
                    },
                  }
                : l
            ),
          },
        }))
      );
      if (selectedLaunch?.id === launch.id) {
        setSelectedLaunch({
          ...selectedLaunch,
          reactions: {
            ...selectedLaunch.reactions,
            comments: [...selectedLaunch.reactions.comments, newComment],
          },
        });
      }
      setComment('');
    } catch (error) {
      console.error('Error commenting:', error);
    }
  };

  const handleFollow = async (launch: Launch) => {
    if (!user) {
      alert('Please sign in to follow launches!');
      return;
    }
    try {
      const launchRef = doc(db, 'tokenLaunch', launch.id);
      const userId = user.uid;
      const isFollowing = launch.followers.includes(userId);
      await updateDoc(launchRef, {
        followers: isFollowing ? arrayRemove(userId) : arrayUnion(userId),
      });
      setLaunchData((prev) =>
        prev.map((day) => ({
          ...day,
          launches: {
            launchingSoon: day.launches.launchingSoon.map((l) =>
              l.id === launch.id
                ? {
                    ...l,
                    followers: isFollowing
                      ? l.followers.filter((id) => id !== userId)
                      : [...l.followers, userId],
                  }
                : l
            ),
            launched: day.launches.launched.map((l) =>
              l.id === launch.id
                ? {
                    ...l,
                    followers: isFollowing
                      ? l.followers.filter((id) => id !== userId)
                      : [...l.followers, userId],
                  }
                : l
            ),
          },
        }))
      );
      if (selectedLaunch?.id === launch.id) {
        setSelectedLaunch({
          ...selectedLaunch,
          followers: isFollowing
            ? selectedLaunch.followers.filter((id) => id !== userId)
            : [...selectedLaunch.followers, userId],
        });
      }
      setFollowedProjects((prev) =>
        isFollowing
          ? prev.filter((id) => id !== launch.id)
          : [...prev, launch.id]
      );
      if (!isFollowing && Notification.permission === 'granted') {
        new Notification(`Following ${launch.name}`, {
          body: `You'll be notified about updates for ${launch.name}.`,
        });
      }
    } catch (error) {
      console.error('Error following:', error);
    }
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const { source, destination } = result;
    const sourceDay = launchData.find((day) => day.fullDate === source.droppableId.split('-')[0]);
    const destDay = launchData.find((day) => day.fullDate === destination.droppableId.split('-')[0]);
    if (!sourceDay || !destDay) return;

    const sourceSection = source.droppableId.includes('launchingSoon') ? 'launchingSoon' : 'launched';
    const destSection = destination.droppableId.includes('launchingSoon') ? 'launchingSoon' : 'launched';

    const sourceLaunches = [...sourceDay.launches[sourceSection]];
    const [movedLaunch] = sourceLaunches.splice(source.index, 1);
    const destLaunches = [...destDay.launches[destSection]];
    destLaunches.splice(destination.index, 0, { ...movedLaunch, date: destDay.fullDate });

    setLaunchData((prev) =>
      prev.map((day) => {
        if (day.fullDate === source.droppableId.split('-')[0]) {
          return { ...day, launches: { ...day.launches, [sourceSection]: sourceLaunches } };
        }
        if (day.fullDate === destination.droppableId.split('-')[0]) {
          return { ...day, launches: { ...day.launches, [destSection]: destLaunches } };
        }
        return day;
      })
    );

    // Note: Actual Firebase update would be needed here
    console.log(`Moved launch ${movedLaunch.id} to ${destDay.fullDate} - ${destSection}`);
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-gray-950 text-gray-200">
      <Header
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex-grow container mx-auto px-4 py-8"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-400 mb-6 flex items-center gap-2">
          <FiSend className="w-8 h-8 text-blue-400" />
          Launch Calendar
        </h2>
        <div className="bg-gray-900 p-6 rounded-xl shadow-xl border border-blue-500/30">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 h-full">
              {Array.from({ length: 7 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-gray-800 p-4 rounded-lg shadow-md border border-blue-500/30 min-h-[20rem] flex flex-col animate-pulse"
                >
                  <div className="h-6 bg-gray-700 rounded w-1/3 mx-auto mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded w-1/4 mx-auto mb-4"></div>
                  <div className="flex-grow space-y-4">
                    <div className="bg-gray-700 p-3 rounded-md border border-blue-500/30">
                      <div className="h-4 bg-gray-600 rounded w-1/2 mx-auto mb-2"></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-800 p-2 rounded-md h-16 border border-blue-500/30"></div>
                        <div className="bg-gray-800 p-2 rounded-md h-16 border border-blue-500/30"></div>
                      </div>
                    </div>
                    <div className="bg-blue-600/20 p-3 rounded-md border border-blue-500/30">
                      <div className="h-4 bg-blue-500/30 rounded w-1/2 mx-auto mb-2"></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-800 p-2 rounded-md h-16 border border-blue-500/30"></div>
                        <div className="bg-gray-800 p-2 rounded-md h-16 border border-blue-500/30"></div>
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
                whileTap={{ scale: 0.95 }}
                onClick={fetchLaunchData}
                className="mt-2 text-blue-400 underline hover:text-blue-300"
              >
                Retry
              </motion.button>
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 h-full">
                {launchData.map((day, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    className="bg-gray-800 p-4 rounded-lg shadow-md border border-blue-500/30 min-h-[20rem] flex flex-col"
                  >
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-blue-400">{day.day}</h2>
                      <p className="text-gray-200 text-sm">{day.date}</p>
                    </div>
                    <div className="flex-grow mt-4 flex flex-col space-y-4">
                      <Droppable droppableId={`${day.fullDate}-launchingSoon`}>
                        {(provided: DroppableProvided) => (
                          <div
                            className="bg-gray-900 p-3 rounded-md border border-blue-500/30 flex-1"
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                          >
                            <h3 className="text-sm font-semibold text-gray-200 text-center mb-2 flex items-center justify-center gap-1">
                              <FiSend className="w-5 h-5 text-gray-200" />
                              Launching Soon
                            </h3>
                            {day.launches.launchingSoon.length === 0 ? (
                              <p className="text-sm text-gray-200 text-center">No launches scheduled</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                {day.launches.launchingSoon.map((launch, idx) => (
                                  <Draggable key={launch.id} draggableId={launch.id} index={idx}>
                                    {(provided: DraggableProvided) => (
                                      <motion.div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className="flex flex-col items-center bg-gray-950 p-2 rounded-md shadow-sm hover:bg-gray-700 transition-all h-16 justify-center cursor-pointer border border-blue-500/30"
                                        whileHover={{ scale: 1.05 }}
                                        onClick={() => setSelectedLaunch(launch)}
                                        data-tooltip-id={`launch-soon-${launch.id}`}
                                      >
                                        {launch.logo ? (
                                          <img
                                            src={launch.logo}
                                            alt={launch.name}
                                            className="w-8 h-8 rounded-full mb-1 object-cover border border-blue-500/30"
                                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                              e.currentTarget.src = '/fallback.png';
                                            }}
                                          />
                                        ) : (
                                          <div className="w-8 h-8 bg-gray-800 rounded-full mb-1 border border-blue-500/30"></div>
                                        )}
                                        <p className="text-sm font-semibold text-gray-200 truncate w-full text-center">
                                          {launch.name || 'TBA'}
                                        </p>
                                        <p className="text-xs text-gray-300">{launch.ticker || ''}</p>
                                        <Tooltip id={`launch-soon-${launch.id}`} place="top" content={launch.description || 'No description available'} />
                                      </motion.div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                      <Droppable droppableId={`${day.fullDate}-launched`}>
                        {(provided: DroppableProvided) => (
                          <div
                            className="bg-blue-600/20 p-3 rounded-md border border-blue-500/30 flex-1"
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                          >
                            <h3 className="text-sm font-semibold text-gray-200 text-center mb-2 flex items-center justify-center gap-1">
                              <FiCheckCircle className="w-5 h-5 text-gray-200" />
                              Launched
                            </h3>
                            {day.launches.launched.length === 0 ? (
                              <p className="text-sm text-gray-200 text-center">No launches yet</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                {day.launches.launched.map((launch, idx) => (
                                  <Draggable key={launch.id} draggableId={launch.id} index={idx}>
                                    {(provided: DraggableProvided) => (
                                      <motion.div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className="flex flex-col items-center bg-gray-950 p-2 rounded-md shadow-sm hover:bg-gray-700 transition-all h-16 justify-center cursor-pointer border border-blue-500/30"
                                        whileHover={{ scale: 1.05 }}
                                        onClick={() => setSelectedLaunch(launch)}
                                        data-tooltip-id={`launch-launched-${launch.id}`}
                                      >
                                        {launch.logo ? (
                                          <img
                                            src={launch.logo}
                                            alt={launch.name}
                                            className="w-8 h-8 rounded-full mb-1 object-cover border border-blue-500/30"
                                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                              e.currentTarget.src = '/fallback.png';
                                            }}
                                          />
                                        ) : (
                                          <div className="w-8 h-8 bg-gray-800 rounded-full mb-1 border border-blue-500/30"></div>
                                        )}
                                        <p className="text-sm font-semibold text-gray-200 truncate w-full text-center">
                                          {launch.name || 'TBA'}
                                        </p>
                                        <p className="text-xs text-gray-300">{launch.ticker || ''}</p>
                                        <Tooltip id={`launch-launched-${launch.id}`} place="top" content={launch.description || 'No description available'} />
                                      </motion.div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </motion.div>
                ))}
              </div>
            </DragDropContext>
          )}
        </div>

        {/* Separator Line */}
        <div className="w-full h-px bg-blue-500/30 my-8"></div>

        <EventCalendar user={user} followedProjects={followedProjects} />
      </motion.main>

      <div className="container mx-auto px-4 py-6 bg-gray-900 border border-blue-500/30 rounded-xl shadow-xl mb-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-blue-400 mb-2">
            Sign Up for Launch Alerts
          </h2>
          <p className="text-gray-200 text-base mb-4">
            Stay updated on upcoming token launches.
          </p>
          {user ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={requestNotificationPermission}
              className="px-6 py-2 bg-blue-600/80 text-gray-200 rounded-md hover:bg-blue-700 transition"
            >
              Enable Notifications
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSignIn}
              className="px-6 py-2 bg-blue-600/80 text-gray-200 rounded-md hover:bg-blue-700 transition"
            >
              Sign In to Subscribe
            </motion.button>
          )}
        </div>
      </div>

      {/* Floating Refresh Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={fetchLaunchData}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-gray-100 rounded-full shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all"
        aria-label="Refresh data"
        data-tooltip-id="refresh-tooltip"
      >
        <FiRefreshCw className="w-6 h-6" />
        <Tooltip id="refresh-tooltip" place="left" content="Refresh Data" />
      </motion.button>

      {/* Launch Details Modal */}
      <AnimatePresence>
        {selectedLaunch && (
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
              className="bg-gray-900 p-6 rounded-xl shadow-xl w-full max-w-lg relative border border-blue-500/30"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedLaunch(null)}
                className="absolute top-3 right-3 p-1 bg-gray-800 rounded-full text-gray-200 hover:bg-gray-700 transition-all"
                aria-label="Close launch details"
              >
                <FiX className="w-6 h-6" />
              </motion.button>
              <h3 className="text-xl font-bold text-gray-200 mb-4">
                {selectedLaunch.name || 'TBA'} ({selectedLaunch.ticker || 'N/A'})
              </h3>
              {selectedLaunch.logo ? (
                <img
                  src={selectedLaunch.logo}
                  alt={selectedLaunch.name}
                  className="w-16 h-16 rounded-full mx-auto my-3 object-cover border border-blue-500/30"
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    e.currentTarget.src = '/fallback.png';
                  }}
                />
              ) : (
                <div className="w-16 h-16 bg-gray-800 rounded-full mx-auto my-3 border border-blue-500/30"></div>
              )}
              <p className="text-base text-gray-200 mb-2">
                <strong>Project ID:</strong> {selectedLaunch.id}
              </p>
              <p className="text-base text-gray-200 mb-2">
                <strong>Launch Type:</strong> {selectedLaunch.launchType || 'N/A'}
              </p>
              <p className="text-base text-gray-200 mb-2">
                <strong>Launch Date:</strong> {selectedLaunch.date || 'N/A'}
              </p>
              <p className="text-base text-gray-200 mb-4 break-words">
                <strong>Description:</strong>{' '}
                {selectedLaunch.description || 'No description available.'}
              </p>
              <div className="flex flex-wrap justify-between mb-4 gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleVote(selectedLaunch, 'moon')}
                  className="bg-green-600 text-gray-200 px-4 py-2 rounded-md hover:bg-green-700 transition flex items-center gap-1"
                >
                  🚀 Moon ({selectedLaunch.votes.moon || 0})
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleVote(selectedLaunch, 'rug')}
                  className="bg-red-600 text-gray-200 px-4 py-2 rounded-md hover:bg-red-700 transition flex items-center gap-1"
                >
                  💩 Rug ({selectedLaunch.votes.rug || 0})
                </motion.button>
              </div>
              <div className="flex flex-wrap justify-between mb-4 gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleLike(selectedLaunch)}
                  className={`flex items-center gap-1 px-4 py-2 rounded-md transition ${
                    user && selectedLaunch.reactions.likes.includes(user.uid)
                      ? 'bg-blue-600/80 text-gray-200 hover:bg-blue-700'
                      : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-blue-500/30'
                  }`}
                >
                  <FiThumbsUp className="w-5 h-5" />
                  Like ({selectedLaunch.reactions.likes.length})
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleFollow(selectedLaunch)}
                  className={`flex items-center gap-1 px-4 py-2 rounded-md transition ${
                    user && selectedLaunch.followers.includes(user.uid)
                      ? 'bg-yellow-600 text-gray-200 hover:bg-yellow-700'
                      : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-blue-500/30'
                  }`}
                >
                  <FiBell className="w-5 h-5" />
                  {user && selectedLaunch.followers.includes(user.uid)
                    ? 'Unfollow'
                    : 'Follow'}{' '}
                  ({selectedLaunch.followers.length})
                </motion.button>
              </div>
              <div className="mb-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowComments(!showComments)}
                  className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-1"
                >
                  <FiShare2 className="w-5 h-5" />
                  Comments ({selectedLaunch.reactions.comments.length})
                </motion.button>
                <AnimatePresence>
                  {showComments && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {selectedLaunch.reactions.comments.length > 0 ? (
                        <ul className="space-y-2 max-h-40 overflow-y-auto">
                          {selectedLaunch.reactions.comments.map((c, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-gray-200 border-b border-blue-500/30 pb-1 break-words"
                            >
                              <strong>User {c.userId.slice(0, 8)}:</strong> {c.text}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-200">No comments yet.</p>
                      )}
                      {user && (
                        <div className="mt-2 flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Add a comment..."
                            className="flex-1 px-3 py-2 rounded-lg border border-blue-500/30 bg-gray-800 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Comment input"
                          />
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleCommentSubmit(selectedLaunch)}
                            className="bg-gradient-to-r from-blue-600 to-blue-700 text-gray-200 px-4 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all"
                            aria-label="Post comment"
                          >
                            Post
                          </motion.button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const shareData = {
                    title: selectedLaunch.name,
                    text: `Check out ${selectedLaunch.name} (${selectedLaunch.ticker}) on the Launch Calendar!`,
                    url: window.location.href,
                  };
                  navigator.share(shareData).catch(() => {
                    navigator.clipboard.writeText(
                      `${selectedLaunch.name} (${selectedLaunch.ticker}): ${window.location.href}`
                    );
                    alert('Link copied to clipboard!');
                  });
                }}
                className="w-full bg-gray-800 text-gray-200 py-2 rounded-lg hover:bg-gray-700 transition flex items-center justify-center gap-1 border border-blue-500/30"
              >
                <FiShare2 className="w-5 h-5" />
                Share
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}