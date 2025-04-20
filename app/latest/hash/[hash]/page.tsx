"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { db } from "../../../../lib/firebase.ts";
import { collection, query, where, getDocs } from "firebase/firestore";
import Link from "next/link";

interface Block {
  number: number;
  status: string;
  timestamp: string;
  hash: string;
  transactions: number;
}

export default function HashPage() {
  const { hash } = useParams();
  const [block, setBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBlockByHash = async () => {
      if (!hash || typeof hash !== "string") {
        setError("Invalid hash");
        setLoading(false);
        return;
      }

      try {
        const blocksRef = collection(db, "blocks");
        const q = query(blocksRef, where("hash", "==", hash));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError("Block not found");
        } else {
          const blockData = querySnapshot.docs[0].data() as Block;
          setBlock(blockData);
        }
      } catch (err: any) {
        console.error("Fetch block error:", err);
        setError("Failed to fetch block: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockByHash();
  }, [hash]);

  return (
    <div className="min-h-screen w-full font-mono bg-black text-white">
      <div className="border border-[#333333] shadow-[0_2px_8px_rgba(0,82,255,0.2)] w-full min-h-screen">
        <div className="flex items-center justify-between px-4 py-3 sm:px-3 sm:py-2 bg-[#1A1A1A]">
          <h1 className="text-lg sm:text-base font-semibold">[ HASH DETAILS ]</h1>
        </div>
        <div className="p-4 sm:p-3">
          {loading ? (
            <div className="text-center py-4 sm:py-3">
              <div className="flex justify-center items-center">
                <svg
                  className="w-6 h-6 sm:w-5 sm:h-5 animate-spin text-[#0052FF]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z"
                  />
                </svg>
                <span className="ml-2 text-gray-400 text-sm sm:text-xs">[LOADING...]</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-4 sm:py-3 text-red-400 text-sm sm:text-xs">
              ERR: {error}
            </div>
          ) : block ? (
            <div className="space-y-4 sm:space-y-3">
              <div>
                <h2 className="text-[#0052FF] text-sm sm:text-xs font-semibold">HASH</h2>
                <p className="break-all text-sm sm:text-xs">{block.hash}</p>
              </div>
              <div>
                <h2 className="text-[#0052FF] text-sm sm:text-xs font-semibold">BLOCK NUMBER</h2>
                <Link href={`/latest/block/${block.number}`} className="text-[#0052FF] hover:underline text-sm sm:text-xs">
                  {block.number}
                </Link>
              </div>
              <div>
                <h2 className="text-[#0052FF] text-sm sm:text-xs font-semibold">STATUS</h2>
                <p className="text-green-500 text-sm sm:text-xs">[ {block.status} ]</p>
              </div>
              <div>
                <h2 className="text-[#0052FF] text-sm sm:text-xs font-semibold">TIMESTAMP</h2>
                <p className="text-gray-400 text-sm sm:text-xs">{block.timestamp}</p>
              </div>
              <div>
                <h2 className="text-[#0052FF] text-sm sm:text-xs font-semibold">TRANSACTIONS</h2>
                <p className="text-sm sm:text-xs">{block.transactions}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 sm:py-3 text-gray-400 text-sm sm:text-xs">
              [NO DATA AVAILABLE]
            </div>
          )}
          <div className="mt-4 sm:mt-3">
            <Link href="/latest" className="text-[#0052FF] hover:underline text-sm sm:text-xs">
              ← Back to HomeScan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}