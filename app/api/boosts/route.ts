import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export async function GET() {
  try {
    const boostedTokensSnapshot = await getDocs(collection(db, "boosts"));
    const boosts: { pairAddress: string; boostValue: number }[] = [];
    boostedTokensSnapshot.forEach((doc) => {
      const data = doc.data();
      boosts.push({
        pairAddress: data.pairAddress,
        boostValue: data.boostValue,
      });
    });
    return NextResponse.json(boosts);
  } catch (error) {
    console.error("Error fetching boosts:", error);
    return NextResponse.json({ error: "Failed to fetch boosts" }, { status: 500 });
  }
}