import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { McpProxyManager } from '../managers/McpProxyManager.js';
import { CodeExecutionManager } from '../managers/CodeExecutionManager.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export class HubServer {
    private server: Server;
    private transports = new Map<string, SSEServerTransport>();

    constructor(
        private proxyManager: McpProxyManager,
        private codeManager: CodeExecutionManager
    ) {
        this.server = new Server({
            name: "SuperAI-Hub",
            version: "1.0.0"
        }, {
            capabilities: {
                tools: {}
            }
        });

        this.setupHandlers();
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            const tools = await this.proxyManager.listTools();
            // Add meta tools
            const metaTools = [
                {
                    name: 'search_tools',
                    description: 'Search available tools',
                    inputSchema: { type: 'object', properties: { query: { type: 'string' } } }
                },
                {
                    name: "run_code",
                    description: "Execute TypeScript code in a secure sandbox.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            code: { type: "string", description: "The code to execute" }
                        },
                        required: ["code"]
                    }
                }
            ];
            return { tools: [...metaTools, ...tools] };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            if (name === 'search_tools') {
                const query = String(args?.query || '');
                // Ensure index is up to date
                await this.proxyManager.listTools();
                const results = this.proxyManager.searchTools(query);
                return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
            }

            if (name === 'run_code') {
                const code = String(args?.code);
                const result = await this.codeManager.execute(code, async (toolName, toolArgs) => {
                    // Sandbox calling back into Hub tools
                    // We route this back through the ProxyManager
                    const res = await this.proxyManager.callTool(toolName, toolArgs);
                    // Extract text content for the sandbox
                    // This is a simplification; handling errors/images needs more logic
                    const firstItem = res.content?.[0];
                    const errorMessage = (firstItem && firstItem.type === 'text') ? firstItem.text : "Tool Error";

                    if (res.isError) throw new Error(errorMessage);

                    return (firstItem && firstItem.type === 'text') ? firstItem.text : JSON.stringify(res.content);
                });
                return { content: [{ type: 'text', text: result }] };
            }

            return await this.proxyManager.callTool(name, args);
        });
    }

    async connect(transport: Transport) {
        await this.server.connect(transport);
    }

    async handleSSE(req: any, res: any) {
        const transport = new SSEServerTransport('/api/hub/messages', res);
        this.transports.set(transport.sessionId, transport);

        transport.onclose = () => {
            this.transports.delete(transport.sessionId);
        };

        await this.server.connect(transport);
    }

    async handleMessage(sessionId: string, message: any, res: any) {
        const transport = this.transports.get(sessionId);
        if (!transport) {
            res.statusCode = 404;
            res.end('Session not found');
            return;
        }
        // Since Fastify already parsed the body, we can manually inject the message
        // However, SSEServerTransport doesn't expose handleMessage in the public type defs easily in all versions?
        // It extends ServerTransport which usually expects handleMessage.
        // Let's check if we can call it.

        try {
            await transport.handleMessage(message);
            res.statusCode = 200;
            res.end('ok');
        } catch (e: any) {
            console.error('Error handling message:', e);
            res.statusCode = 500;
            res.end(e.message);
        }
    }
}
