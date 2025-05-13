import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

interface NewsArticle {
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
  thumbnailUrl: string | undefined;
}

export async function GET(request: Request) {
  try {
    const articlesCol = collection(db, "articles");
    const q = query(articlesCol, orderBy("publishedAt", "desc"));
    const querySnapshot = await getDocs(q);
    const articles: NewsArticle[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      articles.push({
        title: data.title || "Untitled",
        content: data.content || "",
        author: data.author || "Unknown",
        source: data.source || "Unknown",
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        slug: data.slug || doc.id,
        thumbnailUrl: data.thumbnailUrl || undefined, // Correctly map thumbnailUrl
      });
    });
    console.log("Articles from /api/news:", articles);
    return NextResponse.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json({ error: "Error fetching articles" }, { status: 500 });
  }
}