"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/app/providers";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { EyeIcon, EyeSlashIcon, ExclamationCircleIcon, CheckCircleIcon, EnvelopeIcon, UserCircleIcon, KeyIcon, ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// Custom CypherX text component with styled X
const CypherXText: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <span className={className}>
      <span className="text-blue-400">Cypher</span>
      <span className="text-blue-300 font-bold">X</span>
    </span>
  );
};

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectTo?: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, redirectTo = "/" }) => {
  const router = useRouter();
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

  // Add loading state
  const [loadingAction, setLoadingAction] = useState(false);

  // Add password strength state
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordStrengthLabel, setPasswordStrengthLabel] = useState("");

  // Password strength logic
  useEffect(() => {
    if (mode === "signup") {
      let score = 0;
      if (password.length >= 6) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;
      setPasswordStrength(score);
      setPasswordStrengthLabel([
        "Too weak",
        "Weak",
        "Medium",
        "Strong",
        "Very strong",
      ][score]);
    } else {
      setPasswordStrength(0);
      setPasswordStrengthLabel("");
    }
  }, [password, mode]);

  // Store current page in localStorage before opening modal
  useEffect(() => {
    if (isOpen && !user && !loading) {
      const currentPath = window.location.pathname;
      if (currentPath !== "/login") {
        localStorage.setItem("lastPath", currentPath);
      }
    }
  }, [isOpen, user, loading]);

  // Close modal and redirect if user logs in
  useEffect(() => {
    if (!loading && user && isOpen) {
      const lastPath = localStorage.getItem("lastPath") || redirectTo;
      const finalRedirect = lastPath !== "/login" && lastPath !== "" ? lastPath : redirectTo;
      if (finalRedirect === "/account") {
        router.push("/");
      } else {
        router.push(finalRedirect);
      }
      onClose();
    }
  }, [user, loading, isOpen, redirectTo, router, onClose]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode("login");
      setEmail("");
      setPassword("");
      setDisplayName("");
      setErrorMsg(null);
      setSuccessMsg(null);
      setShowPassword(false);
    }
  }, [isOpen]);

  // Handler for Google sign-in
  async function handleGoogleSignIn() {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction(true);

    if (!auth || !db) {
      setErrorMsg("Authentication or database service not initialized.");
      console.error("Auth or db object is null. Check firebase.ts initialization.");
      setLoadingAction(false);
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
            } catch (setDocError: unknown) {
              attempts++;
              const errorMessage = setDocError instanceof Error ? setDocError.message : "Unknown error";
              const errorCode = (setDocError as { code?: string })?.code || "unknown";
              const errorStack = setDocError instanceof Error ? setDocError.stack : "No stack trace";
              console.error(`Attempt ${attempts} failed to write user document:`, {
                message: errorMessage,
                code: errorCode,
                stack: errorStack,
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
        // Success - modal will close automatically via useEffect
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      const errorCode = (err as { code?: string })?.code || "unknown";
      const errorStack = err instanceof Error ? err.stack : "No stack trace";
      console.error("Google sign-in error:", {
        message: errorMessage,
        code: errorCode,
        stack: errorStack,
      });
      setErrorMsg(
        errorCode === "auth/popup-blocked"
          ? "Google sign-in popup was blocked. Please allow popups and try again."
          : errorCode === "auth/invalid-credential"
          ? "Invalid Google credentials. Please try again."
          : errorCode === "auth/popup-closed-by-user"
          ? "Google sign-in was canceled. Please try again."
          : errorCode === "firestore/permission-denied"
          ? "Permission denied to create user document. Check input or contact support."
          : errorMessage || "Failed to sign in with Google."
      );
    } finally {
      setLoadingAction(false);
    }
  }

  // Handler for form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction(true);

    if (!auth || !db) {
      setErrorMsg("Authentication or database service not initialized.");
      console.error("Auth or db object is null. Check firebase.ts initialization.");
      setLoadingAction(false);
      return;
    }

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        // Success - modal will close automatically via useEffect
      } else if (mode === "signup") {
        if (!displayName) {
          setErrorMsg("Please enter a display name.");
          setLoadingAction(false);
          return;
        }
        if (!displayNameRegex.test(displayName)) {
          setErrorMsg("Invalid display name format (1-50 characters, letters, numbers, or allowed symbols).");
          setLoadingAction(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg("Password must be at least 6 characters.");
          setLoadingAction(false);
          return;
        }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (result.user) {
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
            try {
              await setDoc(userDocRef, userData);
            } catch {
              setErrorMsg("Failed to create user profile. Please try again or contact support.");
              setLoadingAction(false);
              return;
            }
          }
          // Success - modal will close automatically via useEffect
        }
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Password reset email sent (if email is registered).");
        setMode("login");
      }
    } catch (err: unknown) {
      // Robust error handling for login/signup/forgot
      console.error(`${mode} error:`, err);
      let userMessage = "An error occurred.";
      if (err && typeof err === "object") {
        const errorCode = (err as { code?: string })?.code;
        const errorMessage = (err as { message?: string })?.message;
        if (errorCode === "auth/invalid-credential") userMessage = "Invalid email or password.";
        else if (errorCode === "auth/user-not-found") userMessage = "No account found with this email.";
        else if (errorCode === "auth/email-already-in-use") userMessage = "This email is already registered.";
        else if (typeof errorMessage === "string" && errorMessage.trim() !== "") userMessage = errorMessage;
      }
      setErrorMsg(userMessage);
    } finally {
      setLoadingAction(false);
    }
  }

  if (loading) {
    return null;
  }

  if (user) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-md mx-auto">
              <div className="bg-gray-900/95 shadow-2xl rounded-2xl px-4 py-8 sm:px-8 sm:py-10 border border-gray-800/20 flex flex-col items-center w-full max-w-sm sm:max-w-md mx-auto relative">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-lg transition-all duration-200"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>

                {/* Logo/Brand */}
                <div className="flex flex-col items-center mb-8">
                  <div className="mb-2">
                    <Image
                      src="https://i.imgur.com/MtLzgOQ.png"
                      alt="CypherX Logo"
                      width={48}
                      height={48}
                      className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                      priority
                    />
                  </div>
                  <h1 className="text-2xl font-extrabold tracking-tight italic leading-none">
                    <CypherXText />
                  </h1>
                  <span className="text-xs text-gray-400 tracking-wide mt-1">Welcome! Please log in or sign up</span>
                </div>

                {/* Tab Navigation */}
                <div className="flex w-full mb-8 rounded-lg overflow-hidden border border-blue-500/10 bg-gray-800">
                  {[{ key: "login", label: "Log In" }, { key: "signup", label: "Sign Up" }, { key: "forgot", label: "Forgot Password" }].map((tab, idx) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setMode(tab.key as typeof mode)}
                      className={`flex-1 py-2 text-xs sm:text-sm font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none ${mode === tab.key ? "bg-blue-500/20 text-blue-400 shadow-inner" : "text-gray-400 hover:text-blue-300"} ${idx !== 0 ? "border-l border-blue-500/10" : ""}`}
                      style={{ minWidth: 0 }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Animated Form Content */}
                <div className="w-full transition-all duration-300">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {(mode === "login" || mode === "signup" || mode === "forgot") && (
                      <div className="relative">
                        <EnvelopeIcon className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email"
                          className={`pl-10 pr-3 py-2 w-full border rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "border-red-500" : "border-gray-700"}`}
                        />
                        {email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && (
                          <ExclamationCircleIcon className="w-5 h-5 absolute right-3 top-3 text-red-400" />
                        )}
                      </div>
                    )}

                    {(mode === "login" || mode === "signup") && (
                      <div className="relative">
                        <KeyIcon className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className={`pl-10 pr-10 py-2 w-full border rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${mode === "signup" && password.length > 0 && password.length < 6 ? "border-red-500" : "border-gray-700"}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-blue-400"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                        </button>
                      </div>
                    )}

                    {mode === "signup" && (
                      <>
                        <div className="relative">
                          <UserCircleIcon className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                          <input
                            type="text"
                            required
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Display Name"
                            className={`pl-10 pr-3 py-2 w-full border rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${displayName && !displayNameRegex.test(displayName) ? "border-red-500" : "border-gray-700"}`}
                          />
                          {displayName && !displayNameRegex.test(displayName) && (
                            <ExclamationCircleIcon className="w-5 h-5 absolute right-3 top-3 text-red-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`h-2 w-2 rounded-full ${passwordStrength < 2 ? "bg-red-500" : passwordStrength < 3 ? "bg-yellow-400" : "bg-green-500"}`}></div>
                          <span className="text-xs text-gray-400">{passwordStrengthLabel}</span>
                          <span className="ml-auto text-xs text-gray-500">Min 6 chars, mix of letters, numbers, symbols</span>
                        </div>
                      </>
                    )}

                    {errorMsg && (
                      <div className="flex items-center gap-2 p-2 border border-red-500/30 bg-red-500/20 text-red-400 rounded-lg text-sm">
                        <ExclamationCircleIcon className="w-5 h-5" />
                        {errorMsg}
                      </div>
                    )}

                    {successMsg && (
                      <div className="flex items-center gap-2 p-2 border border-green-500/30 bg-green-500/20 text-green-400 rounded-lg text-sm">
                        <CheckCircleIcon className="w-5 h-5" />
                        {successMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-blue-500/80 text-white font-medium uppercase tracking-wide hover:bg-blue-600 border border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                      disabled={loadingAction || (mode === "signup" && (!email || !password || !displayName || !displayNameRegex.test(displayName) || password.length < 6)) || (mode === "login" && (!email || !password)) || (mode === "forgot" && !email)}
                    >
                      {loadingAction ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : null}
                      {mode === "login" && "Log In"}
                      {mode === "signup" && "Sign Up"}
                      {mode === "forgot" && "Send Reset Email"}
                    </button>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="w-full py-2 rounded-lg bg-white text-gray-800 font-medium uppercase tracking-wide hover:bg-blue-100 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                      disabled={loadingAction}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C36.68 2.7 30.74 0 24 0 14.82 0 6.71 5.8 2.69 14.09l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.59C43.98 37.13 46.1 31.3 46.1 24.55z"/><path fill="#FBBC05" d="M10.67 28.29a14.5 14.5 0 0 1 0-8.58l-7.98-6.2A23.94 23.94 0 0 0 0 24c0 3.93.94 7.65 2.69 10.91l7.98-6.2z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.15 15.9-5.85l-7.19-5.59c-2.01 1.35-4.59 2.15-8.71 2.15-6.38 0-11.87-3.63-14.33-8.79l-7.98 6.2C6.71 42.2 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
                      {loadingAction ? "Signing in..." : "Sign in with Google"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;
