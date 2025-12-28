import { EventEmitter } from 'events';
import { Socket } from 'socket.io';

export class BrowserManager extends EventEmitter {
    private clients: Map<string, Socket> = new Map();

    registerClient(socket: Socket) {
        this.clients.set(socket.id, socket);
        console.log(`[BrowserManager] Client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            this.clients.delete(socket.id);
            console.log(`[BrowserManager] Client disconnected: ${socket.id}`);
        });
    }

    async readActiveTab(): Promise<string> {
        // Broadcast to all connected browsers (or pick one)
        // Ideally we pick the most recent one or allow targeting.
        // For now, ask the first available one.
        const client = this.clients.values().next().value;
        if (!client) throw new Error("No browser clients connected");

        return new Promise((resolve, reject) => {
            // We need to implement a request/response pattern over socket.io
            // Emitting 'read_page' and waiting for an event back is tricky without a correlation ID.
            // Simplified: Expect browser to emit 'page_content' immediately.

            const timeout = setTimeout(() => reject("Timeout waiting for browser"), 5000);

            client.once('page_content', (data: any) => {
                clearTimeout(timeout);
                resolve(JSON.stringify(data));
            });

            client.emit('read_page');
        });
    }

    async navigate(url: string) {
        const client = this.clients.values().next().value;
        if (!client) throw new Error("No browser clients connected");
        client.emit('navigate', { url });
        return "Navigation command sent";
    }

    async injectContext(text: string) {
        const client = this.clients.values().next().value;
        if (!client) throw new Error("No browser clients connected");
        client.emit('hook_event', { type: 'inject_context', text });
        return "Context injection command sent";
    }

    getToolDefinitions() {
        return [
            {
                name: "read_active_tab",
                description: "Read the title and content of the active browser tab.",
                inputSchema: { type: "object", properties: {} }
            },
            {
                name: "browser_navigate",
                description: "Navigate the active tab to a URL.",
                inputSchema: {
                    type: "object",
                    properties: { url: { type: "string" } },
                    required: ["url"]
                }
            },
            {
                name: "inject_context",
                description: "Inject text into the active input field on the browser page.",
                inputSchema: {
                    type: "object",
                    properties: { text: { type: "string" } },
                    required: ["text"]
                }
            }
        ];
    }
}
