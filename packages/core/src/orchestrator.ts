
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc.js';
import { MCPServer } from './MCPServer.js';

export const name = "@borg/core";

export async function startOrchestrator() {
    console.log(`[Core] Initializing ${name}...`);

    console.log("[Core] 1. Starting Express/tRPC...");
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
        console.log(`[Core] tRPC Server running at http://localhost:${TRPC_PORT}/trpc`);
    });

    // 2. Start MCP Server (Bridged: Stdio + WebSocket)
    try {
        console.log("[Core] 2. Instantiating MCPServer...");
        const mcp = new MCPServer();

        console.log("[Core] 3. Starting MCPServer...");
        await mcp.start();
        console.log("[Core] MCPServer Started.");

        // Auto-Start the Director in Auto-Drive Mode (High Autonomy)
        console.log("[Core] 4. Scheduling Auto-Drive...");
        // We use a small delay to ensure connections are ready
        setTimeout(() => {
            console.log("[Core] Triggering Auto-Drive Tool...");
            mcp.executeTool('start_auto_drive', {}).catch(e => console.error("Failed to auto-start Director:", e));
        }, 3000);

    } catch (err) {
        console.error("Failed to start MCP server:", err);
        throw err;
    }
}
