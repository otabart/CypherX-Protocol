// app/api/competitions/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // In a real application, replace this with a database query.
  const competitions = [
    {
      id: "weekly-grand",
      title: "Weekly Grand Challenge",
      description: "A 7-day epic competition on Base, top ROI wins big!",
      entryFee: "0.01 ETH",
      prizePoolType: "fixed",
      fixedPrizePool: "2000 USDC",
    },
    {
      id: "community-blitz",
      title: "Community Blitz",
      description:
        "A community-funded tournament where the prize pool grows as more participants join.",
      entryFee: "0.005 ETH",
      prizePoolType: "community",
      basePrizePool: 500,
      contributionPerParticipant: 10,
      participantCount: 25,
    },
  ];

  return NextResponse.json({ competitions });
}
