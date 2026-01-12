/**
 * AIOS Tool Analytics Service
 * 
 * Tracks and analyzes tool usage patterns across agents and sessions.
 * Provides insights for optimization, debugging, and cost management.
 * 
 * Features:
 * - Real-time tool invocation tracking
 * - Performance metrics (latency, success rate, error patterns)
 * - Cost tracking per provider/model
 * - Usage patterns and trends
 * - Agent-specific analytics
 * - Session-level aggregations
 * 
 * @module services/ToolAnalyticsService
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

// ============================================
// Types & Interfaces
// ============================================

export interface ToolInvocation {
    id: string;
    toolName: string;
    serverName?: string;
    agentId?: string;
    sessionId?: string;
    userId?: string;
    
    // Timing
    startTime: number;
    endTime?: number;
    duration?: number;
    
    // Input/Output
    inputTokens?: number;
    outputTokens?: number;
    inputSize?: number;
    outputSize?: number;
    
    // Result
    status: 'pending' | 'success' | 'error' | 'timeout' | 'cancelled';
    errorType?: string;
    errorMessage?: string;
    
    // Cost
    cost?: number;
    provider?: string;
    model?: string;
    
    // Context
    tags?: string[];
    metadata?: Record<string, unknown>;
}

export interface ToolStats {
    toolName: string;
    serverName?: string;
    
    // Counts
    totalInvocations: number;
    successCount: number;
    errorCount: number;
    timeoutCount: number;
    cancelledCount: number;
    
    // Rates
    successRate: number;
    errorRate: number;
    
    // Latency (ms)
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    
    // Tokens
    totalInputTokens: number;
    totalOutputTokens: number;
    avgInputTokens: number;
    avgOutputTokens: number;
    
    // Cost
    totalCost: number;
    avgCost: number;
    
    // Time range
    firstSeen: number;
    lastSeen: number;
}

export interface AgentStats {
    agentId: string;
    totalInvocations: number;
    uniqueTools: number;
    toolBreakdown: Record<string, number>;
    successRate: number;
    totalCost: number;
    avgLatency: number;
    sessionCount: number;
}

export interface SessionStats {
    sessionId: string;
    agentId?: string;
    startTime: number;
    endTime?: number;
    totalInvocations: number;
    uniqueTools: number;
    toolBreakdown: Record<string, number>;
    successRate: number;
    totalCost: number;
    totalDuration: number;
}

export interface UsageTrend {
    period: 'hour' | 'day' | 'week' | 'month';
    timestamp: number;
    invocations: number;
    uniqueTools: number;
    uniqueAgents: number;
    successRate: number;
    totalCost: number;
    avgLatency: number;
}

export interface ErrorPattern {
    errorType: string;
    errorMessage: string;
    count: number;
    tools: string[];
    firstSeen: number;
    lastSeen: number;
    examples: Array<{
        toolName: string;
        timestamp: number;
        context?: string;
    }>;
}

export interface AnalyticsQuery {
    toolName?: string;
    serverName?: string;
    agentId?: string;
    sessionId?: string;
    userId?: string;
    status?: ToolInvocation['status'];
    startTime?: number;
    endTime?: number;
    tags?: string[];
    limit?: number;
    offset?: number;
}

// ============================================
// Tool Analytics Service
// ============================================

export class ToolAnalyticsService extends EventEmitter {
    private invocations: Map<string, ToolInvocation> = new Map();
    private invocationHistory: ToolInvocation[] = [];
    private toolStats: Map<string, ToolStats> = new Map();
    private agentStats: Map<string, AgentStats> = new Map();
    private sessionStats: Map<string, SessionStats> = new Map();
    private errorPatterns: Map<string, ErrorPattern> = new Map();
    
    private maxHistorySize = 100000;
    private persistPath?: string;
    private autoSaveInterval?: ReturnType<typeof setInterval>;

    constructor(options?: { persistPath?: string; maxHistorySize?: number }) {
        super();
        
        if (options?.persistPath) {
            this.persistPath = options.persistPath;
            this.loadFromDisk();
        }
        
        if (options?.maxHistorySize) {
            this.maxHistorySize = options.maxHistorySize;
        }
        
        // Auto-save every 5 minutes if persistence is enabled
        if (this.persistPath) {
            this.autoSaveInterval = setInterval(() => {
                this.saveToDisk();
            }, 5 * 60 * 1000);
        }
    }

    // ========================================
    // Tracking Methods
    // ========================================

    /**
     * Start tracking a tool invocation
     */
    startInvocation(params: {
        toolName: string;
        serverName?: string;
        agentId?: string;
        sessionId?: string;
        userId?: string;
        inputTokens?: number;
        inputSize?: number;
        provider?: string;
        model?: string;
        tags?: string[];
        metadata?: Record<string, unknown>;
    }): string {
        const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        
        const invocation: ToolInvocation = {
            id,
            toolName: params.toolName,
            serverName: params.serverName,
            agentId: params.agentId,
            sessionId: params.sessionId,
            userId: params.userId,
            startTime: Date.now(),
            status: 'pending',
            inputTokens: params.inputTokens,
            inputSize: params.inputSize,
            provider: params.provider,
            model: params.model,
            tags: params.tags,
            metadata: params.metadata,
        };
        
        this.invocations.set(id, invocation);
        this.emit('invocation:start', invocation);
        
        // Update session stats
        if (params.sessionId) {
            this.updateSessionOnStart(params.sessionId, params.agentId, params.toolName);
        }
        
        return id;
    }

    /**
     * Complete a tool invocation
     */
    completeInvocation(id: string, result: {
        status: 'success' | 'error' | 'timeout' | 'cancelled';
        outputTokens?: number;
        outputSize?: number;
        cost?: number;
        errorType?: string;
        errorMessage?: string;
    }): ToolInvocation | undefined {
        const invocation = this.invocations.get(id);
        if (!invocation) return undefined;
        
        invocation.endTime = Date.now();
        invocation.duration = invocation.endTime - invocation.startTime;
        invocation.status = result.status;
        invocation.outputTokens = result.outputTokens;
        invocation.outputSize = result.outputSize;
        invocation.cost = result.cost;
        invocation.errorType = result.errorType;
        invocation.errorMessage = result.errorMessage;
        
        // Move to history
        this.invocations.delete(id);
        this.addToHistory(invocation);
        
        // Update aggregated stats
        this.updateToolStats(invocation);
        this.updateAgentStats(invocation);
        this.updateSessionStats(invocation);
        
        // Track error patterns
        if (result.status === 'error' && result.errorType) {
            this.trackErrorPattern(invocation);
        }
        
        this.emit('invocation:complete', invocation);
        
        return invocation;
    }

    /**
     * Record a complete invocation in one call
     */
    recordInvocation(params: Omit<ToolInvocation, 'id'>): ToolInvocation {
        const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        
        const invocation: ToolInvocation = {
            id,
            ...params,
            duration: params.endTime && params.startTime 
                ? params.endTime - params.startTime 
                : params.duration,
        };
        
        this.addToHistory(invocation);
        this.updateToolStats(invocation);
        this.updateAgentStats(invocation);
        this.updateSessionStats(invocation);
        
        if (invocation.status === 'error' && invocation.errorType) {
            this.trackErrorPattern(invocation);
        }
        
        this.emit('invocation:recorded', invocation);
        
        return invocation;
    }

    // ========================================
    // Query Methods
    // ========================================

    /**
     * Query invocation history
     */
    queryInvocations(query: AnalyticsQuery): ToolInvocation[] {
        let results = [...this.invocationHistory];
        
        if (query.toolName) {
            results = results.filter(i => i.toolName === query.toolName);
        }
        if (query.serverName) {
            results = results.filter(i => i.serverName === query.serverName);
        }
        if (query.agentId) {
            results = results.filter(i => i.agentId === query.agentId);
        }
        if (query.sessionId) {
            results = results.filter(i => i.sessionId === query.sessionId);
        }
        if (query.userId) {
            results = results.filter(i => i.userId === query.userId);
        }
        if (query.status) {
            results = results.filter(i => i.status === query.status);
        }
        if (query.startTime) {
            results = results.filter(i => i.startTime >= query.startTime!);
        }
        if (query.endTime) {
            results = results.filter(i => i.startTime <= query.endTime!);
        }
        if (query.tags && query.tags.length > 0) {
            results = results.filter(i => 
                i.tags?.some(t => query.tags!.includes(t))
            );
        }
        
        // Sort by time descending
        results.sort((a, b) => b.startTime - a.startTime);
        
        // Apply pagination
        const offset = query.offset || 0;
        const limit = query.limit || 100;
        
        return results.slice(offset, offset + limit);
    }

    /**
     * Get stats for a specific tool
     */
    getToolStats(toolName: string, serverName?: string): ToolStats | undefined {
        const key = serverName ? `${serverName}/${toolName}` : toolName;
        return this.toolStats.get(key);
    }

    /**
     * Get all tool stats
     */
    getAllToolStats(): ToolStats[] {
        return Array.from(this.toolStats.values());
    }

    /**
     * Get top tools by various metrics
     */
    getTopTools(metric: 'invocations' | 'errors' | 'latency' | 'cost', limit = 10): ToolStats[] {
        const stats = this.getAllToolStats();
        
        switch (metric) {
            case 'invocations':
                return stats.sort((a, b) => b.totalInvocations - a.totalInvocations).slice(0, limit);
            case 'errors':
                return stats.sort((a, b) => b.errorCount - a.errorCount).slice(0, limit);
            case 'latency':
                return stats.sort((a, b) => b.avgLatency - a.avgLatency).slice(0, limit);
            case 'cost':
                return stats.sort((a, b) => b.totalCost - a.totalCost).slice(0, limit);
        }
    }

    /**
     * Get stats for a specific agent
     */
    getAgentStats(agentId: string): AgentStats | undefined {
        return this.agentStats.get(agentId);
    }

    /**
     * Get all agent stats
     */
    getAllAgentStats(): AgentStats[] {
        return Array.from(this.agentStats.values());
    }

    /**
     * Get stats for a specific session
     */
    getSessionStats(sessionId: string): SessionStats | undefined {
        return this.sessionStats.get(sessionId);
    }

    /**
     * Get recent sessions
     */
    getRecentSessions(limit = 50): SessionStats[] {
        return Array.from(this.sessionStats.values())
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, limit);
    }

    /**
     * Get error patterns
     */
    getErrorPatterns(limit = 50): ErrorPattern[] {
        return Array.from(this.errorPatterns.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * Get usage trends
     */
    getUsageTrends(period: UsageTrend['period'], count = 24): UsageTrend[] {
        const trends: UsageTrend[] = [];
        const now = Date.now();
        
        const periodMs = {
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
        };
        
        const interval = periodMs[period];
        
        for (let i = 0; i < count; i++) {
            const endTime = now - (i * interval);
            const startTime = endTime - interval;
            
            const periodInvocations = this.invocationHistory.filter(
                inv => inv.startTime >= startTime && inv.startTime < endTime
            );
            
            if (periodInvocations.length === 0) {
                trends.unshift({
                    period,
                    timestamp: startTime,
                    invocations: 0,
                    uniqueTools: 0,
                    uniqueAgents: 0,
                    successRate: 0,
                    totalCost: 0,
                    avgLatency: 0,
                });
                continue;
            }
            
            const uniqueTools = new Set(periodInvocations.map(i => i.toolName)).size;
            const uniqueAgents = new Set(periodInvocations.filter(i => i.agentId).map(i => i.agentId)).size;
            const successCount = periodInvocations.filter(i => i.status === 'success').length;
            const totalCost = periodInvocations.reduce((sum, i) => sum + (i.cost || 0), 0);
            const latencies = periodInvocations.filter(i => i.duration).map(i => i.duration!);
            const avgLatency = latencies.length > 0 
                ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
                : 0;
            
            trends.unshift({
                period,
                timestamp: startTime,
                invocations: periodInvocations.length,
                uniqueTools,
                uniqueAgents,
                successRate: successCount / periodInvocations.length,
                totalCost,
                avgLatency,
            });
        }
        
        return trends;
    }

    // ========================================
    // Summary & Dashboard Methods
    // ========================================

    /**
     * Get overall summary
     */
    getSummary(): {
        totalInvocations: number;
        uniqueTools: number;
        uniqueAgents: number;
        uniqueSessions: number;
        overallSuccessRate: number;
        totalCost: number;
        avgLatency: number;
        invocationsToday: number;
        invocationsThisHour: number;
        activeInvocations: number;
    } {
        const now = Date.now();
        const hourAgo = now - 60 * 60 * 1000;
        const dayAgo = now - 24 * 60 * 60 * 1000;
        
        const totalInvocations = this.invocationHistory.length;
        const successCount = this.invocationHistory.filter(i => i.status === 'success').length;
        const totalCost = this.invocationHistory.reduce((sum, i) => sum + (i.cost || 0), 0);
        const latencies = this.invocationHistory.filter(i => i.duration).map(i => i.duration!);
        
        return {
            totalInvocations,
            uniqueTools: this.toolStats.size,
            uniqueAgents: this.agentStats.size,
            uniqueSessions: this.sessionStats.size,
            overallSuccessRate: totalInvocations > 0 ? successCount / totalInvocations : 0,
            totalCost,
            avgLatency: latencies.length > 0 
                ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
                : 0,
            invocationsToday: this.invocationHistory.filter(i => i.startTime >= dayAgo).length,
            invocationsThisHour: this.invocationHistory.filter(i => i.startTime >= hourAgo).length,
            activeInvocations: this.invocations.size,
        };
    }

    /**
     * Get dashboard data
     */
    getDashboard(): {
        summary: ReturnType<ToolAnalyticsService['getSummary']>;
        topTools: ToolStats[];
        recentErrors: ErrorPattern[];
        hourlyTrend: UsageTrend[];
        topAgents: AgentStats[];
    } {
        return {
            summary: this.getSummary(),
            topTools: this.getTopTools('invocations', 10),
            recentErrors: this.getErrorPatterns(5),
            hourlyTrend: this.getUsageTrends('hour', 24),
            topAgents: this.getAllAgentStats()
                .sort((a, b) => b.totalInvocations - a.totalInvocations)
                .slice(0, 10),
        };
    }

    // ========================================
    // Private Helper Methods
    // ========================================

    private addToHistory(invocation: ToolInvocation): void {
        this.invocationHistory.push(invocation);
        
        // Trim history if needed
        if (this.invocationHistory.length > this.maxHistorySize) {
            this.invocationHistory = this.invocationHistory.slice(-this.maxHistorySize);
        }
    }

    private updateToolStats(invocation: ToolInvocation): void {
        const key = invocation.serverName 
            ? `${invocation.serverName}/${invocation.toolName}` 
            : invocation.toolName;
        
        let stats = this.toolStats.get(key);
        
        if (!stats) {
            stats = {
                toolName: invocation.toolName,
                serverName: invocation.serverName,
                totalInvocations: 0,
                successCount: 0,
                errorCount: 0,
                timeoutCount: 0,
                cancelledCount: 0,
                successRate: 0,
                errorRate: 0,
                avgLatency: 0,
                minLatency: Infinity,
                maxLatency: 0,
                p50Latency: 0,
                p95Latency: 0,
                p99Latency: 0,
                totalInputTokens: 0,
                totalOutputTokens: 0,
                avgInputTokens: 0,
                avgOutputTokens: 0,
                totalCost: 0,
                avgCost: 0,
                firstSeen: invocation.startTime,
                lastSeen: invocation.startTime,
            };
            this.toolStats.set(key, stats);
        }
        
        // Update counts
        stats.totalInvocations++;
        stats.lastSeen = invocation.startTime;
        
        switch (invocation.status) {
            case 'success': stats.successCount++; break;
            case 'error': stats.errorCount++; break;
            case 'timeout': stats.timeoutCount++; break;
            case 'cancelled': stats.cancelledCount++; break;
        }
        
        // Update rates
        stats.successRate = stats.successCount / stats.totalInvocations;
        stats.errorRate = stats.errorCount / stats.totalInvocations;
        
        // Update latency
        if (invocation.duration) {
            stats.minLatency = Math.min(stats.minLatency, invocation.duration);
            stats.maxLatency = Math.max(stats.maxLatency, invocation.duration);
            // Recalculate average (simple running average)
            stats.avgLatency = stats.avgLatency + (invocation.duration - stats.avgLatency) / stats.totalInvocations;
        }
        
        // Update tokens
        if (invocation.inputTokens) {
            stats.totalInputTokens += invocation.inputTokens;
            stats.avgInputTokens = stats.totalInputTokens / stats.totalInvocations;
        }
        if (invocation.outputTokens) {
            stats.totalOutputTokens += invocation.outputTokens;
            stats.avgOutputTokens = stats.totalOutputTokens / stats.totalInvocations;
        }
        
        // Update cost
        if (invocation.cost) {
            stats.totalCost += invocation.cost;
            stats.avgCost = stats.totalCost / stats.totalInvocations;
        }
        
        // Recalculate percentiles periodically
        if (stats.totalInvocations % 100 === 0) {
            this.recalculatePercentiles(key, stats);
        }
    }

    private recalculatePercentiles(key: string, stats: ToolStats): void {
        const latencies = this.invocationHistory
            .filter(i => {
                const invKey = i.serverName ? `${i.serverName}/${i.toolName}` : i.toolName;
                return invKey === key && i.duration;
            })
            .map(i => i.duration!)
            .sort((a, b) => a - b);
        
        if (latencies.length > 0) {
            stats.p50Latency = latencies[Math.floor(latencies.length * 0.5)] || 0;
            stats.p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
            stats.p99Latency = latencies[Math.floor(latencies.length * 0.99)] || 0;
        }
    }

    private updateAgentStats(invocation: ToolInvocation): void {
        if (!invocation.agentId) return;
        
        let stats = this.agentStats.get(invocation.agentId);
        
        if (!stats) {
            stats = {
                agentId: invocation.agentId,
                totalInvocations: 0,
                uniqueTools: 0,
                toolBreakdown: {},
                successRate: 0,
                totalCost: 0,
                avgLatency: 0,
                sessionCount: 0,
            };
            this.agentStats.set(invocation.agentId, stats);
        }
        
        stats.totalInvocations++;
        stats.toolBreakdown[invocation.toolName] = (stats.toolBreakdown[invocation.toolName] || 0) + 1;
        stats.uniqueTools = Object.keys(stats.toolBreakdown).length;
        
        if (invocation.cost) {
            stats.totalCost += invocation.cost;
        }
        
        if (invocation.duration) {
            stats.avgLatency = stats.avgLatency + (invocation.duration - stats.avgLatency) / stats.totalInvocations;
        }
        
        // Update success rate
        const agentInvocations = this.invocationHistory.filter(i => i.agentId === invocation.agentId);
        const successCount = agentInvocations.filter(i => i.status === 'success').length;
        stats.successRate = agentInvocations.length > 0 ? successCount / agentInvocations.length : 0;
        
        // Update session count
        stats.sessionCount = new Set(agentInvocations.filter(i => i.sessionId).map(i => i.sessionId)).size;
    }

    private updateSessionOnStart(sessionId: string, agentId: string | undefined, toolName: string): void {
        let stats = this.sessionStats.get(sessionId);
        
        if (!stats) {
            stats = {
                sessionId,
                agentId,
                startTime: Date.now(),
                totalInvocations: 0,
                uniqueTools: 0,
                toolBreakdown: {},
                successRate: 0,
                totalCost: 0,
                totalDuration: 0,
            };
            this.sessionStats.set(sessionId, stats);
        }
    }

    private updateSessionStats(invocation: ToolInvocation): void {
        if (!invocation.sessionId) return;
        
        let stats = this.sessionStats.get(invocation.sessionId);
        
        if (!stats) {
            stats = {
                sessionId: invocation.sessionId,
                agentId: invocation.agentId,
                startTime: invocation.startTime,
                totalInvocations: 0,
                uniqueTools: 0,
                toolBreakdown: {},
                successRate: 0,
                totalCost: 0,
                totalDuration: 0,
            };
            this.sessionStats.set(invocation.sessionId, stats);
        }
        
        stats.totalInvocations++;
        stats.endTime = invocation.endTime || Date.now();
        stats.toolBreakdown[invocation.toolName] = (stats.toolBreakdown[invocation.toolName] || 0) + 1;
        stats.uniqueTools = Object.keys(stats.toolBreakdown).length;
        
        if (invocation.cost) {
            stats.totalCost += invocation.cost;
        }
        
        if (invocation.duration) {
            stats.totalDuration += invocation.duration;
        }
        
        // Update success rate
        const sessionInvocations = this.invocationHistory.filter(i => i.sessionId === invocation.sessionId);
        const successCount = sessionInvocations.filter(i => i.status === 'success').length;
        stats.successRate = sessionInvocations.length > 0 ? successCount / sessionInvocations.length : 0;
    }

    private trackErrorPattern(invocation: ToolInvocation): void {
        if (!invocation.errorType) return;
        
        const key = `${invocation.errorType}:${invocation.errorMessage || 'unknown'}`;
        let pattern = this.errorPatterns.get(key);
        
        if (!pattern) {
            pattern = {
                errorType: invocation.errorType,
                errorMessage: invocation.errorMessage || 'unknown',
                count: 0,
                tools: [],
                firstSeen: invocation.startTime,
                lastSeen: invocation.startTime,
                examples: [],
            };
            this.errorPatterns.set(key, pattern);
        }
        
        pattern.count++;
        pattern.lastSeen = invocation.startTime;
        
        if (!pattern.tools.includes(invocation.toolName)) {
            pattern.tools.push(invocation.toolName);
        }
        
        // Keep last 5 examples
        pattern.examples.push({
            toolName: invocation.toolName,
            timestamp: invocation.startTime,
            context: invocation.agentId ? `agent:${invocation.agentId}` : undefined,
        });
        if (pattern.examples.length > 5) {
            pattern.examples.shift();
        }
    }

    // ========================================
    // Persistence
    // ========================================

    private loadFromDisk(): void {
        if (!this.persistPath) return;
        
        try {
            if (fs.existsSync(this.persistPath)) {
                const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
                
                this.invocationHistory = data.invocationHistory || [];
                
                // Rebuild stats from history
                for (const invocation of this.invocationHistory) {
                    this.updateToolStats(invocation);
                    this.updateAgentStats(invocation);
                    this.updateSessionStats(invocation);
                    if (invocation.status === 'error' && invocation.errorType) {
                        this.trackErrorPattern(invocation);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load analytics from disk:', error);
        }
    }

    saveToDisk(): void {
        if (!this.persistPath) return;
        
        try {
            const dir = path.dirname(this.persistPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const data = {
                invocationHistory: this.invocationHistory,
                savedAt: new Date().toISOString(),
            };
            
            fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save analytics to disk:', error);
        }
    }

    // ========================================
    // Cleanup
    // ========================================

    /**
     * Clear old data
     */
    clearOldData(olderThanMs: number): number {
        const cutoff = Date.now() - olderThanMs;
        const initialCount = this.invocationHistory.length;
        
        this.invocationHistory = this.invocationHistory.filter(i => i.startTime >= cutoff);
        
        // Rebuild stats
        this.toolStats.clear();
        this.agentStats.clear();
        this.sessionStats.clear();
        this.errorPatterns.clear();
        
        for (const invocation of this.invocationHistory) {
            this.updateToolStats(invocation);
            this.updateAgentStats(invocation);
            this.updateSessionStats(invocation);
            if (invocation.status === 'error' && invocation.errorType) {
                this.trackErrorPattern(invocation);
            }
        }
        
        return initialCount - this.invocationHistory.length;
    }

    /**
     * Reset all analytics
     */
    reset(): void {
        this.invocations.clear();
        this.invocationHistory = [];
        this.toolStats.clear();
        this.agentStats.clear();
        this.sessionStats.clear();
        this.errorPatterns.clear();
        this.emit('reset');
    }

    /**
     * Destroy the service
     */
    destroy(): void {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        if (this.persistPath) {
            this.saveToDisk();
        }
    }
}

// ============================================
// Singleton
// ============================================

let serviceInstance: ToolAnalyticsService | null = null;

export function getToolAnalyticsService(options?: { 
    persistPath?: string; 
    maxHistorySize?: number 
}): ToolAnalyticsService {
    if (!serviceInstance) {
        serviceInstance = new ToolAnalyticsService(options);
    }
    return serviceInstance;
}
