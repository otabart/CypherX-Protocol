// pages/api/saveArticle.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import slugify from "slugify";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const { title, content, author, source } = req.body;
    if (!title || !content || !author || !source) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    try {
      const slug = slugify(title, { lower: true, strict: true });
      const docRef = await addDoc(collection(db, "articles"), {
        title,
        content,
        author,
        source,
        publishedAt: serverTimestamp(),
        slug,
      });
      res.status(200).json({ id: docRef.id, slug });
    } catch (error) {
      console.error("Error saving article", error);
      res.status(500).json({ error: "Error saving article" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

