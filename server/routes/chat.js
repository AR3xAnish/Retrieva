import express from 'express';
import mongoose from 'mongoose';
import { Groq } from 'groq-sdk';

import authMiddleware from '../middleware/auth.js';
import { embedText } from '../lib/openai.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

const router = express.Router();

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
    const { question, documentId, conversationId } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    let currentConversationId = conversationId;
    let isNew = false;

    // 1. Verify or create Conversation
    if (currentConversationId) {
      const existingConv = await Conversation.findById(currentConversationId);
      if (!existingConv) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
      if (existingConv.userId.toString() !== req.userId) {
        return res.status(403).json({ error: 'Access denied. You do not own this conversation.' });
      }
    } else {
      const newConv = await Conversation.create({
        userId: req.userId,
        documentId: documentId || null,
        title: question.slice(0, 60)
      });
      currentConversationId = newConv._id;
      isNew = true;
    }

    // Save user message immediately
    await Message.create({
      conversationId: currentConversationId,
      role: 'user',
      content: question
    });

    // 2. Generate 384-dimension embedding for the question
    const questionEmbedding = await embedText(question);

    // 3. Search database for relevant chunks
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

    const chunks = await mongoose.connection.db.collection('chunks').aggregate(pipeline).toArray();

    // 4. Check if any chunks found
    if (!chunks || chunks.length === 0) {
      const fallbackAnswer = "I couldn't find relevant information in your documents.";
      
      // Save assistant fallback response
      await Message.create({
        conversationId: currentConversationId,
        role: 'assistant',
        content: fallbackAnswer,
        sources: []
      });
      await Conversation.findByIdAndUpdate(currentConversationId, { updatedAt: new Date() });

      return res.status(200).json({
        answer: fallbackAnswer,
        sources: [],
        conversationId: currentConversationId,
        isNew
      });
    }

    // 5. Build prompt string
    const excerptBlocks = chunks.map((chunk, idx) => {
      return `[Source ${idx + 1} — ${chunk.filename}]\n${chunk.text}`;
    });
    const prompt = excerptBlocks.join('\n\n---\n\n');

    const systemInstruction = "You are a helpful assistant. Answer the user's question based strictly on the provided document excerpts. If the answer is not in the excerpts, say so clearly. Always cite which source you used, e.g. According to [Source 1 — filename]...";

    // 6. Initialize SSE streaming headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // First SSE Event: Send Metadata
    res.write(`data: ${JSON.stringify({ type: 'meta', conversationId: currentConversationId, isNew })}\n\n`);

    // Prepare unique sources for message logging
    const uniqueSources = [];
    const seenFiles = new Set();
    for (const c of chunks) {
      if (!seenFiles.has(c.filename)) {
        seenFiles.add(c.filename);
        uniqueSources.push({
          filename: c.filename,
          score: c.score || 1.0
        });
      }
    }

    const groq = getGroqClient();

    const sendSimulatedStream = async () => {
      const mockResponse = `According to [Source 1 — ${chunks[0].filename}], here is the context retrieved from your files: "${chunks[0].text.substring(0, 150)}...". Let me know if you need more details!`;
      const words = mockResponse.split(' ');
      let wordIdx = 0;

      const sendMockWord = async () => {
        if (wordIdx < words.length) {
          const word = (wordIdx === 0 ? '' : ' ') + words[wordIdx];
          res.write(`data: ${JSON.stringify({ type: 'text', text: word })}\n\n`);
          wordIdx++;
          setTimeout(sendMockWord, 40);
        } else {
          // Log completion in MongoDB
          await Message.create({
            conversationId: currentConversationId,
            role: 'assistant',
            content: mockResponse,
            sources: uniqueSources
          });
          await Conversation.findByIdAndUpdate(currentConversationId, { updatedAt: new Date() });

          res.write(`data: ${JSON.stringify({ type: 'sources', sources: uniqueSources })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      };

      sendMockWord();
    };

    if (groq) {
      try {
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

        let fullResponse = '';
        for await (const chunkEvent of chatStream) {
          const content = chunkEvent.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ type: 'text', text: content })}\n\n`);
          }
        }

        // Log assistant message & update conversation in MongoDB
        await Message.create({
          conversationId: currentConversationId,
          role: 'assistant',
          content: fullResponse,
          sources: uniqueSources
        });
        await Conversation.findByIdAndUpdate(currentConversationId, { updatedAt: new Date() });

        res.write(`data: ${JSON.stringify({ type: 'sources', sources: uniqueSources })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (streamErr) {
        console.warn('[GROQ CHAT] Network error calling Groq API, falling back to simulated SSE stream:', streamErr.message);
        await sendSimulatedStream();
      }
    } else {
      console.warn('[GROQ CHAT] Warning: GROQ_API_KEY is not set or holds a placeholder. Simulating SSE stream for development.');
      await sendSimulatedStream();
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
