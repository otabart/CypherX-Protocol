"use client";

import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  CoinIcon,
  LightningIcon,
  ChartIcon,
  SentimentIcon,
  InsightIcon,
  ToolIcon,
  GearIcon,
  GroupIcon,
  RocketIcon,
} from "./icons";
import {
  CloudIcon,
  CloudLightningIcon,
  CloudUploadIcon,
  CoinsIcon,
  CpuIcon,
  FileIcon,
  FilesIcon,
  HashIcon,
  LinkIcon,
  LogsIcon,
  Rocket,
} from "lucide-react";

// Replace these icon imports with your own, as needed
// import { GenIcon, IconBase } from "react-icons/lib";

type Milestone = {
  date: string;
  title: string;
  description: string;
  icon: JSX.Element;
};

const roadmapData: Milestone[] = [
  {
    date: "Apr 06, 2025",
    title: "v1 Launch Beta Testing",
    description:
      "Our beta phase invites early adopters to experience and test our core functionalities, providing valuable feedback to refine the platform. During beta testing, you'll help us identify bugs, optimize performance, and shape a user-friendly experience. Join us in building a robust and innovative ecosystem on the Base chain!",
    icon: <FilesIcon />,
  },
  {
    date: "Apr 20, 2025",
    title: "$HOME Launch",
    description:
      "Introducing our $HOME native token launching on clank.fun. Holding grants you access to exclusive benefits such as premium trading tools, free entry to community tournaments, and locked features designed to enhance your trading experience. Additionally, $HOME collects a 0.4% LP fee from every transaction traded, which is then redistributed back into the community.",
    icon: <Rocket />,
  },
  {
    date: "Apr 26, 2025",
    title: "Coin of the Week Spaces",
    description:
      "Coin of the Week Spaces is a weekly Sunday event where the community puts their market insights to the test. Every Sunday, participants vote on which coin they believe will perform the best in the coming week. Those who correctly predict the top performer win an ETH prize.",
    icon: <CoinIcon />,
  },
  {
    date: "Apr 31, 2025",
    title: "Trade Wars Week 1",
    description:
      "kicks off our weekly trading competition. Whether you’re an experienced trader or just getting started, join the fray to strategize, compete, and earn rewards while learning from real market moves. Step into the arena and let the trade wars begin",
    icon: <ChartIcon />,
  },
  {
    date: "May 05, 2025",
    title: "Community Kick-Off",
    description:
      "Community Kickoff is our inaugural AMA-style event designed to bring everyone together. In this open forum, you'll have the opportunity to ask questions, share your ideas, and brainstorm new tools with our team and fellow community members. This is your chance to influence the future of Homebase—help us shape our roadmap, refine our offerings, and build a more innovative ecosystem together. Join us as we kick off our community journey and spark meaningful conversations that drive real change.",
    icon: <GroupIcon />,
  },
  {
    date: "June 1, 2025",
    title: "v2 Official Launch",
    description:
      "v2 Launch marks the next evolution of Homebase—a complete platform upgrade driven by community feedback and rigorous beta testing. This major milestone introduces a suite of enhanced features, including improved trading tools, advanced analytics, and a more intuitive user experience. With scalable performance and robust security protocols, v2 sets the stage for a truly decentralized ecosystem. Join us as we usher in a new era of innovation, empowering users with premium functionalities and a platform built for tomorrow's challenges.",
    icon: <FilesIcon />,
  },
  {
    date: "June 10, 2025",
    title: "Hackathon & Q&A",
    description:
      "invites developers, designers, and crypto enthusiasts to build new tools and integrations for the Homebase ecosystem. Whether you’re a seasoned coder or just starting out, you'll have the opportunity to collaborate, experiment, and showcase your creativity. With competitive prizes, mentorship opportunities, and a collaborative environment, the hackathon is your chance to turn innovative ideas into reality and help shape the future of decentralized finance.",
    icon: <InsightIcon />,
  },
  {
    date: "TBD",
    title: "Base Intelligence",
    description:
      "Building a new phase of on-chain analytics, with AI Smart Analytics.",
    icon: <CloudUploadIcon />,
  },
];

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
};

function TimelineCard({
  milestone,
  index,
  isLeft,
  isSelected,
  onClick,
}: TimelineCardProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: "-20%" });

  return (
    <motion.div
      ref={ref}
      className="relative w-80 mb-10 cursor-pointer select-none"
      onClick={onClick}
      animate={inView ? "visible" : "hidden"}
      variants={cardVariants}
      whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
    >
      <div
        className={`p-6 rounded-md border ${
          isSelected ? "border-[#0052FF]" : "border-black"
        } bg-white text-black shadow-md`}
      >
        <motion.button
          whileHover={{ rotate: 360, transition: { duration: 0.4 } }}
          className={`w-16 h-16 mb-4 rounded-full border-2 flex items-center justify-center mx-auto ${
            isSelected ? "border-[#0052FF]" : "border-black"
          }`}
        >
          {milestone.icon}
        </motion.button>
        <h3 className="text-xl font-bold mb-2 text-[#0052FF]">
          {milestone.title}
        </h3>
        <p className="text-sm mb-2">{milestone.description}</p>
        <span className="text-xs text-gray-600">{milestone.date}</span>
      </div>
    </motion.div>
  );
}

export default function RoadmapSection() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section className="relative bg-white py-16 overflow-hidden">
      {/* Top Wave Background – Soft Grey Wave */}
      <div className="absolute top-0 left-0 right-0 -z-10">
        <svg
          className="w-full h-48 md:h-64"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <path fill="#E5E7EB" d="M0,160 C360,80 1080,240 1440,160 L1440,0 L0,0 Z"></path>
        </svg>
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Heading */}
        <h2 className="text-center text-4xl font-extrabold mb-12 text-[#0052FF]">
          2025 Roadmap
        </h2>

        {/* Timeline Container */}
        <div className="relative mt-8">
          {/* Vertical Center Line (only on PC, not behind heading) */}
          <div className="hidden md:block absolute top-0 left-1/2 h-full w-1 bg-black transform -translate-x-1/2"></div>

          <div className="space-y-6">
            {roadmapData.map((milestone, index) => {
              const isLeft = index % 2 === 0;
              const isSelected = selected === index;
              return (
                <div key={index} className="w-full flex items-center justify-center">
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

      {/* Bottom Wave Background – Soft Grey Wave */}
      <div className="absolute bottom-0 left-0 right-0 -z-10">
        <svg
          className="w-full h-32 md:h-48"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <path fill="#E5E7EB" d="M0,64 C360,160 1080,0 1440,64 L1440,320 L0,320 Z"></path>
        </svg>
      </div>
    </section>
  );
}
