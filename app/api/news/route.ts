import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase"; // Path is correct
import { collection, getDocs, query, orderBy } from "firebase/firestore";

interface NewsArticle {
  title: string;
  content: string;
  author: string;
  source: string;
  publishedAt: string;
  slug: string;
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
        title: data.title,
        content: data.content,
        author: data.author,
        source: data.source,
        publishedAt: data.publishedAt.toDate().toISOString(),
        slug: data.slug,
      });
    });
    console.log("Articles from /api/news:", articles.map((a) => a.slug));
    return NextResponse.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json({ error: "Error fetching articles" }, { status: 500 });
  }
}