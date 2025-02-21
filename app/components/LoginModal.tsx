'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

const LoginModal = ({ onClose }: { onClose: () => void }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter(); // ✅ Use router for redirection

  // ✅ Handle Login with NextAuth
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const res = await signIn('credentials', { 
      redirect: false, 
      email, 
      password 
    });

    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        onClose(); 
        router.push('/forum'); // ✅ Redirect after login
      }, 1000);
    }
  };

  // ✅ Handle Sign-Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });

    let data;
    try {
      data = await res.json();
    } catch (err) {
      console.error("🚨 API did not return JSON:", err);
      setError("Unexpected server error. Please try again.");
      return;
    }

    console.log("🚀 API Response:", data);

    if (res.ok) {
      setSuccess('Account created! Redirecting...');
      setTimeout(() => {
        setIsSignUp(false);
        router.push('/forum'); // ✅ Redirect after sign-up
      }, 1000);
    } else {
      setError(data.error || "Something went wrong.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 relative">
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-black">
          ✖
        </button>

        {isSignUp ? (
          // ✅ Sign-Up Form
          <div>
            <h2 className="text-xl font-bold mb-4">Create an Account</h2>
            {error && <p className="text-red-500">{error}</p>}
            {success && <p className="text-green-500">{success}</p>}
            <form onSubmit={handleSignUp}>
              <input
                type="text"
                placeholder="Username"
                className="w-full border p-2 mb-4"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full border p-2 mb-4"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full border p-2 mb-4"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
                Sign Up
              </button>
            </form>
            <p className="text-sm text-center mt-4">
              Already have an account?{' '}
              <span onClick={() => setIsSignUp(false)} className="text-blue-600 cursor-pointer">
                Login
              </span>
            </p>
          </div>
        ) : (
          // ✅ Login Form
          <div>
            <h2 className="text-xl font-bold mb-4">Login</h2>
            {error && <p className="text-red-500">{error}</p>}
            {success && <p className="text-green-500">{success}</p>}
            <form onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email"
                className="w-full border p-2 mb-4"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full border p-2 mb-4"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
                Login
              </button>
            </form>
            <p className="text-sm text-center mt-4">
              Don't have an account?{' '}
              <span onClick={() => setIsSignUp(true)} className="text-blue-600 cursor-pointer">
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



