import React from 'react';
import { useAuth } from '../hooks/useAuth';

export default function About() {
  const { user } = useAuth();

  return (
    <div className="max-w-[860px] mx-auto px-8 py-8 flex flex-col gap-6">
      {/* Title */}
      <div className="border-b border-[#2c2c2c] pb-3">
        <span className="font-mono text-[15px] font-medium text-white tracking-wider uppercase">
          About
        </span>
      </div>

      {/* Profile Section */}
      <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-[12px] p-6 flex flex-col gap-4">
        <h3 className="font-mono text-[13px] font-semibold text-white tracking-wider uppercase border-b border-[#2c2c2c] pb-2">
          User Account Info
        </h3>
        
        {user ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px] font-mono">
            <div className="flex flex-col gap-1">
              <span className="text-[#888780]">Account Name</span>
              <span className="text-white bg-[#262626] border border-[#2c2c2c] rounded-[6px] px-3 py-1.5 truncate">
                {user.name}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[#888780]">Account Email</span>
              <span className="text-white bg-[#262626] border border-[#2c2c2c] rounded-[6px] px-3 py-1.5 truncate">
                {user.email}
              </span>
            </div>
          </div>
        ) : (
          <span className="font-mono text-xs text-[#888780] animate-pulse">
            Loading session state...
          </span>
        )}
      </div>

      {/* Backend Integration Diagnostics */}
      <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-[12px] p-6 flex flex-col gap-4">
        <h3 className="font-mono text-[13px] font-semibold text-white tracking-wider uppercase border-b border-[#2c2c2c] pb-2">
          RAG Infrastructure Telemetry
        </h3>

        <div className="flex flex-col gap-3 font-mono text-[12px]">
          {/* Hugging Face */}
          <div className="flex items-center justify-between p-3 bg-[#262626] border border-[#2c2c2c] rounded-[6px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-white font-medium">Embedding Pipeline</span>
              <span className="text-[10px] text-[#5F5E5A]">sentence-transformers/all-MiniLM-L6-v2</span>
            </div>
            <span className="text-[10px] bg-[#E6F1FB] border border-[#B5D4F4] text-[#185FA5] px-2 py-0.5 rounded-[4px]">
              384 Dimensions
            </span>
          </div>

          {/* Groq */}
          <div className="flex items-center justify-between p-3 bg-[#262626] border border-[#2c2c2c] rounded-[6px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-white font-medium">inference model</span>
              <span className="text-[10px] text-[#5F5E5A]">llama-3.1-8b-instant (via groq-sdk)</span>
            </div>
            <span className="text-[10px] bg-[#E6F1FB] border border-[#B5D4F4] text-[#185FA5] px-2 py-0.5 rounded-[4px]">
              active
            </span>
          </div>

          {/* Index Type */}
          <div className="flex items-center justify-between p-3 bg-[#262626] border border-[#2c2c2c] rounded-[6px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-white font-medium">Vector Index Method</span>
              <span className="text-[10px] text-[#5F5E5A]">programmatic mongodb Atlas vectorSearch</span>
            </div>
            <span className="text-[10px] bg-[#E6F1FB] border border-[#B5D4F4] text-[#185FA5] px-2 py-0.5 rounded-[4px]">
              cosine similarity
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
