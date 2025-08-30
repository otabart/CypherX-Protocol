"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiShoppingBag, 
  FiUser, 
  FiSearch,
  FiFilter,
  FiGrid,
  FiStar,
  FiClock,
  FiDollarSign,
  FiTrendingUp,
  FiShield,
  FiAward,
  FiPlus,
  FiFileText,
  FiCheckCircle,
  FiXCircle,
} from "react-icons/fi";
import ClientCard from '../components/ClientCard';
import Header from '../components/Header';
import Footer from '../components/Footer';
import toast, { Toaster } from "react-hot-toast";

// --------------------------------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------------------------------

interface MarketplaceItem {
  id?: string;
  name: string;
  price?: string;
  category?:
    | 'Advertisement'
    | 'TokenBoost'
    | 'ExplorerProfile'
    | 'Bump Bot';
  description: string;
  available?: boolean;
  duration?: string;
}

interface MarketplaceApplication {
  id: string;
  productName: string;
  category: string;
  description: string;
  price: string;
  duration: string;
  contactInfo: string;
  website?: string;
  socialLinks?: string;
  requirements?: string;
  benefits?: string;
  targetAudience?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: string;
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export default function MarketplacePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showMyApplicationsModal, setShowMyApplicationsModal] = useState(false);
  const [applicationStep, setApplicationStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Application form state
  const [application, setApplication] = useState({
    productName: "",
    category: "",
    description: "",
    price: "",
    duration: "",
    contactInfo: "",
    website: "",
    socialLinks: "",
    requirements: "",
    benefits: "",
    targetAudience: "",
  });

  // Mock applications data (in real app, this would come from database)
  const [myApplications, setMyApplications] = useState<MarketplaceApplication[]>([
    {
      id: "1",
      productName: "Custom Telegram Bot",
      category: "Telegram",
      description: "Automated trading signals and portfolio tracking",
      price: "25 USDC",
      duration: "Monthly",
      contactInfo: "contact@example.com",
      status: "pending",
      submittedBy: "user123",
      submittedAt: new Date(),
    },
    {
      id: "2",
      productName: "Token Analytics Dashboard",
      category: "TokenBoost",
      description: "Advanced analytics and insights for token performance",
      price: "50 USDC",
      duration: "Weekly",
      contactInfo: "analytics@example.com",
      status: "approved",
      submittedBy: "user123",
      submittedAt: new Date(Date.now() - 86400000),
      reviewedBy: "admin",
      reviewedAt: new Date(),
      reviewNotes: "Great product! Approved for marketplace.",
    },
  ]);

  // ----------------------------------------------------------------------------------------------
  // Product Data
  // ----------------------------------------------------------------------------------------------

  const marketplaceItems: MarketplaceItem[] = [
    {
      id: "1",
      name: 'Banner Ad Slot',
      price: '50 USDC',
      category: 'Advertisement',
      description:
        'Claim a prime banner ad slot on Cypher Systems, powered by Base chain. Once the transaction is confirmed, your ad will be live!',
      available: true,
      duration: '48HR',
    },
    {
      id: "2",
      name: 'Boost (10)',
      price: '10 USDC',
      category: 'TokenBoost',
      duration: '12HR',
      description:
        "Increase your token's visibility with a score of 10. Once confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: "3",
      name: 'Boost (20)',
      price: '15 USDC',
      category: 'TokenBoost',
      duration: '12HR',
      description:
        "Increase your token's visibility with a score of 20. Once confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: "4",
      name: 'Boost (30)',
      price: '20 USDC',
      category: 'TokenBoost',
      duration: '12HR',
      description:
        "Increase your token's visibility with a score of 30. Once confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: "5",
      name: 'Boost (40)',
      price: '25 USDC',
      category: 'TokenBoost',
      duration: '12HR',
      description:
        "Increase your token's visibility with a score of 40. Once confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: "6",
      name: 'Boost (50)',
      price: '35 USDC',
      category: 'TokenBoost',
      duration: '24HR',
      description:
        "Increase your token's visibility with a score of 50. Once confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: "7",
      name: 'Boost (100)',
      price: '50 USDC',
      category: 'TokenBoost',
      duration: '24HR',
      description:
        "Increase your token's visibility with a score of 100. Once confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: "8",
      name: 'Boost (150)',
      price: '75 USDC',
      category: 'TokenBoost',
      duration: '36HR',
      description:
        "Increase your token's visibility with a score of 150. Once confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: "9",
      name: 'Boost (200)',
      price: '90 USDC',
      category: 'TokenBoost',
      duration: '36HR',
      description:
        "Increase your token's visibility with a score of 200. Once confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: "10",
      name: 'Boost (250)',
      price: '100 USDC',
      category: 'TokenBoost',
      duration: '36HR',
      description:
        "Increase your token's visibility with a score of 250. Once confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: "11",
      name: 'Boost (500)',
      price: '175 USDC',
      category: 'TokenBoost',
      duration: '48HR',
      description:
        "Increase your token's visibility with a score of 500. Once confirmed, your token will appear boosted in the screener!",
      available: true,
    },
    {
      id: "12",
      name: 'Explorer Profile',
      price: '25 USDC',
      category: 'ExplorerProfile',
      duration: 'Permanent',
      description:
        'Get a verified explorer profile with enhanced features and priority support.',
      available: true,
    },
    {
      id: "13",
      name: 'Bump Bot',
      price: '50 USDC',
      category: 'Bump Bot',
      duration: 'Monthly',
      description:
        'Automated bump bot to keep your token trending and visible in the community.',
      available: true,
    },
  ];

  // ----------------------------------------------------------------------------------------------
  // Coming Soon Data
  // ----------------------------------------------------------------------------------------------
  
  const comingSoonItems: MarketplaceItem[] = [
    {
      name: 'Bump Bot (Micro txns)',
      description:
        'Auto-bump your token with microtransactions for maximum exposure.',
    },
    {
      name: 'Telegram Trending',
      description:
        'Launch your project to multiple different Telegram trending channels.',
    },
  ];

  // ----------------------------------------------------------------------------------------------
  // Filtering and Sorting
  // ----------------------------------------------------------------------------------------------

  const categories = [
    { id: "all", name: "All Categories", icon: FiGrid },
    { id: "advertisement", name: "Advertisement", icon: FiTrendingUp },
    { id: "tokenboost", name: "Token Boost", icon: FiTrendingUp },
    { id: "explorerprofile", name: "Explorer Profile", icon: FiUser },
  ];

  const applicationCategories = [
    { id: "advertisement", name: "Advertisement" },
    { id: "tokenboost", name: "Token Boost" },
    { id: "explorerprofile", name: "Explorer Profile" },
    { id: "telegram", name: "Telegram Services" },
    { id: "analytics", name: "Analytics Tools" },
    { id: "trading", name: "Trading Tools" },
    { id: "marketing", name: "Marketing Services" },
    { id: "development", name: "Development Services" },
    { id: "other", name: "Other" },
  ];

  const filteredItems = marketplaceItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || 
                           item.category?.toLowerCase() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case "price":
        const priceA = parseFloat(a.price?.split(' ')[0] || '0');
        const priceB = parseFloat(b.price?.split(' ')[0] || '0');
        return priceA - priceB;
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  // ----------------------------------------------------------------------------------------------
  // Application Handlers
  // ----------------------------------------------------------------------------------------------

  const handleApplicationSubmit = async () => {
    if (!application.productName || !application.category || !application.description || !application.price) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newApplication: MarketplaceApplication = {
      id: Date.now().toString(),
      productName: application.productName,
      category: application.category,
      description: application.description,
      price: application.price,
      duration: application.duration,
      contactInfo: application.contactInfo,
      website: application.website,
      socialLinks: application.socialLinks,
      requirements: application.requirements,
      benefits: application.benefits,
      targetAudience: application.targetAudience,
      status: "pending",
      submittedBy: "user123", // In real app, this would be the actual user ID
      submittedAt: new Date(),
    };

    setMyApplications(prev => [newApplication, ...prev]);
    
    // Reset form
    setApplication({
      productName: "",
      category: "",
      description: "",
      price: "",
      duration: "",
      contactInfo: "",
      website: "",
      socialLinks: "",
      requirements: "",
      benefits: "",
      targetAudience: "",
    });
    
    setApplicationStep(1);
    setShowApplicationModal(false);
    setIsSubmitting(false);
    
    toast.success("Application submitted successfully! We'll review it within 24-48 hours.");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'rejected':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      default:
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <FiCheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <FiXCircle className="w-4 h-4" />;
      default:
        return <FiClock className="w-4 h-4" />;
    }
  };

  // ----------------------------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------------------------
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col">
      <Header />
      <Toaster position="top-right" />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 flex items-center justify-center">
            <FiShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 text-blue-400" />
            Marketplace
          </h1>
          <p className="text-gray-400 text-base sm:text-lg md:text-xl max-w-3xl mx-auto mb-6 px-4">
            Discover powerful tools and services to enhance your presence on the Base chain ecosystem.
          </p>
          <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap px-4">
            <span className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-500/20 text-blue-400 rounded-full text-xs sm:text-sm font-medium border border-blue-500/30">
              <FiShield className="w-3 h-3 sm:w-4 sm:h-4" />
              Powered by Base Chain
            </span>
            <span className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-xs sm:text-sm font-medium border border-green-500/30">
              <FiAward className="w-3 h-3 sm:w-4 sm:h-4" />
              Secure Transactions
            </span>
            <span className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-500/20 text-purple-400 rounded-full text-xs sm:text-sm font-medium border border-purple-500/30">
              <FiPlus className="w-3 h-3 sm:w-4 sm:h-4" />
              Submit Your Product
            </span>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-8 justify-center px-4"
        >
          <button
            onClick={() => setShowApplicationModal(true)}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 font-medium text-base min-h-[56px] flex-1 sm:flex-none"
          >
            <FiPlus className="w-6 h-6" />
            Submit Product
          </button>
          
          <button
            onClick={() => setShowMyApplicationsModal(true)}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all duration-300 font-medium text-base border border-gray-600 min-h-[56px] flex-1 sm:flex-none"
          >
            <FiFileText className="w-6 h-6" />
            My Applications
          </button>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Search marketplace items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base min-h-[56px]"
                />
              </div>
            </div>

            <div className="flex items-stretch gap-4 flex-1 lg:flex-none">
              <div className="relative flex-1">
                <FiFilter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full pl-12 pr-8 py-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-base min-h-[56px]"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-6 py-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-base min-h-[56px] flex-1 lg:flex-none"
              >
                <option value="name">Sort by Name</option>
                <option value="price">Sort by Price</option>
                <option value="category">Sort by Category</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Category Pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-3 mb-8 px-4"
        >
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors text-sm font-medium min-h-[48px] ${
                selectedCategory === category.id
                  ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                  : "bg-gray-800/30 border-gray-600 text-gray-400 hover:bg-gray-700/30"
              }`}
            >
              <category.icon className="w-4 h-4" />
              <span>{category.name}</span>
            </button>
          ))}
        </motion.div>

        {/* Featured Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-16"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 px-4">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-2 mb-2 sm:mb-0">
              <FiStar className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
              Featured Products
            </h2>
            <div className="text-gray-400 text-sm">
              {sortedItems.length} of {marketplaceItems.length} items
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 px-4">
            <AnimatePresence>
              {sortedItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <ClientCard item={item} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {sortedItems.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 px-4"
            >
              <FiSearch className="w-12 h-12 sm:w-16 sm:h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-base sm:text-lg">No items found</p>
              <p className="text-gray-500 text-sm mt-2">Try adjusting your search or filters</p>
            </motion.div>
          )}
        </motion.div>

        {/* Coming Soon Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-16"
        >
          <div className="text-center mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center justify-center gap-2 mb-4">
              <FiClock className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              Coming Soon
            </h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto px-4">
              Exciting new products and services are in development. Stay tuned for these upcoming features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto px-4">
            {comingSoonItems.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700 p-6 hover:bg-gray-800/50 transition-all duration-300"
              >
                <ClientCard item={item} isComingSoon />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4">
              Marketplace Statistics
            </h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto px-4">
              Track the growth and activity of our marketplace ecosystem
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 px-4">
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 backdrop-blur-sm rounded-xl border border-green-500/20 p-4 sm:p-6 text-center group hover:border-green-500/40 transition-all duration-300">
              <FiTrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-400 mx-auto mb-3 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-sm sm:text-lg font-bold text-white mb-1 sm:mb-2">Active Products</h3>
              <p className="text-lg sm:text-2xl font-bold text-green-400">{marketplaceItems.length}</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 backdrop-blur-sm rounded-xl border border-blue-500/20 p-4 sm:p-6 text-center group hover:border-blue-500/40 transition-all duration-300">
              <FiDollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 mx-auto mb-3 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-sm sm:text-lg font-bold text-white mb-1 sm:mb-2">Total Value</h3>
              <p className="text-lg sm:text-2xl font-bold text-blue-400">1,000+ USDC</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4 sm:p-6 text-center group hover:border-purple-500/40 transition-all duration-300">
              <FiShield className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400 mx-auto mb-3 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-sm sm:text-lg font-bold text-white mb-1 sm:mb-2">Secure Platform</h3>
              <p className="text-lg sm:text-2xl font-bold text-purple-400">100% Safe</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 backdrop-blur-sm rounded-xl border border-yellow-500/20 p-4 sm:p-6 text-center group hover:border-yellow-500/40 transition-all duration-300">
              <FiFileText className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 mx-auto mb-3 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="text-sm sm:text-lg font-bold text-white mb-1 sm:mb-2">Applications</h3>
              <p className="text-lg sm:text-2xl font-bold text-yellow-400">{myApplications.length}</p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Application Modal */}
      <AnimatePresence>
        {showApplicationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <FiPlus className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                    Submit Product Application
                  </h2>
                  <button
                    onClick={() => setShowApplicationModal(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FiXCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
                <p className="text-gray-400 mt-2 text-sm sm:text-base">Share your product or service with the Base chain community</p>
              </div>

              <div className="p-6">
                {applicationStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Product/Service Name *
                      </label>
                      <input
                        type="text"
                        value={application.productName}
                        onChange={(e) => setApplication({...application, productName: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your product or service name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Category *
                      </label>
                      <select
                        value={application.category}
                        onChange={(e) => setApplication({...application, category: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a category</option>
                        {applicationCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Description *
                      </label>
                      <textarea
                        value={application.description}
                        onChange={(e) => setApplication({...application, description: e.target.value})}
                        rows={4}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe your product or service in detail"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Price *
                        </label>
                        <input
                          type="text"
                          value={application.price}
                          onChange={(e) => setApplication({...application, price: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., 25 USDC"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Duration
                        </label>
                        <input
                          type="text"
                          value={application.duration}
                          onChange={(e) => setApplication({...application, duration: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Monthly, Weekly, One-time"
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={() => setShowApplicationModal(false)}
                        className="flex-1 px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setApplicationStep(2)}
                        disabled={!application.productName || !application.category || !application.description || !application.price}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                      >
                        Next Step
                      </button>
                    </div>
                  </motion.div>
                )}

                {applicationStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Contact Information *
                      </label>
                      <input
                        type="text"
                        value={application.contactInfo}
                        onChange={(e) => setApplication({...application, contactInfo: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Email, Telegram, or Discord"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Website (Optional)
                        </label>
                        <input
                          type="url"
                          value={application.website}
                          onChange={(e) => setApplication({...application, website: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="https://yourwebsite.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Social Links (Optional)
                        </label>
                        <input
                          type="text"
                          value={application.socialLinks}
                          onChange={(e) => setApplication({...application, socialLinks: e.target.value})}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Twitter, Telegram, etc."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Target Audience (Optional)
                      </label>
                      <input
                        type="text"
                        value={application.targetAudience}
                        onChange={(e) => setApplication({...application, targetAudience: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Who is this product/service for?"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Key Benefits (Optional)
                      </label>
                      <textarea
                        value={application.benefits}
                        onChange={(e) => setApplication({...application, benefits: e.target.value})}
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="What are the main benefits of your product/service?"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Requirements (Optional)
                      </label>
                      <textarea
                        value={application.requirements}
                        onChange={(e) => setApplication({...application, requirements: e.target.value})}
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Any specific requirements or prerequisites?"
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={() => setApplicationStep(1)}
                        className="flex-1 px-6 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleApplicationSubmit}
                        disabled={isSubmitting || !application.contactInfo}
                        className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <FiCheckCircle className="w-5 h-5" />
                            Submit Application
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* My Applications Modal */}
      <AnimatePresence>
        {showMyApplicationsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <FiFileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                    My Applications
                  </h2>
                  <button
                    onClick={() => setShowMyApplicationsModal(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FiXCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
                <p className="text-gray-400 mt-2 text-sm sm:text-base">Track the status of your marketplace applications</p>
              </div>

              <div className="p-6">
                {myApplications.length === 0 ? (
                  <div className="text-center py-12">
                    <FiFileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400 text-base sm:text-lg">No applications yet</p>
                    <p className="text-gray-500 text-sm mt-2">Submit your first product application to get started</p>
                    <button
                      onClick={() => {
                        setShowMyApplicationsModal(false);
                        setShowApplicationModal(true);
                      }}
                      className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Submit Application
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myApplications.map((app) => (
                      <div key={app.id} className="bg-gray-700/30 rounded-lg border border-gray-600 p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold text-white">{app.productName}</h3>
                            <p className="text-gray-400 text-sm">{app.category}</p>
                          </div>
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(app.status)}`}>
                            {getStatusIcon(app.status)}
                            {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                          </span>
                        </div>
                        
                        <p className="text-gray-300 text-sm mb-3">{app.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Price:</span>
                            <p className="text-white font-medium">{app.price}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Duration:</span>
                            <p className="text-white font-medium">{app.duration}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Submitted:</span>
                            <p className="text-white font-medium">{app.submittedAt.toLocaleDateString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Contact:</span>
                            <p className="text-white font-medium">{app.contactInfo}</p>
                          </div>
                        </div>

                        {app.reviewNotes && (
                          <div className="mt-3 p-3 bg-gray-600/30 rounded border border-gray-500">
                            <span className="text-gray-400 text-sm">Review Notes:</span>
                            <p className="text-white text-sm mt-1">{app.reviewNotes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}


