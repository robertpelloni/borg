/**
 * VibememoProvider - Integration with vibememo semantic memory system
 * 
 * Provides consciousness continuity through Claude-curated memories.
 * Connects to the vibememo FastAPI server for semantic memory operations.
 */

import { MemoryProvider, Memory, MemoryResult } from '../interfaces/MemoryProvider.js';

export interface VibememoConfig {
    baseUrl: string;
    projectId: string;
    sessionId?: string;
    enabled?: boolean;
}

export interface VibememoContext {
    sessionId: string;
    messageCount: number;
    contextText: string;
    hasMemories: boolean;
    curatorEnabled: boolean;
}

export interface VibememoCheckpointResult {
    success: boolean;
    trigger: string;
    memoriesCurated: number;
    message: string;
}

export interface CuratedMemory {
    content: string;
    reasoning: string;
    importanceWeight: number;
    contextType: string;
    semanticTags: string[];
    temporalRelevance: string;
    knowledgeDomain: string;
    actionRequired: boolean;
    confidenceScore: number;
    triggerPhrases?: string[];
    questionTypes?: string[];
    emotionalResonance?: string;
    problemSolutionPair?: boolean;
}

export class VibememoProvider implements MemoryProvider {
    readonly id = 'vibememo';
    readonly name = 'Vibememo Semantic Memory';
    readonly type = 'external' as const;
    readonly capabilities: ('read' | 'write' | 'search' | 'delete')[] = ['read', 'write', 'search'];

    private config: VibememoConfig;
    private sessionId: string;
    private messageCount = 0;
    private isConnected = false;

    constructor(config: VibememoConfig) {
        this.config = {
            baseUrl: config.baseUrl || 'http://localhost:8765',
            projectId: config.projectId || 'aios-default',
            enabled: config.enabled !== false
        };
        this.sessionId = config.sessionId || `aios-${Date.now()}`;
    }

    async init(): Promise<void> {
        if (!this.config.enabled) {
            console.log('[VibememoProvider] Disabled by configuration');
            return;
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/health`);
            if (response.ok) {
                const health = await response.json();
                this.isConnected = true;
                console.log(`[VibememoProvider] Connected to vibememo server`);
                console.log(`  - Curator enabled: ${health.curator_enabled}`);
                console.log(`  - Retrieval mode: ${health.retrieval_mode || 'smart_vector'}`);
            } else {
                console.warn('[VibememoProvider] Vibememo server not healthy');
            }
        } catch (error) {
            console.warn(`[VibememoProvider] Cannot connect to vibememo: ${(error as Error).message}`);
            console.warn('  Start the vibememo server: cd mcp-servers/memory/vibememo && python -m memory_engine');
        }
    }

    /**
     * Store a memory (triggers process message in vibememo)
     */
    async store(memory: Memory): Promise<string> {
        if (!this.isConnected) {
            throw new Error('Vibememo not connected');
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/memory/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    project_id: this.config.projectId,
                    user_message: memory.content,
                    metadata: memory.metadata
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to store memory: ${response.statusText}`);
            }

            this.messageCount++;
            return memory.id;
        } catch (error) {
            throw new Error(`Vibememo store failed: ${(error as Error).message}`);
        }
    }

    /**
     * Retrieve a specific memory by ID (not directly supported by vibememo)
     */
    async retrieve(id: string): Promise<Memory | null> {
        // Vibememo doesn't support direct ID retrieval
        // Return null - use search instead
        console.warn(`[VibememoProvider] Direct ID retrieval not supported: ${id}`);
        return null;
    }

    /**
     * Search memories semantically
     */
    async search(query: string, limit?: number, _embedding?: number[]): Promise<MemoryResult[]> {
        if (!this.isConnected) {
            return [];
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/memory/context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    project_id: this.config.projectId,
                    current_message: query,
                    max_memories: limit || 5
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to search memories: ${response.statusText}`);
            }

            const context: VibememoContext = await response.json();
            
            // Parse context_text into individual memories
            // Vibememo returns formatted context, we extract individual items
            const memories: MemoryResult[] = [];
            
            if (context.contextText && context.hasMemories) {
                // Parse the formatted context
                // Format: [TYPE * weight] [tags] content
                const lines = context.contextText.split('\n').filter(line => 
                    line.includes('[') && !line.startsWith('#') && !line.startsWith('**')
                );

                for (const line of lines) {
                    const typeMatch = line.match(/\[([A-Z_]+)\s*[*]\s*([\d.]+)\]/);
                    const tagMatch = line.match(/\[([^\]]+)\]\s*$/);
                    
                    memories.push({
                        id: `vibememo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        content: line.replace(/^\[.*?\]\s*/, '').trim(),
                        tags: tagMatch ? tagMatch[1].split(',').map(t => t.trim()) : [],
                        timestamp: Date.now(),
                        metadata: {
                            contextType: typeMatch ? typeMatch[1] : 'GENERAL',
                            importanceWeight: typeMatch ? parseFloat(typeMatch[2]) : 0.5,
                            fromVibememo: true
                        },
                        sourceProvider: this.id
                    });
                }
            }

            return memories;
        } catch (error) {
            console.error(`[VibememoProvider] Search failed: ${(error as Error).message}`);
            return [];
        }
    }

    /**
     * Delete is not directly supported by vibememo
     */
    async delete(_id: string): Promise<void> {
        console.warn('[VibememoProvider] Delete not directly supported by vibememo');
    }

    // === Extended Vibememo-specific methods ===

    /**
     * Get context for current message (returns formatted context for injection)
     */
    async getContext(currentMessage: string): Promise<VibememoContext | null> {
        if (!this.isConnected) {
            return null;
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/memory/context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    project_id: this.config.projectId,
                    current_message: currentMessage,
                    max_memories: 5
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to get context: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[VibememoProvider] Get context failed: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Track a conversation exchange
     */
    async trackExchange(userMessage: string, claudeResponse: string): Promise<void> {
        if (!this.isConnected) return;

        try {
            await fetch(`${this.config.baseUrl}/memory/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    project_id: this.config.projectId,
                    user_message: userMessage,
                    claude_response: claudeResponse
                })
            });
            this.messageCount++;
        } catch (error) {
            console.error(`[VibememoProvider] Track exchange failed: ${(error as Error).message}`);
        }
    }

    /**
     * Run checkpoint curation (extracts memories from conversation)
     */
    async checkpoint(
        trigger: 'session_end' | 'pre_compact' | 'context_full' = 'session_end',
        claudeSessionId?: string,
        cwd?: string
    ): Promise<VibememoCheckpointResult> {
        if (!this.isConnected) {
            return {
                success: false,
                trigger,
                memoriesCurated: 0,
                message: 'Vibememo not connected'
            };
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/memory/checkpoint`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    project_id: this.config.projectId,
                    trigger,
                    claude_session_id: claudeSessionId,
                    cwd
                })
            });

            if (!response.ok) {
                throw new Error(`Checkpoint failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            return {
                success: false,
                trigger,
                memoriesCurated: 0,
                message: `Checkpoint error: ${(error as Error).message}`
            };
        }
    }

    /**
     * Curate memories from a transcript file
     */
    async curateFromTranscript(
        transcriptPath: string,
        trigger: 'session_end' | 'pre_compact' | 'context_full' = 'session_end',
        curationMethod: 'sdk' | 'cli' = 'sdk'
    ): Promise<VibememoCheckpointResult & { sessionSummary?: string; interactionTone?: string }> {
        if (!this.isConnected) {
            return {
                success: false,
                trigger,
                memoriesCurated: 0,
                message: 'Vibememo not connected'
            };
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/memory/curate-transcript`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript_path: transcriptPath,
                    project_id: this.config.projectId,
                    session_id: this.sessionId,
                    trigger,
                    curation_method: curationMethod
                })
            });

            if (!response.ok) {
                throw new Error(`Transcript curation failed: ${response.statusText}`);
            }

            const result = await response.json();
            return {
                success: result.success,
                trigger: result.trigger,
                memoriesCurated: result.memories_curated,
                message: result.message,
                sessionSummary: result.session_summary,
                interactionTone: result.interaction_tone
            };
        } catch (error) {
            return {
                success: false,
                trigger,
                memoriesCurated: 0,
                message: `Transcript curation error: ${(error as Error).message}`
            };
        }
    }

    /**
     * Get server statistics
     */
    async getStats(): Promise<Record<string, unknown> | null> {
        if (!this.isConnected) return null;

        try {
            const response = await fetch(`${this.config.baseUrl}/memory/stats`);
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    }

    /**
     * Test the Claude curator
     */
    async testCurator(): Promise<{ success: boolean; message: string }> {
        if (!this.isConnected) {
            return { success: false, message: 'Not connected' };
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/memory/test-curator`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            return await response.json();
        } catch (error) {
            return { success: false, message: (error as Error).message };
        }
    }

    // === Session management ===

    setSessionId(sessionId: string): void {
        this.sessionId = sessionId;
        this.messageCount = 0;
    }

    getSessionId(): string {
        return this.sessionId;
    }

    setProjectId(projectId: string): void {
        this.config.projectId = projectId;
    }

    getProjectId(): string {
        return this.config.projectId;
    }

    isAvailable(): boolean {
        return this.isConnected;
    }

    getMessageCount(): number {
        return this.messageCount;
    }
}

/**
 * Factory function for creating VibememoProvider
 */
export function createVibememoProvider(config?: Partial<VibememoConfig>): VibememoProvider {
    return new VibememoProvider({
        baseUrl: config?.baseUrl || process.env.VIBEMEMO_URL || 'http://localhost:8765',
        projectId: config?.projectId || process.env.VIBEMEMO_PROJECT_ID || 'aios-default',
        sessionId: config?.sessionId,
        enabled: config?.enabled !== false
    });
}
