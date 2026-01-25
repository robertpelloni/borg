

console.log("[MCPServer] Starting imports...");
import './debug_marker.js';

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
console.log("[MCPServer] ✓ @modelcontextprotocol/sdk");

import { fileURLToPath } from 'url';
import path from 'path';
console.log("[MCPServer] ✓ path/url");

import { Router } from "./Router.js";
console.log("[MCPServer] ✓ Router");

import { ModelSelector } from "@borg/ai";
console.log("[MCPServer] ✓ ModelSelector");

import { WebSocketServer } from 'ws';
import { WebSocketServerTransport } from './transports/WebSocketServerTransport.js';
import http from 'http';
console.log("[MCPServer] ✓ ws/http");

import { SkillRegistry } from "./skills/SkillRegistry.js";
console.log("[MCPServer] ✓ SkillRegistry");

import {
    FileSystemTools,
    TerminalTools,
    MemoryTools,
    TunnelTools,
    ConfigTools,
    LogTools,
    SearchTools,
    ReaderTools,
    InputTools,
    ChainExecutor,
    type ChainRequest
} from "@borg/tools";
console.log("[MCPServer] ✓ All Tools & ChainExecutor");

import { Director } from "@borg/agents";
// @ts-ignore
import { Council } from "@borg/agents";
console.log("[MCPServer] ✓ Council");

import { PermissionManager, AutonomyLevel } from "./security/PermissionManager.js";
console.log("[MCPServer] ✓ PermissionManager");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// LAZY: VectorStore and Indexer are imported dynamically when needed
// import { VectorStore } from './memory/VectorStore.js';
// import { Indexer } from './memory/Indexer.js';
console.log("[MCPServer] All imports complete!");

export class MCPServer {
    private server: Server; // Stdio Server
    private wsServer: Server; // WebSocket Server
    private router: Router;
    public modelSelector: ModelSelector;
    private skillRegistry: SkillRegistry;
    private director: Director;
    private council: Council;
    public permissionManager: PermissionManager;
    private vectorStore: any; // Lazy loaded
    private indexer: any; // Lazy loaded
    private memoryInitialized: boolean = false;
    private pendingRequests: Map<string, (response: any) => void> = new Map();
    private chainExecutor: ChainExecutor;
    public wssInstance: any; // WebSocket.Server
    private inputTools: InputTools;
    public lastUserActivityTime: number = 0;
    public directorConfig = {
        taskCooldownMs: 10000,
        heartbeatIntervalMs: 30000,
        periodicSummaryMs: 120000,
        pasteToSubmitDelayMs: 1000,
        acceptDetectionMode: 'polling' as const, // Polling is robust!
        pollingIntervalMs: 30000,
        council: {
            personas: ['Architect', 'Product', 'Critic'],
            contextFiles: ['README.md', 'docs/ROADMAP.md']
        }
    };

    constructor(options: { skipWebsocket?: boolean } = {}) {
        this.router = new Router();
        this.modelSelector = new ModelSelector();
        this.skillRegistry = new SkillRegistry([
            path.join(process.cwd(), '.borg', 'skills'),
            path.join(process.env.HOME || process.env.USERPROFILE || '', '.borg', 'skills')
        ]);
        this.director = new Director(this);
        this.council = new Council(this.modelSelector);
        this.permissionManager = new PermissionManager('high'); // Default to HIGH AUTONOMY as requested
        this.chainExecutor = new ChainExecutor(this);
        this.inputTools = new InputTools();

        // Memory System - LAZY LOADED on first use to speed up startup
        // VectorStore and Indexer are created in initializeMemorySystem()
        this.vectorStore = null;
        this.indexer = null;

        // @ts-ignore
        global.mcpServerInstance = this;

        // Standard Server (Stdio)
        this.server = this.createServerInstance();

        // BOOTSTRAP: Start Auto-Drive immediately for true autonomy
        console.error("[MCPServer] 🕒 Scheduling Auto-Drive Start in 5s..."); // DEBUG
        setTimeout(async () => {
            console.error("[MCPServer] 🚀 Bootstrapping Auto-Drive NOW... BEEP!");
            import('fs').then(fs => fs.writeFileSync('.borg_boot_check', 'BOOTED ' + Date.now())).catch(() => { }); // FS Marker
            try {
                // @ts-ignore
                const { exec } = await import('child_process');
                exec('powershell -c [console]::beep(1000, 500)');
            } catch (e) { }
            this.director.startAutoDrive().catch(e => console.error("Auto-Drive Boot Failed:", e));
        }, 5000); // Wait 5s for connections to settle

        // WebSocket Server (Extension Bridge)
        if (!options.skipWebsocket) {
            this.wsServer = this.createServerInstance();
        } else {
            // @ts-ignore
            this.wsServer = null;
        }
    }

    /**
     * Lazy initialization of memory system (VectorStore + Indexer)
     * Only loaded when memory tools are first used to speed up startup
     */
    private async initializeMemorySystem() {
        if (this.memoryInitialized) return;

        console.log("[MCPServer] Lazy-loading memory system...");
        const startTime = Date.now();

        // Dynamic imports to avoid loading heavy deps at startup
        const { VectorStore, Indexer } = await import('@borg/memory');

        const dbPath = path.join(process.cwd(), '.borg', 'db');
        this.vectorStore = new VectorStore(dbPath);
        this.indexer = new Indexer(this.vectorStore);
        this.memoryInitialized = true;

        console.log(`[MCPServer] Memory system loaded in ${Date.now() - startTime}ms`);
    }

    private createServerInstance(): Server {
        const s = new Server(
            { name: "borg-core", version: "0.1.0" },
            { capabilities: { tools: {} } }
        );
        this.setupHandlers(s);
        return s;
    }

    private broadcastRequestAndAwait(messageType: string, payload: any = {}): Promise<any> {
        if (!this.wssInstance || this.wssInstance.clients.size === 0) {
            return Promise.resolve({ content: [{ type: "text", text: "Error: No Native Extension connected." }] });
        }

        return new Promise((resolve) => {
            const requestId = `req_${Date.now()}_${Math.random()}`;
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                resolve({ content: [{ type: "text", text: "Error: Extension timed out." }] });
            }, 3000);

            this.pendingRequests.set(requestId, (data: any) => {
                clearTimeout(timeout);
                // Handle text vs object response
                const text = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
                resolve({ content: [{ type: "text", text: text || "No content." }] });
            });

            this.wssInstance.clients.forEach((client: any) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: messageType, requestId, ...payload }));
                }
            });
        });
    }

    public async executeTool(name: string, args: any): Promise<any> {
        const callId = Math.random().toString(36).substring(7);
        const startTime = Date.now();

        // Broadcast Start
        if (this.wssInstance) {
            this.wssInstance.clients.forEach((c: any) => {
                if (c.readyState === 1) c.send(JSON.stringify({
                    type: 'TOOL_CALL_START',
                    id: callId,
                    tool: name,
                    args: args
                }));
            });
        }

        try {
            // 0. Permission Check
            const permission = this.permissionManager.checkPermission(name, args);

            if (permission === 'DENIED') {
                throw new Error(`Permission Denied for tool '${name}' (Risk Level High). Autonomy Level is '${this.permissionManager.autonomyLevel}'.`);
            }

            if (permission === 'NEEDS_CONSULTATION') {
                console.log(`[Borg Core] Consulting Council for: ${name}`);
                const debate = await this.council.startDebate(`Execute tool '${name}' with args: ${JSON.stringify(args)}`);

                if (!debate.approved) {
                    throw new Error(`Council Denied Execution: ${debate.summary}`);
                }
                console.log(`[Borg Core] Council Approved: ${debate.summary}`);
            }

            // 1. Internal Status / Config Tools
            let result;
            if (name === "router_status") {
                result = {
                    content: [{ type: "text", text: "Borg Router is active." }],
                };
            }
            else if (name === "set_autonomy") {
                const level = args?.level as AutonomyLevel;
                this.permissionManager.setAutonomyLevel(level);
                result = {
                    content: [{ type: "text", text: `Autonomy Level set to: ${level}` }]
                };
            }
            else if (name === "chat_reply") {
                const text = args?.text as string;
                const submit = args?.submit as boolean ?? true; // Default to auto-submit
                console.log(`[Borg Core] Chat Reply Requested: ${text} (submit: ${submit})`);

                if (this.wssInstance) {
                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) { // OPEN
                            client.send(JSON.stringify({
                                type: 'PASTE_INTO_CHAT',
                                text: text,
                                submit: submit // Include submit flag for atomic paste+submit
                            }));
                        }
                    });
                    result = {
                        content: [{ type: "text", text: `Sent to browser/IDE: "${text}" (submit: ${submit})` }]
                    };
                } else {
                    result = {
                        content: [{ type: "text", text: "Error: No WebSocket server active to forward reply." }]
                    };
                }
            }
            else if (name === "chat_submit") {
                if (this.wssInstance) {
                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) client.send(JSON.stringify({ type: 'SUBMIT_CHAT' }));
                    });
                    result = { content: [{ type: "text", text: "Sent SUBMIT_CHAT signal." }] };
                } else {
                    result = { content: [{ type: "text", text: "Error: No WebSocket server." }] };
                }
            }
            else if (name === "click_element") {
                const target = args?.target as string;
                if (this.wssInstance) {
                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) client.send(JSON.stringify({ type: 'CLICK_ELEMENT', target }));
                    });
                    result = { content: [{ type: "text", text: `Sent CLICK_ELEMENT signal for "${target}".` }] };
                } else {
                    result = { content: [{ type: "text", text: "Error: No WebSocket server." }] };
                }
            }
            else if (name === "native_input") {
                const keys = args?.keys as string;
                // Use Direct InputTools. DON'T FORCE FOCUS by default (let it hit active terminal)
                try {
                    const status = await this.inputTools.sendKeys(keys, false);
                    result = { content: [{ type: "text", text: status }] };
                } catch (e: any) {
                    result = { content: [{ type: "text", text: `Error executing native_input: ${e.message}` }] };
                }
            }
            else if (name === "vscode_execute_command") {
                const command = args?.command as string;
                const cmdArgs = args?.args as any[] || [];

                if (this.wssInstance) {
                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) {
                            client.send(JSON.stringify({
                                type: 'VSCODE_COMMAND',
                                command,
                                args: cmdArgs
                            }));
                        }
                    });
                    result = { content: [{ type: "text", text: `Sent VSCODE_COMMAND: ${command}` }] };
                } else {
                    result = { content: [{ type: "text", text: "Error: No WebSocket server (Extension bridge) active." }] };
                }
            }
            else if (name === "vscode_get_status") {
                if (!this.wssInstance || this.wssInstance.clients.size === 0) {
                    result = { content: [{ type: "text", text: "Error: No Native Extension connected." }] };
                } else {
                    result = await new Promise((resolve) => {
                        const requestId = `req_${Date.now()}_${Math.random()}`;
                        const timeout = setTimeout(() => {
                            this.pendingRequests.delete(requestId);
                            resolve({ content: [{ type: "text", text: "Error: Extension timed out." }] });
                        }, 3000);

                        this.pendingRequests.set(requestId, (status: any) => {
                            clearTimeout(timeout);
                            resolve({ content: [{ type: "text", text: JSON.stringify(status, null, 2) }] });
                        });

                        this.wssInstance.clients.forEach((client: any) => {
                            if (client.readyState === 1) {
                                client.send(JSON.stringify({ type: 'GET_STATUS', requestId }));
                            }
                        });
                    });
                }
            }
            else if (name === "vscode_read_selection") {
                if (!this.wssInstance || this.wssInstance.clients.size === 0) {
                    result = { content: [{ type: "text", text: "Error: No Native Extension connected." }] };
                } else {
                    result = await new Promise((resolve) => {
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
            }
            else if (name === "vscode_read_terminal") {
                if (!this.wssInstance || this.wssInstance.clients.size === 0) {
                    result = { content: [{ type: "text", text: "Error: No Native Extension connected." }] };
                } else {
                    result = await new Promise((resolve) => {
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
            }
            else if (name === "vscode_get_notifications") {
                result = await this.broadcastRequestAndAwait('GET_NOTIFICATIONS');
            }
            else if (name === "vscode_submit_chat") {
                if (this.wssInstance) {
                    this.wssInstance.clients.forEach((client: any) => {
                        if (client.readyState === 1) client.send(JSON.stringify({ type: 'SUBMIT_CHAT_HOOK' }));
                    });
                    result = { content: [{ type: "text", text: "Sent SUBMIT_CHAT_HOOK." }] };
                } else {
                    result = { content: [{ type: "text", text: "Error: No WebSocket server." }] };
                }
            }
            else if (name === "start_task") {
                const goal = args?.goal as string;
                const maxSteps = args?.maxSteps as number || 10;
                const resultStr = await this.director.executeTask(goal, maxSteps);
                result = {
                    content: [{ type: "text", text: resultStr }]
                };
            }
            // Removed obsolete start_watchdog and start_chat_daemon handlers
            else if (name === "start_auto_drive") {
                this.director.startAutoDrive();
                result = {
                    content: [{ type: "text", text: "Auto-Drive started. The Director will now proactively drive the development loop." }]
                };
            }
            else if (name === "stop_auto_drive") {
                this.director.stopAutoDrive();
                result = {
                    content: [{ type: "text", text: "Auto-Drive Stopped." }]
                };
            }
            else if (name === "list_skills") {
                result = this.skillRegistry.listSkills();
            }
            else if (name === "read_skill") {
                result = this.skillRegistry.readSkill(args?.skillName as string);
            }
            else if (name === "index_codebase") {
                await this.initializeMemorySystem(); // Lazy load memory system
                const dir = args?.path || process.cwd();
                console.log(`[Borg Core] Indexing codebase at ${dir}...`);
                const count = await this.indexer.indexDirectory(dir);
                result = {
                    content: [{ type: "text", text: `Indexed ${count} documents/chunks from ${dir}.` }]
                };
            }
            else if (name === "search_codebase") {
                await this.initializeMemorySystem(); // Lazy load memory system
                const query = args?.query as string;
                console.log(`[Borg Core] Semantic Searching for: ${query}`);
                const matches = await this.vectorStore.search(query);

                let text = `Searching for: "${query}"\n\n`;
                matches.forEach((m: any, i: number) => {
                    text += `${i + 1}. [${m.file_path}]\n${m.content.substring(0, 200)}...\n\n`;
                });

                result = {
                    content: [{ type: "text", text: text }]
                };
            }
            else if (name === "chain_tools") {
                result = {
                    content: [{ type: "text", text: JSON.stringify(await this.chainExecutor.executeChain(args as unknown as ChainRequest), null, 2) }]
                };
            }
            else {
                // Check Standard Library
                const standardTool = [...FileSystemTools, ...TerminalTools, ...MemoryTools, ...TunnelTools, ...LogTools, ...ConfigTools, ...SearchTools, ...ReaderTools].find(t => t.name === name);
                if (standardTool) {
                    // @ts-ignore
                    result = await standardTool.handler(args);
                } else {
                    // Delegation
                    try {
                        result = await this.router.callTool(name, args);
                    } catch (e: any) {
                        throw new Error(`Tool execution failed: ${e.message}`);
                    }
                }
            }

            // Broadcast Success
            if (this.wssInstance) {
                this.wssInstance.clients.forEach((c: any) => {
                    if (c.readyState === 1) c.send(JSON.stringify({
                        type: 'TOOL_CALL_END',
                        id: callId,
                        tool: name,
                        success: true,
                        duration: Date.now() - startTime,
                        result: JSON.stringify(result).substring(0, 200) // Summarize
                    }));
                });
            }
            return result;

        } catch (e: any) {
            // Broadcast Error
            if (this.wssInstance) {
                this.wssInstance.clients.forEach((c: any) => {
                    if (c.readyState === 1) c.send(JSON.stringify({
                        type: 'TOOL_CALL_END',
                        id: callId,
                        tool: name,
                        success: false,
                        duration: Date.now() - startTime,
                        result: e.message
                    }));
                });
            }
            // Return Error as Content (Don't throw, it kills the MCP stream)
            return {
                isError: true,
                content: [{ type: "text", text: `Error: ${e.message}` }]
            };
        }
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
                    name: "start_watchdog",
                    description: "Start the Supervisor Watchdog to auto-approve terminal prompts",
                    inputSchema: {
                        type: "object",
                        properties: {
                            maxCycles: { type: "number", description: "Number of 5s cycles to run (default 20)" }
                        }
                    }
                },
                {
                    name: "start_chat_daemon",
                    description: "Start the Director in Chat Daemon mode (Auto-Approves & Reads Selection)",
                    inputSchema: { type: "object", properties: {} }
                },
                {
                    name: "start_auto_drive",
                    description: "Start the Autonomous Development Loop (Reads task.md, Drives Chat, Auto-Approves)",
                    inputSchema: { type: "object", properties: {} }
                },
                {
                    name: "stop_auto_drive",
                    description: "Stop the Autonomous Development Loop",
                    inputSchema: { type: "object", properties: {} }
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
                },
                {
                    name: "vscode_get_notifications",
                    description: "Read the latest notification/status message from VS Code",
                    inputSchema: { type: "object", properties: {} }
                },
                {
                    name: "vscode_submit_chat",
                    description: "Submit the current text in the chat input (Simulates Enter)",
                    inputSchema: { type: "object", properties: {} }
                },
                {
                    name: "index_codebase",
                    description: "Scan code files and populate the semantic memory (vector store)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Root directory to index (defaults to cwd)" }
                        }
                    }
                },
                {
                    name: "search_codebase",
                    description: "Semantically search the codebase for relevant snippets",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Natural language query (e.g. 'Where is authentication?')" }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: "chain_tools",
                    description: "Execute a sequence of tools where outputs can be piped to inputs. Use {{prev.content[0].text}} for variable substitution.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            tools: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        toolName: { type: "string" },
                                        args: { type: "object" }
                                    },
                                    required: ["toolName"]
                                }
                            }
                        },
                        required: ["tools"]
                    }
                }
            ];

            // Standard Library Tools
            const standardTools = [...FileSystemTools, ...TerminalTools, ...MemoryTools, ...TunnelTools, ...LogTools, ...ConfigTools, ...SearchTools, ...ReaderTools].map(t => ({
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
            return await this.executeTool(request.params.name, request.params.arguments);
        });
    }

    async start() {
        console.log("[MCPServer] Loading Skills...");
        // Initialize systems
        await this.skillRegistry.loadSkills();
        console.log("[MCPServer] Skills Loaded.");

        // 1. Start Stdio (for local CLI usage)
        console.log("[MCPServer] Connecting Stdio...");
        const stdioTransport = new StdioServerTransport();
        await this.server.connect(stdioTransport);
        console.error("Borg Core: Stdio Transport Active");

        // 2. Start WebSocket (for Extension/Web usage)
        if (this.wsServer) {
            console.log("[MCPServer] Starting WebSocket Server...");
            const PORT = 3001;
            const httpServer = http.createServer();
            const wss = new WebSocketServer({ server: httpServer });
            this.wssInstance = wss;
            const wsTransport = new WebSocketServerTransport(wss);

            httpServer.on('error', (err: any) => {
                console.error(`[Borg Core] ❌ WebSocket Server Error (Port ${PORT}):`, err.message);
            });

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
                        if (msg.type === 'USER_ACTIVITY') {
                            // Track global user activity
                            this.lastUserActivityTime = Math.max(this.lastUserActivityTime, msg.lastActivityTime);
                        }
                    } catch (e) {
                        // Ignore non-JSON
                    }
                });
            });
        } else {
            console.log("[MCPServer] Skipping WebSocket (No wsServer instance).");
        }

        // 3. Connect to Supervisor (Native Automation)
        // 3. Connect to Supervisor (Native Automation)
        console.log("[MCPServer] Connecting to Supervisor...");

        try {
            console.log(`[MCPServer] DEBUG __dirname: ${__dirname}`);
            const rootDir = this.findMonorepoRoot(__dirname);
            console.log(`[MCPServer] DEBUG rootDir: ${rootDir}`);
            if (rootDir) {
                const supervisorPath = path.join(rootDir, 'packages', 'borg-supervisor', 'dist', 'index.js');
                console.log(`[MCPServer] Supervisor Path Resolved: ${supervisorPath}`);

                await this.router.connectToServer('borg-supervisor', 'node', [supervisorPath]);
                console.error(`Borg Core: Connected to Supervisor at ${supervisorPath}`);
            } else {
                console.error("[MCPServer] Failed to locate Monorepo Root. Skipping Supervisor.");
            }
        } catch (e: any) {
            console.error("Borg Core: Failed to connect to Supervisor. Native automation disabled.", e.message);
        }

        if (this.wsServer && this.wssInstance) {
            console.log("[MCPServer] Connecting internal WS transport...");
            const wsTransport = new WebSocketServerTransport(this.wssInstance);
            await this.wsServer.connect(wsTransport);
        }
        console.log("[MCPServer] Start Complete.");
    }

    private findMonorepoRoot(startDir: string): string | null {
        const fs = require('fs');
        let current = startDir;
        const root = path.parse(current).root;
        while (current !== root) {
            if (fs.existsSync(path.join(current, 'turbo.json'))) {
                return current;
            }
            current = path.dirname(current);
        }
        return null;
    }
}

