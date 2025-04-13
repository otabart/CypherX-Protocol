"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import { FaFilter, FaSort, FaBell, FaStar, FaPlusCircle, FaTrophy, FaBolt, FaTwitter } from "react-icons/fa";
import { motion } from "framer-motion";

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
        <p className="text-xs text-gray-400 px-4">© 2025 Homebase. All rights reserved.</p>
      </footer>
    </div>
  );
}

/* ----------------- Breadcrumb Navigation ----------------- */
function Breadcrumb({ currentTitle }: { currentTitle: string }) {
  return (
    <nav className="px-4 py-4 bg-black">
      <div className="flex items-center text-sm text-blue-500">
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
    <div className="p-4 sm:p-6 bg-black text-white">
      <section className="max-w-4xl mx-auto text-left">
        <h1 className="text-4xl font-bold mb-2">Homebase Docs Overview</h1>
        <hr className="border-t border-gray-700 my-3" />
        <p className="text-base text-gray-300 mb-4">
          Welcome to the Homebase Documentation! Our platform brings all on‑chain data into one unified interface. No more hopping between multiple websites—here you can access live data, perform audits, and monitor market trends effortlessly.
        </p>
        <p className="text-base text-gray-300 mb-4">
          Use the navigation bar above to explore sections such as Terminal, Whale Watchers, Homebase Screener, Honeypot Tracker, Token Launch Calendar, Tournaments, Getting Started, API Documentation, and Company Updates.
        </p>
        <p className="text-base text-gray-300">
          For further guidance, please visit our <Link href="/docs/faq" className="text-blue-500 hover:underline">FAQ</Link> page.
        </p>
        <div className="mt-4">
          <Link href="/overview" className="text-blue-500 hover:underline text-base">
            Learn More →
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ----------------- Terminal Docs ----------------- */
function TerminalContent() {
  return (
    <div className="flex-grow p-4 sm:p-6 bg-black text-white">
      <section className="max-w-4xl mx-auto text-left">
        <h1 className="text-4xl font-bold mb-2">Terminal</h1>
        <p className="text-base text-gray-300 mb-4">
          The Homebase Terminal is your command center for managing your account, accessing live on‑chain data, performing audits, and more. It gathers data from multiple sources into one unified interface.
        </p>
        <p className="text-base text-gray-300 mb-4">
          Below is the full list of commands:
        </p>
        <ul className="list-disc list-inside text-base text-gray-300 space-y-2">
          <li><strong>/login &lt;email&gt; &lt;password&gt;</strong> – Log in to your account.</li>
          <li><strong>/signup &lt;email&gt; &lt;password&gt;</strong> – Create a new account.</li>
          <li><strong>/setdisplay &lt;name&gt;</strong> – Set your display name.</li>
          <li><strong>/screener</strong> – Open the Homebase Token Screener.</li>
          <li><strong>/token-stats</strong> – For example, <code className="bg-gray-800 px-1 py-0.5 rounded">/CLANKER-stats</code> to fetch token stats.</li>
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
      <section className="mt-6 max-w-4xl mx-auto text-left">
        <h2 className="text-2xl font-bold mb-2">Install Code Example</h2>
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
          <Link href="/terminal" className="text-blue-500 hover:underline text-base">
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
    <div className="flex-grow p-4 sm:p-6 bg-black text-white">
      <section className="max-w-4xl mx-auto text-left">
        <h1 className="text-4xl font-bold mb-4">Whale Watchers</h1>
        <p className="text-base text-gray-300 mb-4">
          Monitor large trades on the Base chain. Alerts trigger when a buy or sell order exceeds $5,000 or represents at least 0.2% of a token's supply.
        </p>
        <p className="text-base text-gray-300 mb-4">
          Currently, only Homebase‑approved assets are supported. For the latest list, visit <Link href="/supported/assets" className="text-blue-500 hover:underline">/supported/assets</Link>.
        </p>
        <p className="text-base text-gray-300 mb-4">
          For live updates, follow our X at <Link href="https://twitter.com/HomebaseAssets" target="_blank" className="text-blue-500 hover:underline">@HomebaseAssets</Link>. Future v2 will include advanced filtering and broader token support.
        </p>
        <div className="mt-4">
          <Link href="/whale-watchers/details" className="text-blue-500 hover:underline text-base">
            Learn More →
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ----------------- Screener Docs ----------------- */
// Collapsible Section Component for better UX
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
}

function CollapsibleSection({ title, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-4">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-3 bg-gray-700 rounded-md text-white text-lg font-semibold"
      >
        <span>{title}</span>
        <span>{isOpen ? "▲" : "▼"}</span>
      </motion.button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3 }}
          className="p-4 bg-gray-800 rounded-b-md text-gray-300 text-left"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

function ScreenerContent() {
  return (
    <div className="flex-grow p-4 sm:p-6 bg-black text-white">
      <section className="max-w-4xl mx-auto text-left">
        <h1 className="text-4xl font-bold mb-4">Screener Documentation</h1>
        <p className="text-base text-gray-300 mb-6">
          The Homebase Screener is a powerful tool designed to identify high-potential tokens using a trend-driven algorithm. It aggregates real-time data from multiple sources, prioritizing tokens with consistent upward price movements across 1H, 6H, and 24H timeframes. The algorithm also considers transaction volume, liquidity, token age, and boost status to provide a comprehensive view of market momentum.
        </p>

        {/* Trending Score Section */}
        <CollapsibleSection title="How the Trending Score Works">
          <p className="text-base text-gray-300 mb-4">
            The algorithm computes a trending score by evaluating several key metrics, ensuring that tokens with strong momentum and market activity are highlighted:
          </p>
          <ul className="list-disc list-inside ml-4 mb-4">
            <li>
              <strong>Price Movement:</strong> Tokens with positive price changes in 1H, 6H, and 24H intervals are scored higher, with a 2x weight applied to each timeframe. A consistency bonus of 10 points is awarded if a token shows upward movement across all three timeframes.
            </li>
            <li>
              <strong>Transaction Volume:</strong> The number of transactions in the last 24 hours is a major factor. Tokens with fewer than 10 transactions receive a 70% penalty, and those with 10–50 transactions receive a 30% penalty.
            </li>
            <li>
              <strong>Trading Volume and Liquidity:</strong> The 24H trading volume and liquidity in USD contribute to the score, rewarding tokens with higher market activity and stability.
            </li>
            <li>
              <strong>Age Decay:</strong> Older tokens have their scores reduced using an exponential decay factor (with a decay constant of 7 days), ensuring newer tokens with strong momentum are prioritized. The minimum decay factor is 0.3.
            </li>
            <li>
              <strong>Boost Bonus:</strong> Tokens can receive a boost to their score based on their purchased boost tier:
              <table className="table-auto w-full text-sm text-gray-300 mt-2 mb-4">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="p-2 text-left">Boost Tier</th>
                    <th className="p-2 text-left">Score Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2">Premium Boost</td>
                    <td className="p-2">+175</td>
                  </tr>
                  <tr className="bg-gray-900">
                    <td className="p-2">Standard Boost</td>
                    <td className="p-2">+20</td>
                  </tr>
                  <tr>
                    <td className="p-2">Basic Boost</td>
                    <td className="p-2">+10</td>
                  </tr>
                </tbody>
              </table>
            </li>
          </ul>
          <div className="bg-gray-900 p-4 rounded-md mb-4">
            <h3 className="text-lg font-semibold mb-2">Trending Score Code</h3>
            <pre className="text-sm text-white overflow-x-auto">
{`function computeTrending(token, boostValue) {
  const txns = getTxns24h(token);
  let txnScore = Math.log10(txns + 1) * 1.5;
  if (txns < 10) txnScore *= 0.3;
  else if (txns < 50) txnScore *= 0.7;

  const volumeScore = Math.log10(token.volume.h24 + 1) * 0.5;
  const liquidityScore = Math.log10(token.liquidity.usd + 1) * 0.3;

  const priceChange1h = token.priceChange?.h1 ?? 0;
  const priceChange6h = token.priceChange?.h6 ?? 0;
  const priceChange24h = token.priceChange?.h24 ?? 0;

  const priceMovementScore =
    (priceChange1h > 0 ? Math.log10(Math.abs(priceChange1h) + 1) * 2 : 0) +
    (priceChange6h > 0 ? Math.log10(Math.abs(priceChange6h) + 1) * 2 : 0) +
    (priceChange24h > 0 ? Math.log10(Math.abs(priceChange24h) + 1) * 2 : 0);

  const consistencyBonus =
    priceChange1h > 0 && priceChange6h > 0 && priceChange24h > 0 ? 10 : 0;

  const boostScore = boostValue || 0;

  const pairAgeDays = token.pairCreatedAt
    ? (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60 * 24)
    : 0;
  const ageDecay = Math.max(0.3, Math.exp(-pairAgeDays / 7));

  return (txnScore + volumeScore + liquidityScore + priceMovementScore + consistencyBonus + boostScore) * ageDecay;
}`}
            </pre>
          </div>
        </CollapsibleSection>

        {/* Features Section */}
        <CollapsibleSection title="Screener Features">
          <p className="text-base text-gray-300 mb-4">
            The screener offers a range of advanced features to help you discover and analyze tokens effectively:
          </p>
          <ul className="list-none space-y-4">
            <li className="flex items-start space-x-3">
              <FaFilter className="text-blue-500 mt-1" />
              <div>
                <strong>Filtering:</strong> Narrow down tokens by setting minimum thresholds for liquidity, 24H volume, and age (minimum and maximum days). This helps you focus on tokens that meet your specific criteria.
              </div>
            </li>
            <li className="flex items-start space-x-3">
              <FaSort className="text-blue-500 mt-1" />
              <div>
                <strong>Sorting:</strong> Sort tokens by various metrics, including trending score, price changes (1H, 6H, 24H), 24H volume, liquidity, market cap, or age. Toggle between ascending and descending order for each metric.
              </div>
            </li>
            <li className="flex items-start space-x-3">
              <FaBell className="text-blue-500 mt-1" />
              <div>
                <strong>Real-Time Alerts:</strong> Get notified of significant market movements:
                <ul className="list-disc list-inside ml-4 mt-2">
                  <li>
                    <strong>Volume Spikes:</strong> Triggered when the 1H volume exceeds 10% of the token’s market cap or 50% of its liquidity, with a 5-minute cooldown between alerts.
                  </li>
                  <li>
                    <strong>Price Spikes:</strong> Triggered for tokens with at least $50,000 in liquidity when the price changes by 3% or more in the last minute, also with a 5-minute cooldown.
                  </li>
                </ul>
              </div>
            </li>
            <li className="flex items-start space-x-3">
              <FaStar className="text-blue-500 mt-1" />
              <div>
                <strong>Favorites:</strong> Save tokens to your favorites list for quick access. This feature requires signing in and allows you to toggle between viewing all tokens or just your favorites.
              </div>
            </li>
            <li className="flex items-start space-x-3">
              <FaPlusCircle className="text-blue-500 mt-1" />
              <div>
                <strong>Token Submission:</strong> Submit new tokens for listing directly through the screener. Provide the token symbol, address, and logo URL, and our team will review your submission.
              </div>
            </li>
            <li className="flex items-start space-x-3">
              <FaTrophy className="text-blue-500 mt-1" />
              <div>
                <strong>Top Ranks:</strong> Tokens ranked in the top 3 by trending score receive trophy icons: Gold for 1st, Silver for 2nd, and Bronze for 3rd, making it easy to spot the top performers.
              </div>
            </li>
            <li className="flex items-start space-x-3">
              <FaBolt className="text-blue-500 mt-1" />
              <div>
                <strong>Boosted Tokens:</strong> Tokens with a purchased boost are marked with a lightning bolt icon and their boost value (e.g., +175), increasing their visibility on the leaderboard.
              </div>
            </li>
          </ul>
        </CollapsibleSection>

        {/* Visual Example: Table Columns */}
        <CollapsibleSection title="Screener Table Columns">
          <p className="text-base text-gray-300 mb-4">
            The screener displays token data in a table format on desktop and as cards on mobile. Here’s what each column represents:
          </p>
          <table className="table-auto w-full text-sm text-gray-300 mb-4">
            <thead>
              <tr className="bg-gray-700">
                <th className="p-2 text-left">Column</th>
                <th className="p-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2">#</td>
                <td className="p-2">Rank based on the selected sorting metric (default: trending score). Top 3 ranks display trophies.</td>
              </tr>
              <tr className="bg-gray-900">
                <td className="p-2">POOL</td>
                <td className="p-2">Token pair (e.g., Token Name / Quote Token) with the token symbol and logo.</td>
              </tr>
              <tr>
                <td className="p-2">PRICE</td>
                <td className="p-2">Current price in USD, rounded to 5 decimal places.</td>
              </tr>
              <tr className="bg-gray-900">
                <td className="p-2">AGE</td>
                <td className="p-2">Age of the token pair (e.g., "Today" or "5d").</td>
              </tr>
              <tr>
                <td className="p-2">TXN</td>
                <td className="p-2">Total transactions (buys + sells) in the last 24 hours.</td>
              </tr>
              <tr className="bg-gray-900">
                <td className="p-2">1H / 6H / 24H</td>
                <td className="p-2">Price change percentages over the last 1 hour, 6 hours, and 24 hours (green for positive, red for negative).</td>
              </tr>
              <tr>
                <td className="p-2">VOLUME</td>
                <td className="p-2">Trading volume in USD over the last 24 hours.</td>
              </tr>
              <tr className="bg-gray-900">
                <td className="p-2">LIQUIDITY</td>
                <td className="p-2">Liquidity in USD. Tokens with less than $20,000 in liquidity are marked with a warning (⚠️), except for specific tokens (e.g., BORK, FABIENE).</td>
              </tr>
              <tr>
                <td className="p-2">MCAP</td>
                <td className="p-2">Market capitalization in USD, if available.</td>
              </tr>
              <tr className="bg-gray-900">
                <td className="p-2">FDV</td>
                <td className="p-2">Fully diluted valuation in USD, if available.</td>
              </tr>
              <tr>
                <td className="p-2">ALERTS</td>
                <td className="p-2">Number of active alerts (e.g., volume or price spikes). Click to view details.</td>
              </tr>
              <tr className="bg-gray-900">
                <td className="p-2">ACTIONS</td>
                <td className="p-2">Options to favorite a token, copy its address, or scan it in the terminal.</td>
              </tr>
            </tbody>
          </table>
        </CollapsibleSection>

        {/* Follow Us Section */}
        <div className="mt-8 p-4 bg-gray-800 rounded-md flex items-center justify-between max-w-4xl mx-auto">
          <p className="text-base text-gray-300">
            Follow us on X at{" "}
            <Link href="https://twitter.com/HomebaseAssets" target="_blank" className="text-blue-500 hover:underline">
              @HomebaseAssets
            </Link>{" "}
            for token updates and platform announcements.
          </p>
          <a href="https://twitter.com/HomebaseAssets" target="_blank" rel="noopener noreferrer">
            <FaTwitter className="text-blue-500 text-2xl hover:text-blue-400" />
          </a>
        </div>
      </section>
    </div>
  );
}

/* ----------------- Honeypot Tracker Docs ----------------- */
function HoneypotTrackerContent() {
  return (
    <div className="flex-grow p-4 sm:p-6 bg-black text-white">
      <section className="max-w-4xl mx-auto text-left">
        <h1 className="text-4xl font-bold mb-2">Honeypot Tracker Documentation</h1>
        <h2 className="text-xl text-gray-300 mb-4">Smart Contract Safety Check</h2>
        <p className="text-base text-gray-300 mb-6">
          Our Honeypot Tracker scans smart contracts for potential malicious traps. Although our analysis is robust, it is not 100% foolproof—always perform your own due diligence before executing trades.
        </p>
        <div className="mt-4">
          <Link href="/honeypot-scanner" className="text-blue-500 hover:underline text-base">
            Audit Smart Contract →
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ----------------- Launch Calendar Docs ----------------- */
function LaunchCalendarContent() {
  return (
    <div className="flex-grow p-4 sm:p-6 bg-black text-white">
      <section className="max-w-4xl mx-auto text-left">
        <h1 className="text-4xl font-bold mb-4">Token Launch Calendar Documentation</h1>
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
          <Link href="/launch-calendar/details" className="text-blue-500 hover:underline text-base">
            View Calendar →
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ----------------- Tournaments Docs ----------------- */
function TournamentsContent() {
  return (
    <div className="flex-grow p-4 sm:p-6 bg-black text-white">
      <section className="max-w-4xl mx-auto text-left">
        <h1 className="text-4xl font-bold mb-4">Tournaments Documentation</h1>
        <p className="text-base text-gray-300 mb-4">
          Homebase Tournaments provide a competitive platform for traders. Participate in events that are either community‑funded or Homebase‑sponsored. Tournaments include entry fees, wallet tracking, live leaderboards, and detailed performance analytics.
        </p>
        <ul className="list-disc list-inside text-gray-300 text-base space-y-2 mb-4">
          <li><strong>Competition Styles:</strong> Choose between community‑funded tournaments or Homebase‑sponsored events.</li>
          <li><strong>Entry Fees:</strong> Fees vary by event and contribute to the prize pool.</li>
          <li><strong>Wallet Tracking:</strong> Monitor your performance and that of other participants in real time.</li>
          <li><strong>Leaderboards:</strong> Stay updated with live rankings and detailed analytics.</li>
          <li><strong>Admin Setup:</strong> Configure and launch tournaments via our admin panel.</li>
        </ul>
        <div className="mt-4">
          <Link href="/tournaments/details" className="text-blue-500 hover:underline text-base">
            Learn More →
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ----------------- Getting Started Docs ----------------- */
function GettingStartedContent() {
  return (
    <div className="flex-grow p-4 sm:p-6 bg-black text-white">
      <section className="max-w-4xl mx-auto text-left">
        <h1 className="text-4xl font-bold mb-2">Getting Started with Homebase</h1>
        <hr className="border-t border-gray-700 my-3" />
        <div className="space-y-3">
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
        <div className="mt-6">
          <Link href="/getting-started/details" className="text-blue-500 hover:underline text-base">
            More Steps →
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ----------------- API Documentation Docs ----------------- */
function APIDocsContent() {
  return (
    <div className="flex-grow p-4 sm:p-6 bg-black text-white">
      <section className="max-w-4xl mx-auto text-left">
        <h1 className="text-4xl font-bold mb-2">API Documentation</h1>
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
          <Link href="/api-docs/details" className="text-blue-500 hover:underline text-base">
            API Setup Guide →
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ----------------- Company Updates Docs ----------------- */
function CompanyUpdatesContent() {
  return (
    <div className="flex-grow p-4 sm:p-6 bg-black text-white">
      <section className="max-w-4xl mx-auto text-left">
        <h1 className="text-4xl font-bold mb-2">Company Updates</h1>
        <hr className="border-t border-gray-700 my-3" />
        <p className="text-base text-gray-300 mb-2">
          Check out our weekly updates covering new features, improvements, roadmap changes, and insights from the Homebase team.
        </p>
        <p className="text-base text-gray-300">
          Stay informed about our progress and future plans.
        </p>
        <div className="mt-4">
          <Link href="/company-updates/details" className="text-blue-500 hover:underline text-base">
            Read More →
          </Link>
        </div>
      </section>
    </div>
  );
}

