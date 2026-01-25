import { initTRPC } from '@trpc/server';
import { z } from 'zod';
export const t = initTRPC.create();
export const appRouter = t.router({
    health: t.procedure.query(() => {
        return { status: 'running', service: '@borg/core' };
    }),
    getTaskStatus: t.procedure
        .input(z.object({ taskId: z.string().optional() }))
        .query(({ input }) => {
        return {
            taskId: input.taskId || 'current',
            status: 'processing',
            progress: 45
        };
    }),
    indexingStatus: t.procedure.query(() => {
        return { status: 'idle', filesIndexed: 0, totalFiles: 0 };
    }),
    remoteAccess: t.router({
        start: t.procedure.mutation(async () => {
            const { TunnelTools } = await import('@borg/tools');
            const result = await TunnelTools[0].handler({ port: 3000 });
            return result.content[0].text;
        }),
        stop: t.procedure.mutation(async () => {
            const { TunnelTools } = await import('@borg/tools');
            const result = await TunnelTools[1].handler({});
            return result.content[0].text;
        }),
        status: t.procedure.query(async () => {
            const { TunnelTools } = await import('@borg/tools');
            const result = await TunnelTools[2].handler({});
            return JSON.parse(result.content[0].text);
        })
    }),
    config: t.router({
        readAntigravity: t.procedure.query(async () => {
            const { ConfigTools } = await import('@borg/tools');
            // @ts-ignore
            const result = await ConfigTools[0].handler({});
            // Parse JSON content from the tool output
            return JSON.parse(result.content[0].text);
        }),
        writeAntigravity: t.procedure.input(z.object({ content: z.string() })).mutation(async ({ input }) => {
            const { ConfigTools } = await import('@borg/tools');
            const result = await ConfigTools[1].handler({ content: input.content });
            return result.content[0].text;
        })
    }),
    logs: t.router({
        read: t.procedure.input(z.object({ lines: z.number().optional() })).query(async ({ input }) => {
            const { LogTools } = await import('@borg/tools');
            // @ts-ignore
            const result = await LogTools[0].handler({ lines: input.lines });
            return result.content[0].text;
        })
    }),
    autonomy: t.router({
        setLevel: t.procedure.input(z.object({ level: z.enum(['low', 'medium', 'high']) })).mutation(async ({ input }) => {
            // @ts-ignore
            if (global.mcpServerInstance) {
                // @ts-ignore
                global.mcpServerInstance.permissionManager.setAutonomyLevel(input.level);
                return input.level;
            }
            throw new Error("MCPServer instance not found global");
        }),
        getLevel: t.procedure.query(() => {
            // @ts-ignore
            if (global.mcpServerInstance) {
                // @ts-ignore
                return global.mcpServerInstance.permissionManager.autonomyLevel;
            }
            return 'low';
        }),
        activateFullAutonomy: t.procedure.mutation(async () => {
            // @ts-ignore
            const mcp = global.mcpServerInstance;
            if (mcp) {
                // 1. Set Autonomy High
                mcp.permissionManager.setAutonomyLevel('high');
                // 2. Start Director Chat Daemon
                mcp.director.startChatDaemon();
                // 3. Start Watchdog (Long)
                mcp.director.startWatchdog(100);
                return "Autonomous Supervisor Activated (High Level + Chat Daemon + Watchdog)";
            }
            throw new Error("MCPServer instance not found");
        })
    }),
    director: t.router({
        chat: t.procedure.input(z.object({ message: z.string() })).mutation(async ({ input }) => {
            // @ts-ignore
            if (global.mcpServerInstance) {
                // @ts-ignore
                // Director.executeTask is basically "Run this goal".
                // In a chat UI, user says "Do X". Director does X and returns summary.
                const result = await global.mcpServerInstance.director.executeTask(input.message);
                return result;
            }
            throw new Error("MCPServer instance not found");
        }),
        status: t.procedure.query(async () => {
            // @ts-ignore
            if (global.mcpServerInstance) {
                // @ts-ignore
                return global.mcpServerInstance.director.getStatus();
            }
            return { active: false, status: 'UNKNOWN' };
        }),
        stopAutoDrive: t.procedure.mutation(async () => {
            // @ts-ignore
            if (global.mcpServerInstance) {
                // @ts-ignore
                global.mcpServerInstance.director.stopAutoDrive();
                return "Stopped";
            }
            throw new Error("MCPServer instance not found");
        }),
        startAutoDrive: t.procedure.mutation(async () => {
            // @ts-ignore
            if (global.mcpServerInstance) {
                // @ts-ignore
                // Running valid tool so it logs properly
                // But we can call direct: mcp.director.startAutoDrive()
                // Let's use executeTool to keep consistency
                global.mcpServerInstance.executeTool('start_auto_drive', {});
                return "Started";
            }
            throw new Error("MCPServer instance not found");
        })
    }),
    directorConfig: t.router({
        get: t.procedure.query(async () => {
            // @ts-ignore
            if (global.mcpServerInstance?.directorConfig) {
                // @ts-ignore
                return global.mcpServerInstance.directorConfig;
            }
            // Default config
            return {
                taskCooldownMs: 10000,
                heartbeatIntervalMs: 30000,
                periodicSummaryMs: 120000,
                pasteToSubmitDelayMs: 1000,
                acceptDetectionMode: 'polling',
                pollingIntervalMs: 30000,
                council: {
                    personas: ['Architect', 'Product', 'Critic'],
                    contextFiles: ['README.md', 'docs/ROADMAP.md', 'task.md']
                }
            };
        }),
        update: t.procedure.input(z.object({
            taskCooldownMs: z.number().optional(),
            heartbeatIntervalMs: z.number().optional(),
            periodicSummaryMs: z.number().optional(),
            pasteToSubmitDelayMs: z.number().optional(),
            acceptDetectionMode: z.enum(['state', 'polling']).optional(),
            pollingIntervalMs: z.number().optional(),
            council: z.object({
                personas: z.array(z.string()).optional(),
                contextFiles: z.array(z.string()).optional()
            }).optional()
        })).mutation(async ({ input }) => {
            // @ts-ignore
            if (global.mcpServerInstance) {
                // @ts-ignore
                const current = global.mcpServerInstance.directorConfig || {};
                // Merge nested council config
                const council = {
                    ...(current.council || {}),
                    ...(input.council || {})
                };
                // @ts-ignore
                global.mcpServerInstance.directorConfig = {
                    ...current,
                    ...input,
                    council
                };
                console.log('[tRPC] Director config updated:', input);
                // @ts-ignore
                return global.mcpServerInstance.directorConfig;
            }
            throw new Error("MCPServer instance not found");
        })
    }),
    council: t.router({
        startDebate: t.procedure.input(z.object({ proposal: z.string() })).mutation(async ({ input }) => {
            // @ts-ignore
            if (global.mcpServerInstance) {
                // @ts-ignore
                const result = await global.mcpServerInstance.council.startDebate(input.proposal);
                return result;
            }
            throw new Error("MCPServer instance not found");
        })
    }),
    runCommand: t.procedure.input(z.object({ command: z.string() })).mutation(async ({ input }) => {
        const { TerminalTools } = await import('@borg/tools');
        // @ts-ignore
        // @ts-ignore
        const result = await TerminalTools[0].handler({ command: input.command, cwd: process.cwd() });
        return result.content[0].text;
    }),
    skills: t.router({
        list: t.procedure.query(async () => {
            // @ts-ignore
            if (global.mcpServerInstance) {
                // @ts-ignore
                const mcp = global.mcpServerInstance;
                // @ts-ignore
                const skills = await mcp.skillRegistry.listSkills();
                return skills;
            }
            return { tools: [] };
        }),
        read: t.procedure.input(z.object({ name: z.string() })).query(async ({ input }) => {
            // @ts-ignore
            if (global.mcpServerInstance) {
                // @ts-ignore
                return await global.mcpServerInstance.skillRegistry.readSkill(input.name);
            }
            return { content: [{ type: "text", text: "Error: No Server" }] };
        })
    }),
    executeTool: t.procedure.input(z.object({
        name: z.string(),
        args: z.any()
    })).mutation(async ({ input }) => {
        // @ts-ignore
        if (global.mcpServerInstance) {
            // @ts-ignore
            const result = await global.mcpServerInstance.executeTool(input.name, input.args);
            // Result is { content: ... }
            // @ts-ignore
            if (result.isError)
                throw new Error(result.content[0].text);
            // @ts-ignore
            return result.content[0].text;
        }
        throw new Error("MCPServer not found");
    }),
    git: t.router({
        getSubmodules: t.procedure.query(async () => {
            const fs = await import('fs/promises');
            const path = await import('path');
            const gitModulesPath = path.join(process.cwd(), '.gitmodules');
            try {
                const content = await fs.readFile(gitModulesPath, 'utf-8');
                const modules = [];
                // Simple regex parser
                const lines = content.split('\n');
                let current = {};
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('[submodule')) {
                        if (current.path)
                            modules.push(current);
                        current = { name: trimmed.match(/"(.+)"/)?.[1] || 'unknown' };
                    }
                    else if (trimmed.startsWith('path = ')) {
                        current.path = trimmed.split(' = ')[1];
                    }
                    else if (trimmed.startsWith('url = ')) {
                        current.url = trimmed.split(' = ')[1];
                    }
                }
                if (current.path)
                    modules.push(current);
                return modules;
            }
            catch (e) {
                console.error("Failed to read .gitmodules", e);
                return [];
            }
        })
    }),
    billing: t.router({
        getStatus: t.procedure.query(async () => {
            // Check Env Keys (MASKED)
            const keys = {
                openai: !!process.env.OPENAI_API_KEY,
                anthropic: !!process.env.ANTHROPIC_API_KEY,
                gemini: !!process.env.GEMINI_API_KEY,
                mistral: !!process.env.MISTRAL_API_KEY
            };
            // Mock Usage (In real app, read from SQL/Graph)
            const usage = {
                currentMonth: 42.50,
                limit: 100.00,
                breakdown: [
                    { provider: 'OpenAI', cost: 12.50, requests: 1540 },
                    { provider: 'Anthropic', cost: 25.00, requests: 890 },
                    { provider: 'Gemini', cost: 5.00, requests: 3020 } // Cheap!
                ]
            };
            return { keys, usage };
        })
    })
});
