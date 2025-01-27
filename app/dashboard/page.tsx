'use client';

import Header from '../components/Header';
import Footer from '../components/Footer';
import UserProfile from './components/UserProfile';
import AnalyticsOverview from './components/AnalyticsOverview';
import Favorites from './components/Favorites';

export default function Dashboard() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <Header />

      <main className="flex-grow container mx-auto py-12 px-4">
        <h1 className="text-4xl font-extrabold text-primaryBlue text-center mb-8">
          User Dashboard
        </h1>

        {/* Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* User Profile */}
          <div className="col-span-1">
            <UserProfile />
          </div>

          {/* Analytics Overview */}
          <div className="col-span-2">
            <AnalyticsOverview />
          </div>
        </div>

        {/* Favorites Section */}
        <div className="mt-12">
          <Favorites />
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
