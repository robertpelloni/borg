import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface Session {
    id: string;
    agentName: string;
    timestamp: number;
    messages: any[];
}

export class SessionManager extends EventEmitter {
    private sessionsDir: string;

    constructor(rootDir: string) {
        super();
        this.sessionsDir = path.join(rootDir, 'sessions');
        this.ensureDir();
    }

    private ensureDir() {
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    saveSession(id: string, agentName: string, messages: any[]) {
        const session: Session = {
            id,
            agentName,
            timestamp: Date.now(),
            messages
        };
        const filepath = path.join(this.sessionsDir, `${id}.json`);
        fs.writeFileSync(filepath, JSON.stringify(session, null, 2));
        this.emit('sessionSaved', session);
    }

    loadSession(id: string): Session | null {
        const filepath = path.join(this.sessionsDir, `${id}.json`);
        if (fs.existsSync(filepath)) {
            try {
                return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
            } catch (e) {
                console.error(`Failed to load session ${id}`, e);
            }
        }
        return null;
    }

    listSessions(): Session[] {
        if (!fs.existsSync(this.sessionsDir)) return [];
        return fs.readdirSync(this.sessionsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                try {
                    return JSON.parse(fs.readFileSync(path.join(this.sessionsDir, f), 'utf-8'));
                } catch {
                    return null;
                }
            })
            .filter(Boolean) as Session[];
    }

    deleteSession(id: string): boolean {
        const filepath = path.join(this.sessionsDir, `${id}.json`);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            this.emit('sessionDeleted', id);
            return true;
        }
        return false;
    }
}
