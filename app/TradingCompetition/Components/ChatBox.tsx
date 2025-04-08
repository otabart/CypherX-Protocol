// app/TradingCompetition/Components/ChatBox.tsx
"use client";
import React, { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { useCompetitionContext } from "../CompetitionContext";

type ChatMessage = {
  id: string;
  user: string;
  message: string;
  createdAt: any;
};

export default function ChatBox({ tournamentId }: { tournamentId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const { displayName } = useCompetitionContext();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "tournamentChats"),
      where("tournamentId", "==", tournamentId)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          msgs.push({ id: doc.id, user: data.user, message: data.message, createdAt: data.createdAt });
        });
        msgs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        setMessages(msgs);
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      },
      (error) => {
        console.error("Error fetching chat messages:", error);
      }
    );
    return () => unsubscribe();
  }, [tournamentId]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!displayName) {
      toast.error("Please set your display name to send messages.");
      return;
    }
    try {
      await addDoc(collection(db, "tournamentChats"), {
        tournamentId,
        user: displayName,
        message: newMessage,
        createdAt: serverTimestamp(),
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  }

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow-lg border border-[#0052FF] w-full max-w-md">
      <h3 className="text-lg font-bold text-white mb-3">Chat</h3>
      <div className="max-h-64 overflow-y-auto mb-4 bg-gray-800 p-2 rounded">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-sm">No messages yet.</p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`mb-2 p-2 rounded ${index % 2 === 0 ? "bg-gray-700" : "bg-gray-600"}`}
            >
              <div className="flex justify-between items-baseline">
                <strong className="text-[#0052FF]">{msg.user}</strong>
                <span className="text-xs text-gray-400">
                  {msg.createdAt?.toDate ? new Date(msg.createdAt.toDate()).toLocaleTimeString() : "Just now"}
                </span>
              </div>
              <p className="text-white text-sm">{msg.message}</p>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 p-2 bg-black border border-gray-700 rounded text-white focus:outline-none focus:border-[#0052FF] transition"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-[#0052FF] to-blue-600 text-white rounded hover:from-blue-600 hover:to-blue-800 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
