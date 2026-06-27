import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import axios from 'axios';

// API configuration
const API_URL = 'http://localhost:5000/api';

// Navigation Sidebar Component
function Sidebar({ serverStatus }) {
  return (
    <div className="w-64 bg-bg-surface-2 border-r border-border-default flex flex-col h-screen p-6 justify-between">
      <div>
        {/* Logo and App Name - Mono font */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-3 h-3 bg-accent rounded-full"></div>
          <span className="font-mono-ui text-xl font-bold tracking-wider text-text-primary logo">
            RETRIEVA
          </span>
        </div>

        {/* Navigation Menu */}
        <nav className="flex flex-col gap-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-md transition-colors text-sm font-medium ${
                isActive
                  ? 'bg-accent text-white font-semibold'
                  : 'text-text-secondary hover:bg-bg-surface-1 hover:text-text-primary'
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/files"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-md transition-colors text-sm font-medium ${
                isActive
                  ? 'bg-accent text-white font-semibold'
                  : 'text-text-secondary hover:bg-bg-surface-1 hover:text-text-primary'
              }`
            }
          >
            Files & Chunks
          </NavLink>
          <NavLink
            to="/status"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-md transition-colors text-sm font-medium ${
                isActive
                  ? 'bg-accent text-white font-semibold'
                  : 'text-text-secondary hover:bg-bg-surface-1 hover:text-text-primary'
              }`
            }
          >
            System Status
          </NavLink>
        </nav>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-border-default">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Server Connection</span>
          <span
            className={`font-mono-ui px-2 py-0.5 rounded-sm border ${
              serverStatus === 'ok'
                ? 'bg-accent-muted-bg border-accent-muted-border text-accent font-medium'
                : 'bg-bg-surface-1 border-border-strong text-text-muted'
            }`}
          >
            {serverStatus === 'ok' ? 'ACTIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </div>
  );
}

// Dashboard Page Component
function DashboardView({ serverStatus, files, addMockFile }) {
  const [query, setQuery] = useState('');
  const [uploadName, setUploadName] = useState('');

  const handleUpload = (e) => {
    e.preventDefault();
    if (!uploadName.trim()) return;
    addMockFile(uploadName);
    setUploadName('');
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-bg-page text-text-primary">
      {/* App Name Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary font-mono-ui app-name">
            Retrieva Control Center
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Flat, raw index system monitoring database.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn" onClick={() => alert('Diagnostic complete.')}>
            Run Diagnostics
          </button>
        </div>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-bg-surface-1 border border-border-default rounded-[12px] p-6">
          <span className="text-xs font-mono-ui text-text-secondary uppercase tracking-wider block mb-2">
            Index Integrity
          </span>
          <span className="text-3xl font-mono-ui text-text-primary font-bold chunk-count">
            100%
          </span>
          <span className="text-xs text-text-muted block mt-2 font-mono-ui metadata">
            status: synchronized
          </span>
        </div>
        <div className="bg-bg-surface-1 border border-border-default rounded-[12px] p-6">
          <span className="text-xs font-mono-ui text-text-secondary uppercase tracking-wider block mb-2">
            Total Chunks
          </span>
          <span className="text-3xl font-mono-ui text-text-primary font-bold chunk-count">
            {files.reduce((acc, curr) => acc + curr.chunks, 0)}
          </span>
          <span className="text-xs text-text-muted block mt-2 font-mono-ui metadata">
            across {files.length} indexed files
          </span>
        </div>
        <div className="bg-bg-surface-1 border border-border-default rounded-[12px] p-6">
          <span className="text-xs font-mono-ui text-text-secondary uppercase tracking-wider block mb-2">
            Server Latency
          </span>
          <span className="text-3xl font-mono-ui text-text-primary font-bold chunk-count">
            {serverStatus === 'ok' ? '12ms' : 'N/A'}
          </span>
          <span className="text-xs text-text-muted block mt-2 font-mono-ui metadata">
            endpoint: GET /api/health
          </span>
        </div>
      </div>

      {/* Main Grid: Upload & Search */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Search and File List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-bg-surface-1 border border-border-default rounded-[12px] p-6">
            <h3 className="text-md font-bold mb-4 font-mono-ui text-text-primary">
              Search Database Entries
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search filenames, tags, metadata..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-bg-surface-2 border border-border-default text-text-primary rounded-[6px] px-3 py-2 text-sm focus:outline-none"
              />
              <button className="btn" onClick={() => setQuery('')}>
                Clear
              </button>
            </div>
          </div>

          <div className="bg-bg-surface-1 border border-border-default rounded-[12px] p-6">
            <h3 className="text-md font-bold mb-4 font-mono-ui text-text-primary">
              Indexed Nodes
            </h3>
            {filteredFiles.length === 0 ? (
              <p className="text-sm text-text-muted">No search results found.</p>
            ) : (
              <div className="space-y-4">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-bg-surface-2 border border-border-default rounded-[6px] gap-2"
                  >
                    <div>
                      {/* Filename - Mono font */}
                      <span className="font-mono-ui text-sm font-semibold block text-text-primary filename">
                        {file.name}
                      </span>
                      {/* ID and Metadata - Mono font */}
                      <div className="flex gap-4 mt-1 text-xs text-text-secondary font-mono-ui metadata">
                        <span>
                          id:{' '}
                          <span className="text-text-primary mono-id">
                            {file.id}
                          </span>
                        </span>
                        <span>size: {file.size}</span>
                        <span>created: {file.created}</span>
                      </div>
                    </div>
                    {/* Chunk Count - Mono font */}
                    <div className="flex items-center gap-3">
                      <span className="font-mono-ui text-xs bg-bg-page border border-border-strong text-text-secondary px-2.5 py-1 rounded-[6px] chunk-count">
                        {file.chunks} Chunks
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Actions Panel */}
        <div className="space-y-6">
          {/* Upload Mock File */}
          <div className="bg-bg-surface-1 border border-border-default rounded-[12px] p-6">
            <h3 className="text-md font-bold mb-4 font-mono-ui text-text-primary">
              Index New File
            </h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-2">
                  Filename
                </label>
                <input
                  type="text"
                  placeholder="e.g. user_ledger.bin"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full bg-bg-surface-2 border border-border-default text-text-primary rounded-[6px] px-3 py-2 text-sm focus:outline-none"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 btn">
                Upload & Chunk
              </button>
            </form>
          </div>

          {/* Quick Actions */}
          <div className="bg-bg-surface-1 border border-border-default rounded-[12px] p-6">
            <h3 className="text-md font-bold mb-4 font-mono-ui text-text-primary">
              Core Actions
            </h3>
            <div className="space-y-2">
              <button
                className="btn-primary w-full py-2 btn"
                onClick={() => alert('System flush request sent.')}
              >
                Send Flush Command
              </button>
              <button
                className="btn w-full py-2"
                onClick={() => alert('Index optimized.')}
              >
                Optimize Chunks
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Files Details Page
function FilesView({ files }) {
  return (
    <div className="flex-1 p-8 overflow-y-auto bg-bg-page text-text-primary">
      <h1 className="text-2xl font-bold tracking-tight text-text-primary font-mono-ui app-name mb-2">
        Database Entry Details
      </h1>
      <p className="text-sm text-text-secondary mb-8">
        Full listing of chunk locations, checksum mappings, and partition IDs.
      </p>

      <div className="bg-bg-surface-1 border border-border-default rounded-[12px] overflow-hidden">
        <table className="w-full border-collapse text-left text-sm text-text-secondary">
          <thead className="bg-bg-surface-2 border-b border-border-default text-text-primary font-mono-ui">
            <tr>
              <th className="p-4 font-semibold">Entry ID</th>
              <th className="p-4 font-semibold">Filename</th>
              <th className="p-4 font-semibold">Size</th>
              <th className="p-4 font-semibold">Chunk Count</th>
              <th className="p-4 font-semibold">Created Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {files.map((file) => (
              <tr key={file.id} className="hover:bg-bg-surface-2/40">
                <td className="p-4 font-mono-ui text-text-primary mono-id">
                  {file.id}
                </td>
                <td className="p-4 font-mono-ui text-text-primary filename">
                  {file.name}
                </td>
                <td className="p-4 font-mono-ui metadata">{file.size}</td>
                <td className="p-4 font-mono-ui chunk-count">
                  {file.chunks}
                </td>
                <td className="p-4 font-mono-ui metadata">{file.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// System Status Page
function StatusView({ serverStatus, serverUrl }) {
  return (
    <div className="flex-1 p-8 overflow-y-auto bg-bg-page text-text-primary">
      <h1 className="text-2xl font-bold tracking-tight text-text-primary font-mono-ui app-name mb-2">
        System Node Status
      </h1>
      <p className="text-sm text-text-secondary mb-8">
        Live telemetry reporting from local MERN microservices.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Node telemetry */}
        <div className="bg-bg-surface-1 border border-border-default rounded-[12px] p-6 space-y-4">
          <h3 className="text-md font-bold font-mono-ui text-text-primary">
            Express / Node Daemon
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Daemon Address</span>
              <span className="font-mono-ui text-text-primary">{serverUrl}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Health Status</span>
              <span
                className={`font-mono-ui px-2 py-0.5 rounded-sm border ${
                  serverStatus === 'ok'
                    ? 'bg-accent-muted-bg border-accent-muted-border text-accent font-medium'
                    : 'bg-bg-surface-1 border-border-strong text-text-muted'
                }`}
              >
                {serverStatus === 'ok' ? 'HEALTHY' : 'UNAVAILABLE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Port Binding</span>
              <span className="font-mono-ui text-text-primary">5000</span>
            </div>
          </div>
        </div>

        {/* Database telemetry */}
        <div className="bg-bg-surface-1 border border-border-default rounded-[12px] p-6 space-y-4">
          <h3 className="text-md font-bold font-mono-ui text-text-primary">
            MongoDB Mongoose Connection
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Database Name</span>
              <span className="font-mono-ui text-text-primary">retrieva</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Client Connection</span>
              <span
                className={`font-mono-ui px-2 py-0.5 rounded-sm border ${
                  serverStatus === 'ok'
                    ? 'bg-accent-muted-bg border-accent-muted-border text-accent font-medium'
                    : 'bg-bg-surface-1 border-border-strong text-text-muted'
                }`}
              >
                {serverStatus === 'ok' ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Connection Protocol</span>
              <span className="font-mono-ui text-text-primary">mongodb://</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App Router Shell
export default function App() {
  const [serverStatus, setServerStatus] = useState('checking');
  const [files, setFiles] = useState([
    {
      id: 'node_5c0f1a92',
      name: 'retrieval_architecture_draft.txt',
      size: '24 KB',
      chunks: 8,
      created: '2026-06-27',
    },
    {
      id: 'node_82a51fef',
      name: 'knowledge_base_dump.json',
      size: '14.2 MB',
      chunks: 142,
      created: '2026-06-26',
    },
    {
      id: 'node_9e0004ad',
      name: 'vector_index_schema.bin',
      size: '320 KB',
      chunks: 32,
      created: '2026-06-25',
    },
  ]);

  // Fetch health check status
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await axios.get(`${API_URL}/health`);
        if (response.data && response.data.status === 'ok') {
          setServerStatus('ok');
        } else {
          setServerStatus('error');
        }
      } catch (err) {
        setServerStatus('error');
      }
    };
    checkHealth();
  }, []);

  const addMockFile = (name) => {
    const randomId = 'node_' + Math.random().toString(16).substr(2, 8);
    const randomChunks = Math.floor(Math.random() * 80) + 5;
    const randomSize = (Math.random() * 2).toFixed(2) + ' MB';
    const newFile = {
      id: randomId,
      name,
      size: randomSize,
      chunks: randomChunks,
      created: new Date().toISOString().split('T')[0],
    };
    setFiles([newFile, ...files]);
  };

  return (
    <Router>
      <div className="flex h-screen w-screen overflow-hidden bg-bg-page">
        <Sidebar serverStatus={serverStatus} />
        <Routes>
          <Route
            path="/"
            element={
              <DashboardView
                serverStatus={serverStatus}
                files={files}
                addMockFile={addMockFile}
              />
            }
          />
          <Route path="/files" element={<FilesView files={files} />} />
          <Route
            path="/status"
            element={
              <StatusView serverStatus={serverStatus} serverUrl={API_URL} />
            }
          />
        </Routes>
      </div>
    </Router>
  );
}
