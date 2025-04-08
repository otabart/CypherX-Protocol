"use client";

import React from "react"; // Added this import
import { useState, useEffect } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { motion } from "framer-motion";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";

// Types for Launch Data
interface Launch {
  name?: string;
  ticker?: string;
  logo?: string;
  launchType?: string;
  votes?: { moon: number; rug: number };
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

// Utility to get the current week's dates
function getCurrentWeekDates(): { day: string; date: string; fullDate: string }[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Sunday) to 6 (Saturday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek + 1); // Start from Monday

  const days = [];
  const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(startOfWeek);
    currentDay.setDate(startOfWeek.getDate() + i);
    days.push({
      day: dayNames[i],
      date: currentDay.getDate().toString(),
      fullDate: currentDay.toISOString().split("T")[0], // YYYY-MM-DD
    });
  }
  return days;
}

function requestNotificationPermission() {
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export default function LaunchCalendar() {
  const [launchData, setLaunchData] = useState<LaunchDay[]>([]);
  const [selectedLaunch, setSelectedLaunch] = useState<Launch | null>(null);
  const [loading, setLoading] = useState(true);

  // Calculate the current week's dates
  const weekDates = getCurrentWeekDates();

  // Fetch launch data from Firestore
  useEffect(() => {
    async function fetchLaunchData() {
      setLoading(true);
      try {
        const startDate = weekDates[0].fullDate;
        const endDate = weekDates[6].fullDate;
        const q = query(
          collection(db, "tokenLaunch"),
          where("date", ">=", startDate),
          where("date", "<=", endDate)
        );
        const querySnapshot = await getDocs(q);

        // Map Firestore data to launchData format
        const fetchedData: { [key: string]: DayLaunches } = {};
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedData[data.date] = {
            launchingSoon: data.launches?.launchingSoon || [],
            launched: data.launches?.launched || [],
          };
        });

        // Build launchData array for the week
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
        console.error("Error fetching launch data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLaunchData();
  }, []);

  const totalLaunches = launchData.reduce(
    (acc, day) =>
      acc + day.launches.launchingSoon.length + day.launches.launched.length,
    0
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex-grow container mx-auto px-4 py-12"
      >
        <div className="bg-white p-8 rounded-xl shadow-xl border border-gray-200">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
              {Array.from({ length: 7 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-white p-4 rounded-lg shadow-md border border-gray-200 h-80 flex flex-col animate-pulse"
                >
                  <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-4"></div>
                  <div className="flex-grow space-y-4">
                    <div className="bg-gray-200 p-3 rounded-md">
                      <div className="h-4 bg-gray-300 rounded w-1/2 mx-auto mb-2"></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white p-2 rounded-md h-16"></div>
                        <div className="bg-white p-2 rounded-md h-16"></div>
                      </div>
                    </div>
                    <div className="bg-[#0052FF] p-3 rounded-md">
                      <div className="h-4 bg-blue-300 rounded w-1/2 mx-auto mb-2"></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white p-2 rounded-md h-16"></div>
                        <div className="bg-white p-2 rounded-md h-16"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
              {launchData.map((day, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                  className="bg-white p-4 rounded-lg shadow-md border border-gray-200 hover:shadow-xl transition-all h-80 flex flex-col"
                >
                  {/* Day & Date */}
                  <div>
                    <h2 className="text-xl font-bold text-[#0052FF] text-center">{day.day}</h2>
                    <p className="text-gray-500 text-center text-sm">{day.date}</p>
                  </div>
                  {/* Content Container */}
                  <div className="flex-grow mt-4 flex flex-col justify-between space-y-4">
                    {/* Launching Soon (Light Gray Box) */}
                    <div className="bg-gray-100 p-3 rounded-md flex-1">
                      <h3 className="text-xs font-semibold text-gray-700 text-center mb-2">
                        Launching Soon
                      </h3>
                      {day.launches.launchingSoon.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center">No launches scheduled</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {day.launches.launchingSoon.map((launch, idx) => (
                            <motion.div
                              key={idx}
                              className="flex flex-col items-center bg-white p-2 rounded-md shadow-sm hover:bg-gray-50 transition-all h-16 justify-center cursor-pointer"
                              whileHover={{ scale: 1.05 }}
                              onClick={() => setSelectedLaunch(launch)}
                            >
                              {launch.logo ? (
                                <img
                                  src={launch.logo}
                                  alt={launch.name}
                                  className="w-8 h-8 rounded-full mb-1"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-gray-200 rounded-full mb-1"></div>
                              )}
                              <p className="text-[10px] font-semibold text-gray-800 truncate">
                                {launch.name || "TBA"}
                              </p>
                              <p className="text-[9px] text-gray-500">{launch.ticker || ""}</p>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Launched (Coinbase Blue Box) */}
                    <div className="bg-[#0052FF] p-3 rounded-md flex-1">
                      <h3 className="text-xs font-semibold text-white text-center mb-2">
                        Launched
                      </h3>
                      {day.launches.launched.length === 0 ? (
                        <p className="text-xs text-blue-100 text-center">No launches yet</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {day.launches.launched.map((launch, idx) => (
                            <motion.div
                              key={idx}
                              className="flex flex-col items-center bg-white p-2 rounded-md shadow-sm hover:bg-gray-50 transition-all h-16 justify-center cursor-pointer"
                              whileHover={{ scale: 1.05 }}
                              onClick={() => setSelectedLaunch(launch)}
                            >
                              {launch.logo ? (
                                <img
                                  src={launch.logo}
                                  alt={launch.name}
                                  className="w-8 h-8 rounded-full mb-1"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-gray-200 rounded-full mb-1"></div>
                              )}
                              <p className="text-[10px] font-semibold text-gray-800 truncate">
                                {launch.name || "TBA"}
                              </p>
                              <p className="text-[9px] text-gray-500">{launch.ticker || ""}</p>
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
      </motion.main>

      {/* Subscription Banner */}
      <div className="container mx-auto px-4 py-6 bg-white border border-gray-200 rounded-xl shadow-lg mb-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#0052FF] mb-2">Sign Up for Launch Alerts</h2>
          <p className="text-[#0052FF] text-sm mb-4">Stay updated on upcoming token launches.</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            className="px-6 py-2 bg-[#0052FF] text-white rounded-md hover:bg-[#0042CC] transition"
          >
            Subscribe
          </motion.button>
        </div>
      </div>

      {/* Modal for Selected Launch */}
      {selectedLaunch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm relative"
          >
            <button
              onClick={() => setSelectedLaunch(null)}
              className="absolute top-3 right-3 text-gray-600 text-lg hover:text-gray-800"
            >
              ×
            </button>
            <h3 className="text-xl font-bold text-gray-900">
              {selectedLaunch.name || "TBA"} ({selectedLaunch.ticker || "N/A"})
            </h3>
            {selectedLaunch.logo ? (
              <img
                src={selectedLaunch.logo}
                alt={selectedLaunch.name}
                className="w-16 h-16 rounded-full mx-auto my-3"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto my-3"></div>
            )}
            <p className="text-sm text-gray-600 mb-4">
              Launch Type: {selectedLaunch.launchType || "N/A"}
            </p>
            <div className="flex justify-between mb-4">
              <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition">
                🚀 Moon ({selectedLaunch.votes?.moon || 0})
              </button>
              <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition">
                💩 Rug ({selectedLaunch.votes?.rug || 0})
              </button>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={requestNotificationPermission}
              className="w-full bg-[#0052FF] text-white py-2 rounded-lg hover:bg-[#0042CC] transition"
            >
              🔔 Enable Launch Alerts
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}










