'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ClipboardIcon, XMarkIcon, HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, where, doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { useAuth } from '@/app/providers';
import type { User } from 'firebase/auth';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

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
    views?: number; // Optional, defaults to 0 if not present
    upvotes?: number; // Optional, defaults to 0 if not present
    downvotes?: number; // Optional, defaults to 0 if not present
    updatedAt?: string; // Optional, for last update
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
  const { user, walletAddress, loading: authLoading } = useAuth() as { user: User | null; walletAddress: string | null; loading: boolean };
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [errorComments, setErrorComments] = useState<string | null>(null);
  const [articleStats, setArticleStats] = useState({
    views: article.views || 0,
    upvotes: article.upvotes || 0,
    downvotes: article.downvotes || 0,
  });

  // ─── Increment views on mount ───
  useEffect(() => {
    async function incrementViews() {
      const articleRef = doc(db, 'articles', article.id);
      await updateDoc(articleRef, { views: increment(1), updatedAt: new Date().toISOString() });
      setArticleStats((prev) => ({ ...prev, views: prev.views + 1 }));
    }
    if (article.id) incrementViews();
  }, [article.id]);

  // ─── Fetch comments on mount ───
  useEffect(() => {
    async function fetchComments() {
      try {
        const q = query(collection(db, 'comments'), where('articleSlug', '==', article.slug));
        const snap = await getDocs(q);
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Comment));
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

  // ─── Submit new comment ───
  const handleSubmitComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !walletAddress) {
      alert('Please connect your wallet to comment.');
      return;
    }
    if (!newComment.trim()) {
      alert('Comment cannot be empty.');
      return;
    }
    try {
      const commentData: Omit<Comment, 'id' | 'likes' | 'dislikes'> = {
        articleSlug: article.slug,
        userId: user.uid,
        content: newComment,
        createdAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, 'comments'), commentData);
      setComments((prev) => [
        ...prev,
        { ...commentData, id: docRef.id, likes: [], dislikes: [] },
      ]);
      setNewComment('');
      const articleRef = doc(db, 'articles', article.id);
      await updateDoc(articleRef, { updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Error submitting comment:', err);
      setErrorComments('Failed to submit comment. Ensure Firebase rules allow writes.');
    }
  };

  // ─── Like/Dislike comment ───
  const toggleLikeComment = async (commentId: string, isLike: boolean) => {
    if (!user) return;
    const commentRef = doc(db, 'comments', commentId);
    const userId = user.uid;
    const update = isLike
      ? { likes: arrayUnion(userId), dislikes: arrayUnion(userId) ? [] : undefined }
      : { dislikes: arrayUnion(userId), likes: arrayUnion(userId) ? [] : undefined };
    await updateDoc(commentRef, update);
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              likes: isLike ? [...c.likes, userId] : c.likes.filter((id) => id !== userId),
              dislikes: isLike ? c.dislikes.filter((id) => id !== userId) : [...c.dislikes, userId],
            }
          : c
      )
    );
  };

  // ─── Upvote/Downvote article ───
  const toggleArticleVote = async (isUpvote: boolean) => {
    if (!user) return;
    const articleRef = doc(db, 'articles', article.id);
    const update = isUpvote
      ? { upvotes: increment(1), downvotes: increment(-1) }
      : { downvotes: increment(1), upvotes: increment(-1) };
    await updateDoc(articleRef, update);
    setArticleStats((prev) => ({
      ...prev,
      upvotes: isUpvote ? prev.upvotes + 1 : Math.max(0, prev.upvotes - 1),
      downvotes: isUpvote ? Math.max(0, prev.downvotes - 1) : prev.downvotes + 1,
    }));
  };

  // ─── Copy article link to clipboard ───
  const copyLink = () => {
    const url = `${window.location.origin}/base-chain-news/${article.slug}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  // ─── Share to social platforms ───
  const shareToX = () => {
    const url = encodeURIComponent(`${window.location.origin}/base-chain-news/${article.slug}`);
    const text = encodeURIComponent(`Check out this article on CypherScan: ${article.title}`);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, 'Share to X', 'width=600,height=400');
  };

  const shareToTelegram = () => {
    const url = encodeURIComponent(`${window.location.origin}/base-chain-news/${article.slug}`);
    const text = encodeURIComponent(`Check out this article on CypherScan: ${article.title}`);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, 'Share to Telegram', 'width=600,height=400');
  };

  // ─── Handle thumbnail error ───
  const handleThumbnailError = () => {
    setFailedThumbnail('https://via.placeholder.com/800x400?text=No+Image');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans">
      <Header />
      <main className="container max-w-4xl mx-auto px-4 sm:px-6 py-6">
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
        <div className="bg-gray-900 rounded-lg p-6 mb-8 shadow-md">
          {article.thumbnailUrl && (
            <Image
              src={failedThumbnail || article.thumbnailUrl}
              alt={`${article.title} thumbnail`}
              width={800}
              height={400}
              className="w-full h-auto object-cover rounded-lg mb-4"
              onError={handleThumbnailError}
              priority
              aria-label="Article thumbnail"
            />
          )}
          <h1 className="text-3xl font-bold text-white mb-2">{article.title}</h1>
          <div className="text-xs text-gray-400 mb-4 flex items-center gap-2">
            <span>By {article.author}</span>
            <span>|</span>
            <span>
              {new Date(article.publishedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
            <span>|</span>
            <span>Source: {article.source}</span>
          </div>
          <p className="text-gray-200 leading-relaxed whitespace-pre-wrap mb-6">{article.content}</p>
          <div className="flex gap-2 flex-wrap items-center mb-4">
            <button
              onClick={() => toggleArticleVote(true)}
              className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs text-blue-400 hover:text-blue-300 transition-all duration-300"
            >
              <HandThumbUpIcon className="w-4 h-4" />
              <span>{articleStats.upvotes}</span>
            </button>
            <button
              onClick={() => toggleArticleVote(false)}
              className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs text-blue-400 hover:text-blue-300 transition-all duration-300"
            >
              <HandThumbDownIcon className="w-4 h-4" />
              <span>{articleStats.downvotes}</span>
            </button>
            <span className="text-xs text-gray-400">Views: {articleStats.views}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={copyLink}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none"
            >
              <ClipboardIcon className="w-4 h-4" />
              Copy Link
            </button>
            <button
              onClick={shareToX}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Share on X
            </button>
            <button
              onClick={shareToTelegram}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-sm text-blue-400 hover:text-blue-300 transition-all duration-300 focus:outline-none"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c.1.564 1.725.267 2.02-.421L23.99 4.477c.392-1.178-.484-1.71-1.297-1.34L2.705 12.162c-1.178.392-.803 1.586.098 1.965l5.508 1.717 12.785-8.03c.392-.244.814-.098.491.392z"/>
              </svg>
              Share on Telegram
            </button>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-md">
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
                  <p className="text-gray-200 mb-2">{c.content}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleLikeComment(c.id, true)}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs text-blue-400 hover:text-blue-300 transition-all duration-300"
                    >
                      <HandThumbUpIcon className="w-4 h-4" />
                      <span>{c.likes.length}</span>
                    </button>
                    <button
                      onClick={() => toggleLikeComment(c.id, false)}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-md text-xs text-blue-400 hover:text-blue-300 transition-all duration-300"
                    >
                      <HandThumbDownIcon className="w-4 h-4" />
                      <span>{c.dislikes.length}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Comment Form */}
          {user && walletAddress && (
            <div className="mt-6">
              <form onSubmit={handleSubmitComment}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="w-full bg-gray-900 border border-blue-900/30 rounded-md p-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-700 resize-y min-h-[100px] mb-2"
                  aria-label="Comment input"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-all duration-300"
                >
                  Submit Comment
                </button>
              </form>
            </div>
          )}
          {!user && !walletAddress && (
            <p className="text-gray-400 mt-4">Please connect your wallet to comment.</p>
          )}
        </div>
      </main>
      <Footer>
        <span className="text-gray-500 text-xs">Uptime: {Math.floor((Date.now() - new Date('2025-07-01T13:36:00-07:00').getTime()) / 1000)}s</span>
      </Footer>
    </div>
  );
}
