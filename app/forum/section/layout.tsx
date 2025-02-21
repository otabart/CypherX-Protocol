'use client';

import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  const { section } = useParams(); // Get section name from URL

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Header />
      <div className="flex flex-grow container mx-auto py-6 px-4">
        {/* Sidebar */}
        <aside className="hidden md:block w-1/4">
          <Sidebar />
        </aside>

        {/* Main Content */}
        <section className="w-full md:w-3/4 bg-white p-6 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">📢 {section} Discussions</h1>
          {children}
        </section>
      </div>
    </div>
  );
}
