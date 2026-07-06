import express from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import { chunkText } from '../lib/chunker.js';
import { embedText } from '../lib/openai.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_DB_PATH = path.join(__dirname, '../fallback_db.json');

// Helper to read fallback json database
const readFallbackDb = () => {
  if (!fs.existsSync(FALLBACK_DB_PATH)) {
    return { users: [], documents: [], chunks: [] };
  }
  try {
    const data = fs.readFileSync(FALLBACK_DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.documents) parsed.documents = [];
    if (!parsed.users) parsed.users = [];
    if (!parsed.chunks) parsed.chunks = [];
    return parsed;
  } catch (e) {
    return { users: [], documents: [], chunks: [] };
  }
};

// Helper to write fallback json database
const writeFallbackDb = (data) => {
  fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
};

// Configure Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const ALLOWED_MIMETYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Helper to parse file buffers
async function extractPDFText(buffer) {
  const uint8Array = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

const extractText = async (buffer, mimetype) => {
  if (mimetype === 'text/plain') {
    return buffer.toString('utf8');
  } else if (mimetype === 'application/pdf') {
    return await extractPDFText(buffer);
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error('Unsupported mimetype');
};

// POST /api/ingest - Upload document, chunk, embed, and store in vector database in the background
router.post('/ingest', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    if (!ALLOWED_MIMETYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Unsupported file type. Only PDF, TXT, and DOCX are allowed.' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    const originalName = req.file.originalname;
    const mimetype = req.file.mimetype;
    const size = req.file.size;
    const uniqueFilename = `${Date.now()}-${originalName}`;
    let documentId;

    if (isDbConnected) {
      const doc = new Document({
        userId: req.userId,
        filename: uniqueFilename,
        originalName,
        mimetype,
        size,
        status: 'processing'
      });
      await doc.save();
      documentId = doc._id;
    } else {
      console.log('MongoDB is offline. Saving document to local fallback JSON database.');
      const db = readFallbackDb();
      documentId = 'mock_doc_' + Math.random().toString(36).substr(2, 9);
      
      const newDoc = {
        _id: documentId,
        userId: req.userId.toString(),
        filename: uniqueFilename,
        originalName,
        mimetype,
        size,
        chunkCount: 0,
        status: 'processing',
        createdAt: new Date().toISOString()
      };
      db.documents.push(newDoc);
      writeFallbackDb(db);
    }

    // Respond 202 Accepted immediately
    res.status(202).json({
      message: 'File received, processing...',
      documentId
    });

    // Run extraction, chunking, and embedding in background asynchronously
    setTimeout(async () => {
      try {
        console.log(`[BACKGROUND PIPELINE] Starting extraction/vectorization for doc: ${documentId} (${originalName})`);
        
        // 1. Text Extraction
        const rawText = await extractText(req.file.buffer, mimetype);
        console.log(`[BACKGROUND PIPELINE] Successfully extracted ${rawText.length} characters.`);

        // 2. Chunking
        const chunks = chunkText(rawText);
        console.log(`[BACKGROUND PIPELINE] Divided text into ${chunks.length} chunks.`);

        // 3. Generate Vectors/Embeddings for each chunk
        const chunkDocs = [];
        for (let j = 0; j < chunks.length; j++) {
          const chunkTextContent = chunks[j];
          console.log(`[BACKGROUND PIPELINE] Embedding chunk ${j + 1}/${chunks.length} (length: ${chunkTextContent.length})...`);
          
          const embedding = await embedText(chunkTextContent);

          chunkDocs.push({
            userId: req.userId.toString(), // String ID as required by model spec
            documentId,
            filename: originalName,
            text: chunkTextContent,
            chunkIndex: j,
            embedding
          });
        }

        // 4. Vector Storage Insert
        if (isDbConnected) {
          await Chunk.insertMany(chunkDocs);
          await Document.findByIdAndUpdate(documentId, {
            status: 'ready',
            chunkCount: chunks.length
          });
          console.log(`[BACKGROUND PIPELINE] Successfully completed vectorization for document ${documentId}.`);
        } else {
          const db = readFallbackDb();
          
          // Generate mock IDs for chunks
          const fallbackChunks = chunkDocs.map(c => ({
            _id: 'mock_chunk_' + Math.random().toString(36).substr(2, 9),
            ...c,
            createdAt: new Date().toISOString()
          }));
          
          db.chunks.push(...fallbackChunks);
          
          const idx = db.documents.findIndex(d => d._id === documentId);
          if (idx !== -1) {
            db.documents[idx].status = 'ready';
            db.documents[idx].chunkCount = chunks.length;
          }
          
          writeFallbackDb(db);
          console.log(`[BACKGROUND PIPELINE] Fallback DB: Successfully vectorized and stored chunks for ${documentId}.`);
        }
      } catch (err) {
        console.error(`[BACKGROUND PIPELINE] Ingest processing failed for document ${documentId}:`, err.message);
        
        if (isDbConnected) {
          await Document.findByIdAndUpdate(documentId, { status: 'error' });
        } else {
          const db = readFallbackDb();
          const idx = db.documents.findIndex(d => d._id === documentId);
          if (idx !== -1) {
            db.documents[idx].status = 'error';
            writeFallbackDb(db);
          }
        }
      }
    }, 50);

  } catch (error) {
    res.status(500).json({ error: 'Server error during ingest.', details: error.message });
  }
});

// GET /api/docs - List user's documents
router.get('/docs', authMiddleware, async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const docs = await Document.find({ userId: req.userId }).sort({ createdAt: -1 });
      return res.status(200).json(docs);
    } else {
      const db = readFallbackDb();
      const docs = db.documents
        .filter(d => d.userId === req.userId.toString())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json(docs);
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error loading documents.', details: error.message });
  }
});

// DELETE /api/docs/:id - Delete document and all associated chunks
router.delete('/docs/:id', authMiddleware, async (req, res) => {
  try {
    const docId = req.params.id;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const doc = await Document.findById(docId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      if (doc.userId.toString() !== req.userId) {
        return res.status(403).json({ error: 'Access denied. You do not own this document.' });
      }

      // Delete document record
      await Document.findByIdAndDelete(docId);

      // Cascade delete all chunks
      const deleteResult = await Chunk.deleteMany({ documentId: docId });
      console.log(`[DELETE DOCUMENT] Successfully deleted document ${docId} and ${deleteResult.deletedCount} associated vector chunks.`);

      return res.status(200).json({ message: 'Document and associated chunks deleted successfully.' });
    } else {
      const db = readFallbackDb();
      const idx = db.documents.findIndex(d => d._id === docId);

      if (idx === -1) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      if (db.documents[idx].userId !== req.userId.toString()) {
        return res.status(403).json({ error: 'Access denied. You do not own this document.' });
      }

      // Remove document from array
      db.documents.splice(idx, 1);

      // Cascade remove chunks from array
      const initialChunkCount = db.chunks.length;
      db.chunks = db.chunks.filter(c => c.documentId !== docId);
      const deletedChunksCount = initialChunkCount - db.chunks.length;

      writeFallbackDb(db);
      console.log(`[DELETE DOCUMENT] Fallback DB: Successfully deleted document ${docId} and ${deletedChunksCount} associated vector chunks.`);

      return res.status(200).json({ message: 'Document and associated chunks deleted successfully.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting document.', details: error.message });
  }
});

export default router;
