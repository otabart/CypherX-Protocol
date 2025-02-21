// File: app/api/honeypot/save/route.ts
import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error("Missing MONGO_URI");
}
const client = new MongoClient(uri);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await client.connect();
    const db = client.db("HomebaseDB");
    const scansCollection = db.collection("honeypotScans");

    const result = await scansCollection.insertOne({
      ...body,
      scannedAt: new Date()
    });

    return NextResponse.json({ message: "Scan saved successfully", id: result.insertedId }, { status: 200 });
  } catch (err: any) {
    console.error("Error saving scan:", err);
    return NextResponse.json({ error: "Failed to save scan" }, { status: 500 });
  } finally {
    await client.close();
  }
}



