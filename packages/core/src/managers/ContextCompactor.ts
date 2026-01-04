import { AgentExecutor } from '../agents/AgentExecutor.js';
import { MemoryManager } from './MemoryManager.js';

export interface CompactedContext {
    summary: string;
    facts: string[];
    decisions: string[];
    actionItems: string[];
}

export class ContextCompactor {
    constructor(
        private agentExecutor: AgentExecutor,
        private memoryManager?: MemoryManager
    ) {}

    async compact(content: string, type: 'conversation' | 'tool_output' = 'conversation'): Promise<CompactedContext> {
        const prompt = `
        Analyze the following ${type} content and extract key information.
        Return a JSON object with the following keys:
        - summary: A concise summary of what happened (max 2 sentences).
        - facts: A list of factual statements or user preferences discovered.
        - decisions: A list of technical or product decisions made.
        - actionItems: A list of tasks or follow-ups identified.

        Content:
        """
        ${content.substring(0, 8000)} 
        """
        
        Output JSON only.
        `;

        try {
            const result = await this.agentExecutor.run({
                name: "ContextCompactor",
                description: "Compacts raw text into structured memory.",
                instructions: "You are a precise data extractor. Output valid JSON only.",
                model: "gpt-4-turbo" // Or configurable
            }, prompt);

            if (!result) {
                return { summary: "No result from agent", facts: [], decisions: [], actionItems: [] };
            }

            // Attempt to parse JSON
            let compacted: CompactedContext;
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                compacted = JSON.parse(jsonMatch[0]);
            } else {
                compacted = { summary: result, facts: [], decisions: [], actionItems: [] };
            }

            // Deduplication Logic
            if (this.memoryManager && compacted.facts.length > 0) {
                const uniqueFacts: string[] = [];
                for (const fact of compacted.facts) {
                    const exists = await this.checkFactExists(fact);
                    if (!exists) {
                        uniqueFacts.push(fact);
                    }
                }
                compacted.facts = uniqueFacts;
            }

            return compacted;

        } catch (e) {
            console.error("Context compaction failed:", e);
            return { summary: "Failed to compact context.", facts: [], decisions: [], actionItems: [] };
        }
    }

    private async checkFactExists(fact: string): Promise<boolean> {
        if (!this.memoryManager) return false;
        try {
            const results = await this.memoryManager.search({ query: fact });
            // If we find a highly similar memory (e.g. > 0.85), assume it exists
            return results.some(r => r.similarity !== undefined && r.similarity > 0.85);
        } catch (e) {
            return false;
        }
    }
}
