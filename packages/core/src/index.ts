
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc.js';
import { MCPServer } from './MCPServer.js';

export { MCPServer } from './MCPServer.js';
export type { AppRouter } from './trpc.js';

export const name = "@borg/core";

export async function startOrchestrator() {
    console.log(`Initializing ${name}...`);

    // 1. Start tRPC Server (Dashboard API)
    const app = express();
    app.use(cors());
    app.use(
        '/trpc',
        createExpressMiddleware({
            router: appRouter,
            createContext: () => ({}),
        })
    );

    const TRPC_PORT = 4000;
    app.listen(TRPC_PORT, () => {
        console.log(`tRPC Server running at http://localhost:${TRPC_PORT}/trpc`);
    });

    // 2. Start MCP Server (Bridged: Stdio + WebSocket)
    try {
        const mcp = new MCPServer();
        await mcp.start();

        // Auto-Start the Director in Auto-Drive Mode (High Autonomy)
        console.log("Starting Director in Auto-Drive Mode...");
        // We use a small delay to ensure connections are ready
        setTimeout(() => {
            mcp.executeTool('start_auto_drive', {}).catch(e => console.error("Failed to auto-start Director:", e));
        }, 3000);

    } catch (err) {
        console.error("Failed to start MCP server:", err);
        throw err;
    }
}
