"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CalendarRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/events");
  }, [router]);

    return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting to Events...</p>
          </div>
    </div>
  );
}