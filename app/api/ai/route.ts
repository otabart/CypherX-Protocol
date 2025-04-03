// File: /app/api/ai/route.ts (or /pages/api/ai.ts in older Next.js)
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }

    // IMPORTANT: Always store your real key in an environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No API key set." }, { status: 500 });
    }

    // Call OpenAI’s Chat or Completion endpoint:
    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", 
        messages: [
          { role: "user", content: prompt }
        ],
        // add any other params you want, e.g. temperature, etc.
      }),
    });

    if (!apiRes.ok) {
      const err = await apiRes.text();
      return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: apiRes.status });
    }

    const data = await apiRes.json();
    const aiReply = data?.choices?.[0]?.message?.content || "(No response)";

    return NextResponse.json({ reply: aiReply });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
