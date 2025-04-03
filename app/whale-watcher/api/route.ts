// app/whale-watcher/api/route.ts
import { NextResponse } from "next/server";
import { tokenMapping } from "../../tokenMapping"; // Adjust the path if needed

// Optional: Export GET to return a friendly message or error
export async function GET() {
  return NextResponse.json(
    { error: "GET method is not supported on this endpoint. Use POST." },
    { status: 405 }
  );
}

// Export POST to handle incoming whale transaction payloads
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log("Received payload:", payload);
    // Here you would process or save the payload to your database
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing POST request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

