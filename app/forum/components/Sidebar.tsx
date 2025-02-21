'use client';

import { useRouter } from 'next/navigation';

export default function Sidebar({ setActiveCategory }: { setActiveCategory: (category: string) => void }) {
  const categories = ['General', 'Coins', 'Launch Updates', 'Community'];
  const router = useRouter();

  return (
    <div className="w-full md:w-64 bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-bold mb-4">📌 Sections</h3>
      <ul className="space-y-2">
        {categories.map((category) => (
          <li key={category}>
            <button
              onClick={() => router.push(`/forum/section/${category}`)}
              className="w-full text-left px-4 py-2 rounded-md hover:bg-gray-200 transition-all"
            >
              {category}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}



