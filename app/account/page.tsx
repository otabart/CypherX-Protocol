"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FiUser, FiBell, FiShield, FiDownload, FiCamera, FiX } from "react-icons/fi";
import { HiOutlineKey } from "react-icons/hi";
import Image from "next/image";
import { useAuth, useWalletSystem } from "@/app/providers";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { toast } from "react-hot-toast";
import { useUserSettings } from "@/app/hooks/useUserSettings";

interface UserSettings {
  displayName: string;
  email: string;
  bio: string;
  profilePicture: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    trading: boolean;
    news: boolean;
  };
  privacy: {
    showProfile: boolean;
    showTrades: boolean;
    showBalance: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
  };
}

export default function AccountPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selfCustodialWallet } = useWalletSystem();
  const { generateReferralCode } = useUserSettings();
  const [activeTab, setActiveTab] = useState('profile');

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [settings, setSettings] = useState<UserSettings>({
    displayName: '',
    email: '',
    bio: '',
    profilePicture: '',
    theme: 'dark',
    notifications: {
      email: true,
      push: true,
      trading: true,
      news: false,
    },
    privacy: {
      showProfile: true,
      showTrades: true,
      showBalance: false,
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: 30,
    },
  });

  // Load user settings
  useEffect(() => {
    const loadUserSettings = async () => {
      if (!user) return;
      
      try {
        console.log('🔍 Loading user settings for:', user.uid);
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('✅ User data loaded:', userData);
          
          setSettings(prev => ({
            ...prev,
            displayName: userData.displayName || user.displayName || '',
            email: userData.email || user.email || '',
            bio: userData.bio || '',
            profilePicture: userData.profilePicture || userData.photoURL || '',
            theme: userData.theme || 'dark',
            notifications: {
              email: userData.notifications?.email ?? true,
              push: userData.notifications?.push ?? true,
              trading: userData.notifications?.trading ?? true,
              news: userData.notifications?.news ?? false,
            },
            privacy: {
              showProfile: userData.privacy?.showProfile ?? true,
              showTrades: userData.privacy?.showTrades ?? true,
              showBalance: userData.privacy?.showBalance ?? false,
            },
            security: {
              twoFactorEnabled: userData.security?.twoFactorEnabled ?? false,
              sessionTimeout: userData.security?.sessionTimeout ?? 30,
            },
          }));
          console.log('✅ Settings updated with loaded data');
        } else {
          console.log('❌ User document not found');
        }
      } catch (error) {
        console.error("❌ Error loading user settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Add a small delay to ensure the user document is created by the providers
    const timer = setTimeout(loadUserSettings, 500);
    return () => clearTimeout(timer);
  }, [user]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `profile-pictures/${user.uid}/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setSettings(prev => ({ ...prev, profilePicture: downloadURL }));
      toast.success('Profile picture updated successfully!');
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      console.log('💾 Saving settings for user:', user.uid);
      console.log('📋 Settings to save:', settings);
      
      const updateData = {
        displayName: settings.displayName,
        bio: settings.bio,
        profilePicture: settings.profilePicture,
        theme: settings.theme,
        notifications: settings.notifications,
        privacy: settings.privacy,
        security: settings.security,
        updatedAt: new Date(),
      };
      
      console.log('📤 Update data:', updateData);
      
      await updateDoc(doc(db, "users", user.uid), updateData);
      
      console.log('✅ Settings saved successfully');
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error("❌ Error saving settings:", error);
      console.error("Error details:", {
        user: user?.uid,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      
      const exportData = {
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          ...userData,
        },
        wallet: selfCustodialWallet ? {
          address: selfCustodialWallet.address,
        } : null,
        exportDate: new Date().toISOString(),
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cypherx-data-${user.uid}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Data exported successfully!');
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error('Failed to export data');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
    
    try {
      // Delete user data from Firestore
      await updateDoc(doc(db, "users", user.uid), {
        deletedAt: new Date(),
        isDeleted: true,
      });
      
      toast.success('Account deleted successfully');
      router.push('/login');
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error('Failed to delete account');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FiUser },
    { id: 'notifications', label: 'Notifications', icon: FiBell },
    { id: 'privacy', label: 'Privacy', icon: FiShield },
    { id: 'security', label: 'Security', icon: HiOutlineKey },
    { id: 'appearance', label: 'Appearance', icon: FiShield },
    { id: 'referrals', label: 'Referrals', icon: FiUser },
    { id: 'data', label: 'Data & Export', icon: FiDownload },
  ];

  if (!user) {
    router.push('/login');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading account settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold">Account Settings</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Profile Tab */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                      <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
                      
                      {/* Profile Picture */}
                      <div className="flex items-center space-x-6 mb-6">
                        <div className="relative">
                          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-800 border-2 border-gray-700">
                            {settings.profilePicture ? (
                              <Image
                                src={settings.profilePicture}
                                alt="Profile"
                                width={96}
                                height={96}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FiUser className="w-12 h-12 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full flex items-center justify-center transition-colors"
                          >
                            <FiCamera className="w-4 h-4" />
                          </button>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium mb-2">Profile Picture</h3>
                          <p className="text-gray-400 text-sm mb-3">
                            Upload a profile picture to personalize your account
                          </p>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
                          >
                            {uploadingImage ? 'Uploading...' : 'Upload Image'}
                          </button>
                        </div>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />

                      {/* Display Name */}
                      <div className="mb-4">
                        <label className="block text-gray-300 text-sm font-medium mb-2">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={settings.displayName}
                          onChange={(e) => setSettings(prev => ({ ...prev, displayName: e.target.value }))}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter your display name"
                        />
                      </div>

                      {/* Bio */}
                      <div className="mb-4">
                        <label className="block text-gray-300 text-sm font-medium mb-2">
                          Bio
                        </label>
                        <textarea
                          value={settings.bio}
                          onChange={(e) => setSettings(prev => ({ ...prev, bio: e.target.value }))}
                          rows={3}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          placeholder="Tell us about yourself..."
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-gray-300 text-sm font-medium mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={settings.email}
                          disabled
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
                        />
                        <p className="text-gray-500 text-xs mt-1">
                          Email address cannot be changed from this page
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                  <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    <h2 className="text-xl font-semibold mb-6">Notification Preferences</h2>
                    
                    <div className="space-y-4">
                      {Object.entries(settings.notifications).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                          <div>
                            <h3 className="font-medium text-white capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </h3>
                            <p className="text-gray-400 text-sm">
                              Receive notifications about {key.toLowerCase()} activities
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                notifications: {
                                  ...prev.notifications,
                                  [key]: e.target.checked
                                }
                              }))}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Privacy Tab */}
                {activeTab === 'privacy' && (
                  <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    <h2 className="text-xl font-semibold mb-6">Privacy Settings</h2>
                    
                    <div className="space-y-4">
                      {Object.entries(settings.privacy).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                          <div>
                            <h3 className="font-medium text-white capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </h3>
                            <p className="text-gray-400 text-sm">
                              Allow others to see your {key.toLowerCase()}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                privacy: {
                                  ...prev.privacy,
                                  [key]: e.target.checked
                                }
                              }))}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                  <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    <h2 className="text-xl font-semibold mb-6">Security Settings</h2>
                    
                    <div className="space-y-6">
                      {/* Two-Factor Authentication */}
                      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                        <div>
                          <h3 className="font-medium text-white">Two-Factor Authentication</h3>
                          <p className="text-gray-400 text-sm">
                            Add an extra layer of security to your account
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.security.twoFactorEnabled}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              security: {
                                ...prev.security,
                                twoFactorEnabled: e.target.checked
                              }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {/* Session Timeout */}
                      <div className="p-4 bg-gray-800/50 rounded-lg">
                        <h3 className="font-medium text-white mb-2">Session Timeout</h3>
                        <p className="text-gray-400 text-sm mb-4">
                          Automatically log out after inactivity
                        </p>
                        <select
                          value={settings.security.sessionTimeout}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            security: {
                              ...prev.security,
                              sessionTimeout: parseInt(e.target.value)
                            }
                          }))}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={120}>2 hours</option>
                          <option value={0}>Never</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Appearance Tab */}
                {activeTab === 'appearance' && (
                  <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    <h2 className="text-xl font-semibold mb-6">Appearance Settings</h2>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-800/50 rounded-lg">
                        <h3 className="font-medium text-white mb-2">Theme</h3>
                        <p className="text-gray-400 text-sm mb-4">
                          Choose your preferred theme
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          {['light', 'dark', 'auto'].map((theme) => (
                            <button
                              key={theme}
                              onClick={() => setSettings(prev => ({ ...prev, theme: theme as 'light' | 'dark' | 'auto' }))}
                              className={`p-4 rounded-lg border-2 transition-all ${
                                settings.theme === theme
                                  ? 'border-blue-500 bg-blue-500/20'
                                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                              }`}
                            >
                              <div className="text-center">
                                <div className={`w-8 h-8 rounded mx-auto mb-2 ${
                                  theme === 'light' ? 'bg-white border border-gray-300' :
                                  theme === 'dark' ? 'bg-gray-800 border border-gray-600' :
                                  'bg-gradient-to-r from-gray-800 to-white border border-gray-600'
                                }`}></div>
                                <span className="text-sm font-medium capitalize">{theme}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Referrals Tab */}
                {activeTab === 'referrals' && (
                  <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    <h2 className="text-xl font-semibold mb-6">Referral Program</h2>
                    
                    <div className="space-y-6">
                      {/* Your Referral Code */}
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <h3 className="text-white font-medium mb-3">Your Referral Code</h3>
                        <div className="text-center">
                          <p className="text-gray-400 text-sm mb-3">Generate a referral code to start earning rewards</p>
                          <button
                            onClick={generateReferralCode}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Generate Code
                          </button>
                        </div>
                      </div>

                      {/* Referral Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-blue-400">0</div>
                          <div className="text-gray-400 text-sm">Total Referrals</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-green-400">$0.00</div>
                          <div className="text-gray-400 text-sm">Total Earnings</div>
                        </div>
                      </div>

                      {/* How It Works */}
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <h3 className="text-white font-medium mb-3">How It Works</h3>
                        <div className="space-y-2 text-sm text-gray-300">
                          <p>• Share your referral code with friends</p>
                          <p>• They get 5% off swap fees when they sign up</p>
                          <p>• You earn rewards when they complete their first swap</p>
                          <p>• Track your earnings and referral status here</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Data & Export Tab */}
                {activeTab === 'data' && (
                  <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                    <h2 className="text-xl font-semibold mb-6">Data & Export</h2>
                    
                    <div className="space-y-6">
                      {/* Export Data */}
                      <div className="p-4 bg-gray-800/50 rounded-lg">
                        <h3 className="font-medium text-white mb-2">Export Your Data</h3>
                        <p className="text-gray-400 text-sm mb-4">
                          Download a copy of your account data including profile, settings, and activity
                        </p>
                        <button
                          onClick={handleExportData}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                          Export Data
                        </button>
                      </div>

                      {/* Delete Account */}
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <h3 className="font-medium text-red-400 mb-2">Delete Account</h3>
                        <p className="text-gray-400 text-sm mb-4">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                        <button
                          onClick={handleDeleteAccount}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        >
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
