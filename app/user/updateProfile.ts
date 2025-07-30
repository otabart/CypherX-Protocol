// pages/api/user/updateProfile.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { uid, displayName } = req.body;
    if (!uid || !displayName) {
      return res.status(400).json({ success: false, message: "User ID and display name required" });
    }
    try {
      await setDoc(doc(db, "users", uid), {
        displayName,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      res.status(200).json({ success: true, message: "Profile updated" });
    } catch {
      res.status(500).json({ success: false, message: "Failed to update profile" });
    }
  } else {
    res.status(405).json({ success: false, message: "Method not allowed" });
  }
}
