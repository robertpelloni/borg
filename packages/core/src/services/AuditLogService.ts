/**
 * @module services/AuditLogService
 */

import { EventEmitter } from 'events';

export type AuditAction = 
    | 'create' | 'read' | 'update' | 'delete'
    | 'login' | 'logout' | 'auth_failure'
    | 'permission_grant' | 'permission_revoke'
    | 'config_change' | 'secret_access'
    | 'export' | 'import' | 'bulk_operation'
    | 'api_call' | 'webhook_received' | 'webhook_sent'
    | 'job_start' | 'job_complete' | 'job_fail'
    | 'rate_limit_hit' | 'quota_exceeded'
    | 'custom';

export type AuditCategory = 
    | 'authentication' | 'authorization' | 'data' | 'system' 
    | 'integration' | 'billing' | 'security' | 'compliance';

export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export type RetentionPolicy = 'short' | 'standard' | 'extended' | 'permanent';

export interface AuditActor {
    type: 'user' | 'system' | 'api_key' | 'service' | 'webhook';
    id: string;
    name?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
    sessionId?: string;
}

export interface AuditResource {
    type: string;
    id: string;
    name?: string;
    parentType?: string;
    parentId?: string;
}

export interface AuditChange {
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
    sensitive?: boolean;
}

export interface AuditEntry {
    id: string;
    timestamp: Date;
    
    action: AuditAction;
    category: AuditCategory;
    severity: AuditSeverity;
    
    actor: AuditActor;
    resource?: AuditResource;
    
    description: string;
    changes?: AuditChange[];
    
    request?: {
        method?: string;
        path?: string;
        query?: Record<string, string>;
        headers?: Record<string, string>;
        body?: unknown;
    };
    
    response?: {
        status?: number;
        duration?: number;
        error?: string;
    };
    
    context?: {
        correlationId?: string;
        parentId?: string;
        traceId?: string;
        spanId?: string;
        environment?: string;
        version?: string;
    };
    
    tags?: string[];
    metadata?: Record<string, unknown>;
    
    retention: RetentionPolicy;
    expiresAt?: Date;
}

export interface AuditQuery {
    startDate?: Date;
    endDate?: Date;
    actions?: AuditAction[];
    categories?: AuditCategory[];
    severities?: AuditSeverity[];
    actorId?: string;
    actorType?: AuditActor['type'];
    resourceType?: string;
    resourceId?: string;
    correlationId?: string;
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'severity' | 'action';
    sortOrder?: 'asc' | 'desc';
}

export interface AuditStats {
    period: { start: Date; end: Date };
    totalEntries: number;
    byAction: Map<AuditAction, number>;
    byCategory: Map<AuditCategory, number>;
    bySeverity: Map<AuditSeverity, number>;
    byActor: Map<string, number>;
    byResource: Map<string, number>;
    topActors: Array<{ id: string; name?: string; count: number }>;
    errorRate: number;
    avgResponseTime?: number;
}

export interface ComplianceReport {
    id: string;
    type: 'gdpr' | 'hipaa' | 'sox' | 'pci' | 'custom';
    generatedAt: Date;
    period: { start: Date; end: Date };
    summary: {
        totalEvents: number;
        dataAccessEvents: number;
        securityEvents: number;
        authFailures: number;
        configChanges: number;
    };
    dataSubjectAccess: Array<{
        subjectId: string;
        accessCount: number;
        lastAccess: Date;
        dataTypes: string[];
    }>;
    securityIncidents: AuditEntry[];
    recommendations: string[];
}

export interface AuditConfig {
    enabled: boolean;
    defaultRetention: RetentionPolicy;
    retentionDays: Record<RetentionPolicy, number>;
    maxEntriesInMemory: number;
    sensitiveFields: string[];
    excludedPaths: string[];
    excludedActions: AuditAction[];
    includeRequestBody: boolean;
    includeResponseBody: boolean;
    maskSensitiveData: boolean;
    asyncWrite: boolean;
}

const DEFAULT_RETENTION_DAYS: Record<RetentionPolicy, number> = {
    short: 7,
    standard: 90,
    extended: 365,
    permanent: -1,
};

export class AuditLogService extends EventEmitter {
    private config: AuditConfig;
    private entries: Map<string, AuditEntry> = new Map();
    private entryIndex: {
        byActor: Map<string, Set<string>>;
        byResource: Map<string, Set<string>>;
        byCorrelation: Map<string, Set<string>>;
        byDate: Map<string, Set<string>>;
    };
    private cleanupTimer?: ReturnType<typeof setInterval>;

    constructor(config: Partial<AuditConfig> = {}) {
        super();
        this.config = {
            enabled: true,
            defaultRetention: 'standard',
            retentionDays: { ...DEFAULT_RETENTION_DAYS },
            maxEntriesInMemory: 100000,
            sensitiveFields: ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn'],
            excludedPaths: ['/health', '/metrics', '/favicon.ico'],
            excludedActions: [],
            includeRequestBody: true,
            includeResponseBody: false,
            maskSensitiveData: true,
            asyncWrite: true,
            ...config,
        };

        this.entryIndex = {
            byActor: new Map(),
            byResource: new Map(),
            byCorrelation: new Map(),
            byDate: new Map(),
        };

        this.startCleanup();
    }

    log(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'retention' | 'expiresAt'> & { retention?: RetentionPolicy }): AuditEntry {
        if (!this.config.enabled) {
            return this.createEmptyEntry();
        }

        if (this.config.excludedActions.includes(entry.action)) {
            return this.createEmptyEntry();
        }

        const retention = entry.retention || this.config.defaultRetention;
        const retentionDays = this.config.retentionDays[retention];

        const auditEntry: AuditEntry = {
            ...entry,
            id: this.generateId(),
            timestamp: new Date(),
            retention,
            expiresAt: retentionDays > 0 ? new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000) : undefined,
        };

        if (this.config.maskSensitiveData) {
            this.maskSensitiveFields(auditEntry);
        }

        if (this.config.asyncWrite) {
            setImmediate(() => this.writeEntry(auditEntry));
        } else {
            this.writeEntry(auditEntry);
        }

        return auditEntry;
    }

    logAuth(params: {
        action: 'login' | 'logout' | 'auth_failure';
        actor: AuditActor;
        success: boolean;
        method?: string;
        reason?: string;
        metadata?: Record<string, unknown>;
    }): AuditEntry {
        return this.log({
            action: params.action,
            category: 'authentication',
            severity: params.success ? 'info' : 'warning',
            actor: params.actor,
            description: this.buildAuthDescription(params),
            metadata: {
                success: params.success,
                method: params.method,
                reason: params.reason,
                ...params.metadata,
            },
            retention: params.success ? 'standard' : 'extended',
        });
    }

    logDataAccess(params: {
        action: 'create' | 'read' | 'update' | 'delete';
        actor: AuditActor;
        resource: AuditResource;
        changes?: AuditChange[];
        reason?: string;
        metadata?: Record<string, unknown>;
    }): AuditEntry {
        return this.log({
            action: params.action,
            category: 'data',
            severity: params.action === 'delete' ? 'warning' : 'info',
            actor: params.actor,
            resource: params.resource,
            description: `${params.action.toUpperCase()} ${params.resource.type}:${params.resource.id}`,
            changes: params.changes,
            metadata: { reason: params.reason, ...params.metadata },
        });
    }

    logSecurityEvent(params: {
        action: AuditAction;
        actor: AuditActor;
        severity: AuditSeverity;
        description: string;
        resource?: AuditResource;
        metadata?: Record<string, unknown>;
    }): AuditEntry {
        return this.log({
            ...params,
            category: 'security',
            retention: params.severity === 'critical' ? 'permanent' : 'extended',
        });
    }

    logApiCall(params: {
        actor: AuditActor;
        request: AuditEntry['request'];
        response: AuditEntry['response'];
        resource?: AuditResource;
        context?: AuditEntry['context'];
    }): AuditEntry {
        if (params.request?.path && this.config.excludedPaths.some(p => params.request!.path!.startsWith(p))) {
            return this.createEmptyEntry();
        }

        const severity: AuditSeverity = params.response?.status 
            ? (params.response.status >= 500 ? 'error' : params.response.status >= 400 ? 'warning' : 'info')
            : 'info';

        return this.log({
            action: 'api_call',
            category: 'system',
            severity,
            actor: params.actor,
            resource: params.resource,
            description: `${params.request?.method} ${params.request?.path} -> ${params.response?.status}`,
            request: this.config.includeRequestBody ? params.request : { ...params.request, body: undefined },
            response: this.config.includeResponseBody ? params.response : { ...params.response },
            context: params.context,
            retention: 'short',
        });
    }

    logConfigChange(params: {
        actor: AuditActor;
        resource: AuditResource;
        changes: AuditChange[];
        reason?: string;
    }): AuditEntry {
        return this.log({
            action: 'config_change',
            category: 'system',
            severity: 'warning',
            actor: params.actor,
            resource: params.resource,
            description: `Configuration changed: ${params.resource.type}:${params.resource.id}`,
            changes: params.changes,
            metadata: { reason: params.reason },
            retention: 'extended',
        });
    }

    private writeEntry(entry: AuditEntry): void {
        this.entries.set(entry.id, entry);
        this.indexEntry(entry);

        if (this.entries.size > this.config.maxEntriesInMemory) {
            this.evictOldEntries();
        }

        this.emit('entry', entry);

        if (entry.severity === 'critical') {
            this.emit('critical', entry);
        }
    }

    private indexEntry(entry: AuditEntry): void {
        const actorKey = `${entry.actor.type}:${entry.actor.id}`;
        if (!this.entryIndex.byActor.has(actorKey)) {
            this.entryIndex.byActor.set(actorKey, new Set());
        }
        this.entryIndex.byActor.get(actorKey)!.add(entry.id);

        if (entry.resource) {
            const resourceKey = `${entry.resource.type}:${entry.resource.id}`;
            if (!this.entryIndex.byResource.has(resourceKey)) {
                this.entryIndex.byResource.set(resourceKey, new Set());
            }
            this.entryIndex.byResource.get(resourceKey)!.add(entry.id);
        }

        if (entry.context?.correlationId) {
            if (!this.entryIndex.byCorrelation.has(entry.context.correlationId)) {
                this.entryIndex.byCorrelation.set(entry.context.correlationId, new Set());
            }
            this.entryIndex.byCorrelation.get(entry.context.correlationId)!.add(entry.id);
        }

        const dateKey = entry.timestamp.toISOString().split('T')[0];
        if (!this.entryIndex.byDate.has(dateKey)) {
            this.entryIndex.byDate.set(dateKey, new Set());
        }
        this.entryIndex.byDate.get(dateKey)!.add(entry.id);
    }

    query(params: AuditQuery): { entries: AuditEntry[]; total: number; hasMore: boolean } {
        let results = Array.from(this.entries.values());

        if (params.startDate) {
            results = results.filter(e => e.timestamp >= params.startDate!);
        }
        if (params.endDate) {
            results = results.filter(e => e.timestamp <= params.endDate!);
        }
        if (params.actions?.length) {
            results = results.filter(e => params.actions!.includes(e.action));
        }
        if (params.categories?.length) {
            results = results.filter(e => params.categories!.includes(e.category));
        }
        if (params.severities?.length) {
            results = results.filter(e => params.severities!.includes(e.severity));
        }
        if (params.actorId) {
            results = results.filter(e => e.actor.id === params.actorId);
        }
        if (params.actorType) {
            results = results.filter(e => e.actor.type === params.actorType);
        }
        if (params.resourceType) {
            results = results.filter(e => e.resource?.type === params.resourceType);
        }
        if (params.resourceId) {
            results = results.filter(e => e.resource?.id === params.resourceId);
        }
        if (params.correlationId) {
            results = results.filter(e => e.context?.correlationId === params.correlationId);
        }
        if (params.tags?.length) {
            results = results.filter(e => params.tags!.some(t => e.tags?.includes(t)));
        }
        if (params.search) {
            const searchLower = params.search.toLowerCase();
            results = results.filter(e => 
                e.description.toLowerCase().includes(searchLower) ||
                e.actor.id.toLowerCase().includes(searchLower) ||
                e.actor.name?.toLowerCase().includes(searchLower) ||
                e.resource?.id.toLowerCase().includes(searchLower)
            );
        }

        const sortBy = params.sortBy || 'timestamp';
        const sortOrder = params.sortOrder || 'desc';
        results.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'timestamp':
                    comparison = a.timestamp.getTime() - b.timestamp.getTime();
                    break;
                case 'severity':
                    const severityOrder: AuditSeverity[] = ['debug', 'info', 'warning', 'error', 'critical'];
                    comparison = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
                    break;
                case 'action':
                    comparison = a.action.localeCompare(b.action);
                    break;
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });

        const total = results.length;
        const offset = params.offset || 0;
        const limit = params.limit || 100;
        const paged = results.slice(offset, offset + limit);

        return {
            entries: paged,
            total,
            hasMore: offset + paged.length < total,
        };
    }

    getEntry(id: string): AuditEntry | null {
        return this.entries.get(id) || null;
    }

    getByCorrelation(correlationId: string): AuditEntry[] {
        const ids = this.entryIndex.byCorrelation.get(correlationId);
        if (!ids) return [];
        return Array.from(ids).map(id => this.entries.get(id)!).filter(Boolean);
    }

    getByActor(actorType: AuditActor['type'], actorId: string, limit = 100): AuditEntry[] {
        const key = `${actorType}:${actorId}`;
        const ids = this.entryIndex.byActor.get(key);
        if (!ids) return [];
        return Array.from(ids)
            .slice(0, limit)
            .map(id => this.entries.get(id)!)
            .filter(Boolean)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    getByResource(resourceType: string, resourceId: string, limit = 100): AuditEntry[] {
        const key = `${resourceType}:${resourceId}`;
        const ids = this.entryIndex.byResource.get(key);
        if (!ids) return [];
        return Array.from(ids)
            .slice(0, limit)
            .map(id => this.entries.get(id)!)
            .filter(Boolean)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    getStats(startDate?: Date, endDate?: Date): AuditStats {
        const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
        const end = endDate || new Date();

        const entries = Array.from(this.entries.values()).filter(
            e => e.timestamp >= start && e.timestamp <= end
        );

        const byAction = new Map<AuditAction, number>();
        const byCategory = new Map<AuditCategory, number>();
        const bySeverity = new Map<AuditSeverity, number>();
        const byActor = new Map<string, number>();
        const byResource = new Map<string, number>();
        const actorDetails = new Map<string, { name?: string; count: number }>();

        let errorCount = 0;
        let totalResponseTime = 0;
        let responseTimeCount = 0;

        for (const entry of entries) {
            byAction.set(entry.action, (byAction.get(entry.action) || 0) + 1);
            byCategory.set(entry.category, (byCategory.get(entry.category) || 0) + 1);
            bySeverity.set(entry.severity, (bySeverity.get(entry.severity) || 0) + 1);

            const actorKey = `${entry.actor.type}:${entry.actor.id}`;
            byActor.set(actorKey, (byActor.get(actorKey) || 0) + 1);
            if (!actorDetails.has(actorKey)) {
                actorDetails.set(actorKey, { name: entry.actor.name, count: 0 });
            }
            actorDetails.get(actorKey)!.count++;

            if (entry.resource) {
                const resourceKey = `${entry.resource.type}:${entry.resource.id}`;
                byResource.set(resourceKey, (byResource.get(resourceKey) || 0) + 1);
            }

            if (entry.severity === 'error' || entry.severity === 'critical') {
                errorCount++;
            }

            if (entry.response?.duration) {
                totalResponseTime += entry.response.duration;
                responseTimeCount++;
            }
        }

        const topActors = Array.from(actorDetails.entries())
            .map(([id, data]) => ({ id, name: data.name, count: data.count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            period: { start, end },
            totalEntries: entries.length,
            byAction,
            byCategory,
            bySeverity,
            byActor,
            byResource,
            topActors,
            errorRate: entries.length > 0 ? (errorCount / entries.length) * 100 : 0,
            avgResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : undefined,
        };
    }

    generateComplianceReport(type: ComplianceReport['type'], startDate: Date, endDate: Date): ComplianceReport {
        const entries = Array.from(this.entries.values()).filter(
            e => e.timestamp >= startDate && e.timestamp <= endDate
        );

        const dataAccessEvents = entries.filter(e => e.category === 'data');
        const securityEvents = entries.filter(e => e.category === 'security');
        const authFailures = entries.filter(e => e.action === 'auth_failure');
        const configChanges = entries.filter(e => e.action === 'config_change');

        const subjectAccess = new Map<string, { count: number; lastAccess: Date; dataTypes: Set<string> }>();
        for (const entry of dataAccessEvents) {
            if (entry.resource) {
                const subjectId = entry.resource.id;
                if (!subjectAccess.has(subjectId)) {
                    subjectAccess.set(subjectId, { count: 0, lastAccess: entry.timestamp, dataTypes: new Set() });
                }
                const data = subjectAccess.get(subjectId)!;
                data.count++;
                if (entry.timestamp > data.lastAccess) {
                    data.lastAccess = entry.timestamp;
                }
                data.dataTypes.add(entry.resource.type);
            }
        }

        const securityIncidents = entries.filter(e => 
            e.category === 'security' && (e.severity === 'error' || e.severity === 'critical')
        );

        const recommendations: string[] = [];
        if (authFailures.length > 10) {
            recommendations.push('High number of authentication failures detected. Consider implementing stricter access controls.');
        }
        if (securityIncidents.length > 0) {
            recommendations.push(`${securityIncidents.length} security incident(s) require review.`);
        }
        if (configChanges.length > 50) {
            recommendations.push('High volume of configuration changes. Ensure change management processes are followed.');
        }

        return {
            id: this.generateId(),
            type,
            generatedAt: new Date(),
            period: { start: startDate, end: endDate },
            summary: {
                totalEvents: entries.length,
                dataAccessEvents: dataAccessEvents.length,
                securityEvents: securityEvents.length,
                authFailures: authFailures.length,
                configChanges: configChanges.length,
            },
            dataSubjectAccess: Array.from(subjectAccess.entries()).map(([subjectId, data]) => ({
                subjectId,
                accessCount: data.count,
                lastAccess: data.lastAccess,
                dataTypes: Array.from(data.dataTypes),
            })),
            securityIncidents,
            recommendations,
        };
    }

    exportEntries(params: AuditQuery & { format?: 'json' | 'csv' }): string {
        const { entries } = this.query(params);
        
        if (params.format === 'csv') {
            const headers = ['id', 'timestamp', 'action', 'category', 'severity', 'actor_type', 'actor_id', 'resource_type', 'resource_id', 'description'];
            const rows = entries.map(e => [
                e.id,
                e.timestamp.toISOString(),
                e.action,
                e.category,
                e.severity,
                e.actor.type,
                e.actor.id,
                e.resource?.type || '',
                e.resource?.id || '',
                `"${e.description.replace(/"/g, '""')}"`,
            ].join(','));
            return [headers.join(','), ...rows].join('\n');
        }

        return JSON.stringify(entries, null, 2);
    }

    private maskSensitiveFields(entry: AuditEntry): void {
        const mask = (obj: unknown, path = ''): unknown => {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj !== 'object') return obj;

            if (Array.isArray(obj)) {
                return obj.map((item, i) => mask(item, `${path}[${i}]`));
            }

            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                if (this.config.sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
                    result[key] = '[REDACTED]';
                } else {
                    result[key] = mask(value, currentPath);
                }
            }
            return result;
        };

        if (entry.request?.body) {
            entry.request.body = mask(entry.request.body);
        }
        if (entry.request?.headers) {
            entry.request.headers = mask(entry.request.headers) as Record<string, string>;
        }
        if (entry.metadata) {
            entry.metadata = mask(entry.metadata) as Record<string, unknown>;
        }
        if (entry.changes) {
            entry.changes = entry.changes.map(c => {
                if (c.sensitive || this.config.sensitiveFields.some(f => c.field.toLowerCase().includes(f.toLowerCase()))) {
                    return { ...c, oldValue: '[REDACTED]', newValue: '[REDACTED]' };
                }
                return c;
            });
        }
    }

    private buildAuthDescription(params: { action: string; actor: AuditActor; success: boolean; method?: string; reason?: string }): string {
        const parts = [params.action.replace('_', ' ').toUpperCase()];
        parts.push(`by ${params.actor.type}:${params.actor.id}`);
        if (params.method) parts.push(`via ${params.method}`);
        parts.push(params.success ? '(success)' : '(failed)');
        if (params.reason) parts.push(`- ${params.reason}`);
        return parts.join(' ');
    }

    private createEmptyEntry(): AuditEntry {
        return {
            id: '',
            timestamp: new Date(),
            action: 'custom',
            category: 'system',
            severity: 'debug',
            actor: { type: 'system', id: 'noop' },
            description: '',
            retention: 'short',
        };
    }

    private generateId(): string {
        return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    private evictOldEntries(): void {
        const entries = Array.from(this.entries.entries())
            .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());

        const toEvict = Math.floor(this.config.maxEntriesInMemory * 0.1);
        for (let i = 0; i < toEvict && i < entries.length; i++) {
            const [id, entry] = entries[i];
            if (entry.retention !== 'permanent') {
                this.entries.delete(id);
                this.removeFromIndex(id, entry);
            }
        }

        this.emit('eviction', { evicted: toEvict });
    }

    private removeFromIndex(id: string, entry: AuditEntry): void {
        const actorKey = `${entry.actor.type}:${entry.actor.id}`;
        this.entryIndex.byActor.get(actorKey)?.delete(id);

        if (entry.resource) {
            const resourceKey = `${entry.resource.type}:${entry.resource.id}`;
            this.entryIndex.byResource.get(resourceKey)?.delete(id);
        }

        if (entry.context?.correlationId) {
            this.entryIndex.byCorrelation.get(entry.context.correlationId)?.delete(id);
        }

        const dateKey = entry.timestamp.toISOString().split('T')[0];
        this.entryIndex.byDate.get(dateKey)?.delete(id);
    }

    private startCleanup(): void {
        this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }

    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [id, entry] of this.entries) {
            if (entry.expiresAt && entry.expiresAt.getTime() < now) {
                this.entries.delete(id);
                this.removeFromIndex(id, entry);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.emit('cleanup', { cleaned, remaining: this.entries.size });
        }
    }

    forceCleanup(): { cleaned: number; remaining: number } {
        const before = this.entries.size;
        this.cleanup();
        return { cleaned: before - this.entries.size, remaining: this.entries.size };
    }

    shutdown(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.emit('shutdown');
    }
}

let auditLogServiceInstance: AuditLogService | null = null;

export function getAuditLogService(config?: Partial<AuditConfig>): AuditLogService {
    if (!auditLogServiceInstance) {
        auditLogServiceInstance = new AuditLogService(config);
    }
    return auditLogServiceInstance;
}

export function resetAuditLogService(): void {
    if (auditLogServiceInstance) {
        auditLogServiceInstance.shutdown();
        auditLogServiceInstance = null;
    }
}
