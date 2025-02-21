// app/api/news/[id]/route.ts
import { NextResponse } from "next/server";
import { articles, NewsArticle } from "../../../content/articles";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const article = articles.find((article: NewsArticle) => article.id === id);

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  return NextResponse.json(article);
}

