/**
 * AIOS Debate Engine Service
 * 
 * Multi-agent debate orchestration system for collaborative AI decision-making.
 * Enables multiple AI participants with different providers/models to debate
 * topics and reach consensus.
 * 
 * Features:
 * - Multi-round debates with configurable participants
 * - Support for different AI providers per participant
 * - Automatic consensus/summary generation via moderator
 * - Conference mode for single-round discussions
 * - Debate history tracking and analytics
 * 
 * @module services/DebateEngineService
 */

import { EventEmitter } from 'events';
import { getLLMProviderRegistry, Message, CompletionResult } from '../providers/LLMProviderRegistry.js';

// ============================================
// Types & Interfaces
// ============================================

export interface Participant {
    id: string;
    name: string;
    role: string; // e.g., "Proposer", "Reviewer", "Devil's Advocate"
    systemPrompt: string;
    provider: 'openai' | 'anthropic' | 'gemini' | 'qwen' | 'deepseek' | 'groq';
    model: string;
    apiKey?: string;
}

export interface DebateConfig {
    topic: string;
    rounds: number;
    participants: Participant[];
    moderator?: {
        provider: string;
        model: string;
        apiKey?: string;
    };
    maxTokensPerTurn?: number;
}

export interface DebateTurn {
    participantId: string;
    participantName: string;
    role: string;
    content: string;
    timestamp: string;
    provider: string;
    model: string;
    tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
    };
}

export interface DebateRound {
    roundNumber: number;
    turns: DebateTurn[];
    startTime: string;
    endTime?: string;
}

export interface DebateResult {
    id: string;
    topic?: string;
    rounds: DebateRound[];
    summary?: string;
    consensus?: string;
    history: Message[];
    startTime: string;
    endTime: string;
    totalTokens: number;
    participantStats: Record<string, { turns: number; tokens: number }>;
}

export interface ConferenceResult extends DebateResult {
    type: 'conference';
}

// ============================================
// Debate Engine Service Class
// ============================================

export class DebateEngineService extends EventEmitter {
    private registry = getLLMProviderRegistry();

    constructor() {
        super();
    }

    /**
     * Run a multi-round debate between participants
     */
    async runDebate(config: DebateConfig): Promise<DebateResult> {
        const debateId = `debate_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const startTime = new Date().toISOString();
        const currentHistory: Message[] = [];
        const debateRounds: DebateRound[] = [];
        let totalTokens = 0;
        const participantStats: Record<string, { turns: number; tokens: number }> = {};

        // Initialize participant stats
        for (const p of config.participants) {
            participantStats[p.id] = { turns: 0, tokens: 0 };
        }

        this.emit('debate:started', { debateId, topic: config.topic, participants: config.participants.length });

        // Add initial context about the topic
        if (config.topic) {
            currentHistory.push({
                role: 'user',
                content: `Topic for discussion: ${config.topic}`,
            });
        }

        // Run debate rounds
        for (let roundNum = 0; roundNum < config.rounds; roundNum++) {
            const roundStartTime = new Date().toISOString();
            const turns: DebateTurn[] = [];

            this.emit('round:started', { debateId, roundNumber: roundNum + 1 });

            for (const participant of config.participants) {
                try {
                    const turn = await this.processParticipantTurn(
                        participant,
                        currentHistory,
                        config.topic,
                        config.maxTokensPerTurn
                    );

                    turns.push(turn);
                    participantStats[participant.id].turns++;
                    
                    if (turn.tokenUsage) {
                        const turnTokens = turn.tokenUsage.promptTokens + turn.tokenUsage.completionTokens;
                        totalTokens += turnTokens;
                        participantStats[participant.id].tokens += turnTokens;
                    }

                    // Add to history for next participant
                    currentHistory.push({
                        role: 'assistant',
                        content: `[${participant.name} (${participant.role})]: ${turn.content}`,
                        name: participant.id,
                    });

                    this.emit('turn:completed', { 
                        debateId, 
                        roundNumber: roundNum + 1, 
                        participantId: participant.id,
                        participantName: participant.name,
                    });

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    
                    turns.push({
                        participantId: participant.id,
                        participantName: participant.name,
                        role: participant.role,
                        content: `[Error: ${errorMessage}]`,
                        timestamp: new Date().toISOString(),
                        provider: participant.provider,
                        model: participant.model,
                    });

                    this.emit('turn:error', { 
                        debateId, 
                        participantId: participant.id, 
                        error: errorMessage 
                    });
                }
            }

            debateRounds.push({
                roundNumber: roundNum + 1,
                turns,
                startTime: roundStartTime,
                endTime: new Date().toISOString(),
            });

            this.emit('round:completed', { debateId, roundNumber: roundNum + 1 });
        }

        // Generate summary/consensus
        let summary = `Debate completed (${config.rounds} round${config.rounds > 1 ? 's' : ''}).`;
        let consensus: string | undefined;

        const moderatorConfig = config.moderator || this.getDefaultModerator(config.participants);
        
        if (moderatorConfig) {
            try {
                const synthesisResult = await this.generateSynthesis(
                    currentHistory,
                    config.topic,
                    moderatorConfig
                );
                summary = synthesisResult.summary;
                consensus = synthesisResult.consensus;

                if (synthesisResult.tokens) {
                    totalTokens += synthesisResult.tokens;
                }
            } catch (error) {
                console.error('Failed to generate debate synthesis:', error);
                summary += ' (Auto-summary generation failed)';
            }
        }

        const endTime = new Date().toISOString();

        const result: DebateResult = {
            id: debateId,
            topic: config.topic,
            rounds: debateRounds,
            summary,
            consensus,
            history: currentHistory,
            startTime,
            endTime,
            totalTokens,
            participantStats,
        };

        this.emit('debate:completed', { debateId, result });

        return result;
    }

    /**
     * Run a conference (single-round discussion)
     */
    async runConference(config: {
        history: Message[];
        participants: Participant[];
        topic?: string;
        maxTokensPerTurn?: number;
    }): Promise<ConferenceResult> {
        const result = await this.runDebate({
            topic: config.topic || 'Team Conference',
            rounds: 1,
            participants: config.participants,
            maxTokensPerTurn: config.maxTokensPerTurn,
        });

        return {
            ...result,
            type: 'conference',
        };
    }

    /**
     * Process a single participant's turn
     */
    private async processParticipantTurn(
        participant: Participant,
        history: Message[],
        topic?: string,
        maxTokens?: number
    ): Promise<DebateTurn> {
        const systemPrompt = this.buildParticipantPrompt(participant, topic);

        const result = await this.registry.complete({
            provider: participant.provider,
            model: participant.model,
            apiKey: participant.apiKey,
            messages: history,
            systemPrompt,
            maxTokens: maxTokens || 1000,
        });

        return {
            participantId: participant.id,
            participantName: participant.name,
            role: participant.role,
            content: result.content,
            timestamp: new Date().toISOString(),
            provider: participant.provider,
            model: participant.model,
            tokenUsage: result.usage ? {
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens,
            } : undefined,
        };
    }

    /**
     * Build the system prompt for a participant
     */
    private buildParticipantPrompt(participant: Participant, topic?: string): string {
        return `You are ${participant.name}, acting as a ${participant.role}.
${topic ? `Topic: ${topic}` : ''}

Instructions:
${participant.systemPrompt}

Review the conversation history and provide your input.
- Critically analyze previous points.
- Be constructive, specific, and concise.
- If you agree, explain why. If you disagree, offer alternatives.
- Focus on substantive contributions rather than pleasantries.`;
    }

    /**
     * Get default moderator from participants
     */
    private getDefaultModerator(participants: Participant[]): { provider: string; model: string; apiKey?: string } | null {
        const validParticipant = participants.find(p => 
            this.registry.getProvider(p.provider) !== undefined
        );

        if (!validParticipant) {
            return null;
        }

        return {
            provider: validParticipant.provider,
            model: validParticipant.model,
            apiKey: validParticipant.apiKey,
        };
    }

    /**
     * Generate synthesis/summary of the debate
     */
    private async generateSynthesis(
        history: Message[],
        topic: string | undefined,
        moderator: { provider: string; model: string; apiKey?: string }
    ): Promise<{ summary: string; consensus?: string; tokens?: number }> {
        const moderatorPrompt = `You are the Moderator and Judge of this technical debate.
${topic ? `Topic: ${topic}` : ''}

Review the debate history above and provide:
1. A summary of the key arguments from each participant.
2. Areas of consensus and disagreement.
3. A final conclusion or recommendation based on the strongest arguments.

Format your response as:

## Summary
[Key points from each participant]

## Consensus Points
[What participants agreed on]

## Disagreements
[Key areas of disagreement]

## Recommendation
[Your conclusion based on the debate]`;

        const result = await this.registry.complete({
            provider: moderator.provider,
            model: moderator.model,
            apiKey: moderator.apiKey,
            messages: history,
            systemPrompt: moderatorPrompt,
            maxTokens: 2000,
        });

        // Extract consensus if present
        const consensusMatch = result.content.match(/## Recommendation\s*([\s\S]*?)(?:##|$)/i);
        const consensus = consensusMatch ? consensusMatch[1].trim() : undefined;

        return {
            summary: result.content,
            consensus,
            tokens: result.usage?.totalTokens,
        };
    }

    /**
     * Create pre-configured debate templates
     */
    createDebateTemplate(type: 'code-review' | 'architecture' | 'security' | 'general'): Participant[] {
        const templates: Record<string, Participant[]> = {
            'code-review': [
                {
                    id: 'proposer',
                    name: 'Code Author',
                    role: 'Proposer',
                    systemPrompt: 'Defend the code implementation, explaining design decisions and trade-offs.',
                    provider: 'anthropic',
                    model: 'claude-sonnet-4-20250514',
                },
                {
                    id: 'reviewer',
                    name: 'Senior Reviewer',
                    role: 'Critic',
                    systemPrompt: 'Review the code critically, focusing on bugs, edge cases, and maintainability issues.',
                    provider: 'openai',
                    model: 'gpt-4o',
                },
                {
                    id: 'security',
                    name: 'Security Analyst',
                    role: 'Security Expert',
                    systemPrompt: 'Analyze for security vulnerabilities, injection risks, and data handling issues.',
                    provider: 'anthropic',
                    model: 'claude-sonnet-4-20250514',
                },
            ],
            'architecture': [
                {
                    id: 'architect',
                    name: 'System Architect',
                    role: 'Proposer',
                    systemPrompt: 'Propose and defend architectural decisions with focus on scalability and maintainability.',
                    provider: 'anthropic',
                    model: 'claude-opus-4-20250514',
                },
                {
                    id: 'devops',
                    name: 'DevOps Engineer',
                    role: 'Operations',
                    systemPrompt: 'Evaluate from deployment, monitoring, and operational complexity perspectives.',
                    provider: 'openai',
                    model: 'gpt-4o',
                },
                {
                    id: 'devils-advocate',
                    name: "Devil's Advocate",
                    role: 'Challenger',
                    systemPrompt: 'Challenge assumptions and propose alternative approaches.',
                    provider: 'gemini',
                    model: 'gemini-2.0-flash',
                },
            ],
            'security': [
                {
                    id: 'red-team',
                    name: 'Red Team',
                    role: 'Attacker',
                    systemPrompt: 'Think like an attacker. Identify vulnerabilities and attack vectors.',
                    provider: 'anthropic',
                    model: 'claude-sonnet-4-20250514',
                },
                {
                    id: 'blue-team',
                    name: 'Blue Team',
                    role: 'Defender',
                    systemPrompt: 'Propose defenses and security controls to mitigate identified risks.',
                    provider: 'openai',
                    model: 'gpt-4o',
                },
                {
                    id: 'compliance',
                    name: 'Compliance Officer',
                    role: 'Compliance',
                    systemPrompt: 'Evaluate against security standards (OWASP, SOC2, etc.) and regulatory requirements.',
                    provider: 'anthropic',
                    model: 'claude-sonnet-4-20250514',
                },
            ],
            'general': [
                {
                    id: 'optimist',
                    name: 'Optimist',
                    role: 'Proponent',
                    systemPrompt: 'Highlight benefits, opportunities, and positive outcomes.',
                    provider: 'openai',
                    model: 'gpt-4o',
                },
                {
                    id: 'skeptic',
                    name: 'Skeptic',
                    role: 'Critic',
                    systemPrompt: 'Identify risks, challenges, and potential pitfalls.',
                    provider: 'anthropic',
                    model: 'claude-sonnet-4-20250514',
                },
                {
                    id: 'pragmatist',
                    name: 'Pragmatist',
                    role: 'Mediator',
                    systemPrompt: 'Find practical middle ground and actionable recommendations.',
                    provider: 'gemini',
                    model: 'gemini-2.0-flash',
                },
            ],
        };

        return templates[type] || templates['general'];
    }

    /**
     * Quick debate helper - simplified interface
     */
    async quickDebate(params: {
        topic: string;
        template?: 'code-review' | 'architecture' | 'security' | 'general';
        context?: string;
        rounds?: number;
        apiKeys?: {
            openai?: string;
            anthropic?: string;
            gemini?: string;
        };
    }): Promise<DebateResult> {
        const participants = this.createDebateTemplate(params.template || 'general');

        // Apply API keys to participants
        if (params.apiKeys) {
            for (const p of participants) {
                if (p.provider === 'openai' && params.apiKeys.openai) {
                    p.apiKey = params.apiKeys.openai;
                } else if (p.provider === 'anthropic' && params.apiKeys.anthropic) {
                    p.apiKey = params.apiKeys.anthropic;
                } else if (p.provider === 'gemini' && params.apiKeys.gemini) {
                    p.apiKey = params.apiKeys.gemini;
                }
            }
        }

        const config: DebateConfig = {
            topic: params.topic,
            rounds: params.rounds || 2,
            participants,
        };

        // Add context to the debate if provided
        if (params.context) {
            config.topic = `${params.topic}\n\nContext:\n${params.context}`;
        }

        return this.runDebate(config);
    }
}

// Singleton instance
let serviceInstance: DebateEngineService | null = null;

export function getDebateEngineService(): DebateEngineService {
    if (!serviceInstance) {
        serviceInstance = new DebateEngineService();
    }
    return serviceInstance;
}
