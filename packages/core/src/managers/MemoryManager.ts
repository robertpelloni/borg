import path from 'path';
import fs from 'fs';
import { VectorStore } from '../services/VectorStore.js';

export class MemoryManager {
    private memoryPath: string;
    private readonly SIMILARITY_THRESHOLD = 0.85; // Content must be <85% similar to be considered unique

    constructor(private dataDir: string, private vectorStore: VectorStore) {
        this.memoryPath = path.join(dataDir, 'memory.json');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(this.memoryPath)) fs.writeFileSync(this.memoryPath, '[]');
    }

    /**
     * Check if content is a duplicate of existing memory using Jaccard similarity
     */
    private isDuplicate(newContent: string, existingMemories: Array<{ content: string }>): boolean {
        const normalize = (text: string): Set<string> => {
            return new Set(
                text.toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 2)
            );
        };

        const newWords = normalize(newContent);
        if (newWords.size === 0) return false;

        for (const memory of existingMemories) {
            const existingWords = normalize(memory.content);
            if (existingWords.size === 0) continue;

            // Jaccard similarity: intersection / union
            const intersection = new Set([...newWords].filter(w => existingWords.has(w)));
            const union = new Set([...newWords, ...existingWords]);
            const similarity = intersection.size / union.size;

            if (similarity >= this.SIMILARITY_THRESHOLD) {
                return true;
            }
        }
        return false;
    }

    async remember(args: { content: string, tags?: string[], skipDedup?: boolean }) {
        // Check for duplicates unless explicitly skipped
        if (!args.skipDedup) {
            const memories = JSON.parse(fs.readFileSync(this.memoryPath, 'utf-8'));
            if (this.isDuplicate(args.content, memories)) {
                return "Memory already exists (deduplicated).";
            }
        }

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

    async getStats() {
        const memories = JSON.parse(fs.readFileSync(this.memoryPath, 'utf-8'));
        return {
            totalEntries: memories.length,
            lastEntry: memories[memories.length - 1]?.timestamp || 'Never',
            dbSize: fs.statSync(this.memoryPath).size
        };
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

    async ingestSession(sessionId: string, sessionData: any) {
        await this.remember({
            content: `Session ${sessionId} summary: ${JSON.stringify(sessionData)}`,
            tags: ['session', sessionId]
        });
    }

    async ingestAgentMessage(agentId: string, message: any) {
        await this.remember({
            content: `Agent ${agentId} message: ${JSON.stringify(message)}`,
            tags: ['agent', agentId]
        });
    }

    async ingestInteraction(data: any) {
        await this.remember({
            content: `Interaction: ${JSON.stringify(data)}`,
            tags: ['interaction']
        });
    }

    async backfillFromSessionLogs(sessionsDir: string, options?: { 
        since?: Date, 
        agentFilter?: string,
        maxSessions?: number 
    }): Promise<{ processed: number, skipped: number, errors: number }> {
        const stats = { processed: 0, skipped: 0, errors: 0 };
        
        if (!fs.existsSync(sessionsDir)) {
            return stats;
        }

        const sessionFiles = fs.readdirSync(sessionsDir)
            .filter(f => f.endsWith('.json'))
            .slice(0, options?.maxSessions || 100);

        for (const file of sessionFiles) {
            try {
                const sessionPath = path.join(sessionsDir, file);
                const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
                
                if (options?.since && new Date(session.timestamp) < options.since) {
                    stats.skipped++;
                    continue;
                }
                
                if (options?.agentFilter && session.agentName !== options.agentFilter) {
                    stats.skipped++;
                    continue;
                }

                const keyInsights = this.extractSessionInsights(session);
                if (keyInsights.length > 0) {
                    for (const insight of keyInsights) {
                        await this.remember({
                            content: insight,
                            tags: ['backfill', 'session', session.agentName || 'unknown']
                        });
                    }
                    stats.processed++;
                } else {
                    stats.skipped++;
                }
            } catch {
                stats.errors++;
            }
        }

        return stats;
    }

    private extractSessionInsights(session: { id: string, agentName?: string, messages?: Array<{ role: string, content: string }> }): string[] {
        const insights: string[] = [];
        
        if (!session.messages || session.messages.length === 0) {
            return insights;
        }

        const assistantMessages = session.messages
            .filter(m => m.role === 'assistant' && m.content)
            .map(m => m.content);

        if (assistantMessages.length === 0) {
            return insights;
        }

        const combinedContent = assistantMessages.join(' ');
        
        if (combinedContent.length > 500) {
            const summary = `Session ${session.id} (${session.agentName || 'agent'}): ${combinedContent.substring(0, 400)}...`;
            insights.push(summary);
        }

        const codeBlocks = combinedContent.match(/```[\s\S]*?```/g);
        if (codeBlocks && codeBlocks.length > 0) {
            insights.push(`Session ${session.id} contained ${codeBlocks.length} code examples`);
        }

        return insights;
    }

    getProviders() {
        return [];
    }

    listSnapshots() {
        return [];
    }

    async createSnapshot() {
        return { id: 'snapshot-' + Date.now(), timestamp: new Date().toISOString() };
    }

    async restoreSnapshot(id: string) {
        return { success: true, id };
    }

    getToolDefinitions() {
        return [
            {
                name: "remember",
                description: "Save a piece of information to long-term memory. Automatically deduplicates similar content.",
                inputSchema: {
                    type: "object",
                    properties: {
                        content: { type: "string", description: "The content to remember" },
                        tags: { type: "array", items: { type: "string" }, description: "Optional tags for categorization" },
                        skipDedup: { type: "boolean", description: "Skip deduplication check (default: false)" }
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
            },
            {
                name: "memory_stats",
                description: "Get statistics about the long-term memory.",
                inputSchema: { type: "object", properties: {} }
            },
            {
                name: "backfill_memory",
                description: "Backfill memory from historical session logs. Extracts key insights from past sessions.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sessionsDir: { type: "string", description: "Path to sessions directory" },
                        since: { type: "string", description: "ISO date string to filter sessions from" },
                        agentFilter: { type: "string", description: "Filter by agent name" },
                        maxSessions: { type: "number", description: "Maximum sessions to process (default: 100)" }
                    },
                    required: ["sessionsDir"]
                }
            }
        ];
    }
}
