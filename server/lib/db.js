import mongoose from 'mongoose';

/**
 * Programmatically connects to MongoDB and checks/creates the Atlas search index named "vector_index".
 * Wraps index actions in try/catch to ensure local offline development setups never crash.
 *
 * @param {string} uri - The MongoDB connection string.
 * @returns {Promise<void>}
 */
export async function connectDb(uri) {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB successfully.');

    // Programmatically check and create search index
    try {
      const collection = mongoose.connection.db.collection('chunks');

      // List search indexes (Atlas aggregation command)
      const indexesCursor = collection.listSearchIndexes();
      const indexes = await indexesCursor.toArray();

      // Check if vector_index exists
      const existingIndex = indexes.find(idx => idx.name === 'vector_index');

      // Check if definition matches or needs update
      // To be safe and simple, if index doesn't exist, create it.
      // If it exists, Atlas will automatically handle matching definitions, but we ensure documentId is in the code spec.
      if (!existingIndex) {
        console.log('[DB SEARCH INDEX] "vector_index" not found. Creating vector search index...');
        await collection.createSearchIndex({
          name: 'vector_index',
          type: 'vectorSearch',
          definition: {
            fields: [
              { type: 'vector', path: 'embedding', numDimensions: 384, similarity: 'cosine' },
              { type: 'filter', path: 'userId' },
              { type: 'filter', path: 'documentId' }
            ]
          }
        });
        console.log('[DB SEARCH INDEX] "vector_index" creation request submitted successfully.');
      } else {
        console.log('[DB SEARCH INDEX] "vector_index" search index already exists in collections.');
        
        // Check if index needs updating (optional: if previous index lacks documentId filter, we can update it)
        const fields = existingIndex.latestDefinition?.fields || [];
        const hasDocIdFilter = fields.some(f => f.path === 'documentId' && f.type === 'filter');
        
        if (!hasDocIdFilter) {
          console.log('[DB SEARCH INDEX] "vector_index" is missing "documentId" filter path. Updating search index definition...');
          await collection.updateSearchIndex('vector_index', {
            fields: [
              { type: 'vector', path: 'embedding', numDimensions: 384, similarity: 'cosine' },
              { type: 'filter', path: 'userId' },
              { type: 'filter', path: 'documentId' }
            ]
          });
          console.log('[DB SEARCH INDEX] "vector_index" update request submitted successfully.');
        }
      }
    } catch (indexErr) {
      console.warn('[DB SEARCH INDEX] Warning: Could not check/create vector search index. (Note: Programmatic Search Indexes require MongoDB Atlas tier and are not supported on local standard installations):', indexErr.message);
    }
  } catch (error) {
    console.error('Database connection failed (will retry if server runs):', error.message);
    throw error;
  }
}
