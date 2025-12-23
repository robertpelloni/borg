import { McpManager } from './McpManager.js';
import { LogManager } from './LogManager.js';
import { ToolSearchService } from '../services/ToolSearchService.js';
import { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

export class McpProxyManager {
    private searchService = new ToolSearchService();

    constructor(
        private mcpManager: McpManager,
        private logManager: LogManager
    ) {}

    searchTools(query: string): Tool[] {
        return this.searchService.search(query);
    }

    async listTools(): Promise<Tool[]> {
        const servers = this.mcpManager.getAllServers();
        const allTools: Tool[] = [];

        for (const s of servers) {
            if (s.status !== 'running') continue;
            const client = this.mcpManager.getClient(s.name);
            if (!client) continue;

            try {
                const result = await client.listTools();
                if (result.tools) {
                    // Namespace the tools: serverName__toolName
                    const namespacedTools = result.tools.map(t => ({
                        ...t,
                        name: `${s.name}__${t.name}`,
                        description: `[${s.name}] ${t.description || ''}`
                    }));
                    allTools.push(...namespacedTools);
                }
            } catch (e) {
                console.error(`Failed to list tools for ${s.name}:`, e);
            }
        }

        // Update search index
        this.searchService.indexTools(allTools);

        return allTools;
    }

    async callTool(name: string, args: any): Promise<CallToolResult> {
        // Parse serverName__toolName
        const [serverName, ...rest] = name.split('__');
        const toolName = rest.join('__');

        if (!serverName || !toolName) {
            throw new Error(`Invalid namespaced tool name: ${name}`);
        }

        const client = this.mcpManager.getClient(serverName);
        if (!client) {
            throw new Error(`Server ${serverName} not connected`);
        }

        try {
            this.logManager.log({
                source: 'Hub',
                destination: serverName,
                type: 'request',
                method: 'tools/call',
                payload: { name: toolName, arguments: args }
            });

            const result = await client.callTool({
                name: toolName,
                arguments: args
            });

            this.logManager.log({
                source: serverName,
                destination: 'Hub',
                type: 'response',
                method: 'tools/call',
                payload: result
            });

            return result as CallToolResult;
        } catch (e: any) {
            this.logManager.log({
                source: serverName,
                destination: 'Hub',
                type: 'response',
                method: 'tools/call',
                payload: { error: e.message }
            });
            return {
                content: [{ type: 'text', text: `Error: ${e.message}` }],
                isError: true
            };
        }
    }
}
