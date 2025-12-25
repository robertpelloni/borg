import { EventEmitter } from 'events';
import { ModelGateway } from '../gateway/ModelGateway.js';
import { MemoryManager } from '../managers/MemoryManager.js';

interface Interaction {
    timestamp: number;
    type: string;
    content: any;
}

export class TrafficObserver extends EventEmitter {
    private buffer: Interaction[] = [];
    private BUFFER_LIMIT = 5;

    constructor(
        private gateway: ModelGateway,
        private memoryManager: MemoryManager
    ) {
        super();
    }

    observe(type: string, content: any) {
        this.buffer.push({
            timestamp: Date.now(),
            type,
            content
        });

        if (this.buffer.length >= this.BUFFER_LIMIT) {
            this.flushAndSummarize();
        }
    }

    private async flushAndSummarize() {
        const batch = [...this.buffer];
        this.buffer = [];

        console.log('[TrafficObserver] Analyzing batch for insights...');

        try {
            // Simplify batch for LLM
            const log = batch.map(i => `[${new Date(i.timestamp).toISOString()}] ${i.type}: ${JSON.stringify(i.content)}`).join('\n');

            const response = await this.gateway.complete({
                system: "You are a background memory system. Analyze the following tool interactions and extract 1-3 key facts or user preferences. Return ONLY a JSON array of strings. If nothing interesting, return [].",
                messages: [{ role: 'user', content: log }]
            });

            let facts: string[] = [];
            try {
                // Try to parse JSON from response
                const text = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
                facts = JSON.parse(text);
            } catch {
                // Fallback: split by newlines if not JSON
                facts = response.content.split('\n').filter(l => l.trim().length > 0);
            }

            if (Array.isArray(facts)) {
                for (const fact of facts) {
                    if (typeof fact === 'string' && fact.length > 5) {
                        await this.memoryManager.remember(`auto:${Date.now()}`, fact, ['auto-memory']);
                        console.log(`[TrafficObserver] Auto-remembered: ${fact}`);
                    }
                }
            }
        } catch (e) {
            console.warn('[TrafficObserver] Failed to summarize:', e);
        }
    }
}
