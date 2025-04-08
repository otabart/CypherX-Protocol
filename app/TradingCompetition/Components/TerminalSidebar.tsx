// app/TradingCompetition/Components/TerminalSidebar.tsx
"use client";
import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCompetitionContext } from "../CompetitionContext";

export default function TerminalSidebar() {
  const { connectedWallet, displayName } = useCompetitionContext();
  const router = useRouter();
  const pathname = usePathname();

  const handleProfileConnect = () => {
    router.push("/login");
  };

  const navItems = [
    { href: "/TradingCompetition", label: "competitions" },
    { href: "/TradingCompetition/dashboard", label: "dashboard" },
    { href: "/TradingCompetition/admin", label: "admin" },
  ];

  return (
    <aside className="w-64 h-screen bg-black text-white font-mono p-4 flex flex-col border-r border-[#0052FF]/50">
      {/* Header */}
      <div className="mb-4 border-b border-[#0052FF]/50 pb-2">
        <span className="text-[#0052FF]">user@homebase:</span>
        <span className="text-gray-400">~/TradingCompetition</span>
      </div>

      {/* Profile Section */}
      <div className="mb-6 border-b border-[#0052FF]/50 pb-3">
        <h2 className="text-[#0052FF] text-sm mb-2"> profile</h2>
        {connectedWallet ? (
          <p className="text-gray-300 text-sm">
            {displayName ? displayName : shortAddress(connectedWallet)}
          </p>
        ) : (
          <button
            onClick={handleProfileConnect}
            className="text-gray-500 hover:text-[#0052FF] focus:outline-none text-sm flex items-center"
          >
            not connected<span className="animate-pulse text-[#0052FF] ml-1">█</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`text-sm py-1 px-2 rounded transition ${
              pathname === item.href
                ? "bg-[#0052FF]/20 text-[#0052FF]"
                : "text-gray-400 hover:text-[#0052FF] hover:bg-gray-900"
            }`}
          >
            {`> ${item.label}`}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function shortAddress(address: string) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}





