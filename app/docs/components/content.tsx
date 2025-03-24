"use client";

import {
  Lightbulb,
  FileText,
  Clipboard,
  Calendar,
  PieChart,
  Activity,
  AlertTriangle,
  PlayCircle,
  TrendingUp,
  Code,
  Book,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface ContentProps {
  activeSection: string;
}

interface SectionData {
  title: string;
  lastUpdated: string;
  breadcrumb: string[];
  content: string;
  callout: string;
}

const contentData: Record<string, SectionData> = {
  products: {
    title: "Products Overview",
    lastUpdated: "February 15, 2025",
    breadcrumb: ["Home", "Docs", "Products"],
    content: `
Homebase offers a powerful suite of tools designed for the Base chain ecosystem:
• Analytics Dashboard – Real-time data and insights.
• Trading Tools – Featuring Whale Watchers, Token Scanner, Honeypot Checker, and Enhanced Terminal Commands.
• Trading Competitions – Live challenges with rewards.
• Launch Calendar – Stay updated on upcoming token launches and key events.
    `,
    callout:
      "We continuously evolve our tools based on user feedback. Your insights help shape the future of Homebase!",
  },
  analytics: {
    title: "Trading Tools",
    lastUpdated: "February 15, 2025",
    breadcrumb: ["Home", "Docs", "Products", "Trading Tools"],
    content: `
Trading Tools

Homebase’s Trading Tools empower you to trade smarter and faster:

Whale Watchers Tool
Monitor significant wallet transactions and liquidity shifts on the Base chain.

Token Scanner
Analyze tokens with key metrics such as liquidity, volume, and contract safety.

Honeypot Checker
Scan smart contracts to detect potential scams and secure your trades.

Enhanced Terminal Commands
Access features instantly with our streamlined commands.

Trading Competitions
Join live trading challenges to test your skills and earn rewards.
    `,
    callout:
      "Tip: Use our Enhanced Terminal Commands to jump straight into any tool with a single command.",
  },
  insights: {
    title: "Market Insights",
    lastUpdated: "February 15, 2025",
    breadcrumb: ["Home", "Docs", "Products", "Market Insights"],
    content: `
Market Insights

Stay ahead in crypto with real-time updates and event tracking:

News Terminal
Receive curated news and market updates from top sources.

Launch Calendar
Keep track of upcoming token launches, protocol upgrades, and other key events.
    `,
    callout:
      "Note: Our News Terminal delivers only the most relevant updates, powered by intelligent curation.",
  },
  launch: {
    title: "Launch Information",
    lastUpdated: "February 15, 2025",
    breadcrumb: ["Home", "Docs", "Launch"],
    content: `
Homebase is scheduled to launch in early March, debuting on Clank.Fun—the premier launchpad on Base. This strategic launch maximizes liquidity, taps into a highly engaged community, and sets the stage for future growth.

Highlights:
• Fair token launch with no insider allocations.
• Robust community engagement from day one.
• A dynamic post-launch roadmap full of new utilities.
    `,
    callout:
      "Early adopters may receive exclusive perks. Stay tuned for airdrop and bonus announcements!",
  },
  "past-news": {
    title: "Past News & Updates",
    lastUpdated: "February 15, 2025",
    breadcrumb: ["Home", "Docs", "Past News"],
    content: `
Homebase Company News & Updates

Recent Enhancements:
• Expanded Trading Tools – Introducing Whale Watchers, Token Scanner, Honeypot Checker, and Enhanced Terminal Commands.
• New Trading Competitions – Engage in live challenges and earn rewards.
• Market Insights Upgrade – Launch Calendar and News Terminal improvements.

Token Launch:
• Homebase token debut on Clank.Fun.
    `,
    callout:
      "Follow our social channels for monthly retrospectives on milestones and upcoming innovations.",
  },
  "company-updates": {
    title: "Company Updates",
    lastUpdated: "February 15, 2025",
    breadcrumb: ["Home", "Docs", "Company Updates"],
    content: `
Stay informed with the latest updates from Homebase. We share roadmap adjustments, team expansions, funding news, and feature launches—including Trading Competitions and Enhanced Terminal Commands.
    `,
    callout:
      "Your feedback drives our innovation. Let us know what you'd like to see next!",
  },
  "getting-started": {
    title: "Getting Started",
    lastUpdated: "February 15, 2025",
    breadcrumb: ["Home", "Docs", "Getting Started"],
    content: `
Getting Started with Homebase

1.) Create an Account:
   • Click the “Sign-in” button.
   • Choose a username.
   • Access our full suite of tools.

2.) Explore the Tool Library:
   - Whale Watchers – Track major wallet movements.
   - Token Scanner – Evaluate tokens with comprehensive metrics.
   - Honeypot Checker – Verify contract safety.
   - Trading Competitions – Participate in live challenges.
   - Enhanced Terminal Commands – Instantly access platform features.

3.) Stay Updated:
   - News Terminal – Get the latest crypto news.
   - Launch Calendar – Never miss upcoming token launches.
   - Market Insights – Access real-time data and reports.

4.) Participate in the Homebase Token Launch:
   • Scheduled for early March on Clank.Fun.
    `,
    callout:
      "Need help? Our support team is ready—reach out via our help center or email support@homebase.com.",
  },
  "api-docs": {
    title: "API Documentation",
    lastUpdated: "February 15, 2025",
    breadcrumb: ["Home", "Docs", "API Documentation"],
    content: `
Developers can integrate real-time Base chain data into their applications using our RESTful API. Access transaction details, wallet info, and market metrics with ease.
    `,
    callout:
      "API keys are currently unavailable; stay tuned for future updates.",
  },
  default: {
    title: "Welcome to Homebase Docs",
    lastUpdated: "N/A",
    breadcrumb: ["Home", "Docs"],
    content: "Select a section from the sidebar to explore our features.",
    callout: "",
  },
};

function crumbToRoute(crumb: string): string {
  if (crumb === "Home") return "/";
  if (crumb === "Docs") return "/docs";
  return `/docs/${crumb.toLowerCase().replace(/\s+/g, "-")}`;
}

function chooseUniqueIcon(para: string, sectionId: string, usedIcons: Set<string>): JSX.Element {
  const lower = para.toLowerCase();
  const mapping: { [keyword: string]: { icon: JSX.Element; name: string } } = {
    "whale watchers": { icon: <Activity className="w-8 h-8 text-[#0052FF]" />, name: "whale" },
    "token scanner": { icon: <Clipboard className="w-8 h-8 text-[#0052FF]" />, name: "scanner" },
    "honeypot checker": { icon: <AlertTriangle className="w-8 h-8 text-[#0052FF]" />, name: "honeypot" },
    "news terminal": { icon: <FileText className="w-8 h-8 text-[#0052FF]" />, name: "news" },
    "launch calendar": { icon: <Calendar className="w-8 h-8 text-[#0052FF]" />, name: "calendar" },
    "trading competitions": { icon: <TrendingUp className="w-8 h-8 text-[#0052FF]" />, name: "competitions" },
    "enhanced terminal commands": { icon: <Code className="w-8 h-8 text-[#0052FF]" />, name: "commands" },
  };

  for (const keyword in mapping) {
    if (lower.includes(keyword) && !usedIcons.has(mapping[keyword].name)) {
      usedIcons.add(mapping[keyword].name);
      return mapping[keyword].icon;
    }
  }

  const fallbackMapping: { [name: string]: JSX.Element } = {
    trending: <TrendingUp className="w-8 h-8 text-[#0052FF]" />,
    code: <Code className="w-8 h-8 text-[#0052FF]" />,
    book: <Book className="w-8 h-8 text-[#0052FF]" />,
  };

  for (const name in fallbackMapping) {
    if (!usedIcons.has(name)) {
      usedIcons.add(name);
      return fallbackMapping[name];
    }
  }

  return <Book className="w-8 h-8 text-[#0052FF]" />;
}

function getCTA(para: string): JSX.Element | null {
  const lower = para.toLowerCase();
  if (lower.includes("connect your wallet")) {
    return (
      <Link href="/connect">
        <span className="mt-2 inline-flex items-center text-white hover:underline">
          Connect Wallet <ArrowRight className="ml-1 w-4 h-4" />
        </span>
      </Link>
    );
  }
  if (lower.includes("token launch")) {
    return (
      <Link href="/launch">
        <span className="mt-2 inline-flex items-center text-white hover:underline">
          Learn More <ArrowRight className="ml-1 w-4 h-4" />
        </span>
      </Link>
    );
  }
  return null;
}

export default function Content({ activeSection }: ContentProps) {
  const section = contentData[activeSection] || contentData.default;

  const breadcrumbElements = section.breadcrumb.map((crumb, idx) => {
    const isLast = idx === section.breadcrumb.length - 1;
    const route = crumbToRoute(crumb);
    return (
      <div key={crumb} className="flex items-center space-x-1">
        {isLast ? (
          <span className="text-xs text-gray-300">{crumb}</span>
        ) : (
          <a
            href={route}
            className="text-xs text-blue-400 hover:underline truncate"
            title={crumb}
          >
            {crumb}
          </a>
        )}
        {!isLast && <span className="text-xs">/</span>}
      </div>
    );
  });

  const paragraphs = section.content.split("\n\n").filter((p) => p.trim().length > 0);
  const usedIcons = new Set<string>();

  return (
    <div className="flex-grow p-4 md:p-6 bg-black">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-y-2 mb-2">
        <div className="flex flex-wrap gap-x-2 items-center text-gray-400">
          {breadcrumbElements}
        </div>
        <span className="text-xs text-gray-400">
          Last Updated: {section.lastUpdated}
        </span>
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4">
        {section.title}
      </h2>
      {section.callout && (
        <div className="mb-6">
          <div className="p-4 bg-[#0052FF] border-l-4 border-[#0052FF] rounded-md flex items-start space-x-3">
            <Lightbulb className="text-white mt-1" />
            <p className="text-sm md:text-base text-white">
              {section.callout}
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {paragraphs.map((para, idx) => {
          const icon = chooseUniqueIcon(para, activeSection, usedIcons);
          const cta = getCTA(para);
          return (
            <div
              key={idx}
              className="flex flex-col gap-2 p-4 rounded-md shadow border border-gray-700 bg-black"
            >
              <div className="flex items-start gap-3">
                <div>{icon}</div>
                <p className="mt-1 text-sm md:text-base text-gray-300 whitespace-pre-line flex-1">
                  {para.trim()}
                </p>
              </div>
              {cta && <div>{cta}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}











