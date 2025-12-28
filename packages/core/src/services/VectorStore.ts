import { ModelGateway } from '../gateway/ModelGateway.js';
import fs from 'fs';
import path from 'path';

export interface VectorDocument {
    id: string;
    content: string;
    metadata: any;
    embedding?: number[];
}

export class VectorStore {
    private documents: VectorDocument[] = [];
    private dbPath: string;

    constructor(private modelGateway: ModelGateway, private dataDir: string) {
        this.dbPath = path.join(dataDir, 'vector_store.json');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        this.load();
    }

    private load() {
        if (fs.existsSync(this.dbPath)) {
            try {
                this.documents = JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
            } catch (e) {
                console.error("Failed to load vector store:", e);
                this.documents = [];
            }
        }
    }

    private save() {
        fs.writeFileSync(this.dbPath, JSON.stringify(this.documents, null, 2));
    }

    async add(content: string, metadata: any = {}) {
        const id = Math.random().toString(36).substring(7);
        // In a real implementation, we would fetch embedding here via modelGateway
        // const embedding = await this.modelGateway.getEmbedding(content);
        const doc: VectorDocument = { id, content, metadata };
        this.documents.push(doc);
        this.save();
        return id;
    }

    async search(query: string, limit = 5): Promise<VectorDocument[]> {
        // Mock semantic search with basic keyword matching + random scoring for now
        // since we don't have a local embedding model installed yet.
        const keywords = query.toLowerCase().split(' ');

        return this.documents
            .map(doc => {
                let score = 0;
                const contentLower = doc.content.toLowerCase();
                keywords.forEach(k => {
                    if (contentLower.includes(k)) score += 1;
                });
                return { ...doc, score };
            })
            .filter(d => d.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
}
