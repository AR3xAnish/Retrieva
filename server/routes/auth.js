import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';

const router = express.Router();

const getJwtSecret = () => (process.env.JWT_SECRET || 'super_secret_retrieva_key_change_me').trim();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_DB_PATH = path.join(__dirname, '../fallback_db.json');

// Helper to read fallback json database
const readFallbackDb = () => {
  if (!fs.existsSync(FALLBACK_DB_PATH)) {
    return { users: [] };
  }
  try {
    const data = fs.readFileSync(FALLBACK_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { users: [] };
  }
};

// Helper to write fallback json database
const writeFallbackDb = (data) => {
  fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      // Use real MongoDB database
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already registered.' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Save user
      const user = new User({
        name,
        email,
        password: hashedPassword
      });
      await user.save();

      // Generate JWT
      const token = jwt.sign(
        { id: user._id, email: user.email },
        getJwtSecret(),
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } else {
      // Fallback local JSON file database
      console.log('MongoDB connection is offline. Using local JSON fallback database.');
      const db = readFallbackDb();
      
      const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already registered.' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const mockId = 'mock_user_' + Math.random().toString(36).substr(2, 9);
      const newUser = {
        _id: mockId,
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      writeFallbackDb(db);

      // Generate JWT
      const token = jwt.sign(
        { id: mockId, email: newUser.email },
        getJwtSecret(),
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        token,
        user: {
          id: mockId,
          name: newUser.name,
          email: newUser.email
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration.', details: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      // Use real MongoDB database
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user._id, email: user.email },
        getJwtSecret(),
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } else {
      // Fallback local JSON file database
      console.log('MongoDB connection is offline. Using local JSON fallback database.');
      const db = readFallbackDb();

      const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user._id, email: user.email },
        getJwtSecret(),
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error during login.', details: error.message });
  }
});

export default router;
