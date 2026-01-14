import { MemoryPlugin, MemoryEntry } from '../managers/MemoryPluginManager.js';
// @ts-ignore
import { ChromaClient, Collection, DefaultEmbeddingFunction } from 'chromadb';

export class ChromaMemoryPlugin implements MemoryPlugin {
  name = 'chroma';
  private client: any;
  private collection: any = null;

  constructor(url: string = 'http://localhost:8000') {
    this.client = new ChromaClient({ path: url });
    this.init();
  }

  private async init() {
    try {
      this.collection = await this.client.getOrCreateCollection({
        name: 'aios-memory',
        embeddingFunction: new DefaultEmbeddingFunction()
      });
      console.log('[ChromaMemory] Connected to collection: aios-memory');
    } catch (e) {
      console.warn('[ChromaMemory] Failed to connect to ChromaDB. Ensure it is running.');
    }
  }

  async store(entry: MemoryEntry): Promise<string> {
    if (!this.collection) return '';

    await this.collection.add({
      ids: [entry.id],
      documents: [entry.content],
      metadatas: [{
        type: entry.type,
        tags: entry.tags.join(','),
        created: entry.createdAt,
        ...entry.metadata
      }]
    });

    return entry.id;
  }

  async retrieve(query: string, type?: string): Promise<MemoryEntry[]> {
    if (!this.collection) return [];

    const results = await this.collection.query({
      queryTexts: [query],
      nResults: 5,
      where: type ? { type: { $eq: type } } : undefined
    });

    if (!results.ids || !results.ids[0]) return [];

    return results.ids[0].map((id: string, index: number) => ({
      id,
      content: results.documents[0][index] || '',
      type: (results.metadatas[0][index]?.type as any) || 'short_term',
      tags: ((results.metadatas[0][index]?.tags as string) || '').split(','),
      metadata: results.metadatas[0][index] || {},
      createdAt: (results.metadatas[0][index]?.created as number) || Date.now()
    }));
  }
}
