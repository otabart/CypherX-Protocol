"use client";

import { useEffect, useState } from "react";
import { TrophyIcon } from "../../../components/icons";

export default function Leaderboard() {
  const [analysts, setAnalysts] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/analysts");
        const data = await response.json();
        setAnalysts(data);
      } catch (error) {
        console.error("Error loading analysts:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold text-[#0052FF] mb-4 flex items-center gap-2">
        <TrophyIcon className="w-6 h-6" />
        Top Analysts
      </h2>

      {analysts.length === 0 ? (
        <p className="text-gray-500">No analysts found.</p>
      ) : (
        <ul className="space-y-3">
          {analysts.map((analyst: any, index: number) => (
            <li
              key={analyst.id}
              className="flex justify-between items-center bg-gray-50 p-3 rounded"
            >
              <span className="font-medium">
                {index + 1}. {analyst.name}
              </span>
              <span className="text-gray-600">{analyst.winRate}% Win Rate</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
