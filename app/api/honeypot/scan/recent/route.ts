// File: app/api/honeypot/recent/route.ts
import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error("Missing MONGO_URI");
}
const client = new MongoClient(uri);

export async function GET() {
  try {
    await client.connect();
    const db = client.db("HomebaseDB");
    const scansCollection = db.collection("honeypotScans");

    // Retrieve the 10 most recent scans
    const recentScans = await scansCollection
      .find({})
      .sort({ scannedAt: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json(recentScans, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching recent scans:", err);
    return NextResponse.json({ error: "Failed to fetch recent scans" }, { status: 500 });
  } finally {
    await client.close();
  }
}



