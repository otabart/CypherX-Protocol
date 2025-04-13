"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, updateProfile, updatePassword } from "firebase/auth";
import { auth, storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";

// Define colors for consistent theming
const COLORS = {
  white: "#FFFFFF",
  black: "#000000",
  gray: "#4A4A4A",
  coinbaseBlue: "#0052FF",
  lightGray: "#F5F5F5",
};

// Updated styles with refined design
const styles: { [key: string]: React.CSSProperties } = {
  pageContainer: {
    display: "flex",
    flexDirection: "row",
    minHeight: "100vh",
    backgroundColor: COLORS.white,
  },
  sidebar: {
    width: "250px",
    backgroundColor: COLORS.white,
    borderRight: `1px solid ${COLORS.gray}`,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sidebarItem: {
    padding: "10px 15px",
    color: COLORS.black,
    textDecoration: "none",
    fontSize: "16px",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  sidebarItemActive: {
    backgroundColor: COLORS.coinbaseBlue,
    color: COLORS.white,
  },
  mainContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    borderBottom: `1px solid ${COLORS.gray}`,
    backgroundColor: COLORS.white,
  },
  logo: {
    height: "24px", // Reduced logo size
  },
  headerLinks: {
    display: "flex",
    gap: "15px",
  },
  headerLink: {
    color: COLORS.black,
    textDecoration: "none",
    fontSize: "14px",
    padding: "5px 10px",
    borderRadius: "4px",
    transition: "background-color 0.2s",
  },
  container: {
    flex: 1,
    padding: "30px",
    display: "flex",
    justifyContent: "center",
  },
  dashboardContainer: {
    width: "100%",
    maxWidth: "800px",
    padding: "30px",
    borderRadius: "8px",
    backgroundColor: COLORS.white,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
  },
  headerText: {
    fontSize: "22px",
    fontWeight: "600",
    color: COLORS.black,
    marginBottom: "20px",
  },
  profileSection: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    marginBottom: "30px",
    flexDirection: "row",
  },
  profileImage: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    backgroundColor: COLORS.lightGray,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "40px",
    objectFit: "cover",
  },
  profileDetails: {
    flex: 1,
  },
  infoText: {
    fontSize: "14px",
    color: COLORS.gray,
    marginBottom: "5px",
  },
  subsection: {
    marginTop: "30px",
    padding: "20px",
    backgroundColor: COLORS.lightGray,
    borderRadius: "8px",
  },
  subsectionHeader: {
    fontSize: "18px",
    fontWeight: "600",
    color: COLORS.black,
    marginBottom: "15px",
  },
  subsectionItem: {
    marginBottom: "15px",
  },
  formLabel: {
    display: "block",
    fontSize: "14px",
    color: COLORS.black,
    marginBottom: "5px",
  },
  formInput: {
    width: "100%",
    padding: "8px",
    border: `1px solid ${COLORS.gray}`,
    borderRadius: "4px",
    fontSize: "14px",
    marginBottom: "10px",
  },
  formSelect: {
    width: "100%",
    padding: "8px",
    border: `1px solid ${COLORS.gray}`,
    borderRadius: "4px",
    fontSize: "14px",
    marginBottom: "10px",
  },
  activitySection: {
    marginTop: "30px",
    padding: "20px",
    backgroundColor: COLORS.lightGray,
    borderRadius: "8px",
  },
  activityHeader: {
    fontSize: "18px",
    fontWeight: "600",
    color: COLORS.black,
    marginBottom: "15px",
  },
  activityItem: {
    padding: "10px",
    backgroundColor: COLORS.white,
    border: `1px solid ${COLORS.gray}`,
    borderRadius: "4px",
    marginBottom: "10px",
    fontSize: "14px",
    color: COLORS.black,
  },
  notificationSection: {
    marginTop: "30px",
    padding: "20px",
    backgroundColor: COLORS.lightGray,
    borderRadius: "8px",
  },
  notificationItem: {
    padding: "10px",
    backgroundColor: COLORS.white,
    border: `1px solid ${COLORS.gray}`,
    borderRadius: "4px",
    marginBottom: "10px",
    fontSize: "14px",
    color: COLORS.black,
  },
  button: {
    padding: "8px 16px",
    backgroundColor: COLORS.coinbaseBlue,
    color: COLORS.white,
    border: "none",
    borderRadius: "4px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  buttonSecondary: {
    padding: "8px 16px",
    backgroundColor: COLORS.white,
    color: COLORS.black,
    border: `1px solid ${COLORS.gray}`,
    borderRadius: "4px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  footer: {
    borderTop: `1px solid ${COLORS.gray}`,
    padding: "10px 20px",
    textAlign: "center",
    fontSize: "12px",
    color: COLORS.gray,
    backgroundColor: COLORS.white,
  },
  footerLinks: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
    marginBottom: "5px",
    flexWrap: "wrap",
  },
  footerLink: {
    color: COLORS.gray,
    textDecoration: "none",
  },
  privacyChoices: {
    color: COLORS.coinbaseBlue,
    textDecoration: "none",
  },
  "@media (max-width: 768px)": {
    pageContainer: {
      flexDirection: "column",
    },
    sidebar: {
      width: "100%",
      borderRight: "none",
      borderBottom: `1px solid ${COLORS.gray}`,
    },
    profileSection: {
      flexDirection: "column",
      alignItems: "center",
    },
    profileDetails: {
      textAlign: "center",
    },
  },
};

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [language, setLanguage] = useState<string>("English");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setDisplayName(currentUser.displayName || "");
        // Fetch profile picture
        const profilePicRef = ref(storage, `profile_pics/${currentUser.uid}`);
        try {
          const url = await getDownloadURL(profilePicRef);
          setProfilePic(url);
        } catch (err) {
          console.log("No profile picture found, using default.");
          setProfilePic(null);
        }

        // Fetch user activity (last 10 activities, ordered by timestamp)
        const activityQuery = query(
          collection(db, `users/${currentUser.uid}/activity`),
          orderBy("timestamp", "desc"),
          limit(10)
        );
        onSnapshot(activityQuery, (snapshot) => {
          const activities = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setNotifications(activities);
        });

        // Log activity
        await addDoc(collection(db, `users/${currentUser.uid}/activity`), {
          action: "Logged in",
          timestamp: serverTimestamp(),
          userId: currentUser.uid,
        });
      } else {
        router.push("/account");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/account");
    } catch (err: any) {
      console.error("Logout failed:", err);
    }
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user) {
      const file = e.target.files[0];
      const profilePicRef = ref(storage, `profile_pics/${user.uid}`);
      try {
        await uploadBytes(profilePicRef, file);
        const url = await getDownloadURL(profilePicRef);
        setProfilePic(url);
        await addDoc(collection(db, `users/${user.uid}/activity`), {
          action: "Updated profile picture",
          timestamp: serverTimestamp(),
          userId: user.uid,
        });
      } catch (err) {
        console.error("Profile picture upload failed:", err);
      }
    }
  };

  const handleProfilePicRemove = async () => {
    if (user) {
      const profilePicRef = ref(storage, `profile_pics/${user.uid}`);
      try {
        await deleteObject(profilePicRef);
        setProfilePic(null);
        await addDoc(collection(db, `users/${user.uid}/activity`), {
          action: "Removed profile picture",
          timestamp: serverTimestamp(),
          userId: user.uid,
        });
      } catch (err) {
        console.error("Profile picture removal failed:", err);
      }
    }
  };

  const handleUpdateDisplayName = async () => {
    if (user && displayName) {
      try {
        await updateProfile(user, { displayName });
        setUser({ ...user, displayName });
        await addDoc(collection(db, `users/${user.uid}/activity`), {
          action: `Updated display name to ${displayName}`,
          timestamp: serverTimestamp(),
          userId: user.uid,
        });
        alert("Display name updated successfully!");
      } catch (err) {
        console.error("Failed to update display name:", err);
        alert("Failed to update display name.");
      }
    }
  };

  const handleUpdatePassword = async () => {
    if (user && newPassword) {
      try {
        await updatePassword(user, newPassword);
        await addDoc(collection(db, `users/${user.uid}/activity`), {
          action: "Updated password",
          timestamp: serverTimestamp(),
          userId: user.uid,
        });
        alert("Password updated successfully!");
        setNewPassword("");
      } catch (err) {
        console.error("Failed to update password:", err);
        alert("Failed to update password. You may need to re-authenticate.");
      }
    }
  };

  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (user) {
      await addDoc(collection(db, `users/${user.uid}/activity`), {
        action: `Changed language to ${newLanguage}`,
        timestamp: serverTimestamp(),
        userId: user.uid,
      });
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div style={styles.pageContainer}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div
          style={{
            ...styles.sidebarItem,
            ...(activeSection === "dashboard" ? styles.sidebarItemActive : {}),
          }}
          onClick={() => setActiveSection("dashboard")}
        >
          Dashboard
        </div>
        <div
          style={{
            ...styles.sidebarItem,
            ...(activeSection === "profile" ? styles.sidebarItemActive : {}),
          }}
          onClick={() => setActiveSection("profile")}
        >
          Profile
        </div>
        <div
          style={{
            ...styles.sidebarItem,
            ...(activeSection === "settings" ? styles.sidebarItemActive : {}),
          }}
          onClick={() => setActiveSection("settings")}
        >
          Settings
        </div>
        <div
          style={{
            ...styles.sidebarItem,
            ...(activeSection === "activity" ? styles.sidebarItemActive : {}),
          }}
          onClick={() => setActiveSection("activity")}
        >
          Activity
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        <header style={styles.header}>
          <Link href="/">
            <Image
              src="https://i.imgur.com/OML2njS.png"
              alt="Homebase Logo"
              width={100} // Adjusted width for smaller logo
              height={24}
              style={styles.logo}
            />
          </Link>
          <div style={styles.headerLinks}>
            <Link href="/support" style={styles.headerLink}>
              Support
            </Link>
            <Link href="/language" style={styles.headerLink}>
              {language}
            </Link>
          </div>
        </header>

        <div style={styles.container}>
          <div style={styles.dashboardContainer}>
            {activeSection === "dashboard" && (
              <>
                <h1 style={styles.headerText}>Welcome to Your Dashboard</h1>
                <div style={styles.profileSection}>
                  <div>
                    {profilePic ? (
                      <Image
                        src={profilePic}
                        alt="Profile Picture"
                        width={80}
                        height={80}
                        style={styles.profileImage}
                      />
                    ) : (
                      <div style={styles.profileImage}>🧑</div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        onChange={handleProfilePicUpload}
                      />
                      <button
                        style={{ ...styles.buttonSecondary, marginTop: "10px" }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {profilePic ? "Update Picture" : "Add Picture"}
                      </button>
                      {profilePic && (
                        <button
                          style={{ ...styles.buttonSecondary, marginTop: "10px", marginLeft: "10px" }}
                          onClick={handleProfilePicRemove}
                        >
                          Remove Picture
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={styles.profileDetails}>
                    <p style={styles.infoText}>Logged in as: {user.email}</p>
                    <p style={styles.infoText}>
                      Display Name: {user.displayName || "Not set"}
                    </p>
                    <p style={styles.infoText}>
                      Joined: {new Date(user.metadata.creationTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </>
            )}

            {activeSection === "profile" && (
              <div style={styles.subsection}>
                <h2 style={styles.subsectionHeader}>Profile Details</h2>
                <div style={styles.subsectionItem}>
                  <p style={styles.infoText}>Email: {user.email}</p>
                  <p style={styles.infoText}>User ID: {user.uid}</p>
                  <p style={styles.infoText}>
                    Last Login: {new Date(user.metadata.lastSignInTime).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {activeSection === "settings" && (
              <div style={styles.subsection}>
                <h2 style={styles.subsectionHeader}>Settings</h2>
                <div style={styles.subsectionItem}>
                  <label style={styles.formLabel}>Language</label>
                  <select
                    style={styles.formSelect}
                    value={language}
                    onChange={handleLanguageChange}
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                  </select>
                </div>
                <div style={styles.subsectionItem}>
                  <label style={styles.formLabel}>Display Name</label>
                  <input
                    type="text"
                    style={styles.formInput}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter new display name"
                  />
                  <button style={styles.button} onClick={handleUpdateDisplayName}>
                    Update Display Name
                  </button>
                </div>
                <div style={styles.subsectionItem}>
                  <label style={styles.formLabel}>New Password</label>
                  <input
                    type="password"
                    style={styles.formInput}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <button style={styles.button} onClick={handleUpdatePassword}>
                    Update Password
                  </button>
                </div>
              </div>
            )}

            {activeSection === "activity" && (
              <div style={styles.activitySection}>
                <h2 style={styles.activityHeader}>Recent Activity</h2>
                {notifications.map((activity) => (
                  <div key={activity.id} style={styles.activityItem}>
                    {activity.action} - {activity.timestamp?.toDate().toLocaleString()}
                  </div>
                ))}
              </div>
            )}

            {activeSection !== "dashboard" && (
              <button style={{ ...styles.button, marginTop: "20px" }} onClick={() => setActiveSection("dashboard")}>
                Back to Dashboard
              </button>
            )}

            {activeSection === "dashboard" && (
              <button style={{ ...styles.button, marginTop: "20px" }} onClick={handleLogout}>
                Log out
              </button>
            )}
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
    </div>
  );
}