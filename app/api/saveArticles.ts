import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../lib/firebase"; // Path is correct
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import slugify from "slugify";

interface ArticleData {
  title: string;
  content: string;
  author: string;
  source: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const { title, content, author, source }: ArticleData = req.body;
    if (!title || !content || !author || !source) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    try {
      const baseSlug = slugify(title, { lower: true, strict: true }); // Changed to const
      let slug = baseSlug;
      let slugExists = true;
      let counter = 1;

      while (slugExists) {
        const q = query(collection(db, "articles"), where("slug", "==", slug));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          slugExists = false;
        } else {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      }

      const docRef = await addDoc(collection(db, "articles"), {
        title,
        content,
        author,
        source,
        publishedAt: serverTimestamp(),
        slug,
      });
      console.log("Saved article with slug:", slug);
      res.status(200).json({ id: docRef.id, slug });
    } catch (error) {
      console.error("Error saving article:", error);
      res.status(500).json({ error: "Error saving article" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

