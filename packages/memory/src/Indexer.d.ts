import { VectorStore } from './VectorStore.js';
export declare class Indexer {
    private vectorStore;
    private maxChunkSize;
    constructor(vectorStore: VectorStore);
    indexDirectory(rootDir: string): Promise<number>;
    private walk;
}
//# sourceMappingURL=Indexer.d.ts.map