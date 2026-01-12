/**
 * AIOS Memory Compaction Service
 * 
 * Session history compaction system for generating structured "Memory Files"
 * that enable session continuity across agent instances.
 * 
 * Features:
 * - Compact session history into structured handoff documents
 * - Extract key decisions, unresolved issues, and technical context
 * - Generate context blocks for priming new sessions
 * - Support for multiple output formats
 * 
 * @module services/MemoryCompactionService
 */

import { EventEmitter } from 'events';
import { getLLMProviderRegistry, Message } from '../providers/LLMProviderRegistry.js';

// ============================================
// Types & Interfaces
// ============================================

export interface Activity {
    id?: string;
    sessionId: string;
    type: 'message' | 'tool_call' | 'tool_result' | 'system' | 'error';
    role: 'user' | 'assistant' | 'agent' | 'system' | 'tool';
    content: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

export interface MemoryFile {
    version: string;
    generatedAt: string;
    sessionId: string;
    summary: string;
    keyDecisions: string[];
    unresolvedIssues: string[];
    technicalContext: string[];
    context: string; // The actual text to inject into new sessions
    metadata?: {
        provider: string;
        model: string;
        activityCount: number;
        compactionDurationMs: number;
    };
}

export interface CompactionConfig {
    provider: string;
    apiKey: string;
    model: string;
    maxInputChars?: number;
    includeToolCalls?: boolean;
    outputFormat?: 'json' | 'markdown';
}

export interface HandoffDocument {
    title: string;
    executiveSummary: string;
    completedTasks: string[];
    pendingTasks: string[];
    keyFiles: string[];
    technicalNotes: string[];
    nextSteps: string[];
}

// ============================================
// Memory Compaction Service Class
// ============================================

export class MemoryCompactionService extends EventEmitter {
    private registry = getLLMProviderRegistry();

    constructor() {
        super();
    }

    /**
     * Compact session history into a Memory File
     */
    async compactSessionHistory(
        activities: Activity[],
        config: CompactionConfig
    ): Promise<MemoryFile> {
        const startTime = Date.now();
        const sessionId = activities[0]?.sessionId || 'unknown';

        this.emit('compaction:started', { sessionId, activityCount: activities.length });

        // Filter and format activities
        const transcript = this.formatTranscript(activities, config);

        const prompt = `You are an expert technical writer and AI systems architect.
Your task is to create a "Memory File" from the following session transcript.
This memory file will be used to restore context for a future AI session working on the same codebase.

TRANSCRIPT:
${transcript}

INSTRUCTIONS:
1. Write a high-level SUMMARY of what was accomplished.
2. List KEY DECISIONS made (architectural, stylistic, implementation choices).
3. List UNRESOLVED ISSUES or pending tasks.
4. List TECHNICAL CONTEXT that would be important for a new session (file paths, patterns used, etc.).
5. Create a CONTEXT BLOCK that can be pasted into a new session to prime the agent efficiently.

Output strictly in JSON format:
{
    "summary": "High-level summary of the session",
    "keyDecisions": ["Decision 1", "Decision 2"],
    "unresolvedIssues": ["Issue 1", "Issue 2"],
    "technicalContext": ["Context item 1", "Context item 2"],
    "context": "The context block text to inject into new sessions"
}`;

        try {
            const response = await this.registry.generateText({
                provider: config.provider,
                apiKey: config.apiKey,
                model: config.model,
                messages: [{ role: 'user', content: prompt }],
                maxTokens: 4000,
                jsonMode: true,
            });

            // Clean up markdown code blocks if present
            const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);

            const memoryFile: MemoryFile = {
                version: '1.0',
                generatedAt: new Date().toISOString(),
                sessionId,
                summary: data.summary || 'No summary generated',
                keyDecisions: data.keyDecisions || [],
                unresolvedIssues: data.unresolvedIssues || [],
                technicalContext: data.technicalContext || [],
                context: data.context || '',
                metadata: {
                    provider: config.provider,
                    model: config.model,
                    activityCount: activities.length,
                    compactionDurationMs: Date.now() - startTime,
                },
            };

            this.emit('compaction:completed', { sessionId, memoryFile });

            return memoryFile;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.emit('compaction:error', { sessionId, error: errorMessage });
            throw new Error(`Failed to compact session history: ${errorMessage}`);
        }
    }

    /**
     * Generate a handoff document for session continuity
     */
    async generateHandoffDocument(
        activities: Activity[],
        config: CompactionConfig
    ): Promise<HandoffDocument> {
        const transcript = this.formatTranscript(activities, config);

        const prompt = `You are creating a handoff document for another developer/AI to continue this work.

SESSION TRANSCRIPT:
${transcript}

Generate a structured handoff document in JSON format:
{
    "title": "Brief title describing the work",
    "executiveSummary": "2-3 sentence summary of what was done",
    "completedTasks": ["Task 1", "Task 2"],
    "pendingTasks": ["Task 1", "Task 2"],
    "keyFiles": ["path/to/file1.ts", "path/to/file2.ts"],
    "technicalNotes": ["Important technical detail 1", "Important technical detail 2"],
    "nextSteps": ["Recommended next step 1", "Recommended next step 2"]
}

Focus on actionable information that enables efficient continuation.`;

        const response = await this.registry.generateText({
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 3000,
            jsonMode: true,
        });

        const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        return {
            title: data.title || 'Untitled Session',
            executiveSummary: data.executiveSummary || '',
            completedTasks: data.completedTasks || [],
            pendingTasks: data.pendingTasks || [],
            keyFiles: data.keyFiles || [],
            technicalNotes: data.technicalNotes || [],
            nextSteps: data.nextSteps || [],
        };
    }

    /**
     * Generate a context injection prompt from a Memory File
     */
    generateContextInjection(memoryFile: MemoryFile): string {
        return `## Session Context (Auto-generated)

### Previous Session Summary
${memoryFile.summary}

### Key Decisions Made
${memoryFile.keyDecisions.map(d => `- ${d}`).join('\n')}

### Unresolved Issues
${memoryFile.unresolvedIssues.map(i => `- ${i}`).join('\n')}

### Technical Context
${memoryFile.technicalContext.map(c => `- ${c}`).join('\n')}

---
${memoryFile.context}`;
    }

    /**
     * Compact multiple sessions into a project-level memory
     */
    async compactProjectHistory(
        sessions: { sessionId: string; activities: Activity[] }[],
        config: CompactionConfig
    ): Promise<{
        projectSummary: string;
        sessionSummaries: { sessionId: string; summary: string }[];
        overallContext: string;
    }> {
        // First, compact each session
        const sessionSummaries: { sessionId: string; summary: string }[] = [];
        
        for (const session of sessions) {
            try {
                const memoryFile = await this.compactSessionHistory(session.activities, config);
                sessionSummaries.push({
                    sessionId: session.sessionId,
                    summary: memoryFile.summary,
                });
            } catch (error) {
                sessionSummaries.push({
                    sessionId: session.sessionId,
                    summary: `[Compaction failed: ${error instanceof Error ? error.message : 'Unknown error'}]`,
                });
            }
        }

        // Generate project-level summary
        const summariesText = sessionSummaries
            .map(s => `Session ${s.sessionId}:\n${s.summary}`)
            .join('\n\n');

        const projectPrompt = `Given these session summaries from a project, create a high-level project overview:

${summariesText}

Generate JSON:
{
    "projectSummary": "Overall project summary",
    "overallContext": "Context for starting a new session on this project"
}`;

        const response = await this.registry.generateText({
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model,
            messages: [{ role: 'user', content: projectPrompt }],
            maxTokens: 2000,
            jsonMode: true,
        });

        const data = JSON.parse(response);

        return {
            projectSummary: data.projectSummary || '',
            sessionSummaries,
            overallContext: data.overallContext || '',
        };
    }

    /**
     * Format activities into a transcript
     */
    private formatTranscript(activities: Activity[], config: CompactionConfig): string {
        const maxChars = config.maxInputChars || 50000;
        const includeToolCalls = config.includeToolCalls ?? false;

        const filtered = activities.filter(a => {
            if (!includeToolCalls && (a.type === 'tool_call' || a.type === 'tool_result')) {
                return false;
            }
            return a.type === 'message' || a.role === 'user' || a.role === 'assistant' || a.role === 'agent';
        });

        let transcript = filtered
            .map(a => `[${a.timestamp}] ${a.role.toUpperCase()}: ${a.content}`)
            .join('\n\n');

        // Truncate if too long
        if (transcript.length > maxChars) {
            transcript = transcript.substring(0, maxChars) + '\n\n[...truncated...]';
        }

        return transcript;
    }

    /**
     * Convert messages to activities format
     */
    messagestoActivities(messages: Message[], sessionId: string): Activity[] {
        return messages.map((m, i) => ({
            sessionId,
            type: 'message' as const,
            role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
            timestamp: new Date(Date.now() + i).toISOString(),
        }));
    }
}

// Singleton instance
let serviceInstance: MemoryCompactionService | null = null;

export function getMemoryCompactionService(): MemoryCompactionService {
    if (!serviceInstance) {
        serviceInstance = new MemoryCompactionService();
    }
    return serviceInstance;
}
