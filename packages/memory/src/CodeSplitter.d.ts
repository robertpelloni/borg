/**
 * CodeSplitter
 * Semantic chunking for code files.
 * Uses indentation and keywords to keep functions/classes together.
 */
export declare class CodeSplitter {
    /**
     * Splits code into semantic chunks.
     * @param code The source code
     * @param extension File extension (e.g. .ts, .py)
     * @param maxChunkSize Max chars per chunk (soft limit)
     */
    static split(code: string, extension: string, maxChunkSize?: number): string[];
}
//# sourceMappingURL=CodeSplitter.d.ts.map