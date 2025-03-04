'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ProfilePage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const userRes = await fetch(`/api/user/${id}`);
      const userData = await userRes.json();
      
      const predictionsRes = await fetch(`/api/predictions?userId=${id}`);
      const predictionsData = await predictionsRes.json();

      setUser(userData);
      setPredictions(predictionsData);
    }

    fetchData();
  }, [id]);

  return (
    <div className="container mx-auto px-4 py-8">
      {user ? (
        <>
          <h1 className="text-4xl font-bold">{user.name}'s Profile</h1>
          <p>Predictions Made: {predictions.length}</p>
          
          <h2 className="text-2xl font-bold mt-6">Recent Predictions</h2>
          <ul>
            {predictions.map((p) => (
              <li key={p._id} className="p-4 bg-gray-800 text-white rounded-lg">
                {p.coin} - {p.prediction} - Target: {p.targetPrice}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Loading profile...</p>
      )}
    </div>
  );
}
