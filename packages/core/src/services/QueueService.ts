/**
 * @module services/QueueService
 */

import { EventEmitter } from 'events';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'retrying';

export type JobPriority = 'critical' | 'high' | 'normal' | 'low';

export interface Job<T = unknown> {
    id: string;
    queue: string;
    name: string;
    data: T;
    status: JobStatus;
    priority: JobPriority;
    attempts: number;
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    backoffDelay: number;
    timeout: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    nextRetryAt?: Date;
    result?: unknown;
    error?: string;
    progress?: number;
    metadata?: Record<string, unknown>;
    parentId?: string;
    children?: string[];
}

export type JobHandler<T = unknown, R = unknown> = (job: Job<T>) => Promise<R>;

export interface QueueConfig {
    name: string;
    concurrency: number;
    defaultPriority: JobPriority;
    defaultTimeout: number;
    defaultMaxAttempts: number;
    defaultBackoff: 'fixed' | 'exponential';
    defaultBackoffDelay: number;
    rateLimitPerSecond?: number;
    paused: boolean;
}

export interface QueueStats {
    name: string;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    totalProcessed: number;
    avgProcessingTime: number;
    throughput: number;
}

export interface QueueServiceConfig {
    defaultConcurrency: number;
    maxJobsInMemory: number;
    cleanupInterval: number;
    completedJobTtl: number;
    failedJobTtl: number;
}

const DEFAULT_CONFIG: QueueServiceConfig = {
    defaultConcurrency: 5,
    maxJobsInMemory: 10000,
    cleanupInterval: 60000,
    completedJobTtl: 3600000,
    failedJobTtl: 86400000,
};

const PRIORITY_ORDER: Record<JobPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
};

export class QueueService extends EventEmitter {
    private config: QueueServiceConfig;
    private queues: Map<string, QueueConfig> = new Map();
    private jobs: Map<string, Job> = new Map();
    private handlers: Map<string, Map<string, JobHandler>> = new Map();
    private processing: Map<string, Set<string>> = new Map();
    private cleanupTimer?: ReturnType<typeof setInterval>;
    private processTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private processingTimes: Map<string, number[]> = new Map();

    constructor(config: Partial<QueueServiceConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.startCleanup();
    }

    createQueue(name: string, config: Partial<Omit<QueueConfig, 'name'>> = {}): QueueConfig {
        if (this.queues.has(name)) {
            return this.queues.get(name)!;
        }

        const queueConfig: QueueConfig = {
            name,
            concurrency: config.concurrency ?? this.config.defaultConcurrency,
            defaultPriority: config.defaultPriority ?? 'normal',
            defaultTimeout: config.defaultTimeout ?? 30000,
            defaultMaxAttempts: config.defaultMaxAttempts ?? 3,
            defaultBackoff: config.defaultBackoff ?? 'exponential',
            defaultBackoffDelay: config.defaultBackoffDelay ?? 1000,
            rateLimitPerSecond: config.rateLimitPerSecond,
            paused: config.paused ?? false,
        };

        this.queues.set(name, queueConfig);
        this.handlers.set(name, new Map());
        this.processing.set(name, new Set());
        this.processingTimes.set(name, []);

        this.emit('queue:created', queueConfig);
        return queueConfig;
    }

    getQueue(name: string): QueueConfig | null {
        return this.queues.get(name) || null;
    }

    listQueues(): QueueConfig[] {
        return Array.from(this.queues.values());
    }

    deleteQueue(name: string): boolean {
        if (!this.queues.has(name)) return false;

        for (const [id, job] of this.jobs) {
            if (job.queue === name) {
                this.jobs.delete(id);
            }
        }

        this.queues.delete(name);
        this.handlers.delete(name);
        this.processing.delete(name);
        this.processingTimes.delete(name);

        const timer = this.processTimers.get(name);
        if (timer) {
            clearTimeout(timer);
            this.processTimers.delete(name);
        }

        this.emit('queue:deleted', { name });
        return true;
    }

    pauseQueue(name: string): boolean {
        const queue = this.queues.get(name);
        if (!queue) return false;

        queue.paused = true;
        this.emit('queue:paused', { name });
        return true;
    }

    resumeQueue(name: string): boolean {
        const queue = this.queues.get(name);
        if (!queue) return false;

        queue.paused = false;
        this.emit('queue:resumed', { name });
        this.scheduleProcessing(name);
        return true;
    }

    registerHandler<T = unknown, R = unknown>(
        queue: string,
        jobName: string,
        handler: JobHandler<T, R>
    ): void {
        if (!this.queues.has(queue)) {
            this.createQueue(queue);
        }

        this.handlers.get(queue)!.set(jobName, handler as JobHandler);
        this.emit('handler:registered', { queue, jobName });
        this.scheduleProcessing(queue);
    }

    unregisterHandler(queue: string, jobName: string): boolean {
        const queueHandlers = this.handlers.get(queue);
        if (!queueHandlers) return false;

        const deleted = queueHandlers.delete(jobName);
        if (deleted) {
            this.emit('handler:unregistered', { queue, jobName });
        }
        return deleted;
    }

    async addJob<T = unknown>(
        queue: string,
        name: string,
        data: T,
        options: Partial<Pick<Job, 'priority' | 'maxAttempts' | 'backoff' | 'backoffDelay' | 'timeout' | 'metadata' | 'parentId'>> = {}
    ): Promise<Job<T>> {
        if (!this.queues.has(queue)) {
            this.createQueue(queue);
        }

        const queueConfig = this.queues.get(queue)!;

        const job: Job<T> = {
            id: this.generateId(),
            queue,
            name,
            data,
            status: 'pending',
            priority: options.priority ?? queueConfig.defaultPriority,
            attempts: 0,
            maxAttempts: options.maxAttempts ?? queueConfig.defaultMaxAttempts,
            backoff: options.backoff ?? queueConfig.defaultBackoff,
            backoffDelay: options.backoffDelay ?? queueConfig.defaultBackoffDelay,
            timeout: options.timeout ?? queueConfig.defaultTimeout,
            createdAt: new Date(),
            metadata: options.metadata,
            parentId: options.parentId,
        };

        this.jobs.set(job.id, job as Job);

        if (options.parentId) {
            const parent = this.jobs.get(options.parentId);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.push(job.id);
            }
        }

        this.emit('job:added', job);
        this.scheduleProcessing(queue);

        return job;
    }

    async addBulkJobs<T = unknown>(
        queue: string,
        jobs: Array<{ name: string; data: T; options?: Partial<Pick<Job, 'priority' | 'maxAttempts' | 'timeout' | 'metadata'>> }>
    ): Promise<Job<T>[]> {
        const created: Job<T>[] = [];

        for (const { name, data, options } of jobs) {
            const job = await this.addJob(queue, name, data, options);
            created.push(job);
        }

        return created;
    }

    getJob(jobId: string): Job | null {
        return this.jobs.get(jobId) || null;
    }

    async cancelJob(jobId: string): Promise<boolean> {
        const job = this.jobs.get(jobId);
        if (!job) return false;

        if (job.status === 'completed' || job.status === 'cancelled') {
            return false;
        }

        job.status = 'cancelled';
        this.emit('job:cancelled', job);
        return true;
    }

    async retryJob(jobId: string): Promise<boolean> {
        const job = this.jobs.get(jobId);
        if (!job) return false;

        if (job.status !== 'failed' && job.status !== 'cancelled') {
            return false;
        }

        job.status = 'pending';
        job.attempts = 0;
        job.error = undefined;
        job.failedAt = undefined;
        job.nextRetryAt = undefined;

        this.emit('job:retried', job);
        this.scheduleProcessing(job.queue);
        return true;
    }

    updateProgress(jobId: string, progress: number): boolean {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'processing') return false;

        job.progress = Math.min(100, Math.max(0, progress));
        this.emit('job:progress', { job, progress: job.progress });
        return true;
    }

    getQueueJobs(queue: string, options: {
        status?: JobStatus | JobStatus[];
        limit?: number;
        offset?: number;
    } = {}): Job[] {
        let jobs = Array.from(this.jobs.values()).filter(j => j.queue === queue);

        if (options.status) {
            const statuses = Array.isArray(options.status) ? options.status : [options.status];
            jobs = jobs.filter(j => statuses.includes(j.status));
        }

        jobs.sort((a, b) => {
            const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

        const offset = options.offset || 0;
        const limit = options.limit || 100;

        return jobs.slice(offset, offset + limit);
    }

    getQueueStats(queue: string): QueueStats | null {
        if (!this.queues.has(queue)) return null;

        const jobs = Array.from(this.jobs.values()).filter(j => j.queue === queue);
        const times = this.processingTimes.get(queue) || [];

        const pending = jobs.filter(j => j.status === 'pending' || j.status === 'retrying').length;
        const processing = this.processing.get(queue)?.size || 0;
        const completed = jobs.filter(j => j.status === 'completed').length;
        const failed = jobs.filter(j => j.status === 'failed').length;
        const cancelled = jobs.filter(j => j.status === 'cancelled').length;

        const avgProcessingTime = times.length > 0
            ? times.reduce((a, b) => a + b, 0) / times.length
            : 0;

        const recentTimes = times.slice(-100);
        const throughput = recentTimes.length > 0
            ? (recentTimes.length / (recentTimes.reduce((a, b) => a + b, 0) / 1000)) || 0
            : 0;

        return {
            name: queue,
            pending,
            processing,
            completed,
            failed,
            cancelled,
            totalProcessed: completed + failed,
            avgProcessingTime,
            throughput,
        };
    }

    getAllStats(): Map<string, QueueStats> {
        const stats = new Map<string, QueueStats>();
        for (const queue of this.queues.keys()) {
            const queueStats = this.getQueueStats(queue);
            if (queueStats) stats.set(queue, queueStats);
        }
        return stats;
    }

    private scheduleProcessing(queue: string): void {
        if (this.processTimers.has(queue)) return;

        const timer = setTimeout(() => {
            this.processTimers.delete(queue);
            this.processQueue(queue);
        }, 0);

        this.processTimers.set(queue, timer);
    }

    private async processQueue(queue: string): Promise<void> {
        const queueConfig = this.queues.get(queue);
        if (!queueConfig || queueConfig.paused) return;

        const processingSet = this.processing.get(queue)!;
        const availableSlots = queueConfig.concurrency - processingSet.size;

        if (availableSlots <= 0) return;

        const pendingJobs = this.getQueueJobs(queue, { status: ['pending', 'retrying'], limit: availableSlots });

        for (const job of pendingJobs) {
            if (job.nextRetryAt && job.nextRetryAt > new Date()) continue;
            if (processingSet.size >= queueConfig.concurrency) break;

            processingSet.add(job.id);
            this.processJob(job).finally(() => {
                processingSet.delete(job.id);
                this.scheduleProcessing(queue);
            });
        }
    }

    private async processJob(job: Job): Promise<void> {
        const handlers = this.handlers.get(job.queue);
        const handler = handlers?.get(job.name);

        if (!handler) {
            job.status = 'failed';
            job.error = `No handler registered for job '${job.name}' in queue '${job.queue}'`;
            job.failedAt = new Date();
            this.emit('job:failed', job);
            return;
        }

        job.status = 'processing';
        job.startedAt = new Date();
        job.attempts++;
        this.emit('job:started', job);

        const startTime = Date.now();

        try {
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Job timeout')), job.timeout);
            });

            const result = await Promise.race([
                handler(job),
                timeoutPromise,
            ]);

            const processingTime = Date.now() - startTime;
            this.recordProcessingTime(job.queue, processingTime);

            job.status = 'completed';
            job.result = result;
            job.completedAt = new Date();
            job.progress = 100;

            this.emit('job:completed', job);
        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.recordProcessingTime(job.queue, processingTime);

            job.error = error instanceof Error ? error.message : String(error);

            if (job.attempts < job.maxAttempts) {
                job.status = 'retrying';
                const delay = job.backoff === 'exponential'
                    ? job.backoffDelay * Math.pow(2, job.attempts - 1)
                    : job.backoffDelay;
                job.nextRetryAt = new Date(Date.now() + delay);

                this.emit('job:retrying', job);

                setTimeout(() => this.scheduleProcessing(job.queue), delay);
            } else {
                job.status = 'failed';
                job.failedAt = new Date();
                this.emit('job:failed', job);
            }
        }
    }

    private recordProcessingTime(queue: string, time: number): void {
        const times = this.processingTimes.get(queue);
        if (times) {
            times.push(time);
            if (times.length > 1000) {
                times.shift();
            }
        }
    }

    private generateId(): string {
        return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    private startCleanup(): void {
        this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupInterval);
    }

    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [id, job] of this.jobs) {
            if (job.status === 'completed' && job.completedAt) {
                if (now - job.completedAt.getTime() > this.config.completedJobTtl) {
                    this.jobs.delete(id);
                    cleaned++;
                }
            } else if (job.status === 'failed' && job.failedAt) {
                if (now - job.failedAt.getTime() > this.config.failedJobTtl) {
                    this.jobs.delete(id);
                    cleaned++;
                }
            }
        }

        if (cleaned > 0) {
            this.emit('cleanup', { cleaned, remaining: this.jobs.size });
        }
    }

    forceCleanup(): { cleaned: number; remaining: number } {
        const before = this.jobs.size;
        this.cleanup();
        return { cleaned: before - this.jobs.size, remaining: this.jobs.size };
    }

    drainQueue(queue: string): Promise<void> {
        return new Promise((resolve) => {
            const check = () => {
                const processingSet = this.processing.get(queue);
                const pending = this.getQueueJobs(queue, { status: ['pending', 'processing', 'retrying'] });

                if ((!processingSet || processingSet.size === 0) && pending.length === 0) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    shutdown(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        for (const timer of this.processTimers.values()) {
            clearTimeout(timer);
        }
        this.processTimers.clear();

        this.emit('shutdown');
    }
}

let queueServiceInstance: QueueService | null = null;

export function getQueueService(config?: Partial<QueueServiceConfig>): QueueService {
    if (!queueServiceInstance) {
        queueServiceInstance = new QueueService(config);
    }
    return queueServiceInstance;
}

export function resetQueueService(): void {
    if (queueServiceInstance) {
        queueServiceInstance.shutdown();
        queueServiceInstance = null;
    }
}
