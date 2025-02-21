'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

const sections = [
  {
    id: 'products',
    title: 'Products',
    subSections: [
      { id: 'analytics', title: 'Trading Tools' },
      { id: 'insights', title: 'Market Insights' },
      { id: 'forum', title: 'Community Forum' },
    ],
  },
  { id: 'launch', title: 'When Do We Launch?' },
  { id: 'past-news', title: 'Past News' },
  { id: 'company-updates', title: 'Company Updates' },
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'api-docs', title: 'API Documentation' },
  { id: 'faqs', title: 'FAQs' },
];

export default function Sidebar({
  activeSection,
  setActiveSection,
  isSidebarOpen,
  setIsSidebarOpen,
}: SidebarProps) {
  // Tracks which dropdown is open
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <aside
      className={`
        fixed
        lg:static
        top-0
        left-0
        z-20
        h-full
        w-64
        bg-black
        border-r border-gray-700
        pt-16 lg:pt-4
        px-4
        pb-4
        transform
        transition-transform
        overflow-y-auto
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
    >
      {/* Close button (mobile) */}
      <button
        className="lg:hidden text-xl float-right mb-2"
        onClick={() => setIsSidebarOpen(false)}
      >
        ✖
      </button>

      <h2 className="text-lg font-bold mb-4">Documentation</h2>

      {/* Search Field */}
      <input
        type="text"
        placeholder="Search Docs..."
        className="w-full px-4 py-2 mb-6 border border-gray-600 rounded-md bg-black text-white"
      />

      <ul className="space-y-4">
        {sections.map((section) => (
          <li key={section.id}>
            {section.subSections ? (
              <div>
                <button
                  className="flex items-center justify-between w-full text-left px-4 py-2 rounded-md transition-all hover:bg-gray-800"
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === section.id ? null : section.id
                    )
                  }
                >
                  <span>{section.title}</span>
                  {openDropdown === section.id ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </button>
                {openDropdown === section.id && (
                  <ul className="pl-4 space-y-2 mt-1">
                    {section.subSections.map((sub) => (
                      <li key={sub.id}>
                        <button
                          onClick={() => {
                            setActiveSection(sub.id);
                            setIsSidebarOpen(false);
                          }}
                          className={`block w-full text-left px-4 py-2 rounded-md transition-all ${
                            activeSection === sub.id
                              ? 'bg-blue-600 text-white font-bold'
                              : 'hover:bg-gray-700'
                          }`}
                        >
                          {sub.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setActiveSection(section.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full text-left px-4 py-2 rounded-md transition-all ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white font-bold'
                    : 'hover:bg-gray-800'
                }`}
              >
                {section.title}
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}














