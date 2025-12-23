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
                    },
                    required: ["message"]
                }
            },
            {
                name: "error_test",
                description: "Tool for testing error handling",
                inputSchema: {
                    type: "object",
                    properties: {
                        error_type: { 
                            type: "string",
                            enum: ["validation", "runtime", "custom"]
                        }
                    }
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    if (name === "echo") {
        // Test missing arguments
        if (!args?.message) {
            throw new Error("Missing required argument: message");
        }
        return {
            content: [
                {
                    type: "text",
                    text: `Echo: ${args.message}`
                }
            ]
        };
    }
    
    if (name === "error_test") {
        const errorType = args?.error_type || "runtime";
        
        switch (errorType) {
            case "validation":
                throw new Error("Validation error: Invalid input format");
            case "runtime":
                throw new Error("Runtime error: Simulated failure during execution");
            case "custom":
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: Custom error message for testing"
                        }
                    ],
                    isError: true
                };
            default:
                throw new Error(`Unknown error type: ${errorType}`);
        }
    }
    
    // Test invalid tool name
    throw new Error(`Tool not found: ${name}`);
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
