import { EventEmitter } from 'events';
import { SchedulerManager } from '../managers/SchedulerManager.js';

export class LoopManager extends EventEmitter {
    constructor(private scheduler: SchedulerManager) {
        super();
    }

    createLoop(name: string, agentName: string, task: string, cron: string) {
        return this.scheduler.registerTask({
            name: `Loop: ${name}`,
            type: 'agent',
            target: agentName,
            args: { task },
            cron,
            enabled: true
        });
    }

    stopLoop(loopId: string) {
        this.scheduler.removeTask(loopId);
        return `Stopped loop ${loopId}`;
    }

    getToolDefinitions() {
        return [
            {
                name: "create_loop",
                description: "Create an autonomous loop that runs an agent periodically.",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        agentName: { type: "string" },
                        task: { type: "string" },
                        cron: { type: "string", description: "CRON expression (e.g. '0 * * * *' for hourly)" }
                    },
                    required: ["name", "agentName", "task", "cron"]
                }
            },
            {
                name: "stop_loop",
                description: "Stop an autonomous loop.",
                inputSchema: {
                    type: "object",
                    properties: {
                        loopId: { type: "string" }
                    },
                    required: ["loopId"]
                }
            }
        ];
    }
}
