'use client';

import { useState } from 'react';

export default function CreatePost({ addPost }: { addPost: (newPost: any) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newPost = {
      title: title.trim(),
      content: content.trim(),
      author: 'You',
      category,
    };

    addPost(newPost);
    setTitle('');
    setContent('');
  };

  return (
    <div id="create-post" className="p-4 shadow-md border rounded-lg bg-white mb-6">
      <h3 className="text-lg font-bold text-primaryBlue mb-2">Create a New Post</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter a title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-primaryBlue mb-2"
        />
        <textarea
          placeholder="Write something..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-primaryBlue mb-2 resize-none"
          rows={4} // Set fixed rows to prevent resizing
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-primaryBlue mb-2"
        >
          <option value="General">General</option>
          <option value="Coins">Coins</option>
          <option value="Launch Updates">Launch Updates</option>
          <option value="Community">Community</option>
        </select>
        <button
          type="submit"
          className="w-full bg-primaryBlue text-white py-2 rounded-md hover:bg-blue-700 transition-all"
        >
          Post
        </button>
      </form>
    </div>
  );
}
