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
import { auth, db } from "@/lib/firebase"; // Adjust if needed
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
  const [email, setEmail] = useState(""); // used for email login
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // used for username login/sign-up
  const [showPassword, setShowPassword] = useState(false);
  const [useUsername, setUseUsername] = useState(false); // toggle for username login

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
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push(redirectParam);
    } catch (err) {
      console.error("Google sign-in error:", err);
      setErrorMsg("Failed to sign in with Google. Check console for more info.");
    }
  }

  // Handler for form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === "login") {
        if (useUsername) {
          // Query Firestore for the document with the provided username
          const q = query(
            collection(db, "users"),
            where("username", "==", username)
          );
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            setErrorMsg("Username not found.");
            return;
          }
          // Assume username is unique; get the first document's email
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
        // In sign-up mode, require a unique username
        if (!username) {
          setErrorMsg("Please enter a username.");
          return;
        }
        // Optionally, check if username already exists:
        const q = query(
          collection(db, "users"),
          where("username", "==", username)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setErrorMsg("Username is already taken.");
          return;
        }
        // Create the user with email/password
        const result = await createUserWithEmailAndPassword(auth, email, password);
        // After account creation, store additional fields in Firestore
        await setDoc(doc(db, "users", result.user.uid), {
          email,
          username,
          displayName: username, // Or prompt the user separately for a display name
          photoURL: "", // You may set a default photo URL here
          createdAt: serverTimestamp(),
        });
        setSuccessMsg("Account created successfully!");
        setTimeout(() => {
          router.push(redirectParam);
        }, 1500);
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent (if that email is registered).");
        setMode("login");
      }
    } catch (err: any) {
      console.error(`${mode} error:`, err);
      setErrorMsg(err.message || "An error occurred. Check console for details.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        Checking authentication...
      </div>
    );
  }
  if (user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between bg-white">
        <div className="flex items-center space-x-2">
          <svg className="h-6 w-6 text-orange-500" fill="currentColor" viewBox="0 0 512 512">
            <path d="M..." />
          </svg>
          <span className="text-gray-800 font-semibold text-lg">Homebase</span>
        </div>
        <nav className="flex items-center space-x-4 text-sm text-gray-600">
          <a href="#" className="hover:underline">Support</a>
          <a href="#" className="hover:underline">English</a>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white p-8 border rounded-md shadow-sm">
          <h1 className="text-2xl font-bold mb-6">
            {mode === "login"
              ? "Log in to Homebase"
              : mode === "signup"
              ? "Sign up for Homebase"
              : "Reset your Password"}
          </h1>

          {errorMsg && (
            <div className="mb-4 p-3 border border-red-400 bg-red-50 text-red-700 rounded">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 border border-green-400 bg-green-50 text-green-700 rounded">
              {successMsg}
            </div>
          )}

          {/* Option to toggle username login */}
          {mode === "login" && (
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                checked={useUsername}
                onChange={() => setUseUsername(!useUsername)}
                id="toggleUsername"
                className="mr-2"
              />
              <label htmlFor="toggleUsername" className="text-sm text-gray-700">
                Login with Username
              </label>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {(mode === "login" || mode === "signup" || mode === "forgot") && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {useUsername && mode === "login" ? "Username" : "Email"}
                </label>
                <input
                  type="email"
                  required={!useUsername}
                  value={useUsername && mode === "login" ? username : email}
                  onChange={(e) => {
                    if (useUsername && mode === "login") {
                      setUsername(e.target.value);
                    } else {
                      setEmail(e.target.value);
                    }
                  }}
                  placeholder={useUsername && mode === "login" ? "yourusername" : "you@example.com"}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {(mode === "login" || mode === "signup") && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 pr-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a unique username"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {(mode === "login" || mode === "signup") && (
              <div className="text-sm text-gray-500">Let us know you&apos;re human</div>
            )}

            <button
              type="submit"
              className="mt-2 w-full py-2 rounded-md bg-blue-500 text-white font-medium hover:bg-blue-600"
            >
              {mode === "login" && "Log in"}
              {mode === "signup" && "Sign up"}
              {mode === "forgot" && "Send reset email"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-blue-600">
            {mode === "login" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="hover:underline"
                >
                  Sign up
                </button>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="hover:underline"
                >
                  Forgot your password?
                </button>
                <button
                  type="button"
                  onClick={() =>
                    alert("Please contact support or check your records.")
                  }
                  className="hover:underline"
                >
                  Forgot your email?
                </button>
              </>
            )}
            {mode === "signup" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="hover:underline"
              >
                Already have an account? Log in
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="hover:underline"
              >
                Back to login
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t bg-white">
        <div className="max-w-screen-xl mx-auto py-4 px-4 flex flex-col md:flex-row items-center md:justify-between text-sm text-gray-600 space-y-2 md:space-y-0">
          <div className="space-x-3">
            <a href="#" className="hover:underline">
              Support
            </a>
            <a href="#" className="hover:underline">
              System Status
            </a>
            <a href="#" className="hover:underline">
              Careers
            </a>
            <a href="#" className="hover:underline">
              Terms of Use
            </a>
            <a href="#" className="hover:underline">
              Report Security Issues
            </a>
            <a href="#" className="hover:underline">
              Privacy Policy
            </a>
          </div>
          <div className="text-gray-400">
            © {new Date().getFullYear()} Homebase, Inc.
          </div>
        </div>
      </footer>
    </div>
  );
}














