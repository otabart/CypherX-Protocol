'use client';

import { Lightbulb } from 'lucide-react';

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
  // Example sections with more text
  products: {
    title: 'Products Overview',
    lastUpdated: 'February 15, 2025',
    breadcrumb: ['Home', 'Docs', 'Products'],
    content: `
Homebase provides a range of tools for exploring the Base chain effectively:
• Analytics Dashboard for real-time data
• Market Insights for price & volume tracking
• Community Forum for direct engagement
    `,
    callout: `We regularly update each tool based on community feedback. Share your thoughts to help us shape the future of Homebase!`,
  },

  analytics: {
    title: 'Trading Tools',
    lastUpdated: 'February 15, 2025',
    breadcrumb: ['Home', 'Docs', 'Products', 'Analytics'],
    content: `
Trading Tools

Navigating the fast-paced world of crypto trading requires precision, speed, and reliable insights. Homebase offers a suite of powerful trading tools designed to give traders an edge in the market.

Whale Watchers Tool
Track the movements of the biggest players in the market with our Whale Watchers Tool. By monitoring large wallet transactions and key liquidity shifts, this tool helps you identify trends before they hit the mainstream. Stay ahead by following the money and reacting strategically to major market moves.

Token Screener
Finding the right tokens at the right time can be the difference between catching a moonshot and missing out. Our Token Screener provides real-time filtering and ranking based on liquidity, volume, contract safety, and other key indicators. Whether you’re hunting for the next 100x gem or filtering out risky projects, our screener simplifies the process.

Honeypot Tracker
Avoid scams and protect your investments with our Honeypot Tracker. This tool scans smart contracts for malicious code, ensuring that tokens can be freely traded and aren’t designed to trap funds. Get instant alerts and verify contracts before making a move.

Homebase equips you with the best tools to trade smarter, safer, and faster. Whether you're a seasoned trader or just starting, our platform gives you the insights you need to make informed decisions in the ever-evolving crypto space.
    `,
    callout: `Pro Tip: Our Whale Watchers Tool Provides insights on speciifc tokens not all on-chain transactions`,
  },

  insights: {
    title: 'Market Insights',
    lastUpdated: 'February 15, 2025',
    breadcrumb: ['Home', 'Docs', 'Products', 'Market Insights'],
    content: `
Market Insights

Staying informed is the key to success in crypto. Homebase provides cutting-edge market insights through our News Terminal, Launch Calendar, and Analysts sections—ensuring you never miss a crucial update, trend, or opportunity.

News Terminal
The crypto market moves fast, and having the right information at the right time is critical. Our News Terminal aggregates real-time updates from top sources, tracking breaking news, regulatory changes, and market shifts. With curated insights and AI-powered filtering, you get only the most relevant updates—allowing you to make informed decisions without the noise.

Launch Calendar
Timing is everything in crypto. Our Launch Calendar keeps you ahead of the game by tracking upcoming token launches, major airdrops, protocol upgrades, and other key events. Whether you're looking for early investment opportunities or preparing for major ecosystem changes, our calendar ensures you’re always one step ahead.

Analysts
Deep analysis matters. Our Analysts section features expert breakdowns of market trends, trading strategies, and high-potential projects. From on-chain data insights to macroeconomic analysis, our team provides actionable intelligence to help you navigate the crypto landscape with confidence.

With Homebase, you get more than just data—you get the insights and tools needed to act decisively in the ever-evolving world of Web3.

`,
    callout: `Heads Up: Our News Terminal is re-written content from our AI that fetches news and data across the web.`,
  },

  forum: {
    title: 'Community Forum',
    lastUpdated: 'February 15, 2025',
    breadcrumb: ['Home', 'Docs', 'Products', 'Forum'],
    content: `
Community Forum

Crypto thrives on community, and at Homebase, we’re building a space where traders, developers, and investors can connect, share insights, and grow together. Our Community Forum, set to launch at the end of March, will be a hub for discussions, market analysis, and collaboration within the Base chain ecosystem and beyond.

What the Forum Offers

1.) Market Discussions – Engage in real-time conversations about token trends, trading strategies, and industry news. Whether you’re a beginner or a seasoned trader, this is the place to share knowledge and insights.

2.) Project Deep Dives – Get community-driven research and analysis on new and emerging projects. Share findings, ask questions, and collaborate with other investors to identify the strongest opportunities.

3.) Alpha & Trade Signals – Stay ahead with user-generated trade signals and alpha leaks. Get alerts on potential 100x plays and discuss strategies with experienced traders.

4.) Technical Help & Development – Connect with developers and blockchain experts for guidance on smart contracts, dApp development, and Base chain integrations. A space for learning, troubleshooting, and innovating.

5.) Community Challenges & Rewards – Participate in exclusive community events, challenges, and reward programs. Earn recognition, perks, and potential token incentives by contributing valuable insights.

Future Plans
Our vision for the Homebase Community Forum goes beyond just discussions. We aim to introduce:

Reputation & Ranking System – Reward active and insightful members with ranks, badges, and exclusive access to premium insights.
On-Chain Governance – Implement governance features that allow the community to propose and vote on platform updates and initiatives.
Integrated Trading Insights – Seamless access to our Trading Tools and Market Insights, allowing members to discuss and analyze data in real-time.
The Homebase Community Forum isn’t just a place to talk—it’s a place to build, collaborate, and stay ahead in the crypto space. Mark your calendars for the end of March and be part of the movement. 🚀
    `,
    callout: `We will hold weekly AMAs and special events. Join the conversation, ask questions, or pitch new features you'd like to see.`,
  },

  launch: {
    title: 'When Do We Launch?',
    lastUpdated: 'February 15, 2025',
    breadcrumb: ['Home', 'Docs', 'Launch'],
    content: `
Homebase Launch – Set for early March

Homebase is set to launch in early March, and we’re bringing the hype straight to Clank.Fun—the premier launchpad on Base. Our decision to launch on Clank isn’t just about convenience; it’s about tapping into a thriving culture, minimizing LP fees, and ensuring our platform has the best possible start in the Base ecosystem.

Why Clank.Fun?

Clank.Fun has established itself as a high-energy, community-driven launchpad that embodies the degen spirit of Base. Here’s why we chose it:

Low Liquidity Fees – Unlike other platforms that demand hefty LP commitments, Clank.Fun allows us to launch with lower fees, maximizing the initial liquidity pool for our token.
Engaged Community – The Clank.Fun ecosystem is active, meme-friendly, and high-volume, making it the perfect environment for a project that thrives on social engagement.
Proven Success – Clank has been the birthplace of some of Base’s most successful and viral launches, ensuring that we’re tapping into an audience hungry for innovation and ready to ape.

What to Expect at Launch

Fair & Transparent Token Launch – No insider allocations, no unfair advantage—everyone gets a fair shot at participating.
Massive Community Engagement – Expect Twitter spaces, live chats, and community-driven hype leading up to and following the launch.
Strong Post-Launch Roadmap – We’re not just launching a token; we’re launching a platform with real utility. Homebase is here to stay.
By leveraging the culture, speed, and meme energy of Clank.Fun, we’re ensuring Homebase launches the right way—with momentum, visibility, and a community-first approach. Get ready, Base chain, because we’re about to send it. 🚀🔥
    `,
    callout: `Early adopters often receive exclusive perks. Keep an eye on announcements to avoid missing out on potential airdrops or promos!`,
  },

  'past-news': {
    title: 'Past News',
    lastUpdated: 'February 15, 2025',
    breadcrumb: ['Home', 'Docs', 'Past News'],
    content: `
Homebase Company News & Updates

Trading Tools Expansion

2/7 - Whale Watchers Tool – Tracks large Base chain transactions to monitor market trends.

2/12 - Token Screener – Helps traders filter and analyze tokens based on liquidity, volume, and contract safety.

2/15 - Honeypot Tracker – A tool to detect potential scams and malicious smart contracts.

Market Insights Features Launched

2/21 - News Terminal – Aggregates top crypto news and Base chain updates in real-time.

2/21 -Launch Calendar – Tracks upcoming token launches, airdrops, and ecosystem events.

Analyst Reports – In-depth research and analysis on trending tokens and Base chain developments.

Homebase Forum Announcement – Planned end of March launch for the community forum, offering market discussions, trade signals, and alpha leaks.

Homebase Token Launch Confirmed for Early March – Announced that the platform’s token will launch on Clank.Fun, leveraging its low LP fees and community-driven ecosystem.

🔥 Upcoming & Future Developments

Community Forum Launch (March 2025) – A dedicated space for traders, investors, and developers to engage and collaborate.
Potential Partnerships – Exploring integrations with Base-native projects, trading platforms, and on-chain analytics tools.

On-Chain Governance & Reputation System – Future plans to introduce governance voting and a user ranking system for engaged community members.
Homebase is rapidly evolving, with new tools, insights, and community features rolling out. Stay tuned for more major updates as we continue to build! 🚀💙
    `,
    callout: `Check our X / Twitter for monthly retrospectives highlighting major development milestones and upcoming ideas.`,
  },

  'company-updates': {
    title: 'Company Updates',
    lastUpdated: 'February 15, 2025',
    breadcrumb: ['Home', 'Docs', 'Company Updates'],
    content: `
Stay tuned for behind-the-scenes updates at Homebase. We frequently share roadmap adjustments, team expansions, and newly secured funding for further growth.
    `,
    callout: `Got suggestions? We rely heavily on community insight to steer our development priorities.`,
  },

  'getting-started': {
    title: 'Getting Started',
    lastUpdated: 'February 15, 2025',
    breadcrumb: ['Home', 'Docs', 'Getting Started'],
    content: `
Getting Started with Homebase

Welcome to Homebase, the ultimate platform for Base chain traders, investors, and enthusiasts. Whether you're here for real-time market insights, powerful trading tools, or a vibrant community, getting started is easy. Follow these steps to dive into the Homebase ecosystem and take your trading to the next level.

1.) Connect Your Wallet
To access Homebase’s full features, you'll need to connect your wallet. We support MetaMask, Coinbase Wallet, WalletConnect, and other Base-compatible wallets. Simply:

Click the “Connect Wallet” button in the top right corner.
Select your preferred wallet.
Approve the connection and switch to Base chain if needed.

2.) Explore Trading Tools
Gain an edge in the market with our advanced trading tools:

Whale Watchers – Track major wallet movements and liquidity shifts.
Token Screener – Find promising tokens with real-time data and safety analysis.
Honeypot Tracker – Protect yourself from scams by verifying contracts before trading.

3.) Stay Informed with Market Insights
Knowledge is power, and Homebase provides real-time news, launch tracking, and expert analysis to keep you ahead of the curve.

News Terminal – Aggregates the latest crypto news and Base chain updates.
Launch Calendar – Never miss an upcoming token launch or airdrop.
Analyst Reports – Get in-depth breakdowns of trending tokens and market trends.

4.) Join the Community Forum (Launching Late March!)
Crypto is built on community, and soon, Homebase will launch an interactive forum where you can:

Discuss market trends and token strategies.
Get insights from top traders and analysts.
Share alpha, signals, and research on Base chain projects.

5.) Participate in the Homebase Token Launch (Early March!)
We’re launching our token on Clank.Fun, the premier Base chain launchpad. Clank offers low LP fees and a strong degen culture, making it the perfect place to kickstart our ecosystem. Stay tuned for more details on how to get involved.

Ready to Get Started?
Homebase is built for traders who want smarter insights, better tools, and a stronger community. Whether you're a seasoned investor or just starting in crypto, we’ve got everything you need to navigate the Base ecosystem with confidence.

    `,
    callout: `If you have any trouble, our support team is ready to help. Ask in the forum or send an email to support@homebase.com.`,
  },

  'api-docs': {
    title: 'API Documentation',
    lastUpdated: 'February 15, 2025',
    breadcrumb: ['Home', 'Docs', 'API Documentation'],
    content: `
Developers can integrate real-time data from the Base chain into their own apps via our simple RESTful API. Gain direct access to transaction details, wallet info, and market metrics.
    `,
    callout: `API Keys are currently unavailable, stay tuned for future updates`,
  },

  faqs: {
    title: 'Frequently Asked Questions',
    lastUpdated: 'February 15, 2025',
    breadcrumb: ['Home', 'Docs', 'FAQs'],
    content: `
Frequently Asked Questions (FAQs)

1. What is Homebase?
Homebase is an all-in-one platform designed for Base chain traders, investors, and enthusiasts. We offer real-time market insights, powerful trading tools, and a community-driven forum to help users navigate the crypto space more effectively.

2. Who is Homebase for?
Homebase is built for traders, investors, and developers who want access to cutting-edge analytics, token tracking, and community discussions focused on the Base chain ecosystem. Whether you're a seasoned degen or just getting started, Homebase has something for you.

3. How do I get started?
It’s easy!

Connect your wallet (MetaMask, Coinbase Wallet, WalletConnect, etc.).
Explore our trading tools (Whale Watchers, Token Screener, Honeypot Tracker).
Check out Market Insights (News Terminal, Launch Calendar, Analyst Reports).
Join the Community Forum (Launching late March!).
 Trading Tools & Features

 4. What tools does Homebase offer?

Whale Watchers – Tracks large wallet movements and liquidity shifts.
Token Screener – Helps filter and analyze Base chain tokens.
Honeypot Tracker – Detects scams and ensures token safety.

5. How does the Honeypot Tracker work?
The Honeypot Tracker scans a token’s smart contract to detect potential scam mechanics, ensuring that the token can be freely traded and isn’t designed to trap funds.

6. How often is the data updated?
Homebase pulls real-time data from multiple on-chain sources to ensure the latest and most accurate market insights.

📢 Market Insights & Community

7. What is the Homebase News Terminal?
The News Terminal aggregates top crypto news and Base chain updates, allowing users to stay ahead of market-moving events in real-time.

8. When does the Homebase Community Forum launch?
The Community Forum is launching in late March 2025. It will be a hub for discussions, trade signals, project deep dives, and more.

 Homebase Token & Launch

9. When is the Homebase token launching?
Homebase is launching its token in early March on Clank.Fun, a popular Base chain launchpad known for its low LP fees and strong community culture.

10. Why is Homebase launching on Clank.Fun?
We chose Clank.Fun because of:

Low LP fees, which means more liquidity for trading.
A strong community-driven launch culture.
Proven success in launching Base chain projects with high engagement.

🛠️ Technical & Security

11. Is Homebase secure?
Yes, Homebase is committed to security. We analyze contracts for potential risks, and our Honeypot Tracker helps users avoid malicious tokens. However, always DYOR (Do Your Own Research) before investing.

12. Does Homebase store any user funds or private keys?
No. Homebase is a non-custodial platform, meaning we do not store private keys or funds. You remain in full control of your assets at all times.

❓ Need More Help?
If you have any other questions, feel free to join our Community Forum (coming soon!) or follow our social channels for updates.




    `,
    callout: `If your question isn't listed here, jump into the Forum or open a GitHub Issue. Community-driven Q&A speeds up resolution!`,
  },
};

export default function Content({ activeSection }: ContentProps) {
  const section = contentData[activeSection] || {
    title: 'Welcome to Homebase Docs',
    lastUpdated: 'N/A',
    breadcrumb: ['Home', 'Docs'],
    content: 'Select a section from the sidebar to explore our features.',
    callout: '',
  };

  // Build breadcrumb display
  const breadcrumbElements = section.breadcrumb.map((crumb, idx) => {
    const isLast = idx === section.breadcrumb.length - 1;
    return (
      <div key={crumb} className="flex items-center space-x-1">
        <a
          href="#"
          className={`${
            isLast ? 'text-gray-300 cursor-default' : 'text-blue-400 hover:underline'
          } text-xs truncate`}
          style={{ maxWidth: '60px' }}
          title={crumb} // show full on hover
        >
          {crumb}
        </a>
        {!isLast && <span className="text-xs">/</span>}
      </div>
    );
  });

  return (
    <div className="flex-grow p-4 md:p-6 bg-black">
      {/* Top row: Breadcrumb + Date in one line, no wrap */}
      <div className="flex items-center justify-between whitespace-nowrap overflow-x-auto">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center text-gray-400 space-x-2">
          {breadcrumbElements}
        </div>
        {/* Date Updated */}
        <span className="text-xs text-gray-400">
          Last Updated: {section.lastUpdated}
        </span>
      </div>

      {/* Title */}
      <h2 className="text-xl md:text-2xl font-bold text-blue-500 mb-2 mt-2">
        {section.title}
      </h2>

      {/* Main Content */}
      <div className="bg-black p-4 md:p-6 rounded-md shadow border border-gray-700">
        <p className="text-sm md:text-base text-gray-300 whitespace-pre-line">
          {section.content}
        </p>

        {/* Lightblue/darkblue callout with a lightbulb */}
        <div className="mt-4 p-4 bg-blue-800 border-l-4 border-blue-500 rounded-md flex items-start space-x-3">
          <Lightbulb className="text-blue-100 mt-1" />
          <p className="text-sm md:text-base text-blue-100">
            {section.callout}
          </p>
        </div>
      </div>
    </div>
  );
}














