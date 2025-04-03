"use client";

import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

// Firebase client configuration (ensure these env variables are set)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface WhaleTx {
  id?: string;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress?: string;
  amountToken: number;
  amountUSD: number;
  percentSupply: number;
  fromAddress?: string;
  toAddress?: string;
  source?: string;
  timestamp: number;
}

function WhaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4,30 C4,20 20,10 32,10 C44,10 60,20 60,30 C60,40 44,50 32,50 C20,50 4,40 4,30 Z M32,12 C18,12 8,22 8,30 C8,38 18,48 32,48 C46,48 56,38 56,30 C56,22 46,12 32,12 Z" />
      <circle cx="24" cy="28" r="3" fill="white" />
      <circle cx="40" cy="28" r="3" fill="white" />
    </svg>
  );
}

export default function WhaleWatcherPage() {
  const [transactions, setTransactions] = useState<WhaleTx[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "whaleTransactions"),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs: WhaleTx[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WhaleTx[];
      setTransactions(txs);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="w-screen h-screen bg-black text-white font-mono overflow-auto p-4">
      <header className="border-b border-gray-700 pb-4 mb-4">
        <h1 className="text-2xl font-bold">Whale Watcher Terminal</h1>
        <p className="text-sm text-gray-400">
          Tracking large transactions on Base in real time.
        </p>
      </header>

      {transactions.length === 0 ? (
        <p>No whale transactions yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Token</th>
              <th>Amount</th>
              <th>USD Value</th>
              <th>% of Supply</th>
              <th>From</th>
              <th>To</th>
              <th>Source</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-t border-gray-700">
                <td className="flex items-center space-x-2 py-2">
                  <WhaleIcon className="w-6 h-6 text-blue-400" />
                  <span>{tx.tokenSymbol}</span>
                </td>
                <td>{tx.amountToken.toLocaleString()}</td>
                <td>${tx.amountUSD.toLocaleString()}</td>
                <td>{tx.percentSupply.toFixed(3)}%</td>
                <td className="break-all">{tx.fromAddress || "-"}</td>
                <td className="break-all">{tx.toAddress || "-"}</td>
                <td>{tx.source || "-"}</td>
                <td>{new Date(tx.timestamp).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
