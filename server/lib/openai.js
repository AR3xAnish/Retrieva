import { OpenAI } from 'openai';

const getOpenAIClient = () => {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'your_openai_key') {
    return null;
  }
  return new OpenAI({ apiKey });
};

/**
 * Generates vector embedding for the input text using OpenAI embeddings.
 * Model used: text-embedding-3-small (1536 dimensions).
 * Falls back to dummy vectors in development if OPENAI_API_KEY is not set.
 *
 * @param {string} text - The input text block to embed.
 * @returns {Promise<number[]>} Array of 1536 floating-point numbers.
 */
export async function embedText(text) {
  const client = getOpenAIClient();

  if (!client) {
    console.warn('[OPENAI EMBEDDING] Warning: OPENAI_API_KEY is not set or holds a placeholder. Generating a 1536-dimensional mock vector for development fallback.');
    // Generate 1536 dummy floats between -1.0 and 1.0
    return Array.from({ length: 1536 }, () => (Math.random() * 2 - 1));
  }

  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });

    if (response.data && response.data[0] && response.data[0].embedding) {
      return response.data[0].embedding;
    }
    throw new Error('Invalid response structure from OpenAI API.');
  } catch (error) {
    console.error('[OPENAI EMBEDDING] Error calling OpenAI API:', error.message);
    throw error;
  }
}
