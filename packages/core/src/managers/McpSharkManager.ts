import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export class McpSharkManager {
    private process: ChildProcess | null = null;
    private rootDir: string;
    private sharkDir: string;

    constructor(rootDir: string) {
        this.rootDir = rootDir;
        this.sharkDir = path.resolve(rootDir, '../../submodules/mcp-shark');
    }

    async start() {
        const binPath = path.join(this.sharkDir, 'bin', 'mcp-shark.js');
        const configDir = path.join(this.rootDir, 'data', 'mcp-shark');
        
        if (!fs.existsSync(binPath)) {
            console.error('[McpShark] Binary not found at', binPath);
            return;
        }

        console.log('[McpShark] Starting MCP Shark...');
        
        this.process = spawn('node', [binPath], {
            env: {
                ...process.env,
                MCP_SHARK_HOME: configDir,
                MCP_SHARK_PORT: '9853',
                MCP_SHARK_SERVER_PORT: '9851'
            },
            stdio: 'inherit'
        });

        this.process.on('error', (err) => {
            console.error('[McpShark] Failed to start:', err);
        });

        this.process.on('exit', (code) => {
            console.log(`[McpShark] Exited with code ${code}`);
            this.process = null;
        });
    }

    stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}


