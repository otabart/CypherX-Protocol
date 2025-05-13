// pages/api/ads.ts
import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

interface Ad {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  altText: string;
  type: 'banner' | 'sidebar' | 'inline';
  createdAt: string;
}

export async function GET(request: Request) {
  try {
    const adsCol = collection(db, "adImageUrl");
    const q = query(adsCol, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const ads: Ad[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      ads.push({
        id: doc.id,
        imageUrl: data.imageUrl,
        destinationUrl: data.destinationUrl,
        altText: data.altText,
        type: data.type,
        createdAt: data.createdAt.toDate().toISOString(),
      });
    });
    console.log("Ads from /api/ads:", ads.map((a) => a.id));
    return NextResponse.json(ads);
  } catch (error) {
    console.error("Error fetching ads:", error);
    return NextResponse.json({ error: "Error fetching ads" }, { status: 500 });
  }
}