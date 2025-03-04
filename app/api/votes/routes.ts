import { NextResponse } from "next/server";
import dbConnect from "../../lib/mongodb";
import Prediction from "../../models/Prediction";

export async function POST(req: Request) {
  await dbConnect();
  const { predictionId, voteType } = await req.json();

  const prediction = await Prediction.findById(predictionId);
  if (!prediction) return NextResponse.json({ error: "Prediction not found" }, { status: 404 });

  if (voteType === "up") {
    prediction.upvotes += 1;
  } else if (voteType === "down") {
    prediction.downvotes += 1;
  }

  await prediction.save();
  return NextResponse.json({ message: "Vote recorded!", prediction });
}
