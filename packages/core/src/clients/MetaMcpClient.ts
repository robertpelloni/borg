import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { EventSource } from 'eventsource';

/**
 * Connects to the MetaMCP Backend running in Docker.
 * Proxies tools and resources.
 */
export class MetaMcpClient {
    private client: Client | null = null;
    private transport: SSEClientTransport | null = null;
    private endpoint: string;

    constructor(endpoint = 'http://localhost:12009/sse') {
        this.endpoint = endpoint;
    }

    async connect() {
        try {
            // @ts-ignore - EventSource type mismatch usually
            this.transport = new SSEClientTransport(new URL(this.endpoint), { eventSourceClass: EventSource });

            this.client = new Client({
                name: "Super-AI-Plugin-Core",
                version: "1.0.0"
            }, {
                capabilities: {}
            });

            await this.client.connect(this.transport);
            console.log('[MetaMcpClient] Connected to MetaMCP at', this.endpoint);
        } catch (error) {
            console.warn('[MetaMcpClient] Failed to connect to MetaMCP (is Docker running?):', error);
            this.client = null;
        }
    }

    async listTools() {
        if (!this.client) return [];
        try {
            const result = await this.client.listTools();
            // Prefix tools to avoid collision?
            // MetaMCP tools are already namespaced usually.
            return result.tools;
        } catch (error) {
            console.error('[MetaMcpClient] Failed to list tools:', error);
            return [];
        }
    }

    async callTool(name: string, args: any) {
        if (!this.client) throw new Error("MetaMCP not connected");
        return await this.client.callTool({
            name,
            arguments: args
        });
    }
}
