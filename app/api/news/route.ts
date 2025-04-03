// app/api/news/route.ts

import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import slugify from "slugify";

export async function GET(request: Request) {
  try {
    const articlesCol = collection(db, "articles");
    const q = query(articlesCol, orderBy("publishedAt", "desc"));
    const querySnapshot = await getDocs(q);
    const articles = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Generate a slug based on the article title.
      const slug = slugify(data.title, { lower: true, strict: true });
      articles.push({
        title: data.title,
        content: data.content,
        author: data.author,
        source: data.source,
        publishedAt: data.publishedAt.toDate().toISOString(),
        slug,
      });
    });
    return NextResponse.json(articles);
  } catch (error) {
    console.error("Error fetching articles", error);
    return NextResponse.json({ error: "Error fetching articles" }, { status: 500 });
  }
}


