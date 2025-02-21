'use client';

import { useState } from 'react';
import Sidebar from './components/sidebar';
import Content from './components/content';
import RightSidebar from './components/rightsidebar';
import { motion } from 'framer-motion';

// Parent container to stagger child animations
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.2,
    },
  },
};

// Variants for the three main sections
const sidebarVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5 } },
};

const contentVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const rightSidebarVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5 } },
};

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('products');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {/* HEADER */}
      <motion.header
        className="sticky top-0 z-30 bg-black border-b border-gray-700 px-6 py-4 shadow-md flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Left: Logo + Title */}
        <div className="flex items-center space-x-3">
          <img
            src="https://i.imgur.com/7L1Xsfa.png"
            alt="Homebase Logo"
            className="w-8 h-8 object-contain"
          />
          <h1 className="text-2xl font-bold whitespace-nowrap">Docs</h1>
        </div>

        {/* Hamburger icon for mobile */}
        <button
          className="block lg:hidden text-xl"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          ☰
        </button>
      </motion.header>

      {/* MAIN BODY */}
      <motion.div
        className="flex flex-grow overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Sidebar */}
        <motion.div variants={sidebarVariants} className="flex-shrink-0">
          <Sidebar
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        </motion.div>

        {/* Content */}
        <motion.div variants={contentVariants} className="flex-1">
          <Content activeSection={activeSection} />
        </motion.div>

        {/* Right Sidebar with full-height separator */}
        <motion.div
          variants={rightSidebarVariants}
          className="flex-shrink-0 w-64 border-l border-gray-700 h-full"
        >
          <RightSidebar />
        </motion.div>
      </motion.div>
    </div>
  );
}









