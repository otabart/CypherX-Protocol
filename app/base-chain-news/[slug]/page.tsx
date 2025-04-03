// app/base-chain-news/page.tsx

import { NewsArticle } from "../../content/articles";
import Link from "next/link";
import { db } from "../../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import slugify from "slugify";

// This is a server component fetching data from Firestore
export default async function BaseChainNewsIndex() {
  const articlesCol = collection(db, "articles");
  const q = query(articlesCol, orderBy("publishedAt", "desc"));
  const querySnapshot = await getDocs(q);
  
  const articles: NewsArticle[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    // Ensure the article has a slug (generate one if necessary)
    const slug = data.slug || slugify(data.title, { lower: true, strict: true });
    articles.push({
      title: data.title,
      content: data.content,
      author: data.author,
      source: data.source,
      publishedAt: data.publishedAt.toDate().toISOString(),
      slug,
    });
  });
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-6">Base Chain News</h1>
      {articles.map((article) => (
        <article key={article.slug} className="mb-6 border-b pb-4">
          <h2 className="text-2xl font-bold">
            <Link href={`/base-chain-news/${article.slug}`}>
              {article.title}
            </Link>
          </h2>
          <p className="text-gray-600 text-sm">
            {article.source} - {article.author} - {new Date(article.publishedAt).toLocaleString()}
          </p>
          <p>{article.content.slice(0, 200)}...</p>
          <Link href={`/base-chain-news/${article.slug}`} className="text-blue-500 hover:underline">
            Read More →
          </Link>
        </article>
      ))}
    </div>
  );
}
