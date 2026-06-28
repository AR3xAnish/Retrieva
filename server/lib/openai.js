/**
 * Generates vector embedding for the input text using Hugging Face Inference API.
 * Model used: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions).
 * Falls back to dummy vectors in development if HUGGINGFACE_API_KEY is not set.
 *
 * @param {string} text - The input text block to embed.
 * @returns {Promise<number[]>} Array of 384 floating-point numbers.
 */
export async function embedText(text) {
  const apiKey = (process.env.HUGGINGFACE_API_KEY || '').trim();

  if (!apiKey || apiKey === 'your_huggingface_key' || apiKey.startsWith('hf_')) {
    // Note: If they left 'hf_...' placeholder in .env.example, fallback safely.
    if (!apiKey || apiKey === 'your_huggingface_key' || apiKey === 'hf_...') {
      console.warn('[HUGGING FACE EMBEDDING] Warning: HUGGINGFACE_API_KEY is not set or holds a placeholder. Generating a 384-dimensional mock vector for development fallback.');
      // Generate 384 dummy floats between -1.0 and 1.0
      return Array.from({ length: 384 }, () => (Math.random() * 2 - 1));
    }
  }

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Hugging Face feature extraction model returns a nested array of embeddings: e.g. [ [0.12, -0.45, ...] ]
    // The embedding for the input text is the first element, containing 384 dimensions.
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0];
    } else if (Array.isArray(data) && typeof data[0] === 'number') {
      // Sometimes if single string input without list wrapping is parsed, it might return a flat array directly
      return data;
    }

    throw new Error('Invalid response structure from Hugging Face API.');
  } catch (error) {
    console.error('[HUGGING FACE EMBEDDING] Error calling Inference API:', error.message);
    throw error;
  }
}
