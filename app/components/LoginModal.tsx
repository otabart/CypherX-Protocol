'use client';

import { useState } from 'react';

const LoginModal = ({ onClose }: { onClose: () => void }) => {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-black"
        >
          ✖
        </button>

        {/* Login or Sign Up Form */}
        {isSignUp ? (
          <div>
            <h2 className="text-xl font-bold mb-4">Create an Account</h2>
            <form>
              <input
                type="email"
                placeholder="Email"
                className="w-full border border-gray-300 rounded-md p-2 mb-4"
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full border border-gray-300 rounded-md p-2 mb-4"
              />
              <button
                type="submit"
                className="w-full bg-primaryBlue text-white py-2 rounded-md hover:bg-blue-700 transition-all"
              >
                Sign Up
              </button>
            </form>
            <p className="text-sm text-center mt-4">
              Already have an account?{' '}
              <span
                onClick={() => setIsSignUp(false)}
                className="text-primaryBlue cursor-pointer"
              >
                Login
              </span>
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold mb-4">Login</h2>
            <form>
              <input
                type="email"
                placeholder="Email"
                className="w-full border border-gray-300 rounded-md p-2 mb-4"
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full border border-gray-300 rounded-md p-2 mb-4"
              />
              <button
                type="submit"
                className="w-full bg-primaryBlue text-white py-2 rounded-md hover:bg-blue-700 transition-all"
              >
                Login
              </button>
            </form>
            <p className="text-sm text-center mt-4">
              Don't have an account?{' '}
              <span
                onClick={() => setIsSignUp(true)}
                className="text-primaryBlue cursor-pointer"
              >
                Sign Up
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
