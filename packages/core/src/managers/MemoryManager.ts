import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';

interface MemoryItem {
    id: string;
    content: string;
    tags: string[];
    timestamp: number;
}

export class MemoryManager {
    private memories: MemoryItem[] = [];
    private dataFile: string;
    private fuse: Fuse<MemoryItem>;

    constructor(dataDir: string) {
        if (!fs.existsSync(dataDir)) {
            try {
                fs.mkdirSync(dataDir, { recursive: true });
            } catch (e) {
                console.error('[Memory] Failed to create data dir:', e);
            }
        }
        this.dataFile = path.join(dataDir, 'memory.json');

        this.fuse = new Fuse([], {
            keys: ['content', 'tags'],
            threshold: 0.4
        });

        this.load();
    }

    private load() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf-8');
                this.memories = JSON.parse(data);
                this.fuse.setCollection(this.memories);
                console.log(`[Memory] Loaded ${this.memories.length} items`);
            }
        } catch (e) {
            console.error('[Memory] Failed to load memory:', e);
        }
    }

    private save() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.memories, null, 2));
        } catch (e) {
            console.error('[Memory] Failed to save memory:', e);
        }
    }

    async remember(args: { content: string, tags?: string[] }) {
        const item: MemoryItem = {
            id: Math.random().toString(36).substring(7),
            content: args.content,
            tags: args.tags || [],
            timestamp: Date.now()
        };
        this.memories.push(item);
        this.fuse.setCollection(this.memories);
        this.save();
        return `Memory stored with ID: ${item.id}`;
    }

    async search(args: { query: string }) {
        const results = this.fuse.search(args.query);
        return results.map(r => r.item);
    }

    async recall(args: { limit?: number }) {
        const limit = args.limit || 10;
        return this.memories.slice(-limit);
    }

    getToolDefinitions() {
        return [
            {
                name: "remember",
                description: "Store a new memory or fact for later retrieval.",
                inputSchema: {
                    type: "object",
                    properties: {
                        content: { type: "string" },
                        tags: { type: "array", items: { type: "string" } }
                    },
                    required: ["content"]
                }
            },
            {
                name: "search_memory",
                description: "Search stored memories by content or tags.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: { type: "string" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "recall_recent",
                description: "Retrieve the most recent memories.",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: { type: "number" }
                    }
                }
            }
        ];
    }
}
