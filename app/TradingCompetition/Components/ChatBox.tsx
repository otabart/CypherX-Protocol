// app/TradingCompetition/Components/ChatBox.tsx
"use client";
import React, { useEffect, useState } from "react";
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
    <div className="bg-gray-900 p-4 rounded shadow-md max-w-md">
      <div className="max-h-64 overflow-y-auto mb-4">
        {messages.map((msg) => (
          <div key={msg.id} className="mb-2">
            <strong>{msg.user}: </strong>
            <span>{msg.message}</span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSendMessage} className="flex space-x-2">
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 p-2 border border-gray-700 rounded bg-black text-white"
        />
        <button type="submit" className="px-4 py-2 bg-[#0052FF] text-white rounded hover:bg-blue-500">
          Send
        </button>
      </form>
    </div>
  );
}
