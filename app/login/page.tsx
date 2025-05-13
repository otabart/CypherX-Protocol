"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function LoginPage() {
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
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Checking authentication...
      </div>
    );
  }
  if (user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-black text-white font-sans">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between bg-black">
        <div className="flex items-center space-x-3">
          <svg className="h-8 w-8 text-[#0052FF]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" />
          </svg>
          <span className="text-white text-xl font-bold">Cypher</span>
        </div>
        <nav className="flex items-center space-x-6 text-sm text-gray-400">
          <a href="#" className="hover:text-[#0052FF] transition-colors">Support</a>
          <a href="#" className="hover:text-[#0052FF] transition-colors">English</a>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center bg-black px-4">
        <div className="w-full max-w-md bg-black p-8 rounded-xl shadow-lg border border-gray-800">
          <h1 className="text-3xl font-bold mb-6 text-white">
            {mode === "login"
              ? "Log in to Cypher"
              : mode === "signup"
              ? "Sign up for Cypher"
              : "Reset your Password"}
          </h1>

          {errorMsg && (
            <div className="mb-6 p-4 border border-red-500 bg-red-900/30 text-red-300 rounded-lg">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-4 border border-green-500 bg-green-900/30 text-green-300 rounded-lg">
              {successMsg}
            </div>
          )}

          {/* Option to toggle username login */}
          {mode === "login" && (
            <div className="flex items-center mb-6">
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

          <form onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder={useUsername && mode === "login" ? "yourusername" : "you@example.com"}
                  className="mt-1 block w-full border border-gray-700 rounded-lg px-4 py-3 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0052FF] transition-all"
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
                    className="mt-1 block w-full border border-gray-700 rounded-lg px-4 py-3 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0052FF] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-sm text-[#0052FF] hover:text-[#0033CC]"
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
                  className="mt-1 block w-full border border-gray-700 rounded-lg px-4 py-3 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0052FF] transition-all"
                />
              </div>
            )}

            {(mode === "login" || mode === "signup") && (
              <div className="text-sm text-gray-500">Let us know you're human</div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-gradient-to-r from-[#0052FF] to-[#0033CC] text-white font-medium hover:from-[#0033CC] hover:to-[#0022AA] focus:ring-2 focus:ring-[#0052FF] focus:ring-offset-2 focus:ring-offset-black transition-all"
            >
              {mode === "login" && "Log in"}
              {mode === "signup" && "Sign up"}
              {mode === "forgot" && "Send reset email"}
            </button>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-3 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 focus:ring-2 focus:ring-[#0052FF] focus:ring-offset-2 focus:ring-offset-black transition-all"
            >
              Sign in with Google
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-4 text-sm text-[#0052FF]">
            {mode === "login" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="hover:underline hover:text-[#0033CC] transition-colors"
                >
                  Sign up
                </button>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="hover:underline hover:text-[#0033CC] transition-colors"
                >
                  Forgot your password?
                </button>
                <button
                  type="button"
                  onClick={() => alert("Please contact support or check your records.")}
                  className="hover:underline hover:text-[#0033CC] transition-colors"
                >
                  Forgot your email?
                </button>
              </>
            )}
            {mode === "signup" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="hover:underline hover:text-[#0033CC] transition-colors"
              >
                Already have an account? Log in
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="hover:underline hover:text-[#0033CC] transition-colors"
              >
                Back to login
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-800 bg-black">
        <div className="max-w-screen-xl mx-auto py-6 px-6 flex flex-col md:flex-row items-center md:justify-between text-sm text-gray-400 space-y-4 md:space-y-0">
          <div className="space-x-4">
            <a href="#" className="hover:text-[#0052FF] transition-colors">Support</a>
            <a href="#" className="hover:text-[#0052FF] transition-colors">System Status</a>
            <a href="#" className="hover:text-[#0052FF] transition-colors">Careers</a>
            <a href="#" className="hover:text-[#0052FF] transition-colors">Terms of Use</a>
            <a href="#" className="hover:text-[#0052FF] transition-colors">Report Security Issues</a>
            <a href="#" className="hover:text-[#0052FF] transition-colors">Privacy Policy</a>
          </div>
          <div className="text-gray-500">
            © {new Date().getFullYear()} Cypher, Inc.
          </div>
        </div>
      </footer>
    </div>
  );
}














