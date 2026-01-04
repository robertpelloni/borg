import { McpManager } from './McpManager.js';
import { ToolSearchService } from '../services/ToolSearchService.js';
import { SandboxManager } from './SandboxManager.js';
import { JSONPath } from 'jsonpath-plus';
import {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
    CallToolHandler,
    compose,
    MetaMCPHandlerContext
} from '../middleware/functional-middleware.js';
import { createLoggingMiddleware } from '../middleware/logging-middleware.js';
import { LogManager } from './LogManager.js';

/**
 * McpRouter is responsible for:
 * 1. Aggregating tools from all connected MCP servers (McpManager)
 * 2. Providing "Meta" tools (search, run_code, mcp_chain, etc.)
 * 3. Routing requests to the appropriate server or internal handler
 * 4. Applying middleware (logging, policy, etc.)
 */
export class McpRouter {
  private toolSearchService: ToolSearchService;
  private internalTools: Map<string, Tool> = new Map();
  
  // Cache for routing: toolName -> serverName
  private toolRoutingTable: Map<string, string> = new Map();

  // The final composed handler
  private composedCallToolHandler: CallToolHandler;

  constructor(
      private mcpManager: McpManager,
      private logManager: LogManager
    ) {
    this.toolSearchService = new ToolSearchService();
    this.initializeInternalTools();

    // Listen for server updates to refresh routing table
    this.mcpManager.on('updated', () => {
        this.refreshRoutingTable().catch(console.error);
    });

    // Compose Middleware
    this.composedCallToolHandler = compose(
        createLoggingMiddleware({ enabled: true, logManager: this.logManager })
        // Add more middleware here (e.g. Policy, RateLimit)
    )(this.executeToolCall.bind(this));
  }

  public registerInternalTool(tool: Tool | any, handler: (args: any, context?: MetaMCPHandlerContext) => Promise<any>) {
        // Handle simplified tool definition
        const toolDef = tool as Tool;
        this.internalTools.set(toolDef.name, toolDef);
        this.internalToolHandlers.set(toolDef.name, handler);
        
        // Refresh routing table to include this new tool
        this.refreshRoutingTable();
  }

  private internalToolHandlers: Map<string, (args: any, context?: MetaMCPHandlerContext) => Promise<any>> = new Map();
  
  // Progressive Disclosure State
  private sessionVisibleTools: Map<string, Set<string>> = new Map();
  private progressiveMode = process.env.MCP_PROGRESSIVE_MODE === 'true';
  private MAX_LOADED_TOOLS = 200;

  private initializeInternalTools() {
    this.registerInternalTool({
        name: 'search_tools',
        description: 'Semantically search for available tools across all connected MCP servers.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Max results (default: 10)' }
            },
            required: ['query']
        }
    }, async (args) => {
        const results = this.toolSearchService.search(args.query, args.limit);
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(results, null, 2)
            }]
        };
    });

    this.registerInternalTool({
        name: 'load_tool',
        description: 'Load a specific tool by name into your context so you can use it. Use the names found via search_tools.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'The full name of the tool to load.' }
            },
            required: ['name']
        }
    }, async (args, context) => {
         return this.handleLoadTool(args, context?.sessionId);
    });

    this.registerInternalTool({
        name: 'run_code',
        description: 'Execute TypeScript/JavaScript code in a secure sandbox.',
        inputSchema: {
            type: 'object',
            properties: {
                code: { type: 'string', description: 'Code to execute' }
            },
            required: ['code']
        }
    }, async (args, context) => {
          const sandbox = new SandboxManager();
          try {
              // We pass a callback that re-enters the router so code can call other tools!
              // Crucial: We must pass the context along (or create a new sub-context)
              const toolCallback = async (toolName: string, toolArgs: any) => {
                  const result = await this.callTool({
                      method: 'tools/call',
                      params: { name: toolName, arguments: toolArgs }
                  }, context || {});
                  
                  if (result.isError) {
                      throw new Error(result.content.map(c => c.type === 'text' ? c.text : '').join('\n'));
                  }
                  
                  // Parse result content if possible
                  const text = result.content.map(c => c.type === 'text' ? c.text : '').join('');
                  try {
                      return JSON.parse(text);
                  } catch {
                      return text;
                  }
              };

              const result = await sandbox.execute(args.code, toolCallback);
              return {
                  content: [{
                      type: 'text',
                      text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                  }]
              };
          } catch (e: any) {
              return {
                  isError: true,
                  content: [{ type: 'text', text: e.message }]
              };
          } finally {
              sandbox.dispose();
          }
    });

    this.registerInternalTool({
        name: "mcp_chain",
        description: "Execute a sequence of MCP tools, passing output from one to the next.",
        inputSchema: {
            type: "object",
            properties: {
                mcpPath: {
                    type: "array",
                    description: "An ordered array of tool configurations to execute sequentially.",
                    items: {
                        type: "object",
                        properties: {
                            toolName: { type: "string", description: "The name of the tool to execute." },
                            toolArgs: { type: "string", description: "JSON string arguments. Use 'CHAIN_RESULT' as placeholder for previous output." },
                            inputPath: { type: "string", description: "Optional JSONPath to extract specific data from previous result." },
                            outputPath: { type: "string", description: "Optional JSONPath to extract specific data from this result." }
                        },
                        required: ["toolName", "toolArgs"]
                    }
                }
            },
            required: ["mcpPath"]
        }
    }, async (args, context) => {
        return await this.executeChain(args.mcpPath, context || {});
    });
    
    // Initial sync
    this.refreshRoutingTable();
  }
  
  private handleLoadTool(args: any, sessionId?: string) {
       if (!sessionId) {
            return { isError: true, content: [{ type: "text", text: "Error: No session ID provided for tool loading." }] };
       }
       if (!this.sessionVisibleTools.has(sessionId)) {
            this.sessionVisibleTools.set(sessionId, new Set());
       }
       
       const sessionSet = this.sessionVisibleTools.get(sessionId)!;
       
       if (sessionSet.size >= this.MAX_LOADED_TOOLS && !sessionSet.has(args.name)) {
            const first = sessionSet.values().next().value;
            if (first) sessionSet.delete(first);
       }
       
       sessionSet.add(args.name);
       return {
            content: [{ type: "text", text: `Tool '${args.name}' loaded successfully. It is now available.` }]
       };
  }

  /**
   * Refreshes the routing table by querying all connected servers
   */
  async refreshRoutingTable() {
    console.log('[McpRouter] Refreshing routing table...');
    this.toolRoutingTable.clear();
    const allTools: any[] = [];

    // 1. Internal Tools
    for (const [name, tool] of this.internalTools.entries()) {
        this.toolRoutingTable.set(name, 'internal');
        allTools.push(tool);
    }

    // 2. External Servers
    const servers = this.mcpManager.getAllServers();
    for (const server of servers) {
        if (server.status === 'running') {
            const client = this.mcpManager.getClient(server.name);
            if (client) {
                try {
                    const result = await client.listTools();
                    for (const tool of result.tools) {
                        // TODO: Handle naming conflicts (namespace? prefix?)
                        // For now, first come first served (or overwrite)
                        this.toolRoutingTable.set(tool.name, server.name);
                        allTools.push(tool);
                    }
                } catch (e) {
                    console.error(`[McpRouter] Failed to list tools from ${server.name}:`, e);
                }
            }
        }
    }

    // Update Search Index
    this.toolSearchService.setTools(allTools);
    console.log(`[McpRouter] Routing table updated. Total tools: ${this.toolRoutingTable.size}`);
  }

  // --- New Methods to Match McpProxyManager Interface ---

  public async getAllTools(sessionId?: string): Promise<Tool[]> {
    // 1. Meta Tools (Always Visible) - Actually, these are already in internalTools
    // but we might want to ensure they are returned first or specifically handled.
    // In our case, they are in `internalTools`, so `listTools` handles them.

    // 2. Progressive Disclosure Logic
    // If progressive mode is ON, we filter based on sessionId
    
    // We need to fetch ALL tools first.
    // listTools implementation aggregates them.
    // Let's reuse a private helper for aggregation to avoid recursion with listTools (which is an API handler)
    
    const allTools = await this.aggregateAllTools();

    if (!this.progressiveMode) {
        return allTools;
    }

    // Progressive Mode Filter
    const visible = new Set<string>();
    
    // Always include Internal Tools?
    for (const name of this.internalTools.keys()) {
        visible.add(name);
    }

    // Add Session-Loaded Tools
    if (sessionId && this.sessionVisibleTools.has(sessionId)) {
        const sessionSet = this.sessionVisibleTools.get(sessionId)!;
        sessionSet.forEach(t => visible.add(t));
    }

    return allTools.filter(t => visible.has(t.name));
  }

  public async callToolSimple(name: string, args: any, sessionId?: string): Promise<any> {
      // Wrapper around callTool to match the signature expected by AgentExecutor
      // callTool expects (request, context)
      // We construct a synthetic request and context
      
      const request: CallToolRequest = {
          method: 'tools/call',
          params: {
              name,
              arguments: args
          }
      };
      
      const context: MetaMCPHandlerContext = {
          sessionId
          // other context fields if needed
      };

      const result = await this.callTool(request, context);
      
      if (result.isError) {
          throw new Error(result.content.map(c => c.type === 'text' ? c.text : '').join('\n'));
      }

      // Unpack content
      // If single text content, return string? Or return full content array?
      // AgentExecutor expects JSON object or string usually.
      // McpProxyManager returned the raw result object mostly, or standardized it.
      // Let's check McpProxyManager.callTool return type... it returns `result` object.
      return result;
  }

  private async aggregateAllTools(): Promise<Tool[]> {
      const tools: Tool[] = [];
    
      // Internal
      for (const tool of this.internalTools.values()) {
          tools.push(tool);
      }
      
      // External
      const servers = this.mcpManager.getAllServers();
      for (const server of servers) {
           if (server.status === 'running') {
               const client = this.mcpManager.getClient(server.name);
               if (client) {
                   try {
                       const result = await client.listTools();
                       tools.push(...result.tools);
                   } catch(e) {}
               }
           }
      }
      return tools;
  }

  // ------------------------------------------------------

  /**
   * Public API: List all available tools
   */
  async listTools(request: ListToolsRequest, context: MetaMCPHandlerContext): Promise<ListToolsResult> {
    // We could apply ListToolsMiddleware here too
    // For now, return everything in the search index (which is everything in the routing table)
    // In a real app, we might paginate or filter based on context/user
    
    // Ensure table is populated
    if (this.toolRoutingTable.size === 0) {
        await this.refreshRoutingTable();
    }
    
    // We need to fetch the full tool definitions again because routing table only has names
    // For efficiency, we rely on ToolSearchService having the definitions
    // But ToolSearchService.search might be optimized for search, not listing all.
    // Let's just re-aggregate for listTools or cache definitions separately.
    
    // let's assume we want to return what we have.
    // Ideally we should cache the tool definitions alongside the routing table.
    
    // Re-fetch logic for now (optimized later)
    const tools: Tool[] = [];
    
    // Internal
    for (const tool of this.internalTools.values()) {
        tools.push(tool);
    }
    
    // External
    const servers = this.mcpManager.getAllServers();
    for (const server of servers) {
         if (server.status === 'running') {
             const client = this.mcpManager.getClient(server.name);
             if (client) {
                 try {
                     const result = await client.listTools();
                     tools.push(...result.tools);
                 } catch(e) {}
             }
         }
    }
    
    return { tools };
  }

  /**
   * Public API: Call a tool
   * This goes through the middleware stack
   */
  async callTool(request: CallToolRequest, context: MetaMCPHandlerContext): Promise<CallToolResult> {
      return this.composedCallToolHandler(request, context);
  }

  /**
   * The actual execution logic (the "sink" of the middleware stack)
   */
  private async executeToolCall(request: CallToolRequest, context: MetaMCPHandlerContext): Promise<CallToolResult> {
      const { name, arguments: args } = request.params;
      const target = this.toolRoutingTable.get(name);

      if (!target) {
          // Try one refresh
          await this.refreshRoutingTable();
          if (!this.toolRoutingTable.has(name)) {
             throw new Error(`Tool '${name}' not found.`);
          }
      }

      const finalTarget = this.toolRoutingTable.get(name)!;

      if (finalTarget === 'internal') {
          return this.handleInternalTool(name, args, context);
      } else {
          // Route to external server
          const client = this.mcpManager.getClient(finalTarget);
          if (!client) {
              throw new Error(`Server '${finalTarget}' is not connected.`);
          }
          const result = await client.callTool({
              name,
              arguments: args
          });
          return result as unknown as CallToolResult;
      }
  }

  private async handleInternalTool(name: string, args: any, context: MetaMCPHandlerContext): Promise<CallToolResult> {
      // Check if we have a registered handler first
      if (this.internalToolHandlers.has(name)) {
          try {
              const handler = this.internalToolHandlers.get(name)!;
              const result = await handler(args, context);
              
              // Normalize result
              if (result && result.content && Array.isArray(result.content)) {
                  return result as CallToolResult;
              } else if (typeof result === 'string') {
                  return { content: [{ type: 'text', text: result }] };
              } else {
                  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
              }
          } catch (e: any) {
               return {
                   isError: true,
                   content: [{ type: 'text', text: e.message }]
               };
          }
      }

      if (name === 'search_tools') {
          const results = this.toolSearchService.search(args.query, args.limit);
          return {
              content: [{
                  type: 'text',
                  text: JSON.stringify(results, null, 2)
              }]
          };
      }

      if (name === 'run_code') {
          const sandbox = new SandboxManager();
          try {
              // We pass a callback that re-enters the router so code can call other tools!
              // Crucial: We must pass the context along (or create a new sub-context)
              const toolCallback = async (toolName: string, toolArgs: any) => {
                  const result = await this.callTool({
                      method: 'tools/call',
                      params: { name: toolName, arguments: toolArgs }
                  }, context);
                  
                  if (result.isError) {
                      throw new Error(result.content.map(c => c.type === 'text' ? c.text : '').join('\n'));
                  }
                  
                  // Parse result content if possible
                  const text = result.content.map(c => c.type === 'text' ? c.text : '').join('');
                  try {
                      return JSON.parse(text);
                  } catch {
                      return text;
                  }
              };

              const result = await sandbox.execute(args.code, toolCallback);
              return {
                  content: [{
                      type: 'text',
                      text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                  }]
              };
          } catch (e: any) {
              return {
                  isError: true,
                  content: [{ type: 'text', text: e.message }]
              };
          } finally {
              sandbox.dispose();
          }
      }

      if (name === 'mcp_chain') {
          return await this.executeChain(args.mcpPath, context);
      }

      throw new Error(`Internal tool '${name}' not implemented.`);
  }

    private async executeChain(mcpPath: any[], context: MetaMCPHandlerContext): Promise<CallToolResult> {
        let result: any = null;
        const trace: any[] = [];

        for (let i = 0; i < mcpPath.length; i++) {
            const step = mcpPath[i];
            const { toolName, inputPath, outputPath } = step;

            // 1. Process Input (from previous result)
            let processedPreviousResult = result;
            if (i > 0 && result && inputPath) {
                try {
                     // Ensure JSON object
                     const jsonResult = typeof result === 'string' ? JSON.parse(result) : result;
                     const extracted = JSONPath({ path: inputPath, json: jsonResult });
                     processedPreviousResult = extracted.length === 1 ? extracted[0] : extracted;
                } catch (e) {
                    console.warn(`[Chain] Failed to apply inputPath '${inputPath}'`, e);
                }
            }

            // 2. Prepare Arguments
            let toolArgs = step.toolArgs;
            if (i > 0) {
                 // Replace CHAIN_RESULT
                 let replacement = processedPreviousResult;
                 if (typeof replacement === 'object') {
                     replacement = JSON.stringify(replacement);
                 }
                 // Naive string replacement (should be improved for robustness)
                 toolArgs = toolArgs.replace("CHAIN_RESULT", String(replacement));
                 toolArgs = toolArgs.replace("\"CHAIN_RESULT\"", JSON.stringify(replacement)); // Handle quoted
            }

            // 3. Call Tool
            let parsedArgs;
            try {
                parsedArgs = JSON.parse(toolArgs);
            } catch (e) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Invalid JSON args for tool ${toolName}: ${toolArgs}` }],
                };
            }

            // Call internal router
            const stepResult = await this.callTool({
                method: 'tools/call',
                params: { name: toolName, arguments: parsedArgs }
            }, context);
            
            // Check for error in step result
            if (stepResult.isError) {
                trace.push({ step: i, tool: toolName, error: stepResult.content });
                return {
                    isError: true,
                    content: [{ type: "text", text: `Chain failed at step ${i+1} (${toolName}): ${JSON.stringify(stepResult.content)}` }],
                    _meta: { trace }
                };
            }

            // 4. Process Output
            // Extract text content from SDK result
            const textContent = stepResult.content.map(c => c.type === 'text' ? c.text : '').join('');

            if (textContent) {
                result = textContent;
                
                if (outputPath) {
                    try {
                         const jsonResult = JSON.parse(result);
                         const extracted = JSONPath({ path: outputPath, json: jsonResult });
                         result = extracted.length === 1 ? extracted[0] : extracted;
                    } catch (e) {
                         console.warn(`[Chain] Failed to apply outputPath '${outputPath}'`, e);
                    }
                }
            } else {
                 result = JSON.stringify(stepResult);
            }
            
            trace.push({ step: i, tool: toolName, output: result });
        }

        return { 
            content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result) }],
            _meta: { trace }
        };
    }
}
