import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col font-sans selection:bg-[#378ADD]/30">
      {/* Navbar */}
      <nav className="w-full h-11 bg-[#1a1a1a] border-b border-[#2c2c2c] px-6 flex items-center justify-between sticky top-0 z-50">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <div className="w-[6px] h-[6px] rounded-full bg-[#378ADD]"></div>
          <span className="font-mono text-[13px] font-medium text-white tracking-wider uppercase select-none">
            retrieva
          </span>
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `font-mono text-[12px] px-2.5 py-1 transition-colors select-none ${
                isActive
                  ? 'bg-[#262626] border border-[#2c2c2c] rounded-[6px] text-white'
                  : 'text-[#888780] hover:text-white'
              }`
            }
          >
            Documents
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `font-mono text-[12px] px-2.5 py-1 transition-colors select-none ${
                isActive
                  ? 'bg-[#262626] border border-[#2c2c2c] rounded-[6px] text-white'
                  : 'text-[#888780] hover:text-white'
              }`
            }
          >
            About
          </NavLink>
        </div>

        {/* Right: Profile & Logout */}
        <div className="flex items-center gap-4">
          {user && (
            <span className="font-mono text-[11px] text-[#888780] max-w-[200px] truncate select-all">
              {user.email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="bg-transparent border border-[#2c2c2c] font-mono text-[11px] text-[#888780] px-2 py-0.5 rounded-[4px] hover:text-white hover:border-[#444441] transition-colors cursor-pointer"
          >
            sign out
          </button>
        </div>
      </nav>

      {/* Viewport content */}
      <main className="flex-1 bg-[#0b0b0b]">
        {children}
      </main>
    </div>
  );
}
