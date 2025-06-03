// app/calendar/LaunchCalendar.tsx
'use client';

import React, { useState, useEffect } from 'react';
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
import { db, auth } from '../../lib/firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  FiSend,
  FiThumbsUp,
  FiBell,
  FiRefreshCw,
  FiX,
} from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import Header from '../components/Header';
import Footer from '../components/Footer';
import EventCalendar from '../event-calendar/EventCalendar';

// ────────── Types ──────────

interface Launch {
  id: string;
  name: string;
  ticker: string;
  logo?: string;
  launchType: string;
  date: string; // “YYYY-MM-DD”
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
  day: string; // e.g. “MON”
  date: string; // e.g. “2”
  fullDate: string; // e.g. “2025-06-02”
  launches: DayLaunches;
}

// ────────── Helpers ──────────

function getCurrentWeekDates(): { day: string; date: string; fullDate: string }[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun)…6 (Sat)
  // shift so Monday is first
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

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

function timestampToDateString(timestamp: Timestamp): string {
  const dt = timestamp.toDate();
  return dt.toISOString().split('T')[0]; // “2025-06-05”
}

/** If today is the launch date, return percent (0–100) of time from midnight. */
function getTodayProgressPercent(launchFullDate: string): number {
  const todayISO = new Date().toISOString().split('T')[0];
  if (launchFullDate !== todayISO) return 0;
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const elapsed = now.getTime() - midnight.getTime();
  const percent = (elapsed / (24 * 60 * 60 * 1000)) * 100;
  return Math.min(Math.max(percent, 0), 100);
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

// ────────── Main Component ──────────

export default function LaunchCalendar() {
  const [launchData, setLaunchData] = useState<LaunchDay[]>([]);
  const [selectedLaunch, setSelectedLaunch] = useState<Launch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [commentText, setCommentText] = useState('');
  const [followedProjects, setFollowedProjects] = useState<string[]>([]);
  const [showComments, setShowComments] = useState(false);

  // One‐time “Sign up” popup (session‐only)
  const [showSignupPopup, setShowSignupPopup] = useState(true);

  const weekDates = getCurrentWeekDates();

  // ─── Listen for Auth Changes ───
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const fetchFollowed = async () => {
          const q = query(
            collection(db, 'tokenLaunch'),
            where('followers', 'array-contains', currentUser.uid)
          );
          const snap = await getDocs(q);
          setFollowedProjects(snap.docs.map((d) => d.id));
        };
        fetchFollowed();
      } else {
        setFollowedProjects([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // ─── Fetch Launch Data ───
  const fetchLaunchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const start = weekDates[0].fullDate; // e.g. “2025-06-02”
      const end = weekDates[6].fullDate; // e.g. “2025-06-08”
      const startTs = Timestamp.fromDate(new Date(start));
      const endTs = Timestamp.fromDate(new Date(end + 'T23:59:59.999Z'));

      const q = query(
        collection(db, 'tokenLaunch'),
        where('date', '>=', startTs),
        where('date', '<=', endTs)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setError('No launches found for this week.');
        setLoading(false);
        return;
      }

      const temp: Record<string, DayLaunches> = {};
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const launchDateStr = timestampToDateString(d.date);
        const launch: Launch = {
          id: docSnap.id,
          name: d.name || '',
          ticker: d.ticker || '',
          logo: d.logo,
          launchType: d.launchType || '',
          date: launchDateStr,
          description: d.description || '',
          votes: d.votes || { moon: 0, rug: 0 },
          reactions: d.reactions || { likes: [], comments: [] },
          followers: d.followers || [],
        };
        if (!temp[launchDateStr]) {
          temp[launchDateStr] = { launchingSoon: [], launched: [] };
        }
        const now = new Date();
        const ld = new Date(launchDateStr + 'T00:00:00');
        if (now > ld) {
          temp[launchDateStr].launched.push(launch);
        } else {
          temp[launchDateStr].launchingSoon.push(launch);
        }
      });

      const finalData: LaunchDay[] = weekDates.map((wd) => ({
        day: wd.day,
        date: wd.date,
        fullDate: wd.fullDate,
        launches: temp[wd.fullDate] || { launchingSoon: [], launched: [] },
      }));

      setLaunchData(finalData);
    } catch (err) {
      console.error(err);
      setError('Failed to load launch data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLaunchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Sign In / Out ───
  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
    }
  };
  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.error(e);
    }
  };

  // ─── Voting / Likes / Comments / Follow ───

  const handleVote = async (launch: Launch, voteType: 'moon' | 'rug') => {
    if (!user) {
      alert('Please sign in to vote.');
      return;
    }
    try {
      const ref = doc(db, 'tokenLaunch', launch.id);
      await updateDoc(ref, {
        [`votes.${voteType}`]: launch.votes[voteType] + 1,
      });
      fetchLaunchData();
      if (selectedLaunch?.id === launch.id) {
        setSelectedLaunch({
          ...selectedLaunch,
          votes: {
            ...selectedLaunch.votes,
            [voteType]: selectedLaunch.votes[voteType] + 1,
          },
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLike = async (launch: Launch) => {
    if (!user) {
      alert('Please sign in to like.');
      return;
    }
    try {
      const ref = doc(db, 'tokenLaunch', launch.id);
      const uid = user.uid;
      const isLiked = launch.reactions.likes.includes(uid);
      await updateDoc(ref, {
        'reactions.likes': isLiked ? arrayRemove(uid) : arrayUnion(uid),
      });
      fetchLaunchData();
      if (selectedLaunch?.id === launch.id) {
        const newLikes = isLiked
          ? selectedLaunch.reactions.likes.filter((id) => id !== uid)
          : [...selectedLaunch.reactions.likes, uid];
        setSelectedLaunch({
          ...selectedLaunch,
          reactions: {
            ...selectedLaunch.reactions,
            likes: newLikes,
          },
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCommentSubmit = async (launch: Launch) => {
    if (!user) {
      alert('Please sign in to comment.');
      return;
    }
    if (!commentText.trim()) return;
    try {
      const ref = doc(db, 'tokenLaunch', launch.id);
      const newComment = { userId: user.uid, text: commentText.trim() };
      await updateDoc(ref, {
        'reactions.comments': arrayUnion(newComment),
      });
      setCommentText('');
      fetchLaunchData();
      if (selectedLaunch?.id === launch.id) {
        setSelectedLaunch({
          ...selectedLaunch,
          reactions: {
            ...selectedLaunch.reactions,
            comments: [...selectedLaunch.reactions.comments, newComment],
          },
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFollow = async (launch: Launch) => {
    if (!user) {
      alert('Please sign in to follow.');
      return;
    }
    try {
      const ref = doc(db, 'tokenLaunch', launch.id);
      const uid = user.uid;
      const isFollowing = launch.followers.includes(uid);
      await updateDoc(ref, {
        followers: isFollowing ? arrayRemove(uid) : arrayUnion(uid),
      });
      fetchLaunchData();
      if (selectedLaunch?.id === launch.id) {
        const newFollowers = isFollowing
          ? selectedLaunch.followers.filter((id) => id !== uid)
          : [...selectedLaunch.followers, uid];
        setSelectedLaunch({
          ...selectedLaunch,
          followers: newFollowers,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ─── Notify new launch → “notifications” collection ───
  const notifyNewLaunch = async (launchId: string, name: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        type: 'launch',
        subjectId: launchId,
        title: name,
        when: Timestamp.now(),
      });
    } catch (e) {
      console.error('Failed to write launch notification', e);
    }
  };

  // ─── Render ───
  return (
    <div className="flex flex-col min-h-screen w-full bg-gray-950 text-gray-100">
      {/* HEADER */}
      <Header onSignIn={handleSignIn} onSignOut={handleSignOut} />

      {/* wrapper ensuring footer sticks to bottom */}
      <div className="flex-grow flex flex-col overflow-x-hidden">
        {/* SIGN-UP POPUP */}
        {showSignupPopup && (
          <div className="fixed inset-0 bg-gray-950/80 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 p-6 border border-blue-500/30 w-full max-w-md relative"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSignupPopup(false)}
                className="absolute top-3 right-3 p-1 bg-gray-800 rounded hover:bg-gray-700"
                aria-label="Close popup"
              >
                <FiX className="w-6 h-6 text-gray-100" />
              </motion.button>
              <h2 className="text-xl font-bold text-blue-400 mb-4 text-center">
                Sign Up for Launch Alerts
              </h2>
              <p className="text-gray-100 mb-4 text-center">
                Stay updated on upcoming token launches!
              </p>
              {user ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    requestNotificationPermission();
                    setShowSignupPopup(false);
                  }}
                  className="w-full bg-blue-600/80 text-gray-100 py-2 rounded hover:bg-blue-700 transition text-base"
                >
                  Enable Notifications
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    handleSignIn();
                    setShowSignupPopup(false);
                  }}
                  className="w-full bg-blue-600/80 text-gray-100 py-2 rounded hover:bg-blue-700 transition text-base"
                >
                  Sign In to Subscribe
                </motion.button>
              )}
            </motion.div>
          </div>
        )}

        {/* Full-width separator */}
        <div className="w-full border-b border-blue-500/30"></div>

        {/* LAUNCH CALENDAR GRID */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full flex-grow overflow-x-hidden"
        >
          <div className="w-full bg-gray-900">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 w-full divide-x divide-gray-700 overflow-x-hidden">
                {Array.from({ length: 7 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-900 animate-pulse w-full aspect-square flex flex-col p-4"
                  >
                    <div className="h-6 bg-gray-700 w-1/3 mx-auto mb-2"></div>
                    <div className="h-4 bg-gray-700 w-1/4 mx-auto mb-4"></div>
                    <div className="flex-1 space-y-4">
                      <div className="h-32 bg-gray-700"></div>
                      <div className="h-32 bg-gray-700"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center text-red-500 py-6 w-full">
                <p className="text-base">{error}</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={fetchLaunchData}
                  className="mt-2 text-blue-400 underline hover:text-blue-300"
                >
                  Retry
                </motion.button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 w-full divide-x divide-gray-700 overflow-x-hidden">
                {launchData.map((day, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1, duration: 0.3 }}
                    className="bg-gray-900 w-full aspect-square flex flex-col p-4"
                  >
                    {/* Day header */}
                    <div className="text-center mb-2">
                      <h2 className="text-2xl font-bold text-blue-400">
                        {day.day}
                      </h2>
                      <p className="text-base text-gray-100">{day.date}</p>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      {/* “Launching Soon” section (2-column grid) */}
                      <div className="mb-2">
                        <h3 className="text-base font-semibold text-gray-100 text-center mb-1 flex items-center justify-center gap-1">
                          <FiSend className="w-5 h-5 text-gray-100" />
                          Launching Soon
                        </h3>
                        {day.launches.launchingSoon.length === 0 ? (
                          <p className="text-base text-gray-100 text-center">
                            No launches
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 overflow-y-auto h-36 scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-800">
                            {day.launches.launchingSoon.map((launch) => {
                              const progress = getTodayProgressPercent(
                                day.fullDate
                              );
                              const showProgress =
                                progress > 0 && progress < 100;
                              return (
                                <div
                                  key={launch.id}
                                  className="bg-gray-800 p-2 flex flex-col items-center justify-center hover:bg-gray-700 cursor-pointer"
                                  onClick={() => {
                                    setSelectedLaunch(launch);
                                    notifyNewLaunch(launch.id, launch.name);
                                  }}
                                >
                                  <p className="text-base font-semibold text-gray-100 break-words">
                                    {launch.name || 'TBA'}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {launch.ticker || ''}
                                  </p>
                                  {showProgress && (
                                    <div className="mt-1 w-full">
                                      <div
                                        className="h-1 w-full bg-gray-700"
                                        data-tooltip-id={`prog-${launch.id}`}
                                        data-tooltip-content={`Day progress: ${progress.toFixed(
                                          0
                                        )}%`}
                                      >
                                        <div
                                          className="h-1 bg-blue-500"
                                          style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                      <Tooltip
                                        id={`prog-${launch.id}`}
                                        place="top"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* “Launched” section (2-column grid) */}
                      <div className="mt-2">
                        <h3 className="text-base font-semibold text-gray-100 text-center mb-1 flex items-center justify-center gap-1">
                          <FiSend className="w-5 h-5 text-gray-100 rotate-180" />
                          Launched
                        </h3>
                        {day.launches.launched.length === 0 ? (
                          <p className="text-base text-gray-100 text-center">
                            No launches
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 overflow-y-auto h-36 scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-800">
                            {day.launches.launched.map((launch) => (
                              <div
                                key={launch.id}
                                className="bg-gray-800 p-2 flex flex-col items-center justify-center hover:bg-gray-700 cursor-pointer"
                                onClick={() => {
                                  setSelectedLaunch(launch);
                                  notifyNewLaunch(launch.id, launch.name);
                                }}
                              >
                                <p className="text-base font-semibold text-gray-100 break-words">
                                  {launch.name || 'TBA'}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {launch.ticker || ''}
                                </p>
                              </div>
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
        </motion.div>

        {/* Separator between calendars */}
        <div className="w-full border-b border-blue-500/30 my-4"></div>

        {/* NESTED EVENT CALENDAR */}
        <EventCalendar user={user} followedProjects={followedProjects} />
      </div>

      {/* FLOATING REFRESH BUTTON */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={fetchLaunchData}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-gray-100 rounded-full shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all"
        aria-label="Refresh data"
        data-tooltip-id="refresh-launch-tooltip"
      >
        <FiRefreshCw className="w-6 h-6" />
        <Tooltip id="refresh-launch-tooltip" place="left" content="Refresh Launch Data" />
      </motion.button>

      {/* LAUNCH DETAILS MODAL */}
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
              className="bg-gray-900 p-6 border border-blue-500/20 w-full max-w-lg relative"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedLaunch(null)}
                className="absolute top-3 right-3 p-1 bg-gray-800 rounded hover:bg-gray-700"
                aria-label="Close launch details"
              >
                <FiX className="w-6 h-6 text-gray-100" />
              </motion.button>

              <h3 className="text-2xl font-bold text-gray-100 mb-4">
                {selectedLaunch.name || 'TBA'} ({selectedLaunch.ticker || 'N/A'})
              </h3>

              {selectedLaunch.logo ? (
                <img
                  src={selectedLaunch.logo}
                  alt={selectedLaunch.name}
                  className="w-20 h-20 rounded-full mx-auto my-3 object-cover border border-blue-500/20"
                  onError={(e) => {
                    e.currentTarget.src = '/fallback.png';
                  }}
                />
              ) : (
                <div className="w-20 h-20 bg-gray-800 rounded-full mx-auto my-3 border border-blue-500/20" />
              )}

              <p className="text-base text-gray-100 mb-2">
                <strong>Project ID:</strong> {selectedLaunch.id}
              </p>
              <p className="text-base text-gray-100 mb-2">
                <strong>Launch Type:</strong> {selectedLaunch.launchType || 'N/A'}
              </p>
              <p className="text-base text-gray-100 mb-2">
                <strong>Launch Date:</strong> {selectedLaunch.date || 'N/A'}
              </p>
              <p className="text-base text-gray-100 mb-4 break-words">
                <strong>Description:</strong>{' '}
                {selectedLaunch.description || 'No description available.'}
              </p>

              <div className="flex flex-wrap justify-between gap-2 mb-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleVote(selectedLaunch, 'moon')}
                  className="bg-green-600 text-gray-100 px-4 py-2 rounded hover:bg-green-700 transition flex items-center gap-1 text-base"
                >
                  🚀 Moon ({selectedLaunch.votes.moon || 0})
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleVote(selectedLaunch, 'rug')}
                  className="bg-red-600 text-gray-100 px-4 py-2 rounded hover:bg-red-700 transition flex items-center gap-1 text-base"
                >
                  💩 Rug ({selectedLaunch.votes.rug || 0})
                </motion.button>
              </div>

              <div className="flex flex-wrap justify-between gap-2 mb-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleLike(selectedLaunch)}
                  className={`flex items-center gap-1 px-4 py-2 rounded transition text-base ${
                    user && selectedLaunch.reactions.likes.includes(user.uid)
                      ? 'bg-blue-600/80 text-gray-100 hover:bg-blue-700'
                      : 'bg-gray-800 text-gray-100 hover:bg-gray-700 border border-blue-500/20'
                  }`}
                >
                  <FiThumbsUp className="w-5 h-5" />
                  Like ({selectedLaunch.reactions.likes.length})
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleFollow(selectedLaunch)}
                  className={`flex items-center gap-1 px-4 py-2 rounded transition text-base ${
                    user && selectedLaunch.followers.includes(user.uid)
                      ? 'bg-yellow-600 text-gray-100 hover:bg-yellow-700'
                      : 'bg-gray-800 text-gray-100 hover:bg-gray-700 border border-blue-500/20'
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
                  className="text-base font-semibold text-gray-100 mb-2 flex items-center gap-1"
                >
                  <FiSend className="w-5 h-5" />
                  Comments ({selectedLaunch.reactions.comments.length})
                </motion.button>
                {showComments && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2 mb-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500 scrollbar-track-gray-800"
                  >
                    {selectedLaunch.reactions.comments.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedLaunch.reactions.comments.map((c, idx) => (
                          <li
                            key={idx}
                            className="text-base text-gray-100 border-b border-blue-500/20 pb-1 break-words"
                          >
                            <strong>User {c.userId.slice(0, 8)}:</strong> {c.text}
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
                          className="flex-1 px-3 py-2 border border-blue-500/20 bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base rounded"
                          aria-label="Comment input"
                        />
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleCommentSubmit(selectedLaunch)}
                          className="bg-gradient-to-r from-blue-600 to-blue-700 text-gray-100 px-4 py-2 rounded hover:from-blue-700 hover:to-blue-800 transition text-base"
                          aria-label="Post comment"
                        >
                          Post
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const shareData = {
                    title: selectedLaunch.name,
                    text: `Check out ${selectedLaunch.name} (${selectedLaunch.ticker})!`,
                    url: window.location.href,
                  };
                  navigator.share(shareData).catch(() => {
                    navigator.clipboard.writeText(
                      `${selectedLaunch.name} (${selectedLaunch.ticker}): ${window.location.href}`
                    );
                    alert('Link copied to clipboard!');
                  });
                }}
                className="w-full bg-gray-800 text-gray-100 py-2 rounded hover:bg-gray-700 transition flex items-center justify-center gap-1 border border-blue-500/20 text-base"
              >
                <FiSend className="w-5 h-5" />
                Share
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}




