import path from 'path';
import fs from 'fs';
import { MemoryManager } from './MemoryManager.js';

export interface Handoff {
    id: string;
    timestamp: string;
    description: string;
    context: any;
    status: 'pending' | 'claimed';
}

export class HandoffManager {
    private handoffsDir: string;

    constructor(private rootDir: string, private memoryManager: MemoryManager) {
        this.handoffsDir = path.join(rootDir, 'handoffs');
        if (!fs.existsSync(this.handoffsDir)) fs.mkdirSync(this.handoffsDir, { recursive: true });
    }

    async createHandoff(description: string, context: any): Promise<string> {
        const id = `handoff-${Date.now()}`;
        const handoff: Handoff = {
            id,
            timestamp: new Date().toISOString(),
            description,
            context,
            status: 'pending'
        };

        const filepath = path.join(this.handoffsDir, `${id}.json`);
        fs.writeFileSync(filepath, JSON.stringify(handoff, null, 2));

        // Auto-remember that a handoff was created
        await this.memoryManager.remember({ content: `Created handoff ${id}: ${description}`, tags: ['handoff'] });

        return id;
    }

    getHandoffs(): Handoff[] {
        if (!fs.existsSync(this.handoffsDir)) return [];
        return fs.readdirSync(this.handoffsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => JSON.parse(fs.readFileSync(path.join(this.handoffsDir, f), 'utf-8')))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
}
