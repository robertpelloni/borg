
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from 'url';
import path from 'path';
import { Router } from "./Router.js";
import { ModelSelector } from './ModelSelector.js';
import { WebSocketServer } from 'ws';
import { WebSocketServerTransport } from './transports/WebSocketServerTransport.js';
import http from 'http';
import { SkillRegistry } from "./skills/SkillRegistry.js";
import { FileSystemTools } from "./tools/FileSystemTools.js";
import { TerminalTools } from "./tools/TerminalTools.js";
import { MemoryTools } from "./tools/MemoryTools.js";
import { TunnelTools } from "./tools/TunnelTools.js";
import { ConfigTools } from "./tools/ConfigTools.js";
import { LogTools } from "./tools/LogTools.js";
import { SearchTools } from "./tools/SearchTools.js";
import { Director } from "./agents/Director.js";
import { Council } from "./agents/Council.js";
import { PermissionManager, AutonomyLevel } from "./security/PermissionManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MCPServer {
    private server: Server; // Stdio Server
    private wsServer: Server; // WebSocket Server
    private router: Router;
    private modelSelector: ModelSelector;
    private skillRegistry: SkillRegistry;
    private director: Director;
    private council: Council;
    private permissionManager: PermissionManager;
    private pendingRequests: Map<string, (response: any) => void> = new Map();
    public wssInstance: any; // WebSocket.Server

    constructor() {
        this.router = new Router();
        this.modelSelector = new ModelSelector();
        this.skillRegistry = new SkillRegistry([
            path.join(process.cwd(), '.borg', 'skills'),
            path.join(process.env.HOME || process.env.USERPROFILE || '', '.borg', 'skills')
        ]);
        this.director = new Director(this.router, this.modelSelector);
        this.council = new Council(this.modelSelector);
        this.permissionManager = new PermissionManager('low'); // Default safety

        // @ts-ignore
        global.mcpServerInstance = this;

        // Standard Server (Stdio)
        this.server = this.createServerInstance();

        // WebSocket Server (Extension Bridge)
        this.wsServer = this.createServerInstance();
    }

    private createServerInstance(): Server {
        const s = new Server(
            { name: "borg-core", version: "0.1.0" },
            { capabilities: { tools: {} } }
        );
        this.setupHandlers(s);
        return s;
    }

    private setupHandlers(serverInstance: Server) {
        serverInstance.setRequestHandler(ListToolsRequestSchema, async () => {
            const internalTools = [
                {
                    name: "router_status",
                    description: "Check the status of the Borg Router",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "start_task",
                    description: "Start an autonomous task with the Director Agent",
                    inputSchema: {
                        type: "object",
                        properties: {
                            goal: { type: "string" },
                            maxSteps: { type: "number" }
                        },
                        required: ["goal"]
                    }
                },
                {
                    name: "set_autonomy",
                    description: "Set the autonomy level (low, medium, high)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            level: { type: "string", enum: ["low", "medium", "high"] }
                        },
                        required: ["level"]
                    }
                },
                {
                    name: "chat_reply",
                    description: "Insert text into the active browser chat (Web Bridge)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            text: { type: "string" }
                        },
                        required: ["text"]
                    }
                },
                {
                    name: "chat_submit",
                    description: "Simulate pressing Enter in the chat input",
                    inputSchema: { type: "object", properties: {} }
                },
                {
                    name: "click_element",
                    description: "Click a button or link on the page by identifying text",
                    inputSchema: {
                        type: "object",
                        properties: {
                            target: { type: "string", description: "Text content of the button/link to click" }
                        },
                        required: ["target"]
                    }
                },
                {
                    name: "native_input",
                    description: "Simulate global keyboard input (for Native Apps/IDE)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            keys: { type: "string", description: "Keys: enter, esc, ctrl+r, f5, etc." }
                        },
                        required: ["keys"]
                    }
                },
                {
                    name: "vscode_execute_command",
                    description: "Execute a VS Code command via the installed extension",
                    inputSchema: {
                        type: "object",
                        properties: {
                            command: { type: "string", description: "Command ID (e.g. workbench.action.files.save)" },
                            args: { type: "array", description: "Optional arguments", items: { type: "string" } }
                        },
                        required: ["command"]
                    }
                },
                {
                    name: "vscode_get_status",
                    description: "Get the current status of the VS Code editor (Active File, Terminal, etc.)",
                    inputSchema: { type: "object", properties: {} }
                },
                {
                    name: "vscode_read_selection",
                    description: "Read the currently selected text or the entire active document from VS Code",
                    inputSchema: { type: "object", properties: {} }
                },
                {
                    name: "vscode_read_terminal",
                    description: "Read the content of the active terminal (Uses Clipboard: SelectAll -> Copy)",
                    inputSchema: { type: "object", properties: {} }
                }
            ];

            // Standard Library Tools
            const standardTools = [...FileSystemTools, ...TerminalTools, ...MemoryTools, ...TunnelTools, ...LogTools, ...ConfigTools, ...SearchTools].map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema
            }));

            // Skills
            const skillTools = this.skillRegistry.getSkillTools();

            // Aggregation: Fetch tools from all connected sub-MCPs
            const externalTools = await this.router.listTools();

            return {
                tools: [
                    ...internalTools,
                    ...standardTools,
                    ...skillTools,
                    ...externalTools
                ],
            };
        });

        serverInstance.setRequestHandler(CallToolRequestSchema, async (request) => {
            // 0. Permission Check
            const isApproved = this.permissionManager.checkPermission(request.params.name, request.params.arguments);
            if (!isApproved) {
                // In a real TUI/GUI, this would effectively be "Pending Approval".
                // For now, we hard fail so the user knows they must authorize.
                throw new Error(`Permission Denied for tool '${request.params.name}'. Autonomy Level is too low. Use set_autonomy('high') to bypass.`);
            }

            // 1. Internal Status / Config Tools
            if (request.params.name === "router_status") {
                return {
                    content: [{ type: "text", text: "Borg Router is active." }],
                };
            }

            if (request.params.name === "set_autonomy") {
                const level = request.params.arguments?.level as AutonomyLevel;
                this.permissionManager.setAutonomyLevel(level);
                return {
                    content: [{ type: "text", text: `Autonomy Level set to: ${level}` }]
                };
            }

            if (request.params.name === "chat_reply") {
                const text = request.params.arguments?.text as string;
                // Broadcast to all connected WebSocket clients (Extensions)
                // We need access to wsServer clients.
                // Quick hack: Use a broadcast method if available or iterate.
                // WebSocketServer in `ws` library has `clients`.
                // Accessing private wsServer... we need to change it to public or add a method.
                // Assuming `this.wsServer` is the `ws.WebSocketServer` instance inside `WebSocketServerTransport`? 
                // Wait, `this.wsServer` is `Server` (MCP SDK), NOT `ws.Server`.
                // Look at lines 31: `private wsServer: Server; // WebSocket Server`.
                // Actually, line 159 `const wss = new WebSocketServer` is local to start().
                // We need to store `wss` on the class.

                // CRITICAL FIX: We need to emit an event or access the WSS.
                // Simple approach for now: We can't easily reach into the closure.
                // We will skip actual implementation for this step and just log it, 
                // OR refactor start() to save wss. 
                // Let's refactor start() in next step. For now, return success.
                console.log(`[Borg Core] Chat Reply Requested: ${text}`);

                if (this.wssInstance) {
                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) { // OPEN
                            client.send(JSON.stringify({
                                type: 'INSERT_TEXT',
                                text: text
                            }));
                        }
                    });
                    return {
                        content: [{ type: "text", text: `Sent to browser: "${text}"` }]
                    };
                }

                return {
                    content: [{ type: "text", text: "Error: No WebSocket server active to forward reply." }]
                };
            }

            if (request.params.name === "chat_submit") {
                if (this.wssInstance) {
                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) client.send(JSON.stringify({ type: 'SUBMIT_CHAT' }));
                    });
                    return { content: [{ type: "text", text: "Sent SUBMIT_CHAT signal." }] };
                }
                return { content: [{ type: "text", text: "Error: No WebSocket server." }] };
            }

            if (request.params.name === "click_element") {
                const target = request.params.arguments?.target as string;
                if (this.wssInstance) {
                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) client.send(JSON.stringify({ type: 'CLICK_ELEMENT', target }));
                    });
                    return { content: [{ type: "text", text: `Sent CLICK_ELEMENT signal for "${target}".` }] };
                }
                return { content: [{ type: "text", text: "Error: No WebSocket server." }] };
            }

            if (request.params.name === "native_input") {
                const keys = request.params.arguments?.keys as string;
                // Try to find the tool in standard router
                try {
                    return await this.router.callTool("simulate_input", { keys });
                } catch (e) {
                    return { content: [{ type: "text", text: "Error: Supervisor (simulate_input) not available. Is borg-supervisor running?" }] };
                }
            }

            if (request.params.name === "vscode_execute_command") {
                const command = request.params.arguments?.command as string;
                const args = request.params.arguments?.args as any[] || [];

                if (this.wssInstance) {
                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) {
                            client.send(JSON.stringify({
                                type: 'VSCODE_COMMAND',
                                command,
                                args
                            }));
                        }
                    });
                    return { content: [{ type: "text", text: `Sent VSCODE_COMMAND: ${command}` }] };
                }
                return { content: [{ type: "text", text: "Error: No WebSocket server (Extension bridge) active." }] };
            }

            if (request.params.name === "vscode_get_status") {
                if (!this.wssInstance || this.wssInstance.clients.size === 0) {
                    return { content: [{ type: "text", text: "Error: No Native Extension connected." }] };
                }

                return new Promise((resolve) => {
                    const requestId = `req_${Date.now()}_${Math.random()}`;

                    // Timeout safety
                    const timeout = setTimeout(() => {
                        this.pendingRequests.delete(requestId);
                        resolve({ content: [{ type: "text", text: "Error: Extension timed out." }] });
                    }, 3000);

                    this.pendingRequests.set(requestId, (status: any) => {
                        clearTimeout(timeout);
                        resolve({ content: [{ type: "text", text: JSON.stringify(status, null, 2) }] });
                    });

                    // Broadcast request (assuming one main editor connected)
                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) {
                            client.send(JSON.stringify({ type: 'GET_STATUS', requestId }));
                        }
                    });
                });
            }

            if (request.params.name === "vscode_read_selection") {
                if (!this.wssInstance || this.wssInstance.clients.size === 0) {
                    return { content: [{ type: "text", text: "Error: No Native Extension connected." }] };
                }

                return new Promise((resolve) => {
                    const requestId = `req_${Date.now()}_${Math.random()}`;
                    const timeout = setTimeout(() => {
                        this.pendingRequests.delete(requestId);
                        resolve({ content: [{ type: "text", text: "Error: Extension timed out." }] });
                    }, 3000);

                    this.pendingRequests.set(requestId, (data: any) => {
                        clearTimeout(timeout);
                        resolve({ content: [{ type: "text", text: data.content || "No content." }] });
                    });

                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) {
                            client.send(JSON.stringify({ type: 'GET_SELECTION', requestId }));
                        }
                    });
                });
            }

            if (request.params.name === "vscode_read_terminal") {
                if (!this.wssInstance || this.wssInstance.clients.size === 0) {
                    return { content: [{ type: "text", text: "Error: No Native Extension connected." }] };
                }

                return new Promise((resolve) => {
                    const requestId = `req_${Date.now()}_${Math.random()}`;
                    const timeout = setTimeout(() => {
                        this.pendingRequests.delete(requestId);
                        resolve({ content: [{ type: "text", text: "Error: Extension timed out." }] });
                    }, 5000); // Higher timeout for UI interactions

                    this.pendingRequests.set(requestId, (data: any) => {
                        clearTimeout(timeout);
                        resolve({ content: [{ type: "text", text: data.content || "No content." }] });
                    });

                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) {
                            client.send(JSON.stringify({ type: 'GET_TERMINAL', requestId }));
                        }
                    });
                });
            }

            if (request.params.name === "start_task") {
                const goal = request.params.arguments?.goal as string;
                const maxSteps = request.params.arguments?.maxSteps as number || 10;
                const result = await this.director.executeTask(goal, maxSteps);
                return {
                    content: [{ type: "text", text: result }]
                };
            }

            // 2. Check Standard Library
            const standardTool = [...FileSystemTools, ...TerminalTools, ...MemoryTools, ...TunnelTools, ...LogTools, ...ConfigTools, ...SearchTools].find(t => t.name === request.params.name);
            if (standardTool) {
                // @ts-ignore
                return standardTool.handler(request.params.arguments);
            }

            // 3. Check Skills
            if (request.params.name === "list_skills") {
                return this.skillRegistry.listSkills();
            }
            if (request.params.name === "read_skill") {
                return this.skillRegistry.readSkill(request.params.arguments?.skillName as string);
            }

            // 4. Delegation: Forward to sub-MCPs via Router
            try {
                return await this.router.callTool(request.params.name, request.params.arguments);
            } catch (e: any) {
                throw new Error(`Tool execution failed: ${e.message}`);
            }
        });
    }

    async start() {
        // Initialize systems
        await this.skillRegistry.loadSkills();

        // 1. Start Stdio (for local CLI usage)
        const stdioTransport = new StdioServerTransport();
        await this.server.connect(stdioTransport);
        console.error("Borg Core: Stdio Transport Active");

        // 2. Start WebSocket (for Extension/Web usage)
        const PORT = 3001;
        const httpServer = http.createServer();
        const wss = new WebSocketServer({ server: httpServer });
        this.wssInstance = wss;
        const wsTransport = new WebSocketServerTransport(wss);

        httpServer.listen(PORT, () => {
            console.error(`Borg Core: WebSocket Transport Active on ws://localhost:${PORT}`);
        });

        // 2.5 Setup WS Message Handling mechanism
        wss.on('connection', (ws: any) => {
            ws.on('message', (data: any) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'STATUS_UPDATE' && msg.requestId) {
                        const resolve = this.pendingRequests.get(msg.requestId);
                        if (resolve) {
                            resolve(msg.status);
                            this.pendingRequests.delete(msg.requestId);
                        }
                    }
                } catch (e) {
                    // Ignore non-JSON
                }
            });
        });

        // 3. Connect to Supervisor (Native Automation)
        // We assume we are running from the monorepo root
        const supervisorPath = path.resolve(process.cwd(), 'packages/borg-supervisor/dist/index.js');

        try {
            // Check if file exists first? Router will fail if node can't find it.
            // As this is "Execution", we want to be robust.
            // But we assume monorepo structure:
            // root/packages/core
            // root/packages/borg-supervisor
            // CWD is packages/core usually.

            // Actually, best to use absolute path based on __dirname source knowledge or relative to CWD
            // If CWD is `packages/core`
            await this.router.connectToServer('borg-supervisor', 'node', [supervisorPath]);
            console.error(`Borg Core: Connected to Supervisor at ${supervisorPath}`);
        } catch (e) {
            console.error("Borg Core: Failed to connect to Supervisor. Native automation disabled.", e);
        }

        await this.wsServer.connect(wsTransport);
    }
}
