import { MemoryManager } from '../managers/MemoryManager.js';
import { ModelGateway } from '../gateway/ModelGateway.js';

export class TrafficObserver {
    constructor(private modelGateway: ModelGateway, private memoryManager: MemoryManager) {}

    async observe(tool: string, result: any) {
        // Heuristic: If the tool result is long text, it might contain facts worth remembering.
        // In a real system, we'd use a cheaper model (e.g. GPT-3.5) to extract facts.
        // For now, we just log specific high-value tools.

        if (tool === 'read_active_tab') {
            const content = typeof result === 'string' ? result : JSON.stringify(result);
            if (content.length > 100) {
                 // Too noisy to save everything, but let's simulate extraction
                 console.log(`[TrafficObserver] Analyzed content from ${tool}`);
            }
        }
    }
}
