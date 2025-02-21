'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../components/Header';
import Sidebar from './Sidebar';

/* --------------------------------------------------------------------------
   CreateAccount Component
   -------------------------------------------------------------------------- */
function CreateAccount({ onAccountCreated }: { onAccountCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Replace this with your real account creation logic (API call, etc.)
    console.log('Creating account:', { username, email });
    onAccountCreated();
  };

  return (
    <motion.div
      className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg my-8"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold mb-4">Create Account</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
          required
        />
        <button
          type="submit"
          className="w-full p-2 bg-primaryBlue text-white rounded hover:bg-blue-600 transition"
        >
          Create Account
        </button>
      </form>
    </motion.div>
  );
}

/* --------------------------------------------------------------------------
   CreatePostBox Component
   -------------------------------------------------------------------------- */
function CreatePostBox({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImage(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting post:', { title, content, image });
    setTitle('');
    setContent('');
    setImage(null);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white p-6 rounded-lg shadow-md mb-6"
    >
      <h2 className="text-xl font-bold text-primaryBlue mb-4">Create Post</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post Title"
          className="w-full border border-gray-300 rounded-md py-2 px-4 mb-4 focus:outline-none focus:border-primaryBlue"
          required
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full border border-gray-300 rounded-md py-2 px-4 mb-4 h-32 resize-none focus:outline-none focus:border-primaryBlue"
          required
        />
        <div className="flex items-center mb-4">
          <label
            htmlFor="imageUpload"
            className="flex items-center justify-center w-10 h-10 border border-dashed border-gray-400 rounded-md cursor-pointer hover:bg-gray-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </label>
          <input
            id="imageUpload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          {image && <span className="ml-4 text-sm text-gray-600">{image.name}</span>}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="mr-4 px-4 py-2 rounded-md text-gray-600 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-primaryBlue text-white rounded-md hover:bg-blue-600">
            Post
          </button>
        </div>
      </form>
    </motion.div>
  );
}

/* --------------------------------------------------------------------------
   Fake Social Feed Data
   -------------------------------------------------------------------------- */
const fakePosts = [
  {
    id: 1,
    author: 'Alice',
    avatar: 'A',
    content:
      "Exploring the latest DeFi protocols on Base chain. Exciting times ahead! #DeFi",
    timestamp: '2 hours ago',
    comments: [
      { id: 1, author: 'Bob', content: 'Absolutely, the potential is huge!', timestamp: '1 hour ago' },
      { id: 2, author: 'Charlie', content: 'Agreed, but watch out for volatility.', timestamp: '45 mins ago' },
    ],
  },
  {
    id: 2,
    author: 'Bob',
    avatar: 'B',
    content: "Just launched my new NFT collection on Homebase. Check it out!",
    timestamp: '3 hours ago',
    comments: [{ id: 1, author: 'Alice', content: 'Looks amazing, congrats!', timestamp: '2 hours ago' }],
  },
  {
    id: 3,
    author: 'Charlie',
    avatar: 'C',
    content: "Anyone else noticing unusual market movements? Let's discuss.",
    timestamp: '5 hours ago',
    comments: [],
  },
];

/* --------------------------------------------------------------------------
   PostCard Component
   -------------------------------------------------------------------------- */
function PostCard({ post }: { post: any }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center mb-4">
        <div className="w-10 h-10 bg-primaryBlue rounded-full flex items-center justify-center text-white font-bold mr-3">
          {post.avatar}
        </div>
        <div>
          <h3 className="text-lg font-bold text-primaryBlue">{post.author}</h3>
          <span className="text-sm text-gray-500">{post.timestamp}</span>
        </div>
      </div>
      <p className="text-gray-800 mb-4">{post.content}</p>
      {post.comments.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-2">Comments</h4>
          {post.comments.map((comment: any) => (
            <div key={comment.id} className="flex items-start mb-3">
              <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-bold mr-2">
                {comment.author.charAt(0)}
              </div>
              <div>
                <p className="text-sm text-gray-800">
                  <span className="font-bold text-primaryBlue">{comment.author}:</span> {comment.content}
                </p>
                <span className="text-xs text-gray-500">{comment.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Forum Component
   -------------------------------------------------------------------------- */
function Forum() {
  const [activeCategory, setActiveCategory] = useState('General');
  const [activeFeed, setActiveFeed] = useState('For You');
  const [showCreatePost, setShowCreatePost] = useState(false);

  const pageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, when: 'beforeChildren', staggerChildren: 0.1 },
    },
  };

  const postVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <motion.div
        className="flex flex-grow w-full"
        initial="hidden"
        animate="visible"
        variants={pageVariants}
      >
        {/* Sidebar (for large screens) */}
        <motion.aside className="hidden lg:block w-1/5 bg-white p-6 shadow-md rounded-lg m-4" variants={pageVariants}>
          <Sidebar setActiveCategory={setActiveCategory} />
          <div className="mt-8 p-6 bg-gray-100 rounded-lg shadow-sm">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Trending Topics</h3>
            <ul className="space-y-3">
              <li className="text-blue-600 hover:underline cursor-pointer">
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="inline-block mr-1 text-red-500"
                >
                  <path d="M13 17l5 5m0 0l5-5m-5 5V12"></path>
                  <path d="M2 12l9-9 3 3 8-8"></path>
                </svg>
                Crypto Markets
              </li>
              <li className="text-blue-600 hover:underline cursor-pointer">
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="inline-block mr-1 text-blue-600"
                >
                  <path d="M4.5 20l3-1.5 11-11-2.5-2.5-11 11L4 19.5l.5.5z"></path>
                </svg>
                New Token Launches
              </li>
              <li className="text-blue-600 hover:underline cursor-pointer">
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="inline-block mr-1 text-yellow-500"
                >
                  <path d="M9 18h6"></path>
                  <path d="M10 22h4"></path>
                  <path d="M2 10a8 8 0 1116 0c0 2.386-.928 4.184-2.928 5.184A1 1 0 0015 16v1a2 2 0 01-2 2H11a2 2 0 01-2-2v-1a1 1 0 00-.072-.368C6.928 14.184 6 12.386 6 10"></path>
                </svg>
                Blockchain Innovations
              </li>
            </ul>
          </div>
        </motion.aside>

        {/* Main Feed */}
        <motion.main className="w-full lg:w-4/5 bg-white p-8 m-4 rounded-lg shadow-md" variants={pageVariants}>
          <motion.div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6" variants={pageVariants}>
            <div>
              <h1 className="text-3xl font-bold text-primaryBlue">Homebase Forum</h1>
              <p className="text-gray-600 mt-2">
                Connect with fellow Web3 enthusiasts, share ideas, and discover new opportunities.
              </p>
            </div>
            <button
              onClick={() => setShowCreatePost(!showCreatePost)}
              className="mt-4 sm:mt-0 bg-primaryBlue text-white px-4 py-2 rounded-md text-sm hover:bg-blue-600 transition"
            >
              {showCreatePost ? 'Close Post Box' : 'Create Post'}
            </button>
          </motion.div>

          <AnimatePresence>
            {showCreatePost && <CreatePostBox onClose={() => setShowCreatePost(false)} />}
          </AnimatePresence>

          <motion.div
            className="flex space-x-4 overflow-x-auto border-b border-gray-200 pb-3 mb-6"
            variants={pageVariants}
          >
            {['For You', 'Following'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFeed(tab)}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                  activeFeed === tab
                    ? 'bg-primaryBlue text-white font-semibold'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </motion.div>

          <motion.div className="mb-6" variants={pageVariants}>
            <input
              type="text"
              placeholder="Search posts..."
              className="w-full border border-gray-300 rounded-md py-3 px-4 text-base focus:outline-none focus:border-primaryBlue"
            />
          </motion.div>

          <motion.div className="space-y-6" variants={pageVariants}>
            {fakePosts.map((post) => (
              <motion.div key={post.id} variants={postVariants}>
                <PostCard post={post} />
              </motion.div>
            ))}
          </motion.div>
        </motion.main>
      </motion.div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   ForumContainer Component
   -------------------------------------------------------------------------- */
export default function ForumContainer() {
  const [accountCreated, setAccountCreated] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <AnimatePresence exitBeforeEnter>
        {accountCreated ? (
          <motion.div
            key="forum"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <Forum />
          </motion.div>
        ) : (
          <motion.div
            key="createAccount"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
          >
            <CreateAccount onAccountCreated={() => setAccountCreated(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

