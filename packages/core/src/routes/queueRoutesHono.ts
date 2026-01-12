/**
 * @module routes/queueRoutesHono
 */

import { Hono } from 'hono';
import {
    getQueueService,
    type JobStatus,
    type JobPriority,
} from '../services/QueueService.js';

export function createQueueRoutes(): Hono {
    const app = new Hono();
    const service = getQueueService();

    app.post('/queues', async (c) => {
        try {
            const body = await c.req.json();

            if (!body.name) {
                return c.json({ success: false, error: 'name is required' }, 400);
            }

            const queue = service.createQueue(body.name, {
                concurrency: body.concurrency,
                defaultPriority: body.defaultPriority,
                defaultTimeout: body.defaultTimeout,
                defaultMaxAttempts: body.defaultMaxAttempts,
                defaultBackoff: body.defaultBackoff,
                defaultBackoffDelay: body.defaultBackoffDelay,
                rateLimitPerSecond: body.rateLimitPerSecond,
                paused: body.paused,
            });

            return c.json({ success: true, queue }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create queue'
            }, 400);
        }
    });

    app.get('/queues', async (c) => {
        try {
            const queues = service.listQueues();
            return c.json({ success: true, queues, count: queues.length });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to list queues'
            }, 500);
        }
    });

    app.get('/queues/:queueName', async (c) => {
        try {
            const queueName = c.req.param('queueName');
            const queue = service.getQueue(queueName);

            if (!queue) {
                return c.json({ success: false, error: 'Queue not found' }, 404);
            }

            return c.json({ success: true, queue });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get queue'
            }, 500);
        }
    });

    app.delete('/queues/:queueName', async (c) => {
        try {
            const queueName = c.req.param('queueName');
            const deleted = service.deleteQueue(queueName);

            if (!deleted) {
                return c.json({ success: false, error: 'Queue not found' }, 404);
            }

            return c.json({ success: true, message: 'Queue deleted' });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete queue'
            }, 500);
        }
    });

    app.post('/queues/:queueName/pause', async (c) => {
        try {
            const queueName = c.req.param('queueName');
            const paused = service.pauseQueue(queueName);

            if (!paused) {
                return c.json({ success: false, error: 'Queue not found' }, 404);
            }

            return c.json({ success: true, message: 'Queue paused' });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to pause queue'
            }, 500);
        }
    });

    app.post('/queues/:queueName/resume', async (c) => {
        try {
            const queueName = c.req.param('queueName');
            const resumed = service.resumeQueue(queueName);

            if (!resumed) {
                return c.json({ success: false, error: 'Queue not found' }, 404);
            }

            return c.json({ success: true, message: 'Queue resumed' });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to resume queue'
            }, 500);
        }
    });

    app.post('/queues/:queueName/jobs', async (c) => {
        try {
            const queueName = c.req.param('queueName');
            const body = await c.req.json();

            if (!body.name) {
                return c.json({ success: false, error: 'name is required' }, 400);
            }

            const job = await service.addJob(queueName, body.name, body.data || {}, {
                priority: body.priority as JobPriority,
                maxAttempts: body.maxAttempts,
                timeout: body.timeout,
                backoff: body.backoff,
                backoffDelay: body.backoffDelay,
                metadata: body.metadata,
                parentId: body.parentId,
            });

            return c.json({ success: true, job }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to add job'
            }, 400);
        }
    });

    app.post('/queues/:queueName/jobs/bulk', async (c) => {
        try {
            const queueName = c.req.param('queueName');
            const body = await c.req.json();

            if (!Array.isArray(body.jobs)) {
                return c.json({ success: false, error: 'jobs array is required' }, 400);
            }

            const jobs = await service.addBulkJobs(queueName, body.jobs);
            return c.json({ success: true, jobs, count: jobs.length }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to add jobs'
            }, 400);
        }
    });

    app.get('/queues/:queueName/jobs', async (c) => {
        try {
            const queueName = c.req.param('queueName');
            const statusParam = c.req.query('status');
            const status = statusParam?.split(',') as JobStatus[] | undefined;
            const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
            const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;

            const jobs = service.getQueueJobs(queueName, { status, limit, offset });
            return c.json({ success: true, jobs, count: jobs.length });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get jobs'
            }, 500);
        }
    });

    app.get('/queues/:queueName/stats', async (c) => {
        try {
            const queueName = c.req.param('queueName');
            const stats = service.getQueueStats(queueName);

            if (!stats) {
                return c.json({ success: false, error: 'Queue not found' }, 404);
            }

            return c.json({ success: true, stats });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get stats'
            }, 500);
        }
    });

    app.get('/jobs/:jobId', async (c) => {
        try {
            const jobId = c.req.param('jobId');
            const job = service.getJob(jobId);

            if (!job) {
                return c.json({ success: false, error: 'Job not found' }, 404);
            }

            return c.json({ success: true, job });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get job'
            }, 500);
        }
    });

    app.post('/jobs/:jobId/cancel', async (c) => {
        try {
            const jobId = c.req.param('jobId');
            const cancelled = await service.cancelJob(jobId);

            if (!cancelled) {
                return c.json({ success: false, error: 'Job not found or already completed' }, 404);
            }

            return c.json({ success: true, message: 'Job cancelled' });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to cancel job'
            }, 500);
        }
    });

    app.post('/jobs/:jobId/retry', async (c) => {
        try {
            const jobId = c.req.param('jobId');
            const retried = await service.retryJob(jobId);

            if (!retried) {
                return c.json({ success: false, error: 'Job not found or not in failed/cancelled state' }, 404);
            }

            return c.json({ success: true, message: 'Job queued for retry' });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to retry job'
            }, 500);
        }
    });

    app.patch('/jobs/:jobId/progress', async (c) => {
        try {
            const jobId = c.req.param('jobId');
            const body = await c.req.json();

            if (typeof body.progress !== 'number') {
                return c.json({ success: false, error: 'progress (number) is required' }, 400);
            }

            const updated = service.updateProgress(jobId, body.progress);

            if (!updated) {
                return c.json({ success: false, error: 'Job not found or not processing' }, 404);
            }

            return c.json({ success: true, message: 'Progress updated' });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update progress'
            }, 500);
        }
    });

    app.get('/stats', async (c) => {
        try {
            const allStats = service.getAllStats();
            const stats = Object.fromEntries(allStats);
            return c.json({ success: true, stats });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get stats'
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
        const allStats = service.getAllStats();
        let totalPending = 0;
        let totalProcessing = 0;
        let totalFailed = 0;

        for (const stats of allStats.values()) {
            totalPending += stats.pending;
            totalProcessing += stats.processing;
            totalFailed += stats.failed;
        }

        return c.json({
            success: true,
            status: 'healthy',
            queues: allStats.size,
            totalPending,
            totalProcessing,
            totalFailed,
        });
    });

    return app;
}
