declare module 'chromadb' {
  export class ChromaClient {
    constructor(params: { path: string });
    getOrCreateCollection(params: { name: string; embeddingFunction?: any }): Promise<Collection>;
  }

  export class Collection {
    add(params: { ids: string[]; documents: string[]; metadatas?: any[] }): Promise<void>;
    query(params: { queryTexts: string[]; nResults: number; where?: any }): Promise<{ ids: string[][]; documents: string[][]; metadatas: any[][] }>;
  }

  export class DefaultEmbeddingFunction {
    constructor();
  }
}
