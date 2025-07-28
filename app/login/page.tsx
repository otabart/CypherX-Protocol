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
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { UserIcon } from "@heroicons/react/24/solid";

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRedirect = "/"; // Home page as fallback
  const redirectParam = searchParams.get("redirect") || defaultRedirect;
  const { user, loading } = useAuth();

  // Form states
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Display name validation regex (aligned with isValidString in Firestore rules)
  const displayNameRegex = /^[a-zA-Z0-9\s\-_.,:;!?()@#]{1,50}$/;

  // Store current page in localStorage before navigating to /login
  useEffect(() => {
    if (!user && !loading) {
      const currentPath = window.location.pathname;
      if (currentPath !== "/login") {
        localStorage.setItem("lastPath", currentPath);
      }
    }
  }, [user, loading]);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      // Prioritize localStorage, then referer, then default
      const lastPath = localStorage.getItem("lastPath") || redirectParam;
      fetch("/api/referer")
        .then((res) => res.json())
        .then((data) => {
          let redirectTo = lastPath !== "/login" && lastPath !== "" ? lastPath : data.referer || defaultRedirect;
          if (redirectTo === "/login" || redirectTo === "" || redirectTo === "/account") {
            redirectTo = defaultRedirect;
          }
          router.push(redirectTo);
        })
        .catch(() => {
          let redirectTo = lastPath !== "/login" && lastPath !== "" ? lastPath : defaultRedirect;
          if (redirectTo === "/account") {
            redirectTo = defaultRedirect;
          }
          router.push(redirectTo);
        });
    }
  }, [user, loading, router, redirectParam]);

  // Handler for Google sign-in
  async function handleGoogleSignIn() {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!auth || !db) {
      setErrorMsg("Authentication or database service not initialized.");
      console.error("Auth or db object is null. Check firebase.ts initialization.");
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" }); // Force account selection
      console.log("Initiating Google sign-in...");
      const result = await signInWithPopup(auth, provider);
      console.log("Google sign-in result:", result);
      if (result.user) {
        console.log("Authenticated user:", result.user.uid, "Email:", result.user.email);
        const userDocRef = doc(db, "users", result.user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          const googleDisplayName = (
            result.user.displayName?.replace(/[^a-zA-Z0-9\s\-_.,:;!?()@#]/g, "") ||
            `user_${result.user.uid.slice(0, 8)}`
          ).slice(0, 50);
          if (!displayNameRegex.test(googleDisplayName)) {
            throw new Error("Generated Google display name is invalid.");
          }
          const userData = {
            email: result.user.email || "",
            displayName: googleDisplayName,
            photoURL: result.user.photoURL || "",
            createdAt: new Date().toISOString(),
            hasSeenTutorial: false,
            uid: result.user.uid,
            roles: {},
          };
          console.log("Writing Google user data:", userData);
          // Retry setDoc with exponential backoff
          let attempts = 0;
          const maxAttempts = 3;
          while (attempts < maxAttempts) {
            try {
              await setDoc(userDocRef, userData);
              console.log("Created user document for Google user:", result.user.uid);
              break;
            } catch (setDocError: any) {
              attempts++;
              console.error(`Attempt ${attempts} failed to write user document:`, {
                message: setDocError.message,
                code: setDocError.code,
                stack: setDocError.stack,
                userId: result.user.uid,
              });
              if (attempts === maxAttempts) {
                throw new Error("Failed to create user document after multiple attempts.");
              }
              await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempts)));
            }
          }
        } else {
          console.log("User document already exists:", result.user.uid);
        }
        // Redirect to previous page
        const lastPath = localStorage.getItem("lastPath") || redirectParam;
        const res = await fetch("/api/referer");
        const data = await res.json();
        let redirectTo = lastPath !== "/login" && lastPath !== "" ? lastPath : data.referer || defaultRedirect;
        if (redirectTo === "/login" || redirectTo === "" || redirectTo === "/account") {
          redirectTo = defaultRedirect;
        }
        router.push(redirectTo);
      }
    } catch (err: any) {
      console.error("Google sign-in error:", {
        message: err.message,
        code: err.code,
        stack: err.stack,
      });
      setErrorMsg(
        err.code === "auth/popup-blocked"
          ? "Google sign-in popup was blocked. Please allow popups and try again."
          : err.code === "auth/invalid-credential"
          ? "Invalid Google credentials. Please try again."
          : err.code === "auth/popup-closed-by-user"
          ? "Google sign-in was canceled. Please try again."
          : err.code === "firestore/permission-denied"
          ? "Permission denied to create user document. Check input or contact support."
          : err.message || "Failed to sign in with Google."
      );
    }
  }

  // Handler for form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!auth || !db) {
      setErrorMsg("Authentication or database service not initialized.");
      console.error("Auth or db object is null. Check firebase.ts initialization.");
      return;
    }

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        // Redirect to previous page
        const lastPath = localStorage.getItem("lastPath") || redirectParam;
        const res = await fetch("/api/referer");
        const data = await res.json();
        let redirectTo = lastPath !== "/login" && lastPath !== "" ? lastPath : data.referer || defaultRedirect;
        if (redirectTo === "/login" || redirectTo === "" || redirectTo === "/account") {
          redirectTo = defaultRedirect;
        }
        router.push(redirectTo);
      } else if (mode === "signup") {
        if (!displayName) {
          setErrorMsg("Please enter a display name.");
          return;
        }
        if (!displayNameRegex.test(displayName)) {
          setErrorMsg("Invalid display name format (1-50 characters, letters, numbers, or allowed symbols).");
          return;
        }
        if (password.length < 6) {
          setErrorMsg("Password must be at least 6 characters.");
          return;
        }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (result.user) {
          console.log("Authenticated user:", result.user.uid, "Email:", result.user.email);
          const userDocRef = doc(db, "users", result.user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            const userData = {
              email,
              displayName,
              photoURL: "",
              createdAt: new Date().toISOString(),
              hasSeenTutorial: false,
              uid: result.user.uid,
              roles: {},
            };
            console.log("Writing user data:", userData);
            // Retry setDoc with exponential backoff
            let attempts = 0;
            const maxAttempts = 3;
            while (attempts < maxAttempts) {
              try {
                await setDoc(userDocRef, userData);
                console.log("Created user document for email user:", result.user.uid);
                break;
              } catch (setDocError: any) {
                attempts++;
                console.error(`Attempt ${attempts} failed to write user document:`, {
                  message: setDocError.message,
                  code: setDocError.code,
                  stack: setDocError.stack,
                  userId: result.user.uid,
                });
                if (attempts === maxAttempts) {
                  throw new Error("Failed to create user document after multiple attempts.");
                }
                await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempts)));
              }
            }
          } else {
            console.log("User document already exists:", result.user.uid);
          }
          setSuccessMsg("Account created successfully!");
          setTimeout(async () => {
            const lastPath = localStorage.getItem("lastPath") || redirectParam;
            const res = await fetch("/api/referer");
            const data = await res.json();
            let redirectTo = lastPath !== "/login" && lastPath !== "" ? lastPath : data.referer || defaultRedirect;
            if (redirectTo === "/login" || redirectTo === "" || redirectTo === "/account") {
              redirectTo = defaultRedirect;
            }
            router.push(redirectTo);
          }, 1500);
        }
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Password reset email sent (if email is registered).");
        setMode("login");
      }
    } catch (err: any) {
      console.error(`${mode} error:`, {
        message: err.message,
        code: err.code,
        stack: err.stack,
        details: err.details || "No additional details",
      });
      setErrorMsg(
        err.code === "auth/invalid-credential"
          ? "Invalid email or password."
          : err.code === "auth/user-not-found"
          ? "No account found with this email."
          : err.code === "auth/email-already-in-use"
          ? "This email is already registered."
          : err.code === "firestore/permission-denied"
          ? "Permission denied. Check input or contact support."
          : err.message || "An error occurred."
      );
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
      <nav className="bg-gray-950 p-3 flex justify-between items-center sticky top-0 z-10 border-b border-blue-500/30">
        <div className="hidden sm:flex items-center space-x-2">
          <UserIcon className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-bold text-blue-400 uppercase">Account</h1>
        </div>
        <a
          href="/"
          className="text-gray-400 hover:text-blue-400 text-sm uppercase tracking-wide transition-colors duration-300"
        >
          Home
        </a>
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
                    className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm uppercase tracking-wide hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300"
                  >
                    Connect Wallet
                  </button>
                ) : chain?.unsupported ? (
                  <button
                    onClick={openChainModal}
                    className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm uppercase tracking-wide hover:bg-red-500/40 border border-red-500/30 transition-all duration-300"
                  >
                    Wrong Network
                  </button>
                ) : (
                  <button
                    onClick={openAccountModal}
                    className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm uppercase tracking-wide hover:bg-blue-500/40 border border-blue-500/30 transition-all duration-300"
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

      <header className="p-4 text-center">
        <motion.h2
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-xl md:text-2xl font-bold tracking-tight mb-1 uppercase text-blue-400"
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
          <span className="inline-block bg-blue-500/20 text-blue-400 px-4 py-2 rounded-full text-xs font-medium uppercase">
            Powered by Base
          </span>
        </motion.div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-6">
        <div className="w-full max-w-sm sm:max-w-md bg-gray-900 p-4 sm:p-6 rounded-xl shadow-lg border border-blue-500/30">
          <h3 className="text-xl sm:text-2xl font-bold mb-3 text-white text-center uppercase">
            {mode === "login"
              ? "Log In"
              : mode === "signup"
              ? "Sign Up"
              : "Reset Password"}
          </h3>

          {errorMsg && (
            <div className="mb-3 p-2 border border-red-500/30 bg-red-500/20 text-red-400 rounded-lg text-sm">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-3 p-2 border border-green-500/30 bg-green-500/20 text-green-400 rounded-lg text-sm">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {(mode === "login" || mode === "signup" || mode === "forgot") && (
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 block w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
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
                    className="mt-1 block w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-xs text-blue-400 hover:text-blue-600"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Choose a display name"
                  className="mt-1 block w-full border border-gray-700 rounded-lg px-3 py-2 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                />
              </div>
            )}

            {(mode === "login" || mode === "signup") && (
              <div className="text-xs text-gray-500">Let us know you're human</div>
            )}

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-blue-500/20 text-blue-400 font-medium uppercase tracking-wide hover:bg-blue-500/40 border border-blue-500/30 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 transition-all text-sm"
            >
              {mode === "login" && "Log In"}
              {mode === "signup" && "Sign Up"}
              {mode === "forgot" && "Send Reset Email"}
            </button>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-2 rounded-lg bg-gray-800 text-gray-200 font-medium uppercase tracking-wide hover:bg-gray-700 border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 transition-all text-sm"
            >
              Sign in with Google
            </button>
          </form>

          <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-2 text-xs sm:text-sm text-blue-400">
            {mode === "login" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="hover:underline hover:text-blue-600 transition-colors"
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="hover:underline hover:text-blue-600 transition-colors"
                >
                  Forgot Password?
                </button>
                <button
                  type="button"
                  onClick={() =>
                    alert("Please contact support or check your records.")
                  }
                  className="hover:underline hover:text-blue-600 transition-colors"
                >
                  Forgot Email?
                </button>
              </>
            )}
            {mode === "signup" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="hover:underline hover:text-blue-600 transition-colors"
              >
                Already have an account? Log In
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="hover:underline hover:text-blue-600 transition-colors"
              >
                Back to Log In
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="p-4 text-center text-gray-400 text-xs sm:text-sm border-t border-blue-500/30 bg-gray-950">
        <p>
          © 2025 Cypher Systems. Powered by{" "}
          <span className="text-blue-400">Base</span>.
        </p>
      </footer>
    </div>
  );
}