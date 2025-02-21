"use client";

import Header from '../components/Header';
import Footer from '../components/Footer';

const launchData = [
  {
    day: "MON",
    date: "17",
    launches: {
      launchingSoon: [{}, {}],
      launched: [{}, {}],
    },
  },
  {
    day: "TUE",
    date: "18",
    launches: {
      // 2 for 'before launch' (Launching Soon)
      launchingSoon: [{}, {}],
      // 3 for 'launched'
      launched: [{}, {}],
    },
  },
  {
    day: "WED",
    date: "19",
    launches: {
      launchingSoon: [{}, {}],
      launched: [{}, {}],
    },
  },
  {
    day: "THU",
    date: "20",
    launches: {
      launchingSoon: [{}, {}],
      launched: [{}, {}],
    },
  },
  {
    day: "FRI",
    date: "21",
    launches: {
      launchingSoon: [{}, {}],
      launched: [{}, {}],
    },
  },
  {
    day: "SAT",
    date: "22",
    launches: {
      launchingSoon: [
        {
          name: "Homebase",
          ticker: "HOME",
          logo: "https://i.imgur.com/7L1Xsfa.png",
        },
        {},
      ],
      launched: [{}, {}],
    },
  },
  {
    day: "SUN",
    date: "23",
    launches: {
      launchingSoon: [{}, {}],
      launched: [{}, {}],
    },
  },
];

export default function LaunchCalendar() {
  const totalLaunches = launchData.reduce((acc, day) => {
    const soonCount = day.launches.launchingSoon.length;
    const launchedCount = day.launches.launched.length;
    return acc + soonCount + launchedCount;
  }, 0);

  // Increased box height to prevent "leaking"
  const boxHeight = "h-80";

  return (
    <div className="min-h-screen bg-white text-black relative pb-24">
      {/* Top Banner */}
      <div className="w-full py-4 bg-primaryBlue text-white text-center shadow-md">
        <h1 className="text-3xl font-extrabold">TOKEN LAUNCH CALENDAR</h1>
        <p className="text-base opacity-80">
          Track upcoming token launches and major listings.
        </p>
        <p className="mt-1 text-xs">
          {launchData.length} days, {totalLaunches} launches scheduled this week.
        </p>
      </div>

      {/* Outer Container */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white p-8 rounded-lg shadow-lg overflow-hidden border border-gray-200">
          {/* Launch Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {launchData.map((day, index) => (
              <div
                key={index}
                className={`bg-white p-3 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-all ${boxHeight} flex flex-col`}
              >
                {/* Day & Date */}
                <div>
                  <h2 className="text-xl font-bold text-primaryBlue text-center">
                    {day.day}
                  </h2>
                  <p className="text-gray-600 text-center">{day.date}</p>
                </div>

                {/* Content Container */}
                <div className="flex-grow mt-2 flex flex-col justify-evenly space-y-2">
                  {/* Launching Soon */}
                  <div className="bg-orange-200 p-2 rounded-md">
                    <h3 className="text-xs font-semibold text-gray-700 text-center mb-1">
                      Launching Soon
                    </h3>
                    <div className="grid grid-cols-2 gap-1">
                      {day.launches.launchingSoon.map((launch, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center bg-white p-1 rounded-md shadow-sm hover:bg-gray-100 transition-all h-16 justify-center"
                        >
                          {launch.logo && (
                            <img
                              src={launch.logo}
                              alt={launch.name || ""}
                              className="w-8 h-8"
                            />
                          )}
                          {launch.name && (
                            <p className="text-[10px] font-semibold">
                              {launch.name}
                            </p>
                          )}
                          {launch.ticker && (
                            <p className="text-[9px] text-gray-500">
                              {launch.ticker}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Launched */}
                  <div className="bg-blue-200 p-2 rounded-md">
                    <h3 className="text-xs font-semibold text-gray-700 text-center mb-1">
                      Launched
                    </h3>
                    <div className="grid grid-cols-2 gap-1">
                      {day.launches.launched.map((launch, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center bg-white p-1 rounded-md shadow-sm hover:bg-gray-100 transition-all h-16 justify-center"
                        >
                          {launch.logo && (
                            <img
                              src={launch.logo}
                              alt={launch.name || ""}
                              className="w-8 h-8"
                            />
                          )}
                          {launch.name && (
                            <p className="text-[10px] font-semibold">
                              {launch.name}
                            </p>
                          )}
                          {launch.ticker && (
                            <p className="text-[9px] text-gray-500">
                              {launch.ticker}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Newsletter Banner */}
      <div className="fixed bottom-0 left-0 right-0 bg-primaryBlue py-8 px-8">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            Don't Miss a Launch!
          </h2>
          <p className="text-white text-base mb-4">
            Subscribe now to get notifications for upcoming token launches.
          </p>
          <div className="flex justify-center">
            <input
              type="email"
              placeholder="Enter your email"
              className="px-4 py-3 rounded-l-md focus:outline-none text-black"
            />
            <button className="px-4 py-3 bg-black text-white rounded-r-md hover:bg-gray-800 transition">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}














