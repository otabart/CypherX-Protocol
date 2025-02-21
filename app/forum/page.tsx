'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// -----------------------------
// 1. Fake Data (Simulated Posts)
// -----------------------------
const fakePosts = [
  {
    id: 1,
    author: 'Alice',
    avatar: 'A',
    content: "Hey everyone, I'm new here! What's your favorite crypto?",
    timestamp: '2 hours ago',
    comments: [
      {
        id: 11,
        author: 'Bob',
        avatar: 'B',
        content: "Welcome, Alice! I love Bitcoin for its decentralization.",
        timestamp: '1 hour ago',
        upvotes: 3,
        downvotes: 0,
        replies: [
          {
            id: 111,
            author: 'Charlie',
            avatar: 'C',
            content: "I prefer Ethereum for its smart contracts.",
            timestamp: '50 mins ago',
            upvotes: 2,
            downvotes: 0,
            replies: [],
          },
        ],
      },
      {
        id: 12,
        author: 'David',
        avatar: 'D',
        content: "I'm more into DeFi projects these days!",
        timestamp: '55 mins ago',
        upvotes: 1,
        downvotes: 0,
        replies: [],
      },
    ],
  },
  {
    id: 2,
    author: 'Eva',
    avatar: 'E',
    content: "Did anyone see the latest NFT drop? It was amazing!",
    timestamp: '3 hours ago',
    comments: [
      {
        id: 21,
        author: 'Frank',
        avatar: 'F',
        content: "Yes, the artwork was stunning. I snapped up a few pieces!",
        timestamp: '2.5 hours ago',
        upvotes: 5,
        downvotes: 0,
        replies: [
          {
            id: 211,
            author: 'Grace',
            avatar: 'G',
            content: "I missed out! When's the next drop?",
            timestamp: '2 hours ago',
            upvotes: 1,
            downvotes: 0,
            replies: [],
          },
          {
            id: 212,
            author: 'Hannah',
            avatar: 'H',
            content: "Rumor has it, next month!",
            timestamp: '2 hours ago',
            upvotes: 2,
            downvotes: 0,
            replies: [],
          },
        ],
      },
    ],
  },
  {
    id: 3,
    author: 'Ivan',
    avatar: 'I',
    content: "What do you all think about the Base network?",
    timestamp: '4 hours ago',
    comments: [
      {
        id: 31,
        author: 'Judy',
        avatar: 'J',
        content: "I think it's promising, especially for scaling solutions.",
        timestamp: '3.5 hours ago',
        upvotes: 4,
        downvotes: 0,
        replies: [],
      },
      {
        id: 32,
        author: 'Alice',
        avatar: 'A',
        content: "Absolutely, it offers a lot of potential.",
        timestamp: '3 hours ago',
        upvotes: 3,
        downvotes: 0,
        replies: [],
      },
    ],
  },
  // ... add more posts to simulate 10 real accounts conversing ...
];

// -----------------------------
// 2. CreateAccount Component (Login/Sign-Up)
// -----------------------------
function CreateAccount({ onAccountCreated }: { onAccountCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (data.success) {
        onAccountCreated();
      } else {
        alert(data.error || 'Error creating account.');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating account.');
    }
  };

  return (
    <motion.div
      className="max-w-md w-full bg-white p-6 rounded-lg shadow-lg mx-4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-600">
        Welcome to Homebase Forum!
      </h2>
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-2 mb-4 border rounded" required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 mb-4 border rounded" required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 mb-4 border rounded" required />
        <button type="submit" className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          Create Account
        </button>
      </form>
    </motion.div>
  );
}

// -----------------------------
// 3. ProfileSettings Component (Edit Own Profile)
// -----------------------------
function ProfileSettings({
  onClose,
  currentUser,
  updateUser,
}: {
  onClose: () => void;
  currentUser: any;
  updateUser: (updates: any) => void;
}) {
  const [name, setName] = useState(currentUser.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProfileImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
    try {
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, profileImage: null }),
      });
      const data = await res.json();
      if (data.success) {
        updateUser({ name, profileImage: null });
        onClose();
      } else {
        alert(data.error || 'Error updating profile.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating profile.');
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md mx-4"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
      >
        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-1">Profile Image</label>
            <input type="file" onChange={handleImageUpload} />
          </div>
          <div className="mb-4">
            <label className="block mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded" required />
          </div>
          <div className="mb-4">
            <label className="block mb-1">New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div className="mb-4">
            <label className="block mb-1">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="mr-4 p-2">Cancel</button>
            <button type="submit" className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Update Profile</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// -----------------------------
// 4. ForumBanner Component (Top Banner)
// -----------------------------
function ForumBanner() {
  return (
    <div className="w-full bg-blue-600 text-white py-4 px-6">
      <h1 className="text-3xl font-bold">Homebase Forum</h1>
      <p className="text-lg">Connect, share, and grow with our community.</p>
    </div>
  );
}

// -----------------------------
// 5. NavBar Component (Top-Right User Avatar)
// -----------------------------
function NavBar({ currentUser, setView }: { currentUser: any; setView: (view: 'feed' | 'myProfile' | 'userProfile') => void; }) {
  return (
    <div className="flex justify-end items-center p-4 bg-white shadow">
      <div onClick={() => setView('myProfile')} className="cursor-pointer">
        {currentUser.profileImage ? (
          <img src={URL.createObjectURL(currentUser.profileImage)} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold">
            {currentUser.name?.charAt(0) || 'U'}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------
// 6. CreatePostBox Component
// -----------------------------
function CreatePostBox({ onClose }: { onClose: () => void; }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, image: null, authorId: 'CURRENT_USER_ID' }),
      });
      const data = await res.json();
      if (data.success) {
        onClose();
      } else {
        alert(data.error || 'Error creating post.');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating post.');
    }
  };

  return (
    <motion.div
      className="bg-white p-6 rounded-lg shadow-md mb-6 mx-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-xl font-bold text-blue-600 mb-4">Create Post</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post Title"
          className="w-full border border-gray-300 rounded-md py-2 px-4 mb-4 focus:outline-none focus:border-blue-600"
          required
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full border border-gray-300 rounded-md py-2 px-4 mb-4 h-32 resize-none focus:outline-none focus:border-blue-600"
          required
        />
        <div className="flex items-center mb-4">
          <label htmlFor="imageUpload" className="flex items-center justify-center w-10 h-10 border border-dashed border-gray-400 rounded-md cursor-pointer hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </label>
          <input id="imageUpload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          {image && <span className="ml-4 text-sm text-gray-600">{image.name}</span>}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="mr-4 px-4 py-2 rounded-md text-gray-600 hover:bg-gray-200">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Post
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// -----------------------------
// 7. Nested Comments & Replies Components
// -----------------------------
function addReply(commentList: any[], parentId: number, newReply: any): any[] {
  return commentList.map((c) => {
    if (c.id === parentId) {
      return { ...c, replies: [...c.replies, newReply] };
    }
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: addReply(c.replies, parentId, newReply) };
    }
    return c;
  });
}

function updateVote(commentList: any[], commentId: number, direction: 'up' | 'down'): any[] {
  return commentList.map((c) => {
    if (c.id === commentId) {
      return direction === 'up'
        ? { ...c, upvotes: c.upvotes + 1 }
        : { ...c, downvotes: c.downvotes + 1 };
    }
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: updateVote(c.replies, commentId, direction) };
    }
    return c;
  });
}

function CommentItem({
  comment,
  onReplySubmit,
  onUpvote,
  onDownvote,
  onUserClick,
}: {
  comment: any;
  onReplySubmit: (parentId: number, replyText: string) => void;
  onUpvote: (commentId: number) => void;
  onDownvote: (commentId: number) => void;
  onUserClick: (username: string) => void;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleReply = () => {
    onReplySubmit(comment.id, replyText);
    setReplyText('');
    setShowReplyForm(false);
  };

  return (
    <div className="mb-4">
      <div className="flex items-start mb-2">
        <div onClick={() => onUserClick(comment.author)} className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-bold mr-2 cursor-pointer">
          {comment.avatar}
        </div>
        <div>
          <p className="text-sm text-gray-800">
            <span onClick={() => onUserClick(comment.author)} className="font-bold text-blue-600 mr-1 cursor-pointer hover:underline">
              {comment.author}
            </span>
            {comment.content}
          </p>
          <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
            <span>{comment.timestamp}</span>
            <button onClick={() => onUpvote(comment.id)} className="hover:text-blue-600">▲ {comment.upvotes}</button>
            <button onClick={() => onDownvote(comment.id)} className="hover:text-red-600">▼ {comment.downvotes}</button>
            <button onClick={() => setShowReplyForm(!showReplyForm)} className="hover:underline">Reply</button>
          </div>
          {showReplyForm && (
            <div className="mt-2 ml-6">
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write your reply..." className="w-full border border-gray-300 rounded-md p-2 text-sm" />
              <button onClick={handleReply} className="mt-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                Submit Reply
              </button>
            </div>
          )}
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 border-l border-gray-300 pl-4">
          {comment.replies.map((reply: any) => (
            <CommentItem key={reply.id} comment={reply} onReplySubmit={onReplySubmit} onUpvote={onUpvote} onDownvote={onDownvote} onUserClick={onUserClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentSection({
  comments,
  updateComments,
  onUserClick,
}: {
  comments: any[];
  updateComments: (newComments: any[]) => void;
  onUserClick: (username: string) => void;
}) {
  const handleReplySubmit = (parentId: number, replyText: string) => {
    if (!replyText.trim()) return;
    const newReply = {
      id: Date.now(),
      author: 'You',
      avatar: 'Y',
      content: replyText,
      timestamp: 'just now',
      upvotes: 0,
      downvotes: 0,
      replies: [],
    };
    const updated = addReply(comments, parentId, newReply);
    updateComments(updated);
  };

  const handleUpvote = (commentId: number) => {
    const updated = updateVote(comments, commentId, 'up');
    updateComments(updated);
  };

  const handleDownvote = (commentId: number) => {
    const updated = updateVote(comments, commentId, 'down');
    updateComments(updated);
  };

  return (
    <div className="border-t border-gray-200 pt-4">
      <h4 className="text-sm font-semibold text-gray-600 mb-2">Comments</h4>
      {comments.map((c) => (
        <CommentItem key={c.id} comment={c} onReplySubmit={handleReplySubmit} onUpvote={handleUpvote} onDownvote={handleDownvote} onUserClick={onUserClick} />
      ))}
    </div>
  );
}

// -----------------------------
// 8. MyProfilePage Component
// -----------------------------
function MyProfilePage({ currentUser, setShowProfileSettings }: { currentUser: any; setShowProfileSettings: (val: boolean) => void; }) {
  return (
    <div className="p-4 bg-white rounded shadow m-4 flex-1">
      <div className="flex items-center mb-6">
        {currentUser.profileImage ? (
          <img src={URL.createObjectURL(currentUser.profileImage)} alt="Profile" className="w-16 h-16 rounded-full object-cover mr-4" />
        ) : (
          <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center text-white text-2xl mr-4">
            {currentUser.name?.charAt(0) || 'U'}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold">{currentUser.name || 'Unnamed User'}</h2>
          <button onClick={() => setShowProfileSettings(true)} className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            Edit Profile
          </button>
        </div>
      </div>
      <p className="text-gray-700 mb-4"><strong>My Likes:</strong> (Your liked posts and comments will appear here.)</p>
      <p className="text-gray-700 mb-4"><strong>My Comments:</strong> (Your comments will appear here.)</p>
      <p className="text-gray-700 mb-4"><strong>My Replies:</strong> (Your replies will appear here.)</p>
      <p className="text-gray-700 mb-4"><strong>My Threads:</strong> (Your created threads will appear here.)</p>
    </div>
  );
}

// -----------------------------
// 9. UserProfilePage Component (for Other Users)
// (Defined only once)
// -----------------------------
function UserProfilePage({ username, onBack }: { username: string; onBack: () => void; }) {
  return (
    <div className="p-4 bg-white rounded shadow m-4 flex-1">
      <button onClick={onBack} className="text-blue-600 hover:underline mb-4">
        ← Back to Feed
      </button>
      <h2 className="text-2xl font-bold mb-2">{username}'s Profile</h2>
      <p className="text-gray-700 mb-4">(Placeholder for {username}'s posts, likes, etc.)</p>
      <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
        Follow {username}
      </button>
    </div>
  );
}

// -----------------------------
// 10. PostCard Component
// -----------------------------
function PostCard({ post, onUserClick }: { post: any; onUserClick: (username: string) => void; }) {
  const [localComments, setLocalComments] = useState(post.comments);
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center mb-4">
        <div onClick={() => onUserClick(post.author)} className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3 cursor-pointer">
          {post.avatar}
        </div>
        <div>
          <h3 onClick={() => onUserClick(post.author)} className="text-lg font-bold text-blue-600 cursor-pointer hover:underline">
            {post.author}
          </h3>
          <span className="text-sm text-gray-500">{post.timestamp}</span>
        </div>
      </div>
      <p className="text-gray-800 mb-4">{post.content}</p>
      {localComments.length > 0 && (
        <CommentSection comments={localComments} updateComments={setLocalComments} onUserClick={onUserClick} />
      )}
    </div>
  );
}

// -----------------------------
// 11. Forum Component (Main Forum Page - No Sidebar on Homepage)
// -----------------------------
function Forum() {
  const [activeFeed, setActiveFeed] = useState('For You');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [view, setView] = useState<'feed' | 'myProfile' | 'userProfile'>('feed');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>({ name: 'Teagan', profileImage: null });
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  const handleUserClick = (username: string) => {
    if (username === currentUser.name) {
      setView('myProfile');
    } else {
      setSelectedUser(username);
      setView('userProfile');
    }
  };

  const postsToShow = fakePosts.filter((post) => {
    if (activeFeed === 'Following') {
      // Placeholder: In a real app, filter by currentUser.following.
      return post.author === currentUser.name;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ForumBanner />
      <NavBar currentUser={currentUser} setView={setView} />
      <div className="w-full flex flex-col">
        {view === 'feed' && (
          <motion.main className="bg-white p-8 m-4 rounded-lg shadow-md flex-1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-blue-600">Homebase Forum</h1>
                <p className="text-gray-600 mt-2">Connect with fellow Web3 enthusiasts, share ideas, and discover new opportunities.</p>
              </div>
              <button onClick={() => setShowCreatePost(!showCreatePost)} className="mt-4 sm:mt-0 bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition">
                {showCreatePost ? 'Close Post Box' : 'Create Post'}
              </button>
            </div>
            <div className="flex space-x-4 overflow-x-auto border-b border-gray-200 pb-3 mb-6">
              {['For You', 'Following'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFeed(tab)}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${activeFeed === tab ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="mb-6">
              <input type="text" placeholder="Search posts..." className="w-full border border-gray-300 rounded-md py-3 px-4 text-base focus:outline-none focus:border-blue-600" />
            </div>
            <div className="space-y-6">
              {postsToShow.map((post) => (
                <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                  <PostCard post={post} onUserClick={handleUserClick} />
                </motion.div>
              ))}
            </div>
          </motion.main>
        )}
        {view === 'myProfile' && (
          <motion.div className="m-4 flex-1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <MyProfilePage currentUser={currentUser} setShowProfileSettings={setShowProfileSettings} />
          </motion.div>
        )}
        {view === 'userProfile' && (
          <motion.div className="m-4 flex-1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <UserProfilePage username={selectedUser} onBack={() => setView('feed')} />
          </motion.div>
        )}
      </div>
      <AnimatePresence>
        {showProfileSettings && (
          <ProfileSettings onClose={() => setShowProfileSettings(false)} currentUser={currentUser} updateUser={(updates) => setCurrentUser({ ...currentUser, ...updates })} />
        )}
      </AnimatePresence>
    </div>
  );
}

// -----------------------------
// 12. ForumContainer: Conditional Rendering (Login vs. Forum)
// -----------------------------
export default function ForumPage() {
  const [accountCreated, setAccountCreated] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <AnimatePresence exitBeforeEnter>
        {accountCreated ? (
          <motion.div key="forum" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }}>
            <Forum />
          </motion.div>
        ) : (
          <motion.div key="createAccount" className="flex items-center justify-center min-h-screen" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.5 }}>
            <CreateAccount onAccountCreated={() => setAccountCreated(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}




