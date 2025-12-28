import path from 'path';
import fs from 'fs';
import { VectorStore } from '../services/VectorStore.js';

export class MemoryManager {
    private memoryPath: string;

    constructor(private dataDir: string, private vectorStore: VectorStore) {
        this.memoryPath = path.join(dataDir, 'memory.json');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(this.memoryPath)) fs.writeFileSync(this.memoryPath, '[]');
    }

    async remember(args: { content: string, tags?: string[] }) {
        const entry = {
            timestamp: new Date().toISOString(),
            content: args.content,
            tags: args.tags || []
        };

        // Save to JSON log
        const memories = JSON.parse(fs.readFileSync(this.memoryPath, 'utf-8'));
        memories.push(entry);
        fs.writeFileSync(this.memoryPath, JSON.stringify(memories, null, 2));

        // Save to Vector Store
        await this.vectorStore.add(args.content, { tags: args.tags, timestamp: entry.timestamp });

        return "Memory saved.";
    }

    async search(args: { query: string }) {
        const results = await this.vectorStore.search(args.query);
        return results.map(r => ({ content: r.content, metadata: r.metadata }));
    }

    async recall(args: { limit?: number }) {
        const memories = JSON.parse(fs.readFileSync(this.memoryPath, 'utf-8'));
        // Return last N memories
        return memories.slice(-(args.limit || 10));
    }

    async consolidateLogs(logs: any[]) {
        // Simple heuristic: concatenate "response" type logs and save as a daily summary.
        const summary = logs
            .filter(l => l.type === 'response')
            .map(l => `Tool: ${l.tool}, Result: ${JSON.stringify(l.result).substring(0, 100)}...`)
            .join('\n');

        if (summary) {
            await this.remember({ content: `Daily Log Summary:\n${summary}`, tags: ['summary', 'logs'] });
            return "Logs consolidated.";
        }
        return "No logs to consolidate.";
    }

    getToolDefinitions() {
        return [
            {
                name: "remember",
                description: "Save a piece of information to long-term memory.",
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
                description: "Semantically search memory for information.",
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
                description: "Recall recent memories.",
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
