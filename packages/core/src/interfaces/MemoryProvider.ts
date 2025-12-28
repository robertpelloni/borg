export interface Memory {
    id: string;
    content: string;
    tags: string[];
    timestamp: number;
    embedding?: number[];
    metadata?: Record<string, any>;
}

export interface MemoryResult extends Memory {
    similarity?: number;
    sourceProvider: string;
}

export interface MemoryProvider {
    id: string;
    name: string;
    type: 'vector' | 'graph' | 'key-value' | 'file' | 'external';
    capabilities: ('read' | 'write' | 'search' | 'delete')[];
    
    init(): Promise<void>;
    
    store(memory: Memory): Promise<string>;
    
    retrieve(id: string): Promise<Memory | null>;
    
    search(query: string, limit?: number, embedding?: number[]): Promise<MemoryResult[]>;
    
    delete(id: string): Promise<void>;
    
    // Optional: For sync/transfer
    getAll?(): Promise<Memory[]>;
    import?(memories: Memory[]): Promise<void>;
}
