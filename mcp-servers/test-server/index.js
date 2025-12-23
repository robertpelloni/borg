import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
    name: "test-server",
    version: "1.0.0"
}, {
    capabilities: {
        tools: {}
    }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "echo",
                description: "Echoes back the input",
                inputSchema: {
                    type: "object",
                    properties: {
                        message: { type: "string" }
                    }
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === "echo") {
        return {
            content: [
                {
                    type: "text",
                    text: `Echo: ${args?.message}`
                }
            ]
        };
    }
    throw new Error("Tool not found");
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.log('Mock MCP Server Started');

// Keep the process alive to simulate a long-running server
const interval = setInterval(() => {
  // Heartbeat or no-op
}, 5000);

// distinct message to indicate readiness if needed
console.log('Test Server Running...');

// Graceful shutdown on SIGTERM/SIGINT
const shutdown = () => {
    clearInterval(interval);
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
