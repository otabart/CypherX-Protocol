'use client';

export default function UserProfile() {
  return (
    <div className="p-6 border rounded-lg shadow-md bg-gray-50">
      <h2 className="text-2xl font-bold text-primaryBlue mb-4">Your Profile</h2>
      <p className="text-lg">Name: John Doe</p>
      <p className="text-lg">Email: john.doe@example.com</p>
      <p className="text-lg">Member Since: January 2025</p>
      <button className="mt-4 px-4 py-2 bg-primaryBlue text-white rounded-md hover:bg-blue-700 transition-all">
        Edit Profile
      </button>
    </div>
  );
}
