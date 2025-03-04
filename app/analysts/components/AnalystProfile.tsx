"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { VerifiedIcon, TipIcon } from "../components/icons";

export default function AnalystProfile() {
  const { id } = useParams();
  const [analyst, setAnalyst] = useState(null);
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const analystRes = await fetch(`/api/analysts/${id}`);
      const analystData = await analystRes.json();
      setAnalyst(analystData);

      const predictionsRes = await fetch(`/api/predictions?analyst=${id}`);
      const predictionsData = await predictionsRes.json();
      setPredictions(predictionsData);
    }

    fetchData();
  }, [id]);

  if (!analyst) return <p>Loading...</p>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center gap-4">
        <img src={analyst.avatar} alt={analyst.name} className="w-16 h-16 rounded-full" />
        <div>
          <h2 className="text-xl font-bold">{analyst.name} {analyst.verified && <VerifiedIcon className="text-green-500" />}</h2>
          <p className="text-sm text-gray-600">{analyst.bio}</p>
        </div>
        <button className="ml-auto text-yellow-500 hover:text-yellow-600">
          <TipIcon className="w-6 h-6" />
        </button>
      </div>

      <h3 className="mt-6 text-lg font-bold text-blue-500">Past Predictions</h3>
      <ul className="mt-3 space-y-3">
        {predictions.map((p) => (
          <li key={p._id} className="p-3 bg-gray-50 rounded">
            {p.coin} - {p.prediction} (Target: {p.targetPrice}, {p.timeframe})
          </li>
        ))}
      </ul>
    </div>
  );
}
