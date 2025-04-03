// app/api/[slug]/route.ts

import { NextResponse } from "next/server";
import { db } from "../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import slugify from "slugify";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  console.log("Fetching article with slug:", slug);

  try {
    const articlesCol = collection(db, "articles");
    const querySnapshot = await getDocs(articlesCol);
    let articleData: any = null;

    // Loop through documents and compute the slug on the fly if missing
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const computedSlug = data.slug || slugify(data.title, { lower: true, strict: true });
      if (computedSlug === slug) {
        articleData = data;
      }
    });

    if (!articleData) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    if (articleData?.publishedAt?.toDate) {
      articleData.publishedAt = articleData.publishedAt.toDate().toISOString();
    }
    if (!articleData.slug && articleData.title) {
      articleData.slug = slugify(articleData.title, { lower: true, strict: true });
    }

    return NextResponse.json(articleData);
  } catch (error) {
    console.error("Error fetching article", error);
    return NextResponse.json({ error: "Error fetching article" }, { status: 500 });
  }
}

