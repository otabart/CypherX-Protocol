'use client';

export default function RightSidebar() {
  return (
    <aside className="
      hidden 
      lg:block 
      w-64 
      bg-black 
      border-l 
      border-gray-700 
      p-4
    ">
      <h3 className="text-lg font-bold mb-4">Docs Info</h3>
      <div className="mb-4">
        <span className="font-bold">Last Global Update:</span>
        <span> February 15, 2025</span>
      </div>
      <ul className="space-y-2 text-sm">
        <li>
          <a href="#" className="text-blue-400 hover:underline">
            Submit an Issue
          </a>
        </li>
        <li>
          <a href="#" className="text-blue-400 hover:underline">
            Contribute to Docs
          </a>
        </li>
        <li>
          <a href="#" className="text-blue-400 hover:underline">
            Homebase Website
          </a>
        </li>
      </ul>

      <div className="mt-6 p-4 bg-gray-800 rounded-md">
        <p className="text-sm text-gray-300">
          Need more help? Ask the community in our forum, or contact our support team at support@homebase.com.
        </p>
      </div>
    </aside>
  );
}







