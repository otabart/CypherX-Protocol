"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, type Auth } from "firebase/auth";
import { doc, getDoc, query, collection, where, getDocs } from "firebase/firestore";
import { auth as firebaseAuth, db } from "@/lib/firebase";
import { useAuth } from "@/app/providers";
import { UserCircleIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import CustomConnectWallet from "./CustomConnectWallet";
import Link from "next/link";

const auth: Auth = firebaseAuth as Auth;

const UserProfileDropdown: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch user points from Firestore
  useEffect(() => {
    const fetchPoints = async () => {
      if (!user) {
        setPoints(null);
        return;
      }

      try {
        // Primary: Fetch by UID
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setPoints(userData.points ?? 0);
          return;
        }

        // Fallback: Fetch by email if UID-based document doesn't exist
        if (user.email) {
          const q = query(collection(db, "users"), where("email", "==", user.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            setPoints(userData.points ?? 0);
          } else {
            setPoints(0);
          }
        } else {
          setPoints(0);
        }
      } catch (error) {
        console.error("Error fetching user points:", error);
        setPoints(0);
      }
    };

    fetchPoints();
  }, [user]);

  // Handle click outside to close modal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showAccountModal && modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowAccountModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAccountModal]);

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
    setShowAccountModal(false);
  }

  const referralCode = user?.uid ? user.uid.slice(0, 6) : "";

  return (
    <div className="relative">
      <button
        onClick={() => setShowAccountModal((prev) => !prev)}
        className="flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-md hover:scale-105 transform"
        aria-label={user ? "Account" : "Sign In"}
      >
        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center transition-transform duration-300">
          <UserCircleIcon className="w-5 h-5 text-gray-100 hover:text-blue-300 transition-colors" />
        </div>
      </button>
      {showAccountModal && (
        <div
          ref={modalRef}
          className="absolute right-0 mt-3 w-64 bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 ease-out"
          style={{
            opacity: showAccountModal ? 1 : 0,
            transform: showAccountModal ? "translateY(0)" : "translateY(-10px)",
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <CustomConnectWallet />
            </div>
            <div className="bg-gray-800 p-3 rounded-lg border border-blue-500/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase font-medium text-blue-300">
                  Profile
                </span>
                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-100">Points</span>
                <span className="text-sm font-semibold text-blue-300">
                  {points !== null ? `${points} pts` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-semibold text-gray-100">
                  Referral Code
                </span>
                <div className="flex items-center">
                  <span className="text-sm font-semibold text-gray-100 mr-2">
                    {referralCode || "—"}
                  </span>
                  {referralCode && (
                    <button
                      onClick={() => navigator.clipboard.writeText(referralCode)}
                      className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded hover:bg-blue-500/40 transition-colors duration-150"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-gray-400 text-xs">
                <span>Rewards</span>
                <span>0 ⬢</span>
              </div>
            </div>
            <hr className="border-blue-500/30" />
            <ul className="space-y-2">
              <li>
                <Link
                  href="/vote"
                  className="block px-2 py-1 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  onClick={() => setShowAccountModal(false)}
                >
                  Vote
                </Link>
              </li>
              <li>
                <Link
                  href="/account"
                  className="block px-2 py-1 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  onClick={() => setShowAccountModal(false)}
                >
                  Account Settings
                </Link>
              </li>
            </ul>
            <hr className="border-blue-500/30" />
            <div className="text-center text-xs text-gray-400">
              Powered by Base
            </div>
            <hr className="border-blue-500/30" />
            <div>
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-2 py-2 text-sm text-gray-100 font-sans font-normal hover:text-red-400 hover:bg-red-500/20 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                >
                  Logout
                </button>
              ) : (
                <Link
                  href="/login"
                  className="block px-2 py-2 text-sm text-gray-100 font-sans font-normal hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  onClick={() => setShowAccountModal(false)}
                >
                  Login / Sign Up
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown;