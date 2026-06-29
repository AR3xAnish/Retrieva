import express from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import authMiddleware from '../middleware/auth.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_DB_PATH = path.join(__dirname, '../fallback_db.json');

// Helper to read fallback json database
const readFallbackDb = () => {
  if (!fs.existsSync(FALLBACK_DB_PATH)) {
    return { users: [], documents: [], chunks: [], conversations: [], messages: [] };
  }
  try {
    const data = fs.readFileSync(FALLBACK_DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.conversations) parsed.conversations = [];
    if (!parsed.messages) parsed.messages = [];
    if (!parsed.documents) parsed.documents = [];
    if (!parsed.users) parsed.users = [];
    if (!parsed.chunks) parsed.chunks = [];
    return parsed;
  } catch (e) {
    return { users: [], documents: [], chunks: [], conversations: [], messages: [] };
  }
};

// Helper to write fallback json database
const writeFallbackDb = (data) => {
  fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
};

// GET /api/conversations - Fetch user's conversation list
router.get('/', authMiddleware, async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const conversations = await Conversation.find({ userId: req.userId })
        .populate('documentId', 'filename originalName')
        .sort({ updatedAt: -1 });

      return res.status(200).json(conversations);
    } else {
      console.log('MongoDB is offline. Loading conversations from local fallback database.');
      const db = readFallbackDb();
      
      const userConvs = db.conversations
        .filter(c => c.userId === req.userId.toString())
        .map(c => {
          let doc = null;
          if (c.documentId) {
            doc = db.documents.find(d => d._id === c.documentId);
          }
          return {
            ...c,
            documentId: doc ? {
              _id: doc._id,
              filename: doc.filename,
              originalName: doc.originalName
            } : null
          };
        })
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      return res.status(200).json(userConvs);
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error loading conversations.', details: error.message });
  }
});

// GET /api/conversations/:id/messages - Fetch messages for specific conversation
router.get('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const convId = req.params.id;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const conversation = await Conversation.findById(convId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      if (conversation.userId.toString() !== req.userId) {
        return res.status(403).json({ error: 'Access denied. You do not own this conversation.' });
      }

      const messages = await Message.find({ conversationId: convId })
        .sort({ createdAt: 1 });

      return res.status(200).json(messages);
    } else {
      console.log('MongoDB is offline. Loading conversation messages from local fallback database.');
      const db = readFallbackDb();
      
      const conversation = db.conversations.find(c => c._id === convId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      if (conversation.userId !== req.userId.toString()) {
        return res.status(403).json({ error: 'Access denied. You do not own this conversation.' });
      }

      const messages = db.messages
        .filter(m => m.conversationId === convId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      return res.status(200).json(messages);
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error loading messages.', details: error.message });
  }
});

// DELETE /api/conversations/:id - Cascade delete conversation and all associated messages
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const convId = req.params.id;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const conversation = await Conversation.findById(convId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      if (conversation.userId.toString() !== req.userId) {
        return res.status(403).json({ error: 'Access denied. You do not own this conversation.' });
      }

      // Delete conversation record
      await Conversation.findByIdAndDelete(convId);

      // Cascade delete associated messages
      const deleteResult = await Message.deleteMany({ conversationId: convId });
      console.log(`[DELETE CONVERSATION] Successfully deleted conversation ${convId} and ${deleteResult.deletedCount} associated messages.`);

      return res.status(200).json({ message: 'Conversation deleted' });
    } else {
      console.log('MongoDB is offline. Deleting conversation from local fallback database.');
      const db = readFallbackDb();

      const idx = db.conversations.findIndex(c => c._id === convId);
      if (idx === -1) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      if (db.conversations[idx].userId !== req.userId.toString()) {
        return res.status(403).json({ error: 'Access denied. You do not own this conversation.' });
      }

      // Remove from conversations array
      db.conversations.splice(idx, 1);

      // Cascade filter out corresponding messages
      const initialMsgCount = db.messages.length;
      db.messages = db.messages.filter(m => m.conversationId !== convId);
      const deletedMsgsCount = initialMsgCount - db.messages.length;

      writeFallbackDb(db);
      console.log(`[DELETE CONVERSATION] Fallback DB: Successfully deleted conversation ${convId} and ${deletedMsgsCount} messages.`);

      return res.status(200).json({ message: 'Conversation deleted' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting conversation.', details: error.message });
  }
});

export default router;
