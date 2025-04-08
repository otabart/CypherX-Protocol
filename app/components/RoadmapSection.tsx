"use client";

import React, { useState, useRef, cloneElement } from "react";
import { motion, useInView } from "framer-motion";
import dynamic from "next/dynamic";

// ===== Dynamic Imports for React Icons =====
const FaFlask = dynamic(() => import("react-icons/fa").then((mod) => mod.FaFlask), { ssr: false });
const FaChartLine = dynamic(() => import("react-icons/fa").then((mod) => mod.FaChartLine), { ssr: false });
const FaUsers = dynamic(() => import("react-icons/fa").then((mod) => mod.FaUsers), { ssr: false });
const FaLaptopCode = dynamic(() => import("react-icons/fa").then((mod) => mod.FaLaptopCode), { ssr: false });
const BsRocketTakeoff = dynamic(() => import("react-icons/bs").then((mod) => mod.BsRocketTakeoff), { ssr: false });
const TbBrain = dynamic(() => import("react-icons/tb").then((mod) => mod.TbBrain), { ssr: false });

// ===== Tri-Color ETH Icon (unchanged, 32×32) =====
function EthIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 256 417"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <path fill="#999" d="M127.6 0L124.9 10.5V281.3L127.6 284.9L255.2 210.8z" />
      <path fill="#666" d="M127.6 0L0 210.8L127.6 284.9V152.1z" />
      <path fill="#444" d="M127.6 312.6L125.8 314.9V414.1L127.6 416.9L255.3 243.4z" />
      <path fill="#333" d="M127.6 416.9V312.6L0 243.4z" />
      <path fill="#222" d="M127.6 284.9L255.2 210.8L127.6 152.1z" />
      <path fill="#111" d="M0 210.8L127.6 284.9L127.6 152.1z" />
    </svg>
  );
}

// ===== Type Definitions =====
type Milestone = {
  date: string;
  title: string;
  description: string;
  icon: JSX.Element;
};

// ===== Roadmap Data =====
const roadmapData: Milestone[] = [
  {
    date: "Apr 06, 2025",
    title: "v1 Launch Beta Testing",
    description:
      "Our beta phase invites early adopters to experience and test our core functionalities, providing valuable feedback to refine the platform. During beta testing, you'll help us identify bugs, optimize performance, and shape a user-friendly experience. Join us in building a robust and innovative ecosystem on the Base chain!",
    icon: <FaFlask />,
  },
  {
    date: "Apr 20, 2025",
    title: "$HOME Launch",
    description:
      "Introducing our native token launching on clank.fun. Holding will grant you access to exclusive benefits such as premium trading tools, free entry to some community tournaments, and more! $HOME will collect a 0.4% LP fee from every transaction traded, which is then redistributed back into the community.",
    icon: <BsRocketTakeoff />,
  },
  {
    date: "Apr 26, 2025",
    title: "Coin of the Week Spaces",
    description:
      "Coin of the Week Spaces is a weekly Sunday event where the community puts their market insights to the test. Every Sunday, participants vote on which coin they believe will perform the best in the coming week. Those who correctly predict the top performer win an ETH prize.",
    icon: <EthIcon />,
  },
  {
    date: "Apr 31, 2025",
    title: "Trade Wars Week 1",
    description:
      "kicks off our weekly trading competition. Whether you’re an experienced trader or just getting started, join the fray to strategize, compete, and earn rewards while learning from real market moves. Step into the arena and let the trade wars begin.",
    icon: <FaChartLine />,
  },
  {
    date: "May 05, 2025",
    title: "Community Kick-Off",
    description:
      "Driven by community input and beta refinements, our V2 Launch showcases a major platform evolution. Experience sharper trading utilities, smarter analytics, and an intuitive interface backed by robust security. Embrace this leap forward in decentralization as we empower users for tomorrow’s challenges.",
    icon: <FaUsers />,
  },
  {
    date: "June 1, 2025",
    title: "v2 Official Launch",
    description:
      "v2 Launch marks the next evolution of Homebase—a complete platform upgrade driven by community feedback and rigorous beta testing. This major milestone introduces a suite of enhanced features, including improved trading tools, advanced analytics, and a more intuitive user experience.",
    icon: <BsRocketTakeoff />,
  },
  {
    date: "June 10, 2025",
    title: "Hackathon & Q&A",
    description:
      "Join our hackathon to build groundbreaking integrations for the Homebase ecosystem. From seasoned coders to new builders, everyone can experiment, learn, and push boundaries. Unlock mentorship, vie for rewards, and shape the next wave of DeFi solutions in a collaborative, vibrant environment.",
    icon: <FaLaptopCode />,
  },
  {
    date: "TBD",
    title: "Base Intelligence",
    description:
      "Building a new phase of on-chain analytics, with AI Smart Analytics.",
    icon: <TbBrain />,
  },
];

// ===== Animation Variants =====
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 120, damping: 15 },
  },
};

type TimelineCardProps = {
  milestone: Milestone;
  index: number;
  isLeft: boolean;
  isSelected: boolean;
  onClick: () => void;
  isPast: boolean;
};

export default function RoadmapSection() {
  const [selected, setSelected] = useState<number | null>(null);
  const currentDate = new Date("2025-04-05"); // Current date as per system instructions

  return (
    <section id="roadmap" className="relative bg-white py-16 overflow-hidden">
      {/* Top Wave Background – Enhanced Gradient */}
      <div className="absolute top-0 left-0 right-0 -z-10">
        <svg
          className="w-full h-48 md:h-64"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <path
            fill="url(#wave-gradient-top)"
            d="M0,160 C360,80 1080,240 1440,160 L1440,0 L0,0 Z"
          />
          <defs>
            <linearGradient id="wave-gradient-top" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "#E5E7EB", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "#D1D5DB", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Heading */}
        <h2 className="text-center text-4xl font-extrabold mb-12 text-[#0052FF]">
          2025 Roadmap
        </h2>

        {/* Timeline Container */}
        <div className="relative mt-8">
          {/* Vertical Center Line (desktop only) – Reverted to Black */}
          <div className="hidden md:block absolute top-0 left-1/2 h-full w-1 bg-black transform -translate-x-1/2"></div>

          <div className="space-y-6">
            {roadmapData.map((milestone, index) => {
              const isLeft = index % 2 === 0;
              const isSelected = selected === index;
              const milestoneDate = milestone.date === "TBD" ? new Date("9999-12-31") : new Date(milestone.date);
              const isPast = milestoneDate < currentDate;
              return (
                <div
                  key={index}
                  className="w-full flex items-center justify-center relative"
                >
                  {/* Timeline Marker (desktop only) */}
                  <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-[#0052FF] rounded-full border-2 border-white"></div>

                  {isLeft && (
                    <div className="hidden md:flex items-center justify-end w-1/2 pr-4">
                      <div className="h-0.5 w-8 bg-black" />
                    </div>
                  )}
                  <TimelineCard
                    milestone={milestone}
                    index={index}
                    isLeft={isLeft}
                    isSelected={isSelected}
                    onClick={() => setSelected(index)}
                    isPast={isPast}
                  />
                  {!isLeft && (
                    <div className="hidden md:flex items-center justify-start w-1/2 pl-4">
                      <div className="h-0.5 w-8 bg-black" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Wave Background – Enhanced Gradient */}
      <div className="absolute bottom-0 left-0 right-0 -z-10">
        <svg
          className="w-full h-32 md:h-48"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <path
            fill="url(#wave-gradient-bottom)"
            d="M0,64 C360,160 1080,0 1440,64 L1440,320 L0,320 Z"
          />
          <defs>
            <linearGradient id="wave-gradient-bottom" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "#D1D5DB", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "#E5E7EB", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </section>
  );
}

// ===== Card Component =====
function TimelineCard({
  milestone,
  index,
  isLeft,
  isSelected,
  onClick,
  isPast,
}: TimelineCardProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const [isExpanded, setIsExpanded] = useState(false);

  // Enlarge non-ETH icons to 36px
  const iconToRender =
    milestone.title === "Coin of the Week Spaces"
      ? milestone.icon
      : React.isValidElement(milestone.icon)
      ? cloneElement(milestone.icon, { size: 36 })
      : milestone.icon;

  return (
    <motion.div
      ref={ref}
      className="relative w-80 mb-10 cursor-pointer select-none"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick();
          e.preventDefault();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Select milestone: ${milestone.title}`}
      animate={inView ? "visible" : "hidden"}
      variants={cardVariants}
      whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
    >
      <div
        className={`p-6 rounded-md border ${
          isSelected ? "border-[#0052FF] bg-gradient-to-br from-[#0052FF]/10 to-white" : "border-black"
        } bg-white text-black shadow-md focus:outline-none focus:ring-2 focus:ring-[#0052FF] focus:ring-offset-2`}
      >
        <motion.button
          whileHover={{ rotate: 360, transition: { duration: 0.4 } }}
          className={`w-16 h-16 mb-4 rounded-full border-2 flex items-center justify-center mx-auto ${
            isSelected ? "border-[#0052FF]" : "border-black"
          } ${isPast ? "bg-green-100" : ""}`}
          aria-label={`Icon for ${milestone.title}`}
        >
          {iconToRender}
        </motion.button>
        <h3 className="text-xl font-bold mb-2 text-[#0052FF]">
          {milestone.title}
        </h3>
        <div className="mb-4">
          <p
            className={`text-sm transition-all duration-300 ${
              isExpanded ? "block" : "line-clamp-3"
            }`}
          >
            {milestone.description}
          </p>
          {milestone.description.length > 100 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="text-[#0052FF] text-xs hover:underline focus:outline-none focus:ring-2 focus:ring-[#0052FF] focus:ring-offset-1 mt-2"
              aria-label={isExpanded ? "Collapse description" : "Expand description"}
            >
              {isExpanded ? "Show Less" : "Show More"}
            </button>
          )}
        </div>
        <span className={`text-xs ${isPast ? "text-green-600" : "text-gray-700"} block`}>
          {milestone.date}
        </span>
      </div>
    </motion.div>
  );
}





