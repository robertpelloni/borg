import { Socket } from 'socket.io';
import { EventEmitter } from 'events';

export class BrowserManager extends EventEmitter {
    private browserSocket: Socket | null = null;
    private pendingRequests: Map<string, { resolve: Function, reject: Function }> = new Map();

    constructor() {
        super();
    }

    public registerBrowser(socket: Socket) {
        this.browserSocket = socket;
        console.log(`[BrowserManager] Browser connected: ${socket.id}`);

        socket.on('disconnect', () => {
            console.log(`[BrowserManager] Browser disconnected: ${socket.id}`);
            if (this.browserSocket?.id === socket.id) {
                this.browserSocket = null;
            }
        });

        socket.on('browser_response', (data: any) => {
            const { id, result, error, status } = data;
            const pending = this.pendingRequests.get(id);
            if (pending) {
                if (status === 'success') {
                    pending.resolve(result);
                } else {
                    pending.reject(new Error(error));
                }
                this.pendingRequests.delete(id);
            }
        });
    }

    public isConnected(): boolean {
        return !!this.browserSocket;
    }

    public async navigate(url: string): Promise<string> {
        return this.sendCommand('navigate', { url });
    }

    public async getActiveTabContent(): Promise<string> {
        return this.sendCommand('get_active_tab_content', {});
    }

    public async searchHistory(query: string, limit: number = 10): Promise<any[]> {
        return this.sendCommand('search_history', { query, limit });
    }

    public async getBookmarks(query?: string): Promise<any[]> {
        return this.sendCommand('get_bookmarks', { query });
    }

    private sendCommand(command: string, args: any): Promise<any> {
        if (!this.browserSocket) {
            throw new Error("No browser connected. Please install the aios Browser Extension.");
        }

        const id = Math.random().toString(36).substring(7);
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.browserSocket!.emit('browser_command', { id, command, args });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error("Browser command timed out"));
                }
            }, 30000);
        });
    }
}
