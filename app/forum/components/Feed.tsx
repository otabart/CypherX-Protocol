'use client';

import { useState, useEffect } from 'react';
import Post from './Post'; // a component to display each post

export default function Feed() {
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const endpoint = activeTab === 'foryou'
          ? '/api/posts/for-you'
          : '/api/posts/following?currentUserId=USER_ID_HERE';

        const res = await fetch(endpoint);
        const data = await res.json();
        if (data.success) {
          setPosts(data.posts);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPosts();
  }, [activeTab]);

  return (
    <div className="p-4">
      <div className="flex space-x-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${activeTab === 'foryou' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('foryou')}
        >
          For You
        </button>
        <button
          className={`px-4 py-2 rounded ${activeTab === 'following' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('following')}
        >
          Following
        </button>
      </div>

      <div className="space-y-4">
        {posts.map((post: any) => (
          <Post key={post._id} post={post} />
        ))}
      </div>
    </div>
  );
}





