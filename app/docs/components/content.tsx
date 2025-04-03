"use client";

import React from "react";
import Link from "next/link";
import { Home } from "lucide-react";

interface ContentProps {
  activeSection: string;
}

const sectionTitles: Record<string, string> = {
  overview: "Overview",
  terminal: "Terminal",
  "whale-watchers": "Whale Watchers",
  screener: "Homebase Screener",
  "honeypot-tracker": "Honeypot Tracker",
  "launch-calendar": "Token Launch Calendar",
  tournaments: "Tournaments",
  "getting-started": "Getting Started",
  "api-docs": "API Documentation",
  "company-updates": "Company Updates",
};

export default function Content({ activeSection }: ContentProps) {
  // Force default to "overview" if empty.
  const currentSection = activeSection || "overview";
  const currentTitle = sectionTitles[currentSection] || "Overview";
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Breadcrumb currentTitle={currentTitle} />
      <div className="flex-grow">
        {currentSection === "terminal" && <TerminalContent />}
        {currentSection === "whale-watchers" && <WhaleWatchersContent />}
        {currentSection === "screener" && <ScreenerContent />}
        {currentSection === "honeypot-tracker" && <HoneypotTrackerContent />}
        {currentSection === "launch-calendar" && <LaunchCalendarContent />}
        {currentSection === "tournaments" && <TournamentsContent />}
        {currentSection === "getting-started" && <GettingStartedContent />}
        {currentSection === "api-docs" && <APIDocsContent />}
        {currentSection === "company-updates" && <CompanyUpdatesContent />}
        {currentSection === "overview" && <OverviewContent />}
      </div>
      <footer className="sticky bottom-0 bg-black py-2 text-left">
        <p className="text-xs text-gray-400">© 2025 Homebase. All rights reserved.</p>
      </footer>
    </div>
  );
}

/* ----------------- Breadcrumb Navigation ----------------- */
function Breadcrumb({ currentTitle }: { currentTitle: string }) {
  return (
    <nav className="px-4 py-2 bg-black">
      {/* Reduced vertical padding for less awkward space */}
      <div className="flex items-center text-sm text-blue-400">
        <Link href="/">
          <Home className="w-4 h-4 mr-1" />
        </Link>
        <span className="mx-1">›</span>
        <Link href="/docs" className="hover:underline">
          Docs
        </Link>
        <span className="mx-1">›</span>
        <span>{currentTitle}</span>
      </div>
    </nav>
  );
}

/* ----------------- Overview ----------------- */
function OverviewContent() {
  return (
    <div className="p-4 bg-black">
      <h1 className="text-4xl font-bold mb-2 text-white">Homebase Docs Overview</h1>
      <hr className="border-t border-gray-700 my-3" />
      <p className="text-base text-gray-300 mb-4">
        Welcome to the Homebase Documentation! Our platform brings all on‑chain data into one unified interface.
        No more hopping between multiple websites – here you can access live data, perform audits, and monitor market trends effortlessly.
      </p>
      <p className="text-base text-gray-300 mb-4">
        Use the navigation bar above to explore sections such as Terminal, Whale Watchers, Homebase Screener, Honeypot Tracker, Token Launch Calendar, Tournaments, Getting Started, API Documentation, and Company Updates.
      </p>
      <p className="text-base text-gray-300">
        For further guidance, please visit our <Link href="/docs/faq" className="text-blue-400 hover:underline">FAQ</Link> page.
      </p>
      <div className="mt-4">
        <Link href="/overview" className="text-blue-400 hover:underline text-base">
          Learn More →
        </Link>
      </div>
    </div>
  );
}

/* ----------------- Terminal Docs ----------------- */
function TerminalContent() {
  return (
    <div className="flex-grow p-4 bg-black">
      <section className="mb-6">
        <h1 className="text-4xl font-bold mb-2 text-white">Terminal</h1>
        <p className="text-base text-gray-300 mb-4">
          The Homebase Terminal is your command center for managing your account, accessing live on‑chain data, performing audits, and more.
          It gathers data from multiple sources into one unified interface.
        </p>
        <p className="text-base text-gray-300 mb-4">
          Below is the full list of commands:
        </p>
        <ul className="list-disc list-inside text-white text-base space-y-2">
          <li><strong>/login &lt;email&gt; &lt;password&gt;</strong> – Log in to your account.</li>
          <li><strong>/signup &lt;email&gt; &lt;password&gt;</strong> – Create a new account.</li>
          <li><strong>/setdisplay &lt;name&gt;</strong> – Set your display name.</li>
          <li><strong>/screener</strong> – Open the Homebase Token Screener.</li>
          <li><strong>/token-stats</strong> – For example, <code>/CLANKER-stats</code> to fetch token stats.</li>
          <li><strong>/scan &lt;token address&gt;</strong> – Audit a smart contract.</li>
          <li><strong>/whale-watcher</strong> – Monitor large trades.</li>
          <li><strong>/tournaments</strong> – Navigate to Competitions.</li>
          <li><strong>/dashboard</strong> – View the Competitions Dashboard.</li>
          <li><strong>/news</strong> – Navigate to Base Chain News.</li>
          <li><strong>/shortcuts</strong> – Display keyboard shortcuts.</li>
          <li><strong>/install news</strong> – Install the News module.</li>
          <li><strong>/install indexes</strong> – Install the AI Index module.</li>
        </ul>
      </section>
      <section className="mt-6">
        <h2 className="text-2xl font-bold text-white mb-2">Install Code Example</h2>
        <div className="bg-gray-800 p-4 rounded-md">
          <pre className="text-sm text-white">
{`// To install the News module:
> /install news

// To install the AI Index module:
> /install indexes

// These commands initialize the installation environment, download required resources,
// fetch metadata, and integrate the module into your terminal.
`}
          </pre>
        </div>
        <div className="mt-4">
          <Link href="/terminal" className="text-blue-400 hover:underline text-base">
            Go to Terminal →
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ----------------- Whale Watchers Docs ----------------- */
function WhaleWatchersContent() {
  return (
    <div className="flex-grow p-4 bg-black">
      <h1 className="text-4xl font-bold mb-4 text-white">Whale Watchers</h1>
      <p className="text-base text-gray-300 mb-4">
         Monitor large trades on the Base chain. Alerts trigger when a buy or sell order exceeds $5,000 or represents at least 0.2% of a token's supply.
      </p>
      <p className="text-base text-gray-300 mb-4">
         Currently, only Homebase‑approved assets are supported. For the latest list, visit <Link href="/supported/assets" className="text-blue-400 hover:underline">/supported/assets</Link>.
      </p>
      <p className="text-base text-gray-300 mb-4">
        For live updates, follow our Twitter at <Link href="https://twitter.com/HomebaseAssets" target="_blank" className="text-blue-400 hover:underline">@HomebaseAssets</Link>.
        Future v2 will include advanced filtering and broader token support.
      </p>
      <div className="mt-4">
        <Link href="/whale-watchers/details" className="text-blue-400 hover:underline text-base">
          Learn More →
        </Link>
      </div>
    </div>
  );
}

/* ----------------- Screener Docs ----------------- */
function ScreenerContent() {
  return (
    <div className="flex-grow p-4 bg-black">
      <section className="mb-10">
        <h1 className="text-4xl font-bold mb-4 text-white">Screener Documentation</h1>
        <p className="text-base text-gray-300 mb-6">
          Our Homebase Screener leverages a state‑of‑the‑art trend‑driven algorithm that aggregates real‑time data from multiple sources.
          It favors tokens with positive price movements, factors in volume trends relative to market cap, and analyzes price changes over various timeframes.
        </p>
        <p className="text-base text-gray-300 mb-6">
          The algorithm computes a trending score by averaging changes over 1H, 6H, and 24H intervals and adjusting based on trading volume as a percentage of market cap.
          This deep analysis provides actionable insights into market momentum.
        </p>
        <div className="bg-gray-800 p-4 rounded-md mb-6">
          <pre className="text-sm text-white">
{`
// Trending score computation:
function computeTrending(token) {
  const avgChange = (token.h1 + token.h6 + token.h24) / 3;
  const ratio = token.volume / token.marketCap;
  return avgChange * ratio * (avgChange > 0 ? 1.1 : 1);
}`}
          </pre>
        </div>
        <p className="text-base text-gray-300">
          Follow our X at <Link href="https://twitter.com/HomebaseAssets" target="_blank" className="text-blue-400 hover:underline">@HomebaseAssets</Link> for token updates.
        </p>
      </section>
    </div>
  );
}

/* ----------------- Honeypot Tracker Docs ----------------- */
function HoneypotTrackerContent() {
  return (
    <div className="flex-grow p-4 bg-black">
      <h1 className="text-4xl font-bold mb-2 text-white">Honeypot Tracker Documentation</h1>
      <h2 className="text-xl text-gray-300 mb-4">Smart Contract Safety Check</h2>
      <p className="text-base text-gray-300 mb-6 max-w-2xl">
        Our Honeypot Tracker scans smart contracts for potential malicious traps.
        Although our analysis is robust, it is not 100% foolproof—always perform your own due diligence before executing trades.
      </p>
      <div className="mt-4">
        <Link href="/honeypot-scanner" className="text-blue-400 hover:underline text-base">
          Audit Smart Contract →
        </Link>
      </div>
    </div>
  );
}

/* ----------------- Launch Calendar Docs ----------------- */
function LaunchCalendarContent() {
  return (
    <div className="flex-grow p-4 bg-black">
      <h1 className="text-4xl font-bold mb-4 text-white">Token Launch Calendar Documentation</h1>
      <hr className="border-t border-gray-700 my-3" />
      <p className="mt-4 text-base text-gray-300">
        Stay informed about upcoming token launches on the Base chain. View launch dates and detailed event information quickly.
      </p>
      <p className="mt-4 text-base text-gray-300">
        To submit a token for launch, email <strong>homebasemarkets@gmail.com</strong> with the token’s Symbol, Logo URL, Address, and other details.
      </p>
      <p className="mt-4 text-base text-gray-300">
        Click any launch entry to view additional data on hype and sentiment.
      </p>
      <div className="mt-4">
        <Link href="/launch-calendar/details" className="text-blue-400 hover:underline text-base">
          View Calendar →
        </Link>
      </div>
    </div>
  );
}

/* ----------------- Tournaments Docs ----------------- */
function TournamentsContent() {
  return (
    <div className="flex-grow p-4 bg-black">
      <h1 className="text-4xl font-bold mb-4 text-white">Tournaments Documentation</h1>
      <p className="text-base text-gray-300 mb-4">
        Homebase Tournaments provide a competitive platform for traders.
        Participate in events that are either community‑funded or Homebase‑sponsored.
        Tournaments include entry fees, wallet tracking, live leaderboards, and detailed performance analytics.
      </p>
      <ul className="list-disc list-inside text-gray-300 text-base space-y-2 mb-4">
        <li><strong>Competition Styles:</strong> Choose between community‑funded tournaments or Homebase‑sponsored events.</li>
        <li><strong>Entry Fees:</strong> Fees vary by event and contribute to the prize pool.</li>
        <li><strong>Wallet Tracking:</strong> Monitor your performance and that of other participants in real time.</li>
        <li><strong>Leaderboards:</strong> Stay updated with live rankings and detailed analytics.</li>
        <li><strong>Admin Setup:</strong> Configure and launch tournaments via our admin panel.</li>
      </ul>
      <div className="mt-4">
        <Link href="/tournaments/details" className="text-blue-400 hover:underline text-base">
          Learn More →
        </Link>
      </div>
    </div>
  );
}

/* ----------------- Getting Started Docs ----------------- */
function GettingStartedContent() {
  return (
    <div className="flex-grow p-4 bg-black">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-white">Getting Started with Homebase</h1>
        <hr className="border-t border-gray-700 my-3" />
        <div className="flex flex-col space-y-3">
          <p className="text-base text-gray-300">
            Begin by creating an account with <code className="bg-gray-800 px-1 py-0.5 rounded">/signup &lt;email&gt; &lt;password&gt;</code>.
          </p>
          <p className="text-base text-gray-300">
            Log in using <code className="bg-gray-800 px-1 py-0.5 rounded">/login &lt;email&gt; &lt;password&gt;</code> and set your display name with <code className="bg-gray-800 px-1 py-0.5 rounded">/setdisplay &lt;new name&gt;</code>.
          </p>
          <p className="text-base text-gray-300">
            Type <code className="bg-gray-800 px-1 py-0.5 rounded">/menu</code> to view the full list of available commands.
          </p>
          <p className="text-base text-gray-300">
            Example: To install our News module, type <code className="bg-gray-800 px-1 py-0.5 rounded">/install news</code>; to install the AI Index module, type <code className="bg-gray-800 px-1 py-0.5 rounded">/install indexes</code>.
          </p>
        </div>
      </div>
      <div className="mt-6">
        <Link href="/getting-started/details" className="text-blue-400 hover:underline text-base">
          More Steps →
        </Link>
      </div>
    </div>
  );
}

/* ----------------- API Documentation Docs ----------------- */
function APIDocsContent() {
  return (
    <div className="flex-grow p-4 bg-black">
      <h1 className="text-4xl font-bold mb-2 text-white">API Documentation</h1>
      <hr className="border-t border-gray-700 my-3" />
      <p className="text-base text-gray-300 mb-2">
        Our RESTful API is under development. Soon, you’ll be able to access endpoints for:
      </p>
      <ul className="list-disc list-inside text-gray-300 text-base space-y-2 mb-4">
        <li>
          <strong>/api/tokens</strong> – Fetch live token data, including market cap, price, volume, and more.
        </li>
        <li>
          <strong>/api/transactions</strong> – Retrieve on‑chain transaction data and whale trades.
        </li>
        <li>
          <strong>/api/news</strong> – Access the latest news and articles from our Firestore collection.
        </li>
      </ul>
      <p className="text-base text-gray-300 mb-4">
        In the future, our API will enable third‑party integrations and advanced analytics, allowing developers to build custom tools on top of Homebase data.
      </p>
      <div className="mt-4">
        <Link href="/api-docs/details" className="text-blue-400 hover:underline text-base">
          API Setup Guide →
        </Link>
      </div>
    </div>
  );
}

/* ----------------- Company Updates Docs ----------------- */
function CompanyUpdatesContent() {
  return (
    <div className="flex-grow p-4 bg-black">
      <h1 className="text-4xl font-bold mb-2 text-white">Company Updates</h1>
      <hr className="border-t border-gray-700 my-3" />
      <p className="text-base text-gray-300 mb-2">
        Check out our weekly updates covering new features, improvements, roadmap changes, and insights from the Homebase team.
      </p>
      <p className="text-base text-gray-300">
        Stay informed about our progress and future plans.
      </p>
      <div className="mt-4">
        <Link href="/company-updates/details" className="text-blue-400 hover:underline text-base">
          Read More →
        </Link>
      </div>
    </div>
  );
}

