'use client';

import Link from 'next/link';

const ToolCard = ({ title, description, link }: { title: string; description: string; link: string }) => {
  return (
    <Link href={link} className="block">
      <div className="p-6 bg-white shadow-md rounded-lg hover:shadow-xl transition-transform transform hover:scale-105 cursor-pointer border">
        <h3 className="text-2xl font-bold text-primaryBlue">{title}</h3>
        <p className="text-gray-600 mt-2">{description}</p>
        <span className="text-primaryBlue mt-4 inline-block font-semibold">Explore →</span>
      </div>
    </Link>
  );
};

export default ToolCard;
