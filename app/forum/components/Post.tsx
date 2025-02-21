'use client';

export default function Post({ post }: { post: any }) {
  const handleLike = async () => {
    try {
      const res = await fetch(`/api/posts/${post._id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'CURRENT_USER_ID' }),
      });
      const data = await res.json();
      if (data.success) {
        // Optionally update local UI state
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="text-sm text-gray-500">{post.author?.username}</div>
      <div className="mt-2">{post.content}</div>
      <button onClick={handleLike} className="mt-2 text-blue-600 hover:underline">
        Like ({post.likes.length})
      </button>
      {/* Comments, etc. */}
    </div>
  );
}



