import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface Session {
    id: string;
    agentName: string;
    timestamp: number;
    messages: Message[];
    shareToken?: string;
    shareExpiresAt?: number;
    isPublic?: boolean;
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
}

export interface ShareLinkResult {
    shareToken: string;
    shareUrl: string;
    expiresAt: number | null;
}

export class SessionManager extends EventEmitter {
    private sessionsDir: string;
    private shareTokenIndex: Map<string, string> = new Map();
    private baseUrl: string;

    constructor(rootDir: string, baseUrl: string = 'http://localhost:3000') {
        super();
        this.sessionsDir = path.join(rootDir, 'sessions');
        this.baseUrl = baseUrl;
        this.ensureDir();
        this.buildShareIndex();
    }

    private ensureDir() {
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    private buildShareIndex(): void {
        const sessions = this.listSessions();
        for (const session of sessions) {
            if (session.shareToken) {
                this.shareTokenIndex.set(session.shareToken, session.id);
            }
        }
    }

    private generateShareToken(): string {
        return crypto.randomBytes(16).toString('base64url');
    }

    saveSession(id: string, agentName: string, messages: Message[]) {
        const existing = this.loadSession(id);
        const session: Session = {
            id,
            agentName,
            timestamp: Date.now(),
            messages,
            shareToken: existing?.shareToken,
            shareExpiresAt: existing?.shareExpiresAt,
            isPublic: existing?.isPublic,
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
        const session = this.loadSession(id);
        if (session?.shareToken) {
            this.shareTokenIndex.delete(session.shareToken);
        }
        const filepath = path.join(this.sessionsDir, `${id}.json`);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            this.emit('sessionDeleted', id);
            return true;
        }
        return false;
    }

    createShareLink(sessionId: string, expiresInHours?: number): ShareLinkResult | null {
        const session = this.loadSession(sessionId);
        if (!session) return null;

        const shareToken = this.generateShareToken();
        const expiresAt = expiresInHours 
            ? Date.now() + (expiresInHours * 60 * 60 * 1000) 
            : null;

        session.shareToken = shareToken;
        session.shareExpiresAt = expiresAt ?? undefined;
        session.isPublic = true;

        const filepath = path.join(this.sessionsDir, `${sessionId}.json`);
        fs.writeFileSync(filepath, JSON.stringify(session, null, 2));
        
        this.shareTokenIndex.set(shareToken, sessionId);
        this.emit('shareCreated', { sessionId, shareToken });

        return {
            shareToken,
            shareUrl: `${this.baseUrl}/share/${shareToken}`,
            expiresAt,
        };
    }

    getSessionByShareToken(shareToken: string): Session | null {
        const sessionId = this.shareTokenIndex.get(shareToken);
        if (!sessionId) return null;

        const session = this.loadSession(sessionId);
        if (!session) return null;

        if (session.shareExpiresAt && Date.now() > session.shareExpiresAt) {
            this.revokeShareLink(sessionId);
            return null;
        }

        return session;
    }

    revokeShareLink(sessionId: string): boolean {
        const session = this.loadSession(sessionId);
        if (!session) return false;

        if (session.shareToken) {
            this.shareTokenIndex.delete(session.shareToken);
        }

        session.shareToken = undefined;
        session.shareExpiresAt = undefined;
        session.isPublic = false;

        const filepath = path.join(this.sessionsDir, `${sessionId}.json`);
        fs.writeFileSync(filepath, JSON.stringify(session, null, 2));
        
        this.emit('shareRevoked', sessionId);
        return true;
    }

    getSharedSessions(): Session[] {
        return this.listSessions().filter(s => s.isPublic && s.shareToken);
    }

    setBaseUrl(url: string): void {
        this.baseUrl = url;
    }
}
