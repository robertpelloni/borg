import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { CodeExecutionManager } from "../managers/CodeExecutionManager.js";

export class McpInterface {
    private server: Server;
    private codeManager: CodeExecutionManager;

    constructor() {
        this.codeManager = new CodeExecutionManager();

        this.server = new Server(
            {
                name: "super-ai-plugin",
                version: "0.1.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupHandlers();
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "run_code",
                        description: "Execute TypeScript code in a secure sandbox. Use this to chain multiple tool calls efficiently.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                code: {
                                    type: "string",
                                    description: "The TypeScript code to execute.",
                                },
                            },
                            required: ["code"],
                        },
                    },
                ],
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name === "run_code") {
                const code = String(request.params.arguments?.code);
                // Here we pass a callback that allows the sandbox to call back into THIS server's tools?
                // Or rather, the sandbox needs to call EXTERNAL tools (from McpManager).
                // For now, let's just log it.

                const result = await this.codeManager.execute(code, async (toolName, args) => {
                    // TODO: Connect this to McpManager to call downstream tools
                    return { status: "mock_success", toolName, args };
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: result,
                        },
                    ],
                };
            }
            throw new Error("Tool not found");
        });
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Super AI Plugin MCP Server running on stdio");
    }
}
