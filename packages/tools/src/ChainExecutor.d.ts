import { MCPServer } from "../MCPServer.js";
export interface ChainStep {
    toolName: string;
    args: Record<string, any>;
}
export interface ChainRequest {
    tools: ChainStep[];
}
export declare class ChainExecutor {
    private server;
    constructor(server: MCPServer);
    /**
     * Executes a chain of tools sequentially, passing outputs as inputs if needed.
     */
    executeChain(chain: ChainRequest): Promise<any[]>;
    /**
     * Resolves argument placeholders like "{{prev.content[0].text}}" or "{{step1.result}}"
     */
    private resolveArgs;
    private getValueFromPath;
}
//# sourceMappingURL=ChainExecutor.d.ts.map