package rag

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type IndexConfig struct {
	StoragePath    string
	EmbeddingModel string
	ChunkSize      int
	ChunkOverlap   int
	AutoIndex      bool
	IndexInterval  time.Duration
}

func DefaultIndexConfig() *IndexConfig {
	return &IndexConfig{
		StoragePath:    ".superai/rag",
		EmbeddingModel: "text-embedding-3-small",
		ChunkSize:      1000,
		ChunkOverlap:   200,
		AutoIndex:      true,
		IndexInterval:  5 * time.Minute,
	}
}

type Index struct {
	mu           sync.RWMutex
	config       *IndexConfig
	vectorStore  *HNSWIndex
	bm25Index    *BM25Index
	embedder     EmbeddingProvider
	loader       DocumentLoader
	indexedFiles map[string]fileMetadata
	stopChan     chan struct{}
}

type fileMetadata struct {
	Path        string    `json:"path"`
	Hash        string    `json:"hash"`
	LastIndexed time.Time `json:"last_indexed"`
	ChunkCount  int       `json:"chunk_count"`
}

type indexState struct {
	Files   map[string]fileMetadata `json:"files"`
	Version string                  `json:"version"`
}

func NewIndex(config *IndexConfig, embedder EmbeddingProvider) *Index {
	if config == nil {
		config = DefaultIndexConfig()
	}

	dimensions := 1536
	if embedder != nil {
		dimensions = embedder.Dimensions()
	}

	return &Index{
		config:       config,
		vectorStore:  NewHNSWIndex(DefaultHNSWConfig(dimensions)),
		bm25Index:    NewBM25Index(),
		embedder:     embedder,
		loader:       DefaultLoader(),
		indexedFiles: make(map[string]fileMetadata),
		stopChan:     make(chan struct{}),
	}
}

func (idx *Index) IndexPath(ctx context.Context, path string) error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	docs, err := idx.loader.Load(path)
	if err != nil {
		return fmt.Errorf("load documents: %w", err)
	}

	if len(docs) == 0 {
		return nil
	}

	if idx.embedder != nil {
		contents := make([]string, len(docs))
		for i, doc := range docs {
			contents[i] = doc.Content
		}

		embeddings, err := idx.embedder.Embed(ctx, contents)
		if err != nil {
			return fmt.Errorf("generate embeddings: %w", err)
		}

		for i, doc := range docs {
			doc.Embedding = embeddings[i]
		}

		if err := idx.vectorStore.Add(docs...); err != nil {
			return fmt.Errorf("add to vector store: %w", err)
		}
	}

	for _, doc := range docs {
		idx.bm25Index.Add(doc)
	}

	fileHash := computePathHash(path)
	idx.indexedFiles[path] = fileMetadata{
		Path:        path,
		Hash:        fileHash,
		LastIndexed: time.Now(),
		ChunkCount:  len(docs),
	}

	return nil
}

func (idx *Index) IndexDirectory(ctx context.Context, dir string) (int, error) {
	docs, err := idx.loader.Load(dir)
	if err != nil {
		return 0, fmt.Errorf("load directory: %w", err)
	}

	if len(docs) == 0 {
		return 0, nil
	}

	idx.mu.Lock()
	defer idx.mu.Unlock()

	if idx.embedder != nil {
		batchSize := 100
		for i := 0; i < len(docs); i += batchSize {
			end := i + batchSize
			if end > len(docs) {
				end = len(docs)
			}
			batch := docs[i:end]

			contents := make([]string, len(batch))
			for j, doc := range batch {
				contents[j] = doc.Content
			}

			embeddings, err := idx.embedder.Embed(ctx, contents)
			if err != nil {
				return 0, fmt.Errorf("generate embeddings for batch %d: %w", i/batchSize, err)
			}

			for j, doc := range batch {
				doc.Embedding = embeddings[j]
			}

			if err := idx.vectorStore.Add(batch...); err != nil {
				return 0, fmt.Errorf("add batch to vector store: %w", err)
			}

			select {
			case <-ctx.Done():
				return i + len(batch), ctx.Err()
			default:
			}
		}
	}

	for _, doc := range docs {
		idx.bm25Index.Add(doc)
	}

	idx.indexedFiles[dir] = fileMetadata{
		Path:        dir,
		Hash:        computePathHash(dir),
		LastIndexed: time.Now(),
		ChunkCount:  len(docs),
	}

	return len(docs), nil
}

func (idx *Index) Search(ctx context.Context, query string, k int) ([]*SearchResult, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	hybridSearcher := NewHybridSearcher(idx.vectorStore, idx.embedder, &HybridSearchConfig{
		VectorSearchWeight: 0.5,
	})

	hybridSearcher.bm25Index = idx.bm25Index

	return hybridSearcher.Search(ctx, query, k)
}

func (idx *Index) SemanticSearch(ctx context.Context, query string, k int) ([]*SearchResult, error) {
	if idx.embedder == nil {
		return nil, fmt.Errorf("no embedding provider configured")
	}

	idx.mu.RLock()
	defer idx.mu.RUnlock()

	vecs, err := idx.embedder.Embed(ctx, []string{query})
	if err != nil {
		return nil, fmt.Errorf("embed query: %w", err)
	}

	docs, err := idx.vectorStore.Search(vecs[0], k)
	if err != nil {
		return nil, fmt.Errorf("vector search: %w", err)
	}

	results := make([]*SearchResult, len(docs))
	for i, doc := range docs {
		results[i] = &SearchResult{
			Document: doc,
			Score:    doc.Score,
			Source:   "vector",
		}
	}

	return results, nil
}

func (idx *Index) KeywordSearch(query string, k int) []*SearchResult {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	docs := idx.bm25Index.Search(query, k)
	results := make([]*SearchResult, len(docs))
	for i, doc := range docs {
		results[i] = &SearchResult{
			Document: doc,
			Score:    doc.Score,
			Source:   "bm25",
		}
	}

	return results
}

func (idx *Index) Remove(ids ...string) error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if err := idx.vectorStore.Delete(ids...); err != nil {
		return fmt.Errorf("delete from vector store: %w", err)
	}

	for _, id := range ids {
		idx.bm25Index.Remove(id)
	}

	return nil
}

func (idx *Index) Clear() {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	dimensions := 1536
	if idx.embedder != nil {
		dimensions = idx.embedder.Dimensions()
	}

	idx.vectorStore = NewHNSWIndex(DefaultHNSWConfig(dimensions))
	idx.bm25Index = NewBM25Index()
	idx.indexedFiles = make(map[string]fileMetadata)
}

func (idx *Index) Save() error {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if err := os.MkdirAll(idx.config.StoragePath, 0755); err != nil {
		return fmt.Errorf("create storage directory: %w", err)
	}

	vectorPath := filepath.Join(idx.config.StoragePath, "vectors.json")
	if err := idx.vectorStore.Save(vectorPath); err != nil {
		return fmt.Errorf("save vector store: %w", err)
	}

	state := &indexState{
		Files:   idx.indexedFiles,
		Version: "1.0",
	}

	statePath := filepath.Join(idx.config.StoragePath, "state.json")
	stateFile, err := os.Create(statePath)
	if err != nil {
		return fmt.Errorf("create state file: %w", err)
	}
	defer stateFile.Close()

	if err := json.NewEncoder(stateFile).Encode(state); err != nil {
		return fmt.Errorf("encode state: %w", err)
	}

	return nil
}

func (idx *Index) Load() error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	vectorPath := filepath.Join(idx.config.StoragePath, "vectors.json")
	if err := idx.vectorStore.Load(vectorPath); err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("load vector store: %w", err)
		}
	}

	statePath := filepath.Join(idx.config.StoragePath, "state.json")
	stateFile, err := os.Open(statePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("open state file: %w", err)
	}
	defer stateFile.Close()

	var state indexState
	if err := json.NewDecoder(stateFile).Decode(&state); err != nil {
		return fmt.Errorf("decode state: %w", err)
	}

	idx.indexedFiles = state.Files

	return nil
}

func (idx *Index) Stats() IndexStats {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return IndexStats{
		DocumentCount: idx.vectorStore.Count(),
		BM25DocCount:  idx.bm25Index.Count(),
		IndexedFiles:  len(idx.indexedFiles),
	}
}

type IndexStats struct {
	DocumentCount int `json:"document_count"`
	BM25DocCount  int `json:"bm25_doc_count"`
	IndexedFiles  int `json:"indexed_files"`
}

func (idx *Index) StartAutoIndex(ctx context.Context, paths []string) {
	if !idx.config.AutoIndex {
		return
	}

	go func() {
		ticker := time.NewTicker(idx.config.IndexInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-idx.stopChan:
				return
			case <-ticker.C:
				for _, path := range paths {
					if idx.needsReindex(path) {
						idx.IndexPath(ctx, path)
					}
				}
			}
		}
	}()
}

func (idx *Index) StopAutoIndex() {
	close(idx.stopChan)
}

func (idx *Index) needsReindex(path string) bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	meta, exists := idx.indexedFiles[path]
	if !exists {
		return true
	}

	currentHash := computePathHash(path)
	return currentHash != meta.Hash
}

func computePathHash(path string) string {
	info, err := os.Stat(path)
	if err != nil {
		return ""
	}

	data := fmt.Sprintf("%s:%d:%d", path, info.Size(), info.ModTime().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:16])
}

type RAGContext struct {
	Query   string
	Results []*SearchResult
}

func (idx *Index) BuildContext(ctx context.Context, query string, maxResults int, maxTokens int) (*RAGContext, error) {
	results, err := idx.Search(ctx, query, maxResults*2)
	if err != nil {
		return nil, err
	}

	var selected []*SearchResult
	totalChars := 0
	estimatedCharsPerToken := 4

	for _, r := range results {
		contentLen := len(r.Document.Content)
		if totalChars+contentLen > maxTokens*estimatedCharsPerToken {
			if len(selected) >= maxResults {
				break
			}
		}
		selected = append(selected, r)
		totalChars += contentLen
		if len(selected) >= maxResults {
			break
		}
	}

	return &RAGContext{
		Query:   query,
		Results: selected,
	}, nil
}

func (rc *RAGContext) FormatForPrompt() string {
	if len(rc.Results) == 0 {
		return ""
	}

	var result string
	result = "Relevant context:\n\n"

	for i, r := range rc.Results {
		result += fmt.Sprintf("--- Document %d (score: %.3f) ---\n", i+1, r.Score)
		if path, ok := r.Document.Metadata["path"]; ok {
			result += fmt.Sprintf("Source: %s\n", path)
		}
		result += r.Document.Content + "\n\n"
	}

	return result
}
