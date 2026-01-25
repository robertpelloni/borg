/**
 * CodeSplitter
 * Semantic chunking for code files.
 * Uses indentation and keywords to keep functions/classes together.
 */
export class CodeSplitter {
    /**
     * Splits code into semantic chunks.
     * @param code The source code
     * @param extension File extension (e.g. .ts, .py)
     * @param maxChunkSize Max chars per chunk (soft limit)
     */
    static split(code, extension, maxChunkSize = 1000) {
        // Naive line-based splitting for now, enhanced with Block Detection
        const lines = code.split('\n');
        const chunks = [];
        let currentChunk = [];
        let currentSize = 0;
        for (const line of lines) {
            currentChunk.push(line);
            currentSize += line.length + 1; // +1 for newline
            // Heuristic using indentation:
            // If line starts with NO spaces (top level), it might be a good break point
            // IF current chunk is big enough.
            const isTopLevel = !line.startsWith(' ') && !line.startsWith('\t') && line.trim().length > 0;
            const isBlockEnd = line.trim() === '}' || line.trim() === '};';
            if (currentSize >= maxChunkSize) {
                // Try to find a good break point
                if (isTopLevel || isBlockEnd) {
                    chunks.push(currentChunk.join('\n'));
                    currentChunk = [];
                    currentSize = 0;
                }
            }
            else if (currentSize >= maxChunkSize * 2) {
                // Hard limit, force split
                chunks.push(currentChunk.join('\n'));
                currentChunk = [];
                currentSize = 0;
            }
        }
        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join('\n'));
        }
        return chunks;
    }
}
