import { HubServer } from '../hub/HubServer.js';

/**
 * Exposes the HubServer via Stdio for local integration with VSCode/Claude.
 */
export class McpInterface {
    constructor(private hub: HubServer) {}

    start() {
        process.stdin.setEncoding('utf8');

        // Simple JSON-RPC over Stdio handler
        process.stdin.on('data', async (chunk) => {
            const lines = chunk.toString().split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const msg = JSON.parse(line);
                    const response = await this.hub.handleMessage('stdio', msg);
                    if (response) { // Notifications don't have responses
                        process.stdout.write(JSON.stringify(response) + '\n');
                    }
                } catch (err) {
                    // Ignore non-json garbage
                }
            }
        });
    }
}
