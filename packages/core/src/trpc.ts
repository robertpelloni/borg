
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
            const { TunnelTools } = await import('./tools/TunnelTools.js');
            const result = await TunnelTools[0].handler({ port: 3000 });
            return result.content[0].text;
        }),
        stop: t.procedure.mutation(async () => {
            const { TunnelTools } = await import('./tools/TunnelTools.js');
            const result = await TunnelTools[1].handler({});
            return result.content[0].text;
        }),
        status: t.procedure.query(async () => {
            const { TunnelTools } = await import('./tools/TunnelTools.js');
            const result = await TunnelTools[2].handler({});
            return JSON.parse(result.content[0].text);
        })
    }),
    config: t.router({
        readAntigravity: t.procedure.query(async () => {
            const { ConfigTools } = await import('./tools/ConfigTools.js');
            // @ts-ignore
            const result = await ConfigTools[0].handler({});
            // Parse JSON content from the tool output
            return JSON.parse(result.content[0].text);
        }),
        writeAntigravity: t.procedure.input(z.object({ content: z.string() })).mutation(async ({ input }) => {
            const { ConfigTools } = await import('./tools/ConfigTools.js');
            const result = await ConfigTools[1].handler({ content: input.content });
            return result.content[0].text;
        })
    }),
    logs: t.router({
        read: t.procedure.input(z.object({ lines: z.number().optional() })).query(async ({ input }) => {
            const { LogTools } = await import('./tools/LogTools.js');
            // @ts-ignore
            const result = await LogTools[0].handler({ lines: input.lines });
            return result.content[0].text;
        })
    }),
    autonomy: t.router({
        setLevel: t.procedure.input(z.object({ level: z.enum(['low', 'medium', 'high']) })).mutation(async ({ input }) => {
            const { MCPServer } = await import('./MCPServer.js'); // Circular dependency risk? No, MCPServer exports class.
            // Actually, we need to call the tool handler.
            // Since we don't have a direct reference to the running server instance easily here without a singleton,
            // we will simulate calling the tool handler logic if exported, OR we rely on the fact that tools are handlers.
            // Is `set_autonomy` a standard tool? No, it's internal.
            // Quick fix: We need a way to message the running server.
            // If running in same process (which it IS for `pnpm start`), we can maybe export a singleton.
            // USE GLOBAL singleton for now to bridge tRPC -> MCPServer instance.

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
        const { TerminalTools } = await import('./tools/TerminalTools.js');
        // @ts-ignore
        const result = await TerminalTools[0].handler({ command: input.command, cwd: process.cwd() });
        return result.content[0].text;
    })
});

export type AppRouter = typeof appRouter;
