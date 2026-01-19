
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

export const t = initTRPC.create();

export const appRouter = t.router({
    health: t.procedure.query(() => {
        return { status: 'running', service: '@aios/core' };
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
});

export type AppRouter = typeof appRouter;
