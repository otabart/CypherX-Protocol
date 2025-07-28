import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "../../lib/firebase.ts"; // Adjusted path

// Interface for Block data (matches Firestore rules)
interface Block {
  number: number;
  status: string;
  timestamp: string;
  hash: string;
  transactions: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { block } = req.body;
  if (!block || !block.number) {
    return res.status(400).json({ error: "Invalid block data: block or block.number missing" });
  }

  // Validate block data (mimics validateBlock() from Firestore rules)
  const validateBlock = (data: Block): boolean => {
    return (
      typeof data.number === "number" &&
      data.number >= 0 &&
      typeof data.status === "string" &&
      data.status.length > 0 &&
      typeof data.timestamp === "string" &&
      data.timestamp.length > 0 &&
      typeof data.hash === "string" &&
      data.hash.length > 0 &&
      typeof data.transactions === "number" &&
      data.transactions >= 0
    );
  };

  if (!validateBlock(block)) {
    return res.status(400).json({ error: "Block data validation failed" });
  }

  try {
    await adminDb.collection("blocks").doc(block.number.toString()).set(block);
    res.status(200).json({ message: `Block ${block.number} stored` });
  } catch (error: unknown) { // Changed from any to unknown
    console.error("Store block error:", error instanceof Error ? error.message : "Unknown error");
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}