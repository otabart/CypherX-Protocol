"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Footer from "../components/Footer";
import Leaderboard from "./components/Leaderboard";
import PredictionList from "./components/PredictionList";
import PredictionForm from "./components/PredictionForm";
import {
  HomeIcon,
  ChartIcon,
  TrophyIcon,
  EditIcon,
  VerifiedIcon,
} from "../components/icons";

export default function AnalystsDashboard() {
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    async function fetchPredictions() {
      try {
        const response = await fetch("/api/predictions");
        const data = await response.json();
        setPredictions(data);
      } catch (error) {
        console.error("Error fetching predictions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPredictions();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      {/* ======= SIDEBAR ======= */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
        {/* Branding */}
        <div className="flex items-center justify-center p-4 border-b border-gray-200">
          <h1 className="text-xl font-extrabold text-[#0052FF]">Homebase</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {/* Dashboard -> /analysts */}
          <Link href="/analysts">
            <div className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer">
              <HomeIcon className="w-5 h-5 text-[#0052FF]" />
              <span className="font-medium">Dashboard</span>
            </div>
          </Link>

          {/* Predictions -> /analysts/[id]? 
              If you intend a static "Profile" page, you can do /analysts/profile. 
              Or keep reading for the dynamic route. */}
          <Link href="/analysts/1">
            <div className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer">
              <ChartIcon className="w-5 h-5 text-[#0052FF]" />
              <span className="font-medium">Predictions</span>
            </div>
          </Link>

          {/* Leaderboard -> /analysts/leaderboard */}
          <Link href="/analysts/leaderboard">
            <div className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer">
              <TrophyIcon className="w-5 h-5 text-[#0052FF]" />
              <span className="font-medium">Leaderboard</span>
            </div>
          </Link>
        </nav>
      </aside>

      {/* ======= MAIN CONTENT WRAPPER ======= */}
      <div className="flex-1 flex flex-col">
        {/* TOP BAR */}
        <div className="h-16 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Homebase Analysts</h2>
        </div>

        {/* SCROLLABLE MAIN CONTENT */}
        <main className="overflow-y-auto flex-1 p-4">
          {/* Hero Section */}
          <motion.section
            className="text-center py-8 bg-gradient-to-r from-[#0052FF] to-blue-400 text-white rounded-lg shadow mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-extrabold">Analysts Portal</h1>
            <p className="mt-2 text-white/90">
              Track top analysts, make predictions, and compete in trading challenges.
            </p>
          </motion.section>

          {/* Features Section */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white p-6 rounded-lg shadow"
            >
              <TrophyIcon className="w-8 h-8 text-[#0052FF] mb-2" />
              <h3 className="text-xl font-bold text-[#0052FF] mb-2">Leaderboard</h3>
              <p className="text-gray-600">Top-ranked analysts with the best win rates.</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white p-6 rounded-lg shadow"
            >
              <ChartIcon className="w-8 h-8 text-[#0052FF] mb-2" />
              <h3 className="text-xl font-bold text-[#0052FF] mb-2">Market Predictions</h3>
              <p className="text-gray-600">Track real-time coin price movements.</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-white p-6 rounded-lg shadow"
            >
              <VerifiedIcon className="w-8 h-8 text-[#0052FF] mb-2" />
              <h3 className="text-xl font-bold text-[#0052FF] mb-2">Verified Analysts</h3>
              <p className="text-gray-600">Follow expert traders &amp; analysts.</p>
            </motion.div>
          </section>

          {/* 2-Column Section: Live Predictions & Make a Prediction */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* LIVE PREDICTIONS */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-[#0052FF] mb-4">Live Predictions</h2>
              {loading ? (
                <p className="text-center text-gray-500">Loading predictions...</p>
              ) : predictions.length > 0 ? (
                <PredictionList />
              ) : (
                <p className="text-center text-gray-500">No predictions available.</p>
              )}
            </div>

            {/* MAKE A PREDICTION */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-[#0052FF] mb-4 flex items-center gap-2">
                <EditIcon className="w-6 h-6" />
                Make a Prediction
              </h2>
              <PredictionForm />
            </div>
          </section>

          {/* Leaderboard Section (inline) */}
          <section className="bg-white rounded-lg shadow p-6 mb-8">
            <Leaderboard />
          </section>

          {/* CTA or Additional Content */}
          <section className="bg-white rounded-lg shadow p-6 text-center">
            <h3 className="text-2xl font-bold text-[#0052FF] mb-4">Join the Competition</h3>
            <p className="text-gray-600 mb-6">
              Think you have what it takes? Start making calls and climb the leaderboard!
            </p>
            <Link href="/analysts/submit" className="inline-block">
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="bg-[#0052FF] text-white font-bold px-6 py-2 rounded-lg text-lg shadow-md hover:bg-blue-700 transition"
              >
                Start Predicting
              </motion.button>
            </Link>
          </section>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}











