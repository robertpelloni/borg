
// LAZY IMPORTS: lancedb and @xenova/transformers are heavy (30-60s load)
// They're dynamically imported in initialize() instead of at startup
import path from 'path';
import fs from 'fs/promises';

// Define Schema for Code Segments
// We store: id, file_path, content, hash (to avoid re-indexing), and vector.
export interface CodeDocument {
    id: string; // usually relative path + chunk index
    file_path: string;
    content: string;
    hash: string;
    vector?: number[];
}

export class VectorStore {
    private dbPath: string;
    private db: any;
    private table: any;
    private embeddingPipeline: any;
    private initialized: boolean = false;

    constructor(storagePath: string) {
        this.dbPath = storagePath;
    }

    async initialize() {
        if (this.initialized) return;

        console.log(`[VectorStore] Initializing LanceDB at ${this.dbPath}...`);

        // 1. Connect to DB (LAZY LOAD)
        const lancedb = await import('@lancedb/lancedb');
        this.db = await lancedb.connect(this.dbPath);

        // 2. Initialize Embedding Model (LAZY LOAD)
        console.log(`[VectorStore] Loading Embedding Model (Xenova/all-MiniLM-L6-v2)...`);
        const { pipeline } = await import('@xenova/transformers');
        this.embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

        // 3. Open or Create Table
        const tableName = 'codebase_v1';
        try {
            this.table = await this.db.openTable(tableName);
        } catch (e) {
            console.log(`[VectorStore] Creating new table '${tableName}'...`);
            // Initial dummy data to define schema (LanceDB requires schema inference from first data typically, or explicit schema)
            // We'll use a dummy row with a vector of size 384 (MiniLM-L6-v2 dimension)
            const dummyVector = new Array(384).fill(0.0);
            this.table = await this.db.createTable(tableName,
                [{
                    id: 'init',
                    file_path: 'init',
                    content: 'init',
                    hash: 'init',
                    vector: dummyVector
                }]
            );
            // Delete dummy
            await this.table.delete("id = 'init'");
        }

        this.initialized = true;
        console.log(`[VectorStore] Ready.`);
    }

    async embed(text: string): Promise<number[]> {
        if (!this.embeddingPipeline) throw new Error("VectorStore not initialized");

        // Run model
        // output is a Tensor. We want mean pooling or CLS token?
        // simple feature-extraction pipeline usually returns the pooled output or sequence.
        // For 'feature-extraction', default is full sequence. We need to pool.
        // Actually, let's use the 'sentence-transformers/all-MiniLM-L6-v2' style which typically wants mean pooling.
        const output = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });

        // Convert Float32Array to number[]
        return Array.from(output.data);
    }

    async addDocuments(docs: Omit<CodeDocument, 'vector'>[]) {
        if (!this.initialized) await this.initialize();

        console.log(`[VectorStore] Embedding ${docs.length} documents...`);

        const rows = [];
        for (const doc of docs) {
            try {
                const vector = await this.embed(doc.content);
                rows.push({
                    ...doc,
                    vector
                });
            } catch (e: any) {
                console.error(`[VectorStore] Failed to embed ${doc.id}: ${e.message}`);
            }
        }

        if (rows.length > 0) {
            await this.table.add(rows);
            console.log(`[VectorStore] Added ${rows.length} rows.`);
        }
    }

    async search(query: string, limit: number = 5): Promise<CodeDocument[]> {
        if (!this.initialized) await this.initialize();

        const queryVector = await this.embed(query);
        const execution = await this.table.search(queryVector).limit(limit).execute();

        let results: any[] = [];
        if (Array.isArray(execution)) {
            results = execution;
        } else {
            // Handle AsyncGenerator or Iterator
            // @ts-ignore
            try {
                for await (const row of execution) {
                    results.push(row);
                }
            } catch (e) {
                console.error("[VectorStore] Failed to iterate results:", e);
            }
        }

        // Map back to CodeDocument
        return results.map((r: any) => ({
            id: r.id,
            file_path: r.file_path,
            content: r.content,
            hash: r.hash
        }));
    }

    /**
     * Clear all data.
     */
    async reset() {
        if (!this.initialized) await this.initialize();
        // Since LanceDB doesn't easily support "truncate", we drop and recreate
        try {
            await this.db.dropTable('codebase_v1');
            this.initialized = false;
            await this.initialize();
        } catch (e) { }
    }
}
