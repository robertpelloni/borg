import { EventEmitter } from 'events';
import { HnswIndex, type SearchResult as HnswResult, type HnswConfig } from './HnswIndex.js';
import { BM25Index, type BM25Result, type BM25Config } from './BM25Index.js';

export interface RagDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface RagSearchResult {
  id: string;
  content: string;
  score: number;
  hnswScore?: number;
  bm25Score?: number;
  metadata?: Record<string, unknown>;
}

export interface HybridRagConfig {
  hnswConfig?: Partial<HnswConfig>;
  bm25Config?: Partial<BM25Config>;
  hnswWeight?: number;
  bm25Weight?: number;
  minScore?: number;
  maxResults?: number;
  reranking?: boolean;
}

export type EmbeddingFunction = (text: string) => Promise<number[]>;

export class HybridRagSystem extends EventEmitter {
  private hnswIndex: HnswIndex;
  private bm25Index: BM25Index;
  private documents: Map<string, RagDocument> = new Map();
  private embeddingFn: EmbeddingFunction | null = null;
  private config: Required<Omit<HybridRagConfig, 'hnswConfig' | 'bm25Config'>>;

  constructor(config: HybridRagConfig = {}) {
    super();
    this.hnswIndex = new HnswIndex(config.hnswConfig);
    this.bm25Index = new BM25Index(config.bm25Config);
    this.config = {
      hnswWeight: config.hnswWeight ?? 0.7,
      bm25Weight: config.bm25Weight ?? 0.3,
      minScore: config.minScore ?? 0.1,
      maxResults: config.maxResults ?? 10,
      reranking: config.reranking ?? true,
    };
  }

  setEmbeddingFunction(fn: EmbeddingFunction): void {
    this.embeddingFn = fn;
  }

  async addDocument(
    id: string,
    content: string,
    embedding?: number[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    let finalEmbedding = embedding;

    if (!finalEmbedding && this.embeddingFn) {
      finalEmbedding = await this.embeddingFn(content);
    }

    const document: RagDocument = {
      id,
      content,
      embedding: finalEmbedding,
      metadata,
      createdAt: Date.now(),
    };

    this.documents.set(id, document);
    this.bm25Index.add(id, content, metadata);

    if (finalEmbedding) {
      this.hnswIndex.add(id, finalEmbedding, metadata);
    }

    this.emit('documentAdded', { id, hasEmbedding: !!finalEmbedding });
  }

  async addDocuments(
    docs: Array<{ id: string; content: string; embedding?: number[]; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    for (const doc of docs) {
      await this.addDocument(doc.id, doc.content, doc.embedding, doc.metadata);
    }
    this.emit('bulkAdded', { count: docs.length });
  }

  removeDocument(id: string): boolean {
    const existed = this.documents.delete(id);
    if (existed) {
      this.bm25Index.remove(id);
      this.hnswIndex.remove(id);
      this.emit('documentRemoved', { id });
    }
    return existed;
  }

  private normalizeScores(results: Array<{ id: string; score: number }>): Map<string, number> {
    if (results.length === 0) return new Map();

    const scores = results.map(r => r.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;

    const normalized = new Map<string, number>();
    for (const result of results) {
      const normalizedScore = max === min 
        ? (result.score > 0 ? 1.0 : 0.0) 
        : (result.score - min) / range;
      normalized.set(result.id, normalizedScore);
    }
    return normalized;
  }

  async search(query: string, queryEmbedding?: number[]): Promise<RagSearchResult[]> {
    let embedding = queryEmbedding;

    if (!embedding && this.embeddingFn) {
      embedding = await this.embeddingFn(query);
    }

    const bm25Results = this.bm25Index.search(query, this.config.maxResults * 2);

    let hnswResults: HnswResult[] = [];
    if (embedding) {
      hnswResults = this.hnswIndex.search(embedding, this.config.maxResults * 2);
    }

    const bm25Normalized = this.normalizeScores(bm25Results);
    const hnswNormalized = this.normalizeScores(hnswResults);

    const allIds = new Set<string>([
      ...bm25Results.map(r => r.id),
      ...hnswResults.map(r => r.id),
    ]);

    const combinedResults: RagSearchResult[] = [];

    for (const id of allIds) {
      const document = this.documents.get(id);
      if (!document) continue;

      const bm25Score = bm25Normalized.get(id) ?? 0;
      const hnswScore = hnswNormalized.get(id) ?? 0;

      const combinedScore = 
        (bm25Score * this.config.bm25Weight) + 
        (hnswScore * this.config.hnswWeight);

      if (combinedScore >= this.config.minScore) {
        combinedResults.push({
          id,
          content: document.content,
          score: combinedScore,
          hnswScore: hnswResults.find(r => r.id === id)?.score,
          bm25Score: bm25Results.find(r => r.id === id)?.score,
          metadata: document.metadata,
        });
      }
    }

    combinedResults.sort((a, b) => b.score - a.score);

    if (this.config.reranking && combinedResults.length > 1) {
      return this.rerank(query, combinedResults.slice(0, this.config.maxResults));
    }

    return combinedResults.slice(0, this.config.maxResults);
  }

  private rerank(query: string, results: RagSearchResult[]): RagSearchResult[] {
    const queryTerms = new Set(query.toLowerCase().split(/\s+/));
    
    for (const result of results) {
      const contentTerms = result.content.toLowerCase().split(/\s+/);
      let termOverlap = 0;
      let positionBonus = 0;

      for (let i = 0; i < contentTerms.length; i++) {
        if (queryTerms.has(contentTerms[i])) {
          termOverlap++;
          positionBonus += 1 / (i + 1);
        }
      }

      const overlapScore = termOverlap / queryTerms.size;
      const rerankBonus = (overlapScore * 0.1) + (positionBonus * 0.05);
      result.score = Math.min(1, result.score + rerankBonus);
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async searchBM25Only(query: string, k?: number): Promise<RagSearchResult[]> {
    const results = this.bm25Index.search(query, k ?? this.config.maxResults);
    return results.map(r => {
      const doc = this.documents.get(r.id);
      return {
        id: r.id,
        content: doc?.content ?? '',
        score: r.score,
        bm25Score: r.score,
        metadata: r.metadata,
      };
    });
  }

  async searchHnswOnly(queryEmbedding: number[], k?: number): Promise<RagSearchResult[]> {
    const results = this.hnswIndex.search(queryEmbedding, k ?? this.config.maxResults);
    return results.map(r => {
      const doc = this.documents.get(r.id);
      return {
        id: r.id,
        content: doc?.content ?? '',
        score: r.score,
        hnswScore: r.score,
        metadata: r.data as Record<string, unknown>,
      };
    });
  }

  setWeights(hnswWeight: number, bm25Weight: number): void {
    const total = hnswWeight + bm25Weight;
    this.config.hnswWeight = hnswWeight / total;
    this.config.bm25Weight = bm25Weight / total;
  }

  getDocument(id: string): RagDocument | null {
    return this.documents.get(id) ?? null;
  }

  getAllDocuments(): RagDocument[] {
    return Array.from(this.documents.values());
  }

  size(): number {
    return this.documents.size;
  }

  clear(): void {
    this.documents.clear();
    this.hnswIndex.clear();
    this.bm25Index.clear();
    this.emit('cleared');
  }

  getStats(): {
    documentCount: number;
    hnswStats: ReturnType<HnswIndex['getStats']>;
    bm25Stats: ReturnType<BM25Index['getStats']>;
    weights: { hnsw: number; bm25: number };
  } {
    return {
      documentCount: this.documents.size,
      hnswStats: this.hnswIndex.getStats(),
      bm25Stats: this.bm25Index.getStats(),
      weights: {
        hnsw: this.config.hnswWeight,
        bm25: this.config.bm25Weight,
      },
    };
  }
}
