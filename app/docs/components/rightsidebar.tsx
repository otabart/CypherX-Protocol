"use client";

export default function RightSidebar() {
  return (
    <aside className="w-64 bg-black p-4 h-full border-r border-green-700">
      <h3 className="text-lg font-bold mb-4">Docs Info</h3>
      <div className="mb-4">
        <span className="font-bold">Last Global Update:</span>
        <span> April 6, 2025</span>
      </div>
      <ul className="space-y-2 text-sm">
        <li>
          <a href="#" className="text-green-400 hover:underline">
            Submit an Issue
          </a>
        </li>
        <li>
          <a href="#" className="text-green-400 hover:underline">
            Contribute to Beta Testing
          </a>
        </li>
        <li>
          <a href="#" className="text-green-400 hover:underline">
            Go back Home
          </a>
        </li>
      </ul>

      <div className="mt-6 p-4 bg-green-900 rounded-md">
        <p className="text-sm text-green-300">
          Need more help? Ask the community in our forum, or contact our support team at homebasemarkets@gmail.com
        </p>
      </div>
    </aside>
  );
}



