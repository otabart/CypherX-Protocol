// app/api/competitions/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "tournaments"));
    const competitions: any[] = [];
    snapshot.forEach((doc) => {
      competitions.push({ id: doc.id, ...doc.data() });
    });

    return NextResponse.json({ competitions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    return NextResponse.json({ error: "Failed to fetch tournaments" }, { status: 500 });
  }
}


