import express from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import mongoose from 'mongoose';
import PDFParser from 'pdf2json';

import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import { chunkText } from '../lib/chunker.js';
import { embedText } from '../lib/openai.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

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
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);
    
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      const text = pdfParser.getRawTextContent();
      resolve(text);
    });
    
    pdfParser.on('pdfParser_dataError', (error) => {
      reject(new Error(error.parserError));
    });
    
    pdfParser.parseBuffer(buffer);
  });
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

    const originalName = req.file.originalname;
    const mimetype = req.file.mimetype;
    const size = req.file.size;
    const uniqueFilename = `${Date.now()}-${originalName}`;

    const doc = new Document({
      userId: req.userId,
      filename: uniqueFilename,
      originalName,
      mimetype,
      size,
      status: 'processing'
    });
    await doc.save();
    const documentId = doc._id;

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
        await Chunk.insertMany(chunkDocs);
        await Document.findByIdAndUpdate(documentId, {
          status: 'ready',
          chunkCount: chunks.length
        });
        console.log(`[BACKGROUND PIPELINE] Successfully completed vectorization for document ${documentId}.`);
      } catch (err) {
        console.error(`[BACKGROUND PIPELINE] Ingest processing failed for document ${documentId}:`, err.message);
        await Document.findByIdAndUpdate(documentId, { status: 'error' });
      }
    }, 50);

  } catch (error) {
    res.status(500).json({ error: 'Server error during ingest.', details: error.message });
  }
});

// GET /api/docs - List user's documents
router.get('/docs', authMiddleware, async (req, res) => {
  try {
    const docs = await Document.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.status(200).json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Server error loading documents.', details: error.message });
  }
});

// DELETE /api/docs/:id - Delete document and all associated chunks
router.delete('/docs/:id', authMiddleware, async (req, res) => {
  try {
    const docId = req.params.id;

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
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting document.', details: error.message });
  }
});

export default router;
