"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

const sections = [
  { id: "overview", title: "Overview" },
  { id: "terminal", title: "Homebase Terminal" },
  {
    id: "tools",
    title: "Tools",
    subSections: [
      { id: "whale-watchers", title: "Whale Watchers" },
      { id: "screener", title: "Homebase Screener" },
      { id: "honeypot-tracker", title: "Honeypot Tracker" },
      { id: "launch-calendar", title: "Token Launch Calendar" },
      { id: "tournaments", title: "Tournaments" },
    ],
  },
  { id: "getting-started", title: "Getting Started" },
  { id: "api-docs", title: "API Documentation" },
  { id: "company-updates", title: "Company Updates" },
];

const dropdownVariants = {
  hidden: { opacity: 0, height: 0, transition: { duration: 0.2 } },
  visible: { opacity: 1, height: "auto", transition: { duration: 0.3 } },
};

export default function Sidebar({
  activeSection,
  setActiveSection,
  isSidebarOpen,
  setIsSidebarOpen,
}: SidebarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSections = sections.filter((section) =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (section.subSections &&
      section.subSections.some((sub) =>
        sub.title.toLowerCase().includes(searchTerm.toLowerCase())
      ))
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -300, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`
          fixed top-0 left-0 z-30
          h-full w-[90vw] lg:w-64
          bg-black border-r border-gray-700
          px-4 pb-4 pt-4
          overflow-y-auto
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0
        `}
      >
        {/* Close button for mobile */}
        <div className="block lg:hidden flex justify-end mb-2 relative z-40">
          <button
            className="text-2xl"
            onClick={() => setIsSidebarOpen(false)}
          >
            &times;
          </button>
        </div>

        <h2 className="text-lg font-bold mb-4">Documentation</h2>

        {/* Search Field */}
        <input
          type="text"
          placeholder="Search Docs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 mb-6 border border-gray-600 rounded-md bg-black text-white text-sm"
        />

        <ul className="space-y-4">
          {filteredSections.map((section) => (
            <li key={section.id}>
              {section.subSections ? (
                <div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      setOpenDropdown(
                        openDropdown === section.id ? null : section.id
                      )
                    }
                    className="flex items-center justify-between w-full text-left px-4 py-2 rounded-md transition-colors hover:bg-[#0052FF]"
                  >
                    <span>{section.title}</span>
                    {openDropdown === section.id ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </motion.button>
                  <AnimatePresence>
                    {openDropdown === section.id && (
                      <motion.ul
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={dropdownVariants}
                        className="pl-4 mt-1 overflow-hidden space-y-2"
                      >
                        {section.subSections.map((sub) => (
                          <motion.li key={sub.id} whileHover={{ x: 5 }} whileTap={{ scale: 0.98 }}>
                            <button
                              onClick={() => {
                                setActiveSection(sub.id);
                                setIsSidebarOpen(false);
                              }}
                              className={`block w-full text-left px-4 py-2 rounded-md transition-colors ${
                                activeSection === sub.id
                                  ? "bg-[#0052FF] text-white font-bold"
                                  : "hover:bg-[#0052FF] text-gray-300"
                              }`}
                            >
                              {sub.title}
                            </button>
                          </motion.li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setActiveSection(section.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`block w-full text-left px-4 py-2 rounded-md transition-colors ${
                    activeSection === section.id
                      ? "bg-[#0052FF] text-white font-bold"
                      : "hover:bg-[#0052FF] text-gray-300"
                  }`}
                >
                  {section.title}
                </motion.button>
              )}
            </li>
          ))}
        </ul>
      </motion.aside>
    </>
  );
}
