
export interface ModelSelectionRequest {
    provider?: string;
    taskComplexity?: 'low' | 'medium' | 'high';
    taskType?: 'worker' | 'supervisor'; // explicit role override
}

export interface SelectedModel {
    provider: string;
    modelId: string;
    reason: string;
}

interface ModelStatus {
    isDepleted: boolean;
    depletedAt?: number;
    retryAfter?: number; // timestamp
}

// Configuration for fallback chains
const MODEL_CHAINS = {
    // Fast, cheap models for bulk work
    worker: [
        { provider: 'ollama', modelId: 'gemma' }, // Local First!
        { provider: 'google', modelId: 'gemini-2.5-flash-image' },
        { provider: 'deepseek', modelId: 'deepseek-chat' },
        { provider: 'openrouter', modelId: 'glm-4' }
    ],
    // Intelligence-heavy models for planning/review
    supervisor: [
        { provider: 'ollama', modelId: 'gemma' }, // Local Council
        { provider: 'deepseek', modelId: 'deepseek-reasoner' },
        { provider: 'google', modelId: 'gemini-2.5-flash-image' },
        { provider: 'openai', modelId: 'gpt-4o' }
    ]
};

const COOL_DOWN_MS = 60 * 1000; // 1 minute cool down for depleted models

export class ModelSelector {
    private modelStates: Map<string, ModelStatus> = new Map();

    constructor() {
        console.log("ModelSelector initialized with Fallback Chains");
    }

    /**
     * Reports a model failure (e.g. Quota Limit 429/403).
     * The selector will mark this model as depleted for the cool-down period.
     */
    public reportFailure(modelId: string) {
        console.warn(`[ModelSelector] Reporting failure for ${modelId}. Marking as DEPLETED.`);
        this.modelStates.set(modelId, {
            isDepleted: true,
            depletedAt: Date.now(),
            retryAfter: Date.now() + COOL_DOWN_MS
        });
    }

    public async selectModel(req: ModelSelectionRequest): Promise<SelectedModel> {
        // 1. Determine Chain
        let chain = MODEL_CHAINS.worker; // Default to worker
        if (req.taskType === 'supervisor' || req.taskComplexity === 'high') {
            chain = MODEL_CHAINS.supervisor;
        }

        // 2. Iterate Chain to find first non-depleted model
        for (const candidate of chain) {
            const status = this.modelStates.get(candidate.modelId);

            // Check if depleted
            if (status && status.isDepleted) {
                if (Date.now() > (status.retryAfter || 0)) {
                    // Cool down expired, reset status
                    console.log(`[ModelSelector] Cool-down expired for ${candidate.modelId}. Re-enabling.`);
                    this.modelStates.delete(candidate.modelId);
                } else {
                    // Still depleted, skip
                    console.log(`[ModelSelector] Skipping ${candidate.modelId} (Depleted until ${new Date(status.retryAfter!).toISOString()})`);
                    continue;
                }
            }

            // Found valid model
            return {
                provider: candidate.provider,
                modelId: candidate.modelId,
                reason: status ? 'RECOVERED' : 'PRIMARY_CHOICE'
            };
        }

        // 3. Fallback of last resort (if all chains depleted)
        console.error("[ModelSelector] ALL MODELS DEPLETED! Returning default fallback.");
        return {
            provider: 'google',
            modelId: 'gemini-1.5-pro',
            reason: 'EMERGENCY_FALLBACK'
        };
    }
}
