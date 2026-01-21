
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
    })
});

export type AppRouter = typeof appRouter;
