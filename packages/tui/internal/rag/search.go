package rag

import (
	"context"
	"math"
	"sort"
	"strings"
	"sync"
	"unicode"
)

type SearchResult struct {
	Document *Document
	Score    float32
	Source   string
}

type HybridSearcher struct {
	vectorStore        VectorStore
	bm25Index          *BM25Index
	embedder           EmbeddingProvider
	vectorSearchWeight float32
}

type HybridSearchConfig struct {
	VectorSearchWeight float32
}

func NewHybridSearcher(store VectorStore, embedder EmbeddingProvider, config *HybridSearchConfig) *HybridSearcher {
	if config == nil {
		config = &HybridSearchConfig{VectorSearchWeight: 0.5}
	}
	return &HybridSearcher{
		vectorStore:        store,
		bm25Index:          NewBM25Index(),
		embedder:           embedder,
		vectorSearchWeight: config.VectorSearchWeight,
	}
}

func (h *HybridSearcher) Index(docs []*Document) error {
	for _, doc := range docs {
		h.bm25Index.Add(doc)
	}
	return nil
}

func (h *HybridSearcher) Search(ctx context.Context, query string, k int) ([]*SearchResult, error) {
	var vectorResults []*Document
	var bm25Results []*Document
	var vectorErr, bm25Err error
	var wg sync.WaitGroup

	wg.Add(2)

	go func() {
		defer wg.Done()
		if h.embedder != nil && h.vectorStore != nil {
			vecs, err := h.embedder.Embed(ctx, []string{query})
			if err != nil {
				vectorErr = err
				return
			}
			if len(vecs) > 0 {
				vectorResults, vectorErr = h.vectorStore.Search(vecs[0], k*2)
			}
		}
	}()

	go func() {
		defer wg.Done()
		bm25Results = h.bm25Index.Search(query, k*2)
	}()

	wg.Wait()

	if vectorErr != nil && bm25Err != nil {
		return nil, vectorErr
	}

	return h.mergeResults(vectorResults, bm25Results, k), nil
}

func (h *HybridSearcher) mergeResults(vectorResults, bm25Results []*Document, k int) []*SearchResult {
	scores := make(map[string]*SearchResult)

	if len(vectorResults) > 0 {
		maxScore := vectorResults[0].Score
		minScore := vectorResults[len(vectorResults)-1].Score
		scoreRange := maxScore - minScore
		if scoreRange == 0 {
			scoreRange = 1
		}

		for _, doc := range vectorResults {
			normalizedScore := (doc.Score - minScore) / scoreRange
			scores[doc.ID] = &SearchResult{
				Document: doc,
				Score:    h.vectorSearchWeight * normalizedScore,
				Source:   "vector",
			}
		}
	}

	if len(bm25Results) > 0 {
		maxScore := bm25Results[0].Score
		minScore := bm25Results[len(bm25Results)-1].Score
		scoreRange := maxScore - minScore
		if scoreRange == 0 {
			scoreRange = 1
		}

		for _, doc := range bm25Results {
			normalizedScore := (doc.Score - minScore) / scoreRange
			bm25Score := (1 - h.vectorSearchWeight) * normalizedScore

			if existing, ok := scores[doc.ID]; ok {
				existing.Score += bm25Score
				existing.Source = "hybrid"
			} else {
				scores[doc.ID] = &SearchResult{
					Document: doc,
					Score:    bm25Score,
					Source:   "bm25",
				}
			}
		}
	}

	results := make([]*SearchResult, 0, len(scores))
	for _, r := range scores {
		results = append(results, r)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	if len(results) > k {
		results = results[:k]
	}

	return results
}

type BM25Index struct {
	mu                    sync.RWMutex
	docs                  map[string]*Document
	termDocumentFrequency map[string]int
	documentLengths       map[string]int
	avgDocLen             float64
	k1                    float64
	b                     float64
}

func NewBM25Index() *BM25Index {
	return &BM25Index{
		docs:                  make(map[string]*Document),
		termDocumentFrequency: make(map[string]int),
		documentLengths:       make(map[string]int),
		k1:                    1.5,
		b:                     0.75,
	}
}

func (idx *BM25Index) Add(doc *Document) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if _, exists := idx.docs[doc.ID]; exists {
		idx.removeUnlocked(doc.ID)
	}

	idx.docs[doc.ID] = doc

	terms := tokenize(doc.Content)
	idx.documentLengths[doc.ID] = len(terms)

	seen := make(map[string]bool)
	for _, term := range terms {
		if !seen[term] {
			idx.termDocumentFrequency[term]++
			seen[term] = true
		}
	}

	idx.updateAvgDocLen()
}

func (idx *BM25Index) Remove(docID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()
	idx.removeUnlocked(docID)
}

func (idx *BM25Index) removeUnlocked(docID string) {
	doc, exists := idx.docs[docID]
	if !exists {
		return
	}

	terms := tokenize(doc.Content)
	seen := make(map[string]bool)
	for _, term := range terms {
		if !seen[term] {
			idx.termDocumentFrequency[term]--
			if idx.termDocumentFrequency[term] == 0 {
				delete(idx.termDocumentFrequency, term)
			}
			seen[term] = true
		}
	}

	delete(idx.docs, docID)
	delete(idx.documentLengths, docID)
	idx.updateAvgDocLen()
}

func (idx *BM25Index) updateAvgDocLen() {
	if len(idx.documentLengths) == 0 {
		idx.avgDocLen = 0
		return
	}

	total := 0
	for _, length := range idx.documentLengths {
		total += length
	}
	idx.avgDocLen = float64(total) / float64(len(idx.documentLengths))
}

func (idx *BM25Index) Search(query string, k int) []*Document {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	queryTerms := tokenize(query)
	if len(queryTerms) == 0 {
		return nil
	}

	scores := make(map[string]float64)
	n := float64(len(idx.docs))

	for docID, doc := range idx.docs {
		docTerms := tokenize(doc.Content)
		termFreq := make(map[string]int)
		for _, term := range docTerms {
			termFreq[term]++
		}

		docLen := float64(idx.documentLengths[docID])
		score := 0.0

		for _, term := range queryTerms {
			tf := float64(termFreq[term])
			if tf == 0 {
				continue
			}

			df := float64(idx.termDocumentFrequency[term])
			idf := math.Log((n - df + 0.5) / (df + 0.5))
			if idf < 0 {
				idf = 0
			}

			tfNorm := (tf * (idx.k1 + 1)) /
				(tf + idx.k1*(1-idx.b+idx.b*(docLen/idx.avgDocLen)))

			score += idf * tfNorm
		}

		if score > 0 {
			scores[docID] = score
		}
	}

	type scored struct {
		id    string
		score float64
	}
	ranked := make([]scored, 0, len(scores))
	for id, score := range scores {
		ranked = append(ranked, scored{id, score})
	}
	sort.Slice(ranked, func(i, j int) bool {
		return ranked[i].score > ranked[j].score
	})

	if len(ranked) > k {
		ranked = ranked[:k]
	}

	results := make([]*Document, len(ranked))
	for i, r := range ranked {
		doc := *idx.docs[r.id]
		doc.Score = float32(r.score)
		results[i] = &doc
	}

	return results
}

func (idx *BM25Index) Count() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return len(idx.docs)
}

func tokenize(text string) []string {
	text = strings.ToLower(text)

	var tokens []string
	var current strings.Builder

	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			current.WriteRune(r)
		} else if current.Len() > 0 {
			token := current.String()
			if len(token) >= 2 && !isStopWord(token) {
				tokens = append(tokens, token)
			}
			current.Reset()
		}
	}

	if current.Len() > 0 {
		token := current.String()
		if len(token) >= 2 && !isStopWord(token) {
			tokens = append(tokens, token)
		}
	}

	return tokens
}

var stopWords = map[string]bool{
	"a": true, "an": true, "and": true, "are": true, "as": true, "at": true,
	"be": true, "by": true, "for": true, "from": true, "has": true, "he": true,
	"in": true, "is": true, "it": true, "its": true, "of": true, "on": true,
	"or": true, "that": true, "the": true, "to": true, "was": true, "were": true,
	"will": true, "with": true, "this": true, "but": true, "they": true,
	"have": true, "had": true, "what": true, "when": true, "where": true,
	"who": true, "which": true, "why": true, "how": true, "all": true,
	"each": true, "every": true, "both": true, "few": true, "more": true,
	"most": true, "other": true, "some": true, "such": true, "no": true,
	"nor": true, "not": true, "only": true, "own": true, "same": true,
	"so": true, "than": true, "too": true, "very": true, "just": true,
	"can": true, "should": true, "now": true, "if": true, "then": true,
}

func isStopWord(word string) bool {
	return stopWords[word]
}

type SemanticSearcher struct {
	store    VectorStore
	embedder EmbeddingProvider
}

func NewSemanticSearcher(store VectorStore, embedder EmbeddingProvider) *SemanticSearcher {
	return &SemanticSearcher{
		store:    store,
		embedder: embedder,
	}
}

func (s *SemanticSearcher) Search(ctx context.Context, query string, k int) ([]*SearchResult, error) {
	vecs, err := s.embedder.Embed(ctx, []string{query})
	if err != nil {
		return nil, err
	}

	if len(vecs) == 0 {
		return nil, nil
	}

	docs, err := s.store.Search(vecs[0], k)
	if err != nil {
		return nil, err
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

type KeywordSearcher struct {
	index *BM25Index
}

func NewKeywordSearcher() *KeywordSearcher {
	return &KeywordSearcher{
		index: NewBM25Index(),
	}
}

func (s *KeywordSearcher) Index(docs []*Document) {
	for _, doc := range docs {
		s.index.Add(doc)
	}
}

func (s *KeywordSearcher) Search(query string, k int) []*SearchResult {
	docs := s.index.Search(query, k)
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
