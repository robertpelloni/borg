import os

content = r'''import vm from 'vm';
import { EventEmitter } from 'events';

let ivm: any;
try {
    ivm = require('isolated-vm');
} catch (e) {
    console.warn('[CodeExecutionManager] isolated-vm not found, falling back to node vm (less secure)');
}

interface Session {
    id: string;
    context: any; // vm.Context or ivm.Context
    jail?: any;   // ivm.Reference to global
    lastUsed: number;
}

export class CodeExecutionManager {
    private sessions: Map<string, Session> = new Map();
    private TTL = 1000 * 60 * 30; // 30 minutes

    constructor() {
        // Cleanup interval
        setInterval(() => this.cleanupSessions(), 1000 * 60 * 5);
    }

    private cleanupSessions() {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (now - session.lastUsed > this.TTL) {
                this.sessions.delete(id);
                // ivm context disposal if needed
                if (ivm && session.context instanceof ivm.Context) {
                    session.context.release();
                }
            }
        }
    }

    async execute(code: string, toolCallback: (name: string, args: any) => Promise<any>, sessionId?: string): Promise<string> {
        if (ivm) {
            return this.executeIsolated(code, toolCallback, sessionId);
        }
        return this.executeVm(code, toolCallback, sessionId);
    }

    private async getOrCreateIsolatedSession(sessionId?: string, toolCallback?: any): Promise<Session> {
        if (sessionId && this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            session.lastUsed = Date.now();
            return session;
        }

        const isolate = new ivm.Isolate({ memoryLimit: 128 });
        const context = await isolate.createContext();
        const jail = context.global;

        await jail.set('global', jail.derefInto());
        await jail.set('log', new ivm.Reference((...args: any[]) => {
            console.log('[Sandbox]', ...args);
        }));

        // We need to re-register the tool callback wrapper for new sessions
        await jail.set('call_tool_host', new ivm.Reference(async (name: string, args: any) => {
            return await toolCallback(name, args);
        }));

        const id = sessionId || Math.random().toString(36).substring(7);
        const session: Session = { id, context, jail, lastUsed: Date.now() };
        this.sessions.set(id, session);
        return session;
    }

    private async executeIsolated(code: string, toolCallback: (name: string, args: any) => Promise<any>, sessionId?: string): Promise<string> {
        try {
            const session = await this.getOrCreateIsolatedSession(sessionId, toolCallback);
            const context = session.context;

            // Prepare the script with a bridge function (only needed once per context really, but safe to redefine?)
            // If we redefine `call_tool` every time, it overrides previous.
            // But we want to persist variables.
            // We should check if `call_tool` exists?
            // For simplicity, we just execute it.

            const bootstrap = `
                if (typeof call_tool === 'undefined') {
                    global.call_tool = async (name, args) => {
                        return await call_tool_host.apply(undefined, [name, args], { result: { promise: true, copy: true }, arguments: { copy: true } });
                    };
                }
            `;
            await context.eval(bootstrap);

            // Wrap code in async IIFE
            const wrappedCode = `
                (async () => {
                    ${code}
                })()
            `;

            const script = await session.context.isolate.compileScript(wrappedCode);
            const result = await scriptObj.run(context, { timeout: 5000, promise: true });

            return JSON.stringify(result);

        } catch (err: any) {
            return `Error: ${err.message}`;
        }
    }

    private getOrCreateVmSession(sessionId?: string, toolCallback?: any): Session {
        if (sessionId && this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId)!;
            session.lastUsed = Date.now();
            // Update callback in context?
            // vm context is just an object. We can re-assign call_tool.
            session.context.call_tool = async (name: string, args: any) => {
                 console.log(`[Sandbox ${sessionId}] Calling tool: ${name}`);
                 return await toolCallback(name, args);
            };
            return session;
        }

        const context = vm.createContext({
            console: {
                log: (...args: any[]) => console.log('[Sandbox]', ...args)
            },
            call_tool: async (name: string, args: any) => {
                 console.log(`[Sandbox] Calling tool: ${name}`);
                 return await toolCallback(name, args);
            }
        });

        const id = sessionId || Math.random().toString(36).substring(7);
        const session: Session = { id, context, lastUsed: Date.now() };
        this.sessions.set(id, session);
        return session;
    }

    private async executeVm(code: string, toolCallback: (name: string, args: any) => Promise<any>, sessionId?: string): Promise<string> {
        try {
            const session = this.getOrCreateVmSession(sessionId, toolCallback);
            const context = session.context;

            const wrappedCode = `
                (async () => {
                    ${code}
                })();
            `;

            const resultPromise = vm.runInContext(wrappedCode, context, { timeout: 5000 });

            let result;
            if (resultPromise && typeof resultPromise.then === 'function') {
                result = await resultPromise;
            } else {
                result = resultPromise;
            }

            return JSON.stringify(result);
        } catch (err: any) {
            return `Error: ${err.message}`;
        }
    }
}
'''

with open('packages/core/src/managers/CodeExecutionManager.ts', 'w', encoding='utf-8') as f:
    f.write(content)
