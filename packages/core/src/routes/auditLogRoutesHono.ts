/**
 * @module routes/auditLogRoutesHono
 */

import { Hono } from 'hono';
import {
    getAuditLogService,
    type AuditAction,
    type AuditCategory,
    type AuditSeverity,
    type AuditActor,
    type ComplianceReport,
} from '../services/AuditLogService.js';

export function createAuditLogRoutes(): Hono {
    const app = new Hono();
    const service = getAuditLogService();

    app.post('/entries', async (c) => {
        try {
            const body = await c.req.json();

            const entry = service.log({
                action: body.action as AuditAction,
                category: body.category as AuditCategory,
                severity: body.severity as AuditSeverity || 'info',
                actor: body.actor as AuditActor,
                resource: body.resource,
                description: body.description,
                changes: body.changes,
                request: body.request,
                response: body.response,
                context: body.context,
                tags: body.tags,
                metadata: body.metadata,
                retention: body.retention,
            });

            return c.json({ success: true, entry }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create entry'
            }, 400);
        }
    });

    app.get('/entries', async (c) => {
        try {
            const query = {
                startDate: c.req.query('startDate') ? new Date(c.req.query('startDate')!) : undefined,
                endDate: c.req.query('endDate') ? new Date(c.req.query('endDate')!) : undefined,
                actions: c.req.query('actions')?.split(',') as AuditAction[] | undefined,
                categories: c.req.query('categories')?.split(',') as AuditCategory[] | undefined,
                severities: c.req.query('severities')?.split(',') as AuditSeverity[] | undefined,
                actorId: c.req.query('actorId'),
                actorType: c.req.query('actorType') as AuditActor['type'] | undefined,
                resourceType: c.req.query('resourceType'),
                resourceId: c.req.query('resourceId'),
                correlationId: c.req.query('correlationId'),
                tags: c.req.query('tags')?.split(','),
                search: c.req.query('search'),
                limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined,
                offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined,
                sortBy: c.req.query('sortBy') as 'timestamp' | 'severity' | 'action' | undefined,
                sortOrder: c.req.query('sortOrder') as 'asc' | 'desc' | undefined,
            };

            const result = service.query(query);
            return c.json({ success: true, ...result });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to query entries'
            }, 500);
        }
    });

    app.get('/entries/:entryId', async (c) => {
        try {
            const entryId = c.req.param('entryId');
            const entry = service.getEntry(entryId);

            if (!entry) {
                return c.json({ success: false, error: 'Entry not found' }, 404);
            }

            return c.json({ success: true, entry });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get entry'
            }, 500);
        }
    });

    app.get('/correlation/:correlationId', async (c) => {
        try {
            const correlationId = c.req.param('correlationId');
            const entries = service.getByCorrelation(correlationId);
            return c.json({ success: true, entries, count: entries.length });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get entries'
            }, 500);
        }
    });

    app.get('/actors/:actorType/:actorId', async (c) => {
        try {
            const actorType = c.req.param('actorType') as AuditActor['type'];
            const actorId = c.req.param('actorId');
            const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 100;

            const entries = service.getByActor(actorType, actorId, limit);
            return c.json({ success: true, entries, count: entries.length });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get entries'
            }, 500);
        }
    });

    app.get('/resources/:resourceType/:resourceId', async (c) => {
        try {
            const resourceType = c.req.param('resourceType');
            const resourceId = c.req.param('resourceId');
            const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 100;

            const entries = service.getByResource(resourceType, resourceId, limit);
            return c.json({ success: true, entries, count: entries.length });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get entries'
            }, 500);
        }
    });

    app.post('/auth', async (c) => {
        try {
            const body = await c.req.json();

            const entry = service.logAuth({
                action: body.action,
                actor: body.actor,
                success: body.success,
                method: body.method,
                reason: body.reason,
                metadata: body.metadata,
            });

            return c.json({ success: true, entry }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to log auth event'
            }, 400);
        }
    });

    app.post('/data-access', async (c) => {
        try {
            const body = await c.req.json();

            const entry = service.logDataAccess({
                action: body.action,
                actor: body.actor,
                resource: body.resource,
                changes: body.changes,
                reason: body.reason,
                metadata: body.metadata,
            });

            return c.json({ success: true, entry }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to log data access'
            }, 400);
        }
    });

    app.post('/security', async (c) => {
        try {
            const body = await c.req.json();

            const entry = service.logSecurityEvent({
                action: body.action,
                actor: body.actor,
                severity: body.severity,
                description: body.description,
                resource: body.resource,
                metadata: body.metadata,
            });

            return c.json({ success: true, entry }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to log security event'
            }, 400);
        }
    });

    app.post('/config-change', async (c) => {
        try {
            const body = await c.req.json();

            const entry = service.logConfigChange({
                actor: body.actor,
                resource: body.resource,
                changes: body.changes,
                reason: body.reason,
            });

            return c.json({ success: true, entry }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to log config change'
            }, 400);
        }
    });

    app.get('/stats', async (c) => {
        try {
            const startDate = c.req.query('startDate') ? new Date(c.req.query('startDate')!) : undefined;
            const endDate = c.req.query('endDate') ? new Date(c.req.query('endDate')!) : undefined;

            const stats = service.getStats(startDate, endDate);

            return c.json({
                success: true,
                stats: {
                    ...stats,
                    byAction: Object.fromEntries(stats.byAction),
                    byCategory: Object.fromEntries(stats.byCategory),
                    bySeverity: Object.fromEntries(stats.bySeverity),
                    byActor: Object.fromEntries(stats.byActor),
                    byResource: Object.fromEntries(stats.byResource),
                }
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get stats'
            }, 500);
        }
    });

    app.post('/reports/compliance', async (c) => {
        try {
            const body = await c.req.json();

            if (!body.type || !body.startDate || !body.endDate) {
                return c.json({
                    success: false,
                    error: 'type, startDate, and endDate are required'
                }, 400);
            }

            const report = service.generateComplianceReport(
                body.type as ComplianceReport['type'],
                new Date(body.startDate),
                new Date(body.endDate)
            );

            return c.json({ success: true, report }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to generate report'
            }, 500);
        }
    });

    app.get('/export', async (c) => {
        try {
            const format = c.req.query('format') as 'json' | 'csv' || 'json';
            const query = {
                startDate: c.req.query('startDate') ? new Date(c.req.query('startDate')!) : undefined,
                endDate: c.req.query('endDate') ? new Date(c.req.query('endDate')!) : undefined,
                actions: c.req.query('actions')?.split(',') as AuditAction[] | undefined,
                categories: c.req.query('categories')?.split(',') as AuditCategory[] | undefined,
                limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 1000,
                format,
            };

            const data = service.exportEntries(query);

            if (format === 'csv') {
                c.header('Content-Type', 'text/csv');
                c.header('Content-Disposition', 'attachment; filename="audit-log.csv"');
            } else {
                c.header('Content-Type', 'application/json');
            }

            return c.body(data);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to export entries'
            }, 500);
        }
    });

    app.post('/cleanup', async (c) => {
        try {
            const result = service.forceCleanup();
            return c.json({ success: true, ...result });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to run cleanup'
            }, 500);
        }
    });

    app.get('/health', async (c) => {
        const stats = service.getStats();
        return c.json({
            success: true,
            status: 'healthy',
            totalEntries: stats.totalEntries,
            errorRate: stats.errorRate,
        });
    });

    return app;
}
