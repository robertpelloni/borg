/**
 * LazyToolLoader - Implements lazy-mcp pattern for deferred tool loading
 * 
 * Heavy tools (Spawner, TestRunner, IngestionTools, OrchestrationTools) are NOT
 * imported at startup. Instead, they're dynamically imported on first use.
 * 
 * This significantly speeds up CLI startup time by avoiding loading:
 * - @xenova/transformers (30-60s)
 * - pdf-parse
 * - Other heavy dependencies
 */

interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: any;
}

interface LazyToolSpec {
    modulePath: string;
    toolsExportName: string;
    loaded: boolean;
    tools: any[] | null;
    definitions: ToolDefinition[] | null;
}

export class LazyToolLoader {
    private lazyModules: Map<string, LazyToolSpec> = new Map();
    private toolToModule: Map<string, string> = new Map(); // tool name -> module path

    constructor() {
        // Register heavy modules that should be lazily loaded
        this.registerLazyModule('./agents/Spawner.js', 'SpawnerTools', [
            {
                name: "spawn_agent",
                description: "Spawn a specialized sub-agent for a task",
                inputSchema: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["code", "research", "reviewer", "custom"], description: "Agent type" },
                        task: { type: "string", description: "Task description" },
                        customPrompt: { type: "string", description: "Custom system prompt (optional)" }
                    },
                    required: ["type", "task"]
                }
            },
            {
                name: "list_agents",
                description: "List all spawned sub-agents and their status",
                inputSchema: { type: "object", properties: {} }
            },
            {
                name: "get_agent_result",
                description: "Get the result of a completed sub-agent",
                inputSchema: {
                    type: "object",
                    properties: { agentId: { type: "string" } },
                    required: ["agentId"]
                }
            },
            {
                name: "kill_agent",
                description: "Terminate a running sub-agent",
                inputSchema: {
                    type: "object",
                    properties: { agentId: { type: "string" } },
                    required: ["agentId"]
                }
            }
        ]);

        this.registerLazyModule('./tools/TestRunnerTools.js', 'TestRunnerTools', [
            {
                name: "run_tests",
                description: "Run test suite in a directory",
                inputSchema: {
                    type: "object",
                    properties: {
                        directory: { type: "string" },
                        testPattern: { type: "string" },
                        watch: { type: "boolean" }
                    },
                    required: ["directory"]
                }
            },
            {
                name: "find_related_tests",
                description: "Find test files related to a source file",
                inputSchema: {
                    type: "object",
                    properties: { sourceFile: { type: "string" } },
                    required: ["sourceFile"]
                }
            },
            {
                name: "detect_test_framework",
                description: "Detect the test framework used in a project",
                inputSchema: {
                    type: "object",
                    properties: { directory: { type: "string" } },
                    required: ["directory"]
                }
            },
            {
                name: "run_tests_for_file",
                description: "Run tests related to a modified file",
                inputSchema: {
                    type: "object",
                    properties: { filePath: { type: "string" } },
                    required: ["filePath"]
                }
            }
        ]);

        this.registerLazyModule('./tools/IngestionTools.js', 'IngestionTools', [
            {
                name: "ingest_file",
                description: "Ingest a document (PDF, markdown, text) into the local knowledge base",
                inputSchema: {
                    type: "object",
                    properties: {
                        filePath: { type: "string", description: "Path to document" },
                        chunkSize: { type: "number", description: "Chunk size (default 500)" }
                    },
                    required: ["filePath"]
                }
            },
            {
                name: "list_ingested_files",
                description: "List all ingested documents in the knowledge base",
                inputSchema: { type: "object", properties: {} }
            }
        ]);

        this.registerLazyModule('./tools/OrchestrationTools.js', 'OrchestrationTools', [
            {
                name: "delegate_to_gemini",
                description: "Delegate a task to Gemini CLI",
                inputSchema: {
                    type: "object",
                    properties: {
                        task: { type: "string" },
                        workingDir: { type: "string" }
                    },
                    required: ["task"]
                }
            },
            {
                name: "delegate_to_claude",
                description: "Delegate a task to Claude CLI",
                inputSchema: {
                    type: "object",
                    properties: {
                        task: { type: "string" },
                        workingDir: { type: "string" }
                    },
                    required: ["task"]
                }
            },
            {
                name: "delegate_to_opencode",
                description: "Delegate a task to OpenCode CLI",
                inputSchema: {
                    type: "object",
                    properties: {
                        task: { type: "string" },
                        workingDir: { type: "string" }
                    },
                    required: ["task"]
                }
            },
            {
                name: "list_cli_status",
                description: "Check availability of registered CLI tools",
                inputSchema: { type: "object", properties: {} }
            }
        ]);
    }

    private registerLazyModule(modulePath: string, exportName: string, definitions: ToolDefinition[]) {
        this.lazyModules.set(modulePath, {
            modulePath,
            toolsExportName: exportName,
            loaded: false,
            tools: null,
            definitions
        });

        // Map each tool name to its module
        for (const def of definitions) {
            this.toolToModule.set(def.name, modulePath);
        }
    }

    /**
     * Get tool definitions (lightweight, no actual import)
     */
    getToolDefinitions(): ToolDefinition[] {
        const allDefs: ToolDefinition[] = [];
        for (const spec of this.lazyModules.values()) {
            if (spec.definitions) {
                allDefs.push(...spec.definitions);
            }
        }
        return allDefs;
    }

    /**
     * Check if a tool is handled by lazy loader
     */
    isLazyTool(toolName: string): boolean {
        return this.toolToModule.has(toolName);
    }

    /**
     * Dynamically load and execute a lazy tool
     */
    async executeLazyTool(toolName: string, args: any): Promise<any> {
        const modulePath = this.toolToModule.get(toolName);
        if (!modulePath) {
            throw new Error(`Tool '${toolName}' not found in lazy loader`);
        }

        const spec = this.lazyModules.get(modulePath)!;

        // Load the module on first use
        if (!spec.loaded) {
            console.log(`[LazyLoader] Loading module: ${modulePath}`);
            const startTime = Date.now();

            try {
                const module = await import(modulePath);
                spec.tools = module[spec.toolsExportName];
                spec.loaded = true;
                console.log(`[LazyLoader] Module loaded in ${Date.now() - startTime}ms`);
            } catch (e: any) {
                console.error(`[LazyLoader] Failed to load ${modulePath}: ${e.message}`);
                throw new Error(`Failed to load lazy module: ${e.message}`);
            }
        }

        // Find and execute the tool
        const tool = spec.tools?.find((t: any) => t.name === toolName);
        if (!tool || !tool.handler) {
            throw new Error(`Tool '${toolName}' has no handler`);
        }

        return await tool.handler(args);
    }
}

// Singleton instance
let _instance: LazyToolLoader | null = null;

export function getLazyToolLoader(): LazyToolLoader {
    if (!_instance) {
        _instance = new LazyToolLoader();
    }
    return _instance;
}
