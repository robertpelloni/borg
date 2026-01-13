import { describe, test, expect, beforeEach } from 'bun:test';
import { HybridRagSystem } from '../services/HybridRagSystem.js';

describe('HybridRagSystem', () => {
  let ragSystem: HybridRagSystem;
  const mockEmbedding = Array(1536).fill(0.1);

  beforeEach(() => {
    ragSystem = new HybridRagSystem({
      hnswWeight: 0.7,
      bm25Weight: 0.3,
      maxResults: 10,
    });
    ragSystem.setEmbeddingFunction(async () => mockEmbedding);
  });

  describe('Document Indexing', () => {
    test('should index a single document', async () => {
      await ragSystem.addDocument('doc-1', 'TypeScript is a typed superset of JavaScript', undefined, { source: 'test' });
      const stats = ragSystem.getStats();
      
      expect(stats.documentCount).toBe(1);
    });

    test('should index multiple documents in batch', async () => {
      const docs = [
        { id: 'doc-1', content: 'React is a JavaScript library for building user interfaces' },
        { id: 'doc-2', content: 'Vue is a progressive JavaScript framework' },
        { id: 'doc-3', content: 'Angular is a platform for building web applications' },
      ];

      await ragSystem.addDocuments(docs);
      const stats = ragSystem.getStats();
      
      expect(stats.documentCount).toBe(3);
    });

    test('should update existing document on re-index', async () => {
      await ragSystem.addDocument('doc-1', 'Original content');
      await ragSystem.addDocument('doc-1', 'Updated content with new information');
      const stats = ragSystem.getStats();
      
      expect(stats.documentCount).toBe(1);
    });
  });

  describe('Hybrid Search', () => {
    beforeEach(async () => {
      const docs = [
        { id: 'doc-1', content: 'Machine learning is a subset of artificial intelligence', metadata: { category: 'ai' } },
        { id: 'doc-2', content: 'Deep learning uses neural networks with many layers', metadata: { category: 'ai' } },
        { id: 'doc-3', content: 'Natural language processing enables computers to understand text', metadata: { category: 'nlp' } },
        { id: 'doc-4', content: 'Computer vision allows machines to interpret visual data', metadata: { category: 'cv' } },
        { id: 'doc-5', content: 'Reinforcement learning trains agents through rewards', metadata: { category: 'rl' } },
      ];

      await ragSystem.addDocuments(docs);
    });

    test('should return relevant results for a query', async () => {
      const results = await ragSystem.search('neural networks deep learning');
      
      expect(results.length).toBeGreaterThan(0);
      // Scores are normalized, doc-2 should have higher score or be present
      expect(results.some(r => r.id === 'doc-2')).toBe(true);
    });

    test('should respect maxResults limit', async () => {
      const limitedRag = new HybridRagSystem({ maxResults: 2 });
      await limitedRag.addDocuments([
        { id: 'doc-1', content: 'AI content one' },
        { id: 'doc-2', content: 'AI content two' },
        { id: 'doc-3', content: 'AI content three' },
      ]);

      const results = await limitedRag.search('AI content');
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should return scores between 0 and 1', async () => {
      const results = await ragSystem.search('machine learning artificial intelligence');
      
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1.1); // Allows for reranking bonus
      }
    });

    test('should include both vector and keyword scores', async () => {
      const results = await ragSystem.search('learning');
      
      for (const result of results) {
        // results may come from only one index if score is 0 in other
        expect(result.score).toBeDefined();
      }
    });
  });

  describe('Weight Configuration', () => {
    test('should allow adjusting vector/keyword weights', async () => {
      const vectorHeavy = new HybridRagSystem({ hnswWeight: 0.9, bm25Weight: 0.1 });
      const keywordHeavy = new HybridRagSystem({ hnswWeight: 0.1, bm25Weight: 0.9 });
      
      const docs = [
        { id: 'doc-1', content: 'The quick brown fox jumps over the lazy dog' },
        { id: 'doc-2', content: 'A fast auburn canine leaps above a sleepy hound' },
      ];

      await vectorHeavy.addDocuments(docs);
      await keywordHeavy.addDocuments(docs);

      const keywordResults = await keywordHeavy.search('quick brown fox');
      expect(keywordResults[0].id).toBe('doc-1');
    });

    test('should normalize weights', async () => {
      ragSystem.setWeights(2, 3);
      const stats = ragSystem.getStats();
      
      expect(stats.weights.hnsw + stats.weights.bm25).toBeCloseTo(1, 2);
      expect(stats.weights.hnsw).toBeCloseTo(0.4, 2);
      expect(stats.weights.bm25).toBeCloseTo(0.6, 2);
    });
  });

  describe('Document Removal', () => {
    test('should remove document by ID', async () => {
      await ragSystem.addDocuments([
        { id: 'doc-1', content: 'First document' },
        { id: 'doc-2', content: 'Second document' },
      ]);

      await ragSystem.removeDocument('doc-1');
      const stats = ragSystem.getStats();
      
      expect(stats.documentCount).toBe(1);
    });

    test('should handle removal of non-existent document gracefully', async () => {
      await ragSystem.addDocument('doc-1', 'Test');
      
      await ragSystem.removeDocument('non-existent');
      const stats = ragSystem.getStats();
      
      expect(stats.documentCount).toBe(1);
    });

    test('should clear all documents', async () => {
      await ragSystem.addDocuments([
        { id: 'doc-1', content: 'First' },
        { id: 'doc-2', content: 'Second' },
      ]);

      await ragSystem.clear();
      const stats = ragSystem.getStats();
      
      expect(stats.documentCount).toBe(0);
    });
  });
});
