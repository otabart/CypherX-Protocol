// app/news/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { NewsArticle } from "../../content/articles"; // same type used in your content file

export default function ArticlePage() {
  const { id } = useParams();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    async function fetchArticle() {
      setLoading(true);
      try {
        const res = await fetch(`/api/news/${id}`); // calls the single-article API route
        if (!res.ok) {
          setError("Failed to fetch article");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setArticle(data);
      } catch (err) {
        console.error(err);
        setError("Error fetching article");
      } finally {
        setLoading(false);
      }
    }
    fetchArticle();
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!article) return <p>No article found.</p>;

  return (
    <motion.div
      className="min-h-screen w-full bg-black text-blue-300 font-mono p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-sm mb-4">
        <span className="text-blue-400">
          [{new Date(article.publishedAt).toLocaleString()}]
        </span>{" "}
        {article.source} - <span className="italic">{article.author}</span>
      </div>
      <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
      <p className="mb-8">{article.content}</p>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:underline"
      >
        Original Article →
      </a>
    </motion.div>
  );
}
