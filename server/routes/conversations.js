import express from 'express';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// GET /api/conversations - Fetch user's conversation list
router.get('/', authMiddleware, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.userId })
      .populate('documentId', 'filename originalName')
      .sort({ updatedAt: -1 });

    return res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Server error loading conversations.', details: error.message });
  }
});

// GET /api/conversations/:id/messages - Fetch messages for specific conversation
router.get('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const convId = req.params.id;
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
  } catch (error) {
    res.status(500).json({ error: 'Server error loading messages.', details: error.message });
  }
});

// DELETE /api/conversations/:id - Cascade delete conversation and all associated messages
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const convId = req.params.id;
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
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting conversation.', details: error.message });
  }
});

export default router;
