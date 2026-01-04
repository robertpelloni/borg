import { MemoryProvider, Memory, MemoryResult } from '../../interfaces/MemoryProvider.js';

export class Mem0Provider implements MemoryProvider {
    public id = 'mem0';
    public name = 'Mem0 (Cloud)';
    public type: 'vector' = 'vector';
    public capabilities: ('read' | 'write' | 'search' | 'delete')[] = ['read', 'write', 'search', 'delete'];

    private apiKey: string;
    private userId: string;
    private baseUrl = 'https://api.mem0.ai/v1';

    constructor(apiKey: string, userId: string = "default_user") {
        this.apiKey = apiKey;
        this.userId = userId;
    }

    async init(): Promise<void> {
        if (!this.apiKey) {
             console.warn("[Mem0] No API Key provided, functionality will be disabled.");
        }
    }

    private getHeaders() {
        return {
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    async store(memory: Memory): Promise<string> {
        if (!this.apiKey) return memory.id;

        try {
            const response = await fetch(`${this.baseUrl}/memories/`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    messages: [{ role: "user", content: memory.content }],
                    user_id: this.userId,
                    metadata: {
                        ...memory.metadata,
                        tags: memory.tags,
                        original_id: memory.id
                    }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Mem0 API Error: ${response.status} ${error}`);
            }

            const data = await response.json();
            // Mem0 returns its own ID, but we map it to ours or return theirs? 
            // For consistency, we keep our generated ID but log the cloud ID
            return memory.id;
        } catch (error) {
            console.error('[Mem0] Store failed:', error);
            throw error;
        }
    }

    async retrieve(id: string): Promise<Memory | null> {
        if (!this.apiKey) return null;
        
        try {
            const response = await fetch(`${this.baseUrl}/memories/${id}/`, {
                headers: this.getHeaders()
            });

            if (!response.ok) return null;
            
            const data: any = await response.json();
            return {
                id: data.id,
                content: data.memory,
                tags: [], // Mem0 structure might differ, simplified for now
                timestamp: new Date(data.created_at).getTime(),
                metadata: data.metadata
            };
        } catch (e) {
            return null;
        }
    }

    async search(query: string, limit: number = 5, embedding?: number[]): Promise<MemoryResult[]> {
        if (!this.apiKey) return [];

        try {
            const response = await fetch(`${this.baseUrl}/memories/search/`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    query,
                    user_id: this.userId,
                    limit
                })
            });

            if (!response.ok) {
                console.warn(`[Mem0] Search returned ${response.status}`);
                return [];
            }

            const data: any[] = await response.json();
            
            return data.map(item => ({
                id: item.id,
                content: item.memory,
                tags: [], // Extract from metadata if available
                timestamp: new Date(item.created_at || Date.now()).getTime(),
                metadata: item.metadata,
                similarity: item.score,
                sourceProvider: this.id
            }));

        } catch (error) {
            console.error('[Mem0] Search failed:', error);
            return [];
        }
    }

    async delete(id: string): Promise<void> {
        if (!this.apiKey) return;

        try {
            await fetch(`${this.baseUrl}/memories/${id}/`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
        } catch (e) {
            console.error('[Mem0] Delete failed:', e);
        }
    }
}
