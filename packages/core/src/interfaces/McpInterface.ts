import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HubServer } from "../hub/HubServer.js";

export class McpInterface {
    constructor(private hubServer: HubServer) {}

    async start() {
        const transport = new StdioServerTransport();
        await this.hubServer.connect(transport);
        console.error("Super AI Plugin MCP Server running on stdio");
    }
}
