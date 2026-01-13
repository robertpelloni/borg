export interface BM25Config {
  k1: number;
  b: number;
}

export interface Document {
  id: string;
  content: string;
  tokens?: string[];
  metadata?: Record<string, unknown>;
}

export interface BM25Result {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class BM25Index {
  private config: BM25Config;
  private documents: Map<string, Document> = new Map();
  private termFrequencies: Map<string, Map<string, number>> = new Map();
  private documentFrequencies: Map<string, number> = new Map();
  private documentLengths: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private totalDocuments: number = 0;

  constructor(config: Partial<BM25Config> = {}) {
    this.config = {
      k1: config.k1 ?? 1.5,
      b: config.b ?? 0.75,
    };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
  }

  private updateAvgDocLength(): void {
    if (this.documentLengths.size === 0) {
      this.avgDocLength = 0;
      return;
    }
    let totalLength = 0;
    for (const length of this.documentLengths.values()) {
      totalLength += length;
    }
    this.avgDocLength = totalLength / this.documentLengths.size;
  }

  add(id: string, content: string, metadata?: Record<string, unknown>): void {
    if (this.documents.has(id)) {
      this.remove(id);
    }

    const tokens = this.tokenize(content);
    const document: Document = { id, content, tokens, metadata };
    this.documents.set(id, document);

    const termFreq = new Map<string, number>();
    const seenTerms = new Set<string>();

    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
      
      if (!seenTerms.has(token)) {
        seenTerms.add(token);
        this.documentFrequencies.set(token, (this.documentFrequencies.get(token) ?? 0) + 1);
      }
    }

    this.termFrequencies.set(id, termFreq);
    this.documentLengths.set(id, tokens.length);
    this.totalDocuments++;
    this.updateAvgDocLength();
  }

  remove(id: string): boolean {
    const document = this.documents.get(id);
    if (!document) return false;

    const termFreq = this.termFrequencies.get(id);
    if (termFreq) {
      for (const term of termFreq.keys()) {
        const df = this.documentFrequencies.get(term) ?? 0;
        if (df <= 1) {
          this.documentFrequencies.delete(term);
        } else {
          this.documentFrequencies.set(term, df - 1);
        }
      }
    }

    this.documents.delete(id);
    this.termFrequencies.delete(id);
    this.documentLengths.delete(id);
    this.totalDocuments--;
    this.updateAvgDocLength();
    return true;
  }

  private calculateIDF(term: string): number {
    const df = this.documentFrequencies.get(term) ?? 0;
    if (df === 0) return 0;
    return Math.log((this.totalDocuments - df + 0.5) / (df + 0.5) + 1);
  }

  private scoreDocument(docId: string, queryTerms: string[]): number {
    const termFreq = this.termFrequencies.get(docId);
    const docLength = this.documentLengths.get(docId);
    
    if (!termFreq || docLength === undefined) return 0;

    let score = 0;
    const { k1, b } = this.config;

    for (const term of queryTerms) {
      const tf = termFreq.get(term) ?? 0;
      if (tf === 0) continue;

      const idf = this.calculateIDF(term);
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / this.avgDocLength));
      
      score += idf * (numerator / denominator);
    }

    return score;
  }

  search(query: string, k: number = 10): BM25Result[] {
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) return [];

    const results: BM25Result[] = [];

    for (const [docId, document] of this.documents) {
      const score = this.scoreDocument(docId, queryTerms);
      if (score > 0) {
        results.push({
          id: docId,
          score,
          metadata: document.metadata,
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  getDocument(id: string): Document | null {
    return this.documents.get(id) ?? null;
  }

  size(): number {
    return this.totalDocuments;
  }

  clear(): void {
    this.documents.clear();
    this.termFrequencies.clear();
    this.documentFrequencies.clear();
    this.documentLengths.clear();
    this.avgDocLength = 0;
    this.totalDocuments = 0;
  }

  getStats(): {
    documentCount: number;
    uniqueTerms: number;
    avgDocLength: number;
    k1: number;
    b: number;
  } {
    return {
      documentCount: this.totalDocuments,
      uniqueTerms: this.documentFrequencies.size,
      avgDocLength: this.avgDocLength,
      k1: this.config.k1,
      b: this.config.b,
    };
  }
}
