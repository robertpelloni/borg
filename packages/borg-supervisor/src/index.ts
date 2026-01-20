import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Installer } from './installer.js';
import { ProcessManager } from './process_manager.js';
import { InputManager } from './input_manager.js';

class SupervisorServer {
    private server: Server;
    private processManager: ProcessManager;
    private inputManager: InputManager;

    constructor() {
        this.processManager = new ProcessManager();
        this.inputManager = new InputManager();
        this.server = new Server(
            {
                name: "borg-supervisor",
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
                        name: "install_supervisor",
                        description: "Install Borg Supervisor into Antigravity MCP Config",
                        inputSchema: {
                            type: "object",
                            properties: {
                                configPath: {
                                    type: "string",
                                    description: "Abs path to mcp.json"
                                }
                            }
                        }
                    },
                    {
                        name: "list_processes",
                        description: "List active system processes",
                        inputSchema: { type: "object", properties: {} }
                    },
                    {
                        name: "kill_process",
                        description: "Kill a process by PID",
                        inputSchema: {
                            type: "object",
                            properties: {
                                pid: { type: "number", description: "Process ID" }
                            },
                            required: ["pid"]
                        }
                    },
                    {
                        name: "simulate_input",
                        description: "Send keyboard input (PowerShell SendKeys)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                keys: {
                                    type: "string",
                                    description: "Keys to send (e.g. 'ctrl+r', 'f5')"
                                }
                            },
                            required: ["keys"]
                        }
                    }
                ]
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name === "install_supervisor") {
                const configPath = request.params.arguments?.configPath as string | undefined;
                const installer = new Installer(configPath);
                const result = await installer.install();
                return {
                    content: [{ type: "text", text: result }]
                };
            }

            if (request.params.name === "list_processes") {
                const processes = await this.processManager.listProcesses();
                return {
                    content: [{ type: "text", text: JSON.stringify(processes, null, 2) }]
                };
            }

            if (request.params.name === "kill_process") {
                const pid = request.params.arguments?.pid as number;
                const result = await this.processManager.killProcess(pid);
                return {
                    content: [{ type: "text", text: result }]
                };
            }

            if (request.params.name === "simulate_input") {
                const keys = request.params.arguments?.keys as string;
                const result = await this.inputManager.sendKeys(keys);
                return {
                    content: [{ type: "text", text: result }]
                };
            }

            throw new Error(`Tool ${request.params.name} not found`);
        });
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Borg Supervisor running on Stdio");
    }
}

const server = new SupervisorServer();
server.start().catch(console.error);
