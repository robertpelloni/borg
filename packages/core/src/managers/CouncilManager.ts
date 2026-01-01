import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec, spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export interface LocalSession {
    id: string;
    path: string;
    status: 'stopped' | 'starting' | 'running' | 'error';
    lastCheck: number;
    branch?: string;
    commit?: string;
    remote?: string;
    name: string;
    port?: number;
    logs: string[];
}

/**
 * CouncilManager
 * 
 * Manages "Local Sessions" (Autopilot Council) for the AIOS Hub.
 * It interfaces with the `submodules/opencode-autopilot-council` logic (conceptually).
 * 
 * In this v0.4.3 implementation, it directly manages a list of local directories
 * that the user wants to work on. It mimics the `SessionManager` from the council submodule
 * but adapted for the Core Hub architecture.
 */
export class CouncilManager extends EventEmitter {
    private sessions: Map<string, LocalSession> = new Map();
    private storageFile: string;
    private processes: Map<string, { agent: ChildProcess | null, council: ChildProcess | null }> = new Map();
    private nextPort = 13337;
    private councilSubmodulePath: string;

    constructor(storageDir: string) {
        super();
        this.storageFile = path.join(storageDir, 'council_sessions.json');
        // Resolve path to submodule: 
        // We try to find 'submodules' relative to the project root.
        // storageDir is usually packages/core/data
        // So we look up from there.
        const potentialPaths = [
            path.resolve(process.cwd(), 'submodules', 'opencode-autopilot-council'), // If running from root
            path.resolve(storageDir, '..', '..', '..', 'submodules', 'opencode-autopilot-council') // If running from packages/core
        ];

        this.councilSubmodulePath = potentialPaths.find(p => fs.existsSync(p)) || potentialPaths[0];
        console.log(`[CouncilManager] Resolved submodule path to: ${this.councilSubmodulePath}`);
        
        this.loadSessions();
    }

    private loadSessions() {
        try {
            if (fs.existsSync(this.storageFile)) {
                const data = fs.readFileSync(this.storageFile, 'utf-8');
                const rawSessions = JSON.parse(data);
                
                // Rehydrate map
                if (Array.isArray(rawSessions)) {
                    rawSessions.forEach((s: any) => {
                        this.sessions.set(s.id, {
                            ...s,
                            status: 'stopped', // Always start as stopped on reboot
                            lastCheck: Date.now(),
                            logs: []
                        });
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load council sessions:', error);
        }
    }

    private saveSessions() {
        try {
            const sessionsArray = Array.from(this.sessions.values()).map(s => {
                // Don't save logs or port to disk to save space/sanity
                const { logs, port, ...rest } = s;
                return rest;
            });
            fs.writeFileSync(this.storageFile, JSON.stringify(sessionsArray, null, 2));
        } catch (error) {
            console.error('Failed to save council sessions:', error);
        }
    }

    public getSessions(): LocalSession[] {
        return Array.from(this.sessions.values()).sort((a, b) => b.lastCheck - a.lastCheck);
    }

    public getSessionLogs(id: string): string[] {
        return this.sessions.get(id)?.logs || [];
    }

    public async addSession(repoPath: string): Promise<LocalSession> {
        // Check if already exists
        const existing = Array.from(this.sessions.values()).find(s => s.path === repoPath);
        if (existing) {
            return existing;
        }

        const id = uuidv4();
        const gitInfo = await this.getGitInfo(repoPath);
        const name = path.basename(repoPath);

        const session: LocalSession = {
            id,
            path: repoPath,
            name,
            status: 'stopped',
            lastCheck: Date.now(),
            logs: [],
            ...gitInfo
        };

        this.sessions.set(id, session);
        this.saveSessions();
        this.emit('session:added', session);
        return session;
    }

    public async removeSession(id: string) {
        if (this.sessions.has(id)) {
            await this.stopSession(id);
            this.sessions.delete(id);
            this.saveSessions();
            this.emit('session:removed', id);
        }
    }

    public async refreshSession(id: string) {
        const session = this.sessions.get(id);
        if (!session) return;

        const gitInfo = await this.getGitInfo(session.path);
        const updated = {
            ...session,
            ...gitInfo,
            lastCheck: Date.now()
        };
        
        this.sessions.set(id, updated);
        this.saveSessions(); // Save potentially updated git info
        this.emit('session:updated', updated);
        return updated;
    }

    public async startSession(id: string) {
        const session = this.sessions.get(id);
        if (!session) throw new Error("Session not found");
        if (session.status === 'running' || session.status === 'starting') return;

        session.status = 'starting';
        session.logs.push(`[System] Starting session for ${session.name}...`);
        this.emit('session:updated', session);

        try {
            const port = this.nextPort++;
            session.port = port;

            // 1. Spawn Agent (OpenCode)
            const agentCmd = process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
            session.logs.push(`[System] Spawning agent on port ${port}...`);
            
            // Note: We assume 'opencode' is in the PATH.
            const agentProcess = spawn(agentCmd, [session.path, '--port', port.toString()], {
                env: { ...process.env, PORT: port.toString() },
                shell: true
            });

            this.setupProcessLogging(session, agentProcess, "Agent");

            // 2. Wait a moment for Agent to start
            // TODO: Health check logic? For now, 2 seconds delay.
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 3. Spawn Council Controller (Submodule)
            const controllerScript = path.join(this.councilSubmodulePath, 'dist', 'controller.js');
            
            if (!fs.existsSync(controllerScript)) {
                throw new Error(`Council controller not found at ${controllerScript}. Please build the submodule.`);
            }

            session.logs.push(`[System] Spawning Council Controller...`);
            const councilProcess = spawn('node', [controllerScript], {
                env: { 
                    ...process.env, 
                    OPENCODE_URL: `http://localhost:${port}`,
                    // Pass keys if they exist in process.env
                },
                cwd: this.councilSubmodulePath // Run in submodule dir so it finds its node_modules
            });

            this.setupProcessLogging(session, councilProcess, "Council");

            this.processes.set(id, { agent: agentProcess, council: councilProcess });
            session.status = 'running';
            this.emit('session:updated', session);

            // Handle exits
            const handleExit = (code: number | null, source: string) => {
                session.logs.push(`[System] ${source} exited with code ${code}`);
                if (session.status === 'running') {
                    // One died, kill the other?
                    this.stopSession(id); 
                }
            };

            agentProcess.on('exit', (code) => handleExit(code, 'Agent'));
            councilProcess.on('exit', (code) => handleExit(code, 'Council'));

        } catch (error: any) {
            session.status = 'error';
            session.logs.push(`[Error] Failed to start: ${error.message}`);
            this.emit('session:updated', session);
            console.error(`Failed to start session ${id}:`, error);
        }
    }

    public async stopSession(id: string) {
        const session = this.sessions.get(id);
        if (!session) return;

        session.status = 'stopped';
        session.logs.push(`[System] Stopping session...`);
        
        const procs = this.processes.get(id);
        if (procs) {
            if (procs.council) procs.council.kill();
            if (procs.agent) procs.agent.kill();
            this.processes.delete(id);
        }

        this.emit('session:updated', session);
    }

    private setupProcessLogging(session: LocalSession, proc: ChildProcess, prefix: string) {
        proc.stdout?.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
                if (line.trim()) {
                    const msg = `[${prefix}] ${line.trim()}`;
                    session.logs.push(msg);
                    if (session.logs.length > 1000) session.logs.shift();
                }
            });
        });

        proc.stderr?.on('data', (data) => {
             const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
                if (line.trim()) {
                    const msg = `[${prefix} ERR] ${line.trim()}`;
                    session.logs.push(msg);
                    if (session.logs.length > 1000) session.logs.shift();
                }
            });
        });
    }

    private async getGitInfo(repoPath: string) {
        try {
            // Check if directory exists first
            if (!fs.existsSync(repoPath)) {
                return { branch: 'missing-dir', commit: '', remote: '' };
            }

            const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
            const { stdout: commit } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
            const { stdout: remote } = await execAsync('git config --get remote.origin.url', { cwd: repoPath }).catch(() => ({ stdout: '' }));
            
            return {
                branch: branch.trim(),
                commit: commit.trim(),
                remote: remote.trim()
            };
        } catch (e) {
            return { branch: 'unknown', commit: '', remote: '' };
        }
    }
}
