/**
 * Helper to chunk text into regular blocks using character mappings.
 * 1 token is approximately 4 characters.
 *
 * @param {string} text - The input text to chunk.
 * @param {number} chunkSize - Number of tokens per chunk (default 512 tokens = ~2048 characters).
 * @param {number} overlap - Number of tokens to overlap between chunks (default 50 tokens = ~200 characters).
 * @returns {string[]} Array of chunked text blocks.
 */
export function chunkText(text, chunkSize = 512, overlap = 50) {
  const chunkSizeChar = chunkSize * 4;
  const overlapChar = overlap * 4;
  const chunks = [];

  if (!text) return chunks;

  let i = 0;
  while (i < text.length) {
    // Slice potential chunk window
    const slice = text.slice(i, i + chunkSizeChar);
    if (slice.length === 0) break;

    let chunkEndOffset = slice.length;

    // Search for sentence boundaries (last ". ") in the second half of the slice
    const halfOffset = Math.floor(slice.length / 2);
    const lastPeriodIndex = slice.lastIndexOf('. ');

    if (lastPeriodIndex >= halfOffset) {
      // End at the period, retaining it in the current chunk
      chunkEndOffset = lastPeriodIndex + 1; // includes the '.'
    }

    const chunkContent = slice.slice(0, chunkEndOffset).trim();
    if (chunkContent.length >= 50) {
      chunks.push(chunkContent);
    }

    const actualChunkEnd = i + chunkEndOffset;
    const nextStart = actualChunkEnd - overlapChar;

    if (nextStart <= i) {
      // Guard against infinite loops (e.g., if overlap is larger than chunk length or progress is stuck)
      i = actualChunkEnd;
    } else {
      i = nextStart;
    }
  }

  return chunks;
}
