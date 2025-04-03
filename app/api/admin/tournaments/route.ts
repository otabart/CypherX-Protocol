// app/api/admin/tournaments/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      entryFee,
      prizeFundingType,
      fixedPrizePool,
      basePrizePool,
      contributionPerParticipant,
      startDate,
      maxParticipants,
    } = body;
    
    if (!title || !description || entryFee <= 0 || !startDate || maxParticipants <= 0) {
      return NextResponse.json({ success: false, message: "Invalid data" }, { status: 400 });
    }
    
    const docRef = await addDoc(collection(db, "tournaments"), {
      title,
      description,
      entryFee,
      prizeFundingType,
      fixedPrizePool: prizeFundingType === "self" ? fixedPrizePool : null,
      basePrizePool: prizeFundingType === "community" ? basePrizePool : null,
      contributionPerParticipant: prizeFundingType === "community" ? contributionPerParticipant : null,
      startDate,
      maxParticipants,
      createdAt: serverTimestamp(),
    });
    
    return NextResponse.json({
      success: true,
      tournament: { id: docRef.id, title, description, entryFee, prizeFundingType, startDate, maxParticipants },
    });
  } catch (error) {
    console.error("Error creating tournament:", error);
    return NextResponse.json({ success: false, message: "Failed to create tournament" }, { status: 500 });
  }
}


