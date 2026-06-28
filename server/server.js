import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import authMiddleware from './middleware/auth.js';
import documentsRouter from './routes/documents.js';
import chatRouter from './routes/chat.js';
import { connectDb } from './lib/db.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/retrieva';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api', documentsRouter);
app.use('/api/chat', chatRouter);

// Protected profile verification endpoint
app.get('/api/auth/profile', authMiddleware, (req, res) => {
  res.status(200).json({
    message: 'Access granted to protected profile.',
    userId: req.userId,
    userEmail: req.userEmail
  });
});

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Database connection in background
connectDb(MONGODB_URI)
  .catch((error) => {
    // Error logged inside connectDb
  });

// Start listening immediately
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
