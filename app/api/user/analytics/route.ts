// app/api/user/analytics/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("wallet");
  if (!walletAddress) {
    return NextResponse.json({ success: false, message: "Missing wallet address" }, { status: 400 });
  }
  try {
    const q = query(collection(db, "competitionParticipants"), where("walletAddress", "==", walletAddress));
    const snapshot = await getDocs(q);
    let totalProfit = 0;
    let totalROI = 0;
    let totalTrades = 0;
    let count = 0;
    snapshot.forEach((doc) => {
      const data = doc.data();
      totalProfit += data.profit || 0;
      totalROI += data.roi || 0;
      totalTrades += data.trades || 0;
      count++;
    });
    const averageROI = count ? totalROI / count : 0;
    return NextResponse.json({ success: true, analytics: { totalCompetitions: count, totalProfit, averageROI, totalTrades } });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch analytics" }, { status: 500 });
  }
}
