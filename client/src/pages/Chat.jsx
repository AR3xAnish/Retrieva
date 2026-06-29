import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Chat() {
  const { docId } = useParams();
  const navigate = useNavigate();

  // Documents & Conversations lists
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);

  // Active chat state
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [activeDocId, setActiveDocId] = useState(docId || null);
  const [messages, setMessages] = useState([]);

  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef(null);

  // Load documents
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

  // Load conversations
  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data);
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  };

  // Auto-scroll to bottom of messages view
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial and URL parameter load hooks
  useEffect(() => {
    fetchDocs();
    fetchConversations();
    handleNewChat();
  }, [docId]);

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setActiveDocId(docId || null);
    setMessages([]);
  };

  const handleSelectConversation = async (conv) => {
    setCurrentConversationId(conv._id);
    setActiveDocId(conv.documentId?._id || null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/conversations/${conv._id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const handleDeleteConversation = async (id) => {
    const confirmDelete = window.confirm("Delete this conversation and all its messages?");
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(prev => prev.filter(c => c._id !== id));
      if (currentConversationId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query || isStreaming) return;

    // Add user message to list
    const userMsg = { role: 'user', content: query };
    setInputValue('');
    setIsStreaming(true);

    // Prepare assistant message template
    const assistantMsg = { role: 'assistant', content: '', isStreaming: true, sources: [] };
    setMessages(prev => [...prev, userMsg, assistantMsg]);

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          question: query,
          documentId: activeDocId || undefined,
          conversationId: currentConversationId || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to query RAG server: ' + response.status);
      }

      // Check if server returned standard JSON response instead of stream
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        
        // Save conversation ID to state
        if (data.conversationId) {
          setCurrentConversationId(data.conversationId);
          if (data.isNew) {
            fetchConversations();
          }
        }

        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          lastMsg.content = data.answer || data.error || 'No relevant information found.';
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
              if (parsed.type === 'meta') {
                setCurrentConversationId(parsed.conversationId);
                if (parsed.isNew) {
                  fetchConversations();
                }
              } else if (parsed.type === 'text') {
                streamedText += parsed.text;
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  lastMsg.content = streamedText;
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

      // Mark message streaming as completed
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
        lastMsg.content = 'Something went wrong. Try again.';
        lastMsg.isStreaming = false;
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const getHeaderTitle = () => {
    if (currentConversationId) {
      const activeConv = conversations.find(c => c._id === currentConversationId);
      if (activeConv) {
        return activeConv.documentId?.originalName || 'All documents';
      }
    }
    if (docId && documents.length > 0) {
      const doc = documents.find(d => d._id === docId);
      return doc ? doc.originalName : 'All documents';
    }
    return 'All documents';
  };

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

        {/* Section 1: New Chat Button */}
        <button
          onClick={handleNewChat}
          className="w-full bg-transparent border border-[#2c2c2c] rounded-[6px] font-mono text-[12px] text-[#888780] hover:text-white hover:border-[#444441] transition-colors p-2 flex items-center justify-center gap-1.5 cursor-pointer mb-4"
        >
          <span className="ti ti-plus text-[14px]"></span>
          New chat
        </button>

        {/* Section 2: Recent Conversations */}
        <div className="font-mono text-[10px] text-[#5F5E5A] tracking-widest uppercase mb-1.5 select-none">
          recent conversations
        </div>

        {/* Conversation Items List */}
        <div className="flex flex-col gap-1">
          {conversations.map((conv) => {
            const isActive = conv._id === currentConversationId;
            const linkedDocName = conv.documentId?.originalName || 'All documents';
            return (
              <div
                key={conv._id}
                onClick={() => handleSelectConversation(conv)}
                className={`group relative flex items-center justify-between p-2 px-3 rounded-[6px] cursor-pointer transition-colors border ${
                  isActive
                    ? 'bg-[#262626] border-[#2c2c2c] text-white'
                    : 'bg-transparent border-transparent text-[#888780] hover:text-white'
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-mono text-[12px] truncate font-medium">
                    {conv.title || 'Untitled Chat'}
                  </span>
                  <span className="font-mono text-[10px] text-[#5F5E5A] truncate">
                    {linkedDocName}
                  </span>
                </div>
                {/* Delete Button on Hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv._id);
                  }}
                  className="hidden group-hover:flex items-center justify-center bg-transparent border-none p-1 text-[#5F5E5A] hover:text-[#E24B4A] cursor-pointer transition-colors ml-2"
                >
                  <span className="ti ti-trash text-[14px]"></span>
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0b0b]">
        {/* Top Bar */}
        <header className="h-11 bg-[#1a1a1a] border-b border-[#2c2c2c] px-6 flex items-center flex-shrink-0">
          <span className="font-mono text-[13px] text-white truncate">
            {getHeaderTitle()}
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
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="cursor-blink">▋</span>
                    )}
                  </p>
                </div>

                {/* Source citations */}
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
