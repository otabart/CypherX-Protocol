'use client';

export default function Favorites() {
  const favorites = [
    { id: 1, title: 'Coin Discussion: Latest Trends' },
    { id: 2, title: 'Top 5 DApps to Watch' },
    { id: 3, title: 'New Launch: Upcoming Projects' },
  ];

  return (
    <div className="p-6 border rounded-lg shadow-md bg-gray-50">
      <h2 className="text-2xl font-bold text-primaryBlue mb-4">Your Favorites</h2>
      <ul className="space-y-2">
        {favorites.map((favorite) => (
          <li key={favorite.id} className="p-4 border rounded-md bg-white shadow-sm">
            <p className="text-lg font-semibold">{favorite.title}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
