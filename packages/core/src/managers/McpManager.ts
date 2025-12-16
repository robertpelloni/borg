import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import path from 'path';

export class McpManager extends EventEmitter {
    private servers: Map<string, { status: 'running' | 'stopped', process: any | null }> = new Map();

    constructor(private mcpDir: string) {
        super();
    }

    async startServerSimple(name: string, config: any) {
        const cmd = config.command || 'node';
        const args = config.args || [];

        // Resolve paths relative to repo root if they look like file paths
        const finalArgs = args.map((arg: any) => {
             if (typeof arg === 'string' && arg.includes('/')) {
                 // If the path is not absolute, resolve it relative to mcpDir
                 return path.isAbsolute(arg) ? arg : path.resolve(this.mcpDir, arg);
             }
             return arg;
        });

        console.log(`Spawning ${cmd} ${finalArgs.join(' ')}`);

        const child = spawn(cmd, finalArgs, {
            stdio: ['ignore', 'inherit', 'inherit'], // inherit stdout/err so we can see it in logs
            detached: false
        });

        this.servers.set(name, {
            status: 'running',
            process: child
        });

        child.on('exit', (code) => {
            console.log(`Server ${name} exited with code ${code}`);
            this.servers.set(name, { status: 'stopped', process: null });
            this.emit('updated', this.getAllServers());
        });

        this.emit('updated', this.getAllServers());
    }

    async stopServer(name: string) {
        const server = this.servers.get(name);
        if (server && server.process) {
            server.process.kill();
            this.servers.set(name, { ...server, status: 'stopped', process: null });
            this.emit('updated', this.getAllServers());
        }
    }

    getAllServers() {
        const result: any[] = [];
        for (const [name, data] of this.servers.entries()) {
            result.push({ name, status: data.status });
        }
        return result;
    }
}
