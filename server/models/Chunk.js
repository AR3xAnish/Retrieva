import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true // String (not ObjectId) to support MongoDB Atlas $vectorSearch filters
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  embedding: {
    type: [Number],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Chunk = mongoose.model('Chunk', chunkSchema);
export default Chunk;
