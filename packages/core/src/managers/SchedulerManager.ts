import schedule from 'node-schedule';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { AgentExecutor } from '../agents/AgentExecutor.js';
import { McpProxyManager } from '../managers/McpProxyManager.js';

interface ScheduledTask {
    id: string;
    name: string;
    cron: string;
    type: 'tool' | 'agent';
    target: string; // tool name or agent name
    args: any;
    lastRun?: number;
    enabled: boolean;
}

export class SchedulerManager extends EventEmitter {
    private tasks: Map<string, ScheduledTask> = new Map();
    private jobs: Map<string, schedule.Job> = new Map();
    private configFile: string;

    constructor(
        rootDir: string,
        private agentExecutor: AgentExecutor,
        private proxyManager: McpProxyManager
    ) {
        super();
        this.configFile = path.join(rootDir, 'scheduler.json');
        this.load();
    }

    private load() {
        try {
            if (fs.existsSync(this.configFile)) {
                const data = JSON.parse(fs.readFileSync(this.configFile, 'utf-8'));
                if (Array.isArray(data)) {
                    data.forEach((t: ScheduledTask) => this.tasks.set(t.id, t));
                }
            }
        } catch (e) {
            console.error('[Scheduler] Failed to load config:', e);
        }
    }

    private save() {
        try {
            fs.writeFileSync(this.configFile, JSON.stringify(Array.from(this.tasks.values()), null, 2));
        } catch (e) {
            console.error('[Scheduler] Failed to save config:', e);
        }
    }

    start() {
        console.log('[Scheduler] Starting...');
        this.tasks.forEach(task => {
            if (task.enabled) {
                this.scheduleJob(task);
            }
        });
    }

    private scheduleJob(task: ScheduledTask) {
        if (this.jobs.has(task.id)) {
            this.jobs.get(task.id)?.cancel();
        }

        try {
            const job = schedule.scheduleJob(task.cron, async () => {
                console.log(`[Scheduler] Running task: ${task.name}`);
                try {
                    if (task.type === 'agent') {
                        // We need to fetch the agent definition.
                        // Currently AgentExecutor needs AgentDefinition object.
                        // We rely on AgentExecutor having access to AgentManager?
                        // Or we pass the task name and let Hub handle it?
                        // For simplicity, we assume we can call an internal tool "run_agent".
                        await this.proxyManager.callTool('run_agent', { agentName: task.target, task: task.args.task });
                    } else {
                        await this.proxyManager.callTool(task.target, task.args);
                    }

                    task.lastRun = Date.now();
                    this.save();
                    this.emit('run', { taskId: task.id, status: 'success' });
                } catch (e: any) {
                    console.error(`[Scheduler] Task ${task.name} failed:`, e);
                    this.emit('run', { taskId: task.id, status: 'error', error: e.message });
                }
            });
            this.jobs.set(task.id, job);
        } catch (e) {
            console.error(`[Scheduler] Failed to schedule ${task.name}:`, e);
        }
    }

    registerTask(task: Omit<ScheduledTask, 'id' | 'lastRun'>) {
        const id = Math.random().toString(36).substring(7);
        const newTask: ScheduledTask = { ...task, id, lastRun: 0 };
        this.tasks.set(id, newTask);
        this.save();
        if (newTask.enabled) this.scheduleJob(newTask);
        return id;
    }

    removeTask(id: string) {
        if (this.jobs.has(id)) {
            this.jobs.get(id)?.cancel();
            this.jobs.delete(id);
        }
        this.tasks.delete(id);
        this.save();
    }

    getTasks() {
        return Array.from(this.tasks.values());
    }
}
