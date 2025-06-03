// app/base-chain-news/[slug]/ArticleDetail.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ArticleProps {
  article: {
    id: string;
    title: string;
    content: string;
    author: string;
    source: string;
    slug: string;
    thumbnailUrl: string;
    publishedAt: string; // ISO string
  };
}

interface Comment {
  id: string;
  articleSlug: string;
  userId: string;
  content: string;
  createdAt: string; // ISO
  parentId?: string;
  likes: string[];
  dislikes: string[];
}

export default function ArticleDetail({ article }: ArticleProps) {
  const router = useRouter();

  // ─── Local state for comments, loading & errors ───
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [errorComments, setErrorComments] = useState<string | null>(null);

  // ─── Fetch comments on mount ───
  useEffect(() => {
    async function fetchComments() {
      try {
        const res = await fetch(`/api/comments?articleSlug=${article.slug}`);
        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }
        const data: Comment[] = await res.json();
        setComments(data);
      } catch (err) {
        console.error('Error fetching comments:', err);
        setErrorComments('Failed to load comments');
      } finally {
        setLoadingComments(false);
      }
    }

    fetchComments();
  }, [article.slug]);

  // ─── Copy article link to clipboard ───
  const copyLink = () => {
    const url = `${window.location.origin}/base-chain-news/${article.slug}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans p-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-4"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back
      </button>

      {/* Article Content */}
      <div className="bg-gray-900 rounded-lg p-6 mb-8">
        {article.thumbnailUrl && (
          <img
            src={article.thumbnailUrl}
            alt={`${article.title} thumbnail`}
            className="w-full h-auto object-cover rounded-lg mb-4"
            onError={(e) => {
              e.currentTarget.src =
                'https://via.placeholder.com/800x400?text=No+Image';
            }}
            loading="lazy"
          />
        )}
        <h1 className="text-3xl font-bold text-white mb-2">{article.title}</h1>
        <div className="text-xs text-gray-400 mb-4">
          <span>By {article.author}</span>
          <span className="mx-2">|</span>
          <span>
            {new Date(article.publishedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
          <span className="mx-2">|</span>
          <span>Source: {article.source}</span>
        </div>
        <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
          {article.content}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={copyLink}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none"
          >
            <ClipboardIcon className="w-4 h-4" />
            Copy Link
          </button>
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Comments</h2>
          <button
            className="text-gray-400 hover:text-gray-200"
            onClick={() => setComments([])}
            aria-label="Clear Comments"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {loadingComments ? (
          <p className="text-gray-400">Loading comments...</p>
        ) : errorComments ? (
          <p className="text-red-500">{errorComments}</p>
        ) : comments.length === 0 ? (
          <p className="text-gray-400">No comments yet.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="border-b border-gray-700 pb-3">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                  <span>User: {c.userId}</span>
                  <span>
                    {new Date(c.createdAt).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <p className="text-gray-200">{c.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
