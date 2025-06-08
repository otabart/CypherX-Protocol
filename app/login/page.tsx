// app/account/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "../providers";
import {
  query,
  collection,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { UserIcon } from "@heroicons/react/24/solid";

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "/account";
  const { user, loading } = useAuth();

  // Form states
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [useUsername, setUseUsername] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push(redirectParam);
    }
  }, [user, loading, router, redirectParam]);

  // Handler for Google sign-in
  async function handleGoogleSignIn() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!auth) {
      setErrorMsg("Authentication service not initialized.");
      console.error("Auth object is null. Check firebase.ts initialization.");
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push(redirectParam);
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      if (err.code === "auth/invalid-credential") {
        setErrorMsg("Invalid Google credentials. Try again or use another method.");
      } else {
        setErrorMsg("Failed to sign in with Google. Check console for details.");
      }
    }
  }

  // Handler for form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!auth) {
      setErrorMsg("Authentication service not initialized.");
      console.error("Auth object is null. Check firebase.ts initialization.");
      return;
    }

    try {
      if (mode === "login") {
        if (useUsername) {
          const q = query(
            collection(db, "users"),
            where("username", "==", username.toLowerCase())
          );
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            setErrorMsg("Username not found.");
            return;
          }
          const userData = querySnapshot.docs[0].data();
          if (!userData.email) {
            setErrorMsg("No email found for this username.");
            return;
          }
          await signInWithEmailAndPassword(auth, userData.email, password);
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
        router.push(redirectParam);
      } else if (mode === "signup") {
        if (!username) {
          setErrorMsg("Please enter a username.");
          return;
        }
        if (password.length < 6) {
          setErrorMsg("Password must be at least 6 characters.");
          return;
        }
        const q = query(
          collection(db, "users"),
          where("username", "==", username.toLowerCase())
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setErrorMsg("Username is already taken.");
          return;
        }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", result.user.uid), {
          email,
          username: username.toLowerCase(),
          displayName: username,
          photoURL: "",
          createdAt: serverTimestamp(),
        });
        setSuccessMsg("Account created successfully!");
        setTimeout(() => {
          router.push(redirectParam);
        }, 1500);
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Password reset email sent (if that email is registered).");
        setMode("login");
      }
    } catch (err: any) {
      console.error(`${mode} error:`, err);
      if (err.code === "auth/invalid-credential") {
        setErrorMsg("Invalid email/username or password. Please try again.");
      } else if (err.code === "auth/user-not-found") {
        setErrorMsg("No account found with this email/username.");
      } else if (err.code === "auth/email-already-in-use") {
        setErrorMsg("This email is already registered.");
      } else if (err.code === "firestore/permission-denied") {
        setErrorMsg("Permission denied. Please contact support.");
      } else {
        setErrorMsg(err.message || "An error occurred. Check console for details.");
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-200 px-4">
        Checking authentication...
      </div>
    );
  }
  if (user) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans flex flex-col">
      {/* NavBar */}
      <nav className="bg-gray-950 p-3 flex justify-between items-center sticky top-0 z-10 border-b border-[#0052FF]/30">
        {/* Hidden on mobile */}
        <div className="hidden sm:flex items-center space-x-2">
          <UserIcon className="h-6 w-6 text-[#0052FF]" />
          <h1 className="text-xl font-bold text-[#0052FF] uppercase">Account</h1>
        </div>

        {/* Always visible: Home link */}
        <a
          href="/"
          className="text-gray-400 hover:text-[#0052FF] text-sm uppercase tracking-wide transition-colors duration-300"
        >
          Home
        </a>

        {/* Connect Wallet button */}
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openConnectModal,
            openChainModal,
            openAccountModal,
            mounted,
          }) => {
            const connected = mounted && account && chain;
            return (
              <div>
                {!connected ? (
                  <button
                    onClick={openConnectModal}
                    className="bg-[#0052FF]/20 text-[#0052FF] text-sm uppercase tracking-wide px-3 py-1 rounded-lg hover:bg-[#0052FF]/40 border border-[#0052FF]/30 transition-all duration-300"
                  >
                    Connect Wallet
                  </button>
                ) : chain?.unsupported ? (
                  <button
                    onClick={openChainModal}
                    className="bg-red-500/20 text-red-400 text-sm uppercase tracking-wide px-3 py-1 rounded-lg hover:bg-red-500/40 border border-red-500/30 transition-all duration-300"
                  >
                    Wrong Network
                  </button>
                ) : (
                  <button
                    onClick={openAccountModal}
                    className="bg-[#0052FF]/20 text-[#0052FF] text-sm uppercase tracking-wide px-3 py-1 rounded-lg hover:bg-[#0052FF]/40 border border-[#0052FF]/30 transition-all duration-300"
                  >
                    {account.displayName ||
                      `${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
                  </button>
                )}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </nav>

      {/* Hero Section */}
      <header className="p-4 text-center">
        <motion.h2
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-xl md:text-2xl font-bold tracking-tight mb-1 uppercase text-[#0052FF]"
        >
          Manage Your Account
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-gray-400 text-sm md:text-base max-w-lg mx-auto px-2"
        >
          Log in or sign up to access your profile, voting rights, referral code, and more.
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-3"
        >
          <span className="inline-block bg-[#0052FF]/20 text-[#0052FF] px-3 py-1 rounded-full text-xs font-medium uppercase">
            Powered by Base
          </span>
        </motion.div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-6">
        <div className="w-full max-w-sm sm:max-w-md bg-gray-900 p-4 sm:p-6 rounded-xl shadow-lg border border-[#0052FF]/30">
          <h3 className="text-xl sm:text-2xl font-bold mb-3 text-white text-center uppercase">
            {mode === "login"
              ? "Log In"
              : mode === "signup"
              ? "Sign Up"
              : "Reset Password"}
          </h3>

          {errorMsg && (
            <div className="mb-3 p-2 border border-red-500 bg-red-900/30 text-red-300 rounded-lg text-sm">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-3 p-2 border border-green-500 bg-green-900/30 text-green-300 rounded-lg text-sm">
              {successMsg}
            </div>
          )}

          {/* Toggle username login */}
          {mode === "login" && (
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                checked={useUsername}
                onChange={() => setUseUsername(!useUsername)}
                id="toggleUsername"
                className="mr-2 accent-[#0052FF] rounded"
              />
              <label htmlFor="toggleUsername" className="text-sm text-gray-300">
                Login with Username
              </label>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {(mode === "login" || mode === "signup" || mode === "forgot") && (
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  {useUsername && mode === "login" ? "Username" : "Email"}
                </label>
                <input
                  type={useUsername && mode === "login" ? "text" : "email"}
                  required
                  value={useUsername && mode === "login" ? username : email}
                  onChange={(e) => {
                    if (useUsername && mode === "login") {
                      setUsername(e.target.value);
                    } else {
                      setEmail(e.target.value);
                    }
                  }}
                  placeholder={
                    useUsername && mode === "login"
                      ? "yourusername"
                      : "you@example.com"
                  }
                  className="mt-1 block w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0052FF] transition-all text-sm"
                />
              </div>
            )}

            {(mode === "login" || mode === "signup") && (
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 block w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0052FF] transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-xs text-[#0052FF] hover:text-[#0033CC]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a unique username"
                  className="mt-1 block w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0052FF] transition-all text-sm"
                />
              </div>
            )}

            {(mode === "login" || mode === "signup") && (
              <div className="text-xs text-gray-500">Let us know you're human</div>
            )}

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-gradient-to-r from-[#0052FF] to-[#0033CC] text-white font-medium hover:from-[#0033CC] hover:to-[#0022AA] focus:ring-2 focus:ring-[#0052FF] focus:ring-offset-2 focus:ring-offset-black transition-all text-sm"
            >
              {mode === "login" && "Log In"}
              {mode === "signup" && "Sign Up"}
              {mode === "forgot" && "Send Reset Email"}
            </button>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-2 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 focus:ring-2 focus:ring-[#0052FF] focus:ring-offset-2 focus:ring-offset-black transition-all text-sm"
            >
              Sign in with Google
            </button>
          </form>

          <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-2 text-xs sm:text-sm text-[#0052FF]">
            {mode === "login" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="hover:underline hover:text-[#0033CC] transition-colors"
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="hover:underline hover:text-[#0033CC] transition-colors"
                >
                  Forgot Password?
                </button>
                <button
                  type="button"
                  onClick={() =>
                    alert("Please contact support or check your records.")
                  }
                  className="hover:underline hover:text-[#0033CC] transition-colors"
                >
                  Forgot Email?
                </button>
              </>
            )}
            {mode === "signup" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="hover:underline hover:text-[#0033CC] transition-colors"
              >
                Already have an account? Log In
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="hover:underline hover:text-[#0033CC] transition-colors"
              >
                Back to Log In
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-gray-400 text-xs sm:text-sm border-t border-[#0052FF]/30 bg-gray-950">
        <p>
          © 2025 Cypher Systems. Powered by{" "}
          <span className="text-[#0052FF]">Base</span>.
        </p>
      </footer>
    </div>
  );
}


















