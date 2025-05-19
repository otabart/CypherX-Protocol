'use client';

import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
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
} from 'react-icons/fi';
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
  launches: DayLaunches;
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

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-200">
      <Header
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex-grow container mx-auto px-4 py-8 sm:py-12"
      >
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
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-950 p-2 rounded-md h-16 border border-blue-500/20"></div>
                        <div className="bg-gray-950 p-2 rounded-md h-16 border border-blue-500/20"></div>
                      </div>
                    </div>
                    <div className="bg-blue-500/20 p-3 rounded-md border border-blue-500/20">
                      <div className="h-4 bg-blue-400/30 rounded w-1/2 mx-auto mb-2"></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-950 p-2 rounded-md h-16 border border-blue-500/20"></div>
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
                onClick={fetchLaunchData}
                className="mt-2 text-blue-400 underline hover:text-blue-300 text-sm sm:text-base"
              >
                Retry
              </motion.button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 sm:gap-6">
              {launchData.map((day, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                  className="bg-gray-950 p-4 rounded-lg shadow-md border border-blue-500/20 min-h-80 flex flex-col"
                >
                  <div className="text-center">
                    <h2 className="text-lg sm:text-xl font-bold text-blue-400">
                      {day.day}
                    </h2>
                    <p className="text-gray-300 text-xs sm:text-sm">
                      {day.date}
                    </p>
                  </div>
                  <div className="flex-grow mt-4 flex flex-col space-y-4">
                    <div className="bg-gray-900 p-3 rounded-md border border-blue-500/20 flex-1">
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-200 text-center mb-2 flex items-center justify-center gap-1">
                        <FiSend className="w-4 h-4 sm:w-5 sm:h-5 text-gray-200" />
                        Launching Soon
                      </h3>
                      {day.launches.launchingSoon.length === 0 ? (
                        <p className="text-xs sm:text-sm text-gray-300 text-center">
                          No launches scheduled
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                          {day.launches.launchingSoon.map((launch, idx) => (
                            <motion.div
                              key={idx}
                              className="flex flex-col items-center bg-gray-950 p-2 rounded-md shadow-sm hover:bg-gray-800 transition-all h-16 justify-center cursor-pointer border border-blue-500/20"
                              whileHover={{ scale: 1.05 }}
                              onClick={() => setSelectedLaunch(launch)}
                            >
                              {launch.logo ? (
                                <img
                                  src={launch.logo}
                                  alt={launch.name}
                                  className="w-8 h-8 rounded-full mb-1 object-cover border border-blue-500/20"
                                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    e.currentTarget.src = '/fallback.png';
                                  }}
                                />
                              ) : (
                                <div className="w-8 h-8 bg-gray-800 rounded-full mb-1 border border-blue-500/20"></div>
                              )}
                              <p className="text-xs sm:text-sm font-semibold text-gray-200 truncate w-full text-center">
                                {launch.name || 'TBA'}
                              </p>
                              <p className="text-[10px] sm:text-xs text-gray-300">
                                {launch.ticker || ''}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="bg-blue-500/20 p-3 rounded-md border border-blue-500/20 flex-1">
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-200 text-center mb-2 flex items-center justify-center gap-1">
                        <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-200" />
                        Launched
                      </h3>
                      {day.launches.launched.length === 0 ? (
                        <p className="text-xs sm:text-sm text-gray-300 text-center">
                          No launches yet
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                          {day.launches.launched.map((launch, idx) => (
                            <motion.div
                              key={idx}
                              className="flex flex-col items-center bg-gray-950 p-2 rounded-md shadow-sm hover:bg-gray-800 transition-all h-16 justify-center cursor-pointer border border-blue-500/20"
                              whileHover={{ scale: 1.05 }}
                              onClick={() => setSelectedLaunch(launch)}
                            >
                              {launch.logo ? (
                                <img
                                  src={launch.logo}
                                  alt={launch.name}
                                  className="w-8 h-8 rounded-full mb-1 object-cover border border-blue-500/20"
                                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    e.currentTarget.src = '/fallback.png';
                                  }}
                                />
                              ) : (
                                <div className="w-8 h-8 bg-gray-800 rounded-full mb-1 border border-blue-500/20"></div>
                              )}
                              <p className="text-xs sm:text-sm font-semibold text-gray-200 truncate w-full text-center">
                                {launch.name || 'TBA'}
                              </p>
                              <p className="text-[10px] sm:text-xs text-gray-300">
                                {launch.ticker || ''}
                              </p>
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

        <EventCalendar user={user} followedProjects={followedProjects} />
      </motion.main>

      <div className="container mx-auto px-4 py-6 bg-gray-950 border border-blue-500/20 rounded-xl shadow-md mb-12">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-blue-400 mb-2">
            Sign Up for Launch Alerts
          </h2>
          <p className="text-gray-300 text-sm sm:text-base mb-4">
            Stay updated on upcoming token launches.
          </p>
          {user ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={requestNotificationPermission}
              className="px-4 sm:px-6 py-2 bg-blue-500/20 text-gray-200 rounded-md hover:bg-blue-400/30 transition text-sm sm:text-base"
            >
              Enable Notifications
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={handleSignIn}
              className="px-4 sm:px-6 py-2 bg-blue-500/20 text-gray-200 rounded-md hover:bg-blue-400/30 transition text-sm sm:text-base"
            >
              Sign In to Subscribe
            </motion.button>
          )}
        </div>
      </div>

      {selectedLaunch && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-950 p-6 rounded-xl shadow-md w-full max-w-md sm:max-w-lg relative mx-4 my-8 border border-blue-500/20"
          >
            <button
              onClick={() => setSelectedLaunch(null)}
              className="absolute top-3 right-3 text-gray-300 text-lg hover:text-gray-200"
            >
              ×
            </button>
            <h3 className="text-lg sm:text-xl font-bold text-gray-200 mb-4">
              {selectedLaunch.name || 'TBA'} ({selectedLaunch.ticker || 'N/A'})
            </h3>
            {selectedLaunch.logo ? (
              <img
                src={selectedLaunch.logo}
                alt={selectedLaunch.name}
                className="w-16 h-16 rounded-full mx-auto my-3 object-cover border border-blue-500/20"
                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                  e.currentTarget.src = '/fallback.png';
                }}
              />
            ) : (
              <div className="w-16 h-16 bg-gray-800 rounded-full mx-auto my-3 border border-blue-500/20"></div>
            )}
            <p className="text-sm sm:text-base text-gray-300 mb-2">
              <strong>Project ID:</strong> {selectedLaunch.id}
            </p>
            <p className="text-sm sm:text-base text-gray-300 mb-2">
              <strong>Launch Type:</strong> {selectedLaunch.launchType || 'N/A'}
            </p>
            <p className="text-sm sm:text-base text-gray-300 mb-2">
              <strong>Launch Date:</strong> {selectedLaunch.date || 'N/A'}
            </p>
            <p className="text-sm sm:text-base text-gray-300 mb-4 break-words">
              <strong>Description:</strong>{' '}
              {selectedLaunch.description || 'No description available.'}
            </p>
            <div className="flex flex-wrap justify-between mb-4 gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => handleVote(selectedLaunch, 'moon')}
                className="bg-green-500 text-gray-200 px-3 sm:px-4 py-2 rounded-md hover:bg-green-600 transition text-sm sm:text-base flex items-center gap-1"
              >
                🚀 Moon ({selectedLaunch.votes.moon || 0})
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => handleVote(selectedLaunch, 'rug')}
                className="bg-red-500 text-gray-200 px-3 sm:px-4 py-2 rounded-md hover:bg-red-600 transition text-sm sm:text-base flex items-center gap-1"
              >
                💩 Rug ({selectedLaunch.votes.rug || 0})
              </motion.button>
            </div>
            <div className="flex flex-wrap justify-between mb-4 gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => handleLike(selectedLaunch)}
                className={`flex items-center gap-1 px-3 sm:px-4 py-2 rounded-md text-sm sm:text-base transition ${
                  user && selectedLaunch.reactions.likes.includes(user.uid)
                    ? 'bg-blue-500/20 text-gray-200 hover:bg-blue-400/30'
                    : 'bg-gray-900 text-gray-200 hover:bg-gray-800 border border-blue-500/20'
                }`}
              >
                <FiThumbsUp className="w-4 h-4 sm:w-5 sm:h-5" />
                Like ({selectedLaunch.reactions.likes.length})
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => handleFollow(selectedLaunch)}
                className={`flex items-center gap-1 px-3 sm:px-4 py-2 rounded-md text-sm sm:text-base transition ${
                  user && selectedLaunch.followers.includes(user.uid)
                    ? 'bg-yellow-500 text-gray-200 hover:bg-yellow-600'
                    : 'bg-gray-900 text-gray-200 hover:bg-gray-800 border border-blue-500/20'
                }`}
              >
                <FiBell className="w-4 h-4 sm:w-5 sm:h-5" />
                {user && selectedLaunch.followers.includes(user.uid)
                  ? 'Unfollow'
                  : 'Follow'}{' '}
                ({selectedLaunch.followers.length})
              </motion.button>
            </div>
            <div className="mb-4">
              <h4 className="text-sm sm:text-base font-semibold text-gray-200 mb-2">
                Comments
              </h4>
              {selectedLaunch.reactions.comments.length > 0 ? (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedLaunch.reactions.comments.map((c, idx) => (
                    <li
                      key={idx}
                      className="text-xs sm:text-sm text-gray-300 border-b border-blue-500/20 pb-1 break-words"
                    >
                      <strong>User {c.userId.slice(0, 8)}:</strong> {c.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs sm:text-sm text-gray-300">
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
                    className="flex-1 px-3 py-1 rounded-md border border-blue-500/20 bg-gray-900 text-gray-200 placeholder-gray-400 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={() => handleCommentSubmit(selectedLaunch)}
                    className="bg-blue-500/20 text-gray-200 px-3 py-1 rounded-md hover:bg-blue-400/30 transition text-sm sm:text-base"
                  >
                    Post
                  </motion.button>
                </div>
              )}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
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
              className="w-full bg-gray-900 text-gray-200 py-2 rounded-md hover:bg-gray-800 transition flex items-center justify-center gap-1 text-sm sm:text-base border border-blue-500/20"
            >
              <FiShare2 className="w-4 h-4 sm:w-5 sm:h-5" />
              Share
            </motion.button>
          </motion.div>
        </div>
      )}

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}