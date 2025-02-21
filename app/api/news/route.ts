// app/api/news/route.ts
import { NextResponse } from "next/server";
import { articles, NewsArticle } from "../../content/articles";

export async function GET() {
  // Only include articles published in the last 3 days.
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const recentArticles = articles.filter(
    (article: NewsArticle) => new Date(article.publishedAt) >= threeDaysAgo
  );
  return NextResponse.json(recentArticles);
}

