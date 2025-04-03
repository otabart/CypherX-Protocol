// pages/api/admin/tournaments.ts
import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { title, description, entryFee } = req.body;
    if (!title || !description || entryFee <= 0) {
      return res.status(400).json({ success: false, message: "Invalid data" });
    }
    try {
      const docRef = await addDoc(collection(db, "tournaments"), {
        title,
        description,
        entryFee,
        createdAt: serverTimestamp(),
      });
      res.status(200).json({ success: true, tournament: { id: docRef.id, title, description, entryFee } });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to create tournament" });
    }
  } else {
    res.status(405).json({ success: false, message: "Method not allowed" });
  }
}
