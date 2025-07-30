// app/api/news/[slug]/route.ts

import { NextResponse } from "next/server";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../lib/firebase"; // adjust path if needed

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Now you can safely do:
  const { slug } = await params;

  try {
    const articlesCol = collection(db, "articles");
    const q = query(articlesCol, where("slug", "==", slug));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const doc = querySnapshot.docs[0];
    const articleData = doc.data();

    // Convert Firestore Timestamp -> ISO string (if needed)
    if (articleData.publishedAt?.toDate) {
      articleData.publishedAt = articleData.publishedAt.toDate().toISOString();
    }

    return NextResponse.json(articleData);
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json({ error: "Error fetching article" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({ message: "Method not implemented" }, { status: 501 });
}

