import { EventEmitter } from 'events';
import { Socket } from 'socket.io';

export class VSCodeManager extends EventEmitter {
    private clients: Map<string, Socket> = new Map();

    registerClient(socket: Socket) {
        this.clients.set(socket.id, socket);
        console.log(`[VSCodeManager] Client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            this.clients.delete(socket.id);
            console.log(`[VSCodeManager] Client disconnected: ${socket.id}`);
        });
    }

    private getClient(): Socket {
        const client = this.clients.values().next().value;
        if (!client) throw new Error("No VSCode clients connected");
        return client;
    }

    async openFile(filePath: string): Promise<string> {
        const client = this.getClient();
        client.emit('command', { command: 'vscode.open', args: [filePath] });
        return `Opened ${filePath}`;
    }

    async getActiveFile(): Promise<string> {
        const client = this.getClient();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject("Timeout waiting for VSCode"), 5000);
            client.once('active_editor_info', (data: any) => {
                clearTimeout(timeout);
                resolve(JSON.stringify(data));
            });
            client.emit('get_active_editor');
        });
    }

    async insertText(text: string): Promise<string> {
        const client = this.getClient();
        client.emit('insert_text', { text });
        return "Text inserted";
    }

    getToolDefinitions() {
        return [
            {
                name: "vscode_open_file",
                description: "Open a file in VSCode.",
                inputSchema: {
                    type: "object",
                    properties: { path: { type: "string" } },
                    required: ["path"]
                }
            },
            {
                name: "vscode_get_active_file",
                description: "Get information about the currently active file in VSCode.",
                inputSchema: { type: "object", properties: {} }
            },
            {
                name: "vscode_insert_text",
                description: "Insert text at the cursor position in VSCode.",
                inputSchema: {
                    type: "object",
                    properties: { text: { type: "string" } },
                    required: ["text"]
                }
            }
        ];
    }
}
