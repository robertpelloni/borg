export interface CodeDocument {
    id: string;
    file_path: string;
    content: string;
    hash: string;
    vector?: number[];
}
export declare class VectorStore {
    private dbPath;
    private db;
    private table;
    private embeddingPipeline;
    private initialized;
    constructor(storagePath: string);
    initialize(): Promise<void>;
    embed(text: string): Promise<number[]>;
    addDocuments(docs: Omit<CodeDocument, 'vector'>[]): Promise<void>;
    search(query: string, limit?: number): Promise<CodeDocument[]>;
    /**
     * Clear all data.
     */
    reset(): Promise<void>;
}
//# sourceMappingURL=VectorStore.d.ts.map