import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

export default function Register() {
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password
      });

      if (response.data && response.data.token) {
        signIn(response.data.token, response.data.user);
      } else {
        setError('Registration failed. Invalid response.');
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Connection to auth server failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#0b0b0b] flex items-center justify-center p-4">
      {/* Centered card */}
      <div className="w-full max-w-[400px] bg-[#1a1a1a] border border-[#2c2c2c] rounded-[12px] p-8 flex flex-col items-center">
        {/* App Logo Header */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {/* 6px circle blue dot */}
          <div className="w-[6px] h-[6px] rounded-full bg-[#378ADD]"></div>
          <span className="font-mono text-[16px] font-medium text-white tracking-wider">
            Retrieva
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#888780] font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="bg-[#262626] border border-[#444441] rounded-[6px] text-white text-[13px] px-3 py-2 focus:border-[#378ADD] focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#888780] font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="bg-[#262626] border border-[#444441] rounded-[6px] text-white text-[13px] px-3 py-2 focus:border-[#378ADD] focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-[#888780] font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-[#262626] border border-[#444441] rounded-[6px] text-white text-[13px] px-3 py-2 focus:border-[#378ADD] focus:outline-none"
              required
            />
          </div>

          {/* Inline Error Message */}
          {error && (
            <div className="text-[12px] text-[#E24B4A] font-mono mt-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#378ADD] text-white w-full rounded-[6px] text-[13px] font-medium py-2.5 mt-4 hover:bg-[#2b70b5] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        {/* Secondary redirect link */}
        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-[12px] text-[#888780] hover:text-white transition-colors"
          >
            Already have an account? Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
