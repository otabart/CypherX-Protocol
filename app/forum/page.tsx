'use client';

import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

// Types for Topic and Reply
type Reply = {
  id: number;
  content: string;
  replies: Reply[];
};

type Topic = {
  id: number;
  title: string;
  replies: Reply[];
};

export default function Forum() {
  const [topics, setTopics] = useState<Topic[]>([
    { id: 1, title: 'Coin Discussion', replies: [] },
    { id: 2, title: 'DApps and Analytics', replies: [] },
    { id: 3, title: 'New Launches', replies: [] },
  ]);

  const [newTopic, setNewTopic] = useState('');
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [newReply, setNewReply] = useState('');
  const [replyTarget, setReplyTarget] = useState<Reply | null>(null);

  const handleAddTopic = () => {
    if (newTopic.trim()) {
      setTopics((prev) => [
        ...prev,
        { id: prev.length + 1, title: newTopic.trim(), replies: [] },
      ]);
      setNewTopic('');
    }
  };

  const handleAddReply = (parentId: number | null) => {
    if (newReply.trim()) {
      const newReplyObj: Reply = {
        id: Date.now(),
        content: newReply.trim(),
        replies: [],
      };

      if (replyTarget) {
        const updateReplies = (replies: Reply[]): Reply[] =>
          replies.map((reply) =>
            reply.id === parentId
              ? { ...reply, replies: [...reply.replies, newReplyObj] }
              : { ...reply, replies: updateReplies(reply.replies) }
          );

        setTopics((prev) =>
          prev.map((topic) =>
            topic.id === activeTopic?.id
              ? { ...topic, replies: updateReplies(topic.replies) }
              : topic
          )
        );
      } else if (activeTopic) {
        setTopics((prev) =>
          prev.map((topic) =>
            topic.id === activeTopic.id
              ? { ...topic, replies: [...topic.replies, newReplyObj] }
              : topic
          )
        );
      }

      setNewReply('');
      setReplyTarget(null);
    }
  };

  const renderReplies = (replies: Reply[]) => (
    <ul className="space-y-2">
      {replies.map((reply) => (
        <li key={reply.id} className="p-4 border rounded-md bg-gray-100">
          <p>{reply.content}</p>
          <button
            onClick={() => setReplyTarget(reply)}
            className="text-sm text-primaryBlue underline mt-2"
          >
            Reply
          </button>
          {reply.replies.length > 0 && (
            <div className="ml-4 mt-2">{renderReplies(reply.replies)}</div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <Header />

      <main className="flex-grow container mx-auto py-12 px-4">
        <h1 className="text-4xl font-extrabold text-primaryBlue text-center mb-8">
          Homebase Forum
        </h1>

        {activeTopic === null ? (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Topics</h2>
              <ul className="space-y-4">
                {topics.map((topic) => (
                  <li
                    key={topic.id}
                    className="p-4 shadow-md border rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => setActiveTopic(topic)}
                  >
                    <h3 className="text-xl font-bold text-primaryBlue">
                      {topic.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {topic.replies.length} replies
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Enter a new topic..."
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="flex-grow px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-primaryBlue"
              />
              <button
                onClick={handleAddTopic}
                className="px-4 py-2 bg-primaryBlue text-white rounded-md hover:bg-blue-700 transition-all"
              >
                Add Topic
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setActiveTopic(null)}
              className="mb-4 text-primaryBlue underline"
            >
              Back to Topics
            </button>
            <div className="p-4 shadow-md border rounded-lg mb-8">
              <h3 className="text-xl font-bold text-primaryBlue">
                {activeTopic.title}
              </h3>
              {renderReplies(activeTopic.replies)}
            </div>

            <div className="flex gap-4">
              <input
                type="text"
                placeholder={`Reply to ${
                  replyTarget ? 'a reply' : 'this topic'
                }...`}
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                className="flex-grow px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-primaryBlue"
              />
              <button
                onClick={() =>
                  replyTarget
                    ? handleAddReply(replyTarget.id)
                    : handleAddReply(null)
                }
                className="px-4 py-2 bg-primaryBlue text-white rounded-md hover:bg-blue-700 transition-all"
              >
                Post Reply
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}




