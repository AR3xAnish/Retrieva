import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#0b0b0b] text-white flex flex-col font-sans selection:bg-[#378ADD]/30">
      {/* Navbar */}
      <header className="border-b border-[#2c2c2c] bg-[#0b0b0b]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Dot */}
          <div className="flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#378ADD]"></div>
            <span className="font-mono text-[16px] font-semibold text-white tracking-wider">
              RETRIEVA
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-[12px] text-[#888780] font-mono">
                  Logged in as <span className="text-white">{user.name}</span>
                </span>
                <Link to="/" className="btn text-[13px] px-4 py-1.5">
                  Go to Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="btn text-[13px] px-4 py-1.5"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-[13px] px-4 py-1.5 btn"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto px-6 py-16 text-center">
        <span className="font-mono text-[#378ADD] text-xs uppercase tracking-widest px-2.5 py-1 bg-[#1a1a1a] border border-[#2c2c2c] rounded-[6px] mb-6">
          v1.0.0 Stable Release
        </span>
        
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white max-w-2xl leading-tight">
          Chat with your documents
        </h1>
        
        <p className="text-[#888780] text-[15px] sm:text-[16px] max-w-xl mt-4 leading-relaxed">
          Upload a PDF, DOCX, or TXT file. Ask questions in plain English. <br/>Retrieva finds the answer using AI, only your data.
        </p>

        {/* Call to Actions */}
        <div className="flex items-center gap-3 mt-8">
          {user ? (
            <Link to="/" className="btn-primary px-6 py-2.5 text-[14px] btn">
              Launch Control Center
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary px-6 py-2.5 text-[14px] btn">
                Get Started
              </Link>
              <Link to="/login" className="btn px-6 py-2.5 text-[14px]">
                Sign In to Account
              </Link>
            </>
          )}
        </div>

        {/* Decorative Flat Dashboard Preview Card */}
        <div className="w-full max-w-[700px] mt-16 bg-[#1a1a1a] border border-[#2c2c2c] rounded-[12px] p-6 text-left flex flex-col gap-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2c2c2c] pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#378ADD]"></div>
              <span className="font-mono text-xs text-[#888780] tracking-wider uppercase">
                How it works
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#5F5E5A]">
              connection: ACTIVE
            </span>
          </div>

          {/* Code/Logs content - Mono */}
          <div className="font-mono text-xs text-[#888780] flex flex-col gap-2">
            <div className="flex items-center bg-[#262626] border border-[#2c2c2c] rounded-[6px] px-3 py-2.5 gap-2.5">
              <span className="text-[#378ADD]">1.</span>
              <span>Upload your document</span>
            </div>
            <div className="flex items-center bg-[#262626] border border-[#2c2c2c] rounded-[6px] px-3 py-2.5 gap-2.5">
              <span className="text-[#378ADD]">2.</span>
              <span>Ask a question</span>
            </div>
            <div className="flex items-center bg-[#262626] border border-[#2c2c2c] rounded-[6px] px-3 py-2.5 gap-2.5">
              <span className="text-[#378ADD]">3.</span>
              <span>Get an answer with source citations</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2c2c2c] py-6 bg-[#0b0b0b] text-center text-[12px] text-[#5F5E5A]">
        ©AR3xAnish 2026.
      </footer>
    </div>
  );
}
