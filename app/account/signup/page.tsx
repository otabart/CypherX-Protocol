"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, listenToAuthState } from "@/lib/firebase";

const COLORS = {
  white: "#FFFFFF",
  black: "#000000",
  gray: "#4A4A4A",
  coinbaseBlue: "#0052FF",
};

const styles: { [key: string]: React.CSSProperties } = {
  pageContainer: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    backgroundColor: COLORS.white,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    borderBottom: `1px solid ${COLORS.gray}`,
  },
  logo: {
    height: "30px",
  },
  headerLinks: {
    display: "flex",
    gap: "15px",
  },
  headerLink: {
    color: COLORS.black,
    textDecoration: "none",
    fontSize: "14px",
  },
  container: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },
  formContainer: {
    width: "100%",
    maxWidth: "400px",
    padding: "20px",
    border: `1px solid ${COLORS.gray}`,
    borderRadius: "8px",
    backgroundColor: COLORS.white,
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  formHeader: {
    fontSize: "24px",
    fontWeight: "bold",
    color: COLORS.black,
    textAlign: "center",
    marginBottom: "20px",
  },
  ssoButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "10px",
    marginBottom: "10px",
    border: `1px solid ${COLORS.gray}`,
    borderRadius: "4px",
    backgroundColor: COLORS.white,
    color: COLORS.black,
    fontSize: "16px",
    cursor: "pointer",
  },
  icon: {
    marginRight: "10px",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    textAlign: "center",
    margin: "20px 0",
    color: COLORS.gray,
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    backgroundColor: COLORS.gray,
  },
  dividerText: {
    margin: "0 10px",
  },
  input: {
    width: "100%",
    padding: "10px",
    marginBottom: "15px",
    border: `1px solid ${COLORS.gray}`,
    borderRadius: "4px",
    fontSize: "16px",
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  passwordContainer: {
    position: "relative",
  },
  showPassword: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    color: COLORS.gray,
    cursor: "pointer",
  },
  signupButton: {
    width: "100%",
    padding: "10px",
    backgroundColor: COLORS.coinbaseBlue,
    color: COLORS.white,
    border: "none",
    borderRadius: "4px",
    fontSize: "16px",
    cursor: "pointer",
    marginBottom: "15px",
  },
  loadingButton: {
    width: "100%",
    padding: "10px",
    backgroundColor: COLORS.gray,
    color: COLORS.white,
    border: "none",
    borderRadius: "4px",
    fontSize: "16px",
    cursor: "not-allowed",
    marginBottom: "15px",
  },
  links: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
  },
  link: {
    color: COLORS.coinbaseBlue,
    textDecoration: "none",
  },
  error: {
    color: "red",
    textAlign: "center",
    marginBottom: "15px",
  },
  footer: {
    borderTop: `1px solid ${COLORS.gray}`,
    padding: "10px 20px",
    textAlign: "center",
    fontSize: "12px",
    color: COLORS.gray,
  },
  footerLinks: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
    marginBottom: "5px",
  },
  footerLink: {
    color: COLORS.gray,
    textDecoration: "none",
  },
  privacyChoices: {
    color: COLORS.coinbaseBlue,
    textDecoration: "none",
  },
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<null | object>(null);
  const router = useRouter();

  // Redirect if already signed in
  useEffect(() => {
    const unsubscribe = listenToAuthState((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        router.push("/account/dashboard");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const ensureUserInFirestore = async (user: any) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });
    } else {
      // Update last login time
      await setDoc(userRef, { lastLoginAt: new Date().toISOString() }, { merge: true });
    }
  };

  const validatePasswordStrength = (pwd: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);

    if (pwd.length < minLength) {
      return "Password must be at least 8 characters long.";
    }
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.";
    }
    return null;
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Basic email validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    // Password validation
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await ensureUserInFirestore(userCredential.user);
      router.push("/account/dashboard");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("Email already in use. Please log in or use a different email.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address. Please check your email and try again.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use a stronger password.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Failed to sign up. Please try again.");
      }
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      await ensureUserInFirestore(userCredential.user);
      router.push("/account/dashboard");
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-up cancelled. Please try again.");
      } else {
        setError("Failed to sign up with Google. Please try again.");
      }
      setLoading(false);
    }
  };

  const handleAppleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      const userCredential = await signInWithPopup(auth, provider);
      await ensureUserInFirestore(userCredential.user);
      router.push("/account/dashboard");
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-up cancelled. Please try again.");
      } else {
        setError("Failed to sign up with Apple. Please try again.");
      }
      setLoading(false);
    }
  };

  if (user) {
    return <div>Redirecting...</div>;
  }

  return (
    <div style={styles.pageContainer}>
      <header style={styles.header}>
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Homebase Logo"
            width={120}
            height={30}
            style={styles.logo}
            priority
          />
        </Link>
        <div style={styles.headerLinks}>
          <Link href="/support" style={styles.headerLink}>
            Support
          </Link>
          <Link href="/language" style={styles.headerLink}>
            English
          </Link>
        </div>
      </header>

      <div style={styles.container}>
        <div style={styles.formContainer}>
          <h1 style={styles.formHeader}>Sign up for Homebase</h1>

          <button
            style={styles.ssoButton}
            onClick={handleGoogleSignup}
            disabled={loading}
            aria-label="Continue with Google"
          >
            <Image
              src="https://www.google.com/favicon.ico"
              alt="Google Icon"
              width={20}
              height={20}
              style={styles.icon}
            />
            Continue with Google
          </button>
          <button
            style={styles.ssoButton}
            onClick={handleAppleSignup}
            disabled={loading}
            aria-label="Continue with Apple"
          >
            <Image
              src="https://www.apple.com/favicon.ico"
              alt="Apple Icon"
              width={20}
              height={20}
              style={styles.icon}
            />
            Continue with Apple
          </button>

          <div style={styles.divider}>
            <div style={styles.dividerLine}></div>
            <span style={styles.dividerText}>OR</span>
            <div style={styles.dividerLine}></div>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <form onSubmit={handleEmailSignup}>
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
                aria-label="Email address"
              />
            </div>
            <div style={styles.passwordContainer}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
                aria-label="Password"
              />
              <span
                style={styles.showPassword}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </span>
            </div>
            <div style={styles.passwordContainer}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
                required
                aria-label="Confirm Password"
              />
            </div>
            <button
              type="submit"
              style={loading ? styles.loadingButton : styles.signupButton}
              disabled={loading}
              aria-label="Sign up with email and password"
            >
              {loading ? "Signing up..." : "Sign up"}
            </button>
          </form>

          <div style={styles.links}>
            <Link href="/account" style={styles.link}>
              Log in
            </Link>
            <Link href="/forgot-password" style={styles.link}>
              Forgot your password?
            </Link>
            <Link href="/forgot-email" style={styles.link}>
              Forgot your email?
            </Link>
          </div>
        </div>
      </div>

      <footer style={styles.footer}>
        <div style={styles.footerLinks}>
          <Link href="/support" style={styles.footerLink}>
            Support
          </Link>
          <Link href="/status" style={styles.footerLink}>
            System Status
          </Link>
          <Link href="/careers" style={styles.footerLink}>
            Careers
          </Link>
          <Link href="/terms" style={styles.footerLink}>
            Terms of Use
          </Link>
          <Link href="/security" style={styles.footerLink}>
            Report Security Issues
          </Link>
          <Link href="/privacy" style={styles.footerLink}>
            Privacy Policy
          </Link>
          <Link href="/privacy-choices" style={styles.privacyChoices}>
            Your Privacy Choices
          </Link>
        </div>
        <p>© 2025 Homebase, Inc.</p>
      </footer>
    </div>
  );
}