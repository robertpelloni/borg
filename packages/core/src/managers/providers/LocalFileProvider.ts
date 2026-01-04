import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';
import { MemoryProvider, Memory, MemoryResult } from '../../interfaces/MemoryProvider.js';

export class LocalFileProvider implements MemoryProvider {
    public id = 'default-file';
    public name = 'Local File Storage';
    public type: 'file' = 'file';
    public capabilities: ('read' | 'write' | 'search' | 'delete')[] = ['read', 'write', 'search', 'delete'];

    private memories: Memory[] = [];
    private dataFile: string;
    private fuse: Fuse<Memory>;

    constructor(private dataDir: string) {
        this.dataFile = path.join(dataDir, 'memory.json');
        this.fuse = new Fuse([], {
            keys: ['content', 'tags'],
            threshold: 0.6 // Increased threshold (0.0 is perfect match, 1.0 is no match)
        });
        this.loadSync();
    }

    private loadSync() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        if (fs.existsSync(this.dataFile)) {
            try {
                const data = fs.readFileSync(this.dataFile, 'utf-8');
                this.memories = JSON.parse(data);
                this.fuse.setCollection(this.memories);
                console.log(`[LocalFileProvider] Loaded ${this.memories.length} items`);
            } catch (e) {
                console.error('[LocalFileProvider] Failed to load data:', e);
            }
        }
    }

    async init(): Promise<void> {
        // Already loaded in constructor
    }

    async store(memory: Memory): Promise<string> {
        // Check if ID exists, update if so
        const index = this.memories.findIndex(m => m.id === memory.id);
        if (index >= 0) {
            this.memories[index] = memory;
        } else {
            this.memories.push(memory);
        }
        this.fuse.setCollection(this.memories);
        this.save();
        return memory.id;
    }

    async retrieve(id: string): Promise<Memory | null> {
        return this.memories.find(m => m.id === id) || null;
    }

    async search(query: string, limit: number = 5, embedding?: number[]): Promise<MemoryResult[]> {
        const results = this.fuse.search(query);
        return results.slice(0, limit).map(r => ({
            ...r.item,
            sourceProvider: this.id,
            similarity: r.score ? 1 - r.score : undefined // Fuse score is distance (0 is best)
        }));
    }

    async update(id: string, updates: Partial<Memory>): Promise<void> {
        const index = this.memories.findIndex(m => m.id === id);
        if (index === -1) throw new Error(`Memory with ID ${id} not found`);

        this.memories[index] = { ...this.memories[index], ...updates };
        this.fuse.setCollection(this.memories);
        this.save();
    }

    async delete(id: string): Promise<void> {
        this.memories = this.memories.filter(m => m.id !== id);
        this.fuse.setCollection(this.memories);
        this.save();
    }

    async getAll(): Promise<Memory[]> {
        return this.memories;
    }

    async import(memories: Memory[]): Promise<void> {
        this.memories.push(...memories);
        this.fuse.setCollection(this.memories);
        this.save();
    }

    private save() {
        fs.writeFileSync(this.dataFile, JSON.stringify(this.memories, null, 2));
    }
}
