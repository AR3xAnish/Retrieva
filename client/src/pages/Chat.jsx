import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Chat() {
  const { docId } = useParams();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef(null);

  // Load documents for sidebar listing
  const fetchDocs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/docs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data);
    } catch (err) {
      console.error('Error loading documents:', err);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  // Auto-scroll to bottom of message viewport whenever message list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query || isStreaming) return;

    // Append user message
    const userMsg = { role: 'user', text: query };
    setInputValue('');
    setIsStreaming(true);

    // Initial empty assistant message block with blinking cursor enabled
    const assistantMsg = { role: 'assistant', text: '', isStreaming: true, sources: [] };
    setMessages(prev => [...prev, userMsg, assistantMsg]);

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ question: query, documentId: docId || undefined })
      });

      if (!response.ok) {
        throw new Error('Failed to query RAG server: ' + response.status);
      }

      // Check if response is standard JSON fallback instead of stream
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          lastMsg.text = data.answer || data.error || 'No relevant information found.';
          lastMsg.sources = data.sources || [];
          lastMsg.isStreaming = false;
          return updated;
        });
        setIsStreaming(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let finished = false;
      let streamedText = '';

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) {
          finished = true;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') {
              finished = true;
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'text') {
                streamedText += parsed.text;
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  lastMsg.text = streamedText;
                  return updated;
                });
              } else if (parsed.type === 'sources') {
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  lastMsg.sources = parsed.sources;
                  return updated;
                });
              }
            } catch (e) {
              // Ignore partial parsing errors on split chunks
            }
          }
        }
      }

      // Mark message streaming as completed (removes cursor)
      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        lastMsg.isStreaming = false;
        return updated;
      });

    } catch (err) {
      console.error('Error during streaming chat session:', err);
      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        lastMsg.text = 'Something went wrong. Try again.';
        lastMsg.isStreaming = false;
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const selectedDocName = docId
    ? (documents.find(d => d._id === docId)?.originalName || 'Loading document...')
    : 'All documents';

  return (
    <div className="w-screen h-screen flex flex-row bg-[#0b0b0b] text-white overflow-hidden font-sans selection:bg-[#378ADD]/30">
      {/* Left Sidebar */}
      <aside className="w-[240px] flex-shrink-0 bg-[#1a1a1a] border-r border-[#2c2c2c] flex flex-col p-3 overflow-y-auto">
        {/* Back Button */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 font-mono text-[12px] text-[#888780] hover:text-white cursor-pointer mb-4 select-none"
        >
          <span className="ti ti-arrow-left text-[14px]"></span>
          Documents
        </div>

        {/* Section Label */}
        <div className="font-mono text-[10px] text-[#5F5E5A] tracking-widest uppercase mb-1.5 select-none">
          your documents
        </div>

        {/* Document Items List */}
        <div className="flex flex-col gap-1">
          {/* All documents option */}
          <div
            onClick={() => navigate('/chat')}
            className={`font-mono text-[12px] cursor-pointer transition-colors select-none px-2 py-1.5 rounded-[6px] ${
              !docId
                ? 'bg-[#262626] border border-[#2c2c2c] text-white'
                : 'text-[#888780] hover:text-white'
            }`}
          >
            All documents
          </div>

          {/* Individual documents */}
          {documents.map((doc) => (
            <div
              key={doc._id}
              onClick={() => navigate(`/chat/${doc._id}`)}
              className={`font-mono text-[12px] cursor-pointer transition-colors select-none px-2 py-1.5 rounded-[6px] truncate ${
                docId === doc._id
                  ? 'bg-[#262626] border border-[#2c2c2c] text-white'
                  : 'text-[#888780] hover:text-white'
              }`}
              title={doc.originalName}
            >
              {doc.originalName}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0b0b]">
        {/* Top Bar */}
        <header className="h-11 bg-[#1a1a1a] border-b border-[#2c2c2c] px-6 flex items-center flex-shrink-0">
          <span className="font-mono text-[13px] text-white truncate">
            {selectedDocName}
          </span>
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-[#2c2c2c]">
          {messages.length === 0 ? (
            /* Empty state text */
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 select-none">
              <span className="font-mono text-[13px] text-[#5F5E5A]">
                Ask a question about your documents
              </span>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col gap-1.5 max-w-[85%] ${
                  msg.role === 'user' ? 'self-end items-end max-w-[70%]' : 'self-start items-start'
                }`}
              >
                {/* Bubble card */}
                <div
                  className={`p-3.5 px-4 rounded-[12px] text-[13px] leading-relaxed border ${
                    msg.role === 'user'
                      ? 'bg-[#E6F1FB] border-[#B5D4F4] text-[#0C447C] rounded-tr-[12px] rounded-tl-[12px] rounded-br-[2px] rounded-bl-[12px]'
                      : 'bg-[#262626] border-[#2c2c2c] text-white rounded-tr-[12px] rounded-tl-[12px] rounded-br-[12px] rounded-bl-[2px]'
                  }`}
                >
                  <p className="whitespace-pre-wrap font-sans">
                    {msg.text}
                    {msg.isStreaming && (
                      <span className="cursor-blink">▋</span>
                    )}
                  </p>
                </div>

                {/* Source citations (only on assistant messages once streaming ends) */}
                {msg.role === 'assistant' && !msg.isStreaming && msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {msg.sources.map((src, sIdx) => {
                      const scorePercentage = Math.round((src.score || 1.0) * 100);
                      return (
                        <div
                          key={sIdx}
                          className="font-mono text-[10px] bg-[#1a1a1a] border border-[#2c2c2c] text-[#888780] px-2 py-0.5 rounded-[4px] flex items-center gap-1"
                        >
                          <span className="ti ti-file text-[10px]"></span>
                          <span>{src.filename} · {scorePercentage}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="bg-[#1a1a1a] border-t border-[#2c2c2c] p-3 px-6 flex items-center gap-2 flex-shrink-0"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question about your documents..."
            disabled={isStreaming}
            className="flex-1 bg-[#262626] border border-[#444441] text-white rounded-[6px] px-3.5 py-2.5 text-[13px] focus:border-[#378ADD] focus:outline-none transition-colors placeholder-[#5F5E5A] font-mono"
          />
          <button
            type="submit"
            disabled={isStreaming || !inputValue.trim()}
            className="bg-[#378ADD] text-white hover:bg-[#378ADD]/90 transition-colors border-none rounded-[6px] p-2.5 px-3.5 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <span className="ti ti-arrow-up text-[14px]"></span>
          </button>
        </form>
      </div>
    </div>
  );
}
