import express from 'express';
import mongoose from 'mongoose';
import { Groq } from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import authMiddleware from '../middleware/auth.js';
import { embedText } from '../lib/openai.js';

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
    if (!parsed.chunks) parsed.chunks = [];
    return parsed;
  } catch (e) {
    return { users: [], documents: [], chunks: [] };
  }
};

// Helper for offline cosine similarity
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let k = 0; k < vecA.length; k++) {
    dotProduct += vecA[k] * vecB[k];
    normA += vecA[k] * vecA[k];
    normB += vecB[k] * vecB[k];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const getGroqClient = () => {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey || apiKey === 'your_groq_key' || apiKey.startsWith('gsk_')) {
    if (!apiKey || apiKey === 'your_groq_key' || apiKey === 'gsk_...') {
      return null;
    }
  }
  return new Groq({ apiKey });
};

// POST /api/chat - RAG chat streaming route
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { question, documentId } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    // 1. Generate 384-dimension embedding for the question
    const questionEmbedding = await embedText(question);

    // 2. Search database for relevant chunks
    const isDbConnected = mongoose.connection.readyState === 1;
    let chunks = [];

    if (isDbConnected) {
      // Configure filter criteria
      const filter = { userId: req.userId.toString() };
      if (documentId) {
        filter.documentId = new mongoose.Types.ObjectId(documentId);
      }

      const pipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: questionEmbedding,
            numCandidates: 100,
            limit: 5,
            filter: filter
          }
        },
        {
          $project: {
            text: 1,
            filename: 1,
            chunkIndex: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ];

      chunks = await mongoose.connection.db.collection('chunks').aggregate(pipeline).toArray();
    } else {
      console.log('MongoDB is offline. Doing offline cosine similarity match on local JSON fallback database.');
      const db = readFallbackDb();
      const userChunks = db.chunks.filter(c => {
        const matchUser = c.userId === req.userId.toString();
        const matchDoc = documentId ? c.documentId === documentId : true;
        return matchUser && matchDoc;
      });

      const scored = userChunks.map(c => {
        const score = cosineSimilarity(questionEmbedding, c.embedding);
        return {
          text: c.text,
          filename: c.filename,
          chunkIndex: c.chunkIndex,
          score
        };
      });

      // Sort by score descending and take top 5
      chunks = scored.sort((a, b) => b.score - a.score).slice(0, 5);
    }

    // 3. Check if any chunks found
    if (!chunks || chunks.length === 0) {
      return res.status(200).json({
        answer: "I couldn't find relevant information in your documents.",
        sources: []
      });
    }

    // 4. Build prompt string
    const excerptBlocks = chunks.map((chunk, idx) => {
      return `[Source ${idx + 1} — ${chunk.filename}]\n${chunk.text}`;
    });
    const prompt = excerptBlocks.join('\n\n---\n\n');

    const systemInstruction = "You are a helpful assistant. Answer the user's question based strictly on the provided document excerpts. If the answer is not in the excerpts, say so clearly. Always cite which source you used, e.g. According to [Source 1 — filename]...";

    // 5. Initialize SSE streaming headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const groq = getGroqClient();

    if (groq) {
      // Stream response from Groq Llama model
      console.log('[GROQ CHAT] Starting streaming chat completion using llama-3.1-8b-instant...');
      const chatStream = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt + `\n\nQuestion: ${question}` }
        ],
        max_tokens: 1024,
        stream: true
      });

      for await (const chunkEvent of chatStream) {
        const content = chunkEvent.choices[0]?.delta?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ type: 'text', text: content })}\n\n`);
        }
      }

      // After streaming completes, write sources list andDONE SSE event
      const sourcesList = chunks.map(c => ({
        filename: c.filename,
        chunkIndex: c.chunkIndex,
        score: c.score || 1.0
      }));

      res.write(`data: ${JSON.stringify({ type: 'sources', sources: sourcesList })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      console.warn('[GROQ CHAT] Warning: GROQ_API_KEY is not set or holds a placeholder. Simulating SSE stream for development.');
      // Stream mock response word-by-word
      const mockResponse = `According to [Source 1 — ${chunks[0].filename}], here is the context retrieved from your files: "${chunks[0].text.substring(0, 150)}...". Let me know if you need more details!`;
      const words = mockResponse.split(' ');
      let wordIdx = 0;

      const sendMockWord = () => {
        if (wordIdx < words.length) {
          const word = (wordIdx === 0 ? '' : ' ') + words[wordIdx];
          res.write(`data: ${JSON.stringify({ type: 'text', text: word })}\n\n`);
          wordIdx++;
          setTimeout(sendMockWord, 40);
        } else {
          const sourcesList = chunks.map(c => ({
            filename: c.filename,
            chunkIndex: c.chunkIndex,
            score: c.score || 1.0
          }));
          res.write(`data: ${JSON.stringify({ type: 'sources', sources: sourcesList })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      };

      sendMockWord();
    }

  } catch (error) {
    console.error('[GROQ CHAT] Error during streaming completions:', error.message);
    // Write SSE error event if we've already headers sent, otherwise standard JSON error
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'Server error during chat query.', details: error.message });
    }
  }
});

export default router;
