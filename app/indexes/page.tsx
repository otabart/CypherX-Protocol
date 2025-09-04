"use client";


import { motion } from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Indexes from "../components/Indexes";
import { useVotingModal } from "../providers";
import IndexVotingModal from "../components/IndexVotingModal";



function fadeInUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5, delay, ease: "easeOut" },
  };
}

export default function IndexesPage() {

  const { showVotingModal, setShowVotingModal, selectedIndexForVoting } = useVotingModal();

  return (
    <>
      <div className="min-h-screen flex flex-col bg-gray-950 overflow-x-hidden">
        <Header />

        {/* Separator line between header and content */}
        <div className="border-b border-gray-800/50"></div>

        <main className="flex-1 text-gray-200 relative overflow-x-hidden">
          {/* Background */}
          <div className="fixed inset-0 bg-gray-950 -z-10"></div>
          
          {/* Simple Background */}
          <div className="fixed inset-0 -z-10 overflow-hidden">
            {/* Primary Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-gray-900/10 to-purple-900/10"></div>
            
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}></div>
          </div>

          {/* Content Section */}
          <div className="relative z-10 p-4 sm:p-6 lg:p-8 pt-8 sm:pt-6 lg:pt-8">
            <motion.div {...fadeInUp(0.2)}>
              <Indexes />
            </motion.div>
          </div>
        </main>

        <Footer />
      </div>

      {/* Global Voting Modal */}
      {showVotingModal && selectedIndexForVoting && (
        <IndexVotingModal
          isOpen={showVotingModal}
          onClose={() => setShowVotingModal(false)}
          indexName={selectedIndexForVoting}
          currentTokens={[]} // This will be populated by the IndexVotingModal itself
        />
      )}
    </>
  );
}
