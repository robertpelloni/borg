import { EventEmitter } from 'events';

export interface HnswConfig {
  dimensions: number;
  maxElements: number;
  efConstruction: number;
  efSearch: number;
  m: number;
}

export interface HnswNode {
  id: string;
  vector: number[];
  neighbors: Map<number, string[]>;
  data?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  data?: Record<string, unknown>;
}

export class HnswIndex extends EventEmitter {
  private config: HnswConfig;
  private nodes: Map<string, HnswNode> = new Map();
  private entryPoint: string | null = null;
  private maxLevel: number = 0;

  constructor(config: Partial<HnswConfig> = {}) {
    super();
    this.config = {
      dimensions: config.dimensions ?? 1536,
      maxElements: config.maxElements ?? 100000,
      efConstruction: config.efConstruction ?? 200,
      efSearch: config.efSearch ?? 50,
      m: config.m ?? 16,
    };
  }

  private getRandomLevel(): number {
    const ml = 1 / Math.log(this.config.m);
    let level = 0;
    while (Math.random() < Math.exp(-level / ml) && level < 16) {
      level++;
    }
    return level;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private selectNeighbors(
    candidates: Array<{ id: string; score: number }>,
    m: number
  ): string[] {
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, m)
      .map(c => c.id);
  }

  private searchLayer(
    query: number[],
    entryPointId: string,
    ef: number,
    level: number
  ): Array<{ id: string; score: number }> {
    const visited = new Set<string>();
    const candidates: Array<{ id: string; score: number }> = [];
    const results: Array<{ id: string; score: number }> = [];

    const entryNode = this.nodes.get(entryPointId);
    if (!entryNode) return results;

    const entryScore = this.cosineSimilarity(query, entryNode.vector);
    candidates.push({ id: entryPointId, score: entryScore });
    results.push({ id: entryPointId, score: entryScore });
    visited.add(entryPointId);

    while (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const current = candidates.shift()!;

      const worstResult = results.length > 0 
        ? results[results.length - 1].score 
        : -Infinity;

      if (current.score < worstResult && results.length >= ef) break;

      const currentNode = this.nodes.get(current.id);
      if (!currentNode) continue;

      const neighbors = currentNode.neighbors.get(level) ?? [];
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const score = this.cosineSimilarity(query, neighborNode.vector);
        
        if (results.length < ef || score > worstResult) {
          candidates.push({ id: neighborId, score });
          results.push({ id: neighborId, score });
          results.sort((a, b) => b.score - a.score);
          if (results.length > ef) results.pop();
        }
      }
    }

    return results;
  }

  add(id: string, vector: number[], data?: Record<string, unknown>): void {
    if (vector.length !== this.config.dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${this.config.dimensions}, got ${vector.length}`);
    }

    const level = this.getRandomLevel();
    const node: HnswNode = {
      id,
      vector,
      neighbors: new Map(),
      data,
    };

    for (let l = 0; l <= level; l++) {
      node.neighbors.set(l, []);
    }

    if (this.nodes.size === 0) {
      this.nodes.set(id, node);
      this.entryPoint = id;
      this.maxLevel = level;
      this.emit('added', { id, level });
      return;
    }

    let currentNode = this.entryPoint!;

    for (let l = this.maxLevel; l > level; l--) {
      const results = this.searchLayer(vector, currentNode, 1, l);
      if (results.length > 0) {
        currentNode = results[0].id;
      }
    }

    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const candidates = this.searchLayer(vector, currentNode, this.config.efConstruction, l);
      const neighbors = this.selectNeighbors(candidates, this.config.m);
      
      node.neighbors.set(l, neighbors);

      for (const neighborId of neighbors) {
        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const existingNeighbors = neighborNode.neighbors.get(l) ?? [];
        existingNeighbors.push(id);

        if (existingNeighbors.length > this.config.m * 2) {
          const scored = existingNeighbors.map(nId => {
            const n = this.nodes.get(nId);
            return {
              id: nId,
              score: n ? this.cosineSimilarity(neighborNode.vector, n.vector) : 0,
            };
          });
          neighborNode.neighbors.set(l, this.selectNeighbors(scored, this.config.m * 2));
        } else {
          neighborNode.neighbors.set(l, existingNeighbors);
        }
      }

      if (candidates.length > 0) {
        currentNode = candidates[0].id;
      }
    }

    this.nodes.set(id, node);

    if (level > this.maxLevel) {
      this.maxLevel = level;
      this.entryPoint = id;
    }

    this.emit('added', { id, level });
  }

  search(query: number[], k: number = 10): SearchResult[] {
    if (this.nodes.size === 0 || !this.entryPoint) return [];

    let currentNode = this.entryPoint;

    for (let l = this.maxLevel; l > 0; l--) {
      const results = this.searchLayer(query, currentNode, 1, l);
      if (results.length > 0) {
        currentNode = results[0].id;
      }
    }

    const results = this.searchLayer(query, currentNode, Math.max(k, this.config.efSearch), 0);

    return results.slice(0, k).map(r => ({
      id: r.id,
      score: r.score,
      data: this.nodes.get(r.id)?.data,
    }));
  }

  remove(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    for (const [level, neighbors] of node.neighbors) {
      for (const neighborId of neighbors) {
        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const neighborNeighbors = neighborNode.neighbors.get(level) ?? [];
        neighborNode.neighbors.set(level, neighborNeighbors.filter(n => n !== id));
      }
    }

    this.nodes.delete(id);

    if (this.entryPoint === id) {
      const firstKey = this.nodes.keys().next();
      this.entryPoint = this.nodes.size > 0 && !firstKey.done ? firstKey.value : null;
      this.maxLevel = 0;
      for (const n of this.nodes.values()) {
        const nodeLevel = Math.max(...n.neighbors.keys());
        if (nodeLevel > this.maxLevel) {
          this.maxLevel = nodeLevel;
          this.entryPoint = n.id;
        }
      }
    }

    this.emit('removed', { id });
    return true;
  }

  getNode(id: string): HnswNode | null {
    return this.nodes.get(id) ?? null;
  }

  size(): number {
    return this.nodes.size;
  }

  clear(): void {
    this.nodes.clear();
    this.entryPoint = null;
    this.maxLevel = 0;
    this.emit('cleared');
  }

  getStats(): {
    nodeCount: number;
    maxLevel: number;
    dimensions: number;
    avgNeighbors: number;
  } {
    let totalNeighbors = 0;
    let neighborCounts = 0;

    for (const node of this.nodes.values()) {
      for (const neighbors of node.neighbors.values()) {
        totalNeighbors += neighbors.length;
        neighborCounts++;
      }
    }

    return {
      nodeCount: this.nodes.size,
      maxLevel: this.maxLevel,
      dimensions: this.config.dimensions,
      avgNeighbors: neighborCounts > 0 ? totalNeighbors / neighborCounts : 0,
    };
  }
}
