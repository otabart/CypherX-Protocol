"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

const sections = [
  {
    id: "products",
    title: "Products",
    subSections: [
      { id: "analytics", title: "Trading Tools" },
      { id: "insights", title: "Market Insights" },
      { id: "forum", title: "Community Forum" },
    ],
  },
  { id: "launch", title: "When Do We Launch?" },
  { id: "past-news", title: "Past News" },
  { id: "company-updates", title: "Company Updates" },
  { id: "getting-started", title: "Getting Started" },
  { id: "api-docs", title: "API Documentation" },
  { id: "faqs", title: "FAQs" },
];

const dropdownVariants = {
  hidden: { opacity: 0, height: 0, transition: { duration: 0.2, when: "afterChildren" } },
  visible: { opacity: 1, height: "auto", transition: { duration: 0.3, when: "beforeChildren" } },
};

export default function Sidebar({
  activeSection,
  setActiveSection,
  isSidebarOpen,
  setIsSidebarOpen,
}: SidebarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter sections by search term (matching title or any subsection title)
  const filteredSections = sections.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (section.subSections &&
      section.subSections.some(sub =>
        sub.title.toLowerCase().includes(searchTerm.toLowerCase())
      ))
  );

  return (
    <motion.aside
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`
        fixed
        lg:static
        top-0
        left-0
        z-20
        h-full
        w-[90vw] lg:w-64
        bg-black
        border-r border-gray-700
        px-4
        pb-4
        pt-20 lg:pt-1
        transform
        transition-transform
        overflow-y-auto
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
      `}
    >
      {/* Close button for mobile */}
      <button
        className="lg:hidden text-xl float-right mb-2"
        onClick={() => setIsSidebarOpen(false)}
      >
        ✖
      </button>

      <h2 className="text-lg font-bold mb-4 mt-2">Documentation</h2>

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
                  className="flex items-center justify-between w-full text-left px-4 py-2 rounded-md transition-colors hover:bg-[#0052FF]"
                  onClick={() =>
                    setOpenDropdown(openDropdown === section.id ? null : section.id)
                  }
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
                      className="pl-4 space-y-2 mt-1 overflow-hidden"
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
                className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
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
  );
}



















