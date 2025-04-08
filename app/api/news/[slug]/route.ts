import { NextResponse, NextRequest } from "next/server";
import { db } from "../../../../lib/firebase"; // Path is correct
import { collection, getDocs, query, where } from "firebase/firestore";

export async function GET(request: NextRequest, context: { params: { slug: string } }) {
  const { slug } = context.params;
  console.log("API requested slug:", slug);

  try {
    const articlesCol = collection(db, "articles");
    const q = query(articlesCol, where("slug", "==", slug));
    const querySnapshot = await getDocs(q);

    console.log("Found documents:", querySnapshot.docs.length);
    const allDocs = await getDocs(articlesCol);
    console.log(
      "All slugs in Firestore:",
      allDocs.docs.map((doc) => doc.data().slug)
    );

    if (querySnapshot.empty) {
      console.log("No article found for slug:", slug);
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const doc = querySnapshot.docs[0];
    const articleData = doc.data();
    console.log("Article data:", articleData);

    if (articleData.publishedAt?.toDate) {
      articleData.publishedAt = articleData.publishedAt.toDate().toISOString();
    }

    return NextResponse.json(articleData);
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { error: "Error fetching article" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({ message: "Method not implemented" }, { status: 501 });
}