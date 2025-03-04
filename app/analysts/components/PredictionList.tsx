"use client";

import { useEffect, useState } from "react";
import { PredictionIcon, VerifiedIcon, TipIcon } from "../../components/icons";
import { motion } from "framer-motion";

export default function PredictionList() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/predictions");
        let data = await response.json();

        // Fetch live prices for each prediction
        data = await Promise.all(
          data.map(async (p: any) => {
            const priceData = await fetchCoinData(p.coinAddress);
            return {
              ...p,
              price: priceData?.[p.coin]?.usd || "N/A",
              priceChange: priceData?.[p.coin]?.usd_24h_change || 0,
            };
          })
        );

        setPredictions(data);
      } catch (error) {
        console.error("Error fetching predictions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  async function handleVote(predictionId, type) {
    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        body: JSON.stringify({ predictionId, voteType: type }),
      });
      const data = await response.json();

      setPredictions((prevPredictions) =>
        prevPredictions.map((p) =>
          p._id === predictionId
            ? { ...p, upvotes: data.prediction.upvotes, downvotes: data.prediction.downvotes }
            : p
        )
      );
    } catch (error) {
      console.error("Error submitting vote:", error);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-center text-gray-500">Loading predictions...</p>
      ) : predictions.length > 0 ? (
        predictions.map((p) => (
          <motion.div
            key={p._id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            className="bg-white p-4 rounded-lg shadow-md transition"
          >
            {/* Prediction Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PredictionIcon className="text-blue-500 w-6 h-6" />
                <h3 className="text-lg font-bold">{p.coin}</h3>
                {p.analyst?.verified && <VerifiedIcon className="text-green-500 w-5 h-5" />}
              </div>

              {/* Tip Button */}
              <button className="text-yellow-500 hover:text-yellow-600">
                <TipIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Prediction Details */}
            <p className="text-sm text-gray-600">
              {p.prediction} – 🎯 Target: {p.targetPrice} in {p.timeframe}
            </p>
            <p className="text-xs text-gray-500">By {p.analyst?.name}</p>

            {/* Live Price Section */}
            <p className="text-sm font-semibold">
              💰 Live Price: ${p.price} ({p.priceChange.toFixed(2)}% 24h)
            </p>

            {/* Voting System */}
            <div className="flex items-center gap-4 mt-3">
              <button onClick={() => handleVote(p._id, "up")} className="text-green-500 flex items-center gap-1">
                <UpvoteIcon className="w-5 h-5" />
                <span>{p.upvotes || 0}</span>
              </button>
              <button onClick={() => handleVote(p._id, "down")} className="text-red-500 flex items-center gap-1">
                <DownvoteIcon className="w-5 h-5" />
                <span>{p.downvotes || 0}</span>
              </button>
            </div>
          </motion.div>
        ))
      ) : (
        <p className="text-center text-gray-500">No predictions available.</p>
      )}
    </div>
  );
}

