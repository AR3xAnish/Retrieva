import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

// Helper to determine icon classes based on file mimetype
const getFileIconClass = (mimetype) => {
  if (mimetype === 'application/pdf') return 'ti ti-file-type-pdf';
  if (mimetype && (mimetype.includes('word') || mimetype.includes('officedocument'))) return 'ti ti-file-type-doc';
  return 'ti ti-file';
};

// Helper to calculate relative times
const getRelativeTime = (dateStr) => {
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProcessingText, setShowProcessingText] = useState(false);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Load documents
  const fetchDocs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get('/docs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  // Poll GET /api/docs every 3 seconds if any doc is in "processing" state
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'processing');
    if (hasProcessing) {
      setShowProcessingText(true);
      const interval = setInterval(() => {
        fetchDocs();
      }, 3000);
      return () => clearInterval(interval);
    } else {
      setShowProcessingText(false);
    }
  }, [documents]);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const token = localStorage.getItem('token');
      await api.post('/ingest', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });
      // Refresh documents
      await fetchDocs();
    } catch (err) {
      console.error('Error uploading file:', err);
      alert(err.response?.data?.error || 'Failed to upload document.');
    } finally {
      // Short delay to reset progress bar state smoothly
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 500);
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Delete this document and all its data?");
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem('token');
      await api.delete(`/docs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchDocs();
    } catch (err) {
      console.error('Error deleting document:', err);
      alert(err.response?.data?.error || 'Failed to delete document.');
    }
  };

  return (
    <div className="max-w-[860px] mx-auto px-8 py-8 flex flex-col gap-6">
      {/* Title & Upload Row */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[15px] font-medium text-white tracking-wider uppercase">
          Documents
        </span>
        <button
          onClick={handleUploadClick}
          className="bg-[#378ADD] text-white hover:bg-[#378ADD]/90 transition-colors font-mono text-[12px] px-3.5 py-1.5 rounded-[6px] flex items-center gap-1.5 cursor-pointer"
        >
          <span className="ti ti-upload text-[14px]"></span>
          Upload file
        </button>
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Upload Telemetry: Progress Bar & Processing Indicator */}
      {(isUploading || showProcessingText) && (
        <div className="flex flex-col gap-2 w-full">
          {/* Progress Bar (2px height) */}
          <div className="w-full h-[2px] bg-[#1a1a1a] rounded-full overflow-hidden relative">
            <div
              className="h-full bg-[#378ADD] transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>

          {/* Processing message */}
          {showProcessingText && (
            <span className="font-mono text-[12px] text-[#888780] animate-pulse">
              Processing in background...
            </span>
          )}
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="font-mono text-[12px] text-[#888780] animate-pulse">
            Loading indices...
          </span>
        </div>
      ) : documents.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center text-center mt-16 py-8">
          <span className="ti ti-files text-[32px] text-[#5F5E5A]"></span>
          <span className="font-mono text-[13px] text-[#888780] mt-3">
            No documents yet
          </span>
          <span className="font-sans text-[12px] text-[#5F5E5A] mt-1">
            Upload a PDF, DOCX, or TXT file to get started
          </span>
        </div>
      ) : (
        /* Cards Container */
        <div className="flex flex-col gap-1.5">
          {documents.map((doc) => {
            const fileSizeMB = (doc.size / (1024 * 1024)).toFixed(2);
            const isReady = doc.status === 'ready';

            return (
              <div
                key={doc._id}
                className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-[12px] p-3 px-4 flex items-center justify-between gap-4"
              >
                {/* Left: Icon Box */}
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-[#E6F1FB] border border-[#B5D4F4] rounded-[6px]">
                  <span className={`${getFileIconClass(doc.mimetype)} text-[16px] text-[#185FA5]`}></span>
                </div>

                {/* Middle: Details */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="font-mono text-[13px] font-medium text-white truncate">
                    {doc.originalName}
                  </span>
                  <span className="font-mono text-[10px] text-[#5F5E5A]">
                    {doc.chunkCount || 0} chunks · {fileSizeMB} MB · {getRelativeTime(doc.createdAt)}
                  </span>
                </div>

                {/* Right: Status & Actions */}
                <div className="flex items-center gap-3">
                  {/* Status Badge */}
                  {doc.status === 'ready' && (
                    <span className="font-mono text-[11px] px-2 py-0.5 bg-[#E6F1FB] border border-[#B5D4F4] text-[#0C447C] rounded-[4px]">
                      ready
                    </span>
                  )}
                  {doc.status === 'processing' && (
                    <span className="font-mono text-[11px] px-2 py-0.5 bg-[#F1EFE8] border border-[#D3D1C7] text-[#444441] rounded-[4px]">
                      processing
                    </span>
                  )}
                  {doc.status === 'error' && (
                    <span className="font-mono text-[11px] px-2 py-0.5 bg-[#FCEBEB] border border-[#F7C1C1] text-[#791F1F] rounded-[4px]">
                      error
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {/* Chat Trigger Button */}
                    <button
                      onClick={() => isReady && navigate(`/chat/${doc._id}`)}
                      disabled={!isReady}
                      title={isReady ? "Start RAG Chat" : "Document processing"}
                      className={`w-[26px] h-[26px] flex items-center justify-center bg-transparent border border-[#2c2c2c] rounded-[6px] text-[#888780] hover:text-white hover:border-[#444441] transition-colors ${
                        isReady ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <span className="ti ti-message text-[14px]"></span>
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(doc._id)}
                      title="Delete document and vector data"
                      className="w-[26px] h-[26px] flex items-center justify-center bg-transparent border border-[#2c2c2c] rounded-[6px] text-[#888780] hover:text-white hover:border-[#444441] transition-colors cursor-pointer"
                    >
                      <span className="ti ti-trash text-[14px]"></span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
