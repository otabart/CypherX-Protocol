"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers"; // Adjust the path if needed
import { auth } from "@/lib/firebase";

const ADMIN_EMAILS = ["admin@example.com"]; // Replace with your admin email(s)

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Redirect to login if not logged in
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      // Check if the logged-in user's email is in the admin list
      setIsAdmin(ADMIN_EMAILS.includes(user.email));
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <h1 className="text-2xl font-bold">Access Denied</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header: Display admin panel title and user's display name or email */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-lg">
          Welcome, {user.displayName ? user.displayName : user.email}
        </p>
      </header>

      {/* Admin Section: Manage Tournaments */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Manage Tournaments</h2>
        <div className="bg-white p-4 rounded shadow">
          <p className="mb-4">No tournaments created yet. Use the form below to create one.</p>
          <form>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Tournament Title
              </label>
              <input
                type="text"
                placeholder="Enter tournament title"
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                placeholder="Enter tournament description"
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Entry Fee (USDC)
              </label>
              <input
                type="number"
                placeholder="0"
                className="w-full p-2 border rounded"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Create Tournament
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
