import { NextResponse } from "next/server";
import { startTokenMonitoring } from "@/lib/monitorTokens.js";

let isMonitoringInitialized = false;

export async function GET() {
  if (isMonitoringInitialized) {
    return NextResponse.json({ message: "Token monitoring already running." });
  }

  try {
    isMonitoringInitialized = true;
    await startTokenMonitoring();
    return NextResponse.json({ message: "Token monitoring started successfully." });
  } catch (err: any) {
    isMonitoringInitialized = false;
    console.error("❌ Failed to start token monitoring in API route:", err.message);
    return NextResponse.json(
      { error: "Failed to start token monitoring", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "POST method is not supported on this endpoint. Use GET." },
    { status: 405 }
  );
}