import { MemoryManager } from './MemoryManager.js';
import { ContextCompactor } from './ContextCompactor.js';
import { AgentExecutor } from '../agents/AgentExecutor.js';

export interface IngestionResult {
    success: boolean;
    summary?: string;
    facts?: string[];
    decisions?: string[];
    actionItems?: string[];
    memoryIds?: string[];
    error?: string;
}

export class IngestionManager {
    private compactor: ContextCompactor;

    constructor(
        private memoryManager: MemoryManager,
        agentExecutor: AgentExecutor
    ) {
        this.compactor = new ContextCompactor(agentExecutor);
    }

    /**
     * Ingests raw content, summarizes it, and stores the structured results in memory.
     * @param source The source of the content (e.g., "Meeting Notes", "Discord Log")
     * @param content The raw text content to ingest
     * @param options Optional configuration for the ingestion
     */
    async ingest(source: string, content: string, options: { tags?: string[] } = {}): Promise<IngestionResult> {
        console.log(`[IngestionManager] Starting ingestion for source: ${source}`);

        try {
            // 1. Compact/Summarize the content
            const compacted = await this.compactor.compact(content, 'conversation');

            const memoryIds: string[] = [];
            const baseTags = options.tags || [];

            // 2. Store Summary
            if (compacted.summary) {
                const summaryId = await this.memoryManager.remember({
                    content: `[Summary - ${source}] ${compacted.summary}`,
                    tags: ['ingestion', 'summary', source, ...baseTags]
                });
                if (typeof summaryId === 'string') memoryIds.push(summaryId); // remember returns a string message or ID, usually ID in this impl
            }

            // 3. Store Facts
            for (const fact of compacted.facts) {
                const id = await this.memoryManager.remember({
                    content: `[Fact - ${source}] ${fact}`,
                    tags: ['ingestion', 'fact', source, ...baseTags]
                });
                // Check if return is ID (current implementation returns a string message, need to adjust expectation or parse)
            }

            // 4. Store Decisions
            for (const decision of compacted.decisions) {
                await this.memoryManager.remember({
                    content: `[Decision - ${source}] ${decision}`,
                    tags: ['ingestion', 'decision', source, ...baseTags]
                });
            }

            // 5. Store Action Items
            for (const item of compacted.actionItems) {
                await this.memoryManager.remember({
                    content: `[Action - ${source}] ${item}`,
                    tags: ['ingestion', 'action-item', source, ...baseTags]
                });
            }

            return {
                success: true,
                summary: compacted.summary,
                facts: compacted.facts,
                decisions: compacted.decisions,
                actionItems: compacted.actionItems,
                memoryIds
            };

        } catch (error: any) {
            console.error(`[IngestionManager] Ingestion failed:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
