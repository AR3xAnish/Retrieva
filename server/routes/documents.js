import express from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import Document from '../models/Document.js';
import authMiddleware from '../middleware/auth.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_DB_PATH = path.join(__dirname, '../fallback_db.json');

// Helper to read fallback json database
const readFallbackDb = () => {
  if (!fs.existsSync(FALLBACK_DB_PATH)) {
    return { users: [], documents: [] };
  }
  try {
    const data = fs.readFileSync(FALLBACK_DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.documents) parsed.documents = [];
    if (!parsed.users) parsed.users = [];
    return parsed;
  } catch (e) {
    return { users: [], documents: [] };
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
const extractText = async (buffer, mimetype) => {
  if (mimetype === 'text/plain') {
    return buffer.toString('utf8');
  } else if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error('Unsupported mimetype');
};

// POST /api/ingest - Upload document and parse text in the background
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
        userId: req.userId,
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

    // Run extraction in background asynchronously
    setTimeout(async () => {
      try {
        console.log(`[BACKGROUND PARSER] Starting text extraction for doc: ${documentId} (${originalName})`);
        
        const text = await extractText(req.file.buffer, mimetype);
        const textLength = text.length;
        const snippet = text.slice(0, 200);

        console.log(`[BACKGROUND PARSER] Successfully extracted ${textLength} characters.`);
        console.log(`[BACKGROUND PARSER] Snippet (first 200 chars):\n"${snippet}"`);

        // Compute chunkCount (1 chunk per 1000 characters)
        const chunkCount = Math.ceil(textLength / 1000) || 1;

        if (isDbConnected) {
          await Document.findByIdAndUpdate(documentId, {
            status: 'ready',
            chunkCount
          });
          console.log(`[BACKGROUND PARSER] Updated document ${documentId} status to "ready" with ${chunkCount} chunks.`);
        } else {
          const db = readFallbackDb();
          const idx = db.documents.findIndex(d => d._id === documentId);
          if (idx !== -1) {
            db.documents[idx].status = 'ready';
            db.documents[idx].chunkCount = chunkCount;
            writeFallbackDb(db);
            console.log(`[BACKGROUND PARSER] Fallback DB: Updated status of ${documentId} to "ready".`);
          }
        }
      } catch (err) {
        console.error(`[BACKGROUND PARSER] Failed to parse document ${documentId}:`, err.message);
        
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
        .filter(d => d.userId === req.userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json(docs);
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error loading documents.', details: error.message });
  }
});

// DELETE /api/docs/:id - Delete a user's document
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

      await Document.findByIdAndDelete(docId);
      return res.status(200).json({ message: 'Document deleted successfully.' });
    } else {
      const db = readFallbackDb();
      const idx = db.documents.findIndex(d => d._id === docId);

      if (idx === -1) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      if (db.documents[idx].userId !== req.userId) {
        return res.status(403).json({ error: 'Access denied. You do not own this document.' });
      }

      db.documents.splice(idx, 1);
      writeFallbackDb(db);
      return res.status(200).json({ message: 'Document deleted successfully.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting document.', details: error.message });
  }
});

export default router;
