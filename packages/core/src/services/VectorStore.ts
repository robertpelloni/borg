import { ModelGateway } from '../gateway/ModelGateway.js';

interface VectorDocument {
    id: string;
    text: string;
    vector: number[];
    metadata: any;
}

export class VectorStore {
    private documents: VectorDocument[] = [];

    constructor(private gateway: ModelGateway) {}

    async add(id: string, text: string, metadata: any = {}) {
        try {
            const vector = await this.gateway.getEmbedding(text);
            if (!vector) return; // Gateway might return null if no API key

            // Remove existing if any
            this.documents = this.documents.filter(d => d.id !== id);

            this.documents.push({ id, text, vector, metadata });
        } catch (e) {
            console.warn('[VectorStore] Failed to embed:', e);
        }
    }

    async search(query: string, limit: number = 5): Promise<any[]> {
        try {
            const queryVector = await this.gateway.getEmbedding(query);
            if (!queryVector) return [];

            const results = this.documents.map(doc => ({
                doc,
                score: this.cosineSimilarity(queryVector, doc.vector)
            }));

            // Sort descending
            results.sort((a, b) => b.score - a.score);

            return results.slice(0, limit).map(r => ({
                ...r.doc.metadata,
                text: r.doc.text,
                score: r.score
            }));
        } catch (e) {
            console.warn('[VectorStore] Search failed:', e);
            return [];
        }
    }

    private cosineSimilarity(a: number[], b: number[]) {
        let dot = 0;
        let magA = 0;
        let magB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            magA += a[i] * a[i];
            magB += b[i] * b[i];
        }
        return dot / (Math.sqrt(magA) * Math.sqrt(magB));
    }
}
