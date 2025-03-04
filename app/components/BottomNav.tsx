import Link from "next/link";
import { HomeIcon, TrophyIcon, ChartIcon, VerifiedIcon } from "./icons";

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t flex justify-around py-3 shadow-md">
      <Link href="/" className="text-center">
        <HomeIcon className="w-6 h-6 text-gray-600" />
        <p className="text-xs text-gray-600">Home</p>
      </Link>
      <Link href="/analysts/leaderboard" className="text-center">
        <TrophyIcon className="w-6 h-6 text-gray-600" />
        <p className="text-xs text-gray-600">Leaderboard</p>
      </Link>
      <Link href="/analysts/feed" className="text-center">
        <ChartIcon className="w-6 h-6 text-gray-600" />
        <p className="text-xs text-gray-600">Predictions</p>
      </Link>
      <Link href="/analysts/verified" className="text-center">
        <VerifiedIcon className="w-6 h-6 text-gray-600" />
        <p className="text-xs text-gray-600">Verified</p>
      </Link>
    </nav>
  );
}
